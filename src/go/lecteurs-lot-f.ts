// Lecteurs du lot F (issue #91) : ceux du lot D, plus une forme canonique pour repérer les doublons.
import { groupAt, play, type Position } from './rules';
import { captureWorks } from './tactics';
import { legalMoves } from './lecteurs-lot-d';
export { captureAfter, legalMoves, saveAfter, winningMoves } from './lecteurs-lot-d';

/** Aucune des pierres `stones` (noires) ne peut être capturée par Blanc au trait. */
const allSafe = (pos: Position, stones: number[], depth: number) =>
  stones.every(s => pos.board[s] === 1 && !captureWorks(pos, s, depth));

/**
 * Relier : après le coup noir `m`, contre toute réponse légale de Blanc, Noir a un coup qui met toutes les pierres
 * `stones` hors de portée du lecteur de capture. Contrairement à `saveAfter`, pierre par pierre, ce lecteur voit
 * la coupe qui menace deux groupes à la fois (double atari).
 */
export function saveAllAfter(pos: Position, m: number, stones: number[], depth = 8): boolean {
  if (m === -1) return false;
  const r = play(pos, m);
  if (typeof r === 'string') return false;
  return legalMoves(r).every(w => {
    const x = play(r, w) as Position;
    if (stones.some(s => x.board[s] !== 1)) return false;
    const cand = new Set<number>([-1]);
    for (const s of stones) for (const l of groupAt(x.board, x.size, s).liberties) cand.add(l);
    for (let p = 0; p < x.board.length; p++) if (x.board[p] === 2 && groupAt(x.board, x.size, p).liberties.size === 1) {
      for (const l of groupAt(x.board, x.size, p).liberties) cand.add(l);
    }
    return [...cand].some(b => { const y = play(x, b); return typeof y !== 'string' && allSafe(y, stones, depth); });
  });
}

/** Les 8 symétries du plateau (rotations et miroirs) d'un schéma de lignes. */
export function symmetries(rows: string[]): string[][] {
  const n = rows.length, at = (x: number, y: number) => rows[y][x];
  const maps: ((x: number, y: number) => string)[] = [
    (x, y) => at(x, y), (x, y) => at(n - 1 - x, y), (x, y) => at(x, n - 1 - y), (x, y) => at(n - 1 - x, n - 1 - y),
    (x, y) => at(y, x), (x, y) => at(n - 1 - y, x), (x, y) => at(y, n - 1 - x), (x, y) => at(n - 1 - y, n - 1 - x)
  ];
  return maps.map(f => Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => f(x, y)).join('')));
}

/** Forme canonique d'une position : la plus petite de ses 8 symétries, marques comprises. */
export const canonical = (rows: string[]) => symmetries(rows).map(r => r.join('/')).sort()[0];
