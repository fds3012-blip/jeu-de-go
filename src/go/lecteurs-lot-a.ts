// Lecteur exact pour le lot A (issue #91) : « Noir capture une des pierres visées en au plus k coups noirs ».
// Recherche complète : Blanc essaie tous ses coups légaux et la passe ; Noir essaie tous ses coups légaux,
// sauf ceux que la coupe suivante écarte sans risque d'erreur.
//
// Coupe (sûre) : un coup noir retire au plus une liberté à un groupe blanc. Si toutes les cibles ont plus de
// k libertés alors qu'il reste k coups noirs, Blanc n'a qu'à passer : aucune ne peut être prise. Et si la cible
// la plus faible a exactement k libertés, Noir doit jouer sur une liberté d'une cible à k libertés, sinon Blanc
// passe et l'on retombe dans le premier cas.
import { groupAt, neighbors, play, type Position } from './rules';

const legal = (pos: Position, m: number): Position | null => {
  const r = play(pos, m);
  return typeof r === 'string' ? null : r;
};

/** Une des cibles a-t-elle disparu du plateau ? */
const taken = (pos: Position, targets: number[]) => targets.some(t => pos.board[t] !== 2);

/** Noir au trait : capture-t-il une des cibles en au plus `k` coups noirs, quoi que fasse Blanc ? */
export function blackCaptures(pos: Position, targets: number[], k: number): boolean {
  if (taken(pos, targets)) return true;
  if (k <= 0) return false;
  const groups = targets.map(t => groupAt(pos.board, pos.size, t));
  const min = Math.min(...groups.map(g => g.liberties.size));
  if (min > k) return false;
  const first = new Set<number>();
  for (const g of groups) if (g.liberties.size === min) for (const l of g.liberties) first.add(l);
  const all = min === k ? [...first] : [...first, ...Array.from({ length: pos.board.length }, (_, i) => i)];
  const seen = new Set<number>();
  for (const m of all) {
    if (seen.has(m)) continue;
    seen.add(m);
    const r = legal(pos, m);
    if (r && whiteFails(r, targets, k - 1)) return true;
  }
  return false;
}

/** Blanc au trait : toutes ses réponses (coups légaux et passe) laissent-elles Noir capturer en `k` coups ? */
export function whiteFails(pos: Position, targets: number[], k: number): boolean {
  if (taken(pos, targets)) return true;
  if (k <= 0) return false;
  // On essaie d'abord les défenses naturelles (libertés des cibles et leurs voisins) : la réfutation sort vite.
  const nb = neighbors(pos.size), order: number[] = [];
  for (const t of targets) for (const l of groupAt(pos.board, pos.size, t).liberties) { order.push(l); order.push(...nb[l]); }
  order.push(-1);
  for (let i = 0; i < pos.board.length; i++) order.push(i);
  const seen = new Set<number>();
  for (const m of order) {
    if (seen.has(m)) continue;
    seen.add(m);
    const r = legal(pos, m);
    if (r && !blackCaptures(r, targets, k)) return false;
  }
  return true;
}

/** Tous les premiers coups noirs légaux qui capturent une des cibles en au plus `k` coups noirs. */
export function winningMoves(pos: Position, targets: number[], k: number): number[] {
  const out: number[] = [];
  for (let m = 0; m < pos.board.length; m++) {
    const r = legal(pos, m);
    if (r && whiteFails(r, targets, k - 1)) out.push(m);
  }
  return out;
}
