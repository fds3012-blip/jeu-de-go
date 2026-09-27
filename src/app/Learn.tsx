// Onglet Apprendre (issue #40, phase 6) : chemin de pierres de gué, lecteur de leçon, fin de leçon.
import { useMemo, useState, type CSSProperties } from 'react';
import { LESSONS, type Lesson } from '../content/lessons';
import { acquis } from '../content/acquis';
import { Board } from '../ui/Board';
import { Bubble } from '../ui/Mochi';
import { Sceau } from '../ui/Sceau';
import { Etapes, Retour, Verdict } from '../ui/Lecteur';
import { fr } from '../ui/typo';
import { fromRows } from '../go/position';
import { play, type Position } from '../go/rules';
import { fromLabel } from '../go/coords';
import { score } from '../go/score';
import { prefersReducedMotion, type SyncState } from './hooks';
import { playFail, playStone, playSuccess, playVictory } from '../ui/sound';
import { hapticStone } from '../ui/haptics';
import { EVENTS, track } from '../data/analytics';
import { CHAPITRES_A_VENIR, boutonChemin, etapes, repliqueMochi, trace, traceJusqua, type Progression } from './apprendre';
import '../ui/apprendre.css';

function lineOf(p: number, n: number) { const x = p % n, y = Math.floor(p / n); return Math.min(x, y, n - 1 - x, n - 1 - y); }

const SYNC_TEXT: Record<SyncState, string> = {
  local: 'Ta progression reste sur ce téléphone. Connecte-toi dans Profil pour la garder partout.',
  sync: 'Synchronisation de ta progression…',
  ok: 'Progression enregistrée sur ton compte.',
  error: 'Hors ligne : ta progression est gardée ici et partira plus tard.'
};

