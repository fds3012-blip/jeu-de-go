// « Un défi par jour » (issue #199) : branchement de defi.ts sur le stockage de l'appareil.
import { compteDansSerie, faitApres, goDuJourFait, lireFait, type Defi } from './defi';
import { SERIE_KEY, numeroDuJour, type Serie } from './goDuJour';
import { reussirAppareil } from './gelAppareil';
import { readLocal, writeLocal } from './hooks';

/** Numéro du dernier Go du jour réussi sur cet appareil (depuis #199). */
export const DU_JOUR_FAIT_KEY = 'go.go-du-jour.fait.v1';

/** Le Go du jour n° `numero` est-il réussi sur cet appareil ? */
export function goDuJourFaitAppareil(numero: number): boolean {
  return goDuJourFait(readLocal<Serie | null>(SERIE_KEY, null), lireFait(readLocal<unknown>(DU_JOUR_FAIT_KEY, null)), numero);
}

/**
 * Un défi du jour vient d'être relevé : série de l'appareil (et gel gagné tous les 7 jours) si ce défi compte,
 * repère du Go du jour. Idempotent dans la journée : la série n'avance qu'une fois par jour.
 * Rend la série après coup et `gagne` (gel gagné à l'instant).
 */
export function validerDefi(defi: Defi, maintenant: Date = new Date()): { serie: Serie | null; gagne: boolean } {
  const numero = numeroDuJour(maintenant);
  const serie = readLocal<Serie | null>(SERIE_KEY, null);
  writeLocal(DU_JOUR_FAIT_KEY, faitApres(lireFait(readLocal<unknown>(DU_JOUR_FAIT_KEY, null)), serie, defi, numero));
  if (!compteDansSerie(defi)) return { serie, gagne: false };
  return reussirAppareil(serie, numero);
}
