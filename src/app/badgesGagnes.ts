// Badges gagnés sur l'appareil (#212, #529) : la liste gardée, et l'écriture d'un badge gagné sur le moment.
// Module minuscule, sans texte d'interface : xp.ts (JS initial), la course et la partie en ligne l'appellent sans tirer la
// vitrine ni ses textes (src/app/vitrine.ts, qui calcule les autres badges à l'ouverture du Profil).
import { readLocal, writeLocal } from './hooks';

/** Badges déjà gagnés sur cet appareil (issue #212) : un badge gagné n'est jamais retiré, même si sa condition ne tient plus. */
export const BADGES_KEY = 'go.badges.v1';

/** Relit la liste des badges gagnés, en tolérant les valeurs abîmées. */
export function lireBadges(brut: unknown): string[] {
  return Array.isArray(brut) ? brut.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Badges qui se gagnent sur le moment, faute de trace durable sur l'appareil (#529) : un objectif de la semaine atteint
 * (la semaine ne garde que la précédente), une partie en ligne finie, une victoire classée (elles vivent sur le serveur).
 * Le Profil les montre ensuite comme les autres, et les imprime une fois dans la vitrine.
 */
export type BadgeDuMoment = 'objectif-semaine' | 'premiere-en-ligne' | 'victoire-classee';

/** Note un badge gagné à l'instant. Idempotent ; rend vrai s'il est nouveau. */
export function gagnerBadge(id: BadgeDuMoment): boolean {
  const gagnes = lireBadges(readLocal<unknown>(BADGES_KEY, []));
  if (gagnes.includes(id)) return false;
  writeLocal(BADGES_KEY, [...gagnes, id]);
  return true;
}
