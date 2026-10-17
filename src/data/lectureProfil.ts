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
 * #584 : lecture partagée de `mon_profil()` pour les crochets de l'app (pseudo, cote, série, gels : src/app/hooks.ts).
 * À l'ouverture de l'accueil, quatre crochets lisaient la même ligne (quatre appels, dont deux identiques) : ils
 * partagent maintenant une seule lecture. Clé : le client `db`, le compte et la `cle` de relecture de l'appelant (une
 * `cle` plus grande que celle de la lecture gardée force une relecture : pseudo qui vient d'être choisi). Gardée
 * `FRAICHEUR_PROFIL_MS` au plus, oubliée en cas d'erreur et après chaque écriture qui change le profil
 * (`invaliderProfil` : pseudo, départ de la cote, problème, série, coup ou abandon d'une partie classée).
 * Après sa propre écriture, un écran relit par `fetchProfile`, jamais par cette lecture.
 */
export const FRAICHEUR_PROFIL_MS = 30_000;
let partage: { db: Db; userId: string; cle: number; t: number; p: Promise<Result<Profile | null>> } | null = null;

export function lireMonProfil(db: Db, userId: string, cle = 0, maintenant = Date.now()): Promise<Result<Profile | null>> {
  const g = partage;
  if (g && g.db === db && g.userId === userId && cle <= g.cle && maintenant - g.t < FRAICHEUR_PROFIL_MS) return g.p;
  const e = (partage = { db, userId, cle, t: maintenant, p: fetchProfile(db, userId) });
  const oublier = () => { if (partage === e) partage = null; };
  e.p.then(r => { if (!r.ok) oublier(); }, oublier);
  return e.p;
}

/** #584 : le profil vient de changer (ou va changer côté serveur) : la prochaine lecture partagée relit. */
export function invaliderProfil(): void { partage = null; }

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
