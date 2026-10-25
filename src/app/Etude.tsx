// « Étudier une position » (#372), sous-écran du Profil chargé à la demande : le goban libre du joueur de club.
// En 3 secondes : un goban, quatre outils (Noir, Blanc, Effacer, Jouer) et une seule action principale, « Analyser ».
// - Poser : la position vue au club, pierre par pierre (toucher une pierre de la même couleur l'enlève).
// - Jouer : des coups avec les règles, numérotés sur les pierres ; « Revenir » montre la position de départ intacte.
// - Arbre de variantes (#562) : jouer un autre coup depuis une position passée crée une variante, la suite d'avant reste
//   la ligne principale. Flèches ‹ › autour d'« Analyser » (et ← → au clavier hors du goban), puces « Variantes au
//   coup N », retour à la ligne principale, variante supprimée ou promue. Commentaires d'un SGF montrés en texte.
// - Komi et règle (#562) : réglables dans « Komi · règle » (action secondaire) ; KataGo les reçoit (handicap compris).
// - Analyser : KataGo, à la demande, une recherche par geste (batterie) : ses 3 meilleurs coups en pierres vertes avec
//   leurs chances de gain, et qui mène. Chaque conseil passe le filtre de la revue (`conseilFiable` : jamais un coup
//   illégal ni un coup de première ligne sans raison). Sans KataGo en cache : « Télécharge l'IA », aucun conseil.
// - L'étude est gardée sur l'appareil (go.etude.v1, avec la branche et le coup montrés) et s'exporte en SGF avec ses
//   variantes et ses commentaires (« Analyser une partie » en relit la ligne principale).
// - Partager (#449) : la feuille de partage de #364 (lien `mochi-go.app/partie#JETON`, image, SGF), action secondaire.
//   Le lien et l'image portent la ligne principale seule (#562) ; le fichier SGF, l'étude entière.
//   Une étude reçue par lien s'ouvre ici en copie (« Étudie-la avec Mochi ») ; l'étude d'avant revient avec « Annuler ».
// Logique pure : src/go/etude.ts.
import { lazy, Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Board } from '../ui/Board';
import { C, M, viewBoxOf } from '../ui/boardArt';
import { fr } from '../ui/typo';
import { tk, nombreClub, type CleClub } from '../content/i18n/club';
import { toLabel } from '../go/coords';
import { boardKey, type Color } from '../go/rules';
import { numerosDesCoups } from '../go/numeros';
import type { Rules } from '../go/score';
import {
  allerA, avecDepart, choisirVariante, creeraitVariante, debutVariante, ETUDE_KEY, etudeAGarder, etudeDepuisSgf, etudeVersSgf, etudeVide,
  handicapEtude, jouerVariante, KOMI_MAX, KOMIS_ETUDE, lignePrincipale, lireEtude, noteIci, pierresPosees, poser, positionsEtude, precedent,
  promouvoirVariante, prolonger, regler, reglagesAnalyse, suivant, supprimerVariante, tailleArbre, TAILLES_ETUDE, variantesIci,
  type Etude as EtatEtude, type Outil, type TailleEtude,
} from '../go/etude';
import { preparerKataGo, type RaisonSansKataGo } from '../engine';
import { analyseEtude, raisonRepliApprofondi } from '../engine/revueKataGo';
// C8 (#732) : « Analyse approfondie », seulement si le joueur l'a téléchargée et activée (Réglages).
import { approfondie } from '../engine/approfondie';
import { thl } from '../content/i18n/horsLigne';
import { EVENTS, track } from '../data/analytics';
import { conseilFiable } from './revue';
import { readLocal, writeLocal } from './hooks';
import { usePreferences } from './settings';
import { copieEtudeEnAttente, oublierCopieEtude } from './copieEtude';
import '../ui/club.css';
import '../ui/etude.css';
import { useProgressionKataGo } from './progressionKataGo';

const FeuillePartage = lazy(() => import('./PartagePartie').then(m => ({ default: m.PartagePartie })));

/** Coups conseillés montrés au plus. */
const CANDIDATS = 3;
/** Retours en arrière gardés. */
const MAX_HISTOIRE = 200;


