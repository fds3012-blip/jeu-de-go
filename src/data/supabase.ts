import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type Db = SupabaseClient<Database>;

interface Env { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string }

/**
 * Flux d'authentification : `implicit` (défaut de supabase-js), gardé volontairement (évalué pour l'écart E14).
 * Le flux PKCE retirerait les jetons de l'adresse de retour (remplacés par `?code=`), mais il garde un secret
 * (code_verifier) dans le stockage du navigateur qui a DEMANDÉ le lien. Le lien de connexion par e-mail
 * (`sendMagicLink`) et la confirmation d'e-mail d'un compte sans e-mail (`garderMonCompte`) échoueraient donc
 * dès qu'on les ouvre ailleurs : navigateur intégré de l'app de messagerie, Safari alors que l'app est installée
 * sur l'écran d'accueil (stockage séparé sur iOS), autre appareil, et plus tard l'app Capacitor.
 * Solution qui marche partout : modèles d'e-mail Supabase en `{{ .TokenHash }}` + `verifyOtp({ token_hash, type })`
 * (réglage du tableau de bord Supabase, à décider). En attendant, PostHog et Sentry ne reçoivent jamais le
 * fragment `#` ni les jetons (src/data/urlSensible.ts).
 */
export const FLUX_AUTH = 'implicit' as const;

/**
 * Crée le client Supabase à partir des variables publiques (URL et clé anon/publishable).
 * Renvoie null si elles manquent ou sont invalides : l'application continue alors hors connexion.
 */
export function createSupabase(env: Env): Db | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  try {
    new URL(url);
    return createClient<Database>(url, key, { auth: { flowType: FLUX_AUTH } });
  } catch {
    return null;
  }
}

export const supabase: Db | null = createSupabase(import.meta.env);
