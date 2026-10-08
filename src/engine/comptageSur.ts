// Comptage sûr des premières parties (#486) : pendant les 3 premières parties terminées sur l'appareil, Mochi marque
// les pierres mortes tout seul, comme BadukPop. Règle d'or : aucun faux conseil.
// - Un groupe est marqué mort seulement si les méthodes du comptage automatique (#117 : simulations, KataGo s'il est
//   déjà chargé) sont d'accord et nettes, ou si une preuve exacte et bornée le montre (src/go/preuve-vie-mort.ts).
// - Un groupe incertain que la preuve ne tranche pas n'est PAS marqué : il reste au joueur, avec la phrase de doute.
// - La preuve l'emporte sur les simulations : elles peuvent croire vivant un groupe mort (point vital déjà pris).
//
// Preuve d'un groupe discutable (sans deux yeux sûrs). On cherche son enclos : les points reliés au groupe sans traverser une pierre de
// l'adversaire (vides et pierres du groupe), plus les pierres adverses enfermées dedans (toutes leurs libertés dans
// l'enclos). Si l'enclos est petit et fermé (`defautsDeZone` vide : murs adverses à deux libertés au moins hors de
// l'enclos), on lance la recherche exhaustive de preuve-vie-mort dans l'enclos :
// - le groupe joue le premier et finit capturé quoi qu'il fasse : mort, sans discussion ;
// - l'adversaire joue le premier et ne peut ni le prendre ni l'empêcher de vivre : vivant.
// Ko, seki, profondeur ou budget atteint : non résolu, le groupe reste incertain. Les murs adverses doivent aussi être
// jugés vivants et sûrs par le comptage (ni morts, ni incertains) : sinon, on ne prouve rien.
//
// Bornes (mémoire et temps, un conteneur a déjà redémarré à cause d'une recherche géante) : enclos de `zoneMax` points
// vides au plus, `budget` positions par recherche, et un délai global (`timeMs`) ; au-delà, on s'arrête et le doute reste.
// Synchrone et sans DOM : tourne dans le Worker du moteur simple (repli sur le fil principal, borné de même).
import { groupAt, neighbors, type Color, type Position } from '../go/rules';
import { defautsDeZone, evaluer } from '../go/preuve-vie-mort';
import { groupesDiscutables, type ComptageAuto } from './dead';
import { now } from './sim';

/** Bornes de la preuve : points vides de l'enclos, positions par recherche, coups par ligne, délai global (ms). */
export const PREUVE = { zoneMax: 12, budget: 5000, profondeur: 24, timeMs: 500 } as const;

export interface OptionsPreuve { zoneMax?: number; budget?: number; profondeur?: number; timeMs?: number }

/** Groupes tranchés par la preuve : pierres prouvées mortes, pierres prouvées vivantes. */
export interface Tranche { morts: number[]; vivants: number[] }

/**
 * Enclos de la chaîne `cible` (voir l'en-tête), ou null s'il dépasse `zoneMax` points vides. Rendu trié : tous les
 * points de l'enclos (vides, pierres du groupe, pierres adverses enfermées).
 */
export function enclos(pos: Position, cible: number, zoneMax: number = PREUVE.zoneMax): number[] | null {
  const { board, size } = pos, d = board[cible], a = 3 - d, nb = neighbors(size);
  if (!d) return null;
  const dans = new Uint8Array(board.length), pile = [cible], out: number[] = [];
  let vides = 0;
  dans[cible] = 1;
  const etendre = () => {
    while (pile.length) {
      const q = pile.pop()!;
      out.push(q);
      if (!board[q] && ++vides > zoneMax) return false;
      for (const r of nb[q]) if (!dans[r] && board[r] !== a) { dans[r] = 1; pile.push(r); }
    }
    return true;
  };
  if (!etendre()) return null;
  // Pierres adverses enfermées : toutes leurs libertés sont dans l'enclos. On les ajoute, puis on étend encore.
  for (let change = true; change;) {
    change = false;
    const vu = new Uint8Array(board.length);
    for (const q of [...out]) for (const r of nb[q]) {
      if (board[r] !== a || dans[r] || vu[r]) continue;
      const g = groupAt(board, size, r);
      for (const s of g.stones) vu[s] = 1;
      if (![...g.liberties].every(l => dans[l])) continue;
      for (const s of g.stones) { dans[s] = 1; pile.push(s); }
      change = true;
    }
    if (change && !etendre()) return null;
  }
  return out.sort((x, y) => x - y);
}

