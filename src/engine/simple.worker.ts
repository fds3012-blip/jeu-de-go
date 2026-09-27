// Web Worker : fait réfléchir le moteur simple sans bloquer l'interface (coup à jouer, pierres mortes).
import { chooseMove, type EngineOptions, type OpponentId } from './simple';
import { deadStones } from './dead';
import type { Position } from '../go/rules';

export type Tache = { kind: 'move'; pos: Position; niveau: OpponentId; opts: EngineOptions } | { kind: 'dead'; pos: Position };
export type Demande = Tache & { id: number };
export interface Reponse { id: number; move: number; dead?: number[]; error?: string }

self.onmessage = (e: MessageEvent<Demande>) => {
  const d = e.data;
  try {
    const r: Reponse = d.kind === 'dead' ? { id: d.id, move: -1, dead: deadStones(d.pos) } : { id: d.id, move: chooseMove(d.pos, d.niveau, d.opts) };
    (self as unknown as Worker).postMessage(r);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: d.id, move: -1, error: String(err) } satisfies Reponse);
  }
};
