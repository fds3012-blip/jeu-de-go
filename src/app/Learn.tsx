// Onglet Apprendre (issues #40 et #54) : chemin de pierres sur les lignes d'un goban, lecteur de leçon, fin de leçon.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { LESSONS, type Lesson } from '../content/lessons';
import { acquis } from '../content/acquis';
import { Board, type BoardMarks } from '../ui/Board';
import { CASE_MS, TEMPS_MS, imagesDemo, type DemoImage } from '../content/demo';

/** Fond du compteur de libertés, posé sur le bois comme les autres marques jade. */
const JADE_COMPTEUR = '#3CC48E';
import { Bubble } from '../ui/Mochi';
import { SceauLecon } from '../ui/SceauLecon';
import { Confettis } from '../ui/Confettis';
import { Etapes, Retour, Verdict } from '../ui/Lecteur';
import { fr } from '../ui/typo';
import { fromRows } from '../go/position';
import { play, type Position } from '../go/rules';
import { fromLabel } from '../go/coords';
import { score } from '../go/score';
import { prefersReducedMotion, type SyncState } from './hooks';
import { playFail, playStone, playSuccess, playVictory } from '../ui/sound';
import { hapticFail, hapticStone, hapticSuccess, hapticVictory } from '../ui/haptics';
import { EVENTS, track } from '../data/analytics';
import { gagnerXp } from './xp';
import { CHAPITRES_A_VENIR, LIGNE, boutonChemin, etapes, finDeLecon, trace, traceJusqua, type Progression } from './apprendre';
import '../ui/apprendre.css';

function lineOf(p: number, n: number) { const x = p % n, y = Math.floor(p / n); return Math.min(x, y, n - 1 - x, n - 1 - y); }

const SYNC_TEXT: Record<SyncState, string> = {
  local: 'Ta progression reste sur ce téléphone. Connecte-toi dans Profil pour la garder partout.',
  sync: 'Synchronisation de ta progression…',
  ok: 'Progression enregistrée sur ton compte.',
  error: 'Hors ligne : ta progression est gardée ici et partira plus tard.'
};

/** Lignes du goban sous le chemin : un seul tracé, x compté depuis le milieu, assez large pour les écrans jusqu'à 560 px. */
function lignesGoban(hauteur: number): string {
  const cols = 5, bord = cols * LIGNE;
  let d = '';
  for (let c = -cols; c <= cols; c++) d += `M${c * LIGNE} 0V${hauteur}`;
  for (let y = 0; y <= hauteur; y += LIGNE) d += `M${-bord} ${y}H${bord}`;
  return d;
}

