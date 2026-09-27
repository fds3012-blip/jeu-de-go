// Lecteurs du lot B (issue #91) : ensemble exact des coups gagnants d'un problème de capture.
// S'appuie sur captureWorks (tactics.ts, non modifié) ; ici, la défense de Blanc parcourt tous ses coups légaux.
import { groupAt, neighbors, play, type Position } from './rules';
import { captureWorks, ladderWorks } from './tactics';

/** Tous les coups légaux du camp au trait, passe (-1) comprise. */
export const legalMoves = (pos: Position): number[] =>
  [...Array(pos.size * pos.size).keys(), -1].filter(m => typeof play(pos, m) !== 'string');

/** Défenses « naturelles » de Blanc, essayées d'abord pour réfuter vite un mauvais coup noir. */
function likelyDefences(pos: Position, t: number): number[] {
  const nb = neighbors(pos.size), g = groupAt(pos.board, pos.size, t), out = new Set<number>([...g.liberties, -1]);
  for (const m of g.liberties) for (const r of nb[m]) if (pos.board[r] === 0) out.add(r);
  for (const s of g.stones) for (const r of nb[s]) {
    if (pos.board[r] !== 3 - pos.board[t]) continue;
    const h = groupAt(pos.board, pos.size, r);
    if (h.liberties.size <= 2) for (const m of h.liberties) out.add(m);
  }
  return [...out];
}

/** Noir au trait : prend-il au moins une des cibles (déjà prise, échelle, ou captureWorks en `depth` coups) ? */
const takesOne = (pos: Position, ts: number[], depth: number) =>
  ts.some(t => pos.board[t] === 0 || captureWorks(pos, t, depth) || ladderWorks(pos, t));

/**
 * Blanc au trait : Noir capture-t-il la cible `t` (ou, pour une liste, au moins l'une des cibles), quelle que soit
 * la réponse blanche (tous ses coups légaux, passe comprise) ? Après chaque réponse, Noir doit capturer : par échelle
 * (ladderWorks) ou avec captureWorks en au plus `depth` coups.
 */
export function capturedAgainstAll(pos: Position, t: number | number[], depth = 10): boolean {
  const ts = Array.isArray(t) ? t : [t];
  if (ts.some(s => pos.board[s] === 0)) return true;
  const first = [...new Set(ts.flatMap(s => likelyDefences(pos, s)))];
  const rest = legalMoves(pos).filter(m => !first.includes(m));
  for (const w of [...first, ...rest]) {
    const r = play(pos, w);
    if (typeof r === 'string') continue;
    if (!takesOne(r, ts, depth)) return false;
  }
  return true;
}

/** Coups noirs gagnants : ceux après lesquels la cible (ou l'une des cibles) est capturée contre toute défense. */
export function winningMoves(pos: Position, t: number | number[], depth = 10): number[] {
  return legalMoves(pos).filter(m => {
    const r = play(pos, m);
    return typeof r !== 'string' && capturedAgainstAll(r, t, depth);
  });
}
