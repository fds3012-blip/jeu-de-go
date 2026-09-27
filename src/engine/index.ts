// API du moteur pour les écrans et les autres modules :
// - bestMove(position, niveau) : coup de l'adversaire (index y * N + x, -1 = passe) ;
// - analyze(position, options) : coups candidats, taux de victoire, avance, propriété ;
// - ownership(position) : carte de propriété de -1 (Blanc) à +1 (Noir) (KataGo, sinon simulations) ;
// - proposeDead(position) : pierres mortes proposées en fin de partie (deadStones en version synchrone).
// Pomme et Caillou utilisent le moteur simple (Monte-Carlo). Les 7 autres niveaux utilisent KataGo
// dans un Web Worker ; s'il ne démarre pas (pas de Worker, pas de backend, réseau introuvable),
// ils se replient sur le moteur simple, sans rien casser.
import { chooseMove, isLegalMove, OPPONENTS, opponent, type EngineOptions, type KataGoLevel, type Opponent, type OpponentId, type Style } from './simple';
import { deadStones, ownership as ownershipSimple, type DeadOptions } from './dead';
import type { Position } from '../go/rules';
import type { Demande, Reponse, Tache } from './simple.worker';
import { KataGoClient, type KataGoInfo } from './katago/client';
import { chooseFromAnalysis } from './katago/choose';
import { CACHE_NAME, DEFAULT_MODEL_URL } from './katago/loader';
import type { Analysis, AnalyzeOptions, MoveInfo } from './katago/search';

export { OPPONENTS, opponent, chooseMove, deadStones, ownershipSimple };
export type { Opponent, OpponentId, EngineOptions, DeadOptions, KataGoLevel, Style, Analysis, AnalyzeOptions, MoveInfo, KataGoInfo };

// ---------- Moteur simple dans son Worker ----------
// Deux Workers indépendants : l'un pour les coups et les pierres mortes, l'autre pour l'estimation d'avantage
// affichée pendant la partie, pour que l'estimation ne retarde jamais la réponse de l'adversaire.
let nextId = 1;
function canal() {
  let worker: Worker | null = null, broken = false;
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
  /** Envoie une demande au Worker ; `null` s'il est indisponible. */
  return (d: Tache): Promise<Reponse> | null => {
    const w = getWorker();
    if (!w) return null;
    const id = nextId++;
    return new Promise<Reponse>(resolve => { pending.set(id, resolve); w.postMessage({ ...d, id } satisfies Demande); });
  };
}
const ask = canal();
const askEstimation = canal();

function later<T>(f: () => T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(f()), 0));
}

async function simpleMove(pos: Position, lvl: Opponent, opts: EngineOptions): Promise<number> {
  const sync = () => later(() => chooseMove(pos, lvl, opts));
  // Le Worker simple ne connaît que les identifiants : on lui passe les réglages du niveau en options.
  const niveau: OpponentId = lvl.katago ? 'caillou' : lvl.id;
  const q = ask({ kind: 'move', pos, niveau, opts: { timeMs: lvl.timeMs, playouts: lvl.playouts, ...opts } });
  if (!q) return sync();
  const r = await q;
  return Number.isNaN(r.move) ? sync() : r.move;
}

