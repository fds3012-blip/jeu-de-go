// Lecteurs du lot F (issue #91) : ceux du lot D, plus une forme canonique pour repérer les doublons.
export { captureAfter, legalMoves, saveAfter, winningMoves } from './lecteurs-lot-d';

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
