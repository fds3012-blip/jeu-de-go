// Revue d'une partie terminée (issue #34, charte point 3 : « chaque erreur devient une leçon »).
// Revue v3, « Bilan de la partie » (#405), sur le modèle de la revue de chess.com, adaptée au go :
// 1. Pendant l'analyse (dans le Worker du moteur) : Mochi, un proverbe du go et une vraie barre d'avancement.
// 2. Le bilan : courbe d'avantage marquée aux coups clés, précision de chaque joueur (points perdus, jamais une cote),
//    décompte des notes (sceau couleur + symbole), et une seule action principale, « Démarrer le bilan ».
// 3. Le parcours : Mochi ne commente que les coups clés (notation.ts, parcours.ts) ; sceau sur la pierre, meilleur coup
//    en pierre fantôme jade, avance après le coup ; bande des coups à toucher ; « Suivant » en action principale.
//    « Rejouer d'ici » (#34) et « Rejoue cette erreur » (#77) restent en actions secondaires.
// 4. « Rejouer mes erreurs » (#428, RejouerErreurs.tsx) : avec KataGo, quand tu as des erreurs à rejouer, c'est l'action
//    principale du bilan ; « Démarrer le bilan » passe en action secondaire. Sans KataGo, pas de bouton.
// 5. « Partager » (#364, PartagePartie.tsx) : action secondaire du bilan ; la feuille arrive au premier toucher.
// Logique pure : revue.ts (notes de base, précision, moment clé), notation.ts (notes du go), parcours.ts (phrases).
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Board } from '../ui/Board';
import { Mochi } from '../ui/Mochi';
import { Icone } from '../ui/Partie';
import { SceauNote } from '../ui/SceauNote';
import { NOTE_ENCRE } from '../ui/notes';
import { fr } from '../ui/typo';
import { t as tr } from '../content/i18n/secondaires';
import { mouvementsReduits } from '../ui/defilement';
import { toLabel } from '../go/coords';
import { play, type Color, type Position } from '../go/rules';
import { analyseRevue, meilleurCoup, preparerKataGo, type RaisonSansKataGo } from '../engine';
import { EVENTS, track } from '../data/analytics';
import {
  avanceFinale, avancesAffichees, candidatsBrillant, compteNotes, conseilFiable, courbe, courbeY, momentCle, NOTE_INFO, noterCoups, notesAvecCle,
  notesCoherentes, phraseBilan, precisionHonnete, positionsDepuisSgf, rejouerDici, type AnalyseRevue, type Note,
} from './revue';
import { candidatsUniques, classerCoups, confirmeUnique, coupsCles, lignesBilan, NOTES_COURBE, type CoupNote } from './notation';
import { avanceVue, cleSuivante, commentaire, proverbePour } from './parcours';
import { readLocal, writeLocal } from './hooks';
import { noterActivite } from './xp';
import { coupAccepte, creerErreur, ERREURS_KEY, garderRatee, lireErreurs, peutEnFaireUnProbleme, type ErreurGardee } from './erreurs';
import { erreursARejouer, type ErreurARejouer } from './rejouerErreurs';
import { RejouerErreurs } from './RejouerErreurs';
import { usePreferences } from './settings';
import { numerosDesCoups } from '../go/numeros';
import { empreinte, erreursParPhaseDe, garderRevue } from './statsJoueur';
import '../ui/revue.css';
import { tp } from '../content/i18n/partage';

// #364 : feuille « Partager » du bilan, chargée au premier toucher (image, lien, SGF, défi).
const FeuillePartage = lazy(() => import('./PartagePartie').then(m => ({ default: m.PartagePartie })));

interface Props {
  /** La partie, en SGF. */
  sgf: string;
  /** Joueur dont on cherche les erreurs (contre l'ordi : Noir) ; `null` : les deux couleurs (partie à deux). */
  joueur: Color | null;
  /** Nom de l'adversaire (contre l'ordi), pour les phrases. */
  adversaire?: string;
  onRetour: () => void;
  /** « Rejouer d'ici » : historique jusqu'à la position choisie. Absent (partie importée, #286) : pas de « Rejouer d'ici ». */
  onRejouer?: (history: Position[]) => void;
  /** Réglage « confirmer au doigt » : pour « Rejoue cette erreur ». */
  confirmTouch?: boolean;
  /** Partie importée (#286) : visites de KataGo par position (limitées en 19 × 19), sans la confirmation des Brillants. */
  visites?: number;
  /** Libellé du bouton « ‹ » (par défaut : retour au bilan). */
  retour?: string;
  /** « Analyser une autre partie » (#286) : action secondaire, en bas de la revue. */
  onImporter?: () => void;
  /** D'où vient la revue, pour la mesure (`revue_ouverte`) : `historique` depuis « Mes parties » (#358). */
  source?: 'historique';
  /** « Partager » dans le bilan (#364) ; `false` pour une partie partagée par un autre joueur. */
  partage?: boolean;
}

