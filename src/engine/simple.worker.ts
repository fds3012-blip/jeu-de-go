// Web Worker : fait réfléchir le moteur simple sans bloquer l'interface (coup à jouer, pierres mortes, propriété).
import { chooseMoveDetail, opponent, type EngineOptions, type OpponentId, type Raison } from './simple';
import { comptageAuto, ownership } from './dead';
import type { Position } from '../go/rules';

export type Tache = { kind: 'move'; pos: Position; niveau: OpponentId; opts: EngineOptions; hasard?: number } | { kind: 'dead'; pos: Position } | { kind: 'own'; pos: Position; timeMs?: number };
export type Demande = Tache & { id: number };
export interface Reponse { id: number; move: number; raison?: Raison | null; dead?: number[]; incertains?: number[]; own?: Float32Array; error?: string }

self.onmessage = (e: MessageEvent<Demande>) => {
  const d = e.data;
  try {
    const r: Reponse = d.kind === 'dead' ? { id: d.id, move: -1, ...comptageAuto(d.pos) }
      : d.kind === 'own' ? { id: d.id, move: -1, own: ownership(d.pos, { timeMs: d.timeMs, estimation: true }) }
      : { id: d.id, ...chooseMoveDetail(d.pos, d.hasard === undefined ? d.niveau : { ...opponent(d.niveau), hasard: d.hasard }, d.opts) };
    (self as unknown as Worker).postMessage(r);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: d.id, move: -1, error: String(err) } satisfies Reponse);
  }
};
