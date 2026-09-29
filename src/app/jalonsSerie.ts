// Série sur la feuille de réussite du Go du jour (issue #214) : « 3 jours de série · À demain », et une vraie petite
// fête aux jalons 3, 7 et 30 jours. Logique pure, sans React. Preuve : docs/ux/base-de-connaissances.md (Duolingo,
// « Animating the Streak » : une animation plus forte aux jalons a fait monter J7 de 1,7 %).
import type { Serie } from './goDuJour';

/** Jours de série fêtés : le rythme (3), la semaine (7), le mois (30). */
export const JALONS = [3, 7, 30] as const;
export type Jalon = (typeof JALONS)[number];

export const estJalon = (jours: number): jours is Jalon => (JALONS as readonly number[]).includes(jours);

/**
 * Jalon franchi à l'instant par le Go du jour n° `numero` ? Seulement si c'est lui qui a fait avancer la série
 * aujourd'hui : si une leçon ou la révision l'avaient déjà allumée (« un défi par jour », #199), la fête a déjà eu
 * lieu ailleurs (ou n'a pas lieu d'être) ; on ne la rejoue pas.
 */
export function jalonFranchi(avant: Serie | null, apres: Serie | null, numero: number): Jalon | null {
  if (!apres || apres.dernier !== numero) return null;
  if (avant?.dernier === numero) return null;
  return estJalon(apres.jours) ? apres.jours : null;
}

