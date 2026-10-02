// Écran de revue d'une partie terminée (issue #34, charte point 3 : « chaque erreur devient une leçon »).
// Goban en lecture avec navigation coup par coup, courbe d'avantage (Noir en bas, Blanc en haut),
// les 3 plus grosses erreurs du joueur avec une phrase de Mochi et le meilleur coup en pierre fantôme jade,
// puis une seule action en relief : « Rejouer d'ici ». Logique pure : revue.ts.
// Issue #77 : « Rejoue cette erreur » sur une Erreur ou Grosse erreur du joueur (avec un conseil fiable de KataGo) :
// la position d'avant revient, tout coup qui perd moins de 1 point est accepté (données de la revue, pas de nouvelle
// analyse). Ratée au premier essai, elle rejoint « Tes erreurs à rejouer » (J+1, J+3, J+7 ; logique : erreurs.ts).
// Suite (#77) : sur une Erreur ou Grosse erreur rejouable, le bon coup reste caché jusqu'à un essai
// ou jusqu'à « Voir le bon coup » : « Rejoue cette erreur » devient l'action principale.
// Issue #71 : une note pour chaque coup (sceau sur la pierre, liste des coups, points sur la courbe),
// et un bilan de précision pour les deux joueurs, avec la phrase de Mochi.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Board } from '../ui/Board';
import { Mochi } from '../ui/Mochi';
import { Reflexion } from '../ui/Reflexion';
import { Icone } from '../ui/Partie';
import { SceauNote } from '../ui/SceauNote';
import { NOTE_ENCRE } from '../ui/notes';
import { fr } from '../ui/typo';
import { t as tr } from '../content/i18n';
import { mouvementsReduits } from '../ui/defilement';
import { toLabel } from '../go/coords';
import { play, type Color, type Position } from '../go/rules';
import { analyseRevue, meilleurCoup, preparerKataGo } from '../engine';
import { EVENTS, track } from '../data/analytics';
import {
  avanceFinale, candidatsBrillant, compteNotes, conseilFiable, courbe, courbeY, defaiteNette, momentCle, NOTE_INFO, noterCoups, notesAvecCle,
  phraseBilan, phraseErreur, phraseMomentCle, phraseNote, precisionHonnete, positionsDepuisSgf, rejouerDici,
  type AnalyseRevue, type Erreur, type Note, type NoteCoup,
} from './revue';
import { readLocal, writeLocal } from './hooks';
import { coupAccepte, creerErreur, ERREURS_KEY, garderRatee, lireErreurs, peutEnFaireUnProbleme, type ErreurGardee } from './erreurs';
import '../ui/revue.css';

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
}

/** « Rejoue cette erreur » en cours : le problème, le nombre d'essais, le dernier coup faux, la réussite. */
interface Rejeu { pb: ErreurGardee; avant: Position; essais: number; faux: number | null; n: number; apres: Position | null }

const L = 300, H = 64; // courbe : repère du viewBox
/** Lignes du tableau du bilan, du meilleur au pire (Solide seulement sans KataGo, Brillant seulement s'il y en a). */
const LIGNES: Note[] = ['brillant', 'meilleur', 'excellent', 'bon', 'solide', 'imprecision', 'erreur', 'grosse'];

