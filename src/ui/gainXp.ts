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

/** Haut de la pastille par défaut (sous l'encoche), et sous la carte « Niveau N ! » quand un niveau est franchi. */
export const HAUT_XP = 12;
export const HAUT_XP_SOUS_FETE = 96;

/**
 * Haut de la pastille, sous l'encoche (hors zone sûre). Sur un écran à en-tête (problème, leçon), elle se pose sous
 * l'en-tête pour ne pas couvrir le titre (recette du 28/09, R3). `basEntete` : bas de l'en-tête à l'écran, ou null.
 * Un en-tête sorti de l'écran (page défilée) ou trop bas (au-delà du tiers de l'écran) est ignoré.
 */
export function hautPastille(basEntete: number | null, niveauFranchi: boolean, hauteurEcran: number): number {
  const base = niveauFranchi ? HAUT_XP_SOUS_FETE : HAUT_XP;
  if (basEntete === null || basEntete <= base || basEntete > hauteurEcran / 3) return base;
  return Math.round(basEntete + 6);
}
