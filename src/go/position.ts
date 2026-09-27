import { newPosition, type Position } from './rules';

/** Construit une position à partir d'un schéma texte (X noir, O blanc, T et S pour les pierres marquées). */
export function fromRows(rows: string[], toPlay: 1 | 2 = 1): { pos: Position; marked: number[] } {
  const size = rows.length, pos = newPosition(size), marked: number[] = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const p = y * size + x;
    if (ch === 'X' || ch === 'S') pos.board[p] = 1;
    if (ch === 'O' || ch === 'T') pos.board[p] = 2;
    if (ch === 'T' || ch === 'S') marked.push(p);
  }));
  pos.toPlay = toPlay;
  return { pos, marked };
}
