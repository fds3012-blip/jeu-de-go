// Numéros des coups sur les pierres (#365, réglage « Numéros des coups » de la revue). Logique pure.
import type { Position } from './rules';

/**
 * Numéro du coup qui a posé chaque pierre encore sur le plateau à la position `jusqua` (0 : départ).
 * Un point repris puis rejoué porte le numéro du dernier coup joué dessus ; les passes ne numérotent rien ;
 * les pierres de départ (handicap, position posée) n'ont pas de numéro.
 */
export function numerosDesCoups(positions: readonly Position[], jusqua: number): Map<number, number> {
  const fin = Math.max(0, Math.min(jusqua, positions.length - 1));
  const numeros = new Map<number, number>();
  for (let k = 1; k <= fin; k++) {
    const p = positions[k].lastMove;
    if (p != null && p >= 0) numeros.set(p, k);
  }
  const plateau = positions[fin].board;
  for (const p of [...numeros.keys()]) if (!plateau[p]) numeros.delete(p);
  return numeros;
}
