import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type Db = SupabaseClient<Database>;

interface Env { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string }

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
    return createClient<Database>(url, key);
  } catch {
    return null;
  }
}

export const supabase: Db | null = createSupabase(import.meta.env);
