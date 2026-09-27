// Avance estimée (#159) : la barre d'avantage compte avec la même règle que le comptage final.
// Avant, l'estimation additionnait la propriété de toutes les intersections (pierres comprises) : c'est un
// comptage chinois, sans les prisonniers, et les frontières ouvertes y étaient attribuées à quelqu'un. Le jeu
// compte en japonais (territoire + prisonniers) et une zone ouverte y reste neutre : la barre contredisait le score.
import { frontieresOuvertes } from './frontieres';
import type { Position } from './rules';
import { score, type Rules } from './score';

export interface OptionsAvance {
  /** Règle de comptage de la partie (japonais par défaut, comme l'écran de partie). */
  rules?: Rules;
  /**
   * Compter comme si la partie s'arrêtait maintenant : les frontières ouvertes restent neutres, comme au comptage.
   * Sinon on les partage selon la propriété estimée (ce qu'elles deviendront une fois fermées).
   */
  fin?: boolean;
  /** Seuil de propriété au-delà duquel une pierre est comptée morte (0,5 par défaut). */
  seuilMort?: number;
}

/** Pierres mortes d'après une carte de propriété (de -1 Blanc à +1 Noir) : nettement du côté adverse. */
export function mortesSelonPropriete(pos: Position, own: ArrayLike<number>, seuil = 0.5): number[] {
  const out: number[] = [];
  for (let p = 0; p < pos.board.length; p++) {
    const v = pos.board[p];
    if ((v === 1 && own[p] < -seuil) || (v === 2 && own[p] > seuil)) out.push(p);
  }
  return out;
}

/**
 * Avance de Noir en points, komi compris, d'après une carte de propriété `own` (de -1 Blanc à +1 Noir).
 * - Pierres mortes (propriété nettement adverse) : retirées et comptées comme prisonniers, comme au comptage.
 * - Zones fermées : territoire exact de `score` (même règle, même traitement du seki).
 * - Frontières ouvertes : neutres si `fin`, sinon partagées selon `own`.
 * Sur une position finie (aucune frontière ouverte), le résultat est exactement `score(...).black - score(...).white`
 * avec les mêmes pierres mortes : la barre converge vers le vrai score.
 * En milieu de partie, une grande zone « fermée » par une seule pierre n'est pas un territoire sûr : on y suit
 * aussi la propriété estimée, sauf pour les zones dont la propriété confirme le propriétaire.
 */
export function avanceEstimee(pos: Position, own: ArrayLike<number>, komi: number, opts: OptionsAvance = {}): number {
  const rules = opts.rules ?? 'japanese';
  const dead = new Set(mortesSelonPropriete(pos, own, opts.seuilMort));
  const s = score(pos, komi, rules, dead);
  let lead = s.black - s.white;
  // Zones fermées dont la propriété estimée dit autre chose (milieu de partie) : on corrige vers l'estimation.
  for (let p = 0; p < pos.board.length; p++) {
    const o = s.owner[p];
    if (!o || (pos.board[p] && !dead.has(p))) continue;
    const v = own[p], sens = o === 1 ? 1 : -1;
    // Point compté sens (±1) ; l'estimation vaut v. Écart toléré : une zone sûre a |v| proche de 1.
    if (sens * v < 0.5) lead += v - sens;
  }
  if (!opts.fin) for (const p of frontieresOuvertes(pos.board, pos.size, dead)) lead += own[p];
  return lead;
}
