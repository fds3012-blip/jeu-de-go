// Fin de leçon (issue #40, phase 6) : ce que le joueur sait faire maintenant, en une phrase.
// Texte d'interface seulement : les positions et les réponses des leçons ne changent pas (content/lessons.fr.js).

import { t } from './i18n/secondaires';

/** Textes d'origine (français), comparés au catalogue par un test. */
export const ACQUIS: Record<string, string> = {
  l1: 'Tu sais compter les libertés d’un groupe et le capturer.',
  l2: 'Tu repères une pierre en atari, pour la prendre ou pour la sauver.',
  l3: 'Tu connais trois pièges : le double atari, le bord et l’échelle.',
  l4: 'Tu sais pourquoi on ne reprend pas un ko tout de suite.',
  l5: 'Tu sais qu’un groupe avec deux yeux ne peut plus mourir.',
  l6: 'Tu sais compter un territoire et jouer un bon premier coup.',
  l7: 'Tu sais fermer tes frontières, passer au bon moment et compter la partie.',
  l8: 'Tu sais où poser tes premières pierres : coins, bords, puis centre.',
  l9: 'Tu sais enfermer une pierre dans un filet, sans la toucher.',
  l10: 'Tu sais donner une pierre pour en reprendre plusieurs.',
  l11: 'Tu sais compter les libertés pour gagner une course.',
  l12: 'Tu reconnais un faux œil : tu sais l’éviter chez toi, le créer chez Blanc.',
  l13: 'Tu trouves le point vital qui fait vivre ou mourir un groupe.',
  l14: 'Tu reconnais un seki : personne n’attaque, ses points ne comptent pas.',
  l15: 'Tu sais finir une partie : frontières fermées, dame, pierres mortes.',
  l16: 'Tu sais compter une partie entière, pierres mortes et komi compris.',
  l17: 'Tu reconnais les formes d’yeux : le T, le carré, la grappe de cinq.',
  l18: 'Tu protèges un point de coupe et tu relies un bambou.',
  l19: 'Tu prends d’abord les pierres qui coupent tes groupes.',
  l20: 'Tu sais quand relier perd tout : mieux vaut abandonner la pierre.',
  l21: 'Tu vois quand un groupe ne peut plus se relier sans atari.',
  l22: 'Tu joues d’abord les coups sente, ceux qui obligent à répondre.',
  l23: 'Tu joues le hane au premier rang, puis tu relies ta pierre.',
  l24: 'Tu prends le point au bord de l’espace : pour vivre, ou pour tuer.',
  l25: 'Tu connais le point du coin, et tu sais qu’un ko n’est pas une vie.',
  l26: 'Avec un œil, tu bouches d’abord les libertés du dehors.',
};

const IDS = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10', 'l11', 'l12', 'l13', 'l14', 'l15', 'l16', 'l17', 'l18', 'l19', 'l20', 'l21', 'l22', 'l23', 'l24', 'l25', 'l26'] as const;
const connu = (id: string): id is (typeof IDS)[number] => (IDS as readonly string[]).includes(id);

/** Phrase de fin d'une leçon dans la langue de l'interface (#167) ; une phrase générale si la leçon n'en a pas. */
export function acquis(id: string): string {
  return connu(id) ? t(`acquis.${id}`) : t('acquis.defaut');
}
