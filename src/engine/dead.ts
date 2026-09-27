// Pierres mortes en fin de partie, estimées par simulations Monte-Carlo de fin de partie : pas d'auto-atari d'un
// groupe (un seki reste un seki) et pas d'invasion des grands territoires déjà fermés. On joue des parties
// aléatoires jusqu'au bout, les deux couleurs commençant tour à tour, et on regarde à qui appartient chaque case.
// Un groupe est mort si ses cases finissent chez l'adversaire dans une large majorité (70 % par défaut).
// Décision par groupe entier. Synchrone et sans DOM (Worker ou tests).
import { groupAt, neighbors, type Color, type Position } from '../go/rules';
import { isEye, rng, now, Sim } from './sim';

export interface DeadOptions { seed?: number; playouts?: number; timeMs?: number; seuil?: number }

// Masque par case des couleurs qui peuvent y jouer dans les simulations (bit 1 Noir, bit 2 Blanc).
// - Petite zone vide (7 cases ou moins) : les deux couleurs, c'est peut-être l'œil unique d'un groupe mort.
// - Grande zone bordée d'une seule couleur : un vrai territoire, l'autre couleur n'y joue pas.
// - Grande zone mixte dont les pierres d'une couleur y sont enfermées (elles ne touchent que cette zone, leurs
//   propres zones et les pierres adverses qui bordent la zone) : territoire de l'autre couleur, seule elle y joue.
//   Les intrus ne peuvent plus s'échapper ; s'ils peuvent vivre, c'est dans leurs propres petites zones.
// - Sinon (partie pas finie), les deux.
const PETITE_ZONE = 7;
export function zones(pos: Position): Uint8Array {
  const { board, size } = pos, nb = neighbors(size), n = board.length;
  const id = new Int32Array(n).fill(-1), regions: { pts: number[]; border: number }[] = [];
  for (let p = 0; p < n; p++) {
    if (board[p] || id[p] >= 0) continue;
    const k = regions.length, pts: number[] = [], stack = [p];
    let border = 0;
    id[p] = k;
    while (stack.length) {
      const q = stack.pop()!;
      pts.push(q);
      for (const r of nb[q]) {
        if (!board[r]) { if (id[r] < 0) { id[r] = k; stack.push(r); } }
        else border |= board[r];
      }
    }
    regions.push({ pts, border });
  }
  const out = new Uint8Array(n).fill(3);
  regions.forEach(({ pts, border }, k) => {
    let m = 3;
    if (pts.length > PETITE_ZONE) {
      if (border === 1 || border === 2) m = border;
      else if (border === 3) {
        const enclosed = [false, isEnclosed(pos, id, regions, k, 1), isEnclosed(pos, id, regions, k, 2)];
        if (enclosed[1] !== enclosed[2]) m = enclosed[1] ? 2 : 1;
      }
    }
    for (const q of pts) out[q] = m;
  });
  return out;
}

/** Vrai si les pierres de couleur `c` qui bordent la zone `k` n'ont pas d'autre issue (voir `zones`). */
function isEnclosed(pos: Position, id: Int32Array, regions: { pts: number[]; border: number }[], k: number, c: Color): boolean {
  const { board, size } = pos, nb = neighbors(size), o = 3 - c;
  const chain = new Uint8Array(board.length); // 1 : chaîne de `c` à examiner ; 2 : pierre adverse qui borde la zone
  const todo: number[] = [];
  for (const q of regions[k].pts) for (const r of nb[q]) {
    if (board[r] === o) chain[r] = 2;
    else if (board[r] === c && !chain[r]) for (const s of groupAt(board, size, r).stones) { chain[s] = 1; todo.push(s); }
  }
  for (const s of todo) for (const r of nb[s]) {
    if (!board[r]) { if (id[r] !== k && regions[id[r]].border !== c) return false; }
    else if (board[r] === o && chain[r] !== 2) {
      // Pierre adverse : elle doit appartenir à une chaîne qui borde la zone.
      const g = groupAt(board, size, r).stones;
      if (!g.some(t => chain[t] === 2)) return false;
      for (const t of g) chain[t] = 2;
    }
  }
  return true;
}