export function LearnHome({ progress, onOpen, sync = 'local' }: { progress: Progression; onOpen: (id: string) => void; sync?: SyncState }) {
  const liste = etapes(LESSONS, progress);
  const iEnCours = liste.findIndex(e => e.etat === 'encours');
  const t = useMemo(() => trace(liste.length, { encours: iEnCours }), [liste.length, iEnCours]);
  const parcouru = traceJusqua(t, iEnCours >= 0 ? iEnCours : liste.length - 1, iEnCours);
  const faites = liste.filter(e => e.etat === 'faite').length;
  const bouton = boutonChemin(LESSONS, progress);
  const cta = useRef<HTMLButtonElement>(null);

  // La leçon en cours doit être à l'écran, avec son bouton : on fait défiler d'un coup, sans animation.
  useEffect(() => {
    const r = cta.current?.getBoundingClientRect();
    const bas = window.innerHeight - 96;
    if (r && r.bottom > bas) window.scrollBy({ top: r.bottom - bas, behavior: 'instant' as ScrollBehavior });
  }, []);

  // Sous la leçon en cours, le verbe suffit (le titre est juste au-dessus) ; chemin fini, le bouton dit quelle leçon il rouvre.
  const boutonCta = bouton && (
    <button ref={cta} className="cta cta-chemin" aria-label={fr(bouton.texte)} onClick={() => onOpen(bouton.id)}>{iEnCours < 0 ? fr(bouton.texte) : bouton.verbe}</button>
  );

  return (
    <div className="apprendre">
      <div className="chapitre">
        <h2>Les bases</h2>
        <p>{faites === 0 ? 'Six leçons courtes pour jouer ta première partie.' : faites === liste.length ? 'Chapitre terminé. Tu connais les règles du go !' : `${faites} leçon${faites > 1 ? 's' : ''} faite${faites > 1 ? 's' : ''} sur ${liste.length}. Continue !`}</p>
      </div>

      <div className="gue" style={{ height: t.hauteur }}>
        <div className="gue-goban" aria-hidden="true">
          <svg width="1" height={t.hauteur} focusable="false"><path d={lignesGoban(t.hauteur)} /></svg>
        </div>
        <svg className="gue-trace" width="1" height={t.hauteur} aria-hidden="true" focusable="false">
          <path d={t.d} className="gue-route" />
          {parcouru && <path d={parcouru} className="gue-parcouru" />}
        </svg>
        <ol>
          {liste.map((e, i) => {
            const p = t.pierres[i], droite = p.col > 0;
            const style = { top: p.y, '--x': `${p.x}px` } as CSSProperties;
            const etat = e.etat === 'faite' ? ', terminée' : e.etat === 'encours' ? ', prochaine étape' : '';
            return (
              <li key={e.lecon.id} className={`pas pas-${e.etat} ${droite ? 'a-droite' : 'a-gauche'}`} style={style}>
                <button className="pas-bouton" data-etat={e.etat} aria-label={`Leçon ${e.rang} : ${e.lecon.title}${etat}`} onClick={() => onOpen(e.lecon.id)}>
                  <span className="pierre-gue" aria-hidden="true" />
                  <span className="pas-texte" aria-hidden="true">
                    <SceauLecon id={e.lecon.id} taille={34} pale={e.etat === 'avenir'} />
                    <span><b>{fr(e.lecon.title)}</b><small>{e.lecon.desc}</small></span>
                  </span>
                </button>
                {e.etat === 'encours' && boutonCta}
              </li>
            );
          })}
        </ol>
      </div>

      {iEnCours < 0 && <div className="chemin-fini">{boutonCta}</div>}

      <section className="a-venir" aria-labelledby="a-venir-titre">
        <h2 id="a-venir-titre" className="titre-pierres">Bientôt</h2>
        <p>Cinq autres chapitres sont en préparation, jusqu’au niveau des joueurs de club.</p>
        <ul>{CHAPITRES_A_VENIR.map(c => <li key={c}>{c}</li>)}</ul>
      </section>

      <p className={`synchro synchro-${sync}`} role="status" aria-busy={sync === 'sync'}>{SYNC_TEXT[sync]}</p>
    </div>
  );
}

interface PlayerProps {
  lesson: Lesson;
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
}

