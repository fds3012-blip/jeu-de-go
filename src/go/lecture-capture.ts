// Issue #549 : lecteur exact de capture, utilisable dans l'app (réfutation d'un coup faux, solution complète).
// Même recherche que src/go/lecteurs-lot-a.ts (preuve du lot A), généralisée aux deux couleurs et bornée :
//
// - l'attaquant veut prendre une des cibles (pierres marquées du défenseur) en au plus `k` coups à lui ;
// - le défenseur essaie tous ses coups légaux et la passe ; l'attaquant tous ses coups légaux, sauf ceux que la coupe
//   suivante écarte sans risque d'erreur : un coup retire au plus une liberté à une chaîne. Si toutes les cibles ont
//   plus de `k` libertés, aucune ne peut être prise ; si la plus faible en a exactement `k`, l'attaquant doit jouer sur
//   une liberté d'une cible à `k` libertés. La passe de l'attaquant n'est jamais utile (le défenseur repasse) ;
// - budget : au-delà de `budget` coups essayés ou du délai de lecture, la réponse est « inconnue » (`null`), jamais vrai ni faux.
//   Une réponse `true` ou `false` est donc toujours prouvée, quelle que soit la borne.
import { groupAt, neighbors, play, type Color, type Position } from './rules';

/** Vrai, faux, ou inconnu (budget épuisé). */
export type Lecture = boolean | null;

/** Coups essayés au plus par une question (réfutation, solution). */
export const BUDGET_LECTURE = 20_000;
/**
 * Temps de lecture au plus, en millisecondes, pour une question : le joueur ne doit jamais attendre (un téléphone lent
 * lit moins loin, il n'affirme rien de plus). 40 ms tient dans une image et demie.
 */
export const DELAI_LECTURE = 40;
/** K_MAX : coups de l'attaquant au plus ; au-delà, on ne lit pas (la phrase reste celle du problème). */
export const K_MAX = 5;

/**
 * `maitre` (#554, lectures hors ligne) : camp qui n'est jamais tenu par la règle du ko (il reprend aussitôt, menaces sans
 * fin). Une réfutation lue avec le joueur maître du ko ne dépend d'aucun ko : il les gagne tous et échoue quand même.
 */
export interface Compteur { reste: number; fin: number; maitre?: Color }
const maintenant = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
/** `ms` : délai de lecture ; `Infinity` pour une lecture sans limite de temps (tests, preuves hors ligne). */
export const compteur = (budget = BUDGET_LECTURE, ms = DELAI_LECTURE): Compteur => ({ reste: budget, fin: maintenant() + ms });

/** Joue `m` s'il est légal ; chaque essai compte dans le budget. */
const legal = (pos: Position, m: number, c: Compteur): Position | null => {
  // Le temps n'est relu que tous les 256 coups : la lecture du temps coûte plus cher qu'un coup.
  if ((--c.reste & 255) === 0 && maintenant() > c.fin) c.reste = -1;
  const r = play(c.maitre === pos.toPlay && pos.ko !== -1 ? { ...pos, ko: -1 } : pos, m);
  return typeof r === 'string' ? null : r;
};

/** Une des cibles a-t-elle quitté le plateau (prise) ? `def` : couleur du défenseur. */
export const prise = (pos: Position, cibles: readonly number[], def: Color) => cibles.some(t => pos.board[t] !== def);

/**
 * L'attaquant (au trait) prend-il une des cibles en au plus `k` de ses coups, quoi que fasse le défenseur ?
 * `restreint` : l'attaquant ne joue que sur les libertés des cibles (lecture d'échelle). Un `true` reste prouvé (une
 * stratégie gagnante a été trouvée, contre toutes les défenses) ; un `false` ne veut plus rien dire : les appelants le
 * lisent comme « inconnu » (voir `coupsPourPrendre`).
 */
export function attaquantPrend(pos: Position, cibles: readonly number[], k: number, c: Compteur, restreint = false): Lecture {
  const def = (3 - pos.toPlay) as Color;
  if (prise(pos, cibles, def)) return true;
  if (k <= 0) return false;
  if (c.reste < 0) return null;
  const groupes = cibles.map(t => groupAt(pos.board, pos.size, t));
  const min = Math.min(...groupes.map(g => g.liberties.size));
  if (min > k) return false;
  const premiers = new Set<number>();
  for (const g of groupes) if (g.liberties.size === min) for (const l of g.liberties) premiers.add(l);
  if (restreint) for (const g of groupes) for (const l of g.liberties) premiers.add(l);
  const tous = min === k || restreint ? [...premiers] : [...premiers, ...Array.from({ length: pos.board.length }, (_, i) => i)];
  const vus = new Set<number>();
  let inconnu = false;
  for (const m of tous) {
    if (vus.has(m)) continue;
    vus.add(m);
    const r = legal(pos, m, c);
    if (!r) continue;
    const v = defenseurEchoue(r, cibles, k - 1, c, restreint);
    if (v === true) return true;
    if (v === null) inconnu = true;
  }
  return inconnu ? null : false;
}

