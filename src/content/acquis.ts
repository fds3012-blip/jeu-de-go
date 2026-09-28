// Fin de leçon (issue #40, phase 6) : ce que le joueur sait faire maintenant, en une phrase.
// Texte d'interface seulement : les positions et les réponses des leçons ne changent pas (content/lessons.fr.js).

export const ACQUIS: Record<string, string> = {
  l1: 'Tu sais compter les libertés d’un groupe et le capturer.',
  l2: 'Tu repères une pierre en atari, pour la prendre ou pour la sauver.',
  l3: 'Tu connais trois pièges : le double atari, le bord et l’échelle.',
  l4: 'Tu sais pourquoi on ne reprend pas un ko tout de suite.',
  l5: 'Tu sais qu’un groupe avec deux yeux ne peut plus mourir.',
  l6: 'Tu sais compter un territoire et jouer un bon premier coup.',
  l7: 'Tu sais fermer tes frontières, passer au bon moment et compter la partie.',
  l8: 'Tu sais où poser tes premières pierres : coins, bords, puis centre.',
};

/** Phrase de fin d'une leçon ; une phrase générale si la leçon n'en a pas. */
export function acquis(id: string): string {
  return ACQUIS[id] ?? 'Une leçon de plus dans ta poche.';
}
