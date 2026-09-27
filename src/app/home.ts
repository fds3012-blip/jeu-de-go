// Accueil (issue #23) : un message de Mochi et une action principale qui disent la même chose.

/** Historique minimal des parties, gardé en localStorage. */
export interface Parties { n: number; dernier?: string }
export const PARTIES_KEY = 'go.parties.v1';
/** Bulle « but du jeu » affichée une seule fois, au début de la première partie contre l'ordi. */
export const INTRO_KEY = 'go.intro-but.v1';

export const introBut = (nom: string) =>
  `Le but : entourer plus de territoire que ${nom}, et capturer ses pierres en leur retirant leurs libertés (les cases vides qui les touchent).`;

export interface Accueil { mochi: string; cta: string; nouveau: boolean }

/**
 * Textes de l'accueil.
 * - Nouveau joueur (aucune partie, aucune leçon) : première partie contre l'adversaire choisi (Pomme par défaut).
 * - Leçons faites mais aucune partie : on l'invite à sa première partie.
 * - Joueur qui revient : « Rejouer contre X » si c'est son dernier adversaire, sinon « Jouer contre X ».
 */
export function accueil(parties: Parties, lecons: number, adv: { id: string; nom: string }, taille: number): Accueil {
  const plateau = `${taille} × ${taille}`;
  if (parties.n === 0) {
    const cta = `Joue ta première partie contre ${adv.nom}`;
    if (lecons === 0) return { nouveau: true, cta, mochi: `Nouveau au go ? Pose ta première pierre contre ${adv.nom}, je t'explique en jouant.` };
    return { nouveau: false, cta, mochi: `Bravo pour ${lecons > 1 ? `tes ${lecons} leçons` : 'ta première leçon'} ! Place à ta première partie contre ${adv.nom}.` };
  }
  const rejouer = parties.dernier === adv.id;
  return {
    nouveau: false,
    cta: `${rejouer ? 'Rejouer' : 'Jouer'} contre ${adv.nom}`,
    mochi: rejouer ? `Content de te revoir ! ${adv.nom} t'attend sur le ${plateau}.` : `Une partie contre ${adv.nom} sur le ${plateau} ? Je suis prêt.`,
  };
}