/** « Rejoue cette erreur » en cours : le problème, le nombre d'essais, le dernier coup faux, la réussite. */
interface Rejeu { pb: ErreurGardee; avant: Position; essais: number; faux: number | null; n: number; apres: Position | null }

const L = 300, H = 64; // courbe : repère du viewBox
/** Notes de perte, pour lesquelles on cherche et montre le meilleur coup. */
const PERTES: ReadonlySet<Note> = new Set(['imprecision', 'erreur', 'manque', 'grosse']);
/** Notes qui peuvent devenir un problème à rejouer (#77, erreurs.ts) : leur bon coup reste caché jusqu'à un essai. */
const PROBLEMES: ReadonlySet<Note> = new Set(['erreur', 'manque', 'grosse']);

export function Revue({ sgf, joueur, adversaire, onRetour, onRejouer, confirmTouch = false, visites, retour, onImporter, source, partage = true }: Props) {
  const { positions, komi, resultat } = useMemo(() => positionsDepuisSgf(sgf), [sgf]);
  const n = positions.length - 1, size = positions[0].size;
  const [etape, setEtape] = useState<'bilan' | 'parcours'>('bilan');
  // « Rejouer mes erreurs » (#428) : la séance, figée au départ ; `null` hors séance.
  const [seance, setSeance] = useState<ErreurARejouer[] | null>(null);
  const [i, setI] = useState(0);
  const [analyses, setAnalyses] = useState<(AnalyseRevue | null)[]>([]);
  const [confirmations, setConfirmations] = useState<Record<number, number>>({});
  const [uniques, setUniques] = useState<ReadonlySet<number>>(() => new Set());
  // Meilleur coup par erreur, seulement s'il est fiable (conseilFiable) ; `null` : rien à montrer.
  const [meilleurs, setMeilleurs] = useState<Record<number, number | null>>({});
  // #364 : feuille « Partager » ouverte.
  const [partager, setPartager] = useState(false);
  // « Rejoue cette erreur » (issue #77) : `null` hors rejeu.
  const [rejeu, setRejeu] = useState<Rejeu | null>(null);
  // Erreurs dont le bon coup est dévoilé (après un essai ou « Voir le bon coup »), par numéro de coup.
  const [devoilees, setDevoilees] = useState<ReadonlySet<number>>(() => new Set());
  const liste = useRef<HTMLOListElement>(null);
  // Analyse arrêtée par le joueur (#286) : les positions restantes n'ont pas d'estimation.
  const arretee = useRef(false);
  const [arret, setArret] = useState(false);
  // #424 : KataGo en préparation (téléchargement du réseau la première fois), puis la raison s'il n'a pas pu servir.
  const [prepare, setPrepare] = useState(true);
  const [sansKataGo, setSansKataGo] = useState<RaisonSansKataGo | null>(null);
  const mode = visites ? 'import' : adversaire ? 'ordi' : 'deux';
  // #365 : coordonnées, dernier coup et numéros des coups, selon les Réglages.
  const prefs = usePreferences();
  const analysees = analyses.length;
  const finie = analysees > n;
  // #424 : courbe et pastille sans les estimations aberrantes du moteur simple.
  const avances = useMemo(() => avancesAffichees(positions, analyses), [positions, analyses]);
  const cle = useMemo(() => (finie ? momentCle(positions, analyses, joueur) : null), [finie, positions, analyses, joueur]);
  // Notes de base (perte en points), accordées au moment clé, puis les notes du go (#405).
  const notes = useMemo<(CoupNote | null)[]>(() => {
    if (!finie) return [];
    const base = notesAvecCle(noterCoups(positions, analyses, confirmations), cle, analyses, size);
    // #424 : jamais « Solide » ou « Bon » à côté d'une avance qui s'effondre.
    return notesCoherentes(classerCoups(positions, analyses, base, uniques), analyses, size);
  }, [finie, positions, analyses, confirmations, cle, size, uniques]);
  const cles = useMemo(() => coupsCles(notes, joueur, cle?.coup), [notes, joueur, cle]);
  const avanceNoir = finie ? avanceFinale(resultat, analyses[n]?.lead) : null;
  const proverbe = useMemo(() => proverbePour(sgf), [sgf]);
  // #428 : erreurs à rejouer, seulement avec KataGo (rejouerErreurs.ts écarte toute position sans analyse KataGo).
  const aRejouer = useMemo(() => (finie ? erreursARejouer(positions, analyses, notes, joueur) : []), [finie, positions, analyses, notes, joueur]);
  // Coups dont on cherche le meilleur coup avec KataGo (#34) : tes pertes parmi les coups clés.
  const aConseiller = useMemo(() => cles.filter(c => { const x = notes[c - 1]; return !!x && PERTES.has(x.note) && (!joueur || x.couleur === joueur); }), [cles, notes, joueur]);

  // #368 : une revue finie avec KataGo nourrit « Mes statistiques » (précision, erreurs par phase), sur l'appareil.
  // Partie à deux (pas de joueur) ou analyse arrêtée : rien n'est gardé.
  useEffect(() => {
    if (!finie || !joueur || arret || !analyses.some(a => a?.engine === 'katago')) return;
    const p = precisionHonnete(notes, joueur, avanceNoir, size);
    if (p == null) return;
    garderRevue({ cle: empreinte(sgf), date: new Date().toISOString(), taille: size, precision: p, erreurs: erreursParPhaseDe(notes, joueur, n, size) });
  }, [finie, joueur, arret, analyses, notes, avanceNoir, size, sgf, n]);

  useEffect(() => { track(EVENTS.revueOuverte, { coups: n, taille: size, mode, ...(source ? { source } : {}) }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Analyse dans le Worker du moteur, une position après l'autre. Le moteur est choisi une fois pour toutes
  // (KataGo s'il est prêt ou en cache, sinon le moteur simple) : deux moteurs ne se comparent pas.
  useEffect(() => {
    let vivant = true;
    (async () => {
      const prep = await preparerKataGo();
      if (!vivant) return;
      const kataGo = prep.pret;
      setPrepare(false);
      setSansKataGo(prep.pret ? null : prep.raison);
      const out: (AnalyseRevue | null)[] = [];
      for (const p of positions) {
        let a: AnalyseRevue | null;
        try { a = await analyseRevue(p, komi, { kataGo, visits: visites }); } catch { a = null; }
        if (!vivant || arretee.current) return;
        out.push(a);
        setAnalyses([...out]);
      }
      // Brillant : chaque candidat est revu par une analyse cinq fois plus longue. Sans confirmation, pas de Brillant.
      // Partie importée : pas de confirmation (analyse déjà longue sur mobile), donc pas de Brillant.
      if (visites) return;
      for (const k of candidatsBrillant(positions, out)) {
        const a = await analyseRevue(positions[k], komi, { visits: 160 }).catch(() => null);
        if (!vivant) return;
        if (a?.engine === 'katago') setConfirmations(c => ({ ...c, [k]: positions[k - 1].toPlay === 1 ? a.lead : -a.lead }));
      }
      // #405 : Brillant « seul bon coup » : la position d'avant est revue plus longuement, le coup doit rester seul en tête.
      for (const k of candidatsUniques(positions, out)) {
        const a = await analyseRevue(positions[k - 1], komi, { visits: 160 }).catch(() => null);
        if (!vivant) return;
        if (confirmeUnique(a, positions[k].lastMove ?? -1, size)) setUniques(u => new Set(u).add(k));
      }
    })();
    return () => { vivant = false; };
  }, [positions, komi, visites, size]);

  /** « Arrêter l'analyse » (#286) : la revue se contente des positions déjà analysées. */
  function arreter() {
    arretee.current = true;
    setArret(true);
    setAnalyses(a => [...a, ...Array<AnalyseRevue | null>(Math.max(0, n + 1 - a.length)).fill(null)]);
  }

  // Meilleur coup, seulement là où tu as perdu des points, et seulement avec KataGo : sans lui, aucun conseil (jamais de conseil faux).
  useEffect(() => {
    if (!aConseiller.length) return;
    let vivant = true;
    (async () => {
      for (const coup of aConseiller) {
        const avant = positions[coup - 1], c = avant.toPlay, apres = avances[coup];
        let m: number | null = null;
        try {
          const r = await meilleurCoup(avant, komi);
          if (!vivant) return;
          if (!r.katago) return;
          // Gain du coup conseillé sur le coup joué, pour le joueur qui s'est trompé.
          const gain = apres == null ? 0 : r.lead - (c === 1 ? apres : -apres);
          m = conseilFiable(avant, r.move, gain) ? r.move : null;
        } catch { m = null; }
        if (!vivant) return;
        setMeilleurs(o => ({ ...o, [coup]: m }));
      }
    })();
    return () => { vivant = false; };
  }, [aConseiller, positions, komi]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clavier, pendant le parcours : flèches gauche et droite.
  useEffect(() => {
    if (etape !== 'parcours' || rejeu) return;
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') aller(i - 1);
      else if (e.key === 'ArrowRight') aller(i + 1);
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  });

  // La bande des coups suit le coup affiché.
  useEffect(() => {
    const b = liste.current?.querySelector<HTMLElement>('[aria-current="true"]');
    b?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: mouvementsReduits() ? 'auto' : 'smooth' });
  }, [i, etape]);

  function aller(k: number) { setI(Math.max(0, Math.min(n, k))); }
  function demarrer(depuis?: number) {
    setI(depuis ?? cles[0] ?? Math.min(1, n));
    setEtape('parcours');
    window.scrollTo?.({ top: 0 });
  }
  function suivant() {
    const k = cleSuivante(cles, i);
    if (k == null) { setEtape('bilan'); window.scrollTo?.({ top: 0 }); return; }
    setI(k);
  }
  function rejouer() {
    // Le goban montre le coup commenté. Ton coup : on rejoue depuis la position juste avant lui. Coup de l'adversaire :
    // juste après lui, quand c'est à toi (sinon on reculerait jusqu'à ton coup précédent).
    const tonCoup = i > 0 && (!joueur || positions[i - 1].toPlay === joueur);
    const h = rejouerDici(positions, tonCoup ? i : Math.min(n, i) + 1, joueur ?? null);
    track(EVENTS.revueRejouer, { coup: h.length - 1, cle: !!cle && i === cle.coup, perte: notes[i - 1] ? Math.round(notes[i - 1]!.perte) : null, taille: size, mode });
    onRejouer?.(h);
  }
  /**
   * « Rejoue cette erreur » : la position avant l'erreur, avec le meilleur coup de KataGo et les coups qui perdent
   * moins de 1 point, tirés de l'analyse déjà faite pour la revue.
   */
  function rejouerErreur(coup: number) {
    const avant = positions[coup - 1], nt = notes[coup - 1];
    const pb = creerErreur({
      avant, joue: positions[coup].lastMove ?? -1, coup, note: nt?.note,
      meilleur: meilleurs[coup], perte: nt?.perte ?? 0, analyse: analyses[coup - 1], adversaire,
    }, new Date());
    if (!pb) return;
    setRejeu({ pb, avant, essais: 0, faux: null, n: 0, apres: null });
    window.scrollTo?.({ top: 0 });
  }
  function essayer(p: number) {
    if (!rejeu || rejeu.apres) return;
    const { pb, avant } = rejeu, ok = coupAccepte(pb, p);
    const suite = ok ? play(avant, p) : null;
    const apres = suite && typeof suite === 'object' ? suite : null;
    if (rejeu.essais === 0) {
      noterActivite('erreurs'); // #369 : objectif « erreurs rejouées » de la semaine
      track(EVENTS.erreurRejouee, { reussi: !!apres, source: 'revue', taille: size, coup: pb.coup, rates: 0, reponses: pb.reponses.length });
      // Ratée au premier essai : elle revient demain dans « Tes erreurs à rejouer ».
      if (!apres) writeLocal(ERREURS_KEY, garderRatee(lireErreurs(readLocal<unknown>(ERREURS_KEY, [])), pb, new Date()));
    }
    setRejeu({ ...rejeu, essais: rejeu.essais + 1, faux: apres ? null : p, n: rejeu.n + 1, apres });
  }
  function devoiler(coup: number) { setDevoilees(d => new Set(d).add(coup)); }
  function finirRejeu() {
    const coup = rejeu?.pb.coup;
    // Après un essai, réussi ou non, le parcours montre le bon coup.
    if (coup != null && rejeu && rejeu.essais > 0) devoiler(coup);
    setRejeu(null);
    if (coup != null) setI(coup);
  }

  const moi: Color = joueur ?? 1, lui = (3 - moi) as Color;
  const nomMoi = tr(adversaire ? 'camp.toi' : 'camp.noir'), nomLui = adversaire ?? tr('camp.blanc');
  const avecKataGo = analyses.some(a => a?.engine === 'katago');
  const { ligne, aire } = courbe(avances, L, H, size);
  const x = (k: number) => (n <= 0 ? L / 2 : (k * L) / n);
  const tete = (onClick: () => void, aria: string, compteur?: string) => (
    <header className="revue-tete">
      <button type="button" className="retour" onClick={onClick} aria-label={aria}>‹</button>
      <h2>{tr('fin.revoir')}</h2>
      {compteur && <span className="revue-compteur">{compteur}</span>}
    </header>
  );

  // ---------- « Rejouer mes erreurs » (#428) ----------
  if (seance) {
    return (
      <RejouerErreurs sgf={sgf} positions={positions} komi={komi} analyses={analyses} erreurs={seance} joueur={joueur}
        adversaire={adversaire} confirmTouch={confirmTouch} onRetour={() => { setSeance(null); window.scrollTo?.({ top: 0 }); }} />
    );
  }

  // ---------- « Rejoue cette erreur » (#77) ----------
  if (rejeu) {
    const pos = rejeu.apres ?? rejeu.avant;
    const phrase = rejeu.apres
      ? `${tr(rejeu.pb.reponses.length > 1 ? 'erreurs.bravoParmi' : 'erreurs.bravoKataGo')}${rejeu.essais > 1 ? ` ${tr('revue.rejeu.revient')}` : ''}`
      : rejeu.faux != null ? tr('revue.rejeu.rate') : tr('revue.rejeu.consigne');
    return (
      <div className="revue revue-rejeu">
        <header className="revue-tete">
          <button type="button" className="retour" onClick={finirRejeu} aria-label={tr('revue.rejeu.retour')}>‹</button>
          <h2>{tr('revue.rejeu.titre')}</h2>
          <span className="revue-compteur">{tr('revue.coup', { coup: rejeu.pb.coup })}</span>
        </header>
        <div className="revue-plateau">
          <Board size={size} board={pos.board} toPlay={rejeu.avant.toPlay} interactive={!rejeu.apres} confirmTouch={confirmTouch} onPlay={essayer}
            marks={{ last: rejeu.apres ? rejeu.apres.lastMove : undefined, ok: rejeu.apres?.lastMove ?? undefined, mistake: rejeu.faux ?? undefined }}
            shake={rejeu.faux != null ? { p: rejeu.faux, n: rejeu.n } : null} />
        </div>
        <div className={`revue-mochi${rejeu.apres ? ' revue-rejeu-ok' : ''}`} aria-live="polite">
          <Mochi size={40} />
          <p>{fr(phrase)}</p>
        </div>
        {rejeu.apres
          ? <div className="dock revue-dock"><button type="button" className="cta" onClick={finirRejeu}>{tr('revue.rejeu.retour')}</button></div>
          : <button type="button" className="btn revue-probleme" onClick={finirRejeu}>{tr('revue.rejeu.retour')}</button>}
      </div>
    );
  }

  // ---------- 1. Analyse en cours : Mochi, un proverbe, la barre d'avancement ----------
  if (!finie) {
    const pct = Math.round((100 * Math.min(analysees, n + 1)) / (n + 1));
    return (
      <div className="revue revue-attente">
        {tete(onRetour, retour ?? tr('revue.retour'))}
        <div className="bilan-attente revue-analyse">
          <div className="bilan-attente-mochi"><Mochi size={84} /></div>
          <figure className="bilan-proverbe">
            <figcaption className="bilan-proverbe-titre">{tr('bilan3.proverbe')}</figcaption>
            <blockquote>{fr(`« ${proverbe.texte} »`)}</blockquote>
            <p className="bilan-proverbe-source">{fr(proverbe.source)}</p>
          </figure>
          <div className="bilan-avance" aria-live="polite">
            <p className="bilan-avance-texte"><span>{fr(tr('bilan3.chargement'))}</span><b>{fr(tr('bilan3.pourcent', { p: pct }))}</b></p>
            {prepare && <p className="revue-note bilan-katago">{fr(tr('bilan3.kataGoCharge'))}</p>}
            <div className="bilan-barre" role="progressbar" aria-label={tr('bilan3.progression')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <span style={{ transform: `scaleX(${pct / 100})` }} />
            </div>
          </div>
          {visites != null && <button type="button" className="btn revue-arret" onClick={arreter}>{tr('import.arreter')}</button>}
        </div>
      </div>
    );
  }

  const courbeSvg = (onClick?: (k: number) => void) => (
    <figure className="revue-courbe">
      <svg viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" role="img" aria-label={tr('revue.courbe')}
        onClick={onClick && (e => { const r = e.currentTarget.getBoundingClientRect(); onClick(Math.round(((e.clientX - r.left) / r.width) * n)); })}>
        <rect className="revue-courbe-blanc" x="0" y="0" width={L} height={H} />
        {aire && <path className="revue-courbe-noir" d={aire} />}
        <line className="revue-courbe-milieu" x1="0" x2={L} y1={H / 2} y2={H / 2} />
        {ligne && <path className="revue-courbe-ligne" d={ligne} vectorEffect="non-scaling-stroke" />}
        {etape === 'parcours' && <line className="revue-courbe-curseur" x1={x(i)} x2={x(i)} y1="0" y2={H} vectorEffect="non-scaling-stroke" />}
      </svg>
      {/* Points des coups clés, en HTML : ronds même quand la courbe s'étire. */}
      {notes.map(nt => nt && NOTES_COURBE.has(nt.note) && cles.includes(nt.coup) && avances[nt.coup] != null ? (
        <span key={nt.coup} className="revue-courbe-point" data-note={nt.note} aria-hidden="true"
          style={{ left: `${(x(nt.coup) / L) * 100}%`, top: `${(courbeY(avances[nt.coup]!, H, size) / H) * 100}%`, background: NOTE_ENCRE[nt.note].fond }} />
      ) : null)}
    </figure>
  );

  // ---------- 2. Le bilan ----------
  if (etape === 'bilan') {
    const precMoi = precisionHonnete(notes, moi, avanceNoir, size), precLui = precisionHonnete(notes, lui, avanceNoir, size);
    const cMoi = compteNotes(notes, moi), cLui = compteNotes(notes, lui);
    const lignes = lignesBilan(avecKataGo).filter(l => cMoi[l] + cLui[l] > 0 || (avecKataGo && l === 'brillant'));
    const pierre = (c: Color) => <span className={`revue-coup-pierre bilan-pierre ${c === 1 ? 'noire' : 'blanche'}`} aria-hidden="true" />;
    return (
      <div className="revue revue-bilan">
        {tete(onRetour, retour ?? tr('revue.retour'))}
        <div className="bilan-coach">
          <Mochi size={48} />
          <p className="bilan-bulle">{fr(phraseBilan(notes, moi, adversaire, { avanceNoir, size, cle, sansKataGo: !avecKataGo }))}</p>
        </div>
        {courbeSvg(k => demarrer(Math.max(1, k)))}
        <table className="bilan-table" aria-label={tr('bilan3.tableau')}>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">{tr('revue.note')}</span></th>
              <th scope="col"><span className="bilan-joueur">{pierre(moi)}{nomMoi}</span></th>
              <th scope="col"><span className="bilan-joueur">{pierre(lui)}{nomLui}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr className="bilan-precision" data-ligne="precision">
              <th scope="row">{tr('revue.precision')}</th>
              <td><span className="bilan-score bilan-score-moi">{precMoi == null ? '–' : fr(tr('bilan3.pourcent', { p: precMoi }))}</span></td>
              <td><span className="bilan-score">{precLui == null ? '–' : fr(tr('bilan3.pourcent', { p: precLui }))}</span></td>
            </tr>
            {lignes.map(l => (
              <tr key={l} data-ligne={l}>
                <th scope="row"><span className="revue-table-note"><SceauNote note={l} taille={24} />{NOTE_INFO[l].libelle}</span></th>
                <td className={cMoi[l] ? 'plein' : undefined}>{cMoi[l] || '–'}</td>
                <td className={cLui[l] ? 'plein' : undefined}>{cLui[l] || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="revue-note bilan-aide">{fr(tr('bilan3.precisionAide'))}</p>
        {!avecKataGo && <p className="revue-note revue-sans-katago">{fr(tr(sansKataGo ? `bilan3.sansKataGo.${sansKataGo}` : 'bilan3.sansKataGo'))}</p>}
        {arret && <p className="revue-note revue-arretee">{fr(tr('import.arretee'))}</p>}
        {aRejouer.length > 0 && <button type="button" className="btn bilan-parcours" onClick={() => demarrer()}>{tr('bilan3.demarrer')}</button>}
        {/* #364 : partager la partie (lien de la revue, image du moment clé, SGF, défi), en action secondaire. */}
        {partage && n >= 1 && <button type="button" className="btn bilan-partager" onClick={() => setPartager(true)}>{tp('partage.bouton')}</button>}
        {onImporter && <button type="button" className="lien revue-importer" onClick={onImporter}>{tr('import.autre')}</button>}
        {partager && (
          <Suspense fallback={null}>
            <FeuillePartage sgf={sgf} joueur={joueur} adversaire={adversaire} coup={cle?.coup ?? 0} mode={mode} onFermer={() => setPartager(false)} />
          </Suspense>
        )}
        <div className="dock revue-dock">
          {aRejouer.length > 0
            ? <button type="button" className="cta" onClick={() => { setSeance(aRejouer); window.scrollTo?.({ top: 0 }); }}>{tr('rejeu.bouton', { n: aRejouer.length })}</button>
            : <button type="button" className="cta" onClick={() => demarrer()} disabled={n < 1}>{tr('bilan3.demarrer')}</button>}
        </div>
      </div>
    );
  }

  // ---------- 3. Le parcours des coups clés ----------
  const q = positions[i];
  const brute = i > 0 ? notes[i - 1] ?? null : null;
  // Pierre verte : le meilleur coup, seulement s'il est fiable (KataGo, et pas un coup de bord douteux).
  const tienne = !!brute && !(joueur && brute.couleur !== joueur);
  // #77, gardé en v3 : sur ton Erreur, Coup manqué ou Gaffe rejouable avec KataGo, le bon coup reste caché jusqu'à
  // un essai ou « Voir le bon coup » (chercher soi-même d'abord). Tant que le conseil n'est pas arrivé, on le cache aussi.
  const aTrouver = tienne && avecKataGo && !!brute && PROBLEMES.has(brute.note) && meilleurs[brute.coup] !== null && !devoilees.has(brute.coup);
  const fantome = brute && tienne && PERTES.has(brute.note) && !aTrouver
    ? meilleurs[brute.coup] ?? (brute.meilleur != null && conseilFiable(positions[i - 1], brute.meilleur, brute.perte) ? brute.meilleur : null)
    : null;
  const note: CoupNote | null = brute && { ...brute, meilleur: fantome ?? undefined };
  const toi = !!adversaire && !!note && note.couleur === moi;
  // Contre l'ordi : son nom (auteur du coup, ou celui qui pouvait punir) ; à deux : le camp qui a joué.
  const auteur = note ? adversaire ?? tr(note.couleur === 1 ? 'camp.noir' : 'camp.blanc') : '';
  const com = note ? commentaire(note, positions, { toi, nom: auteur }) : null;
  const avance = i > 0 ? avanceVue(avances[i], moi) : null;
  const surCle = !!cle && i === cle.coup;
  const prochaine = cleSuivante(cles, i);
  const peutRejouer = !!note && !(joueur && note.couleur !== joueur) && peutEnFaireUnProbleme(note.note, meilleurs[note.coup]);
  const marqueNote = note && q.lastMove != null && q.lastMove >= 0
    ? { p: q.lastMove, ...NOTE_ENCRE[note.note], symbole: NOTE_INFO[note.note].symbole, libelle: NOTE_INFO[note.note].libelle, cle: i } : undefined;
  const nomAvance = avance && avance.valeur !== 0 ? (avance.valeur > 0 ? nomMoi : nomLui) : '';

  return (
    <div className="revue revue-parcours">
      {tete(() => { setEtape('bilan'); window.scrollTo?.({ top: 0 }); }, tr('parcours.retour'), tr('revue.compteur', { i, n }))}

      <div className="parcours-bulle revue-mochi" data-note={note?.note} aria-live="polite">
        <Mochi size={44} />
        <div key={i} className="parcours-texte">
          {com ? (
            <>
              <p className="parcours-titre">
                {note && <SceauNote note={note.note} taille={22} />}
                <span>{fr(com.titre)}</span>
                {avance && (
                  <span className={`parcours-avance${avance.valeur < 0 ? ' negatif' : ''}`}
                    aria-label={avance.valeur === 0 ? tr('parcours.egalite') : avance.valeur > 0 && adversaire
                      ? tr('parcours.avanceToiAria', { n: avance.valeur, v: avance.texte.slice(1) })
                      : tr('parcours.avanceAria', { nom: nomAvance, n: Math.abs(avance.valeur), v: avance.texte.replace(/^[+−]/, '') })}>
                    {avance.texte}
                  </span>
                )}
              </p>
              <p className="parcours-detail">
                {surCle && <b className="parcours-cle">{tr('parcours.cle')}</b>}
                {fr(aTrouver ? `${com.detail} ${tr('parcours.aTrouver')}` : com.detail)}
              </p>
            </>
          ) : <p className="parcours-detail">{fr(i === 0 ? tr('parcours.debut') : tr('revue.etiquette', { c: i, lieu: (q.lastMove ?? -1) < 0 ? tr('coup.passe') : toLabel(q.lastMove!, size) }))}</p>}
          {i > 0 && prochaine == null && <p className="parcours-fin">{fr(tr('parcours.fin'))}</p>}
        </div>
      </div>

      <div className="revue-plateau">
        <Board size={size} board={q.board} marks={{ last: prefs.dernierCoup ? q.lastMove : null, meilleur: fantome ?? undefined, note: marqueNote }}
          coordonnees={prefs.coordonnees} numeros={prefs.numerosRevue ? numerosDesCoups(positions, i) : null} />
      </div>

      <div className="revue-nav">
        <button type="button" className="btn revue-pas" onClick={() => aller(i - 1)} disabled={i <= 0} aria-label={tr('parcours.coupPrecedent')}><Icone nom="precedent" /></button>
        <ol ref={liste} className="revue-coups" aria-label={tr('revue.coups')}>
          {positions.slice(1).map((p, k) => {
            const c = k + 1, nt = notes[k], m = p.lastMove ?? -1;
            const lieu = m < 0 ? tr('coup.passe') : toLabel(m, size);
            const etiquette = `${tr('revue.etiquette', { c, lieu })}${nt ? `, ${NOTE_INFO[nt.note].libelle}` : ''}`;
            return (
              <li key={c}>
                <button type="button" className={`revue-coup${cles.includes(c) ? ' cle' : ''}`} aria-current={c === i ? 'true' : undefined} aria-label={etiquette} onClick={() => aller(c)}>
                  <span className="revue-coup-num">{c}</span>
                  <span className={`revue-coup-pierre ${positions[k].toPlay === 1 ? 'noire' : 'blanche'}`} aria-hidden="true" />
                  <span className="revue-coup-lieu">{lieu}</span>
                  {nt ? <SceauNote note={nt.note} taille={18} /> : <span className="revue-coup-vide" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" className="btn revue-pas" onClick={() => aller(i + 1)} disabled={i >= n} aria-label={tr('parcours.coupSuivant')}><Icone nom="suivant" /></button>
      </div>

      {(onRejouer || peutRejouer) && (
        <div className="parcours-secondaires">
          {peutRejouer && <button type="button" className="btn revue-probleme" onClick={() => rejouerErreur(note!.coup)}>{tr('revue.rejoueErreur')}</button>}
          {onRejouer && i > 0 && <button type="button" className="btn revue-rejouer" onClick={rejouer}>{tr('revue.rejouer')}</button>}
        </div>
      )}
      {aTrouver && peutRejouer && (
        <button type="button" className="lien revue-voir" onClick={() => devoiler(note!.coup)}>{tr('revue.voirBonCoup')}</button>
      )}

      <p className="revue-courbe-legende" aria-hidden="true">{fr(tr('revue.courbeLegende'))}</p>
      {courbeSvg(k => aller(k))}

      <div className="dock revue-dock">
        <button type="button" className="cta" onClick={suivant}>{tr(prochaine == null ? 'parcours.terminer' : 'parcours.suivant')}</button>
      </div>
    </div>
  );
}
