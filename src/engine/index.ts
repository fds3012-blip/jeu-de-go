// API du moteur pour les écrans : bestMove(position, niveau) renvoie un coup (index y * N + x, -1 = passe).
// Le calcul tourne dans un Web Worker ; repli synchrone si les Workers sont indisponibles (tests, vieux navigateurs).
import { chooseMove, isLegalMove, OPPONENTS, opponent, type EngineOptions, type Opponent, type OpponentId } from './simple';
import type { Position } from '../go/rules';
import type { Demande, Reponse } from './simple.worker';

export { OPPONENTS, opponent, chooseMove };
export type { Opponent, OpponentId, EngineOptions };

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

function sync(pos: Position, niveau: OpponentId, opts: EngineOptions): Promise<number> {
  return new Promise(resolve => setTimeout(() => resolve(chooseMove(pos, niveau, opts)), 0));
}

export async function bestMove(pos: Position, niveau: OpponentId, opts: EngineOptions = {}): Promise<number> {
  const w = getWorker();
  let move: number;
  if (!w) move = await sync(pos, niveau, opts);
  else {
    const id = nextId++;
    const r = await new Promise<Reponse>(resolve => { pending.set(id, resolve); w.postMessage({ id, pos, niveau, opts } satisfies Demande); });
    move = Number.isNaN(r.move) ? await sync(pos, niveau, opts) : r.move;
  }
  // Garde-fou : un coup illégal devient une passe.
  return isLegalMove(pos, move) ? move : -1;
}
