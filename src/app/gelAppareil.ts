// Série protégée (issue #76) : branchement de la logique pure (gel.ts) sur le stockage de l'appareil et la mesure.
import { EVENTS, track } from '../data/analytics';
import { GEL_KEY, apresReussite, lireReserve, reconcilier, type Reserve } from './gel';
import { SERIE_KEY, numeroDuJour, type Serie } from './goDuJour';
import { readLocal, writeLocal } from './hooks';

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
  if (r.gagne) {
    writeLocal(GEL_KEY, r.reserve);
    track(EVENTS.gelGagne, { serie: r.serie.jours, gels: r.reserve.gels });
  }
  return r;
}
