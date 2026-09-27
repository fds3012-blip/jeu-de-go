// API du moteur pour les écrans et les autres modules :
// - bestMove(position, niveau) : coup de l'adversaire (index y * N + x, -1 = passe) ;
// - analyze(position, options) : coups candidats, taux de victoire, avance, propriété ;
// - ownership(position) : carte de propriété de -1 (Blanc) à +1 (Noir).
// Pomme et Caillou utilisent le moteur simple (Monte-Carlo). Les 7 autres niveaux utilisent KataGo
// dans un Web Worker ; s'il ne démarre pas (pas de Worker, pas de backend, réseau introuvable),
// ils se replient sur le moteur simple, sans rien casser.
import { chooseMove, isLegalMove, OPPONENTS, opponent, type EngineOptions, type KataGoLevel, type Opponent, type OpponentId, type Style } from './simple';
import type { Position } from '../go/rules';
import { score } from '../go/score';
import type { Demande, Reponse } from './simple.worker';
import { KataGoClient, type KataGoInfo } from './katago/client';
import { chooseFromAnalysis } from './katago/choose';
import { DEFAULT_MODEL_URL } from './katago/loader';
import type { Analysis, AnalyzeOptions, MoveInfo } from './katago/search';

export { OPPONENTS, opponent, chooseMove };
export type { Opponent, OpponentId, EngineOptions, KataGoLevel, Style, Analysis, AnalyzeOptions, MoveInfo, KataGoInfo };

// ---------- Moteur simple dans son Worker ----------
let worker: Worker | null = null, broken = false, nextId = 1;
const pending = new Map<number, (r: Reponse) => void>();

function getWorker(): Worker | null {
  if (broken || typeof Worker === 'undefined') return null;
  if (!worker) {
    try {
      worker = new Worker(new URL('./simple.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<Reponse>) => { pending.get(e.data.id)?.(e.data); pending.delete(e.data.id); };
      worker.onerror = () => { broken = true; worker?.terminate(); worker = null; for (const [id, cb] of pending) cb({ id, move: Number.NaN, error: 'worker' }); pending.clear(); };
    } catch { broken = true; return null; }
  }
  return worker;
}

function sync(pos: Position, niveau: Opponent, opts: EngineOptions): Promise<number> {
  return new Promise(resolve => setTimeout(() => resolve(chooseMove(pos, niveau, opts)), 0));
}

async function simpleMove(pos: Position, lvl: Opponent, opts: EngineOptions): Promise<number> {
  const w = getWorker();
  if (!w) return sync(pos, lvl, opts);
  // Le Worker simple ne connaît que les identifiants : on lui passe les réglages du niveau en options.
  const o: EngineOptions = { timeMs: lvl.timeMs, playouts: lvl.playouts, ...opts };
  const niveau: OpponentId = lvl.heuristiques ? 'caillou' : 'pomme';
  const id = nextId++;
  const r = await new Promise<Reponse>(resolve => { pending.set(id, resolve); w.postMessage({ id, pos, niveau, opts: o } satisfies Demande); });
  return Number.isNaN(r.move) ? sync(pos, lvl, opts) : r.move;
}

// ---------- KataGo ----------
/** Ce qu'il faut pour analyser avec KataGo ; remplaçable dans les tests. */
export interface KataGoBackend { analyze(pos: Position, opts: AnalyzeOptions): Promise<Analysis>; info: KataGoInfo; start?(): Promise<void> }

let katago: KataGoBackend | null | undefined;
let warned = false;

function modelUrl(): string {
  // Écrit en toutes lettres pour que Vite remplace la variable au build.
  return (import.meta.env.VITE_KATAGO_MODEL_URL as string | undefined) || DEFAULT_MODEL_URL;
}

function getKataGo(): KataGoBackend | null {
  if (katago !== undefined) return katago;
  if (typeof Worker === 'undefined') return (katago = null);
  katago = new KataGoClient({
    url: new URL(modelUrl(), typeof location !== 'undefined' ? location.href : 'http://localhost/').href,
    makeWorker: () => new Worker(new URL('./katago/worker.ts', import.meta.url), { type: 'module' }) as never,
  });
  return katago;
}

/** Remplace le moteur KataGo (tests) ; `null` = KataGo absent. */
export function setKataGo(k: KataGoBackend | null | undefined) { katago = k; }

/** État de KataGo (chargement, backend choisi, erreur). */
export function kataGoInfo(): KataGoInfo { return getKataGo()?.info ?? { state: 'indisponible', error: 'Web Workers indisponibles' }; }

/** Démarre le chargement de KataGo en avance (téléchargement du réseau, choix du backend). */
export function preloadKataGo(): void { getKataGo()?.start?.().catch(() => {}); }

/** Analyse de secours sans réseau : coup du moteur simple et propriété tirée du comptage. */
async function simpleAnalysis(pos: Position, o: AnalyzeOptions): Promise<Analysis> {
  const t0 = Date.now(), komi = o.komi ?? 6.5;
  const move = await simpleMove(pos, opponent('caillou'), { komi, timeMs: Math.min(o.timeMs ?? 600, 600) });
  const s = score(pos, komi, o.regles ?? 'chinese'), n = pos.size * pos.size, own = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const c = pos.board[p] || s.owner[p];
    own[p] = c === 1 ? 1 : c === 2 ? -1 : 0;
  }
  const lead = (pos.toPlay === 1 ? 1 : -1) * (s.black - s.white);
  return { moves: [{ move, visits: 1, prior: 1, winrate: lead > 0 ? 0.6 : 0.4, lead, scoreLoss: 0 }], winrate: lead > 0 ? 0.6 : 0.4, lead, ownership: own, visits: 1, ms: Date.now() - t0, engine: 'simple' };
}

/** Analyse la position avec KataGo (repli : estimation du moteur simple, `engine: 'simple'`). */
export async function analyze(pos: Position, options: AnalyzeOptions = {}): Promise<Analysis> {
  const k = getKataGo();
  if (k) {
    try { return await k.analyze(pos, { visits: 64, ...options }); } catch { /* repli ci-dessous */ }
  }
  return simpleAnalysis(pos, options);
}

/** Propriété de chaque intersection, de -1 (Blanc) à +1 (Noir). */
export async function ownership(pos: Position, options: AnalyzeOptions = {}): Promise<Float32Array> {
  return (await analyze(pos, { visits: 1, ...options })).ownership;
}

/** Coup de l'adversaire `niveau` pour le joueur au trait. Ne renvoie jamais un coup illégal (sinon passe). */
export async function bestMove(pos: Position, niveau: OpponentId | Opponent, opts: EngineOptions = {}): Promise<number> {
  const lvl = typeof niveau === 'string' ? opponent(niveau) : niveau;
  let move: number | null = null;
  const k = lvl.katago ? getKataGo() : null;
  if (lvl.katago && k) {
    try {
      // Plafond de 1,8 s par coup : l'objectif est une réponse en moins de 2 s.
      const a = await k.analyze(pos, { komi: opts.komi ?? 6.5, visits: lvl.katago.visits, timeMs: opts.timeMs ?? 1800 });
      move = chooseFromAnalysis(a, pos, lvl.katago);
    } catch (e) {
      move = null;
      if (!warned) { warned = true; console.warn('KataGo indisponible, repli sur le moteur simple :', e instanceof Error ? e.message : e); }
    }
  }
  if (move === null) move = await simpleMove(pos, lvl, opts);
  // Garde-fou : un coup illégal devient une passe.
  return isLegalMove(pos, move) ? move : -1;
}
