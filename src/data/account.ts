import type { Tables } from './database.types';
import type { Db } from './supabase';
import { usernameErrorFromDb, validateUsername } from './username';
import { liveStreak } from './puzzles';

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

/**
 * Série de jours du joueur connecté (profil `streak_days`, `streak_last`), telle qu'affichée :
 * 0 si le dernier jour joué date d'avant-hier ou plus (même règle que l'onglet Problèmes).
 */
export async function fetchStreak(db: Db, userId: string, now = new Date()): Promise<Result<number>> {
  const { data, error } = await db.from('profiles').select('streak_days, streak_last, streak_freezes').eq('id', userId).maybeSingle();
  if (error) return { ok: false, error: 'Impossible de charger ta série.' };
  if (!data) return { ok: true, value: 0 };
  return { ok: true, value: liveStreak(data.streak_days, data.streak_last, now, data.streak_freezes) };
}

/** Gels de série en réserve du joueur connecté (profil `streak_freezes`, écrit par le serveur seul ; issue #76). */
export async function fetchGels(db: Db, userId: string): Promise<Result<number>> {
  const { data, error } = await db.from('profiles').select('streak_freezes').eq('id', userId).maybeSingle();
  if (error) return { ok: false, error: 'Impossible de charger tes gels.' };
  return { ok: true, value: data?.streak_freezes ?? 0 };
}

/** Enregistre le pseudo. La base vérifie à nouveau le format et l'unicité. */
export async function saveUsername(db: Db, userId: string, raw: string): Promise<Result<Profile>> {
  const check = validateUsername(raw);
  if (!check.ok) return check;
  const { data, error } = await db.from('profiles').update({ username: check.value }).eq('id', userId).select('*').single();
  if (error) return { ok: false, error: usernameErrorFromDb(error.code) };
  return { ok: true, value: data };
}
