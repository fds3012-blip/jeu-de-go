// Outils du lot E (issue #91) : objectif de capture prouvé par `lecteurs-lot-a`, et recherche des doublons
// à une symétrie près (les 8 symétries du plateau : rotations et miroirs).
import { groupAt, play, type Position } from './rules';
import { toLabel } from './coords';
import { whiteFails } from './lecteurs-lot-a';

/** Les 8 images d'un schéma carré par rotation et miroir. */
export function symmetries(rows: string[]): string[][] {
  const n = rows.length, out: string[][] = [];
  const cell = (x: number, y: number) => rows[y][x];
  const maps: ((x: number, y: number) => [number, number])[] = [
    (x, y) => [x, y], (x, y) => [n - 1 - x, y], (x, y) => [x, n - 1 - y], (x, y) => [n - 1 - x, n - 1 - y],
    (x, y) => [y, x], (x, y) => [n - 1 - y, x], (x, y) => [y, n - 1 - x], (x, y) => [n - 1 - y, n - 1 - x]
  ];
  for (const f of maps) {
    out.push(Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => { const [a, b] = f(x, y); return cell(a, b); }).join('')));
  }
  return out;
}

/** Clé d'une position qui ignore les marques (T et S) : deux problèmes sur la même position sont des doublons. */
export const plainKey = (rows: string[]) => rows.map(r => r.replace(/T/g, 'O').replace(/S/g, 'X')).join('/');

/**
 * Tous les premiers coups noirs légaux (libellés triés) qui capturent une cible en au plus `k` coups noirs,
 * quelle que soit la défense de Blanc. Avec `atari`, le premier coup doit en plus mettre une cible en atari.
 */
export function captureWinners(pos: Position, targets: number[], k: number, atari = false): string[] {
  const out: string[] = [];
  for (let m = 0; m < pos.board.length; m++) {
    const r = play(pos, m);
    if (typeof r === 'string') continue;
    if (atari && targets.every(t => r.board[t] === 2 && groupAt(r.board, r.size, t).liberties.size !== 1)) continue;
    if (whiteFails(r, targets, k - 1)) out.push(toLabel(m, pos.size));
  }
  return out.sort();
}
