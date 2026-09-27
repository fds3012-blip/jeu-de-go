// Lecteurs tactiques simples, pour vérifier leçons et problèmes : échelle (shicho) et vie ou mort locale.
import { groupAt, neighbors, play, type Group, type Position } from './rules';

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
 * Lecteur de capture (attaquant au trait) : le groupe `t` finit-il capturé en au plus `depth` coups ?
 * L'attaquant joue sur les libertés du groupe et leurs voisines (atari, filet, sacrifice) ; le défenseur
 * s'allonge, capture, met en atari une pierre qui l'entoure, ou passe. Un groupe à 4 libertés ou plus est sauvé.
 */
export function captureWorks(pos: Position, t: number, depth = 12): boolean {
  if (pos.board[t] === 0) return true;
  if (depth <= 0 || pos.board[t] === pos.toPlay) return false;
  const nb = neighbors(pos.size), l = libs(pos, t), cand = new Set(l);
  for (const m of l) for (const r of nb[m]) if (pos.board[r] === 0) cand.add(r);
  for (const m of cand) {
    const r = play(pos, m);
    if (typeof r === 'string') continue;
    if (r.board[t] === 0 || (libs(r, t).size <= 2 && defenceFails(r, t, depth - 1))) return true;
  }
  return false;
}

/** Défenseur au trait : toutes ses défenses échouent-elles (le groupe `t` finit capturé) ? */
export function defenceFails(pos: Position, t: number, depth: number): boolean {
  if (pos.board[t] === 0) return true;
  if (depth <= 0) return false;
  const nb = neighbors(pos.size), g = groupAt(pos.board, pos.size, t), moves = new Set<number>([...g.liberties, -1]);
  // Sauts et pointes : les points voisins des libertés comptent aussi.
  for (const m of g.liberties) for (const r of nb[m]) if (pos.board[r] === 0) moves.add(r);
  for (const s of g.stones) for (const r of nb[s]) {
    if (pos.board[r] !== 3 - pos.board[t]) continue;
    const h = groupAt(pos.board, pos.size, r);
    if (h.liberties.size <= 2) for (const m of h.liberties) moves.add(m);
  }
  for (const m of moves) {
    const r = play(pos, m);
    if (typeof r === 'string') continue;
    if (r.board[t] === 0) continue;
    if (libs(r, t).size >= 4 || !captureWorks(r, t, depth - 1)) return false;
  }
  return true;
}

/**
 * Vie sans condition (algorithme de Benson, limité aux yeux d'un seul point) : on garde un ensemble de chaînes
 * de la couleur de `t` dont chacune touche au moins deux « yeux » ; un œil est un point vide dont tous les voisins
 * sont des pierres de chaînes de l'ensemble. L'adversaire ne peut jouer dans aucun de ces yeux (ce serait un suicide) :
 * ces chaînes vivent quoi qu'il arrive.
 */
export function hasTwoEyes(pos: Position, t: number): boolean {
  const c = pos.board[t], nb = neighbors(pos.size), chainOf = new Map<number, number>(), chains: Group[] = [];
  if (c === 0) return false;
  for (let p = 0; p < pos.board.length; p++) {
    if (pos.board[p] !== c || chainOf.has(p)) continue;
    const g = groupAt(pos.board, pos.size, p);
    for (const s of g.stones) chainOf.set(s, chains.length);
    chains.push(g);
  }
  const alive = new Set(chains.keys());
  const isEye = (e: number) => pos.board[e] === 0 && nb[e].every(r => pos.board[r] === c && alive.has(chainOf.get(r)!));
  for (let changed = true; changed;) {
    changed = false;
    for (const k of [...alive]) {
      if ([...chains[k].liberties].filter(isEye).length < 2) { alive.delete(k); changed = true; }
    }
  }
  return alive.has(chainOf.get(t)!);
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
