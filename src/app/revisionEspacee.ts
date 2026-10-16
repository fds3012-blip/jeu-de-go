// Révision espacée (#469) : les erreurs de partie (« Tes erreurs à rejouer », « Rejouer mes erreurs ») et les problèmes
// ratés reviennent au bon moment. Logique pure, sans React ni stockage ; tests : revisionEspacee.test.ts.
//
// Calendrier (validé par Florian, 08/10) : un élément raté entre dans la file et revient à J+1. Chaque réussite le fait
// monter d'une marche : J+3, puis J+7, J+14, J+30. Réussi à J+30 : il est acquis et sort de la file. Un échec le renvoie
// à J+1, au pied de l'échelle (boîtes de Leitner). Les jours sont des jours locaux (AAAA-MM-JJ), comme les erreurs (#77).
// En retard, l'intervalle suivant compte depuis le jour de la réussite : jamais de rattrapage en rafale.
//
// L'accueil compte les révisions du jour avec src/app/revisionsDues.ts (#563), réexporté ici.
// Les écritures sur l'appareil : src/app/revisionsAppareil.ts ; la synchronisation avec un compte :
// src/app/revisionsSynchro.ts (logique) et src/data/revisions.ts (réseau).

import {
  ACQUIS, INTERVALLES, MAX_ACQUISES, MAX_PROBLEMES, SEANCE_MAX, dus, jour, plusRecents, type ElementFile, type EtatRevisions, type Suivi,
} from './revisionsDues';
export {
  ACQUIS, ERREURS_KEY, EVENEMENT_REVISIONS, INTERVALLES, MAX_ACQUISES, MAX_PROBLEMES, REVISIONS_KEY, SEANCE_MAX, cleProbleme, compterDus, dus, elementsErreursBruts, elementsProblemes, estDu, jour, lireRevisions, suiviValide, type ElementFile, type EtatRevisions, type Genre, type Suivi,
} from './revisionsDues';

/** Jour `n` jours après `d` (heure locale, changements d'heure compris). */
export function dansJours(d: Date, n: number): string {
  return jour(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Nombre de jours entre deux jours AAAA-MM-JJ (`b - a`). */
export function ecartJours(a: string, b: string): number {
  const ms = (s: string) => { const [y, m, j] = s.split('-').map(Number); return Date.UTC(y, m - 1, j); };
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

/** Échec (ou entrée dans la file) : retour au pied de l'échelle, prochain passage demain. */
export function apresEchec(s: Pick<Suivi, 'echecs'> | undefined, maintenant: Date): Suivi {
  return { etape: 0, prochain: dansJours(maintenant, INTERVALLES[0]), echecs: (s?.echecs ?? 0) + 1, maj: maintenant.getTime() };
}

/** Réussite : une marche de plus (J+3, J+7, J+14, J+30 comptés depuis aujourd'hui) ; après J+30, acquis. */
export function apresReussite(s: Suivi, maintenant: Date): Suivi {
  const etape = Math.min(ACQUIS, s.etape + 1);
  return { etape, prochain: etape >= ACQUIS ? null : dansJours(maintenant, INTERVALLES[etape]), echecs: s.echecs, maj: maintenant.getTime() };
}

export function apresEssai(s: Suivi, reussi: boolean, maintenant: Date): Suivi {
  return reussi ? apresReussite(s, maintenant) : apresEchec(s, maintenant);
}

/** Jours de retard (0 : dû aujourd'hui). */
export function retard(s: Pick<Suivi, 'prochain'>, maintenant: Date): number {
  return s.prochain === null ? 0 : Math.max(0, ecartJours(s.prochain, jour(maintenant)));
}

/** La séance du jour : les éléments dus, 5 au plus. */
export function seance(elements: readonly ElementFile[], maintenant: Date, max = SEANCE_MAX): ElementFile[] {
  return dus(elements, maintenant).slice(0, max);
}

export const ETAT_VIDE: EtatRevisions = { problemes: {}, acquises: {} };

/**
 * Premier essai d'un problème hors séance (onglet Problèmes) : raté, il entre dans la file (ou y repart de J+1).
 * Réussi : rien ne change (seule la séance fait monter l'échelle, au jour prévu).
 */
export function problemeRate(etat: EtatRevisions, id: string, maintenant: Date): EtatRevisions {
  return { ...etat, problemes: plusRecents({ ...etat.problemes, [id]: apresEchec(etat.problemes[id], maintenant) }, MAX_PROBLEMES, s => s.maj) };
}

/** Essai d'un problème de la file pendant la séance. */
export function problemeRevu(etat: EtatRevisions, id: string, reussi: boolean, maintenant: Date): EtatRevisions {
  const s = etat.problemes[id];
  if (!s) return etat;
  return { ...etat, problemes: { ...etat.problemes, [id]: apresEssai(s, reussi, maintenant) } };
}

/** Erreur acquise : sa marque reste sur l'appareil, pour que le compte l'apprenne. */
export function erreurAcquise(etat: EtatRevisions, id: string, maj: number): EtatRevisions {
  return { ...etat, acquises: plusRecents({ ...etat.acquises, [id]: maj }, MAX_ACQUISES, t => t) };
}

/** Ids des problèmes que la file suit (acquis compris) : la Révision du jour (#199) les laisse à la file. */
export function problemesSuivis(etat: EtatRevisions): Set<string> {
  return new Set(Object.keys(etat.problemes));
}

/** XP de la séance : une fois par jour. Renvoie le nouvel état, ou null si l'XP du jour est déjà prise. */
export function prendreXp(etat: EtatRevisions, maintenant: Date): EtatRevisions | null {
  const j = jour(maintenant);
  return etat.xpLe === j ? null : { ...etat, xpLe: j };
}
