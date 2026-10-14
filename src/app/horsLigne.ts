// Hors ligne clair (#538, reprend #366) : ce qui marche sans réseau et ce qui ne marche pas. Logique pure, sans React,
// testée dans horsLigne.test.ts.
//
// - Marche sans réseau : parties contre l'ordi (Pomme et Caillou toujours ; Bambou et les suivants si l'IA est sur le
//   téléphone), à deux, guidée, découverte, leçons, problèmes déjà chargés, Go du jour (dans l'app), revue, réglages.
// - Ne marche pas : partie en ligne, défis entre amis, parties lentes, synchronisation du compte.
// Un seul état réseau : `navigator.onLine` et ses événements (src/app/hooks.ts, `useOnline`).
import type { Mode } from './modes';

/** Modes de l'accueil qui ont besoin du réseau : grisés hors ligne, avec la raison. */
export const MODES_RESEAU: readonly Mode[] = ['en_ligne', 'ami'];

export const besoinReseau = (m: Mode): boolean => MODES_RESEAU.includes(m);

/** Quel bandeau hors ligne montrer : `accueil` (ce qui marche), `reseau` (cet écran en a besoin), ou aucun. */
export type BandeauReseau = 'accueil' | 'reseau' | null;

export function bandeauReseau(c: { enLigne: boolean; accueil: boolean; ecranReseau: boolean }): BandeauReseau {
  if (c.enLigne) return null;
  if (c.ecranReseau) return 'reseau';
  return c.accueil ? 'accueil' : null;
}

/**
 * Partie contre un adversaire qui joue avec KataGo (Bambou et plus fort), hors ligne : sans l'IA sur le téléphone, on
 * propose Caillou (qui tourne sans réseau) ou « Plus tard », jamais une partie qui attend un téléchargement impossible.
 * `iaDispo` : null tant que le cache n'a pas été lu (traité comme absent : mieux vaut proposer Caillou que d'attendre).
 */
export function proposerRepli(c: { katago: boolean; enLigne: boolean; iaDispo: boolean | null }): boolean {
  return c.katago && !c.enLigne && c.iaDispo !== true;
}

/** L'adversaire proposé à la place, hors ligne : le plus fort qui joue sans KataGo. */
export const REPLI_HORS_LIGNE = 'caillou' as const;

/** État de l'IA sur le téléphone, pour les Réglages. */
export type EtatIA = 'verification' | 'prete' | 'a-telecharger' | 'en-cours' | 'echec' | 'hors-ligne';

export function etatIA(c: { enCache: boolean | null; enCours: boolean; echec: boolean; enLigne: boolean }): EtatIA {
  if (c.enCours) return 'en-cours';
  if (c.enCache === null) return 'verification';
  if (c.enCache) return 'prete';
  if (!c.enLigne) return 'hors-ligne';
  return c.echec ? 'echec' : 'a-telecharger';
}
