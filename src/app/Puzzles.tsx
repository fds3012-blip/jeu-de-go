// Onglet Problèmes (issue #40, phase 6) : cote et série, problème du jour mis en scène, grille des problèmes de base.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Db } from '../data/supabase';
import { ALL_PUZZLES } from '../content/puzzles';
import {
  ILLEGAL_TEXT, checkAnswer, fetchPuzzleStats, fetchPuzzles, parsePuzzles, recordPuzzleAttempt, solutionFrames, startOf,
  type Puzzle, type PuzzleStats
} from '../data/puzzles';
import { Board } from '../ui/Board';
import { MiniGoban } from '../ui/MiniGoban';
import { Defile } from '../ui/Defile';
import { ecart } from '../ui/defile';
import { centreVertical } from '../ui/cadrage';
import { C, M, viewBoxOf } from '../ui/boardArt';
import { Retour, Verdict } from '../ui/Lecteur';
import { Bubble } from '../ui/Mochi';
import { Reflexion } from '../ui/Reflexion';
import { fr } from '../ui/typo';
import { playFail, playIllegal, playStone, playSuccess } from '../ui/sound';
import { hapticIllegal, hapticStone } from '../ui/haptics';
import { EVENTS, track } from '../data/analytics';
import { prefersReducedMotion, readLocal, useOnline, writeLocal } from './hooks';
import { legendeSerie, niveau, suivant } from './problemes';
import { SERIE_KEY, numeroDuJour, problemeDuNumero, serieApres, serieVivante, textePartage, type Serie } from './goDuJour';
import '../ui/apprendre.css';

const LOCAL_PUZZLES = parsePuzzles(ALL_PUZZLES);
const SOLVED_KEY = 'go.problemes.v1';

type Load = { status: 'loading' } | { status: 'ready'; source: 'base' | 'copie'; error?: string };

interface Props {
  db: Db | null; userId: string | undefined; sessionLoading: boolean; confirmTouch: boolean;
  /** Mène à l'onglet Profil pour se connecter. */
  onCompte?: () => void;
  /** Numéro demandé par un lien partagé `?go-du-jour=N` : ouvre directement le Go du jour (issue #75). */
  lien?: number | null;
  /** Prévient quand le Go du jour est ouvert : la fenêtre de consentement attend, comme pendant une partie. */
  onDuJour?: (ouvert: boolean) => void;
}

/** Flamme de la série de jours, en or. */
function Flamme({ taille = 22 }: { taille?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={taille} height={taille} aria-hidden="true" focusable="false">
      <path d="M8.6 1.2c.4 2.3 3.9 3.9 3.9 7.9A4.5 4.5 0 0 1 8 13.8a4.5 4.5 0 0 1-4.5-4.6c0-2 1-3.2 2-4 0 1.4.6 2.4 1.5 2.7C6.6 5.6 7.4 3 8.6 1.2Z" fill="currentColor" />
    </svg>
  );
}

/** Difficulté : trois petites pierres, pleines selon le niveau, et le mot. */
function Difficulte({ d }: { d: number }) {
  const n = niveau(d);
  return (
    <span className="difficulte">
      <span className="crans" aria-hidden="true">{[1, 2, 3].map(i => <i key={i} className={i <= n.crans ? 'plein' : undefined} />)}</span>
      {n.mot}
    </span>
  );
}

