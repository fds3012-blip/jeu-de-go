// Issue #16 (leçons 23 et 24) : preuve exacte d'une petite fin de partie, pour « sente et gote » et « le hane au premier
// rang ». Recherche minimax sur une liste de points (la zone) et la passe ; la partie s'arrête après deux passes et se compte
// avec score() de src/go/score.ts. Valeur : points de Noir moins points de Blanc, sans komi.
//
// Sûreté : la recherche est bornée en nombre de coups. Une ligne qui atteint la borne reçoit la pire valeur pour Noir (borne
// basse), puis, dans une seconde recherche, la meilleure (borne haute). Si les deux recherches donnent la même valeur, elle
// est exacte : chaque camp peut forcer la fin de la partie avant la borne sans rien perdre. Sinon `valeurExacte` lève une
// erreur ; aucune preuve n'est tirée d'une coupure. Le ko suit la règle du moteur (ko simple, src/go/rules.ts).
//
// Règle de comptage. Le compte japonais de score() ne retire pas les pierres mortes : dans une recherche, une pierre posée
// chez l'adversaire et jamais prise rendrait son territoire neutre, et la prendre coûterait des points. Le compte par surfaces
// (« chinese ») n'a pas ce défaut : prendre chez soi ne coûte rien. Les tests prouvent donc le meilleur coup avec les deux
// comptes quand les zones sont fermées (leçon 23), et avec le compte par surfaces quand une pierre peut entrer chez
// l'adversaire (leçon 24) ; les chiffres annoncés au joueur sont ensuite comptés en règle japonaise sur la suite prouvée.
import { play, type Position } from './rules';
import { score, type Rules } from './score';

export interface OptionsFin {
  /** Nombre maximal de coups (passes comprises). 16 par défaut. */
  profondeur?: number;
  /** Règle de comptage de score(). Japonaise par défaut. */
  regle?: Rules;
}

/** Bornes connues de la valeur d'une position (à profondeur et coupure fixées) et le meilleur coup trouvé. */
interface Entree { bas: number; haut: number; coup: number }

/**
 * Minimax à profondeur bornée, avec élagage alpha-bêta (#16, leçons 32 et suivantes). La valeur rendue à la racine,
 * fenêtre pleine, est exactement celle du minimax simple : l'élagage ne coupe que des coups qui ne peuvent pas changer le
 * choix. La table garde, pour chaque position (profondeur restante comprise), un encadrement de sa valeur.
 */
function borne(pos: Position, zone: readonly number[], prof: number, coupure: number, regle: Rules,
  table: Map<string, Entree>, passes: number, alpha = -Infinity, beta = Infinity): number {
  if (passes >= 2) { const s = score(pos, 0, regle); return s.black - s.white; }
  if (prof === 0) return coupure;
  const cle = `${prof}|${pos.toPlay}${passes}${pos.ko}:${pos.board.join('')}`;
  const connu = table.get(cle);
  if (connu) {
    if (connu.bas === connu.haut || connu.bas >= beta) return connu.bas;
    if (connu.haut <= alpha) return connu.haut;
    alpha = Math.max(alpha, connu.bas);
    beta = Math.min(beta, connu.haut);
  }
  const a0 = alpha, b0 = beta, max = pos.toPlay === 1;
  const coups = [...zone.filter(p => pos.board[p] === 0), -1];
  if (connu && connu.coup !== undefined && coups.includes(connu.coup)) coups.unshift(...coups.splice(coups.indexOf(connu.coup), 1));
  let best = max ? -Infinity : Infinity, meilleur = -1;
  for (const z of coups) {
    const r = play(pos, z);
    if (typeof r === 'string') continue;
    const v = borne(r, zone, prof - 1, coupure, regle, table, z < 0 ? passes + 1 : 0, alpha, beta);
    if (max ? v > best : v < best) { best = v; meilleur = z; }
    if (max) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  // Fail-soft : sous la fenêtre, `best` est un majorant ; au-dessus, un minorant ; dedans, la valeur exacte.
  const bas = Math.max(connu?.bas ?? -Infinity, best <= a0 ? -Infinity : best);
  const haut = Math.min(connu?.haut ?? Infinity, best >= b0 ? Infinity : best);
  table.set(cle, { bas, haut, coup: meilleur });
  return best;
}

/**
 * Valeur exacte (Noir − Blanc) de la position, le camp au trait jouant le premier. `passes` : passes déjà jouées juste avant.
 * Lève une erreur si la borne de profondeur ne suffit pas à la prouver.
 */
export function valeurExacte(pos: Position, zone: readonly number[], opts: OptionsFin = {}, passes = 0): number {
  const prof = opts.profondeur ?? 16, regle = opts.regle ?? 'japanese';
  const bas = borne(pos, zone, prof, -Infinity, regle, new Map(), passes);
  const haut = borne(pos, zone, prof, Infinity, regle, new Map(), passes);
  if (bas !== haut) throw new Error(`fin de partie non prouvée à ${prof} coups : ${bas} / ${haut}`);
  return bas;
}

/** Valeur exacte après chaque coup légal du camp au trait (points de la zone, et -1 pour la passe). */
export function valeursDesCoups(pos: Position, zone: readonly number[], opts: OptionsFin = {}): Map<number, number> {
  const out = new Map<number, number>();
  const prof = (opts.profondeur ?? 16) - 1;
  for (const z of [...zone.filter(p => pos.board[p] === 0), -1]) {
    const r = play(pos, z);
    if (typeof r === 'string') continue;
    out.set(z, valeurExacte(r, zone, { ...opts, profondeur: prof }, z < 0 ? 1 : 0));
  }
  return out;
}

/** Meilleurs coups du camp au trait (tous ceux qui atteignent la valeur exacte de la position). */
export function meilleursCoups(pos: Position, zone: readonly number[], opts: OptionsFin = {}): number[] {
  const v = valeursDesCoups(pos, zone, opts);
  const vals = [...v.values()];
  const best = pos.toPlay === 1 ? Math.max(...vals) : Math.min(...vals);
  return [...v.entries()].filter(([, x]) => x === best).map(([m]) => m);
}
