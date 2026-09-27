// Lecteur de vie et mort pour le lot C (issue #91) : recherche complète dans un espace clos.
// Le défenseur gagne s'il atteint deux vrais yeux d'un point (hasTwoEyes, algorithme de Benson) ;
// l'attaquant gagne s'il capture le groupe. Une double passe (seki, ou position non résolue) ne donne
// la victoire à personne : un problème « vivre » exige la vie sans condition, un problème « tuer » la capture.
import { groupAt, neighbors, play, type Position } from './rules';
import { hasTwoEyes } from './tactics';

/** Espace clos autour du groupe `t` : cases jouables et murs de l'attaquant. */
export interface Zone {
  /** Cases de la zone (vides, pierres du défenseur, pierres de l'attaquant enfermées dedans). */
  cells: number[];
  /** Chaînes de l'attaquant qui bordent la zone, avec leurs libertés hors de la zone. */
  walls: { stones: number[]; outside: number }[];
}

/**
 * Remplissage depuis `t` à travers les cases vides et les pierres du défenseur ; les chaînes de l'attaquant
 * dont toutes les libertés sont dans la zone y sont ajoutées (pierres jetées à l'intérieur), les autres sont des murs.
 */
export function zoneOf(pos: Position, t: number): Zone {
  const d = pos.board[t], a = 3 - d, nb = neighbors(pos.size), inZone = new Set<number>([t]), stack = [t];
  while (stack.length) {
    const q = stack.pop()!;
    for (const r of nb[q]) if (!inZone.has(r) && pos.board[r] !== a) { inZone.add(r); stack.push(r); }
  }
  const walls: Zone['walls'] = [], seen = new Set<number>();
  for (const q of [...inZone]) for (const r of nb[q]) {
    if (pos.board[r] !== a || seen.has(r)) continue;
    const g = groupAt(pos.board, pos.size, r);
    g.stones.forEach(s => seen.add(s));
    const outside = [...g.liberties].filter(l => !inZone.has(l)).length;
    if (outside === 0) g.stones.forEach(s => inZone.add(s));
    else walls.push({ stones: g.stones, outside });
  }
  return { cells: [...inZone].sort((x, y) => x - y), walls };
}

/** +1 : le défenseur vit sans condition ; -1 : il est capturé ; 0 : ni l'un ni l'autre (double passe, cycle). */
export type Issue = -1 | 0 | 1;

export interface Options {
  /** Autorise les prises qui créent un ko. Faux : ces coups sont interdits, pour vérifier que le ko ne change rien. */
  ko: boolean;
}

/**
 * Résultat de la position avec jeu parfait des deux camps, les coups étant limités aux cases vides de la zone
 * (plus la passe). `passes` compte les passes consécutives. Le défenseur maximise, l'attaquant minimise.
 */
export function solve(pos: Position, t: number, cells: number[], opts: Options = { ko: true }): Issue {
  const d = pos.board[t], memo = new Map<string, Issue>(), busy = new Set<string>();
  const rec = (p: Position, passes: number): Issue => {
    if (p.board[t] !== d) return -1;
    if (hasTwoEyes(p, t)) return 1;
    if (passes >= 2) return 0;
    let key = `${p.toPlay}${passes}${p.ko}:`;
    for (const c of cells) key += p.board[c];
    const known = memo.get(key);
    if (known !== undefined) return known;
    if (busy.has(key)) return 0;
    busy.add(key);
    const max = p.toPlay === d;
    let best: Issue = max ? -1 : 1;
    for (const m of [...cells.filter(c => p.board[c] === 0), -1]) {
      const r = play(p, m);
      if (typeof r === 'string') continue;
      if (!opts.ko && r.ko !== -1) continue;
      const v = rec(r, m === -1 ? passes + 1 : 0);
      if (max ? v > best : v < best) best = v;
      if (best === (max ? 1 : -1)) break;
    }
    busy.delete(key);
    memo.set(key, best);
    return best;
  };
  return rec(pos, 0);
}

/** Coups de Noir (au trait) dans la zone qui atteignent l'objectif : vivre (+1 forcé) ou tuer (-1 forcé). */
export function winningMoves(pos: Position, t: number, goal: 'vivre' | 'tuer', opts: Options = { ko: true }): number[] {
  const { cells } = zoneOf(pos, t), target: Issue = goal === 'vivre' ? 1 : -1, out: number[] = [];
  for (const m of [...cells.filter(c => pos.board[c] === 0), -1]) {
    const r = play(pos, m);
    if (typeof r === 'string') continue;
    if (solve(r, t, cells, opts) === target) out.push(m);
  }
  return out;
}
