// Conseil de Mochi (#80), côté écran : limite de l'offre gratuite (préparée, pas active) et propriétés des événements.
// La phrase et la zone viennent de src/engine/conseil.ts ; l'analyse KataGo de `analyseConseil` (src/engine/index.ts).
import type { ModeleConseil } from '../engine/conseil';

/**
 * Conseils par partie dans l'offre gratuite (charte : le coach fait partie de Premium). `null` : aucune limite.
 * Pas activée (décision produit à venir) : passer à un nombre suffit, l'écran et les tests suivent.
 */
export const CONSEILS_GRATUITS_PAR_PARTIE: number | null = null;

/** Conseils encore permis dans la partie (`Infinity` sans limite ou en Premium). */
export function conseilsRestants(utilises: number, premium = false, limite: number | null = CONSEILS_GRATUITS_PAR_PARTIE): number {
  if (premium || limite === null) return Infinity;
  return Math.max(0, limite - utilises);
}

/** Propriétés de `conseil_demande` : modèle choisi (`aucun` si Mochi n'a rien de sûr à dire) et source de l'analyse. */
export function proprietesDemande(modele: ModeleConseil | null, o: { taille: number; adversaire: string; coup: number; katago: boolean; ms: number }) {
  return { modele: modele ?? 'aucun', taille: o.taille, adversaire: o.adversaire, coup: o.coup, katago: o.katago, ms: Math.round(o.ms) };
}

/** Propriétés de `conseil_note` : une réponse par conseil affiché. */
export function proprietesNote(modele: ModeleConseil, utile: boolean, o: { taille: number; adversaire: string }) {
  return { modele, utile, taille: o.taille, adversaire: o.adversaire };
}
