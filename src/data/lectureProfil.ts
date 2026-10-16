// Lecture du profil du joueur connecté (#513) : module à part, sans le reste de ./account.ts (connexion, pseudo,
// suppression du compte). L'accueil (src/app/hooks.ts) le lit dès le chargement initial ; le reste arrive avec les écrans.
import type { Tables } from './database.types';
import type { Db } from './supabase';
import { t } from '../content/i18n';

export type Profile = Tables<'profiles'>;
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// D4 (#530) : les autres joueurs ne lisent que les colonnes publiques de `profiles` (pseudo, cote) ; série, gels, dates
// et détail de la cote ne se lisent que par `mon_profil()`, qui rend le seul profil du joueur connecté. `userId` reste
// en paramètre : l'appelant ne lit jamais que son propre profil.

export async function fetchProfile(db: Db, _userId: string): Promise<Result<Profile | null>> {
  const { data, error } = await db.rpc('mon_profil').maybeSingle();
  if (error) return { ok: false, error: t('erreur.profil') };
  return { ok: true, value: data };
}

/**
 * Série de jours du joueur connecté (profil `streak_days`, `streak_last`), telle qu'affichée :
 * 0 si le dernier jour joué date d'avant-hier ou plus (même règle que l'onglet Problèmes).
 */
export async function fetchStreak(db: Db, _userId: string, now = new Date()): Promise<Result<number>> {
  const { data, error } = await db.rpc('mon_profil').select('streak_days, streak_last, streak_freezes').maybeSingle();
  if (error) return { ok: false, error: t('erreur.serie') };
  if (!data) return { ok: true, value: 0 };
  return { ok: true, value: liveStreak(data.streak_days, data.streak_last, now, data.streak_freezes) };
}

/** Gels de série en réserve du joueur connecté (profil `streak_freezes`, écrit par le serveur seul ; issue #76). */
export async function fetchGels(db: Db, _userId: string): Promise<Result<number>> {
  const { data, error } = await db.rpc('mon_profil').select('streak_freezes').maybeSingle();
  if (error) return { ok: false, error: t('erreur.gels') };
  return { ok: true, value: data?.streak_freezes ?? 0 };
}

/**
 * La série affichée retombe à 0 si le dernier problème réussi date d'avant-hier ou plus,
 * sauf si les gels en réserve couvrent tous les jours manqués : le serveur les consommera à la prochaine réussite
 * (même règle que gel.ts, issue #76).
 * #563 : ici plutôt que dans puzzles.ts, pour que l'accueil n'emporte pas tout le module des problèmes.
 */
export function liveStreak(days: number, last: string | null, now: Date, freezes = 0): number {
  if (!last || days <= 0) return 0;
  const [y, m, d] = last.split('-').map(Number);
  const lastDay = Date.UTC(y, m - 1, d), today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const manques = Math.round((today - lastDay) / 86_400_000) - 1;
  return manques <= Math.max(0, freezes) ? days : 0;
}
