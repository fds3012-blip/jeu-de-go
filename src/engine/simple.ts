// Moteur simple : Monte-Carlo « à plat » (UCB1 sur les coups candidats) avec heuristiques de capture.
// Pas de réseau de neurones : il sert d'adversaire débutant en attendant KataGo.
// Synchrone et sans DOM, pour tourner dans un Web Worker comme dans les tests.
import { groupAt, neighbors, play, type Color, type Position } from '../go/rules';
import { score } from '../go/score';

export type OpponentId = 'pomme' | 'caillou' | 'bambou' | 'renard' | 'riviere' | 'tigre' | 'montagne' | 'dragon' | 'sensei';

/** Style de jeu des niveaux KataGo : il oriente le choix parmi les coups jugés acceptables. */
export type Style = 'agressif' | 'solide' | 'territorial';

export interface KataGoLevel {
  visits: number; // visites de la recherche PUCT
  tolerance: number; // points de perte acceptés par rapport au meilleur coup
  style: Style;
}

export interface Opponent {
  id: OpponentId;
  nom: string;
  rang: string;
  description: string;
  // Moteur simple (Pomme, Caillou, et repli des niveaux KataGo si le réseau ne se charge pas).
  playouts: number; // plafond de simulations par coup
  timeMs: number; // budget de temps par coup
  hasard: number; // probabilité de jouer un candidat au hasard au lieu du meilleur
  heuristiques: boolean; // priorité aux captures et aux sauvetages
  /** Présent : ce niveau joue avec KataGo (réseau g170-b6c96). */
  katago?: KataGoLevel;
}

// Repli commun des niveaux KataGo : le moteur simple à pleine force (niveau Caillou).
const repli = { playouts: 20000, timeMs: 800, hasard: 0, heuristiques: true } as const;

/** Échelle des défis, du plus facile au plus fort. */
export const OPPONENTS: Opponent[] = [
  { id: 'pomme', nom: 'Pomme', rang: '20 kyu', description: 'Joue un peu au hasard. Parfait pour ta première partie.', playouts: 250, timeMs: 150, hasard: 0.3, heuristiques: false },
  { id: 'caillou', nom: 'Caillou', rang: '16 kyu', description: 'Capture dès que tu le laisses faire. Protège bien tes pierres.', playouts: 20000, timeMs: 600, hasard: 0, heuristiques: true },
  { id: 'bambou', nom: 'Bambou', rang: '13 kyu', description: 'Joue solide et relie ses pierres. Cherche ses points faibles.', ...repli, katago: { visits: 4, tolerance: 12, style: 'solide' } },
  { id: 'renard', nom: 'Renard', rang: '10 kyu', description: 'Aime couper et attaquer. Garde tes groupes bien reliés.', ...repli, katago: { visits: 8, tolerance: 8, style: 'agressif' } },
  { id: 'riviere', nom: 'Rivière', rang: '7 kyu', description: 'Prend les coins et les bords. Ne le laisse pas tout entourer.', ...repli, katago: { visits: 16, tolerance: 5, style: 'territorial' } },
  { id: 'tigre', nom: 'Tigre', rang: '5 kyu', description: 'Attaque sans relâche. Fais vivre tes groupes tôt.', ...repli, katago: { visits: 32, tolerance: 3, style: 'agressif' } },
  { id: 'montagne', nom: 'Montagne', rang: '3 kyu', description: 'Très solide, presque sans faute. Il faut le battre aux points.', ...repli, katago: { visits: 64, tolerance: 1.5, style: 'solide' } },
  { id: 'dragon', nom: 'Dragon', rang: '1 kyu', description: 'Compte très bien son territoire. Chaque point compte.', ...repli, katago: { visits: 128, tolerance: 0.8, style: 'territorial' } },
  { id: 'sensei', nom: 'Sensei', rang: '1 dan', description: 'Le dernier défi. Joue son meilleur coup à chaque fois.', ...repli, katago: { visits: 200, tolerance: 0, style: 'solide' } },
];

export function opponent(id: OpponentId): Opponent {
  return OPPONENTS.find(o => o.id === id) ?? OPPONENTS[0];
}

export interface EngineOptions { komi?: number; seed?: number; timeMs?: number; playouts?: number }