type Analyse =
  | { etat: 'attente' }
  | { etat: 'sans-katago'; raison: RaisonSansKataGo | null; telechargement: boolean }
  | { etat: 'pret'; cle: string; lead: number; coups: { move: number; winrate: number | null; lead: number }[]; passe: boolean; ap: 'utilisee' | 'trop-lent' | 'indisponible' | null }
  | { etat: 'erreur' };

const OUTILS: readonly Outil[] = ['noir', 'blanc', 'effacer', 'jouer'];

interface Props {
  confirmTouch: boolean;
}

export function Etude({ confirmTouch }: Props) {
  const [reprise] = useState(() => lireEtude(readLocal<unknown>(ETUDE_KEY, null)));
  // #449 : copie d'une étude reçue par lien ; l'étude d'avant reste un « Annuler » plus loin.
  const [copie] = useState(() => {
    const c = copieEtudeEnAttente();
    const e = c ? etudeDepuisSgf(c.sgf) : null;
    return c && e ? { etude: e, pseudo: c.pseudo } : null;
  });
  const avant = copie && reprise && (pierresPosees(reprise) || reprise.suites.length) ? reprise : null;
  const [etude, setEtude] = useState<EtatEtude>(() => copie?.etude ?? reprise ?? etudeVide(9));
  const [histoire, setHistoire] = useState<EtatEtude[]>(() => (avant ? [avant] : []));
  const [outil, setOutil] = useState<Outil>(() => ((copie?.etude ?? reprise)?.suites.length ? 'jouer' : 'noir'));
  const [annonce, setAnnonce] = useState<string | null>(() => (copie
    ? `${copie.pseudo ? tk('etude.copie', { pseudo: copie.pseudo }) : tk('etude.copieSans')}${avant ? ` ${tk('etude.copieAvant')}` : ''}`
    : null));
  const [partage, setPartage] = useState(false);
  const [refus, setRefus] = useState<{ texte: string; p: number; n: number } | null>(null);
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [export_, setExport] = useState(false);
  const prefs = usePreferences();
  const enCours = useRef(false);
  const racine = useRef<HTMLDivElement>(null);
  const cadre = useRef<HTMLDivElement>(null);
  const largeurMax = useGobanEntier(racine, cadre);

  useEffect(() => {
    if (copie) oublierCopieEtude();
    track(EVENTS.etudeOuverte, { taille: etude.size, reprise: !!reprise, copie: !!copie });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { writeLocal(ETUDE_KEY, etudeAGarder(etude)); }, [etude]);

  const positions = useMemo(() => positionsEtude(etude), [etude]);
  const pos = positions[positions.length - 1];
  const reglages = reglagesAnalyse(etude);
  const cle = `${etude.size}|${pos.toPlay}|${reglages.komi}|${reglages.regles}|${boardKey(pos.board)}`;
  const resultat = analyse?.etat === 'pret' && analyse.cle === cle ? analyse : null;
  const numeros = useMemo(() => (etude.curseur ? numerosDesCoups(positions, positions.length - 1) : null), [positions, etude.curseur]);
  const variantes = useMemo(() => variantesIci(etude), [etude]);
  const enVariante = debutVariante(etude) >= 0;
  const note = noteIci(etude);
  const navigable = etude.ligne.length > 0;

  function changer(suivante: EtatEtude) {
    setHistoire(h => [...h, etude].slice(-MAX_HISTOIRE));
    setEtude(suivante);
    setRefus(null);
    setExport(false);
    setAnnonce(null);
  }
  function refuser(texte: string, p: number) { setRefus(r => ({ texte, p, n: (r?.n ?? 0) + 1 })); }
  /** Se déplacer dans l'arbre : rien n'est modifié, « Annuler » ne s'en souvient pas. */
  function naviguer(suivante: EtatEtude) {
    if (suivante === etude) return;
    setEtude(suivante);
    setRefus(null);
    setAnnonce(null);
  }
  function gerer(action: 'supprimer' | 'promouvoir' | 'ligne_principale') {
    if (action === 'ligne_principale') naviguer(lignePrincipale(etude));
    else {
      changer(action === 'supprimer' ? supprimerVariante(etude) : promouvoirVariante(etude));
      setAnnonce(tk(action === 'supprimer' ? 'etude.variante.supprimee' : 'etude.variante.promue'));
    }
    track(EVENTS.etudeVarianteGeree, { action });
  }

  // ← → au clavier : coup précédent, coup suivant. Pas quand le goban (qui se joue aux flèches, #116), un champ ou la
  // feuille de partage a la main.
  useEffect(() => {
    const touche = (ev: KeyboardEvent) => {
      if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey || (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight')) return;
      const cible = ev.target instanceof Element ? ev.target : null;
      if (cible?.closest('.etude-plateau, input, textarea, select, dialog')) return;
      ev.preventDefault();
      naviguer(ev.key === 'ArrowLeft' ? precedent(etude) : suivant(etude));
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  });

  function toucher(p: number) {
    if (outil === 'jouer') {
      const cree = creeraitVariante(etude, p);
      const r = jouerVariante(etude, p);
      if (typeof r === 'string') { refuser(tk(r === 'ko' ? 'etude.refus.ko' : r === 'suicide' ? 'etude.refus.suicide' : 'etude.refus.occupe'), p); return; }
      // Le coup existait déjà dans l'arbre : on le suit, sans rien modifier.
      if (r.suites === etude.suites) { naviguer(r); return; }
      changer(r);
      if (cree) {
        // « Variante » expliquée à la première variante de l'étude, puis « Variante créée. » seulement.
        const nb = tailleArbre(r).variantes;
        setAnnonce(tk(nb === 1 ? 'etude.variante.explication' : 'etude.variante.creee'));
        track(EVENTS.etudeVarianteCreee, { taille: etude.size, coup: r.curseur, variantes: nb });
      }
      return;
    }
    const r = poser(etude, p, outil);
    if (r === 'sansLiberte') { refuser(tk('etude.refus.sansLiberte'), p); return; }
    if (r !== etude) changer(r);
  }

  function annuler() {
    const h = histoire.at(-1);
    if (!h) return;
    setHistoire(histoire.slice(0, -1));
    setEtude(h);
    setRefus(null);
    setAnnonce(null);
  }

  async function analyser() {
    if (enCours.current) return; // un appel par geste : jamais deux recherches en même temps
    enCours.current = true;
    approfondie();
    const pour = { cle, pos, pierres: pierresPosees(etude), variante: etude.curseur, reglages };
    setAnalyse({ etat: 'attente' });
    try {
      const a = await analyseEtude(pour.pos, pour.reglages.komi, undefined, pour.reglages.regles);
      if (!a.katago) {
        setAnalyse({ etat: 'sans-katago', raison: null, telechargement: false });
        track(EVENTS.analyseDemandee, { taille: etude.size, pierres: pour.pierres, variante: pour.variante, katago: false, issue: 'sans_katago' });
        return;
      }
      // Le filtre de la revue : jamais un coup illégal ni un coup de première ligne sans raison.
      const coups = a.coups.filter(c => conseilFiable(pour.pos, c.move, Infinity)).slice(0, CANDIDATS);
      setAnalyse({ etat: 'pret', cle: pour.cle, lead: a.lead, coups, passe: a.coups[0]?.move === -1, ap: a.approfondie ? 'utilisee' : raisonRepliApprofondi() });
      track(EVENTS.analyseDemandee, { taille: etude.size, pierres: pour.pierres, variante: pour.variante, katago: true, issue: 'ok' });
    } catch {
      setAnalyse({ etat: 'erreur' });
      track(EVENTS.analyseDemandee, { taille: etude.size, pierres: pour.pierres, variante: pour.variante, katago: true, issue: 'erreur' });
    } finally {
      enCours.current = false;
    }
  }

  async function telecharger() {
    setAnalyse({ etat: 'sans-katago', raison: null, telechargement: true });
    const r = await preparerKataGo();
    if (r.pret) { void analyser(); return; }
    setAnalyse({ etat: 'sans-katago', raison: r.raison, telechargement: false });
  }

  function exporter() {
    const sgf = etudeVersSgf(etude);
    try {
      const url = URL.createObjectURL(new Blob([sgf], { type: 'application/x-go-sgf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `etude-${new Date().toISOString().slice(0, 10)}.sgf`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { /* navigateur sans téléchargement : le SGF reste gardé sur l'appareil */ }
    setExport(true);
    const t = tailleArbre(etude);
    track(EVENTS.etudeExportee, { coups: t.coups, variantes: t.variantes, commentaires: t.notes > 0 });
  }

  const taille = (s: TailleEtude) => {
    if (s === etude.size) return;
    changer({ ...etudeVide(s), komi: etude.komi, regles: etude.regles });
  };
  const trait = (c: Color) => { if (c !== etude.trait) changer(avecDepart(etude, { trait: c })); };
  function reglerEtude(r: { komi?: number; regles?: Rules }) {
    const suivante = regler(etude, r);
    if (suivante === etude) return;
    changer(suivante);
    track(EVENTS.reglageChange, r.regles ? { cle: 'etude_regle', valeur: r.regles } : { cle: 'etude_komi', valeur: String(suivante.komi) });
  }

  const n = etude.ligne.length;
  const consigne = annonce ?? (!etude.suites.length ? tk(outil === 'jouer' ? 'etude.consigne.jouer' : 'etude.consigne.poser')
    : etude.curseur === 0 ? tk('etude.consigne.depart')
    : tk(enVariante ? 'etude.consigne.coupVariante' : 'etude.consigne.coup', { i: etude.curseur, n }));
  const vide = !pierresPosees(etude) && !etude.suites.length;
  const camp = (c: Color) => tk(c === 1 ? 'etude.trait.noir' : 'etude.trait.blanc');
  const vb = viewBoxOf(etude.size);

  return (
    <div className="etude" data-testid="etude" ref={racine}>
      <div className="etude-ligne">
        <div className="etude-seg" role="group" aria-label={tk('etude.taille')}>
          {TAILLES_ETUDE.map(s => <button type="button" key={s} aria-pressed={etude.size === s} onClick={() => taille(s)} aria-label={`${s} × ${s}`}>{s}</button>)}
        </div>
        {/* Annuler et Revenir en haut, à côté de la taille : visibles sans défiler en 390 × 844, au-dessus du goban. */}
        <div className="etude-actions">
          <button type="button" className="btn" onClick={annuler} disabled={!histoire.length}>{tk('etude.annuler')}</button>
          {etude.curseur > 0 && <button type="button" className="btn" onClick={() => naviguer(allerA(etude, 0))}>{tk('etude.revenir')}</button>}
        </div>
      </div>
      <div className="etude-outils etude-seg" role="group" aria-label={tk('etude.outils')}>
        {OUTILS.map(o => (
          <button type="button" key={o} aria-pressed={outil === o} onClick={() => setOutil(o)} data-outil={o}>
            {o === 'noir' && <span className="stone b" aria-hidden="true" />}
            {o === 'blanc' && <span className="stone w" aria-hidden="true" />}
            {tk(`etude.outil.${o}`)}
          </button>
        ))}
      </div>
      <div className="etude-ligne">
        <div className="etude-trait" role="group" aria-label={tk('etude.trait')} aria-describedby="etude-trait-aide">
          <span className="etude-trait-libelle" aria-hidden="true">{tk('etude.trait')}</span>
          <div className="etude-seg">
            {([1, 2] as const).map(c => (
              <button type="button" key={c} aria-pressed={etude.trait === c} onClick={() => trait(c)}>
                <span className={`stone ${c === 1 ? 'b' : 'w'}`} aria-hidden="true" />{camp(c)}
              </button>
            ))}
          </div>
          <span id="etude-trait-aide" className="sr-only">{tk('etude.traitAide')}</span>
        </div>
      </div>
      {/* Un refus (ko, sans liberté) remplace la consigne, au même endroit : lu tout de suite, sans décaler le goban. */}
      <p className={refus ? 'etude-refus small' : 'muted small'} role="status" data-testid="etude-consigne">{fr(refus ? refus.texte : consigne)}</p>
      {variantes.length > 0 && (
        <div className="etude-variantes" role="group" aria-label={tk('etude.variantes', { i: etude.curseur })} data-testid="etude-variantes">
          <span className="etude-variantes-libelle" aria-hidden="true">{tk('etude.variantes', { i: etude.curseur })}</span>
          {variantes.map(v => (
            <button type="button" key={v.i} className="etude-puce" aria-pressed={v.choisie} onClick={() => naviguer(choisirVariante(etude, v.i))}>
              <span className={`stone ${v.c === 1 ? 'b' : 'w'}`} aria-hidden="true" />
              {v.i === 0 ? tk('etude.puce.principale', { point: toLabel(v.p, etude.size) }) : toLabel(v.p, etude.size)}
            </button>
          ))}
        </div>
      )}

      <div className="etude-plateau" ref={cadre} style={largeurMax ? { width: `min(100%, ${largeurMax}px)` } : undefined}>
        <Board size={etude.size} board={pos.board} toPlay={outil === 'jouer' ? pos.toPlay : outil === 'blanc' ? 2 : 1}
          interactive stonesTappable={outil !== 'jouer'} confirmTouch={outil === 'jouer' && confirmTouch} onPlay={toucher}
          shake={refus ? { p: refus.p, n: refus.n } : null} coordonnees={prefs.coordonnees} numeros={numeros}
          marks={{ last: prefs.dernierCoup ? pos.lastMove : null }} />
        {resultat && resultat.coups.length > 0 && (
          <svg className="etude-calque" viewBox={`${vb.min} ${vb.min} ${vb.span} ${vb.span}`} aria-hidden="true" data-testid="etude-candidats">
            {resultat.coups.map((c, i) => {
              const x = M + (c.move % etude.size) * C, y = M + Math.floor(c.move / etude.size) * C;
              return (
                <g key={c.move} className="etude-candidat" data-candidat={toLabel(c.move, etude.size)} style={{ animationDelay: `${i * 40}ms` }}>
                  <circle cx={x} cy={y} r={C * 0.46} />
                  <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={C * 0.34}>{texteCandidat(c)}</text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {enVariante && (
        <div className="etude-gestion" data-testid="etude-gestion">
          <button type="button" className="btn" onClick={() => gerer('ligne_principale')}>{tk('etude.lignePrincipale')}</button>
          <button type="button" className="btn" onClick={() => gerer('promouvoir')}>{tk('etude.promouvoir')}</button>
          <button type="button" className="btn etude-supprimer" onClick={() => gerer('supprimer')}>{tk('etude.supprimerVariante')}</button>
        </div>
      )}
      {note && (
        <div className="etude-note" data-testid="etude-note">
          <p className="etude-note-libelle">{tk('etude.note')}</p>
          <p>{note}</p>
        </div>
      )}

      <Resultat analyse={analyse} resultat={resultat} camp={camp(pos.toPlay)} taille={etude.size} onTelecharger={telecharger}
        reglages={tk('etude.resultat.reglages', { komi: nombreClub(etude.komi), regle: tk(`etude.regle.${etude.regles}`) })} />

      <ReglagesEtude komi={etude.komi} regles={etude.regles} handicap={handicapEtude(etude)} onRegler={reglerEtude} />

      <div className="etude-secondaires">
        <button type="button" className="lien" onClick={() => setPartage(true)} disabled={vide} data-testid="etude-partager">{tk('etude.partager')}</button>
        <button type="button" className="lien" onClick={exporter}>{tk('etude.exporter')}</button>
        <button type="button" className="lien" onClick={() => changer(etudeVide(etude.size))} disabled={vide}>{tk('etude.vider')}</button>
      </div>
      {partage && (
        <Suspense fallback={null}>
          <FeuillePartage sgf={etudeVersSgf(etude)} joueur={null} coup={prolonger(etude.suites, []).length} mode="etude" onFermer={() => setPartage(false)} />
        </Suspense>
      )}
      <p className="muted small" role="status">{export_ ? tk('etude.exporte') : ''}</p>

      {/* Une seule action principale, « Analyser » ; les flèches de l'arbre l'encadrent, en secondaire (#562). */}
      <div className={`dock etude-dock${navigable ? ' etude-dock-nav' : ''}`}>
        {navigable && (
          <button type="button" className="btn etude-nav etude-nav-prec" aria-label={tk('etude.precedent')} title={tk('etude.precedent')}
            onClick={() => naviguer(precedent(etude))} disabled={etude.curseur === 0} data-testid="etude-precedent">
            <Chevron sens={-1} />
          </button>
        )}
        <button type="button" className="cta" onClick={() => { void analyser(); }} disabled={analyse?.etat === 'attente' || (analyse?.etat === 'sans-katago' && analyse.telechargement)}>
          {analyse?.etat === 'attente' ? tk('etude.analyse') : tk('etude.analyser')}
        </button>
        {navigable && (
          <button type="button" className="btn etude-nav etude-nav-suiv" aria-label={tk('etude.suivant')} title={tk('etude.suivant')}
            onClick={() => naviguer(suivant(etude))} disabled={etude.curseur >= n} data-testid="etude-suivant">
            <Chevron sens={1} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Goban toujours entier au-dessus de l'action principale (« Analyser », fixe en bas), sans défiler : sa largeur est
 * bornée par la place entre son bord haut et le haut du bouton. Les lignes d'outils peuvent passer sur deux rangées
 * (police de repli, zoom, anglais, « Revenir » qui apparaît) : le goban rétrécit d'autant, rien ne passe dessous.
 * Recalculé quand la page change de taille ou qu'une ligne au-dessus change de hauteur.
 */
function useGobanEntier(racine: RefObject<HTMLDivElement | null>, cadre: RefObject<HTMLDivElement | null>): number | null {
  const [max, setMax] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = racine.current, plateau = cadre.current;
    if (!el || !plateau) return;
    const mesurer = () => {
      // Le haut du dock (« Analyser » et ses flèches, sur deux rangées en très petit écran).
      const cta = el.querySelector<HTMLElement>('.etude-dock');
      if (!cta) return;
      // Positions de la page tout en haut : le bouton est fixe, le goban suit le défilement.
      const haut = plateau.getBoundingClientRect().top + window.scrollY;
      const place = Math.floor(cta.getBoundingClientRect().top - haut - 4);
      setMax(m => (place > 160 && place !== m ? place : m));
    };
    mesurer();
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mesurer) : null;
    for (const enfant of Array.from(el.children)) if (enfant !== plateau && !enfant.classList.contains('etude-dock')) obs?.observe(enfant);
    window.addEventListener('resize', mesurer);
    void document.fonts?.ready.then(mesurer);
    return () => { obs?.disconnect(); window.removeEventListener('resize', mesurer); };
  }, [racine, cadre]);
  return max;
}

/** « 62 » (chances de gain en %), ou l'avance « +3 » si KataGo ne les donne pas. */
function texteCandidat(c: { winrate: number | null; lead: number }): string {
  if (c.winrate != null) return String(Math.round(c.winrate * 100));
  const v = Math.round(c.lead);
  return v > 0 ? `+${v}` : String(v);
}

function Resultat({ analyse, resultat, camp, taille, onTelecharger, reglages }: {
  analyse: Analyse | null; resultat: Extract<Analyse, { etat: 'pret' }> | null; camp: string; taille: number; onTelecharger: () => void;
  /** « Komi 6,5, règle japonaise. » : ce que KataGo a compté. */
  reglages: string;
}) {
  // #475 : « 2,1 / 3,8 Mo » sur le bouton pendant le téléchargement.
  const progression = useProgressionKataGo(analyse?.etat === 'sans-katago' && analyse.telechargement);
  if (!analyse || analyse.etat === 'attente') return null;
  if (analyse.etat === 'sans-katago') {
    return (
      <div className="etude-sans-katago" role="status" data-testid="etude-sans-katago">
        <p>{fr(tk(analyse.raison ? `etude.sansKataGo.${analyse.raison}` : 'etude.sansKataGo'))}</p>
        {analyse.raison !== 'appareil' && (
          <button type="button" className="btn" onClick={onTelecharger} disabled={analyse.telechargement}>
            {analyse.telechargement ? (progression ? tk('etude.telechargementProgression', { ...progression }) : tk('etude.telechargement')) : tk('etude.telecharger')}
          </button>
        )}
      </div>
    );
  }
  if (analyse.etat === 'erreur') return <p className="etude-refus small" role="alert">{fr(tk('etude.sansKataGo.delai'))}</p>;
  // Résultat d'une autre position (la position a changé depuis) : rien, l'action principale relance.
  if (!resultat) return null;
  const v = Math.abs(resultat.lead);
  const mene = v < 0.5 ? tk('etude.resultat.egal') : tk('etude.resultat.mene', { camp: tk(resultat.lead > 0 ? 'etude.trait.noir' : 'etude.trait.blanc'), v: nombreClub(v) });
  return (
    <div className="etude-resultat" role="status" data-testid="etude-resultat">
      <p><b>{fr(mene)}</b> <span className="small muted">{fr(reglages)}</span></p>
      {resultat.coups.length ? (
        <>
          <p className="small">{fr(tk('etude.resultat.coups', { camp }))}</p>
          <ol>
            {resultat.coups.map(c => (
              <li key={c.move}>{c.winrate != null
                ? fr(tk('etude.candidat', { point: toLabel(c.move, taille), p: Math.round(c.winrate * 100) }))
                : `${toLabel(c.move, taille)} : ${texteCandidat(c)}`}</li>
            ))}
          </ol>
        </>
      ) : <p className="small">{fr(tk(resultat.passe ? 'etude.resultat.passe' : 'etude.resultat.aucun'))}</p>}
      {resultat.ap && <p className="small muted" data-testid="etude-approfondie" data-etat={resultat.ap}>{thl(resultat.ap === 'utilisee' ? 'ap.noteUtilisee' : resultat.ap === 'trop-lent' ? 'ap.noteTropLent' : 'ap.noteRepli')}</p>}
    </div>
  );
}

/** Flèche ‹ ou ›, dessinée (pas un caractère : même rendu avec la police de repli). */
function Chevron({ sens }: { sens: 1 | -1 }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d={sens > 0 ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * « Komi 6,5 · règle japonaise » (#562) : action secondaire, repliée. Komi d'un toucher (0,5, 5,5, 6,5, 7,5) ou au
 * demi-point avec − et + ; règle japonaise ou chinoise, chacune dite en une phrase. Komi et règle expliqués ici.
 */
function ReglagesEtude({ komi, regles, handicap, onRegler }: {
  komi: number; regles: Rules; handicap: number; onRegler: (r: { komi?: number; regles?: Rules }) => void;
}) {
  const id = useId();
  const regle = (r: Rules) => tk(`etude.regle.${r}` as CleClub);
  return (
    <details className="etude-reglages" data-testid="etude-reglages">
      <summary>{tk('etude.reglages', { komi: nombreClub(komi), regle: regle(regles) })}</summary>
      <div className="etude-reglages-corps">
        <p className="etude-reglages-titre" id={`${id}-komi`}>{tk('etude.komiTitre')}</p>
        <div className="etude-komi">
          <div className="etude-seg" role="group" aria-labelledby={`${id}-komi`}>
            {KOMIS_ETUDE.map(k => <button type="button" key={k} aria-pressed={komi === k} onClick={() => onRegler({ komi: k })}>{nombreClub(k)}</button>)}
          </div>
          <div className="etude-seg etude-komi-libre">
            <button type="button" aria-label={tk('etude.komiMoins')} onClick={() => onRegler({ komi: komi - 0.5 })} disabled={komi <= -KOMI_MAX}>−</button>
            <output aria-live="polite" aria-labelledby={`${id}-komi`}>{nombreClub(komi)}</output>
            <button type="button" aria-label={tk('etude.komiPlus')} onClick={() => onRegler({ komi: komi + 0.5 })} disabled={komi >= KOMI_MAX}>+</button>
          </div>
        </div>
        <p className="small muted">{fr(tk('etude.komiAide'))}</p>
        <p className="etude-reglages-titre" id={`${id}-regle`}>{tk('etude.regleTitre')}</p>
        <div className="etude-seg" role="group" aria-labelledby={`${id}-regle`}>
          {(['japanese', 'chinese'] as const).map(r => (
            <button type="button" key={r} aria-pressed={regles === r} onClick={() => onRegler({ regles: r })}>{tk(`etude.regleBouton.${r}`)}</button>
          ))}
        </div>
        <p className="small muted">{fr(tk(`etude.regleAide.${regles}`))}</p>
        {handicap >= 2 && <p className="small muted">{fr(tk('etude.handicapAide', { n: handicap }))}</p>}
      </div>
    </details>
  );
}

export default Etude;