/** Pierres mortes proposées à l'entrée du comptage, calculées sans bloquer l'interface. */
export async function proposeDead(pos: Position): Promise<number[]> {
  const q = ask({ kind: 'dead', pos });
  const r = q && (await q);
  return r?.dead ?? later(() => deadStones(pos));
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

/** Remplace le moteur KataGo (tests) ; `null` = KataGo absent, `undefined` = réglage par défaut. */
export function setKataGo(k: KataGoBackend | null | undefined) { katago = k; }

/** État de KataGo (chargement, backend choisi, erreur). */
export function kataGoInfo(): KataGoInfo { return getKataGo()?.info ?? { state: 'indisponible', error: 'Web Workers indisponibles' }; }

/** Démarre le chargement de KataGo en avance (téléchargement du réseau, choix du backend). */
export function preloadKataGo(): void { getKataGo()?.start?.().catch(() => {}); }

/** Analyse de secours sans réseau : coup du moteur simple et propriété tirée des simulations. */
async function simpleAnalysis(pos: Position, o: AnalyzeOptions): Promise<Analysis> {
  const t0 = Date.now(), komi = o.komi ?? 6.5;
  const move = await simpleMove(pos, opponent('caillou'), { komi, timeMs: Math.min(o.timeMs ?? 600, 600) });
  const own = await later(() => ownershipSimple(pos, { timeMs: 150 }));
  let black = -komi;
  for (const v of own) black += v;
  const lead = pos.toPlay === 1 ? black : -black, winrate = lead > 0 ? 0.6 : 0.4;
  return { moves: [{ move, visits: 1, prior: 1, winrate, lead, scoreLoss: 0 }], winrate, lead, ownership: own, visits: 1, ms: Date.now() - t0, engine: 'simple' };
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

/**
 * Avance estimée de Noir, en points (komi compris), pour la barre d'avantage de l'écran de partie.
 * KataGo s'il est déjà chargé (on ne télécharge pas le réseau pour ça), sinon la propriété du moteur simple,
 * calculée dans un Worker dédié. `null` si aucune estimation n'est possible sans bloquer l'interface.
 */
export async function estimateLead(pos: Position, komi: number, opts: { kataGo?: boolean } = {}): Promise<{ lead: number; engine: 'katago' | 'simple' } | null> {
  // `kataGo: false` : KataGo est occupé à chercher le coup de l'adversaire, on ne le ralentit pas.
  const k = opts.kataGo === false ? null : katago ?? null;
  if (k && k.info.state === 'pret') {
    try {
      const a = await k.analyze(pos, { komi, visits: 16, timeMs: 600 });
      return { lead: pos.toPlay === 1 ? a.lead : -a.lead, engine: 'katago' };
    } catch { /* repli ci-dessous */ }
  }
  const q = askEstimation({ kind: 'own', pos, timeMs: pos.size <= 9 ? 150 : 400 });
  const r = q && (await q);
  if (!r?.own) return null;
  let black = -komi;
  for (const v of r.own) black += v;
  return { lead: black, engine: 'simple' };
}

/** Vrai si le réseau KataGo est déjà dans le cache du navigateur (Cache API) : le charger ne télécharge rien. */
export async function reseauEnCache(): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false;
    const url = new URL(modelUrl(), typeof location !== 'undefined' ? location.href : 'http://localhost/').href;
    return !!(await (await caches.open(CACHE_NAME)).match(url));
  } catch { return false; }
}

/**
 * Conseil de KataGo pour la revue d'une partie (issue #34). Jamais le moteur simple : ses conseils sont trop peu sûrs
 * pour un débutant. KataGo est chargé seulement s'il l'est déjà ou si son réseau est en cache (aucun téléchargement).
 * `katago: false` : pas de conseil possible. Sinon `move` (-1 : passer, `null` : aucun) et `lead`, l'avance
 * en points pour le joueur au trait après ce coup.
 */
export type Conseil = { katago: false } | { katago: true; move: number | null; lead: number };
export async function meilleurCoup(pos: Position, komi: number): Promise<Conseil> {
  let k = katago ?? null;
  if ((!k || k.info.state !== 'pret') && (await reseauEnCache())) {
    k = getKataGo();
    try { await k?.start?.(); } catch { /* KataGo indisponible */ }
  }
  if (!k || k.info.state !== 'pret') return { katago: false };
  try {
    const a = await k.analyze(pos, { komi, visits: 48, timeMs: 1200 });
    const b = a.moves[0];
    return b ? { katago: true, move: b.move, lead: b.lead } : { katago: true, move: null, lead: a.lead };
  } catch { return { katago: false }; }
}