export function LessonPlayer({ lesson, start, confirmTouch, progress = {}, celebrer = true, onProgress, onExit, onNext }: PlayerProps) {
  const [idx, setIdx] = useState(Math.min(start, lesson.steps.length - 1));
  const [answer, setAnswer] = useState<{ ok: boolean; p?: number; after?: Position; choice?: number; n: number } | null>(null);
  const [fini, setFini] = useState(false);
  const step = lesson.steps[idx];
  const { pos, marked } = useMemo(() => fromRows(step.rows), [step]);
  const owner = useMemo(() => (step.kind === 'quiz' && step.terr ? score(pos, 0, 'japanese').owner : undefined), [step, pos]);
  const derniere = idx === lesson.steps.length - 1;
  // Démonstration (#101) : un temps toutes les 600 ms ; mouvements réduits : l'état final d'emblée.
  const images = useMemo(() => (step.kind === 'info' && step.demo ? imagesDemo(step.rows, step.demo, step.avant) : null), [step]);
  const [reduit] = useState(prefersReducedMotion);
  const [temps, setTemps] = useState(() => (reduit && images ? images.length - 1 : 0));
  useEffect(() => { setTemps(reduit && images ? images.length - 1 : 0); }, [images, reduit]);
  useEffect(() => {
    if (!images || temps >= images.length - 1) return;
    const m = window.setTimeout(() => {
      const suivant = images[temps + 1];
      if (suivant.derniere != null && suivant.derniere !== images[temps].derniere) { playStone(suivant.derniere, 9); }
      setTemps(temps + 1);
    }, TEMPS_MS);
    return () => window.clearTimeout(m);
  }, [images, temps]);

  function next() {
    onProgress(idx + 1);
    if (derniere) {
      track(EVENTS.leconTerminee, { lecon: lesson.id, rang: LESSONS.indexOf(lesson) + 1 });
      if ((progress[lesson.id] ?? 0) < lesson.steps.length) gagnerXp('lecon'); // une seule fois par leçon
      setFini(true);
    } else { setIdx(idx + 1); setAnswer(null); }
    window.scrollTo({ top: 0 });
  }
  function repondre(ok: boolean, extra: { p?: number; after?: Position; choice?: number }) {
    if (ok) { playSuccess(); hapticSuccess(); } else { playFail(); hapticFail(); }
    setAnswer(a => ({ ok, ...extra, n: (a?.n ?? 0) + 1 }));
  }
  function onPlay(p: number) {
    if (answer?.ok) return;
    // Question « touche » : on désigne un point, sans poser de pierre.
    if (step.kind === 'touche') { hapticStone(); repondre(step.accept.map(a => fromLabel(a, 9)).includes(p), { p }); return; }
    if (step.kind !== 'move') return;
    const r = play(pos, p);
    if (typeof r === 'string') return;
    const ok = step.accept === 'line3' ? lineOf(p, 9) >= 2
      : step.accept === 'terrB' ? score(pos, 0, 'japanese').owner[p] === 1
      : step.accept.map(a => fromLabel(a, 9)).includes(p);
    playStone(p, 9); hapticStone();
    repondre(ok, { p, after: ok ? r : undefined });
  }

  if (fini) {
    return <FinLecon lesson={lesson} progress={{ ...progress, [lesson.id]: lesson.steps.length }} celebrer={celebrer} onNext={onNext} onExit={onExit} />;
  }

  const img = images ? images[Math.min(temps, images.length - 1)] : null;
  const demoFinie = !images || temps >= images.length - 1;
  const board = img ? img.board : answer?.ok && answer.after ? answer.after.board : pos.board;
  const faites = idx + (answer?.ok ? 1 : 0);
  const cta = <button className="cta" onClick={next}>{derniere ? 'Terminer la leçon' : 'Continuer'}</button>;
  const marks: BoardMarks = img
    ? { libs: [...img.libs, ...img.yeux], targets: img.atari, mistake: img.interdit, last: img.derniere ?? null, ...territoire(img.terr, reduit),
        note: img.compteur ? { p: img.compteur.p, fond: JADE_COMPTEUR, texte: '#0B2A1D', symbole: String(img.compteur.n), libelle: `${img.compteur.n} liberté${img.compteur.n > 1 ? 's' : ''}`, cle: `${idx}-${temps}` } : undefined }
    : { libs: (step.kind === 'info' || step.kind === 'move') && step.libs ? step.libs.map(l => fromLabel(l, 9)) : undefined, targets: marked, owner,
        ok: answer?.ok ? answer.p : undefined, mistake: answer && !answer.ok ? answer.p : undefined, last: answer?.ok ? answer.p : null };

  return (
    <div className="lecteur lecteur-lecon">
      <div className="lecteur-tete">
        <Retour label="Retour au chemin" onClick={onExit} />
        <Etapes total={lesson.steps.length} faites={faites} />
      </div>
      <h2 className="lecteur-titre"><SceauLecon id={lesson.id} taille={24} />{fr(lesson.title)}</h2>
      <Bubble>{fr(step.text)}</Bubble>
      {/* Zone souple : le plateau prend la place qui reste au-dessus du bouton (iPhone SE compris). */}
      <div className={`lecteur-plateau${img?.atari.length ? ' demo-atari' : ''}`} data-demo={images ? (demoFinie ? 'finie' : 'en-cours') : undefined}
        onClick={images && !demoFinie ? () => setTemps(images.length - 1) : undefined}>
        <Board size={9} board={board} interactive={(step.kind === 'move' || step.kind === 'touche') && !answer?.ok} confirmTouch={confirmTouch} toucher={step.kind === 'touche'} onPlay={onPlay} marks={marks} />
      </div>
      {img?.terr && <Compteur cle={`${idx}-${temps}`} n={img.terr.points.length} reduit={reduit} />}
      {images && images.length > 1 && (
        <button className="lien revoir" disabled={!demoFinie} onClick={() => setTemps(0)}>Revoir</button>
      )}
      {step.kind === 'quiz' && (
        <div className="choix" role="group" aria-label="Ta réponse">
          {step.choices.map((c, i) => (
            <button key={c} disabled={answer?.ok && answer.choice !== i}
              className={answer?.choice === i ? (answer.ok ? 'choix-juste' : 'choix-faux') : undefined}
              onClick={() => { if (!answer?.ok) repondre(i === step.answer, { choice: i }); }}>{c}</button>
          ))}
        </div>
      )}
      {step.kind === 'info' && cta}
      {answer && step.kind !== 'info' && (
        answer.ok
          ? <Verdict ton="juste" cle={answer.n} actions={cta}><p>{fr(step.ok)}</p></Verdict>
          : <Verdict ton="revoir" cle={answer.n} actions={<button className="btn" onClick={() => setAnswer(null)}>Réessayer</button>}><p>{fr(`${step.no} Essaie encore.`)}</p></Verdict>
      )}
    </div>
  );
}

