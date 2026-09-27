// Entrées du réseau KataGo (format v7 : 22 plans NHWC et 19 valeurs globales) pour une Position du jeu.
// Logique reprise de web-katrain (featuresV7.ts, licence MIT, voir LICENSE-web-katrain), réécrite
// pour nos plateaux Int8Array (index y * N + x) et une taille quelconque. Plans d'échelles (14-16),
// de ko d'encore (7-8) et de territoire « pass-alive » (17-18) laissés à zéro.
import { groupAt, type Position } from '../../go/rules';

export type Regles = 'chinese' | 'japanese';

export interface FeatureOptions {
  komi: number;
  regles?: Regles;
  /** Derniers coups joués, du plus ancien au plus récent (index, -1 = passe). Le dernier est celui de l'adversaire. */
  history?: number[];
}

export const SPATIAL = 22, GLOBAL = 19;

export function features(pos: Position, o: FeatureOptions): { spatial: Float32Array; global: Float32Array } {
  const { size, board } = pos, n = size * size, pla = pos.toPlay;
  const spatial = new Float32Array(n * SPATIAL), global = new Float32Array(GLOBAL);
  const at = (p: number, c: number) => p * SPATIAL + c;
  const seen = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    spatial[at(p, 0)] = 1;
    const v = board[p];
    if (!v) continue;
    spatial[at(p, v === pla ? 1 : 2)] = 1;
    if (seen[p]) continue;
    const g = groupAt(board, size, p), libs = g.liberties.size;
    for (const s of g.stones) seen[s] = 1;
    if (libs >= 1 && libs <= 3) for (const s of g.stones) spatial[at(s, 2 + libs)] = 1;
  }
  // Point interdit par le ko.
  if (pos.ko >= 0) spatial[at(pos.ko, 6)] = 1;

  // Historique : 5 derniers coups, en alternance à partir de l'adversaire.
  const hist = o.history ?? (pos.lastMove !== null ? [pos.lastMove] : []);
  const planes = [9, 10, 11, 12, 13];
  for (let i = 0; i < 5 && i < hist.length; i++) {
    const m = hist[hist.length - 1 - i];
    if (m < 0) global[i] = 1;
    else spatial[at(m, planes[i])] = 1;
  }

  const selfKomi = pla === 2 ? o.komi : -o.komi;
  global[5] = selfKomi / 20;
  const regles = o.regles ?? 'chinese';
  if (regles === 'chinese') {
    // Ko positionnel (superko), suicide multiple interdit, comptage par zone.
    global[6] = 1; global[7] = 0.5;
    // Onde de parité du komi (comptage par zone).
    const even = n % 2 === 0;
    const floor = even ? Math.floor(selfKomi / 2) * 2 : Math.floor((selfKomi - 1) / 2) * 2 + 1;
    const d = Math.min(2, Math.max(0, selfKomi - floor));
    global[18] = d < 0.5 ? d : d < 1.5 ? 1 - d : d - 2;
    // Comptage par zone : passer après une passe termine la partie.
    global[14] = hist.length && hist[hist.length - 1] === -1 ? 1 : 0;
  } else {
    global[9] = 1; // comptage japonais (territoire)
    global[10] = 1; // taxe seki
  }
  return { spatial, global };
}
