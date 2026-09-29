// Onglet Problèmes (issue #40, phase 6) : logique pure, sans React.
import { choisirProbleme, type EtatCote } from './coteJoueur';

/**
 * « Continuer » à ta mesure (#284) : le prochain problème, choisi pour environ 85 % de réussite au premier essai
 * (coteJoueur.ts). Restent hors du sélecteur :
 * - le Go du jour (`goDuJour`) : il est le même pour tous et ne note pas la cote ;
 * - la Révision du jour : les problèmes réussis et ceux vus avec la réponse (`aReviser`) reviennent par elle seule.
 * `undefined` s'il ne reste rien à proposer : l'appelant garde sa série infinie (#147).
 */
export function prochainAMesure<T extends { id: string; difficulty: number }>(
  liste: readonly T[], etat: EtatCote,
  { aReviser, goDuJour, jour, eviter, alea }: {
    aReviser: ReadonlySet<string>; goDuJour?: string; jour: number; eviter?: string; alea?: () => number;
  }
): T | undefined {
  const aMesure = goDuJour ? liste.filter(p => p.id !== goDuJour) : liste;
  return choisirProbleme(aMesure, etat, aReviser, { jour, eviter, alea });
}

export type Niveau = { mot: 'Facile' | 'Moyen' | 'Difficile'; crans: 1 | 2 | 3 };

/** Niveau affiché d'un problème, d'après sa difficulté (cote Elo du problème). */
export function niveau(difficulte: number): Niveau {
  return difficulte < 500 ? { mot: 'Facile', crans: 1 } : difficulte < 750 ? { mot: 'Moyen', crans: 2 } : { mot: 'Difficile', crans: 3 };
}

/** Problème à proposer après `courant` : le prochain pas réussi dans la liste, sinon le premier pas réussi. */
export function suivant<T extends { id: string }>(liste: T[], courant: T, reussis: Set<string>): T | undefined {
  const i = liste.indexOf(courant);
  return liste.slice(i + 1).find(p => !reussis.has(p.id)) ?? liste.find(p => !reussis.has(p.id) && p.id !== courant.id);
}

/** Série de jours, écrite en toutes lettres pour la légende : « jour de série », « jours de série » (#237). */
export function legendeSerie(n: number): string {
  return n > 1 ? 'jours de série' : 'jour de série';
}
