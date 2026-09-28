// Redites sur cet appareil (#237, N3) : note dans l'état de la Révision du jour qu'un problème vient d'être réussi
// en répétant une leçon. La logique pure est dans revision.ts (`noterRedite`) et src/content/redites.ts.
import { readLocal, writeLocal } from './hooks';
import { numeroDuJour } from './goDuJour';
import { REVISION_KEY, lireRevision, noterRedite } from './revision';
import { LESSONS } from '../content/lessons';
import { estRedite, type Lignes } from '../content/redites';

/** Vrai si le problème répète un exercice d'une leçon (même position à symétrie près, ou liste d'exclusion). */
export function repriseDeLecon(p: { id: string; rows: Lignes }): boolean {
  return LESSONS.some(l => estRedite(p, l));
}

/** Problème réussi en redite aujourd'hui : la Révision du jour ne le proposera pas demain. */
export function noterRediteAppareil(id: string, instant = new Date()): void {
  writeLocal(REVISION_KEY, noterRedite(lireRevision(readLocal<unknown>(REVISION_KEY, null)), id, numeroDuJour(instant)));
}
