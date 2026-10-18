// Partie de découverte (#524) : une vraie partie 9 × 9 contre Mochi, scénarisée, où chaque notion du go arrive au moment
// où elle se produit (src/content/decouverte.ts, prouvé par decouverte.test.ts).
//
// Même grammaire que le lecteur de leçon (Lecon.tsx) : la barre (quitter, notion en cours, « 3 / 15 notions »), le
// plateau, Mochi qui parle juste dessous, puis une seule action quand il en faut une (Continuer, Passer). Le plus
// souvent, l'action est sur le plateau : le point marqué d'un anneau de jade. Une erreur n'est jamais bloquante :
// Mochi dit pourquoi, le joueur rejoue.
//
// Composant autonome, chargé à la demande avec ses styles (src/app/ecrans.ts) : rien dans le chargement initial.
// `onFin` : la partie est finie (l'appelant propose la suite). `onQuitter` : le joueur sort avant la fin.
import { useEffect, useMemo, useRef, useState } from 'react';
import { SCENARIO, MORTES, TAILLE, estDebutDeNotion, points, positionAvant } from '../content/decouverte';
import type { CleDecouverte } from '../content/decouverte.fr';
import { Board, type BoardMarks } from '../ui/Board';
import { C, M, vueDe } from '../ui/boardArt';
import { PortraitMochi, type HumeurMochi } from '../ui/Portrait';
import { Marque, Retour } from '../ui/Lecteur';
import { useTitreFocus } from '../ui/titreFocus';
import { Confettis } from '../ui/Confettis';
import { XpEnLigne } from '../ui/PastilleXp';
import { useExercice } from '../ui/celebrations';
import { groupAt, play, type Position } from '../go/rules';
import { toLabel } from '../go/coords';
import { score } from '../go/score';
import { frontieresOuvertes } from '../go/frontieres';
import { KOMI_NORMAL } from './equilibrage';
import { prefersReducedMotion, readLocal, writeLocal } from './hooks';
import { settingsCourants } from './settings';
import { gagnerXp } from './xp';
import { DECOUVERTE_KEY, avancer, lireAvancement, progression, td, terminer, cleErreur } from './decouverte';
import { EVENTS, track } from '../data/analytics';
import { playCapture, playFail, playStone, playSuccess, playVictory } from '../ui/sound';
import { hapticFail, hapticIllegal, hapticStone, hapticSuccess, hapticVictory } from '../ui/haptics';
import '../ui/lecon.css';
import '../ui/decouverte.css';

/** Pause entre la pierre du joueur et la réponse de Mochi, quand il n'y a pas de mot entre les deux. */
const REPONSE_MS = 650;

/** Ce que l'écran montre pour le moment en cours. */
type Etat =
  | { quoi: 'consigne' }
  /** Bon coup : la pierre est posée ; `bravo` attend « Continuer », sinon Mochi répond après REPONSE_MS. */
  | { quoi: 'juste'; apres: Position; p: number; bravo: boolean }
  /** Erreur douce : le point est barré, Mochi explique ; le plateau reste jouable. */
  | { quoi: 'erreur'; p: number; cle: CleDecouverte; n: number; refus?: boolean };

