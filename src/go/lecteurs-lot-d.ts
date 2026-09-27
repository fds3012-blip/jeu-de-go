// Lecteurs du lot D (issue #91) : ensemble exact des coups gagnants pour un objectif de capture ou de sauvetage.
import { play, type Position } from './rules';
import { captureWorks } from './tactics';

/** Tous les coups légaux (et la passe) du camp au trait. */
export const legalMoves = (pos: Position) =>
  [...Array(pos.size * pos.size).keys(), -1].filter(m => typeof play(pos, m) !== 'string');

/**
 * Capture : après le coup noir `m`, chaque pierre de `targets` (blanche) finit capturée contre toute réponse
 * légale de Blanc, passe comprise : pour chaque réponse, le lecteur de capture trouve la prise.
 */
export function captureAfter(pos: Position, m: number, targets: number[], depth = 10): boolean {
  if (m === -1) return false;
  const r = play(pos, m);
  if (typeof r === 'string') return false;
  return targets.every(t => {
    if (r.board[t] === 0) return true;
    return legalMoves(r).every(w => {
      const x = play(r, w) as Position;
      return x.board[t] === 0 || captureWorks(x, t, depth);
    });
  });
}

/** Sauvetage : après le coup noir `m`, Blanc au trait ne peut capturer aucune des pierres `stones`. */
export function saveAfter(pos: Position, m: number, stones: number[], depth = 10): boolean {
  if (m === -1) return false;
  const r = play(pos, m);
  if (typeof r === 'string') return false;
  return stones.every(s => r.board[s] === 1 && !captureWorks(r, s, depth));
}

/** Ensemble des coups noirs gagnants (la passe exclue). */
export function winningMoves(pos: Position, test: (m: number) => boolean): number[] {
  return legalMoves(pos).filter(m => m !== -1 && test(m));
}
