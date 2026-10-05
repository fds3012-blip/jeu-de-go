// #440 : façon de jouer en ligne mémorisée sur l'appareil (« En direct » ou « Partie lente »). Logique pure et
// stockage local tolérant : sans stockage (navigation privée, aperçu), on revient au direct, sans erreur.
import type { FaconEnLigne } from './BasculeEnLigne';

export const EN_LIGNE_KEY = 'go.enLigne.v1';

/** Lit la façon de jouer mémorisée ; `direct` par défaut ou si la valeur est inconnue. */
export function lireFaconEnLigne(stockage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): FaconEnLigne {
  try {
    return stockage?.getItem(EN_LIGNE_KEY) === 'lente' ? 'lente' : 'direct';
  } catch {
    return 'direct';
  }
}

/** Mémorise la façon de jouer (sans effet si le stockage est fermé). */
export function ecrireFaconEnLigne(f: FaconEnLigne, stockage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  try {
    stockage?.setItem(EN_LIGNE_KEY, f);
  } catch { /* stockage fermé : le choix vaut pour cette visite */ }
}
