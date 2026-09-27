// Issue #162 : logique de la pastille « +N XP » (séparée du composant pour le rechargement à chaud).
import type { Gain } from '../app/xp';

/** Libellé lu et affiché : « +45 XP », avec une espace insécable. */
export const texteXp = (points: number) => `+${points}\u00A0XP`;

/** Durée d'affichage : le temps de lire deux mots, sans gêner l'action suivante. */
export const DUREE_XP_MS = 2400;
export const SORTIE_XP_MS = 160;

export interface Affiche { points: number; bonus: number; niveauFranchi: boolean }

/** Cumule les gains qui tombent pendant qu'une pastille est déjà affichée (ex. deux gains à la même fin). */
export function cumuler(actuel: Affiche | null, g: Gain): Affiche {
  const franchi = g.niveauApres > g.niveauAvant;
  return actuel
    ? { points: actuel.points + g.points, bonus: actuel.bonus + g.bonus, niveauFranchi: actuel.niveauFranchi || franchi }
    : { points: g.points, bonus: g.bonus, niveauFranchi: franchi };
}
