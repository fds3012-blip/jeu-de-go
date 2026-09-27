// Série dès le jour 1 pour le joueur sans compte (issue #161). Logique pure, sans React.
// La série du Go du jour vit déjà sur l'appareil (goDuJour.ts, gels de gel.ts). On l'affiche partout,
// avec ou sans compte : le joueur ne voit jamais « 0 jour » après avoir réussi le Go du jour.
import { serieVivante, type Serie } from './goDuJour';

/** Jour de série à partir duquel on propose le compte, sans insister. Textes : clés `serie.invitation` et `serie.creerCompte`. */
export const JOUR_INVITATION = 3;

/**
 * Série à afficher aujourd'hui (jour `numero`).
 * - Sans compte (`serveur` null) : la série de l'appareil.
 * - Avec compte : la plus longue des deux. Tant que le serveur ne reprend pas la série de l'appareil
 *   (il lui faut une fonction dédiée, voir la PR), le joueur qui se connecte ne perd rien à l'écran.
 */
export function serieAffichee(serveur: number | null, local: Serie | null, numero: number): number {
  const l = serieVivante(local, numero);
  if (serveur === null) return l;
  return Math.max(Math.max(0, Math.floor(serveur)), l);
}

/**
 * Invitation discrète « Crée un compte pour garder ta série » : sans compte, dès le 3e jour de série.
 * Elle remplace le texte d'invitation déjà présent (cote, carte du Profil) : rien de plus à l'écran.
 */
export function inviterCompte(connecte: boolean, serie: number): boolean {
  return !connecte && serie >= JOUR_INVITATION;
}
