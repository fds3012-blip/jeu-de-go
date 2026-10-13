import { groupAt, neighbors, play, type Color, type Position } from './rules';

export type Rules = 'japanese' | 'chinese';

export interface Score {
  black: number;
  white: number;
  territory: [number, number, number];
  owner: Int8Array; // propriétaire de chaque intersection vide (0 neutre)
  winner: 1 | 2;
  margin: number;
  seki: number[]; // pierres en seki (vie commune), après retrait des pierres mortes
  /** Points donnés à Blanc pour les pierres de handicap (règle chinoise seulement, voir `compensationHandicap`). */
  compensation: number;
}

/**
 * Nombre de pierres de handicap d'une position de départ : pierres noires seulement, Blanc au trait (0 sinon).
 * Une seule pierre noire n'est pas un handicap au sens du comptage : on renvoie alors 0.
 */
export function handicapDe(depart: Position): number {
  if (depart.toPlay !== 2) return 0;
  let noires = 0;
  for (const v of depart.board) { if (v === 2) return 0; if (v === 1) noires++; }
  return noires >= 2 ? noires : 0;
}

/**
 * Compensation du handicap (#528). En comptage par zone (règle chinoise), chaque pierre de handicap reste sur le plateau
 * et compte pour Noir : Blanc reçoit 1 point par pierre de handicap (règle chinoise et KataGo, `whiteHandicapBonus = N`).
 * En comptage japonais (territoire et prisonniers), les pierres posées ne comptent pas : aucune compensation.
 */
export function compensationHandicap(rules: Rules, handicap: number): number {
  return rules === 'chinese' && handicap >= 2 ? handicap : 0;
}

/**
 * Pierres en seki : groupes vivants qui partagent une liberté neutre où chaque camp se mettrait lui-même en atari
 * sans rien capturer. Heuristique fiable une fois les points neutres (dame) remplis.
 */
export function findSeki(board: Int8Array, size: number): Set<number> {
  const nb = neighbors(size), seki = new Set<number>();
  const selfAtari = (p: number, c: Color) => {
    const r = play({ size, board, toPlay: c, ko: -1, captures: [0, 0, 0], lastMove: null }, p);
    return typeof r !== 'string' && r.captures[c] === 0 && groupAt(r.board, size, p).liberties.size === 1;
  };
  for (let p = 0; p < board.length; p++) {
    if (board[p]) continue;
    const around = new Set(nb[p].map(r => board[r]));
    if (!around.has(1) || !around.has(2) || !selfAtari(p, 1) || !selfAtari(p, 2)) continue;
    for (const r of nb[p]) if (board[r] && !seki.has(r)) for (const s of groupAt(board, size, r).stones) seki.add(s);
  }
  return seki;
}

/**
 * Compte la position. `dead` marque les pierres mortes retirées avant le comptage.
 * Japonais : territoire + prisonniers (dont pierres mortes) ; les yeux d'un groupe en seki ne comptent pas.
 * Chinois : pierres vivantes + territoire (les yeux en seki comptent). Les points neutres (dame, libertés partagées) ne comptent jamais.
 * `handicap` : pierres de handicap de la partie ; en chinois, Blanc reçoit en plus `compensationHandicap` points.
 */
export function score(pos: Position, komi: number, rules: Rules, dead: Set<number> = new Set(), handicap = 0): Score {
  const { size } = pos, nb = neighbors(size);
  const board = pos.board.slice();
  const prisoners: [number, number, number] = [0, pos.captures[1], pos.captures[2]];
  const stones: [number, number, number] = [0, 0, 0];
  for (let p = 0; p < board.length; p++) {
    if (board[p] && dead.has(p)) { prisoners[3 - board[p]] += 1; board[p] = 0; }
    else if (board[p]) stones[board[p]] += 1;
  }
  const seki = findSeki(board, size);
  const owner = new Int8Array(board.length), seen = new Uint8Array(board.length);
  const territory: [number, number, number] = [0, 0, 0];
  for (let p = 0; p < board.length; p++) {
    if (board[p] || seen[p]) continue;
    const region: number[] = [], stack = [p];
    let border = 0, freeBorder = false;
    seen[p] = 1;
    while (stack.length) {
      const q = stack.pop()!;
      region.push(q);
      for (const r of nb[q]) {
        if (board[r] === 0) { if (!seen[r]) { seen[r] = 1; stack.push(r); } }
        else { border |= board[r]; if (!seki.has(r)) freeBorder = true; }
      }
    }
    // En japonais, un œil entouré seulement par des pierres en seki reste neutre.
    if ((border === 1 || border === 2) && (rules === 'chinese' || freeBorder)) {
      territory[border] += region.length;
      for (const q of region) owner[q] = border;
    }
  }
  const black = rules === 'japanese' ? territory[1] + prisoners[1] : territory[1] + stones[1];
  const compensation = compensationHandicap(rules, handicap);
  const white = (rules === 'japanese' ? territory[2] + prisoners[2] : territory[2] + stones[2]) + komi + compensation;
  const winner = black > white ? 1 : 2;
  return { black, white, territory, owner, winner, margin: Math.abs(black - white), seki: [...seki].sort((a, b) => a - b), compensation };
}
