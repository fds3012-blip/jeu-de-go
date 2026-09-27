import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Db } from '../data/supabase';
import { BASE_PUZZLES } from '../content/puzzles';
import {
  ILLEGAL_TEXT, checkAnswer, fetchPuzzleStats, fetchPuzzles, parsePuzzles, puzzleOfDay, recordPuzzleAttempt, solutionFrames, startOf,
  type Puzzle, type PuzzleStats
} from '../data/puzzles';
import { Board } from '../ui/Board';
import { Bubble } from '../ui/Mochi';
import { prefersReducedMotion, readLocal, useOnline, writeLocal } from './hooks';

const LOCAL_PUZZLES = parsePuzzles(BASE_PUZZLES);
const SOLVED_KEY = 'go.problemes.v1';

type Load = { status: 'loading' } | { status: 'ready'; source: 'base' | 'copie'; error?: string };

interface Props { db: Db | null; userId: string | undefined; sessionLoading: boolean; confirmTouch: boolean }

/** Onglet Problèmes : problème du jour, problèmes de base, cote problèmes et série de jours. */
export function Puzzles({ db, userId, sessionLoading, confirmTouch }: Props) {
  const online = useOnline();
  const [list, setList] = useState<Puzzle[]>(LOCAL_PUZZLES);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [stats, setStats] = useState<PuzzleStats | null>(null);
  const [statsError, setStatsError] = useState('');
  const [localSolved, setLocalSolved] = useState<Record<string, true>>(() => readLocal(SOLVED_KEY, {}));
  const [openId, setOpenId] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [statsTick, setStatsTick] = useState(0);

  // Problèmes : la base pour un joueur connecté (RLS), la copie locale sinon.
  useEffect(() => {
    if (sessionLoading) return;
    if (!db || !userId) { setList(LOCAL_PUZZLES); setLoad({ status: 'ready', source: 'copie' }); return; }
    if (!online) { setList(LOCAL_PUZZLES); setLoad({ status: 'ready', source: 'copie', error: 'offline' }); return; }
    let alive = true;
    setLoad({ status: 'loading' });
    fetchPuzzles(db).then(r => {
      if (!alive) return;
      if (r.ok && r.value.length) { setList(r.value); setLoad({ status: 'ready', source: 'base' }); }
      else { setList(LOCAL_PUZZLES); setLoad({ status: 'ready', source: 'copie', error: r.ok ? undefined : r.error }); }
    });
    return () => { alive = false; };
  }, [db, userId, sessionLoading, online, retry]);

  useEffect(() => {
    if (!db || !userId || !online) { setStats(null); return; }
    let alive = true;
    fetchPuzzleStats(db, userId).then(r => {
      if (!alive) return;
      if (r.ok) { setStats(r.value); setStatsError(''); } else setStatsError(r.error);
    });
    return () => { alive = false; };
  }, [db, userId, online, retry, statsTick]);

  const solved = useMemo(() => new Set([...Object.keys(localSolved), ...(stats?.solved ?? [])]), [localSolved, stats]);
  const daily = puzzleOfDay(list, new Date());
  const markSolved = useCallback((id: string) => {
    setLocalSolved(prev => { const next = { ...prev, [id]: true as const }; writeLocal(SOLVED_KEY, next); return next; });
  }, []);

  const open = list.find(p => p.id === openId);
  if (open) {
    const idx = list.indexOf(open);
    const nextPz = list.slice(idx + 1).find(p => !solved.has(p.id)) ?? list.find(p => !solved.has(p.id) && p.id !== open.id);
    return (
      <PuzzlePlayer key={open.id} puzzle={open} daily={open === daily} confirmTouch={confirmTouch}
        rated={!!db && !!userId && online && !!stats && !stats.attempted.includes(open.id) && !solved.has(open.id)}
        rating={stats?.rating}
        onAttempt={async ok => {
          if (!db || !userId) return null;
          const r = await recordPuzzleAttempt(db, open.id, ok);
          if (r.ok) setStats(s => s && { ...s, rating: r.value, attempted: [...s.attempted, open.id], solved: ok ? [...s.solved, open.id] : s.solved, streak: ok ? Math.max(1, s.streak) : s.streak });
          if (r.ok && ok) setStatsTick(n => n + 1); // relit la série calculée par le serveur
          return r;
        }}
        onSolved={() => markSolved(open.id)}
        onNext={nextPz ? () => setOpenId(nextPz.id) : undefined}
        onExit={() => setOpenId(null)} />
    );
  }

  if (load.status === 'loading') {
    return <div className="card muted" aria-busy="true" role="status">Chargement des problèmes…</div>;
  }

  const todo = daily && !solved.has(daily.id) ? daily : list.find(p => !solved.has(p.id)) ?? daily;
  return (
    <div>
      <Bubble>{daily && !solved.has(daily.id) ? `Un problème par jour, et tu progresses vite. Aujourd'hui : « ${daily.title} ».` : 'Problème du jour réussi. Bravo ! Continue avec les bases.'}</Bubble>

      {load.error === 'offline' && <p className="notice" role="status">Tu es hors ligne. Les problèmes restent jouables, mais ta cote ne bouge pas.</p>}
      {load.error && load.error !== 'offline' && (
        <p className="notice" role="alert">{load.error} On t’affiche ceux de ce téléphone. <button className="lien" onClick={() => setRetry(n => n + 1)}>Réessayer</button></p>
      )}

      {db && userId && stats ? (
        <div className="card stats">
          <div><span className="big">{stats.rating}</span><small className="muted">Cote problèmes</small></div>
          <div><span className="big">{stats.streak}</span><small className="muted">Jour{stats.streak > 1 ? 's' : ''} de suite</small></div>
        </div>
      ) : db && userId && statsError ? (
        <p className="notice" role="alert">{statsError}</p>
      ) : (
        <p className="muted small">Connecte-toi dans l’onglet Profil pour garder ta cote problèmes. La cote mesure ton niveau : elle monte quand tu réussis.</p>
      )}

      {daily && (
        <>
          <h2>Problème du jour</h2>
          <ol className="path">
            <PuzzleItem pz={daily} n={list.indexOf(daily) + 1} done={solved.has(daily.id)} next onOpen={setOpenId} />
          </ol>
        </>
      )}
      <h2>Les bases</h2>
      <p className="muted small" style={{ marginTop: 0 }}>Une pierre est en <b>atari</b> quand il ne lui reste qu’une liberté : elle peut être prise au prochain coup.</p>
      <ol className="path">
        {list.map((p, i) => <PuzzleItem key={p.id} pz={p} n={i + 1} done={solved.has(p.id)} next={p === todo && p !== daily} onOpen={setOpenId} />)}
      </ol>
      {todo && <button className="cta" onClick={() => setOpenId(todo.id)}>{todo === daily && !solved.has(todo.id) ? 'Résoudre le problème du jour' : solved.has(todo.id) ? 'Refaire le problème du jour' : `Résoudre le problème ${list.indexOf(todo) + 1}`}</button>}
    </div>
  );
}

