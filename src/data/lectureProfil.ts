// Lecture du profil du joueur connecté (#513) : module à part, sans le reste de ./account.ts (connexion, pseudo,
// suppression du compte). L'accueil (src/app/hooks.ts) le lit dès le chargement initial ; le reste arrive avec les écrans.
import type { Tables } from './database.types';
import type { Db } from './supabase';
import { liveStreak } from './puzzles';
import { t } from '../content/i18n';

export type Profile = Tables<'profiles'>;
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export async function fetchProfile(db: Db, userId: string): Promise<Result<Profile | null>> {
  const { data, error } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) return { ok: false, error: t('erreur.profil') };
  return { ok: true, value: data };
}

/**
 * Série de jours du joueur connecté (profil `streak_days`, `streak_last`), telle qu'affichée :
 * 0 si le dernier jour joué date d'avant-hier ou plus (même règle que l'onglet Problèmes).
 */
export async function fetchStreak(db: Db, userId: string, now = new Date()): Promise<Result<number>> {
  const { data, error } = await db.from('profiles').select('streak_days, streak_last, streak_freezes').eq('id', userId).maybeSingle();
  if (error) return { ok: false, error: t('erreur.serie') };
  if (!data) return { ok: true, value: 0 };
  return { ok: true, value: liveStreak(data.streak_days, data.streak_last, now, data.streak_freezes) };
}

/** Gels de série en réserve du joueur connecté (profil `streak_freezes`, écrit par le serveur seul ; issue #76). */
export async function fetchGels(db: Db, userId: string): Promise<Result<number>> {
  const { data, error } = await db.from('profiles').select('streak_freezes').eq('id', userId).maybeSingle();
  if (error) return { ok: false, error: t('erreur.gels') };
  return { ok: true, value: data?.streak_freezes ?? 0 };
}
