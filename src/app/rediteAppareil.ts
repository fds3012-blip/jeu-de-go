// Redites sur cet appareil (#237, N3) : note dans l'état de la Révision du jour qu'un problème vient d'être réussi
// en répétant une leçon. La logique pure est dans revision.ts (`noterRedite`) et src/content/redites.ts.
import { LESSONS_KEY, readLocal, writeLocal } from './hooks';
import { numeroDuJour } from './goDuJour';
import { REVISION_KEY, lireRevision, noterRedite, synchroniser } from './revision';
import { LESSONS } from '../content/lessons';
import { repriseFaite, type Lignes } from '../content/redites';
import { cleanProgress, type Progress } from '../data/progress';

/**
 * Vrai si le problème répète une étape de leçon que le joueur a déjà faite (#251, recette du 28/09, M3).
 * Sans la leçon, un Go du jour qui reprend une étape n'est pas une redite : le joueur le voit pour la première fois.
 * `progression` : par défaut celle de l'appareil (`go.lecons.v1`, fusionnée avec celle du compte à la connexion).
 */
export function repriseDeLeconFaite(p: { id: string; rows: Lignes }, progression: Progress = cleanProgress(readLocal<unknown>(LESSONS_KEY, {}))): boolean {
  return LESSONS.some(l => repriseFaite(p, l, progression[l.id] ?? 0));
}

/**
 * Problème réussi ou vu aujourd'hui : suivi par la révision dès maintenant, avec pour base aujourd'hui (#251, M2).
 * Sans cela, il n'entrait qu'au prochain affichage de la liste des problèmes : un Go du jour fait depuis l'accueil,
 * application fermée juste après, ne revenait qu'à J+2.
 */
export function suivreEnRevisionAppareil(id: string, instant = new Date()): void {
  const avant = lireRevision(readLocal<unknown>(REVISION_KEY, null));
  const apres = synchroniser(avant, [id], numeroDuJour(instant));
  if (apres !== avant) writeLocal(REVISION_KEY, apres);
}

/** Problème réussi en redite aujourd'hui : la Révision du jour ne le proposera pas demain. */
export function noterRediteAppareil(id: string, instant = new Date()): void {
  writeLocal(REVISION_KEY, noterRedite(lireRevision(readLocal<unknown>(REVISION_KEY, null)), id, numeroDuJour(instant)));
}
