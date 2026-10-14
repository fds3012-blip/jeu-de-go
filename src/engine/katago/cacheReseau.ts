// Adresses du réseau KataGo et lecture du cache (#475), à part du client KataGo (#538) : l'accueil sait si l'IA est sur
// le téléphone sans tirer le client, le Worker ni la recherche dans le JS initial.
import { CACHE_NAME, DEFAULT_MODEL_URL, LEGACY_MODEL_URL } from './loader';

function modelUrl(): string {
  // Écrit en toutes lettres pour que Vite remplace la variable au build.
  return (import.meta.env.VITE_KATAGO_MODEL_URL as string | undefined) || DEFAULT_MODEL_URL;
}

/**
 * Adresses du réseau, dans l'ordre (#475) : notre copie (mochi-go.app/reseaux/…, ou `VITE_KATAGO_MODEL_URL`),
 * puis la copie du dépôt KataGo si la nôtre ne répond pas. Absolues : le Worker et le cache les comparent telles quelles.
 */
export function modelUrls(): string[] {
  const base = typeof location !== 'undefined' ? location.href : 'http://localhost/';
  return [...new Set([modelUrl(), LEGACY_MODEL_URL].map(u => new URL(u, base).href))];
}

/** Vrai si le réseau KataGo est déjà dans le cache du navigateur (Cache API) : le charger ne télécharge rien. */
export async function reseauEnCache(): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false;
    const cache = await caches.open(CACHE_NAME);
    // Notre copie ou l'ancienne (raw.githubusercontent.com, avant #475) : l'une ou l'autre suffit.
    for (const url of modelUrls()) if (await cache.match(url)) return true;
    return false;
  } catch { return false; }
}
