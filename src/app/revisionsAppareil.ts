// Révision espacée sur l'appareil (#469) : toutes les écritures de la file passent par ici, pour que l'accueil recompte
// et que la synchronisation du compte reparte (événement `go:revisions`). Logique pure : revisionEspacee.ts.
// Les erreurs gardent leur place dans go.erreurs.v1 (#77) ; les problèmes ratés et les erreurs acquises dans go.revisions.v1.
import { readLocal, writeLocal } from './hooks';
import { ERREURS_KEY, apresEssai, devientMaitrisee, garderRatee, lireErreurs, suiviErreur, type ErreurGardee } from './erreurs';
import {
  EVENEMENT_REVISIONS, REVISIONS_KEY, elementsProblemes, erreurAcquise, lireRevisions, problemeRate, problemeRevu,
  type ElementFile, type EtatRevisions,
} from './revisionEspacee';

export function prevenir(): void {
  try { window.dispatchEvent(new Event(EVENEMENT_REVISIONS)); } catch { /* hors navigateur */ }
}

export const lireErreursAppareil = (): ErreurGardee[] => lireErreurs(readLocal<unknown>(ERREURS_KEY, []));
export const lireEtatAppareil = (): EtatRevisions => lireRevisions(readLocal<unknown>(REVISIONS_KEY, null));
export function ecrireEtatAppareil(e: EtatRevisions): void { writeLocal(REVISIONS_KEY, e); }

/** Erreur ratée (revue, « Rejouer mes erreurs ») : elle entre dans la file, demain. */
export function garderErreurRatee(pb: ErreurGardee, maintenant = new Date()): void {
  writeLocal(ERREURS_KEY, garderRatee(lireErreursAppareil(), pb, maintenant));
  prevenir();
}

/** Premier essai d'une erreur de la file (« Tes erreurs à rejouer » ou séance). Renvoie l'erreur avant l'essai. */
export function noterErreur(id: string, reussi: boolean, maintenant = new Date()): { avant: ErreurGardee | undefined; maitrisee: boolean } {
  const liste = lireErreursAppareil(), avant = liste.find(x => x.id === id);
  writeLocal(ERREURS_KEY, apresEssai(liste, id, reussi, maintenant));
  const maitrisee = !!avant && devientMaitrisee(avant, reussi);
  if (maitrisee) ecrireEtatAppareil(erreurAcquise(lireEtatAppareil(), id, maintenant.getTime()));
  prevenir();
  return { avant, maitrisee };
}

/** Premier essai raté d'un problème, hors séance : il entre dans la file (ou repart de J+1). */
export function noterProblemeRate(id: string, maintenant = new Date()): void {
  ecrireEtatAppareil(problemeRate(lireEtatAppareil(), id, maintenant));
  prevenir();
}

/** Premier essai d'un problème de la file, pendant la séance. */
export function noterProblemeRevu(id: string, reussi: boolean, maintenant = new Date()): void {
  ecrireEtatAppareil(problemeRevu(lireEtatAppareil(), id, reussi, maintenant));
  prevenir();
}

/** Toute la file de l'appareil : erreurs gardées et problèmes ratés (`disponibles` : problèmes connus). */
export function fileAppareil(disponibles?: (id: string) => boolean): ElementFile[] {
  const erreurs: ElementFile[] = lireErreursAppareil().map(e => ({ cle: e.id, genre: 'erreur', ref: e.id, suivi: suiviErreur(e) }));
  return [...erreurs, ...elementsProblemes(lireEtatAppareil(), disponibles)];
}
