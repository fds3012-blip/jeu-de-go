// Lecteur exact du lot J (issue #136) : celui du lot A (« Noir capture une des cibles en au plus k coups noirs »,
// tous les coups légaux de Blanc et la passe), avec une option pour interdire toute prise qui crée un ko.
// Avec `ko: false`, ni Noir ni Blanc ne peuvent prendre en ko : si le résultat est le même qu'avec `ko: true`,
// le problème ne dépend d'aucun ko. La coupe est celle du lot A (sûre : un coup noir ôte au plus une liberté).
import { toLabel } from './coords';
import { groupAt, neighbors, play, type Position } from './rules';

export interface Options { ko: boolean }

const legal = (pos: Position, m: number, o: Options): Position | null => {
  const r = play(pos, m);
  if (typeof r === 'string') return null;
  return !o.ko && r.ko !== -1 ? null : r;
};

const taken = (pos: Position, targets: number[]) => targets.some(t => pos.board[t] !== 2);

/** Noir au trait : capture-t-il une des cibles en au plus `k` coups noirs, quoi que fasse Blanc ? */
export function blackCaptures(pos: Position, targets: number[], k: number, o: Options = { ko: true }): boolean {
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
    const r = legal(pos, m, o);
    if (r && whiteFails(r, targets, k - 1, o)) return true;
  }
  return false;
}

/** Blanc au trait : toutes ses réponses (coups légaux et passe) laissent-elles Noir capturer en `k` coups ? */
export function whiteFails(pos: Position, targets: number[], k: number, o: Options = { ko: true }): boolean {
  if (taken(pos, targets)) return true;
  if (k <= 0) return false;
  const nb = neighbors(pos.size), order: number[] = [];
  for (const t of targets) for (const l of groupAt(pos.board, pos.size, t).liberties) { order.push(l); order.push(...nb[l]); }
  order.push(-1);
  for (let i = 0; i < pos.board.length; i++) order.push(i);
  const seen = new Set<number>();
  for (const m of order) {
    if (seen.has(m)) continue;
    seen.add(m);
    const r = legal(pos, m, o);
    if (r && !blackCaptures(r, targets, k, o)) return false;
  }
  return true;
}

/** Premiers coups noirs (libellés triés) qui capturent une cible en au plus `k` coups noirs contre toute défense. */
export function captureWinners(pos: Position, targets: number[], k: number, o: Options = { ko: true }): string[] {
  const out: string[] = [];
  for (let m = 0; m < pos.board.length; m++) {
    const r = legal(pos, m, o);
    if (r && whiteFails(r, targets, k - 1, o)) out.push(toLabel(m, pos.size));
  }
  return out.sort();
}
