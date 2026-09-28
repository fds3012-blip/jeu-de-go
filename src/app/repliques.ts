// Répliques courtes des adversaires, affichées dans une petite bulle à côté de leur nom pendant 3 s.
// Pour l'instant les mêmes pour tous ; pour donner une voix à un adversaire, ajoute-le dans PERSONNELLES
// (seules les situations fournies remplacent les répliques génériques).
import type { OpponentId } from '../engine';
import { t } from '../content/i18n';

export type Situation =
  | 'captureSubie' // le joueur vient de lui prendre des pierres
  | 'atariSubi' // le joueur vient de mettre un de ses groupes en atari
  | 'capture' // il vient de prendre des pierres au joueur
  | 'passeJoueur' // le joueur passe : la fin approche
  | 'passe'; // il passe lui-même

/** Durée d'affichage d'une réplique, en millisecondes. */
export const DUREE_REPLIQUE = 3000;

// Très courtes (15 caractères au plus) : la bulle tient sur une ligne entre le nom et le couvercle, sur 390 px.
export const LONGUEUR_MAX = 15;
export const GENERIQUES: Record<Situation, readonly string[]> = {
  captureSubie: ['Oh ! Bien vu.', 'Aïe !', 'Bien joué !'],
  atariSubi: ['Oups…', 'Ça chauffe !', 'Tu me serres.'],
  capture: ['Hop, prise !', 'Merci !', 'Je la prends !'],
  // #237 : neutres. Mochi a déjà demandé confirmation avant la passe (#235), et l'adversaire peut encore jouer.
  passeJoueur: ['Voyons voir…', 'Je regarde.', 'À moi.'],
  passe: ['Je passe.', 'Rien à jouer.', 'À toi de voir.'],
};

export const PERSONNELLES: Partial<Record<OpponentId, Partial<Record<Situation, readonly string[]>>>> = {};

/** Répliques possibles d'un adversaire dans une situation. Les génériques passent par `t` (#167) : GENERIQUES garde le français d'origine. */
export function repliques(id: OpponentId, s: Situation): readonly string[] {
  return PERSONNELLES[id]?.[s] ?? GENERIQUES[s].map((_, i) => t(`replique.${s}.${i as 0 | 1 | 2}`));
}

/**
 * Choisit une réplique au hasard, sans répéter `precedente` quand il y a le choix.
 * `alea` renvoie un nombre dans [0, 1) (Math.random par défaut, injectable pour les tests).
 */
export function choisirReplique(id: OpponentId, s: Situation, precedente?: string | null, alea: () => number = Math.random): string {
  const liste = repliques(id, s);
  const choix = liste.length > 1 && precedente ? liste.filter(r => r !== precedente) : liste;
  return choix[Math.min(choix.length - 1, Math.floor(alea() * choix.length))];
}
