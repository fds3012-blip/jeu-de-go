// Lecteur exact du lot N (issue #136) : celui du lot J, écrit pour les deux couleurs.
// L'attaquant est le camp au trait : il cherche à capturer une des cibles (pierres de l'autre couleur) en au plus
// k coups à lui ; le défenseur essaie tous ses coups légaux et la passe. Il sert aux deux objectifs du lot :
// « capture » (Noir attaque des pierres blanches) et « sauve » (après le coup noir, Blanc attaque des pierres noires
// et ne doit pas pouvoir les prendre dans l'horizon choisi).
// Coupe (sûre, celle du lot A) : un coup de l'attaquant ôte au plus une liberté à un groupe, et le défenseur peut
// toujours passer. Si toutes les cibles ont plus de k libertés, aucune ne peut être prise ; si la plus faible en a
// exactement k, l'attaquant doit jouer sur une de ses libertés.
// Table de transposition (sûre) : le résultat ne dépend que du plateau, du camp au trait, du point de ko et du nombre
// de coups restants (cibles et options sont fixées pour toute une recherche) ; une même recherche le calcule une fois.
// Avec `ko: false`, toute prise qui crée un ko est interdite aux deux camps : si le résultat ne change pas, le
// problème ne dépend d'aucun ko.
import { groupAt, neighbors, play, type Position } from './rules';

export interface Options { ko: boolean }
export const AVEC_KO: Options = { ko: true };
export const SANS_KO: Options = { ko: false };

export const legal = (pos: Position, m: number, o: Options): Position | null => {
  const r = play(pos, m);
  if (typeof r === 'string') return null;
  return !o.ko && r.ko !== -1 ? null : r;
};

/** Résultats déjà calculés d'une recherche (mêmes cibles, mêmes options). */
export type Memo = Map<string, boolean>;
const keyOf = (pos: Position, side: 'a' | 'd', k: number) => `${side}${k}:${pos.toPlay}:${pos.ko}:${pos.board.join('')}`;

/** Une des cibles a-t-elle quitté le plateau (sa couleur d'origine est `c`) ? */
const taken = (pos: Position, targets: readonly number[], c: number) => targets.some(t => pos.board[t] !== c);

/** Attaquant au trait : prend-il une des cibles (couleur de l'adversaire) en au plus `k` coups, quoi qu'il arrive ? */
export function attackerCaptures(pos: Position, targets: readonly number[], k: number, o: Options = AVEC_KO,
  memo: Memo = new Map()): boolean {
  const c = 3 - pos.toPlay;
  if (taken(pos, targets, c)) return true;
  if (k <= 0) return false;
  const key = keyOf(pos, 'a', k), known = memo.get(key);
  if (known !== undefined) return known;
  const res = attackerSearch(pos, targets, k, o, memo);
  memo.set(key, res);
  return res;
}

function attackerSearch(pos: Position, targets: readonly number[], k: number, o: Options, memo: Memo): boolean {
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
    if (r && defenderFails(r, targets, k - 1, o, memo)) return true;
  }
  return false;
}

/** Défenseur au trait : toutes ses réponses (coups légaux et passe) laissent-elles l'attaquant prendre en `k` coups ? */
export function defenderFails(pos: Position, targets: readonly number[], k: number, o: Options = AVEC_KO,
  memo: Memo = new Map()): boolean {
  const c = pos.toPlay;
  if (taken(pos, targets, c)) return true;
  if (k <= 0) return false;
  const key = keyOf(pos, 'd', k), known = memo.get(key);
  if (known !== undefined) return known;
  const res = defenderSearch(pos, targets, k, o, memo);
  memo.set(key, res);
  return res;
}

function defenderSearch(pos: Position, targets: readonly number[], k: number, o: Options, memo: Memo): boolean {
  const nb = neighbors(pos.size), order: number[] = [];
  for (const t of targets) for (const l of groupAt(pos.board, pos.size, t).liberties) { order.push(l); order.push(...nb[l]); }
  order.push(-1);
  for (let i = 0; i < pos.board.length; i++) order.push(i);
  const seen = new Set<number>();
  for (const m of order) {
    if (seen.has(m)) continue;
    seen.add(m);
    const r = legal(pos, m, o);
    if (r && !attackerCaptures(r, targets, k, o, memo)) return false;
  }
  return true;
}

/** Capture : le coup noir `m` prend-il une des cibles blanches en au plus `k` coups noirs (celui-ci compris) ? */
export function captureEn(pos: Position, m: number, targets: readonly number[], k: number, o: Options = AVEC_KO): boolean {
  const r = legal(pos, m, o);
  return !!r && defenderFails(r, targets, k - 1, o);
}

/** Sauvetage : après le coup noir `m`, Blanc au trait ne peut prendre aucune cible noire en `horizon` coups blancs. */
export function sauveEn(pos: Position, m: number, targets: readonly number[], horizon: number, o: Options = AVEC_KO): boolean {
  const r = legal(pos, m, o);
  return !!r && targets.every(t => r.board[t] === 1) && !attackerCaptures(r, targets, horizon, o);
}
