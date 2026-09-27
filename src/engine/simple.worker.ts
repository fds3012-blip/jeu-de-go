// Web Worker : fait réfléchir le moteur simple sans bloquer l'interface.
import { chooseMove, type EngineOptions, type OpponentId } from './simple';
import type { Position } from '../go/rules';

export interface Demande { id: number; pos: Position; niveau: OpponentId; opts: EngineOptions }
export interface Reponse { id: number; move: number; error?: string }

self.onmessage = (e: MessageEvent<Demande>) => {
  const { id, pos, niveau, opts } = e.data;
  try {
    (self as unknown as Worker).postMessage({ id, move: chooseMove(pos, niveau, opts) } satisfies Reponse);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, move: -1, error: String(err) } satisfies Reponse);
  }
};