export function PartieDecouverte({ onFin, onQuitter }: { onFin: () => void; onQuitter: () => void }) {
  const [depart] = useState(() => lireAvancement(readLocal<unknown>(DECOUVERTE_KEY, null)));
  const [i, setI] = useState(depart.etape);
  const [etat, setEtat] = useState<Etat>({ quoi: 'consigne' });
  const [fini, setFini] = useState(false);
  const [reduit] = useState(prefersReducedMotion);
  const [reglages] = useState(settingsCourants);
  // Une phrase de reprise, seulement sur le premier moment montré après un départ en cours de partie.
  const [reprise, setReprise] = useState(depart.etape > 0);
  // Comme une leçon (#236) : toute la partie, écran de fin compris, est un exercice. L'XP se lit sur l'écran de fin ;
  // la fête d'un niveau franchi attend qu'on le quitte.
  useExercice(true);
  const titre = useTitreFocus();
  const m = SCENARIO[i];
  const { pos, dernier } = useMemo(() => positionAvant(i), [i]);

  // Avancement gardé à chaque moment atteint ; mesure de chaque notion atteinte (et de celle où l'on reprend).
  const premiere = useRef(true);
  useEffect(() => {
    writeLocal(DECOUVERTE_KEY, avancer(lireAvancement(readLocal<unknown>(DECOUVERTE_KEY, null)), i));
    if (premiere.current || estDebutDeNotion(i)) {
      const { n, notion } = progression(i);
      track(EVENTS.decouverteEtape, { index: n, concept: notion, reprise: premiere.current && i > 0 });
    }
    premiere.current = false;
  }, [i]);

  // Réponse de Mochi (le coup qui vient d'arriver sur le plateau) : son claquement, plus sourd que celui du joueur.
  const avant = useRef(i);
  useEffect(() => {
    const prec = SCENARIO[avant.current];
    avant.current = i;
    if (!prec || prec === m || prec.type !== 'coup' || prec.reponse === 'passe' || dernier == null || dernier < 0) return;
    playStone(dernier, TAILLE, true);
    const prises = pos.captures[2] - positionAvant(i - 1).pos.captures[2];
    if (prises > 0) playCapture(prises);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  function suivant() {
    setReprise(false);
    if (i >= SCENARIO.length - 1) { finir(); return; }
    setEtat({ quoi: 'consigne' });
    setI(i + 1);
  }
  function finir() {
    const deja = lireAvancement(readLocal<unknown>(DECOUVERTE_KEY, null)).fini;
    writeLocal(DECOUVERTE_KEY, terminer());
    track(EVENTS.decouverteFinie, { premiere: !deja });
    // XP comme une leçon (docs/game-design/economie.md), une seule fois par appareil.
    if (!deja) gagnerXp('lecon');
    setFini(true);
    window.scrollTo({ top: 0 });
  }
  function quitter() {
    const { n, notion } = progression(i);
    track(EVENTS.decouverteQuittee, { concept: notion, index: n });
    onQuitter();
  }

  // Bon coup sans mot : Mochi répond tout seul, après un temps (tout de suite en mouvements réduits).
  useEffect(() => {
    if (etat.quoi !== 'juste' || etat.bravo) return;
    const t = window.setTimeout(suivant, reduit ? 120 : REPONSE_MS);
    return () => window.clearTimeout(t);
  }, [etat]); // eslint-disable-line react-hooks/exhaustive-deps

  function erreur(p: number, cle: CleDecouverte, refus = false) {
    playFail(); if (refus) hapticIllegal(); else hapticFail();
    setReprise(false);
    setEtat(e => ({ quoi: 'erreur', p, cle, refus, n: (e.quoi === 'erreur' ? e.n : 0) + 1 }));
  }

  function onPlay(p: number) {
    if (etat.quoi === 'juste') return;
    const label = toLabel(p, TAILLE);
    if (m.type === 'essai') {
      if (m.points.includes(label)) {
        // Le refus attendu : la pierre fantôme tremble, et le moment suivant explique la règle.
        const r = play(pos, p);
        if (r === m.refus) { playFail(); hapticIllegal(); setShake(s => ({ p, n: (s?.n ?? 0) + 1 })); suivant(); }
        return;
      }
      erreur(p, `${m.id}.non` as CleDecouverte);
      return;
    }
    if (m.type === 'passe') {
      // Un coup dans son propre territoire (pierres mortes retirées) ne rapporte rien : il coûte 1 point (prouvé par
      // src/content/decouverte.test.ts). Ailleurs, le rappel du moment.
      const chezToi = score(pos, KOMI_NORMAL, 'japanese', new Set(points(MORTES))).owner[p] === 1;
      erreur(p, `${m.id}.${chezToi ? 'territoire' : 'non'}` as CleDecouverte);
      return;
    }
    if (m.type !== 'coup') return;
    const r = play(pos, p);
    if (typeof r === 'string') {
      if (r === 'ko' || r === 'suicide') { setShake(s => ({ p, n: (s?.n ?? 0) + 1 })); erreur(p, `refus.${r}`, true); }
      return;
    }
    if (label !== m.attendu) { playStone(p, TAILLE); erreur(p, cleErreur(m.id, label, m.erreurs)); return; }
    playStone(p, TAILLE); hapticStone();
    if (r.captures[1] > pos.captures[1]) playCapture(r.captures[1] - pos.captures[1]);
    if (m.bravo) { playSuccess(); hapticSuccess(); }
    setReprise(false);
    setEtat({ quoi: 'juste', apres: r, p, bravo: !!m.bravo });
  }
  const [shake, setShake] = useState<{ p: number; n: number } | null>(null);
  const compte = m.type === 'compte' ? m.vue : null;
  const final = useMemoFinal(compte !== null);

  if (fini) return <FinDecouverte celebrer={reglages.celebrations} reduit={reduit} onFin={onFin} />;

  // ---------- Ce que montre le plateau ----------
  const montre = etat.quoi === 'juste' ? etat.apres : pos;
  let board = montre.board;
  const marks: BoardMarks = { last: etat.quoi === 'juste' ? etat.p : dernier };
  if (compte && final) {
    // Comptage : la pierre morte est d'abord montrée (barrée), puis retirée ; les territoires se colorent tour à tour.
    if (compte === 'mortes') marks.dead = final.mortes;
    else board = final.sansMortes;
    const owner = new Int8Array(final.score.owner.length);
    const garder = compte === 'territoire' || compte === 'prisonniers' ? [1] : compte === 'blanc' ? [2] : compte === 'mortes' ? [] : [1, 2];
    final.score.owner.forEach((o, q) => { if (garder.includes(o)) owner[q] = o; });
    if (garder.length) {
      marks.owner = owner;
      if (!reduit && (compte === 'territoire' || compte === 'blanc')) marks.ownerFondu = true;
    }
    marks.last = null;
  } else {
    const libs = new Set<number>();
    for (const s of points(m.libs)) if (montre.board[s]) for (const l of groupAt(montre.board, TAILLE, s).liberties) libs.add(l);
    if (libs.size) marks.libs = [...libs];
    marks.targets = points(m.cibles).filter(s => montre.board[s]);
    if (m.id === 'frontiere' && etat.quoi !== 'juste') marks.ouverts = frontieresOuvertes(montre.board, TAILLE);
  }
  if (etat.quoi === 'erreur') marks.mistake = etat.p;
  if (compte === 'mortes' && final) marks.targets = [...final.mortes];
  const halo = etat.quoi === 'juste' ? [] : m.type === 'coup' ? points([m.attendu]) : m.type === 'essai' ? points(m.points) : [];
  const jouable = (m.type === 'coup' || m.type === 'essai' || m.type === 'passe') && etat.quoi !== 'juste';

  // ---------- Ce que dit Mochi ----------
  const cle: CleDecouverte = etat.quoi === 'erreur' ? etat.cle : etat.quoi === 'juste' && etat.bravo ? `${m.id}.bravo` as CleDecouverte : m.id as CleDecouverte;
  const parole = (reprise && etat.quoi === 'consigne' ? `${td('ecran.reprise')} ` : '') + td(cle);
  const humeur: HumeurMochi = etat.quoi === 'erreur' ? 'pensif' : etat.quoi === 'juste' ? 'content' : compte === 'resultat' ? 'fier' : 'neutre';
  const repere = halo.length ? td('ecran.repere', { point: halo.map(p => toLabel(p, TAILLE)).join(', ') }) : '';

  // ---------- L'action principale, quand il en faut une ----------
  const dernierMoment = i === SCENARIO.length - 1;
  let action: { texte: string; agir: () => void } | null = null;
  if (etat.quoi === 'juste' && etat.bravo) action = { texte: td('ecran.continuer'), agir: suivant };
  else if (m.type === 'info' || m.type === 'compte') action = { texte: td(compte === 'komi' ? 'ecran.compter' : 'ecran.continuer'), agir: dernierMoment ? finir : suivant };
  else if (m.type === 'passe') action = { texte: td('ecran.passer'), agir: suivant };

  const { n, total, notion } = progression(i);
  return (
    <div className="lecteur lecteur-lecon decouverte" data-moment={etat.quoi === 'erreur' ? 'revoir' : etat.quoi === 'juste' ? 'juste' : 'consigne'}
      data-etape={m.id} data-notion={notion}>
      <div className="lecteur-tete">
        <Retour label={td('ecran.quitter')} onClick={quitter} />
        <div className="lecteur-nom lecteur-nom-lecon">
          <div className="decouverte-progres" role="progressbar" aria-label={td('ecran.titre')} aria-valuemin={1} aria-valuemax={total} aria-valuenow={n}
            aria-valuetext={td('ecran.notions', { n, total })}>
            <span className="decouverte-barre" aria-hidden="true"><i style={{ width: `${(n / total) * 100}%` }} /></span>
            <small data-testid="decouverte-notions">{td('ecran.notions', { n, total })}</small>
          </div>
          <h2 className="lecteur-titre" ref={titre} tabIndex={-1}><span>{td(`notion.${notion}` as CleDecouverte)}</span></h2>
        </div>
      </div>

      <div className="lecteur-plateau">
        <div className="plateau-cadre">
          <Board lieu="lecon" size={TAILLE} board={board} interactive={jouable} confirmTouch={reglages.confirmTouch} onPlay={onPlay} marks={marks}
            shake={shake} toucher={m.type === 'essai'} noms={{ 2: 'Mochi' }} />
          <HaloRepere points={halo} />
        </div>
      </div>

      <div className="mochi-zone">
        <PortraitMochi humeur={humeur} decoratif className="mochi-portrait" />
        <div key={`${i}-${etat.quoi}-${etat.quoi === 'erreur' ? etat.n : 0}`} role="status" aria-live="polite"
          className={['bubble', 'mochi-bulle', etat.quoi === 'erreur' && 'verdict verdict-revoir', etat.quoi === 'juste' && etat.bravo && 'verdict verdict-juste'].filter(Boolean).join(' ')}>
          {etat.quoi === 'erreur' && <Marque juste={false} taille={26} />}
          {etat.quoi === 'juste' && etat.bravo && <Marque juste taille={26} />}
          <p>{parole}{repere && <span className="sr-only"> {repere}</span>}</p>
        </div>
      </div>

      <div className="lecon-actions">
        {action && <button type="button" className="cta" data-action={m.type === 'passe' ? 'passer' : 'continuer'} onClick={action.agir}>{action.texte}</button>}
      </div>
    </div>
  );
}

/** Position finale et comptage (règle japonaise, komi de l'app), calculés une fois, au premier moment du comptage. */
function useMemoFinal(actif: boolean) {
  return useMemo(() => {
    if (!actif) return null;
    const fin = positionAvant(SCENARIO.length).pos;
    const mortes = new Set(points(MORTES));
    const sansMortes = fin.board.slice();
    for (const p of mortes) sansMortes[p] = 0;
    return { mortes, sansMortes, score: score(fin, KOMI_NORMAL, 'japanese', mortes) };
  }, [actif]);
}

/** Anneau de jade qui respire autour du point à jouer (le repère), posé sur le bois. Muet, sans toucher. */
function HaloRepere({ points: liste }: { points: number[] }) {
  if (!liste.length) return null;
  const vb = vueDe(TAILLE, null);
  const cx = (p: number) => M + (p % TAILLE) * C, cy = (p: number) => M + Math.floor(p / TAILLE) * C;
  return (
    <svg className="halos" viewBox={`${vb.x} ${vb.y} ${vb.span} ${vb.span}`} aria-hidden="true" focusable="false" data-repere={liste.map(p => toLabel(p, TAILLE)).join(' ')}>
      {liste.map(p => <circle key={p} className="halo-guide" cx={cx(p)} cy={cy(p)} r={C * 0.7} />)}
    </svg>
  );
}

/** Fin : Mochi fier, « Victoire ! », l'XP gagnée lue sur place, et une seule action : la suite, que l'appelant propose. */
function FinDecouverte({ celebrer, reduit, onFin }: { celebrer: boolean; reduit: boolean; onFin: () => void }) {
  const titre = useRef<HTMLHeadingElement>(null);
  const portrait = useRef<HTMLDivElement>(null);
  const [gerbe, setGerbe] = useState<null | { x: number; y: number }>(null);
  useEffect(() => {
    titre.current?.focus({ preventScroll: true });
    if (!celebrer) return;
    playVictory(); hapticVictory();
    if (reduit) return;
    const r = portrait.current?.getBoundingClientRect();
    setGerbe(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight * 0.3 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="lecteur fin-lecon fin-decouverte" data-testid="fin-decouverte">
      <div className="fin-sceau" ref={portrait}><PortraitMochi humeur="fier" taille={96} decoratif /></div>
      <h2 className="fin-titre" ref={titre} tabIndex={-1}>{td('fin.titre')}</h2>
      <p className="fin-acquis">{td('fin.texte')}</p>
      <div className="fin-gain"><XpEnLigne anime={celebrer} /></div>
      <div className="fin-actions">
        <button type="button" className="cta" onClick={onFin}>{td('fin.continuer')}</button>
      </div>
      {gerbe && <Confettis origine={gerbe} onFin={() => setGerbe(null)} />}
    </div>
  );
}
