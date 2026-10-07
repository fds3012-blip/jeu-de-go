// Lecteur de leçon et fin de leçon (issues #40, #54, #101, #198, #200 ; recette du 30/09, R2 : lecteur v3).
// L'écran se lit de haut en bas : les points d'étapes, le plateau, puis Mochi qui parle (consigne, bravo, erreur douce)
// et une seule action en relief quand il y en a une. Le chemin des leçons, lui, est dans Learn.tsx.
import { useEffect, useMemo, useRef, useState } from 'react';
import { LESSONS, chapitreDe, explicationRefus, type Lesson } from '../content/lessons';
import { acquis } from '../content/acquis';
import { Board, type BoardMarks } from '../ui/Board';
import { C, M, vueDe, type FenetrePlateau } from '../ui/boardArt';
import { LIGNES_CONFORT, fenetreDe, lignesVisibles } from '../content/cadreLecon';
import { CASE_MS, TEMPS_MS, imageDuGeste, imagesDemo, type DemoImage } from '../content/demo';
import { PortraitMochi } from '../ui/Portrait';
import { SceauLecon } from '../ui/SceauLecon';
import { Confettis } from '../ui/Confettis';
import { Etapes, Marque, Retour } from '../ui/Lecteur';
import { NiveauAtteint } from '../ui/Niveau';
import { XpEnLigne } from '../ui/PastilleXp';
import { fr } from '../ui/typo';
import { fromRows } from '../go/position';
import { play, type Position } from '../go/rules';
import { fromLabel, toLabel } from '../go/coords';
import { score } from '../go/score';
import { prefersReducedMotion, readLocal, writeLocal } from './hooks';
import { playFail, playStone, playSuccess, playVictory } from '../ui/sound';
import { hapticFail, hapticStone, hapticSuccess, hapticVictory } from '../ui/haptics';
import { EVENTS, track } from '../data/analytics';
import { gagnerXp } from './xp';
import { validerDefi } from './defiAppareil';
import { actionsFin, etapes, finDeChapitre, finDeLecon, titreCourt, type ActionFin, type Progression } from './apprendre';
import { GUIDE_KEY, doitGuider, humeurMochi, pointsGuide, type Moment } from './lecon';
import { t } from '../content/i18n/secondaires';
import { lireFile, retirerFete, useExercice } from '../ui/celebrations';
import { niveauEnAttente } from '../ui/fileFetes';
import { BoutonAide } from '../ui/BoutonAide';
import { ficheDeLecon } from './ouvrirAide';
import '../ui/lecon.css';

/** Fond du compteur de libertés, posé sur le bois comme les autres marques jade. */
const JADE_COMPTEUR = '#3CC48E';

function lineOf(p: number, n: number) { const x = p % n, y = Math.floor(p / n); return Math.min(x, y, n - 1 - x, n - 1 - y); }

interface PlayerProps {
  /** Leçon à jouer : l'accueil ne connaît que son résumé (#16, src/content/leconsResume.ts), le lecteur prend la leçon complète. */
  lesson: Pick<Lesson, 'id'>;
  start: number;
  confirmTouch: boolean;
  /** Progression de toutes les leçons, pour la rangée de pierres de la fin de leçon. */
  progress?: Progression;
  /** Réglage « Célébrations » : faux coupe le carillon et les confettis de la dernière leçon. */
  celebrer?: boolean;
  onProgress: (steps: number) => void;
  onExit: () => void;
  /** Ouvre la leçon suivante ; absent pour la dernière. */
  onNext?: () => void;
  /** Fin de leçon (#200) : série de 3 problèmes du thème de la leçon (`themes` : leurs noms) ; absente si la leçon n'a pas de thème. */
  pratique?: { themes: string[]; ouvrir: () => void };
  /** Fin de chapitre (#200) : lance une partie contre le premier adversaire. */
  jouer?: { nom: string; lancer: () => void };
  /** Leçon complète hors du catalogue (#454 : leçon d'essai des grands plateaux, derrière un paramètre de test). */
  lecon?: Lesson;
}