/** Ordre des défenses : libertés des cibles et leurs voisins d'abord (la réfutation sort vite), la passe, puis le reste. */
export function ordreDefense(pos: Position, cibles: readonly number[]): number[] {
  const nb = neighbors(pos.size), ordre: number[] = [];
  for (const t of cibles) {
    if (!pos.board[t]) continue;
    for (const l of groupAt(pos.board, pos.size, t).liberties) { ordre.push(l); ordre.push(...nb[l]); }
  }
  ordre.push(-1);
  for (let i = 0; i < pos.board.length; i++) ordre.push(i);
  return [...new Set(ordre)];
}

/**
 * Défenses utiles quand une cible est en atari (une seule liberté) : jouer sur cette liberté, ou prendre une chaîne de
 * l'attaquant en atari qui touche cette cible. Tout autre coup (et la passe) la laisse prendre au coup suivant : les
 * écarter ne change pas la réponse (coupe sûre). `null` si aucune cible n'est en atari.
 */
export function defensesEnAtari(pos: Position, cibles: readonly number[]): Set<number> | null {
  const def = pos.toPlay, nb = neighbors(pos.size), utiles = new Set<number>();
  let atari = false;
  for (const t of cibles) {
    if (pos.board[t] !== def) continue;
    const g = groupAt(pos.board, pos.size, t);
    if (g.liberties.size !== 1) continue;
    atari = true;
    g.liberties.forEach(l => utiles.add(l));
    for (const s of g.stones) for (const v of nb[s]) {
      if (pos.board[v] !== 3 - def) continue;
      const a = groupAt(pos.board, pos.size, v);
      if (a.liberties.size === 1) a.liberties.forEach(l => utiles.add(l));
    }
  }
  return atari ? utiles : null;
}

/** Défenseur au trait : toutes ses réponses (coups légaux et passe) laissent-elles l'attaquant prendre en `k` coups ? */
export function defenseurEchoue(pos: Position, cibles: readonly number[], k: number, c: Compteur, restreint = false): Lecture {
  const def = pos.toPlay;
  if (prise(pos, cibles, def)) return true;
  if (k <= 0) return false;
  if (c.reste < 0) return null;
  const utiles = defensesEnAtari(pos, cibles);
  const coups = utiles ? [...utiles] : ordreDefense(pos, cibles);
  let inconnu = false;
  for (const m of coups) {
    const r = legal(pos, m, c);
    if (!r) continue;
    const v = attaquantPrend(r, cibles, k, c, restreint);
    if (v === false) return false;
    if (v === null) inconnu = true;
  }
  return inconnu ? null : true;
}

/** Coups de l'attaquant au plus pour une lecture d'échelle (restreinte aux libertés des cibles). */
export const K_ECHELLE = 12;

/**
 * Plus petit nombre de coups de l'attaquant (1 à `kMax`) pour prendre, l'attaquant étant au trait ; `null` si aucune
 * prise n'est prouvée dans la borne (ou si le budget s'épuise avant). `restreint` : lecture d'échelle, le nombre rendu
 * est celui d'une prise trouvée (pas forcément la plus rapide), et `null` remplace tout « non ».
 */
export function coupsPourPrendre(pos: Position, cibles: readonly number[], c: Compteur, kMax = K_MAX, restreint = false): number | null {
  for (let k = 1; k <= kMax; k++) {
    const v = attaquantPrend(pos, cibles, k, c, restreint);
    if (v === true) return k;
    if (v === null) return null;
  }
  return null;
}

/** Même question, le défenseur au trait : en combien de coups de l'attaquant tombe-t-il au mieux ? */
export function coupsAvantPrise(pos: Position, cibles: readonly number[], c: Compteur, kMax = K_MAX, restreint = false): number | null {
  for (let k = 0; k <= kMax; k++) {
    const v = defenseurEchoue(pos, cibles, k, c, restreint);
    if (v === true) return k;
    if (v === null) return null;
  }
  return null;
}
