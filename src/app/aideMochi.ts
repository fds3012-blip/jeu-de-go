// Module à part (#513) : l'accueil (src/app/App.tsx) et les réglages le lisent dès le chargement initial ;
// le reste de ./partie.ts (coach, comptage, indices) arrive avec la partie.
// Aide de Mochi en partie (#35) : alerte d'atari contre les adversaires débutants.

/** Réglage « Aide de Mochi en partie » : `auto` = seulement contre les débutants (Pomme, Caillou). */
export type ReglageAide = 'auto' | 'oui' | 'non';
/** Adversaires contre lesquels l'aide est active par défaut. À partir de Bambou (13 kyu), elle est coupée. */
export const ADVERSAIRES_DEBUTANTS: readonly string[] = ['pomme', 'caillou'];

/** L'aide de Mochi est-elle active contre l'adversaire `id` ? */
export function aideActive(reglage: ReglageAide | undefined, id: string): boolean {
  if (reglage === 'oui') return true;
  if (reglage === 'non') return false;
  return ADVERSAIRES_DEBUTANTS.includes(id);
}
