// Onglet Problèmes (issue #40, phase 6) : logique pure, sans React.

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

/** Série de jours, écrite en toutes lettres pour la légende : « jour de suite », « jours de suite ». */
export function legendeSerie(n: number): string {
  return n > 1 ? 'jours de suite' : 'jour de suite';
}
