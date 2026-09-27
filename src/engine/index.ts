// API du moteur pour les écrans :
// - bestMove(position, niveau) renvoie un coup (index y * N + x, -1 = passe) ;
// - proposeDead(position) renvoie les pierres mortes proposées en fin de partie (deadStones en version synchrone).
// Le calcul tourne dans un Web Worker ; repli synchrone si les Workers sont indisponibles (tests, vieux navigateurs).
import { chooseMove, isLegalMove, OPPONENTS, opponent, type EngineOptions, type Opponent, type OpponentId } from './simple';
import { deadStones, ownership, type DeadOptions } from './dead';
import type { Position } from '../go/rules';
import type { Demande, Reponse, Tache } from './simple.worker';

export { OPPONENTS, opponent, chooseMove, deadStones, ownership };
export type { Opponent, OpponentId, EngineOptions, DeadOptions };

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

function later<T>(f: () => T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(f()), 0));
}

/** Envoie une demande au Worker ; `null` s'il est indisponible. */
function ask(d: Tache): Promise<Reponse> | null {
  const w = getWorker();
  if (!w) return null;
  const id = nextId++;
  return new Promise<Reponse>(resolve => { pending.set(id, resolve); w.postMessage({ ...d, id } satisfies Demande); });
}

export async function bestMove(pos: Position, niveau: OpponentId, opts: EngineOptions = {}): Promise<number> {
  const sync = () => later(() => chooseMove(pos, niveau, opts));
  const q = ask({ kind: 'move', pos, niveau, opts });
  let move: number;
  if (!q) move = await sync();
  else {
    const r = await q;
    move = Number.isNaN(r.move) ? await sync() : r.move;
  }
  // Garde-fou : un coup illégal devient une passe.
  return isLegalMove(pos, move) ? move : -1;
}

/** Pierres mortes proposées à l'entrée du comptage, calculées sans bloquer l'interface. */
export async function proposeDead(pos: Position): Promise<number[]> {
  const q = ask({ kind: 'dead', pos });
  const r = q && (await q);
  return r?.dead ?? later(() => deadStones(pos));
}