export function LessonPlayer({ lesson: { id: leconId }, start, confirmTouch, progress = {}, celebrer = true, onProgress, onExit, onNext, pratique, jouer, lecon }: PlayerProps) {
  const lesson = lecon ?? LESSONS.find(l => l.id === leconId)!;
  const [idx, setIdx] = useState(Math.min(start, lesson.steps.length - 1));
  const [answer, setAnswer] = useState<{ ok: boolean; p?: number; after?: Position; choice?: number; n: number } | null>(null);
  /** Choix faux déjà touchés au quiz (#198) : ils restent marqués, les autres restent touchables. */
  const [faux, setFaux] = useState<number[]>([]);
  const [fini, setFini] = useState(false);
  // #236 (N2) : la leçon entière, écran de fin compris, est un exercice : l'XP se lit sur l'écran de fin,
  // la fête de niveau attend qu'on le quitte (FinLecon lui donne alors son écran à lui).
  useExercice(true);
  const step = lesson.steps[idx];
  const { pos, marked } = useMemo(() => fromRows(step.rows), [step]);
  // #454 : 9, 13 ou 19 lignes (celles de la position), et la zone montrée si l'étape est cadrée.
  const n = pos.size;
  const fen = useMemo(() => fenetreDe(step.cadre, n), [step, n]);
  // Intersections plus petites que sur le 9 × 9 entier : la seconde touche de confirmation est toujours demandée.
  const confirmer = confirmTouch || lignesVisibles(n, fen) > LIGNES_CONFORT;
  const owner = useMemo(() => (step.kind === 'quiz' && step.terr ? score(pos, 0, 'japanese').owner : undefined), [step, pos]);
  const derniere = idx === lesson.steps.length - 1;
  // Démonstration (#101) : un temps toutes les 600 ms ; mouvements réduits : l'état final d'emblée.
  const images = useMemo(() => (step.kind === 'info' && step.demo ? imagesDemo(step.rows, step.demo, step.avant) : null), [step]);
  // Geste (#198) : la démonstration s'arrête sur l'image `pause` jusqu'à ce que l'élève pose la pierre ou touche le point.
  const geste = step.kind === 'info' && step.demo ? step.geste : undefined;
  const pause = useMemo(() => (step.kind === 'info' && step.demo && step.geste ? imageDuGeste(step.rows, step.demo, step.avant, step.geste) : -1), [step]);
  const [gesteFait, setGesteFait] = useState(false);
  const [rate, setRate] = useState<{ p: number; n: number } | null>(null);
  const attente = !!geste && !gesteFait;
  const gesteA = useRef(0);
  const [reduit] = useState(prefersReducedMotion);
  const limite = images ? (attente ? pause : images.length - 1) : 0;
  const [temps, setTemps] = useState(() => (reduit ? limite : 0));
  useEffect(() => { setTemps(reduit ? limite : 0); }, [images, reduit]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!images || temps >= limite) return;
    const m = window.setTimeout(() => {
      const suivant = images[temps + 1];
      if (suivant.derniere != null && suivant.derniere !== images[temps].derniere) { playStone(suivant.derniere, n); }
      setTemps(temps + 1);
    }, TEMPS_MS);
    return () => window.clearTimeout(m);
  }, [images, temps, limite, n]);

  // Événement d'entonnoir (#198) : leçons terminées ÷ leçons commencées.
  useEffect(() => {
    track(EVENTS.leconCommencee, { lecon: lesson.id, rang: LESSONS.indexOf(lesson) + 1, etape: Math.min(start, lesson.steps.length - 1) + 1 });
  }, [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guidage (R2) : la toute première étape interactive, un halo discret sur le point à toucher, une seule fois par appareil.
  const guide = useMemo(() => pointsGuide(step, attente, n), [step, attente, n]);
  // Étape guidée : la première qui a un point à montrer ; la clé est posée dès qu'elle s'affiche, les suivantes n'ont rien.
  const [guidee, setGuidee] = useState(-1);
  useEffect(() => {
    if (guidee === -1 && doitGuider(readLocal<string | null>(GUIDE_KEY, null), guide)) { setGuidee(idx); writeLocal(GUIDE_KEY, '1'); }
  }, [guidee, guide, idx]);
  const halo = guidee === idx && !answer && !rate ? guide : [];

  function next() {
    onProgress(idx + 1);
    if (derniere) {
      track(EVENTS.leconTerminee, { lecon: lesson.id, rang: LESSONS.indexOf(lesson) + 1 });
      validerDefi('lecon'); // #199 : une leçon terminée est le défi du jour (série de l'appareil, SERIE_UN_DEFI)
      if ((progress[lesson.id] ?? 0) < lesson.steps.length) gagnerXp('lecon'); // une seule fois par leçon
      setFini(true);
    } else { setIdx(idx + 1); setAnswer(null); setFaux([]); setGesteFait(false); setRate(null); }
    window.scrollTo({ top: 0 });
  }
  function repondre(ok: boolean, extra: { p?: number; after?: Position; choice?: number }) {
    if (ok) { playSuccess(); hapticSuccess(); } else { playFail(); hapticFail(); }
    setAnswer(a => ({ ok, ...extra, n: (a?.n ?? 0) + 1 }));
  }
  /** Geste de la démonstration : juste, la suite se joue ; faux, le point se marque et l'élève rejoue tout de suite. */
  function onGeste(p: number) {
    if (!geste || !images) return;
    const bons = 'pose' in geste ? [geste.pose] : geste.touche;
    if (!bons.map(a => fromLabel(a, n)).includes(p)) {
      playFail(); hapticFail();
      setRate(r => ({ p, n: (r?.n ?? 0) + 1 }));
      return;
    }
    gesteA.current = Date.now();
    setRate(null);
    setGesteFait(true);
    if ('pose' in geste) { playStone(p, n); hapticStone(); } else hapticStone();
    const suite = 'pose' in geste ? pause + 1 : pause;
    setTemps(reduit ? images.length - 1 : suite);
  }
  function onPlay(p: number) {
    if (attente) { onGeste(p); return; }
    if (answer?.ok) return;
    // Question « touche » : on désigne un point, sans poser de pierre.
    if (step.kind === 'touche') { hapticStone(); repondre(step.accept.map(a => fromLabel(a, n)).includes(p), { p }); return; }
    if (step.kind !== 'move') return;
    const r = play(pos, p);
    if (typeof r === 'string') return;
    const ok = step.accept === 'line3' ? lineOf(p, n) >= 2
      : step.accept === 'terrB' ? score(pos, 0, 'japanese').owner[p] === 1
      : step.accept.map(a => fromLabel(a, n)).includes(p);
    playStone(p, n); hapticStone();
    repondre(ok, { p, after: ok ? r : undefined });
  }

  if (fini) {
    return <FinLecon lesson={lesson} progress={{ ...progress, [lesson.id]: lesson.steps.length }} celebrer={celebrer} onNext={onNext} onExit={onExit} pratique={pratique} jouer={jouer} />;
  }

  const img = images ? images[Math.min(temps, images.length - 1)] : null;
  const demoFinie = !images || temps >= images.length - 1;
  const board = img ? img.board : answer?.ok && answer.after ? answer.after.board : pos.board;
  const faites = idx + (answer?.ok ? 1 : 0);
  // En attente du geste « pose » : seul le point à jouer est vert (le compteur de libertés reste).
  const vert = attente && geste && 'pose' in geste ? [fromLabel(geste.pose, n)] : null;
  const cta = <button className="cta" onClick={next}>{t(derniere ? 'lecon.terminer' : 'apprendre.continuer')}</button>;
  const marks: BoardMarks = img
    ? { libs: vert ?? [...img.libs, ...img.yeux], targets: img.atari, mistake: attente && rate ? rate.p : img.interdit, last: img.derniere ?? null, ...territoire(img.terr, reduit, n),
        note: img.compteur ? { p: img.compteur.p, fond: JADE_COMPTEUR, texte: '#0B2A1D', symbole: String(img.compteur.n), libelle: t('lecon.libertes', { n: img.compteur.n }), cle: `${idx}-${temps}` } : undefined }
    : { libs: step.kind === 'info' || step.kind === 'move' ? (step.libs ?? (step.kind === 'move' ? step.aide : undefined))?.map(l => fromLabel(l, n)) : undefined, targets: marked, owner,
        ok: answer?.ok ? answer.p : undefined, mistake: answer && !answer.ok ? answer.p : undefined, last: answer?.ok ? answer.p : null };

  // Ce que Mochi dit, et avec quelle tête. Le geste raté et l'erreur se corrigent sur le plateau, sans bouton.
  const quizFaux = step.kind === 'quiz' && !!answer && !answer.ok;
  const moment: Moment = attente && rate ? 'revoir' : answer ? (answer.ok ? 'juste' : 'revoir') : 'consigne';
  const cle = attente && rate ? `geste-${rate.n}` : answer ? `reponse-${answer.n}` : `consigne-${idx}`;
  let parole: string;
  if (attente && rate && geste) parole = 'pose' in geste ? t('lecon.poseVert') : geste.no;
  else if (answer && step.kind !== 'info') {
    parole = answer.ok ? step.ok
      : t('lecon.essaieEncore', { no: step.kind === 'move' && answer.p != null ? explicationRefus(step, toLabel(answer.p, n)) : step.no });
  } else parole = step.text;
  // Les verdicts d'un coup ou d'un point touché gardent leur nom de feuille (`verdict`) : les parcours e2e les lisent.
  const verdict = !!answer && step.kind !== 'info' && !quizFaux;
  const classeBulle = ['bubble', 'mochi-bulle', verdict && `verdict verdict-${answer!.ok ? 'juste' : 'revoir'}`, quizFaux && 'choix-aide'].filter(Boolean).join(' ');
  // L'action principale, quand il y en a une : après une démonstration vue, ou une bonne réponse.
  const action = step.kind === 'info' && !attente ? cta : answer?.ok && step.kind !== 'info' ? cta : null;

  return (
    <div className="lecteur lecteur-lecon" data-moment={moment}>
      <div className="lecteur-tete">
        <Retour label={t('lecon.retourChemin')} onClick={onExit} />
        <h2 className="lecteur-titre"><SceauLecon id={lesson.id} taille={24} /><span>{fr(lesson.title)}</span></h2>
        <Etapes total={lesson.steps.length} faites={faites} />
        {/* #362 : « ? » ouvre l'aide sur le mot que la leçon enseigne, sans quitter la leçon. */}
        <BoutonAide depuis="lecon" {...ficheDeLecon(lesson.id)} />
      </div>
      {/* Zone souple : le plateau prend la place qui reste entre la barre et Mochi (iPhone SE compris). */}
      <div className={`lecteur-plateau${img?.atari.length ? ' demo-atari' : ''}`} data-demo={images ? (attente ? 'geste' : demoFinie ? 'finie' : 'en-cours') : undefined}
        onClick={images && !demoFinie && temps < limite ? () => { if (Date.now() - gesteA.current > 400) setTemps(limite); } : undefined}>
        <div className="plateau-cadre">
          <Board size={n} fenetre={fen} board={board} interactive={attente || ((step.kind === 'move' || step.kind === 'touche') && !answer?.ok)} confirmTouch={confirmer}
            toucher={step.kind === 'touche' || (attente && !!geste && 'touche' in geste)} stonesTappable={attente && !!geste && 'touche' in geste} onPlay={onPlay} marks={marks} />
          <Halos guide={halo} juste={answer?.ok && answer.p != null ? { p: answer.p, n: answer.n } : null} reduit={reduit} size={n} fenetre={fen} />
        </div>
      </div>
      {img?.terr && <Compteur cle={`${idx}-${temps}`} n={img.terr.points.length} reduit={reduit} />}

      <div className="mochi-zone">
        <PortraitMochi humeur={humeurMochi(moment)} decoratif className="mochi-portrait" />
        <div key={cle} className={classeBulle} role="status" aria-live="polite">
          {verdict && <Marque juste={answer!.ok} taille={26} />}
          {quizFaux && <Marque juste={false} taille={26} />}
          <p>{fr(parole)}</p>
        </div>
      </div>

      {step.kind === 'quiz' && (
        <div className={`choix${step.choices.some(c => /\p{L}/u.test(c)) ? ' choix-mots' : ''}`} role="group" aria-label={t('lecon.taReponse')}>
          {step.choices.map((c, i) => (
            <button key={c} disabled={answer?.ok && answer.choice !== i} aria-disabled={faux.includes(i) || undefined}
              className={answer?.ok && answer.choice === i ? 'choix-juste' : faux.includes(i) ? 'choix-faux' : undefined}
              onClick={() => {
                if (answer?.ok || faux.includes(i)) return;
                if (i !== step.answer) setFaux(f => [...f, i]);
                repondre(i === step.answer, { choice: i });
              }}>{c}</button>
          ))}
        </div>
      )}

      <div className="lecon-actions">
        {action}
        {images && images.length > 1 && !attente && (
          <button className="lien revoir" disabled={!demoFinie} onClick={() => setTemps(0)}>{t('apprendre.revoir')}</button>
        )}
      </div>
    </div>
  );
}

/**
 * Calque posé sur le plateau (même viewBox que Board.tsx, comme le conseil de Mochi) : le halo de guidage de la
 * première étape interactive, et l'anneau de jade qui s'ouvre autour d'une bonne réponse. Muet, sans toucher.
 */
function Halos({ guide, juste, reduit, size, fenetre }: { guide: number[]; juste: { p: number; n: number } | null; reduit: boolean; size: number; fenetre: FenetrePlateau | null }) {
  if (!guide.length && (!juste || reduit)) return null;
  const vb = vueDe(size, fenetre);
  const cx = (p: number) => M + (p % size) * C, cy = (p: number) => M + Math.floor(p / size) * C;
  return (
    <svg className="halos" viewBox={`${vb.x} ${vb.y} ${vb.span} ${vb.span}`} aria-hidden="true" focusable="false" data-guide={guide.length ? guide.map(p => toLabel(p, size)).join(' ') : undefined}>
      {guide.map(p => <circle key={p} className="halo-guide" cx={cx(p)} cy={cy(p)} r={C * 0.7} />)}
      {juste && !reduit && <circle key={juste.n} className="halo-juste" cx={cx(juste.p)} cy={cy(juste.p)} r={C * 0.62} />}
    </svg>
  );
}

/** Territoire d'une démonstration : les carrés se colorent case par case (`ownerDelai`), ou d'emblée en mouvements réduits. */
function territoire(terr: DemoImage['terr'], reduit: boolean, size: number): Pick<BoardMarks, 'owner' | 'ownerDelai'> {
  if (!terr) return {};
  const owner = new Int8Array(size * size);
  for (const p of terr.points) owner[p] = terr.couleur;
  return { owner, ownerDelai: reduit ? undefined : new Map(terr.points.map((p, i) => [p, i * CASE_MS])) };
}

/** Compteur qui suit les cases coloriées : 1, 2, 3… jusqu'à `n`, au rythme des carrés. */
function Compteur({ n, reduit, cle }: { n: number; reduit: boolean; cle: string }) {
  const [k, setK] = useState(reduit ? n : 0);
  useEffect(() => {
    if (reduit) { setK(n); return; }
    setK(0);
    const m = window.setInterval(() => setK(v => { if (v + 1 >= n) window.clearInterval(m); return Math.min(n, v + 1); }), CASE_MS);
    return () => window.clearInterval(m);
  }, [n, reduit, cle]);
  return <p className="demo-compteur" aria-live="off" data-compteur={k}><b>{k}</b> {t('lecon.point', { n: k })}</p>;
}

/**
 * Instant où la pierre de la leçon touche le goban (ms), calé sur l'animation CSS `pose` (délai 320 ms + 140 ms).
 * Le claquement part à ce moment-là ; avec les mouvements réduits, tout est déjà posé et il part tout de suite.
 */
export const POSE_MS = 460;

/**
 * Fin de leçon : le sceau de la leçon s'imprime, la pierre se pose sur la rangée du chemin (avec son claquement),
 * l'XP gagnée se lit sur place, puis une seule action en relief ; le lien de la leçon suivante la nomme.
 * Célébration modeste ; carillon et confettis seulement pour la dernière leçon.
 */
function FinLecon({ lesson, progress, celebrer, onNext, onExit, pratique, jouer }: {
  lesson: Lesson; progress: Progression; celebrer: boolean; onNext?: () => void; onExit: () => void;
  pratique?: PlayerProps['pratique']; jouer?: PlayerProps['jouer'];
}) {
  // #228 : tout se compte dans le chapitre de la leçon. Un chapitre en cours d'écriture ne se ferme pas encore.
  const chap = chapitreDe(lesson.id), lecons = chap.lecons;
  const liste = etapes(lecons, progress);
  const derniere = chap.complet && finDeLecon(lecons, lesson.id).derniere;
  // Fin de chapitre (#200) : dernière leçon terminée, ou toutes les leçons du chapitre faites.
  const chapitre = chap.complet && finDeChapitre(lecons, progress, lesson.id);
  // Hors fin de chapitre, « Leçon terminée » (la dernière leçon d'un chapitre en cours d'écriture aussi).
  const titre = chapitre ? finDeLecon(lecons, lecons[lecons.length - 1].id).titre : finDeLecon([], lesson.id).titre;
  const { principale, liens } = actionsFin({ chapitre, pratique: !!pratique, suivante: !!onNext, jouer: !!jouer });
  // Le niveau franchi pendant la leçon a son écran à lui (#236), entre la fin de leçon et l'action choisie.
  const [niveau, setNiveau] = useState<{ n: number; libelle: string; agir: () => void } | null>(null);
  const puis = (libelle: string, agir: () => void) => () => {
    const n = niveauEnAttente(lireFile());
    if (n === null) { agir(); return; }
    retirerFete('niveau');
    setNiveau({ n, libelle, agir });
  };
  // La leçon suivante du chapitre, nommée sur son lien (L14).
  const suivante = LESSONS[LESSONS.indexOf(lesson) + 1];
  const bouton = (a: ActionFin, classe: 'cta' | 'lien') => {
    const props = { className: classe, 'data-action': a };
    if (a === 'jouer' && jouer) { const l = t('lecon.jouerContre', { nom: jouer.nom }); return <button key={a} {...props} onClick={puis(l, jouer.lancer)}>{l}</button>; }
    if (a === 'pratique' && pratique) {
      const l = fr(t('lecon.pratique'));
      return <button key={a} {...props} onClick={puis(l, pratique.ouvrir)} aria-label={fr(t('lecon.pratiqueAria', { themes: pratique.themes.join(', ') }))}>{l}</button>;
    }
    // Recette du 02/10 au soir (L14) : le lien dit lui-même où il mène ; plus de « Prochain pas » qui le répétait.
    if (a === 'suivante' && onNext) {
      const l = suivante ? t('lecon.suivanteTitre', { titre: titreCourt(suivante.title) }) : t('lecon.suivante');
      return <button key={a} {...props} onClick={puis(l, onNext)}>{fr(l)}</button>;
    }
    const l = t('lecon.retourChemin');
    return <button key={a} {...props} onClick={puis(l, onExit)}>{l}</button>;
  };
  const [reduit] = useState(prefersReducedMotion);
  const fete = derniere && celebrer;
  const sceau = useRef<HTMLDivElement>(null);
  const titreRef = useRef<HTMLHeadingElement>(null);
  const [gerbe, setGerbe] = useState<null | { x: number; y: number }>(null);
  useEffect(() => {
    titreRef.current?.focus({ preventScroll: true });
    // Minuteries annulées si on quitte l'écran avant la fin : rien ne claque après coup.
    const minuteries: number[] = [];
    const apres = (ms: number, f: () => void) => { minuteries.push(window.setTimeout(f, reduit ? 0 : ms)); };
    const i = LESSONS.findIndex(l => l.id === lesson.id);
    apres(POSE_MS, () => { playStone(Math.max(0, i) + 1, 9); hapticStone(); });
    if (fete) {
      apres(POSE_MS + 120, () => { playVictory(); hapticVictory(); });
      if (!reduit) apres(POSE_MS, () => {
        const r = sceau.current?.getBoundingClientRect();
        setGerbe(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight * 0.3 });
      });
    }
    return () => minuteries.forEach(m => window.clearTimeout(m));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (niveau) return <NiveauAtteint niveau={niveau.n} celebrer={celebrer} action={niveau.libelle} onAction={niveau.agir} />;

  return (
    <div className={`lecteur fin-lecon${derniere ? ' fin-chapitre' : ''}`}>
      <div className="fin-sceau" ref={sceau}><SceauLecon id={lesson.id} taille={96} /></div>
      <ol className="fin-gue" aria-hidden="true">
        {liste.map(e => (
          <li key={e.lecon.id} className={`${e.etat === 'faite' ? 'faite' : ''}${e.lecon.id === lesson.id ? ' juste-posee' : ''}${e.etat === 'encours' ? ' prochaine' : ''}`}><i /></li>
        ))}
      </ol>
      <h2 className="fin-titre" ref={titreRef} tabIndex={-1}>{titre}</h2>
      <p className="fin-acquis">{fr(acquis(lesson.id))}{chapitre && chap.fin && <> {fr(chap.fin)}</>}</p>
      <div className="fin-gain"><XpEnLigne anime={celebrer} /></div>
      <div className="fin-actions">
        {bouton(principale, 'cta')}
        {liens.map(a => bouton(a, 'lien'))}
      </div>
      {gerbe && <Confettis origine={gerbe} onFin={() => setGerbe(null)} />}
    </div>
  );
}
