// Issue #162 : logique de la pastille « +N XP » (séparée du composant pour le rechargement à chaud).

/** Libellé lu et affiché : « +45 XP », avec une espace insécable. */
export const texteXp = (points: number) => `+${points}\u00A0XP`;

/** Durée d'affichage : le temps de lire deux mots, sans gêner l'action suivante. */
export const DUREE_XP_MS = 2400;
export const SORTIE_XP_MS = 160;
