// Lecteurs tactiques simples, pour vérifier leçons et problèmes : échelle (shicho) et vie ou mort locale.
import { groupAt, neighbors, play, type Position } from './rules';

const libs = (pos: Position, p: number) => groupAt(pos.board, pos.size, p).liberties;

/** Le groupe `t`, en atari et dont le camp est au trait, peut-il s'échapper (en s'allongeant ou en capturant) ? */
export function canEscape(pos: Position, t: number, depth = 0): boolean {
  if (depth > 400) return true;
  const g = groupAt(pos.board, pos.size, t), opts = new Set(g.liberties);
  for (const s of g.stones) for (const r of neighbors(pos.size)[s]) {
    if (pos.board[r] === 3 - pos.board[t]) { const h = groupAt(pos.board, pos.size, r); if (h.liberties.size === 1) opts.add([...h.liberties][0]); }
  }
  for (const m of opts) {
    const r = play(pos, m);
    if (typeof r === 'string') continue;
    const n = libs(r, t).size;
    if (n >= 3 || (n === 2 && !ladderWorks(r, t, depth + 1))) return true;
  }
  return false;
}

/** L'attaquant (camp au trait) capture-t-il le groupe `t` par une suite d'atari (échelle ou poussée au bord) ? */
export function ladderWorks(pos: Position, t: number, depth = 0): boolean {
  if (pos.board[t] === 0 || pos.board[t] === pos.toPlay) return false;
  for (const m of libs(pos, t)) {
    const r = play(pos, m);
    if (typeof r === 'string') continue;
    if (r.board[t] === 0 || (libs(r, t).size === 1 && !canEscape(r, t, depth))) return true;
  }
  return false;
}

/**
 * Vie ou mort dans une zone fermée : le groupe `t` finit-il capturé, quel que soit le camp au trait ?
 * `area` liste les intersections jouables (la passe est toujours possible) ; recherche complète sur `depth` coups.
 */
export function isDead(pos: Position, t: number, area: number[], depth = 8): boolean {
  if (pos.board[t] === 0) return true;
  if (depth === 0) return false;
  const after = [...area.filter(p => pos.board[p] === 0), -1].map(m => play(pos, m)).filter((r): r is Position => typeof r !== 'string');
  const dead = (r: Position) => isDead(r, t, area, depth - 1);
  return pos.toPlay === pos.board[t] ? after.every(dead) : after.some(dead);
}