export function Revue({ sgf, joueur, adversaire, onRetour, onRejouer, confirmTouch = false, visites, retour, onImporter, source }: Props) {
  const { positions, komi, resultat } = useMemo(() => positionsDepuisSgf(sgf), [sgf]);
  const n = positions.length - 1, size = positions[0].size;
  const [i, setI] = useState(Math.min(1, n));
  const [analyses, setAnalyses] = useState<(AnalyseRevue | null)[]>([]);
  const [confirmations, setConfirmations] = useState<Record<number, number>>({});
  // Meilleur coup par erreur, seulement s'il est fiable (conseilFiable) ; `null` : rien à montrer.
  const [meilleurs, setMeilleurs] = useState<Record<number, number | null>>({});
  const [sansKataGo, setSansKataGo] = useState(false);
  const [choisie, setChoisie] = useState<Erreur | null>(null);
  const [resume, setResume] = useState(false);
  // « Rejoue cette erreur » (issue #77) : `null` hors rejeu.
  const [rejeu, setRejeu] = useState<Rejeu | null>(null);
  // Erreurs dont le bon coup est dévoilé (après un essai ou « Voir le bon coup »), par numéro de coup.
  const [devoilees, setDevoilees] = useState<ReadonlySet<number>>(() => new Set());
  const liste = useRef<HTMLOListElement>(null);
  // Issue #186 : la revue s'ouvre sur le moment clé dès qu'il est connu, sauf si le joueur a déjà navigué.
  const [enCle, setEnCle] = useState(false);
  const navigue = useRef(false);
  // Analyse arrêtée par le joueur (#286) : les positions restantes n'ont pas d'estimation.
  const arretee = useRef(false);
  const [arret, setArret] = useState(false);
  const mode = visites ? 'import' : adversaire ? 'ordi' : 'deux';
  const analysees = analyses.length;
  const finie = analysees > n;
  const avances = useMemo(() => analyses.map(a => a?.lead ?? null), [analyses]);
  // Moment clé (passes comprises) et avance finale de Noir : la précision et le bilan ne contredisent jamais le score.
  const cle = useMemo(() => (finie ? momentCle(positions, analyses, joueur) : null), [finie, positions, analyses, joueur]);
  // La note du coup clé compte aussi la réponse, comme Mochi : plus de « Solide » ni de 100 % sur un coup qui a coûté des points.
  const notes = useMemo(() => (finie ? notesAvecCle(noterCoups(positions, analyses, confirmations), cle, analyses) : []), [finie, positions, analyses, confirmations, cle]);
  // Les 3 plus grosses erreurs du joueur, tirées des notes (le bruit du moteur y est déjà écarté).
  const erreurs = useMemo<Erreur[]>(() => notes
    .filter((x): x is NoteCoup => !!x && (!joueur || x.couleur === joueur) && (x.note === 'imprecision' || x.note === 'erreur' || x.note === 'grosse'))
    .sort((a, b) => b.perte - a.perte || a.coup - b.coup).slice(0, 3).map(x => ({ coup: x.coup, perte: x.perte })), [notes, joueur]);
  const avanceNoir = finie ? avanceFinale(resultat, analyses[n]?.lead) : null;

  useEffect(() => {
    if (!cle || navigue.current) return;
    navigue.current = true;
    setI(cle.coup); setChoisie(null); setEnCle(true); setResume(false);
  }, [cle]);

  useEffect(() => { track(EVENTS.revueOuverte, { coups: n, taille: size, mode, ...(source ? { source } : {}) }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Analyse dans le Worker du moteur, une position après l'autre. Le moteur est choisi une fois pour toutes
  // (KataGo s'il est prêt ou en cache, sinon le moteur simple) : deux moteurs ne se comparent pas.
  useEffect(() => {
    let vivant = true;
    (async () => {
      const kataGo = await preparerKataGo();
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
    })();
    return () => { vivant = false; };
  }, [positions, komi, visites]);

  /** « Arrêter l'analyse » (#286) : la revue se contente des positions déjà analysées. */
  function arreter() {
    arretee.current = true;
    setArret(true);
    setAnalyses(a => [...a, ...Array<AnalyseRevue | null>(Math.max(0, n + 1 - a.length)).fill(null)]);
  }

  // Meilleur coup, seulement là où tu t'es trompé, et seulement avec KataGo : sans lui, aucun conseil (jamais de conseil faux).
  useEffect(() => {
    if (!erreurs.length) return;
    let vivant = true;
    (async () => {
      for (const e of erreurs) {
        const avant = positions[e.coup - 1], c = avant.toPlay, apres = avances[e.coup];
        let m: number | null = null;
        try {
          const r = await meilleurCoup(avant, komi);
          if (!vivant) return;
          if (!r.katago) { setSansKataGo(true); return; }
          // Gain du coup conseillé sur le coup joué, pour le joueur qui s'est trompé.
          const gain = apres == null ? 0 : r.lead - (c === 1 ? apres : -apres);
          m = conseilFiable(avant, r.move, gain) ? r.move : null;
        } catch { m = null; }
        if (!vivant) return;
        setMeilleurs(o => ({ ...o, [e.coup]: m }));
      }
    })();
    return () => { vivant = false; };
  }, [erreurs, positions, komi]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clavier : flèches gauche et droite.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') aller(i - 1);
      else if (e.key === 'ArrowRight') aller(i + 1);
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  });

  // La liste des coups suit le coup affiché.
  useEffect(() => {
    const b = liste.current?.querySelector<HTMLElement>('[aria-current="true"]');
    b?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: mouvementsReduits() ? 'auto' : 'smooth' });
  }, [i]);

  function aller(k: number) { navigue.current = true; setI(Math.max(0, Math.min(n, k))); setChoisie(null); setEnCle(false); }
  function voir(e: Erreur) { navigue.current = true; setI(e.coup - 1); setChoisie(e); setResume(false); setEnCle(false); }
  function voirCle() { if (!cle) return; navigue.current = true; setI(cle.coup); setChoisie(null); setResume(false); setEnCle(true); }
  function rejouer() {
    // Au moment clé, le goban montre le coup fautif ; on rejoue depuis la position juste avant lui.
    const surCle = enCle && !!cle && i === cle.coup;
    const h = rejouerDici(positions, surCle ? cle.coup : i + 1, joueur ?? null);
    track(EVENTS.revueRejouer, { coup: h.length - 1, cle: surCle, perte: surCle ? Math.round(cle.perte) : null, taille: size, mode });
    onRejouer?.(h);
  }
  /**
   * « Rejoue cette erreur » : la position avant l'erreur, avec le meilleur coup de KataGo et les coups qui perdent
   * moins de 1 point, tirés de l'analyse déjà faite pour la revue.
   */
  function rejouerErreur(e: Erreur) {
    const avant = positions[e.coup - 1];
    const pb = creerErreur({
      avant, joue: positions[e.coup].lastMove ?? -1, coup: e.coup, note: notes[e.coup - 1]?.note,
      meilleur: meilleurs[e.coup], perte: e.perte, analyse: analyses[e.coup - 1], adversaire,
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
      track(EVENTS.erreurRejouee, { reussi: !!apres, source: 'revue', taille: size, coup: pb.coup, rates: 0, reponses: pb.reponses.length });
      // Ratée au premier essai : elle revient demain dans « Tes erreurs à rejouer ».
      if (!apres) writeLocal(ERREURS_KEY, garderRatee(lireErreurs(readLocal<unknown>(ERREURS_KEY, [])), pb, new Date()));
    }
    setRejeu({ ...rejeu, essais: rejeu.essais + 1, faux: apres ? null : p, n: rejeu.n + 1, apres });
  }
  function devoiler(coup: number) { setDevoilees(d => new Set(d).add(coup)); }
  function finirRejeu() {
    const coup = rejeu?.pb.coup;
    // Après un essai, réussi ou non, la revue montre le bon coup.
    if (coup != null && rejeu && rejeu.essais > 0) devoiler(coup);
    setRejeu(null);
    if (coup != null) setI(coup - 1);
  }

  const q = positions[i];
  const note = i > 0 ? notes[i - 1] ?? null : null;
  let phrase: string;
  const surCle = enCle && !!cle && i === cle.coup;
  // Erreur choisie, rejouable, pas encore dévoilée : on montre l'erreur, pas la réponse.
  const aTrouver = !surCle && !!choisie && !devoilees.has(choisie.coup) && peutEnFaireUnProbleme(notes[choisie.coup - 1]?.note, meilleurs[choisie.coup]);
  if (rejeu) {
    phrase = rejeu.apres
      ? `${tr(rejeu.pb.reponses.length > 1 ? 'erreurs.bravoParmi' : 'erreurs.bravoKataGo')}${rejeu.essais > 1 ? ` ${tr('revue.rejeu.revient')}` : ''}`
      : rejeu.faux != null ? tr('revue.rejeu.rate') : tr('revue.rejeu.consigne');
  } else if (surCle) phrase = phraseMomentCle(cle, positions, adversaire);
  else if (choisie && aTrouver) phrase = `${phraseErreur(choisie, positions, null)} ${tr('revue.aTrouver')}`;
  else if (choisie) phrase = phraseErreur(choisie, positions, meilleurs[choisie.coup] ?? null);
  else if (i === 0) phrase = tr('revue.debut');
  else {
    const avant = positions[i - 1], c = avant.toPlay, m = q.lastMove ?? -1, cap = q.captures[c] - avant.captures[c];
    const toi = !!adversaire && c === (joueur ?? 1), nom = adversaire ? (toi ? tr('camp.toi') : adversaire) : tr(c === 1 ? 'camp.noir' : 'camp.blanc');
    const point = toLabel(m, size);
    const geste = m < 0 ? (toi ? tr('revue.tuPasses') : tr('revue.passe', { nom })) : toi ? tr('revue.tuJoues', { point }) : tr('revue.joue', { nom, point });
    phrase = `${cap ? tr(toi ? 'revue.tuCaptures' : 'revue.capture', { geste, n: cap }) : geste}.${note ? ` ${phraseNote(note)}` : ''}`;
  }

  const { ligne, aire } = courbe(avances, L, H, size);
  const x = (k: number) => (n <= 0 ? L / 2 : (k * L) / n);
  const meilleur = choisie && !aTrouver ? meilleurs[choisie.coup] ?? undefined : undefined;
  const moi: Color = joueur ?? 1, lui = (3 - moi) as Color;
  const nomMoi = tr(adversaire ? 'camp.toi' : 'camp.noir'), nomLui = adversaire ?? tr('camp.blanc');
  const precMoi = finie ? precisionHonnete(notes, moi, avanceNoir, size) : null, precLui = finie ? precisionHonnete(notes, lui, avanceNoir, size) : null;
  const nette = defaiteNette(avanceNoir, moi, size);
  // Puces sous la courbe : le moment clé d'abord, puis les plus grosses erreurs notées (3 en tout).
  const autres = erreurs.filter(e => e.coup !== cle?.coup).slice(0, cle ? 2 : 3);
  const cMoi = compteNotes(notes, moi), cLui = compteNotes(notes, lui);
  // Avec KataGo : toutes les notes (Brillant seulement s'il y en a un). Sans lui : Solide et les pertes, rien d'autre.
  const avecKataGo = analyses.some(a => a?.engine === 'katago');
  const lignes = LIGNES.filter(l => (avecKataGo ? l !== 'solide' && (l !== 'brillant' || cMoi[l] + cLui[l] > 0) : l === 'solide' || l === 'imprecision' || l === 'erreur' || l === 'grosse'));
  // Au moment clé, pas de sceau : la note juge le coup seul, le moment clé compte aussi la réponse (pas de message contradictoire).
  // Erreur que « Rejoue cette erreur » reprend : la puce choisie, ou le moment clé affiché.
  const cible: Erreur | null = surCle && cle ? { coup: cle.coup, perte: cle.perte } : choisie;
  const peutRejouer = !!cible && peutEnFaireUnProbleme(notes[cible.coup - 1]?.note, meilleurs[cible.coup]);
  const marqueNote = !surCle && note && q.lastMove != null && q.lastMove >= 0
    ? { p: q.lastMove, ...NOTE_ENCRE[note.note], symbole: NOTE_INFO[note.note].symbole, libelle: NOTE_INFO[note.note].libelle, cle: i } : undefined;

  if (rejeu) {
    const pos = rejeu.apres ?? rejeu.avant;
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

  return (
    <div className="revue">
      <header className="revue-tete">
        <button type="button" className="retour" onClick={onRetour} aria-label={retour ?? tr('revue.retour')}>‹</button>
        <h2>{tr('fin.revoir')}</h2>
        <span className="revue-compteur">{tr('revue.compteur', { i, n })}</span>
      </header>

      {precMoi != null && (
        <button type="button" className="revue-precision" aria-expanded={resume} aria-controls="revue-resume" onClick={() => setResume(r => !r)}>
          <span className="revue-precision-texte">
            <span className="revue-precision-titre">{tr('revue.precision')}</span>
            <span className="revue-precision-duo">{fr(tr('revue.precisionJoueur', { nom: nomMoi, p: precMoi }))}{precLui != null && <span className="revue-precision-lui">{fr(`\u00A0· ${tr('revue.precisionJoueur', { nom: nomLui, p: precLui })}`)}</span>}</span>
          </span>
          <span className="revue-precision-voir">{tr(resume ? 'revue.fermer' : 'revue.resume')}</span>
        </button>
      )}

      {/* Résumé et coups se partagent la place, comme deux onglets : le résumé ne repousse jamais le goban. */}
      {resume && precMoi != null ? (
        <section id="revue-resume" className="revue-resume" aria-label={tr('revue.resumeAria')}>
          <table className="revue-table">
            <thead><tr><th scope="col"><span className="sr-only">{tr('revue.note')}</span></th><th scope="col">{nomMoi}</th><th scope="col">{nomLui}</th></tr></thead>
            <tbody>
              {lignes.map(l => (
                <tr key={l} data-ligne={l}>
                  <th scope="row"><span className="revue-table-note"><SceauNote note={l} taille={22} />{NOTE_INFO[l].libelle}</span></th>
                  <td>{cMoi[l] || '–'}</td><td>{cLui[l] || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="revue-mochi revue-mochi-bilan">
            <Mochi size={40} />
            <p>{fr(phraseBilan(notes, moi, adversaire, { avanceNoir, size, cle }))}</p>
          </div>
          {!avecKataGo && <p className="revue-note">{fr(tr('revue.sansKataGoNote'))}</p>}
        </section>
      ) : (
        <>
      <div className="revue-plateau">
        {/* Bon coup caché : la croix rouge montre où tu as joué, sur la position d'avant. */}
        <Board size={size} board={q.board} marks={{ last: q.lastMove, meilleur, note: marqueNote, mistake: aTrouver && choisie ? positions[choisie.coup].lastMove ?? undefined : undefined }} />
      </div>

      <div className="revue-nav">
        <button type="button" className="btn revue-pas" onClick={() => aller(i - 1)} disabled={i <= 0} aria-label={tr('revue.precedent')}><Icone nom="precedent" /></button>
        <ol ref={liste} className="revue-coups" aria-label={tr('revue.coups')}>
          {positions.slice(1).map((p, k) => {
            const c = k + 1, nt = notes[k], m = p.lastMove ?? -1;
            const lieu = m < 0 ? tr('coup.passe') : toLabel(m, size);
            const etiquette = `${tr('revue.etiquette', { c, lieu })}${nt ? `, ${NOTE_INFO[nt.note].libelle}` : ''}`;
            return (
              <li key={c}>
                <button type="button" className="revue-coup" aria-current={c === i ? 'true' : undefined} aria-label={etiquette} onClick={() => aller(c)}>
                  <span className="revue-coup-num">{c}</span>
                  <span className={`revue-coup-pierre ${positions[k].toPlay === 1 ? 'noire' : 'blanche'}`} aria-hidden="true" />
                  <span className="revue-coup-lieu">{lieu}</span>
                  {nt ? <SceauNote note={nt.note} taille={18} /> : <span className="revue-coup-vide" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" className="btn revue-pas" onClick={() => aller(i + 1)} disabled={i >= n} aria-label={tr('revue.suivant')}><Icone nom="suivant" /></button>
      </div>

      {(onRejouer || (aTrouver && choisie)) && (
        <div className="dock revue-dock">
          {aTrouver && choisie
            ? <button type="button" className="cta" onClick={() => rejouerErreur(choisie)}>{tr('revue.rejoueErreur')}</button>
            : <button type="button" className="cta" onClick={rejouer}>{tr('revue.rejouer')}</button>}
        </div>
      )}
      <div className="revue-mochi" aria-live="polite">
        <Mochi size={40} />
        <p>{fr(phrase)}</p>
      </div>
      {surCle && i > 0 && <button type="button" className="btn revue-debut" onClick={() => aller(0)}>{tr('revue.revenirDebut')}</button>}
      {aTrouver && choisie && (
        <button type="button" className="lien revue-voir" onClick={() => devoiler(choisie.coup)}>{tr('revue.voirBonCoup')}</button>
      )}
      {!aTrouver && cible && peutRejouer && (
        <button type="button" className="btn revue-probleme" onClick={() => rejouerErreur(cible)}>{tr('revue.rejoueErreur')}</button>
      )}
      {sansKataGo && erreurs.length > 0 && <p className="revue-note">{fr(tr('revue.sansKataGo'))}</p>}

      <figure className="revue-courbe">
        <svg viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" role="img" aria-label={tr('revue.courbe')}
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); aller(Math.round(((e.clientX - r.left) / r.width) * n)); }}>
          <rect className="revue-courbe-blanc" x="0" y="0" width={L} height={H} />
          {aire && <path className="revue-courbe-noir" d={aire} />}
          <line className="revue-courbe-milieu" x1="0" x2={L} y1={H / 2} y2={H / 2} />
          {ligne && <path className="revue-courbe-ligne" d={ligne} vectorEffect="non-scaling-stroke" />}
          <line className="revue-courbe-curseur" x1={x(i)} x2={x(i)} y1="0" y2={H} vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Points des erreurs, en HTML : ronds même quand la courbe s'étire. */}
        {notes.map(nt => nt && (nt.note === 'erreur' || nt.note === 'grosse') && avances[nt.coup] != null ? (
          <span key={nt.coup} className="revue-courbe-point" data-note={nt.note} aria-hidden="true"
            style={{ left: `${(x(nt.coup) / L) * 100}%`, top: `${(courbeY(avances[nt.coup]!, H, size) / H) * 100}%`, background: NOTE_ENCRE[nt.note].fond }} />
        ) : null)}
      </figure>

      {!finie ? (
        <div className="revue-avance">
          <p className="revue-analyse"><Reflexion taille={22} />{fr(tr('revue.analyse', { fait: Math.min(analysees, n + 1), total: n + 1 }))}</p>
          {visites != null && <>
            <progress className="revue-barre" max={n + 1} value={Math.min(analysees, n + 1)} aria-label={tr('import.progression')} />
            <button type="button" className="btn revue-arret" onClick={arreter}>{tr('import.arreter')}</button>
          </>}
        </div>
      ) : !erreurs.length && !cle ? (
        <p className={`revue-aucune${nette ? ' revue-diffuses' : ''}`}>{fr(tr(nette ? 'revue.pertesDiffuses' : 'revue.aucuneErreur'))}</p>
      ) : (
        <div className="revue-erreurs" role="group" aria-label={fr(cle ? tr('revue.erreursCle') : tr('revue.erreurs', { n: erreurs.length }))}>
          {cle && (
            <button type="button" className={`revue-erreur revue-erreur-cle${surCle ? ' actif' : ''}`} aria-pressed={surCle} aria-label={fr(tr('revue.cleAria', { coup: cle.coup, n: Math.max(1, Math.round(cle.perte)) }))} onClick={voirCle}>
              <b>{tr('revue.cle')}</b><span>{fr(tr('revue.perte', { n: Math.max(1, Math.round(cle.perte)) }))}</span>
            </button>
          )}
          {autres.map(e => (
            <button type="button" key={e.coup} className={`revue-erreur${choisie?.coup === e.coup ? ' actif' : ''}`} aria-pressed={choisie?.coup === e.coup} onClick={() => voir(e)}>
              <b>{tr('revue.coup', { coup: e.coup })}</b><span>{fr(tr('revue.perte', { n: Math.max(1, Math.round(e.perte)) }))}</span>
            </button>
          ))}
        </div>
      )}
        </>
      )}
      {arret && <p className="revue-note revue-arretee">{fr(tr('import.arretee'))}</p>}
      {onImporter && !resume && (
        <button type="button" className="lien revue-importer" onClick={onImporter}>{tr('import.autre')}</button>
      )}
    </div>
  );
}