/** Onglet Problèmes : problème du jour, problèmes de base, cote problèmes et série de jours. */
export function Puzzles({ db, userId, sessionLoading, confirmTouch, onCompte, lien = null, onDuJour }: Props) {
  // Go du jour (issue #75) : le même pour tous, choisi dans la liste publique des problèmes de base, en heure de Paris.
  const [numero] = useState(() => numeroDuJour(new Date()));
  const daily = problemeDuNumero(LOCAL_PUZZLES, numero);
  const [serieDuJour, setSerieDuJour] = useState<Serie | null>(() => readLocal<Serie | null>(SERIE_KEY, null));
  const online = useOnline();
  const [list, setList] = useState<Puzzle[]>(LOCAL_PUZZLES);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [stats, setStats] = useState<PuzzleStats | null>(null);
  const [statsError, setStatsError] = useState('');
  const [localSolved, setLocalSolved] = useState<Record<string, true>>(() => readLocal(SOLVED_KEY, {}));
  const [openId, setOpenId] = useState<string | null>(() => (lien !== null && daily ? daily.id : null));
  // Lien d'un autre jour : on ouvre celui d'aujourd'hui, et on le dit.
  const [defiChange] = useState(() => lien !== null && lien !== numero);
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
  const markSolved = useCallback((id: string) => {
    setLocalSolved(prev => { const next = { ...prev, [id]: true as const }; writeLocal(SOLVED_KEY, next); return next; });
  }, []);

  const open = list.find(p => p.id === openId) ?? (daily && openId === daily.id ? daily : undefined);
  const duJourOuvert = !!open && open.id === daily?.id;
  useEffect(() => {
    onDuJour?.(duJourOuvert);
  }, [duJourOuvert, onDuJour]);
  useEffect(() => () => onDuJour?.(false), [onDuJour]);

  if (open) {
    const nextPz = suivant(list, open, solved);
    const estDuJour = open.id === daily?.id;
    return (
      <PuzzlePlayer key={open.id} puzzle={open} rang={list.indexOf(open) + 1} confirmTouch={confirmTouch}
        duJour={estDuJour ? { numero, serie: serieVivante(serieDuJour, numero), defiChange } : undefined}
        rated={!!db && !!userId && online && !!stats && !stats.attempted.includes(open.id) && !solved.has(open.id)}
        rating={stats?.rating}
        onAttempt={async ok => {
          if (!db || !userId) return null;
          const r = await recordPuzzleAttempt(db, open.id, ok);
          if (r.ok) setStats(s => s && { ...s, rating: r.value, attempted: [...s.attempted, open.id], solved: ok ? [...s.solved, open.id] : s.solved, streak: ok ? Math.max(1, s.streak) : s.streak });
          if (r.ok && ok) setStatsTick(n => n + 1); // relit la série calculée par le serveur
          return r;
        }}
        onSolved={essais => {
          if (!solved.has(open.id)) track(EVENTS.problemeResolu, { probleme: open.id, du_jour: estDuJour });
          if (estDuJour && serieDuJour?.dernier !== numero) {
            const s = serieApres(serieDuJour, numero);
            writeLocal(SERIE_KEY, s); setSerieDuJour(s);
            track(EVENTS.goDuJourResolu, { numero, essais, serie: s.jours, arrivee_par_lien: lien !== null });
          }
          markSolved(open.id);
        }}
        onNext={nextPz ? () => { setOpenId(nextPz.id); window.scrollTo({ top: 0 }); } : undefined}
        onExit={() => setOpenId(null)} />
    );
  }

  if (load.status === 'loading') {
    return (
      <div className="problemes-chargement" aria-busy="true" role="status">
        <Reflexion taille={32} />
        <span>Chargement des problèmes…</span>
      </div>
    );
  }

  const connecte = !!db && !!userId;
  return (
    <div className="problemes">
      {load.error === 'offline' && <p className="notice" role="status">Tu es hors ligne. Les problèmes restent jouables, mais ta cote ne bouge pas.</p>}
      {load.error && load.error !== 'offline' && (
        <p className="notice" role="alert">{load.error} On t’affiche ceux de ce téléphone. <button className="lien" onClick={() => setRetry(n => n + 1)}>Réessayer</button></p>
      )}

      {connecte && stats ? (
        <div className="palmares">
          <div>
            <span className="chiffre">{stats.rating}</span>
            <span className="legende">ta cote problèmes</span>
          </div>
          <div className="palmares-serie">
            <span className="chiffre"><Flamme taille={30} />{stats.streak}</span>
            <span className="legende">{legendeSerie(stats.streak)}</span>
          </div>
        </div>
      ) : connecte && statsError ? (
        <p className="notice" role="alert">{statsError} <button className="lien" onClick={() => setRetry(n => n + 1)}>Réessayer</button></p>
      ) : connecte && online ? (
        <div className="palmares" aria-busy="true"><span className="sr-only">Chargement de ta cote…</span><div><span className="chiffre attente" /><span className="legende">ta cote problèmes</span></div></div>
      ) : !connecte ? (
        <div className="invitation">
          <p>{fr('Connecte-toi pour avoir ta ')}<b>cote</b>{fr(' : elle mesure ton niveau et monte quand tu réussis.')}</p>
          {onCompte && <button className="lien" onClick={onCompte}>Me connecter</button>}
        </div>
      ) : null}

      {daily && (
        <section aria-labelledby="jour-titre">
          <h2 id="jour-titre" className="titre-pierres">Go du jour <span className="numero-du-jour">n°&nbsp;{numero}</span></h2>
          <p className="muted small bases-aide">Le même défi pour tout le monde, aujourd’hui.</p>
          <DuJour pz={daily} reussi={serieDuJour?.dernier === numero} onOpen={() => setOpenId(daily.id)} />
        </section>
      )}

      <section aria-labelledby="bases-titre">
        <h2 id="bases-titre" className="titre-pierres">Les bases</h2>
        <p className="muted small bases-aide">{fr('Une pierre est en ')}<b>atari</b>{fr(' quand il ne lui reste qu’une liberté : elle peut être prise au prochain coup.')}</p>
        <ul className="grille-pb">
          {list.map((p, i) => {
            const ok = solved.has(p.id);
            return (
              <li key={p.id}>
                <button className={ok ? 'reussi' : undefined} onClick={() => setOpenId(p.id)} aria-label={`Problème ${i + 1} : ${p.title}${ok ? ', réussi' : ''}`}>
                  <span className="grille-goban">
                    <MiniGoban rows={p.rows} />
                    {ok && <span className="pastille-ok" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M4 8.4 6.8 11 12 5.4" /></svg></span>}
                  </span>
                  <b aria-hidden="true">{p.title}</b>
                  <span aria-hidden="true"><Difficulte d={p.difficulty} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** Problème du jour : la vraie position sur le goban, recadrée sur les pierres, et le bouton « Résoudre » en relief. */
function DuJour({ pz, reussi, onOpen }: { pz: Puzzle; reussi: boolean; onOpen: () => void }) {
  const start = useMemo(() => startOf(pz), [pz]);
  const vb = viewBoxOf(pz.size);
  // Hauteur du centre des pierres, en fraction de la largeur de l'image du goban (qui est carrée).
  const f = (M + centreVertical(pz.rows) * C - vb.min) / vb.span;
  return (
    <div className={`du-jour${reussi ? ' reussi' : ''}`}>
      <div className="du-jour-plateau" aria-hidden="true" onClick={onOpen} style={{ '--f': f } as CSSProperties}>
        <div className="du-jour-cadre"><Board size={pz.size} board={start.pos.board} marks={{ targets: start.marked }} /></div>
        {reussi && <span className="tampon-reussi">Réussi</span>}
      </div>
      <div className="du-jour-corps">
        <h3>{pz.title}</h3>
        <p><Difficulte d={pz.difficulty} /> <span className="muted">{pz.toPlay === 1 ? 'Noir joue' : 'Blanc joue'}</span></p>
        <button className="cta" aria-label={reussi ? 'Refaire le Go du jour' : 'Résoudre le Go du jour'} onClick={onOpen}>{reussi ? 'Refaire' : 'Résoudre'}</button>
      </div>
    </div>
  );
}

type Answer = { kind: 'ok' | 'wrong' | 'illegal'; p: number; text: string; n: number };

/** Bouton « Partager » du Go du jour : Web Share API, sinon copie dans le presse-papiers. Texte sans la réponse. */
function Partager({ numero, essais, serie }: { numero: number; essais: number; serie: number }) {
  const [etat, setEtat] = useState<'' | 'copie' | 'erreur'>('');
  const p = textePartage(numero, essais, serie);
  async function partager() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: p.texte, url: p.url });
        track(EVENTS.goDuJourPartage, { numero, essais, methode: 'partage' });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return; // le joueur a fermé la feuille de partage
      }
    }
    try {
      await navigator.clipboard.writeText(p.complet);
      setEtat('copie');
      track(EVENTS.goDuJourPartage, { numero, essais, methode: 'copie' });
    } catch {
      setEtat('erreur');
    }
  }
  return (
    <>
      <button className="cta partager" onClick={partager}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
        Partager
      </button>
      <p className="partage-etat" role="status" aria-live="polite">
        {etat === 'copie' ? 'Copié !' : etat === 'erreur' ? <>Copie impossible. Envoie ce lien&nbsp;: <span className="partage-lien">{p.url}</span></> : null}
      </p>
    </>
  );
}

interface DuJourInfo { numero: number; serie: number; defiChange: boolean }

function PuzzlePlayer({ puzzle, rang, duJour, confirmTouch, rated, rating, onAttempt, onSolved, onNext, onExit }: {
  puzzle: Puzzle; rang: number; duJour?: DuJourInfo; confirmTouch: boolean; rated: boolean; rating?: number;
  onAttempt: (ok: boolean) => Promise<{ ok: true; value: number } | { ok: false; error: string } | null>;
  onSolved: (essais: number) => void; onNext?: () => void; onExit: () => void;
}) {
  const start = useMemo(() => startOf(puzzle), [puzzle]);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [board, setBoard] = useState(start.pos.board);
  const [tries, setTries] = useState(0);
  const [cote, setCote] = useState<{ de: number; a: number } | { erreur: string } | null>(null);
  const [replay, setReplay] = useState<{ frame: number; total: number } | null>(null);
  const [shake, setShake] = useState<{ p: number; n: number } | null>(null);
  const firstTry = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const solvedNow = answer?.kind === 'ok';

  async function onPlay(p: number) {
    if (solvedNow || replay) return;
    const r = checkAnswer(puzzle, p);
    const n = (answer?.n ?? 0) + 1;
    if (r.kind === 'illegal') {
      playIllegal(); hapticIllegal(); setShake({ p, n });
      setAnswer({ kind: 'illegal', p, text: ILLEGAL_TEXT[r.reason], n });
      return;
    }
    const ok = r.kind === 'ok';
    playStone(p, puzzle.size); hapticStone();
    if (ok) playSuccess(); else playFail();
    setTries(tries + 1);
    setAnswer({ kind: r.kind, p, text: ok ? (puzzle.explanation ?? 'Bravo, c’est le bon coup !') : (puzzle.refutation ?? 'Pas tout à fait. Essaie encore.'), n });
    setBoard(ok ? r.after.board : start.pos.board);
    if (ok) onSolved(tries + 1);
    // Seul le premier essai compte pour la cote.
    if (firstTry.current && rated) {
      firstTry.current = false;
      const res = await onAttempt(ok);
      if (res && res.ok) setCote({ de: rating ?? res.value, a: res.value });
      else if (res) setCote({ erreur: res.error });
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
  function reessayer() {
    window.clearTimeout(timer.current);
    setReplay(null); setBoard(start.pos.board); setAnswer(null);
  }

  const frames = replay ? solutionFrames(puzzle) : null;
  const lastMove = replay && frames ? frames[replay.frame].lastMove : solvedNow ? answer.p : null;
  const replayDone = !!replay && replay.frame === replay.total;

  const ligneCote = cote && ('erreur' in cote
    ? <p className="verdict-cote">{cote.erreur}</p>
    : <p className="verdict-cote">Ta cote : <b><Defile de={cote.de} a={cote.a} /></b>{cote.a !== cote.de && <span className={cote.a > cote.de ? 'monte' : 'baisse'}> {ecart(cote.de, cote.a)}</span>}</p>);
  const suivantBtn = <button className="cta" onClick={onNext ?? onExit}>{onNext ? 'Problème suivant' : 'Retour aux problèmes'}</button>;

  let verdict = null;
  if (replay) {
    verdict = (
      <Verdict ton="neutre" actions={solvedNow
        ? <>{suivantBtn}<button className="lien" onClick={showLine} disabled={!replayDone}>Revoir la suite</button></>
        : <div className="row"><button className="btn" onClick={showLine} disabled={!replayDone}>Revoir la suite</button><button className="btn" onClick={reessayer}>Réessayer</button></div>}>
        <p>{replayDone ? 'Voilà la suite. Le coup marqué est la réponse.' : `Coup ${replay.frame} sur ${replay.total}…`}</p>
      </Verdict>
    );
  } else if (answer) {
    verdict = solvedNow ? (
      <Verdict ton="juste" cle={answer.n} actions={duJour
        // Go du jour réussi : « Partager » est l'action principale, en relief ; la suite reste à portée, en lien.
        ? <>
            <Partager numero={duJour.numero} essais={tries} serie={duJour.serie} />
            <div className="row liens-du-jour">
              <button className="lien" onClick={showLine}>Voir la suite</button>
              <button className="lien" onClick={onNext ?? onExit}>{onNext ? 'Problème suivant' : 'Retour aux problèmes'}</button>
            </div>
          </>
        : <>{suivantBtn}<button className="lien" onClick={showLine}>Voir la suite</button></>}>
        <p>{fr(answer.text)}</p>{ligneCote}
      </Verdict>
    ) : (
      <Verdict ton="revoir" cle={answer.n} actions={
        <div className="row">
          {tries >= 1 && <button className="btn" onClick={showLine}>Voir la suite</button>}
          <button className="btn" onClick={() => setAnswer(null)}>Réessayer</button>
        </div>}>
        <p>{fr(answer.text)}</p>{ligneCote}
      </Verdict>
    );
  }

  return (
    <div className="lecteur">
      <div className="lecteur-tete">
        <Retour label="Retour aux problèmes" onClick={onExit} />
        <div className="lecteur-nom">
          {duJour
            ? <small className="entete-du-jour">Go du jour <b className="numero-du-jour">n°&nbsp;{duJour.numero}</b></small>
            : <small>{`Problème ${rang}`}</small>}
          <h2>{puzzle.title}</h2>
        </div>
        <Difficulte d={puzzle.difficulty} />
      </div>
      {duJour?.defiChange && <p className="notice" role="status">{fr('Le défi a changé : voici celui d’aujourd’hui.')}</p>}
      <Bubble>{fr(`${puzzle.prompt} Tu joues ${puzzle.toPlay === 1 ? 'Noir' : 'Blanc'}.`)}</Bubble>
      <Board size={puzzle.size} board={board} toPlay={puzzle.toPlay} interactive={!solvedNow && !replay} confirmTouch={confirmTouch} onPlay={onPlay} shake={shake}
        marks={{ targets: start.marked, last: lastMove, ok: solvedNow && !replay ? answer.p : undefined, mistake: answer && answer.kind === 'wrong' && !replay ? answer.p : undefined }} />
      {verdict}
    </div>
  );
}
