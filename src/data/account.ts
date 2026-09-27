import type { Tables } from './database.types';
import type { Db } from './supabase';
import { usernameErrorFromDb, validateUsername } from './username';

export type Profile = Tables<'profiles'>;
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Envoie le lien de connexion par e-mail (crée le compte s'il n'existe pas). */
export async function sendMagicLink(db: Db, email: string): Promise<Result<null>> {
  const { error } = await db.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: window.location.origin }
  });
  if (error) return { ok: false, error: error.status === 429 ? 'Trop d’essais. Attends une minute et réessaie.' : 'Impossible d’envoyer le lien. Vérifie ton adresse.' };
  return { ok: true, value: null };
}

export async function fetchProfile(db: Db, userId: string): Promise<Result<Profile | null>> {
  const { data, error } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) return { ok: false, error: 'Impossible de charger ton profil.' };
  return { ok: true, value: data };
}

/** Enregistre le pseudo. La base vérifie à nouveau le format et l'unicité. */
export async function saveUsername(db: Db, userId: string, raw: string): Promise<Result<Profile>> {
  const check = validateUsername(raw);
  if (!check.ok) return check;
  const { data, error } = await db.from('profiles').update({ username: check.value }).eq('id', userId).select('*').single();
  if (error) return { ok: false, error: usernameErrorFromDb(error.code) };
  return { ok: true, value: data };
}