/** Coche dessinée à la main, posée sur une pierre d'ardoise. */
function CochePierre() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
      <path d="M5.5 12.6 10 17l8.5-9.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LearnHome({ progress, onOpen, sync = 'local' }: { progress: Progression; onOpen: (id: string) => void; sync?: SyncState }) {
  const liste = etapes(LESSONS, progress);
  const iEnCours = liste.findIndex(e => e.etat === 'encours');
  const t = useMemo(() => trace(liste.length, { bulle: iEnCours }), [liste.length, iEnCours]);
  const parcouru = traceJusqua(t, iEnCours >= 0 ? iEnCours : liste.length - 1);
  const faites = liste.filter(e => e.etat === 'faite').length;
  const bouton = boutonChemin(LESSONS, progress);

  return (
    <div className="apprendre">
      <div className="chapitre">
        <h2>Les bases</h2>
        <p>{faites === 0 ? 'Six leçons courtes pour jouer ta première partie.' : faites === liste.length ? 'Chapitre terminé. Tu connais les règles du go !' : `${faites} leçon${faites > 1 ? 's' : ''} faite${faites > 1 ? 's' : ''} sur ${liste.length}. Continue !`}</p>
      </div>

      <div className="gue" style={{ height: t.hauteur }}>
        <svg className="gue-trace" viewBox={`0 0 100 ${t.hauteur}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d={t.d} className="gue-eau" />
          <path d={t.d} className="gue-pointille" />
          {parcouru && <path d={parcouru} className="gue-parcouru" />}
        </svg>
        <ol>
          {liste.map((e, i) => {
            const p = t.pierres[i], droite = p.x > 50;
            const style = { top: p.y, '--x': `${p.x}%` } as CSSProperties;
            const etat = e.etat === 'faite' ? ', terminée' : e.etat === 'encours' ? ', prochaine étape' : '';
            return (
              <li key={e.lecon.id}>
                {e.etat === 'encours' && (
                  <div className={`gue-mochi ${droite ? 'a-droite' : 'a-gauche'}`} style={style}>
                    <Sceau id="mochi" taille={36} />
                    <p>{fr(repliqueMochi(e))}</p>
                  </div>
                )}
                <button className={`pas pas-${e.etat} ${droite ? 'a-droite' : 'a-gauche'}`} style={style} data-etat={e.etat}
                  aria-label={`Leçon ${e.rang} : ${e.lecon.title}${etat}`} onClick={() => onOpen(e.lecon.id)}>
                  <span className="pierre-gue" aria-hidden="true">{e.etat === 'faite' ? <CochePierre /> : e.rang}</span>
                  <span className="pas-texte" aria-hidden="true"><b>{fr(e.lecon.title)}</b><small>{e.lecon.desc}</small></span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <section className="a-venir" aria-labelledby="a-venir-titre">
        <h2 id="a-venir-titre">Bientôt</h2>
        <p>Cinq autres chapitres sont en préparation, jusqu’au niveau des joueurs de club.</p>
        <ul>{CHAPITRES_A_VENIR.map(c => <li key={c}>{c}</li>)}</ul>
      </section>

      <p className={`synchro synchro-${sync}`} role="status" aria-busy={sync === 'sync'}>{SYNC_TEXT[sync]}</p>
      {bouton && <button className={`cta${bouton.texte.length > 24 ? ' long' : ''}`} onClick={() => onOpen(bouton.id)}>{fr(bouton.texte)}</button>}
    </div>
  );
}

interface PlayerProps {
  lesson: Lesson;
  start: number;
  confirmTouch: boolean;
  /** Progression de toutes les leçons, pour le petit chemin de la fin de leçon. */
  progress?: Progression;
  /** Réglage « Célébrations » (s'il existe) : faux coupe les confettis. */
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

  function next() {
    onProgress(idx + 1);
    if (derniere) {
      track(EVENTS.leconTerminee, { lecon: lesson.id, rang: LESSONS.indexOf(lesson) + 1 });
      playVictory();
      setFini(true);
    } else { setIdx(idx + 1); setAnswer(null); }
    window.scrollTo({ top: 0 });
  }
  function repondre(ok: boolean, extra: { p?: number; after?: Position; choice?: number }) {
    if (ok) playSuccess(); else playFail();
    setAnswer(a => ({ ok, ...extra, n: (a?.n ?? 0) + 1 }));
  }
  function onPlay(p: number) {
    if (step.kind !== 'move' || answer?.ok) return;
    const r = play(pos, p);
    if (typeof r === 'string') return;
    const ok = step.accept === 'line3' ? lineOf(p, 9) >= 2 : step.accept.map(a => fromLabel(a, 9)).includes(p);
    playStone(p, 9); hapticStone();
    repondre(ok, { p, after: ok ? r : undefined });
  }

  if (fini) {
    return <FinLecon lesson={lesson} progress={{ ...progress, [lesson.id]: lesson.steps.length }} celebrer={celebrer} onNext={onNext} onExit={onExit} />;
  }

  const board = answer?.ok && answer.after ? answer.after.board : pos.board;
  const faites = idx + (answer?.ok ? 1 : 0);
  const cta = <button className="cta" onClick={next}>{derniere ? 'Terminer la leçon' : 'Continuer'}</button>;

  return (
    <div className="lecteur">
      <div className="lecteur-tete">
        <Retour label="Retour au chemin" onClick={onExit} />
        <Etapes total={lesson.steps.length} faites={faites} />
      </div>
      <h2 className="lecteur-titre">{fr(lesson.title)}</h2>
      <Bubble>{fr(step.text)}</Bubble>
      <Board size={9} board={board} interactive={step.kind === 'move' && !answer?.ok} confirmTouch={confirmTouch} onPlay={onPlay}
        marks={{ libs: step.kind === 'info' && step.libs ? step.libs.map(l => fromLabel(l, 9)) : undefined, targets: marked, owner,
          ok: answer?.ok ? answer.p : undefined, mistake: answer && !answer.ok ? answer.p : undefined, last: answer?.ok ? answer.p : null }} />
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

/** Confettis de 1,5 s (jade, or, hanko, papier) : jamais avec les mouvements réduits (CSS et JS). */
function Confettis() {
  const couleurs = ['var(--jade)', 'var(--or)', 'var(--hanko)', 'var(--papier)'];
  return (
    <div className="confettis" aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => {
        const x = (i * 37) % 100, d = (i * 53) % 400, r = (i * 71) % 360;
        return <span key={i} style={{ left: `${x}%`, background: couleurs[i % 4], animationDelay: `${d}ms`, '--r': `${r}deg`, '--dx': `${((i * 29) % 60) - 30}px` } as CSSProperties} />;
      })}
    </div>
  );
}

function FinLecon({ lesson, progress, celebrer, onNext, onExit }: { lesson: Lesson; progress: Progression; celebrer: boolean; onNext?: () => void; onExit: () => void }) {
  const liste = etapes(LESSONS, progress);
  const [confettis] = useState(() => celebrer && !prefersReducedMotion());
  return (
    <div className="lecteur fin-lecon">
      {confettis && <Confettis />}
      <div className="fin-sceau"><Sceau id="mochi" taille={104} /></div>
      <ol className="fin-gue" aria-hidden="true">
        {liste.map(e => (
          <li key={e.lecon.id} className={`${e.etat === 'faite' ? 'faite' : ''}${e.lecon.id === lesson.id ? ' juste-faite' : ''}`}>
            {e.etat === 'faite' && <CochePierre />}
          </li>
        ))}
      </ol>
      <h2 className="fin-titre">Leçon terminée</h2>
      <p className="fin-acquis">{fr(acquis(lesson.id))}</p>
      <button className="cta" onClick={onNext ?? onExit}>{onNext ? 'Leçon suivante' : 'Retour au chemin'}</button>
      {onNext && <button className="lien" onClick={onExit}>Retour au chemin</button>}
    </div>
  );
}
