// Issue #548 (lot AA) : preuves des problèmes où un ko ou un seki est l'issue, sur le modèle de src/go/preuve-vie-mort.ts.
//
// src/go/preuve-vie-mort.ts arrête toute ligne qui crée un ko (« non résolu ») : il prouve qu'un groupe vit ou meurt
// sans ko, jamais qu'un ko est l'issue juste. Deux outils de plus, dans la même zone fermée (defautsDeZone) :
//
// - `evaluerMaitre` : la même recherche, mais un camp, le « maître du ko », a des menaces sans fin : il n'est jamais
//   tenu par la règle du ko (il reprend aussitôt), et un ko ne coupe plus la ligne. L'autre camp suit la règle du ko
//   simple. Un ko est prouvé quand le défenseur vit s'il est maître du ko (+1), meurt si l'attaquant l'est (-1), et
//   que la recherche ordinaire (preuve-vie-mort) ne tranche pas sans ko (0).
//
// - `survit` : le groupe du défenseur ne peut pas être pris, quoi que fasse l'attaquant, même maître du ko. Sert au seki :
//   aucun des deux ne vit avec deux yeux, mais l'attaquant ne peut rien prendre. Ici, toute coupure (profondeur,
//   répétition sur la ligne, budget) compte comme une prise : la réponse « survit » n'est jamais tirée d'une coupure.
//
// Sûreté : comme dans preuve-vie-mort, +1 et -1 (et `survit` vrai) ne viennent jamais d'une coupure.
import { groupAt, play, type Position } from './rules';
import { hasTwoEyes } from './tactics';
import type { Issue } from './preuve-vie-mort';

export interface OptionsKo {
  /** Nombre maximal de coups (passes comprises). 30 par défaut. */
  profondeur?: number;
  /** `survit` et `pasDeVie` : le camp maître du ko (par défaut, celui à qui la preuve donne l'avantage). */
  maitre?: 1 | 2;
}

/** Coup `m` du camp au trait ; le maître du ko n'est jamais tenu par la règle du ko. */
function jouer(p: Position, m: number, maitre: 1 | 2): Position | null {
  const r = play(p.toPlay === maitre && p.ko !== -1 ? { ...p, ko: -1 } : p, m);
  return typeof r === 'string' ? null : r;
}

/** L'attaquant n'a aucun coup légal dans la zone (ko ignoré). */
function bloque(p: Position, zone: readonly number[], a: 1 | 2): boolean {
  const essai: Position = { ...p, toPlay: a, ko: -1 };
  return zone.every(z => p.board[z] !== 0 || typeof play(essai, z) === 'string');
}

/**
 * Issue (du point de vue du défenseur, le camp de `cible`) quand `maitre` a des menaces de ko sans fin : +1 vivant (deux
 * yeux au sens de Benson, ou l'attaquant n'a plus de coup), -1 pris, 0 non résolu (double passe, profondeur, répétition).
 */
export function evaluerMaitre(pos: Position, cible: number, zone: readonly number[], maitre: 1 | 2, opts: OptionsKo = {}): Issue {
  const d = pos.board[cible];
  if (d === 0) return -1;
  const a = (3 - d) as 1 | 2, prof = opts.profondeur ?? 30;
  const decisif = new Map<string, Issue>(), nul = new Map<string, number>(), enCours = new Set<string>();
  const rec = (p: Position, passes: number, reste: number): Issue => {
    if (p.board[cible] !== d) return -1;
    if (hasTwoEyes(p, cible) || bloque(p, zone, a)) return 1;
    if (passes >= 2 || reste === 0) return 0;
    const cle = `${p.toPlay}${passes}${p.toPlay === maitre ? -1 : p.ko}:${p.board.join('')}`;
    const connu = decisif.get(cle);
    if (connu !== undefined) return connu;
    if ((nul.get(cle) ?? -1) >= reste || enCours.has(cle)) return 0;
    enCours.add(cle);
    const max = p.toPlay === d;
    let best: Issue = max ? -1 : 1;
    for (const m of [...zone.filter(z => p.board[z] === 0), -1]) {
      const r = jouer(p, m, maitre);
      if (!r) continue;
      const v = rec(r, m === -1 ? passes + 1 : 0, reste - 1);
      if (max ? v > best : v < best) best = v;
      if (best === (max ? 1 : -1)) break;
    }
    enCours.delete(cle);
    if (best === 0) nul.set(cle, Math.max(nul.get(cle) ?? -1, reste));
    else decisif.set(cle, best);
    return best;
  };
  return rec(pos, 0, prof);
}

