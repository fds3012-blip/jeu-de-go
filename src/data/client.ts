/**
 * Client Supabase chargé à la demande (#401, budget du JS initial).
 *
 * supabase-js pèse ≈ 57 Ko gzip, et l'accueil d'un premier lancement n'en a pas besoin. Ce module, léger, ne l'importe
 * pas : il sait seulement si des comptes sont configurés (`COMPTES`), et charge `./supabase` (le vrai client) :
 * - tout de suite si le premier écran en a besoin (`chargementUrgent`) : session enregistrée sur l'appareil, retour de
 *   connexion (jetons dans l'adresse), lien de défi (src/main.tsx) ;
 * - sinon après le premier écran (src/main.tsx, `apresPremierEcran`), ou plus tôt si une action le demande.
 *
 * Les écrans lisent le client avec `useSupabase()` : `undefined` pendant le chargement, `null` sans comptes (ou chargement
 * impossible), le client sinon. Règle (src/data/client.test.ts) : aucun module de l'app n'importe `./supabase` ni
 * `@supabase/supabase-js` autrement qu'en type ; seul ce fichier le charge, par `import()`.
 */
import { useSyncExternalStore } from 'react';
import type { Db } from './supabase';

interface Env { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string }

/** URL et clé publique valides, ou null (l'application continue alors hors connexion). */
export function configSupabase(env: Env): { url: string; key: string } | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  try {
    new URL(url);
    return { url, key };
  } catch {
    return null;
  }
}

/**
 * Tests de bout en bout seulement (build VITE_E2E) : une adresse de Supabase simulé, posée dans le stockage local
 * par le test (`e2e.supabase`), remplace celle de l'environnement. Le test intercepte alors tous les appels réseau.
 * Absent des builds de production.
 */
export function envDeTest(env: Env): Env {
  if (!import.meta.env.VITE_E2E) return env;
  try {
    const url = localStorage.getItem('e2e.supabase');
    if (url) return { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: 'cle-publique-de-test' };
  } catch { /* pas de stockage : environnement normal */ }
  return env;
}

/** Vrai si des comptes sont possibles (variables publiques présentes et valides). Connu sans charger supabase-js. */
export const COMPTES: boolean = configSupabase(envDeTest(import.meta.env)) !== null;

/** Clé de session de supabase-js dans le stockage local : `sb-<premier mot de l'hôte>-auth-token`. */
const CLE_SESSION = /^sb-.+-auth-token$/;
/** Retour d'un lien de connexion ou de Google (flux implicite, voir FLUX_AUTH) : jetons ou erreur dans l'adresse. */
const RETOUR_AUTH = /(?:^|[#&?])(?:access_token|refresh_token|error_description|error_code)=/;

/** Vrai si une session est peut-être enregistrée sur l'appareil, ou arrive dans l'adresse. Sans elle, pas de session. */
export function sessionProbable(stockage: Pick<Storage, 'length' | 'key'> | undefined = stockageLocal(), adresse = adresseCourante()): boolean {
  if (RETOUR_AUTH.test(adresse)) return true;
  if (!stockage) return false;
  try {
    for (let i = 0; i < stockage.length; i++) if (CLE_SESSION.test(stockage.key(i) ?? '')) return true;
  } catch { /* stockage illisible : pas de session lisible non plus */ }
  return false;
}

function stockageLocal(): Storage | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; }
}
function adresseCourante(): string {
  return typeof location === 'undefined' ? '' : location.hash + location.search;
}

/** Le premier écran a besoin du client : session probable (compte, défi en cours, retour de connexion). */
export function chargementUrgent(): boolean {
  return COMPTES && sessionProbable();
}

// --- Chargement et abonnement -----------------------------------------------------------------------------------

let client: Db | null | undefined = COMPTES ? undefined : null;
let promesse: Promise<Db | null> | null = null;
const abonnes = new Set<() => void>();

function publier(v: Db | null) {
  if (client === v) return;
  client = v;
  abonnes.forEach(f => f());
}

/** Réseau mobile instable : quelques nouveaux essais espacés (comme les écrans, src/app/ecrans.ts). */
async function avecEssais<M>(importer: () => Promise<M>, delais: readonly number[]): Promise<M> {
  for (let i = 0; ; i++) {
    try {
      return await importer();
    } catch (err) {
      if (i >= delais.length) throw err;
      await new Promise(r => setTimeout(r, delais[i]));
    }
  }
}

/**
 * Charge le client (une seule fois). Sans comptes : null. Échec (hors ligne sans cache) : null pour l'instant, et un
 * nouvel essai au prochain appel ou au retour du réseau. Un morceau disparu après un déploiement déclenche
 * `vite:preloadError`, qui recharge la page (src/main.tsx).
 */
export function chargerSupabase(importer: () => Promise<{ supabase: Db | null }> = () => import('./supabase'),
  delais: readonly number[] = [500, 1500, 3000]): Promise<Db | null> {
  if (!COMPTES) return Promise.resolve(null);
  promesse ??= avecEssais(importer, delais).then(
    m => { publier(m.supabase); return m.supabase; },
    () => {
      promesse = null;
      publier(null);
      if (typeof window !== 'undefined') window.addEventListener('online', () => { void chargerSupabase(); }, { once: true });
      return null;
    },
  );
  return promesse;
}

/** Client déjà chargé : `undefined` pendant le chargement, `null` sans comptes. */
export function supabaseCharge(): Db | null | undefined {
  return client;
}

function abonner(f: () => void): () => void {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}

/** Le client Supabase pour un composant React : `undefined` pendant le chargement, `null` sans comptes. */
export function useSupabase(): Db | null | undefined {
  return useSyncExternalStore(abonner, supabaseCharge, supabaseCharge);
}

/** Réservé aux tests. */
export function _reinitialiserClient(etat: Db | null | undefined = COMPTES ? undefined : null): void {
  client = etat;
  promesse = null;
}
