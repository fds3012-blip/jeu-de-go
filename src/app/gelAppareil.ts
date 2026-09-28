// Série protégée (issue #76) : branchement de la logique pure (gel.ts) sur le stockage de l'appareil et la mesure.
import { EVENTS, track } from '../data/analytics';
import { GEL_KEY, apresReussite, lireReserve, reconcilier, type Reserve } from './gel';
import { SERIE_KEY, numeroDuJour, type Serie } from './goDuJour';
import { readLocal, writeLocal } from './hooks';
import { RECORD_KEY, avecRecord, constaterPerte, lireRecord, type Perte } from './serieRecord';

export const lireRecordAppareil = () => lireRecord(readLocal<unknown>(RECORD_KEY, null));

/** Garde `jours` dans le record de l'appareil s'il le dépasse (série locale ou série du serveur). Le record ne descend jamais. */
export function noterRecordAppareil(jours: number): number {
  const avant = lireRecordAppareil();
  const apres = avecRecord(avant, jours);
  if (apres !== avant) writeLocal(RECORD_KEY, apres);
  return apres.record;
}

/**
 * À appeler à l'ouverture, juste après `reconcilierAppareil` (issue #212) : constate une série perdue, une seule fois,
 * et envoie `serie_perdue`. Le record garde la série perdue. Idempotent.
 */
export function constaterPerteAppareil(maintenant: Date): Perte | null {
  const numero = numeroDuJour(maintenant);
  const avant = lireRecordAppareil();
  const { etat, perte } = constaterPerte(readLocal<Serie | null>(SERIE_KEY, null), avant, numero);
  if (etat.record !== avant.record || etat.perdue !== avant.perdue) writeLocal(RECORD_KEY, etat);
  if (perte) track(EVENTS.seriePerdue, { jours: perte.jours, record: perte.record, jours_manques: perte.manques, gels: lireReserveAppareil().gels });
  return perte;
}

export const lireReserveAppareil = (): Reserve => lireReserve(readLocal<unknown>(GEL_KEY, null));

/**
 * À appeler à l'ouverture, avant d'afficher la série : consomme les gels des jours manqués.
 * Idempotent : une fois `dernier` avancé à la veille, un second appel ne fait rien.
 * Rend la série sauvée à annoncer (une seule fois : l'annonce est effacée du stockage).
 */
export function reconcilierAppareil(maintenant: Date): number | null {
  const numero = numeroDuJour(maintenant);
  const b = reconcilier(readLocal<Serie | null>(SERIE_KEY, null), lireReserveAppareil(), numero);
  if (b.utilises.length) {
    writeLocal(SERIE_KEY, b.serie);
    for (const jour of b.utilises) track(EVENTS.gelUtilise, { jour, serie: b.serie?.jours ?? 0, gels_restants: b.reserve.gels });
  }
  const annonce = b.reserve.annonce;
  if (annonce !== null || b.utilises.length) writeLocal(GEL_KEY, { ...b.reserve, annonce: null });
  return annonce;
}

/** Réussite du Go du jour n° `numero` sur cet appareil : série, gel éventuel, et événement `gel_gagne`. */
export function reussirAppareil(serie: Serie | null, numero: number): { serie: Serie; gagne: boolean } {
  const r = apresReussite(serie, lireReserveAppareil(), numero);
  writeLocal(SERIE_KEY, r.serie);
  noterRecordAppareil(r.serie.jours);
  if (r.gagne) {
    writeLocal(GEL_KEY, r.reserve);
    track(EVENTS.gelGagne, { serie: r.serie.jours, gels: r.reserve.gels });
  }
  return r;
}