/**
 * Vrai si l'attaquant ne peut jamais prendre la chaîne de `cible`, même maître du ko, le camp au trait jouant le premier.
 * La partie s'arrête à deux passes de suite ; toute coupure (profondeur, répétition) compte comme une prise.
 */
export function survit(pos: Position, cible: number, zone: readonly number[], opts: OptionsKo = {}): boolean {
  const d = pos.board[cible];
  if (d === 0) return false;
  const a = (3 - d) as 1 | 2, prof = opts.profondeur ?? 30, maitre = opts.maitre ?? a;
  const connu = new Map<string, boolean>(), enCours = new Set<string>();
  // Vrai si l'attaquant prend la cible (ou si la ligne est coupée).
  const prend = (p: Position, passes: number, reste: number): boolean => {
    if (p.board[cible] !== d) return true;
    if (passes >= 2) return false;
    if (reste === 0) return true;
    const cle = `${reste}|${p.toPlay}${passes}${p.toPlay === maitre ? -1 : p.ko}:${p.board.join('')}`;
    const c = connu.get(cle);
    if (c !== undefined) return c;
    if (enCours.has(cle)) return true;
    enCours.add(cle);
    const attaque = p.toPlay === a;
    let res = !attaque;
    for (const m of [...zone.filter(z => p.board[z] === 0), -1]) {
      const r = jouer(p, m, maitre);
      if (!r) continue;
      const v = prend(r, m === -1 ? passes + 1 : 0, reste - 1);
      if (attaque && v) { res = true; break; }
      if (!attaque && !v) { res = false; break; }
    }
    enCours.delete(cle);
    connu.set(cle, res);
    return res;
  };
  return !prend(pos, 0, prof);
}

/**
 * Vrai si l'attaquant peut empêcher le défenseur de vivre (deux yeux au sens de Benson, ou attaquant sans coup), même
 * quand le défenseur est maître du ko : issue « seki ou mort », sans ko. La partie s'arrête à deux passes de suite ;
 * toute coupure (profondeur, répétition) compte comme une vie : la réponse vrai n'est jamais tirée d'une coupure.
 */
export function pasDeVie(pos: Position, cible: number, zone: readonly number[], opts: OptionsKo = {}): boolean {
  const d = pos.board[cible];
  if (d === 0) return true;
  const a = (3 - d) as 1 | 2, prof = opts.profondeur ?? 30, maitre = opts.maitre ?? (d as 1 | 2);
  const connu = new Map<string, boolean>(), enCours = new Set<string>();
  // Vrai si le défenseur vit (ou si la ligne est coupée).
  const vit = (p: Position, passes: number, reste: number): boolean => {
    if (p.board[cible] !== d) return false;
    if (hasTwoEyes(p, cible) || bloque(p, zone, a)) return true;
    if (passes >= 2) return false;
    if (reste === 0) return true;
    const cle = `${reste}|${p.toPlay}${passes}${p.toPlay === maitre ? -1 : p.ko}:${p.board.join('')}`;
    const c = connu.get(cle);
    if (c !== undefined) return c;
    if (enCours.has(cle)) return true;
    enCours.add(cle);
    const defend = p.toPlay === d;
    let res = !defend;
    for (const m of [...zone.filter(z => p.board[z] === 0), -1]) {
      const r = jouer(p, m, maitre);
      if (!r) continue;
      const v = vit(r, m === -1 ? passes + 1 : 0, reste - 1);
      if (defend && v) { res = true; break; }
      if (!defend && !v) { res = false; break; }
    }
    enCours.delete(cle);
    connu.set(cle, res);
    return res;
  };
  return !vit(pos, 0, prof);
}

/** Libertés de la chaîne en `p`, triées. */
export const libertes = (pos: Position, p: number): number[] => [...groupAt(pos.board, pos.size, p).liberties].sort((x, y) => x - y);
