// Fichier généré par scripts/sync-functions.mjs depuis src/go : ne pas modifier ici.
// Règles du go : plateau, captures, suicide interdit, ko simple.
// Coordonnée interne : index y * size + x (y depuis le haut). -1 = passe.
export type Color = 1 | 2; // 1 noir, 2 blanc
export type Cell = 0 | Color;

export interface Position {
  size: number;
  board: Int8Array;
  toPlay: Color;
  ko: number; // point interdit par le ko, -1 sinon
  captures: [number, number, number]; // index 1 : prises par Noir, index 2 : prises par Blanc
  lastMove: number | null; // null = début de partie
}

export type MoveError = 'occupe' | 'ko' | 'suicide' | 'hors-plateau';

const neighborCache = new Map<number, number[][]>();
export function neighbors(size: number): number[][] {
  let n = neighborCache.get(size);
  if (!n) {
    n = [];
    for (let p = 0; p < size * size; p++) {
      const x = p % size, y = Math.floor(p / size), a: number[] = [];
      if (x > 0) a.push(p - 1);
      if (x < size - 1) a.push(p + 1);
      if (y > 0) a.push(p - size);
      if (y < size - 1) a.push(p + size);
      n.push(a);
    }
    neighborCache.set(size, n);
  }
  return n;
}

export function newPosition(size: number, handicapStones: number[] = []): Position {
  const board = new Int8Array(size * size);
  for (const p of handicapStones) board[p] = 1;
  return { size, board, toPlay: handicapStones.length ? 2 : 1, ko: -1, captures: [0, 0, 0], lastMove: null };
}

export interface Group { stones: number[]; liberties: Set<number> }

export function groupAt(board: Int8Array, size: number, p: number): Group {
  const color = board[p], nb = neighbors(size);
  const stones: number[] = [], liberties = new Set<number>();
  const seen = new Uint8Array(board.length), stack = [p];
  seen[p] = 1;
  while (stack.length) {
    const q = stack.pop()!;
    stones.push(q);
    for (const r of nb[q]) {
      if (board[r] === 0) liberties.add(r);
      else if (board[r] === color && !seen[r]) { seen[r] = 1; stack.push(r); }
    }
  }
  return { stones, liberties };
}

/** Joue un coup. Renvoie la nouvelle position ou le motif du refus. */
export function play(pos: Position, p: number): Position | MoveError {
  const { size } = pos, c = pos.toPlay, o = (3 - c) as Color;
  if (p === -1) return { ...pos, board: pos.board, toPlay: o, ko: -1, captures: [...pos.captures] as Position['captures'], lastMove: -1 };
  if (p < 0 || p >= size * size) return 'hors-plateau';
  if (pos.board[p] !== 0) return 'occupe';
  if (p === pos.ko) return 'ko';
  const board = pos.board.slice();
  board[p] = c;
  let captured = 0, lastCaptured = -1;
  for (const r of neighbors(size)[p]) {
    if (board[r] !== o) continue;
    const g = groupAt(board, size, r);
    if (g.liberties.size === 0) {
      for (const s of g.stones) board[s] = 0;
      captured += g.stones.length;
      lastCaptured = r;
    }
  }
  const own = groupAt(board, size, p);
  if (own.liberties.size === 0) return 'suicide';
  const ko = captured === 1 && own.stones.length === 1 && own.liberties.size === 1 ? lastCaptured : -1;
  const captures = [...pos.captures] as Position['captures'];
  captures[c] += captured;
  return { size, board, toPlay: o, ko, captures, lastMove: p };
}

export function isLegal(pos: Position, p: number): boolean {
  return typeof play(pos, p) !== 'string';
}

/** Points de handicap habituels, de 2 à 9 pierres (coins, puis centre ou côtés, dans l'ordre classique). */
export function handicapPoints(size: number, count: number): number[] {
  const a = size === 9 ? 2 : 3, z = size - 1 - a, m = (size - 1) >> 1;
  const corners = [[z, a], [a, z], [z, z], [a, a]], sides = [[a, m], [z, m]], tb = [[m, a], [m, z]], c = [[m, m]];
  const order = count <= 4 ? corners : count === 5 ? [...corners, ...c] : count === 6 ? [...corners, ...sides]
    : count === 7 ? [...corners, ...sides, ...c] : count === 8 ? [...corners, ...sides, ...tb] : [...corners, ...sides, ...tb, ...c];
  return order.slice(0, count).map(([x, y]) => y * size + x);
}

// Superko positionnel (option) : une même disposition des pierres ne doit jamais revenir.
export type SuperkoError = MoveError | 'superko';

/** Clé d'une disposition des pierres (sans le trait ni les prisonniers). */
export function boardKey(board: Int8Array): string {
  return board.join('');
}

/** Comme `play`, mais refuse aussi un coup qui recrée une disposition déjà vue (`seen` contient des `boardKey`). La passe reste permise. */
export function playSuperko(pos: Position, p: number, seen: ReadonlySet<string>): Position | SuperkoError {
  const r = play(pos, p);
  if (typeof r === 'string' || p === -1) return r;
  return seen.has(boardKey(r.board)) ? 'superko' : r;
}