/** Propriété finale moyenne de chaque case, de -1 (Blanc) à +1 (Noir). */
export function ownership(pos: Position, opts: DeadOptions = {}): Float32Array {
  const { size, board } = pos, n = size * size, sim = new Sim(size), rand = rng(opts.seed ?? 12345);
  const own = new Int32Array(n), empties = new Int32Array(n), z = zones(pos);
  const max = opts.playouts ?? (size <= 9 ? 600 : size <= 13 ? 400 : 250), budget = opts.timeMs ?? (size <= 9 ? 200 : 700), t0 = now();
  let done = 0;
  while (done < max && (done < 40 || now() - t0 < budget)) {
    sim.load(board, pos.ko);
    // Une fois sur deux chaque couleur commence : l'estimation ne dépend pas de qui a le trait.
    sim.playout((done & 1 ? 3 - pos.toPlay : pos.toPlay) as Color, -1, 0, rand, empties, own, z);
    done++;
  }
  const out = new Float32Array(n);
  for (let p = 0; p < n; p++) out[p] = own[p] / done;
  return out;
}

/** Pierres mortes (index y * N + x), groupe par groupe. */
export function deadStones(pos: Position, opts: DeadOptions = {}): number[] {
  if (!pos.board.some(v => v)) return [];
  return mortsDepuis(pos, ownership(pos, opts), opts.seuil ?? 0.4);
}

/** Groupes de la position, sans ceux qui ont deux vrais yeux (vivants sans discussion). */
function groupesDiscutables(pos: Position): { c: Color; stones: number[] }[] {
  const { board, size } = pos, seen = new Uint8Array(board.length), out: { c: Color; stones: number[] }[] = [];
  for (let p = 0; p < board.length; p++) {
    if (!board[p] || seen[p]) continue;
    const c = board[p] as Color, g = groupAt(board, size, p);
    for (const s of g.stones) seen[s] = 1;
    let eyes = 0;
    for (const l of g.liberties) if (isEye(board, size, l, c)) eyes++;
    if (eyes < 2) out.push({ c, stones: g.stones });
  }
  return out;
}

/** Moyenne de propriété d'un groupe, vue de sa couleur : -1 = toujours chez l'adversaire. */
function moyenne(own: ArrayLike<number>, c: Color, stones: number[]): number {
  let m = 0;
  for (const s of stones) m += c === 1 ? own[s] : -own[s];
  return m / stones.length;
}

function mortsDepuis(pos: Position, own: ArrayLike<number>, seuil: number): number[] {
  const dead: number[] = [];
  for (const g of groupesDiscutables(pos)) if (moyenne(own, g.c, g.stones) < -seuil) dead.push(...g.stones);
  return dead.sort((a, b) => a - b);
}

// Comptage automatique (#117) : on ne marque les pierres mortes à la place du joueur que si l'estimation est nette.
/**
 * Zone de doute sur la moyenne de propriété d'un groupe (vue de sa couleur). KataGo donne une propriété proche de 0
 * à un seki : au-dessus de -0,2, vivant. Dans les simulations, un seki survit (proche de +1) : un groupe vivant
 * moins d'une fois sur quatre (sous +0,5) reste discutable.
 */
export const DOUTE = { mort: -0.6, vivant: -0.2, vivantSimulation: 0.5 } as const;

/**
 * Pierres des groupes incertains : une carte de propriété (`avis`, de -1 Blanc à +1 Noir) les place entre vie
 * et mort, ou contredit la liste `dead`. Un seki (propriété proche de 0 chez KataGo) compte comme vivant.
 */
export function groupesIncertains(pos: Position, dead: readonly number[], avis: ArrayLike<number>[], vivant: number = DOUTE.vivant): number[] {
  const mort = new Set(dead), out: number[] = [];
  for (const g of groupesDiscutables(pos)) {
    const estMort = mort.has(g.stones[0]);
    const doute = avis.some(own => {
      const m = moyenne(own, g.c, g.stones);
      return (m > DOUTE.mort && m < vivant) || (estMort && m >= vivant) || (!estMort && m <= DOUTE.mort);
    });
    if (doute) out.push(...g.stones);
  }
  return out.sort((a, b) => a - b);
}

export interface ComptageAuto { dead: number[]; incertains: number[] }

/** Pierres mortes et groupes incertains, d'après les simulations (et `avis` en plus, par exemple KataGo). */
export function comptageAuto(pos: Position, opts: DeadOptions = {}, avis: ArrayLike<number>[] = []): ComptageAuto {
  if (!pos.board.some(v => v)) return { dead: [], incertains: [] };
  const own = ownership(pos, opts), dead = mortsDepuis(pos, own, opts.seuil ?? 0.4);
  const incertains = new Set([...groupesIncertains(pos, dead, [own], DOUTE.vivantSimulation), ...groupesIncertains(pos, dead, avis)]);
  return { dead, incertains: [...incertains].sort((a, b) => a - b) };
}