// Générateur pseudo-aléatoire (xorshift32), reproductible si on donne une graine.
function rng(seed?: number): () => number {
  let s = (seed ?? Math.floor(Math.random() * 0x7fffffff)) | 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

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
class Sim {
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
  /** Une partie aléatoire légère jusqu'à deux passes, puis comptage chinois. Renvoie le gagnant. */
  playout(toPlay: Color, last: number, komi: number, rand: () => number, empties: Int32Array, own: Int32Array): Color {
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
          if (isEye(b, size, p, c)) continue;
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

interface Candidate { move: number; prior: number; wins: number; visits: number }

/** Coups candidats à la racine, avec un bonus pour les captures et les sauvetages. */
export function candidates(pos: Position, heuristiques = true): Candidate[] {
  const { size, board } = pos, c = pos.toPlay, o = 3 - c, nb = neighbors(size);
  const out: Candidate[] = [];
  // Groupes en atari des deux couleurs.
  const seen = new Uint8Array(board.length), captureAt = new Map<number, number>(), saveAt = new Set<number>();
  for (let p = 0; p < board.length; p++) {
    if (!board[p] || seen[p]) continue;
    const g = groupAt(board, size, p);
    for (const s of g.stones) seen[s] = 1;
    if (g.liberties.size !== 1) continue;
    const l = [...g.liberties][0];
    if (board[p] === o) captureAt.set(l, (captureAt.get(l) ?? 0) + g.stones.length);
    else saveAt.add(l);
  }
  for (let p = 0; p < board.length; p++) {
    if (board[p] || isEye(board, size, p, c)) continue;
    const r = play(pos, p);
    if (typeof r === 'string') continue;
    const captured = r.captures[c] - pos.captures[c];
    const own = groupAt(r.board, size, p);
    // Éviter l'auto-atari (sauf si le coup capture).
    if (!captured && own.liberties.size === 1) continue;
    let prior = 0;
    if (heuristiques) {
      if (captured) prior += 4 + 2 * Math.min(captured, 5);
      if (saveAt.has(p) && own.liberties.size >= 2) prior += 6;
      // Petit bonus pour rester au contact (joue « quelque part d'utile »).
      if (nb[p].some(q => board[q] === o) && own.liberties.size >= 3) prior += 0.5;
    }
    out.push({ move: p, prior, wins: 0, visits: 0 });
  }
  return out;
}

/**
 * Plateau réglé : chaque point vide est entouré d'une seule couleur (et le reste dans les simulations), aucun groupe n'est en atari
 * et aucune pierre n'est jugée morte par les simulations (propriété moyenne du mauvais côté).
 */
function settled(pos: Position, own: Int32Array, playouts: number): boolean {
  const { board, size } = pos, owner = score(pos, 0, 'chinese').owner, seen = new Uint8Array(board.length);
  for (let p = 0; p < board.length; p++) {
    const v = board[p];
    if (!v) { if (!owner[p] || (owner[p] === 1 ? own[p] : -own[p]) < 0.6 * playouts) return false; continue; }
    if ((v === 1 ? own[p] : -own[p]) < -0.3 * playouts) return false;
    if (seen[p]) continue;
    const g = groupAt(board, size, p);
    for (const s of g.stones) seen[s] = 1;
    if (g.liberties.size < 2) return false;
  }
  return true;
}

/** Choisit un coup (index y * N + x, -1 = passe) pour le joueur au trait. Synchrone. */
export function chooseMove(pos: Position, niveau: OpponentId | Opponent, opts: EngineOptions = {}): number {
  const lvl = typeof niveau === 'string' ? opponent(niveau) : niveau;
  const komi = opts.komi ?? 6.5, rand = rng(opts.seed), c = pos.toPlay;
  const cands = candidates(pos, lvl.heuristiques);
  if (!cands.length) return -1;

  // L'adversaire vient de passer : si le compte actuel nous donne gagnant, on passe aussi.
  if (pos.lastMove === -1) {
    const sc = score(pos, komi, 'chinese');
    if (sc.winner === c) return -1;
  }

  const size = pos.size, sim = new Sim(size), empties = new Int32Array(size * size);
  const budget = opts.timeMs ?? lvl.timeMs, maxPlayouts = opts.playouts ?? lvl.playouts, t0 = now();
  const own = new Int32Array(size * size), arms = cands;
  // Les bonus heuristiques comptent comme des victoires virtuelles.
  for (const a of arms) { a.visits = 1 + a.prior; a.wins = 0.5 + a.prior; }
  let total = arms.reduce((s, a) => s + a.visits, 0), done = 0;
  while (done < maxPlayouts) {
    if ((done & 15) === 0 && now() - t0 > budget) break;
    const logT = Math.log(total);
    let best = arms[0], bestU = -Infinity;
    for (const a of arms) {
      const u = a.wins / a.visits + Math.sqrt((1.2 * logT) / a.visits);
      if (u > bestU) { bestU = u; best = a; }
    }
    sim.load(pos.board, pos.ko);
    sim.play(best.move, c);
    const w = sim.playout((3 - c) as Color, best.move, komi, rand, empties, own);
    best.visits++; total++; done++;
    if (w === c) best.wins++;
  }

  const rate = (a: Candidate) => a.wins / a.visits;
  cands.sort((a, b) => b.visits - a.visits || rate(b) - rate(a));
  const top = cands[0];
  // Partie terminée : plus rien d'utile à jouer, on passe.
  if (done >= 20 && settled(pos, own, done)) return -1;
  // Part de hasard des niveaux faibles.
  if (lvl.hasard > 0 && rand() < lvl.hasard) return cands[Math.floor(rand() * cands.length)].move;
  // Coups urgents (capture, sauvetage) : joués sauf si les simulations les jugent nettement moins bons.
  let urgent: Candidate | null = null;
  for (const a of cands) if (a.prior >= 4 && (!urgent || a.prior > urgent.prior)) urgent = a;
  if (urgent && rate(urgent) >= rate(top) - 0.15) return urgent.move;
  return top.move;
}

/** Vrai si le coup (ou la passe) est légal dans la position. */
export function isLegalMove(pos: Position, p: number): boolean {
  return p === -1 || typeof play(pos, p) !== 'string';
}