/** Chaînes parmi les pierres `pierres`. */
function chaines(pos: Position, pierres: readonly number[]): number[][] {
  const vu = new Set<number>(), out: number[][] = [];
  for (const p of pierres) {
    if (vu.has(p) || !pos.board[p]) continue;
    const g = groupAt(pos.board, pos.size, p).stones;
    for (const s of g) vu.add(s);
    out.push(g);
  }
  return out;
}

/**
 * Vérifie par une preuve exacte et bornée les groupes discutables (sans deux yeux) du comptage `c` : d'abord les
 * incertains, puis les autres (une simulation peut croire vivant un groupe mort, voir les tests). Les murs doivent être
 * sûrs : ni morts proposés, ni incertains. Rend seulement ce qui est prouvé.
 */
export function trancherParPreuve(pos: Position, c: ComptageAuto, opts: OptionsPreuve = {}): Tranche {
  const zoneMax = opts.zoneMax ?? PREUVE.zoneMax, budget = opts.budget ?? PREUVE.budget;
  const profondeur = opts.profondeur ?? PREUVE.profondeur, fin = now() + (opts.timeMs ?? PREUVE.timeMs);
  const pasSur = new Set([...c.dead, ...c.incertains]), incertains = new Set(c.incertains);
  const groupes = groupesDiscutables(pos).map(g => g.stones);
  groupes.sort((x, y) => Number(incertains.has(y[0])) - Number(incertains.has(x[0])));
  const morts: number[] = [], vivants: number[] = [], nb = neighbors(pos.size);
  for (const g of groupes) {
    if (now() > fin) break;
    const cible = g[0], d = pos.board[cible] as Color, a = (3 - d) as Color;
    const zone = enclos(pos, cible, zoneMax);
    if (!zone || defautsDeZone(pos, cible, zone).length) continue;
    // Murs : pierres adverses au contact de l'enclos, hors de l'enclos. Toutes doivent être sûres.
    const dansZone = new Set(zone);
    if (zone.some(q => nb[q].some(r => pos.board[r] === a && !dansZone.has(r) && pasSur.has(r)))) continue;
    const base: Position = { ...pos, ko: -1 };
    // Mort : le groupe joue le premier et finit pris quand même.
    if (evaluer({ ...base, toPlay: d }, cible, zone, { profondeur, budget }) === -1) { morts.push(...g); continue; }
    if (now() > fin) break;
    // Vivant : l'adversaire joue le premier et ne peut rien.
    if (evaluer({ ...base, toPlay: a }, cible, zone, { profondeur, budget }) === 1) vivants.push(...g);
  }
  return { morts: morts.sort((x, y) => x - y), vivants: vivants.sort((x, y) => x - y) };
}

/**
 * Comptage sûr : à partir du comptage automatique `base` (#117) et de ce que la preuve a tranché (la preuve l'emporte) :
 * - morts : les morts proposés hors groupes incertains et hors groupes prouvés vivants, plus les groupes prouvés morts ;
 * - incertains : ceux que la preuve n'a pas tranchés. Ils ne sont pas marqués : le joueur décide.
 * `prouves` : nombre de groupes (chaînes) qui changent grâce à la preuve (incertain tranché, ou simulation corrigée).
 */
export function comptageSur(pos: Position, base: ComptageAuto, t: Tranche): ComptageAuto & { prouves: number } {
  const incertains = new Set(base.incertains), vivants = new Set(t.vivants), avant = new Set(base.dead);
  const dead = [...new Set([...base.dead.filter(p => !incertains.has(p) && !vivants.has(p)), ...t.morts])].sort((x, y) => x - y);
  const tranches = new Set([...t.morts, ...t.vivants]);
  const reste = base.incertains.filter(p => !tranches.has(p));
  const changes = [...t.morts.filter(p => incertains.has(p) || !avant.has(p)), ...t.vivants.filter(p => incertains.has(p) || avant.has(p))];
  return { dead, incertains: reste, prouves: chaines(pos, changes).length };
}