/** Territoire d'une démonstration : les carrés se colorent case par case (`ownerDelai`), ou d'emblée en mouvements réduits. */
function territoire(terr: DemoImage['terr'], reduit: boolean): Pick<BoardMarks, 'owner' | 'ownerDelai'> {
  if (!terr) return {};
  const owner = new Int8Array(81);
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
  return <p className="demo-compteur" aria-live="off" data-compteur={k}><b>{k}</b> {k > 1 ? 'points' : 'point'}</p>;
}

/**
 * Instant où la pierre de la leçon touche le goban (ms), calé sur l'animation CSS `pose` (délai 320 ms + 140 ms).
 * Le claquement part à ce moment-là ; avec les mouvements réduits, tout est déjà posé et il part tout de suite.
 */
export const POSE_MS = 460;

/**
 * Fin de leçon : le sceau de la leçon s'imprime, la pierre se pose sur la rangée du chemin (avec son claquement),
 * puis une seule action en relief. Célébration modeste ; carillon et confettis seulement pour la dernière leçon.
 */
function FinLecon({ lesson, progress, celebrer, onNext, onExit }: { lesson: Lesson; progress: Progression; celebrer: boolean; onNext?: () => void; onExit: () => void }) {
  const liste = etapes(LESSONS, progress);
  const { titre, derniere } = finDeLecon(LESSONS, lesson.id);
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

  return (
    <div className={`lecteur fin-lecon${derniere ? ' fin-chapitre' : ''}`}>
      <div className="fin-sceau" ref={sceau}><SceauLecon id={lesson.id} taille={96} /></div>
      <ol className="fin-gue" aria-hidden="true">
        {liste.map(e => (
          <li key={e.lecon.id} className={`${e.etat === 'faite' ? 'faite' : ''}${e.lecon.id === lesson.id ? ' juste-posee' : ''}`}><i /></li>
        ))}
      </ol>
      <h2 className="fin-titre" ref={titreRef} tabIndex={-1}>{titre}</h2>
      <p className="fin-acquis">{fr(acquis(lesson.id))}{derniere && <> {fr('Tu connais les règles du go.')}</>}</p>
      <button className="cta" onClick={onNext ?? onExit}>{onNext ? 'Leçon suivante' : 'Retour au chemin'}</button>
      {onNext && <button className="lien" onClick={onExit}>Retour au chemin</button>}
      {gerbe && <Confettis origine={gerbe} onFin={() => setGerbe(null)} />}
    </div>
  );
}
