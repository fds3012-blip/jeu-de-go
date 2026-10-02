/**
 * Robustesse (#325, point 4) : un joueur ne voit jamais un écran blanc ni une erreur brute.
 * Logique pure, testée dans robustesse.test.ts :
 * - catégorie d'une erreur (chargement d'un écran, réseau, rendu), pour choisir la phrase de l'écran d'erreur
 *   et l'étiquette envoyée à Sentry ;
 * - message de l'erreur sans rien de personnel (adresse nettoyée : src/data/urlSensible.ts).
 */
import { nettoyerTexte } from '../data/urlSensible';

/**
 * - `chargement` : un morceau JS ou CSS chargé à la demande n'est pas arrivé (hors ligne sans cache, nouvelle version
 *   déployée pendant que l'app était ouverte, réseau coupé en route) ;
 * - `reseau` : un appel réseau a échoué (Supabase, fetch) ;
 * - `rendu` : tout le reste (bogue de l'app).
 */
export type CategorieErreur = 'chargement' | 'reseau' | 'rendu';

// Messages des navigateurs quand `import()` échoue (Chrome, Firefox, Safari) et erreur de préchargement de Vite.
const CHARGEMENT = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /unable to preload css/i,
  /chunkloaderror/i,
  /loading (css )?chunk [\w-]+ failed/i,
  /dynamically imported module/i,
];
const RESEAU = [/failed to fetch/i, /networkerror/i, /network request failed/i, /load failed/i, /the internet connection appears to be offline/i, /fetch failed/i];

/** Message d'une erreur quelconque (`Error`, chaîne, objet avec `message`), ou chaîne vide. */
export function messageDe(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
    // Événement `vite:preloadError` : l'erreur est dans `payload`.
    const p = (err as { payload?: unknown }).payload;
    if (p && p !== err) return messageDe(p);
  }
  return '';
}

/** Vrai si l'erreur vient d'un écran chargé à la demande qui n'est pas arrivé. */
export function estErreurDeChargement(err: unknown): boolean {
  const nom = err && typeof err === 'object' ? String((err as { name?: unknown }).name ?? '') : '';
  if (/chunkloaderror/i.test(nom)) return true;
  const m = messageDe(err);
  return CHARGEMENT.some(r => r.test(m));
}

/** Catégorie d'une erreur, pour la phrase montrée au joueur et l'étiquette Sentry. */
export function categoriserErreur(err: unknown, horsLigne = false): CategorieErreur {
  if (estErreurDeChargement(err)) return 'chargement';
  const m = messageDe(err);
  if (RESEAU.some(r => r.test(m))) return 'reseau';
  // Hors ligne, une erreur de type `TypeError` sans message reconnu est presque toujours un appel réseau.
  if (horsLigne && err instanceof TypeError) return 'reseau';
  return 'rendu';
}

/** Clé du texte d'explication de l'écran d'erreur, selon la catégorie et l'état du réseau. */
export function cleExplication(categorie: CategorieErreur, horsLigne: boolean): 'erreur.horsLigne' | 'erreur.chargement' | 'erreur.reseau' | 'erreur.rendu' {
  if (horsLigne && categorie !== 'rendu') return 'erreur.horsLigne';
  if (categorie === 'chargement') return 'erreur.chargement';
  if (categorie === 'reseau') return 'erreur.reseau';
  return 'erreur.rendu';
}

/** Message bref et sans donnée personnelle, pour les journaux (`console`) et l'étiquette Sentry. */
export function messageSur(err: unknown): string {
  return nettoyerTexte(messageDe(err)).slice(0, 200);
}