function PuzzleItem({ pz, n, done, next, onOpen }: { pz: Puzzle; n: number; done: boolean; next?: boolean; onOpen: (id: string) => void }) {
  return (
    <li className={done ? 'done' : next ? 'next' : ''}>
      <button onClick={() => onOpen(pz.id)} aria-label={`Problème ${n} : ${pz.title}${done ? ', réussi' : ''}`}>
        <span className="pebble">{done ? '✓' : n}</span>
        <span><b>{pz.title}</b><small>{level(pz.difficulty)}</small></span>
      </button>
    </li>
  );
}

function level(d: number): string {
  return d < 500 ? 'Facile' : d < 750 ? 'Moyen' : 'Difficile';
}

type Answer = { kind: 'ok' | 'wrong' | 'illegal'; p: number; text: string };

function PuzzlePlayer({ puzzle, daily, confirmTouch, rated, rating, onAttempt, onSolved, onNext, onExit }: {
  puzzle: Puzzle; daily: boolean; confirmTouch: boolean; rated: boolean; rating?: number;
  onAttempt: (ok: boolean) => Promise<{ ok: true; value: number } | { ok: false; error: string } | null>;
  onSolved: () => void; onNext?: () => void; onExit: () => void;
}) {
  const start = useMemo(() => startOf(puzzle), [puzzle]);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [board, setBoard] = useState(start.pos.board);
  const [tries, setTries] = useState(0);
  const [ratingMsg, setRatingMsg] = useState('');
  const [replay, setReplay] = useState<{ frame: number; total: number } | null>(null);
  const firstTry = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const solvedNow = answer?.kind === 'ok';

  async function onPlay(p: number) {
    if (solvedNow || replay) return;
    const r = checkAnswer(puzzle, p);
    if (r.kind === 'illegal') { setAnswer({ kind: 'illegal', p, text: ILLEGAL_TEXT[r.reason] }); return; }
    const ok = r.kind === 'ok';
    setTries(t => t + 1);
    setAnswer({ kind: r.kind, p, text: ok ? (puzzle.explanation ?? 'Bravo, c’est le bon coup !') : 'Pas tout à fait. Essaie encore.' });
    setBoard(ok ? r.after.board : start.pos.board);
    if (ok) onSolved();
    // Seul le premier essai compte pour la cote.
    if (firstTry.current && rated) {
      firstTry.current = false;
      const res = await onAttempt(ok);
      if (res && res.ok) {
        const diff = rating !== undefined ? res.value - rating : 0;
        setRatingMsg(`Ta cote problèmes : ${res.value}${diff ? ` (${diff > 0 ? '+' : ''}${diff})` : ''}.`);
      } else if (res) setRatingMsg(res.error);
    }
    firstTry.current = false;
  }

  function showLine() {
    const frames = solutionFrames(puzzle);
    window.clearTimeout(timer.current);
    if (prefersReducedMotion()) {
      setBoard(frames[frames.length - 1].board);
      setReplay({ frame: frames.length - 1, total: frames.length - 1 });
      return;
    }
    let i = 0;
    setBoard(frames[0].board);
    setReplay({ frame: 0, total: frames.length - 1 });
    const stepOnce = () => {
      i++;
      setBoard(frames[i].board);
      setReplay({ frame: i, total: frames.length - 1 });
      if (i < frames.length - 1) timer.current = window.setTimeout(stepOnce, 800);
    };
    timer.current = window.setTimeout(stepOnce, 500);
  }

  const frames = replay ? solutionFrames(puzzle) : null;
  const lastMove = replay && frames ? frames[replay.frame].lastMove : solvedNow ? answer.p : null;
  const replayDone = replay && replay.frame === replay.total;

  return (
    <div>
      <button className="back" onClick={onExit}>‹ Problèmes</button>
      <p className="muted small" style={{ margin: 0 }}>{daily ? 'Problème du jour' : 'Problème'} : {puzzle.title} · {level(puzzle.difficulty)}</p>
      <Bubble>{puzzle.prompt} Tu joues {puzzle.toPlay === 1 ? 'Noir' : 'Blanc'}.</Bubble>
      <Board size={puzzle.size} board={board} toPlay={puzzle.toPlay} interactive={!solvedNow && !replay} confirmTouch={confirmTouch} onPlay={onPlay}
        marks={{ targets: start.marked, last: lastMove, ok: solvedNow && !replay ? answer.p : undefined, mistake: answer && answer.kind !== 'ok' && !replay ? answer.p : undefined }} />
      <div aria-live="polite">
        {answer && !replay && <p className={`feedback ${answer.kind === 'ok' ? 'good' : 'bad'}`}>{answer.text}</p>}
        {ratingMsg && <p className="muted small">{ratingMsg}</p>}
        {replay && <p className="feedback good">{replayDone ? 'Voilà la suite. Le coup marqué est la réponse.' : `Coup ${replay.frame} sur ${replay.total}…`}</p>}
      </div>
      {(solvedNow || tries >= 1) && (
        <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={showLine} disabled={!!replay && !replayDone}>
          {replay ? 'Revoir la suite' : 'Voir la suite'}
        </button>
      )}
      {replay && !solvedNow && (
        <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={() => { window.clearTimeout(timer.current); setReplay(null); setBoard(start.pos.board); setAnswer(null); }}>Réessayer</button>
      )}
      {solvedNow && <button className="cta" onClick={onNext ?? onExit}>{onNext ? 'Problème suivant' : 'Retour aux problèmes'}</button>}
    </div>
  );
}
