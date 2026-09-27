// Choix du coup d'un niveau KataGo à partir d'une analyse : on garde les coups dont la perte
// reste sous la tolérance du niveau, puis le style oriente le tirage parmi eux.
import { neighbors, type Position } from '../../go/rules';
import type { KataGoLevel, Style } from '../simple';
import type { Analysis, MoveInfo } from './search';

/** Bonus multiplicatif d'un coup selon le style (1 = neutre). */
export function styleBonus(pos: Position, move: number, style: Style): number {
  if (move < 0) return 1;
  const { size, board } = pos, me = pos.toPlay, opp = 3 - me, nb = neighbors(size)[move];
  const contact = nb.some(q => board[q] === opp), touchesMine = nb.some(q => board[q] === me);
  const x = move % size, y = (move - x) / size, line = Math.min(x, y, size - 1 - x, size - 1 - y) + 1;
  if (style === 'agressif') return contact ? 2.5 : 1;
  if (style === 'territorial') {
    const bordure = size <= 9 ? line === 2 || line === 3 : line === 3 || line === 4;
    return (bordure ? 2 : 1) * (contact ? 0.7 : 1);
  }
  // Solide : reste relié à ses pierres, évite le contact direct sans soutien.
  return touchesMine ? 2 : contact ? 0.6 : 1;
}

/**
 * Coup joué par un niveau. `rand` renvoie un réel dans [0, 1[ (graine reproductible dans les tests).
 * Tolérance 0 : toujours le meilleur coup de la recherche.
 */
export function chooseFromAnalysis(a: Analysis, pos: Position, lvl: KataGoLevel, rand: () => number = Math.random): number {
  const best = a.moves[0];
  if (!best) return -1;
  // L'adversaire vient de passer et passer ne coûte (presque) rien : on termine la partie.
  if (pos.lastMove === -1) {
    const pass = a.moves.find(m => m.move === -1);
    if (best.move === -1 || (pass && pass.visits > 0 && pass.scoreLoss <= 0.5)) return -1;
  }
  if (best.move === -1 || lvl.tolerance <= 0) return best.move;
  // Coups acceptables : visités et sous la tolérance. Les coups peu visités ont une estimation bruitée :
  // on ne les garde que si la politique les juge plausibles.
  const ok: MoveInfo[] = a.moves.filter(m => m.move !== -1 && m.scoreLoss <= lvl.tolerance && (m === best || m.visits >= 2 || (lvl.tolerance >= 5 && m.prior >= 0.05)));
  if (ok.length <= 1) return best.move;
  const weights = ok.map(m => {
    const base = lvl.style === 'solide' ? m.visits + 1 : Math.sqrt(m.prior) * (m.visits + 1);
    // Plus la perte est forte, moins le coup est tiré (même sous la tolérance).
    return base * styleBonus(pos, m.move, lvl.style) * Math.exp(-m.scoreLoss / Math.max(0.5, lvl.tolerance));
  });
  let r = rand() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < ok.length; i++) { r -= weights[i]; if (r <= 0) return ok[i].move; }
  return ok[ok.length - 1].move;
}
