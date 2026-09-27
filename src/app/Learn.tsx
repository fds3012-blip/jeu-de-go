import { useMemo, useState } from 'react';
import { LESSONS, type Lesson } from '../content/lessons';
import { Board } from '../ui/Board';
import { Bubble } from '../ui/Mochi';
import { fromRows } from '../go/position';
import { play, type Position } from '../go/rules';
import { fromLabel } from '../go/coords';
import { score } from '../go/score';
import type { SyncState } from './hooks';
import { playFail, playStone, playSuccess } from '../ui/sound';
import { hapticStone } from '../ui/haptics';
import { EVENTS, track } from '../data/analytics';

type Progress = Record<string, number>;

function lineOf(p: number, n: number) { const x = p % n, y = Math.floor(p / n); return Math.min(x, y, n - 1 - x, n - 1 - y); }

const SYNC_TEXT: Record<SyncState, string> = {
  local: 'Ta progression reste sur ce téléphone. Connecte-toi dans Profil pour la garder partout.',
  sync: 'Synchronisation de ta progression…',
  ok: 'Progression enregistrée sur ton compte.',
  error: 'Hors ligne : ta progression est gardée sur ce téléphone et sera envoyée plus tard.'
};

export function LearnHome({ progress, onOpen, sync = 'local' }: { progress: Progress; onOpen: (id: string) => void; sync?: SyncState }) {
  const next = LESSONS.find(l => (progress[l.id] ?? 0) < l.steps.length);
  return (
    <div>
      <Bubble>{next ? `Prochaine étape : « ${next.title} ». Deux minutes, et tu sauras ${next.desc.toLowerCase()}.` : 'Tu as terminé tout le chemin. Bravo ! De nouvelles leçons arrivent.'}</Bubble>
      <ol className="path">
        {LESSONS.map((l, i) => {
          const done = (progress[l.id] ?? 0) >= l.steps.length;
          return (
            <li key={l.id} className={done ? 'done' : l === next ? 'next' : ''}>
              <button onClick={() => onOpen(l.id)} aria-label={`Leçon ${i + 1} : ${l.title}${done ? ', terminée' : ''}`}>
                <span className="pebble">{done ? '✓' : i + 1}</span>
                <span><b>{l.title}</b><small>{l.desc}</small></span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="muted small" role="status" aria-busy={sync === 'sync'}>{SYNC_TEXT[sync]}</p>
    </div>
  );
}

export function LessonPlayer({ lesson, start, confirmTouch, onProgress, onExit }: { lesson: Lesson; start: number; confirmTouch: boolean; onProgress: (steps: number) => void; onExit: () => void }) {
  const [idx, setIdx] = useState(Math.min(start, lesson.steps.length - 1));
  const [answer, setAnswer] = useState<{ ok: boolean; p?: number; after?: Position; choice?: number } | null>(null);
  const step = lesson.steps[idx];
  const { pos, marked } = useMemo(() => fromRows(step.rows), [step]);
  const owner = useMemo(() => (step.kind === 'quiz' && step.terr ? score(pos, 0, 'japanese').owner : undefined), [step, pos]);

  function next() {
    onProgress(idx + 1);
    if (idx === lesson.steps.length - 1) track(EVENTS.leconTerminee, { lecon: lesson.id, rang: LESSONS.indexOf(lesson) + 1 });
    if (idx < lesson.steps.length - 1) { setIdx(idx + 1); setAnswer(null); } else onExit();
  }
  function onPlay(p: number) {
    if (step.kind !== 'move' || answer?.ok) return;
    const r = play(pos, p);
    if (typeof r === 'string') return;
    const ok = step.accept === 'line3' ? lineOf(p, 9) >= 2 : step.accept.map(a => fromLabel(a, 9)).includes(p);
    playStone(p, 9); hapticStone();
    if (ok) playSuccess(); else playFail();
    setAnswer({ ok, p, after: ok ? r : undefined });
  }
  const board = answer?.ok && answer.after ? answer.after.board : pos.board;
  const canGo = step.kind === 'info' || answer?.ok;

  return (
    <div>
      <button className="back" onClick={onExit}>‹ Chemin des leçons</button>
      <p className="muted small" style={{ margin: 0 }}>Leçon {LESSONS.indexOf(lesson) + 1} : {lesson.title}, étape {idx + 1} sur {lesson.steps.length}</p>
      <Bubble>{step.text}</Bubble>
      <Board size={9} board={board} interactive={step.kind === 'move' && !answer?.ok} confirmTouch={confirmTouch} onPlay={onPlay}
        marks={{ libs: step.kind === 'info' && step.libs ? step.libs.map(l => fromLabel(l, 9)) : undefined, targets: marked, owner,
          ok: answer?.ok ? answer.p : undefined, mistake: answer && !answer.ok ? answer.p : undefined, last: answer?.ok ? answer.p : null }} />
      {step.kind === 'quiz' && (
        <div className="choices">
          {step.choices.map((c, i) => (
            <button key={c} onClick={() => { if (answer?.ok) return; const ok = i === step.answer; setAnswer({ ok, choice: i }); if (ok) playSuccess(); else playFail(); }}
              style={answer?.choice === i ? { borderColor: answer.ok ? 'var(--jade)' : 'var(--vermillon)' } : undefined}>{c}</button>
          ))}
        </div>
      )}
      {answer && step.kind !== 'info' && (
        <p className={`feedback ${answer.ok ? 'good' : 'bad'}`} aria-live="polite">{answer.ok ? step.ok : `${step.no} Essaie encore.`}</p>
      )}
      {canGo && <button className="cta" onClick={next}>{idx < lesson.steps.length - 1 ? 'Continuer' : 'Terminer la leçon'}</button>}
    </div>
  );
}
