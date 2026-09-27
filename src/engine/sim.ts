// Briques communes des simulations Monte-Carlo : hasard reproductible, yeux, plateau de simulation rapide.
import { neighbors, type Color } from '../go/rules';

// Générateur pseudo-aléatoire (xorshift32), reproductible si on donne une graine.
export function rng(seed?: number): () => number {
  let s = (seed ?? Math.floor(Math.random() * 0x7fffffff)) | 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

export const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Vrai œil de `c` en `p` : voisins tous à `c`, et pas trop de diagonales adverses (œil faux). */
export function isEye(board: Int8Array, size: number, p: number, c: Color): boolean {
  if (board[p] !== 0) return false;
  for (const r of neighbors(size)[p]) if (board[r] !== c) return false;
  const x = p % size, y = (p - x) / size, o = 3 - c;
  let bad = 0, edge = false;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const u = x + dx, v = y + dy;
    if (u < 0 || v < 0 || u >= size || v >= size) { edge = true; continue; }
    if (board[v * size + u] === o) bad++;
  }
  return edge ? bad === 0 : bad < 2;
}

// ---------- Plateau de simulation : coups joués sur place, sans allocation ----------
export class Sim {
  board: Int8Array; ko = -1; size: number; nb: number[][];
  private mark: Int32Array; private gen = 0; private stack: Int32Array;
  constructor(size: number) {
    this.size = size; this.nb = neighbors(size);
    this.board = new Int8Array(size * size); this.mark = new Int32Array(size * size); this.stack = new Int32Array(size * size);
  }
  load(board: Int8Array, ko: number) { this.board.set(board); this.ko = ko; }
  /** Nombre de libertés du groupe en `p`, en s'arrêtant à `max`. */
  libs(p: number, max: number): number {
    const b = this.board, c = b[p], nb = this.nb, mark = this.mark, st = this.stack, g = ++this.gen, lg = ++this.gen;
    let top = 0, n = 0;
    st[top++] = p; mark[p] = g;
    while (top) {
      const q = st[--top];
      for (const r of nb[q]) {
        if (mark[r] === g || mark[r] === lg) continue;
        if (b[r] === 0) { mark[r] = lg; if (++n >= max) return n; }
        else if (b[r] === c) { mark[r] = g; st[top++] = r; }
      }
    }
    return n;
  }
  /** Première liberté trouvée du groupe en `p` (utile quand il est en atari). */
  aLib(p: number): number {
    const b = this.board, c = b[p], nb = this.nb, mark = this.mark, st = this.stack, g = ++this.gen;
    let top = 0;
    st[top++] = p; mark[p] = g;
    while (top) {
      const q = st[--top];
      for (const r of nb[q]) {
        if (b[r] === 0) return r;
        if (b[r] === c && mark[r] !== g) { mark[r] = g; st[top++] = r; }
      }
    }
    return -1;
  }
  private remove(p: number): number {
    const b = this.board, c = b[p], nb = this.nb, st = this.stack;
    let top = 0, n = 0;
    st[top++] = p; b[p] = 0;
    while (top) {
      const q = st[--top]; n++;
      for (const r of nb[q]) if (b[r] === c) { b[r] = 0; st[top++] = r; }
    }
    return n;
  }
  /**
   * Vrai si `c` en `p` ne capture rien et laisse en atari un groupe d'au moins deux pierres.
   * Une pierre seule reste permise : c'est le sacrifice qui tue un œil de deux points.
   */
  selfAtari(p: number, c: Color): boolean {
    const b = this.board, o = 3 - c;
    let res = false;
    for (const r of this.nb[p]) if (b[r] === c) res = true;
    if (!res) return false;
    b[p] = c;
    for (const r of this.nb[p]) if (b[r] === o && this.libs(r, 1) === 0) { res = false; break; }
    if (res) res = this.libs(p, 2) < 2;
    b[p] = 0;
    return res;
  }
  /** Joue `c` en `p` si c'est légal ; renvoie faux sinon (plateau inchangé). */
  play(p: number, c: Color): boolean {
    const b = this.board;
    if (p === -1) { this.ko = -1; return true; }
    if (b[p] !== 0 || p === this.ko) return false;
    const o = 3 - c;
    b[p] = c;
    let captured = 0, lastCap = -1;
    for (const r of this.nb[p]) if (b[r] === o && this.libs(r, 1) === 0) { captured += this.remove(r); lastCap = r; }
    if (!captured && this.libs(p, 1) === 0) { b[p] = 0; return false; }
    this.ko = -1;
    if (captured === 1) {
      let alone = true;
      for (const r of this.nb[p]) if (b[r] === c) alone = false;
      if (alone && this.libs(p, 2) === 1) this.ko = lastCap;
    }
    return true;
  }
  /**
   * Une partie aléatoire légère jusqu'à deux passes, puis comptage chinois. Renvoie le gagnant.
   * `zones` (fin de partie) : masque par case des couleurs qui peuvent y jouer (bit 1 Noir, bit 2 Blanc), et
   * jamais d'auto-atari d'un groupe hors capture (un seki reste un seki). Sert à juger les pierres mortes.
   */
  playout(toPlay: Color, last: number, komi: number, rand: () => number, empties: Int32Array, own: Int32Array, zones?: Uint8Array): Color {
    const b = this.board, n = b.length, nb = this.nb, size = this.size;
    let c = toPlay, passes = 0, moves = 0;
    const maxMoves = n * 3;
    while (passes < 2 && moves < maxMoves) {
      let move = -1;
      // Heuristique : capturer un groupe adverse en atari près du dernier coup.
      if (last >= 0 && rand() < 0.9) {
        for (const r of nb[last]) {
          if (b[r] === 3 - c && this.libs(r, 2) === 1) {
            const l = this.aLib(r);
            if (l >= 0 && this.play(l, c)) { move = l; break; }
          }
        }
      }
      if (move < 0) {
        // Coup au hasard parmi les points vides, sans remplir ses propres yeux.
        let k = 0;
        for (let p = 0; p < n; p++) if (b[p] === 0) empties[k++] = p;
        while (k > 0) {
          const i = Math.floor(rand() * k), p = empties[i];
          empties[i] = empties[--k];
          if (isEye(b, size, p, c) || (zones && (!(zones[p] & c) || this.selfAtari(p, c)))) continue;
          if (this.play(p, c)) { move = p; break; }
        }
      }
      if (move < 0) { this.ko = -1; passes++; } else passes = 0;
      last = move; c = (3 - c) as Color; moves++;
    }
    // Comptage chinois : pierres + points vides entourés d'une seule couleur (fin de partie : surtout des yeux).
    let black = 0, white = komi;
    for (let p = 0; p < n; p++) {
      const v = b[p];
      let m = v;
      if (!v) for (const r of nb[p]) m |= b[r];
      if (m === 1) { black++; own[p]++; } else if (m === 2) { white++; own[p]--; }
    }
    return black > white ? 1 : 2;
  }
}
