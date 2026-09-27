import { neighbors, type Position } from './rules';

export type Rules = 'japanese' | 'chinese';

export interface Score {
  black: number;
  white: number;
  territory: [number, number, number];
  owner: Int8Array; // propriétaire de chaque intersection vide (0 neutre)
  winner: 1 | 2;
  margin: number;
}

/** Compte la position. `dead` marque les pierres mortes retirées avant le comptage. */
export function score(pos: Position, komi: number, rules: Rules, dead: Set<number> = new Set()): Score {
  const { size } = pos, nb = neighbors(size);
  const board = pos.board.slice();
  const prisoners: [number, number, number] = [0, pos.captures[1], pos.captures[2]];
  const stones: [number, number, number] = [0, 0, 0];
  for (let p = 0; p < board.length; p++) {
    if (board[p] && dead.has(p)) { prisoners[3 - board[p]] += 1; board[p] = 0; }
    else if (board[p]) stones[board[p]] += 1;
  }
  const owner = new Int8Array(board.length), seen = new Uint8Array(board.length);
  const territory: [number, number, number] = [0, 0, 0];
  for (let p = 0; p < board.length; p++) {
    if (board[p] || seen[p]) continue;
    const region: number[] = [], stack = [p];
    let border = 0;
    seen[p] = 1;
    while (stack.length) {
      const q = stack.pop()!;
      region.push(q);
      for (const r of nb[q]) {
        if (board[r] === 0) { if (!seen[r]) { seen[r] = 1; stack.push(r); } }
        else border |= board[r];
      }
    }
    if (border === 1 || border === 2) {
      territory[border] += region.length;
      for (const q of region) owner[q] = border;
    }
  }
  const black = rules === 'japanese' ? territory[1] + prisoners[1] : territory[1] + stones[1];
  const white = (rules === 'japanese' ? territory[2] + prisoners[2] : territory[2] + stones[2]) + komi;
  const winner = black > white ? 1 : 2;
  return { black, white, territory, owner, winner, margin: Math.abs(black - white) };
}
