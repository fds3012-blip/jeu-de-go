// Compte obligatoire avec pseudo (issue #343) : contrat entre le serveur et le client.
// Les fonctions `creer_defi`, `rejoindre_defi` (nouvel invité), `find_match` et `join_game` refusent
// (migration supabase/migrations/20260930233100_compte_obligatoire.sql) avec deux codes d'erreur distincts :
//   JGC01 : pas de session ou session anonyme  → écran « Crée ton compte » ;
//   JGP01 : compte sans pseudo                   → écran « Choisis ton pseudo ».
// Un joueur déjà dans un défi (même anonyme) garde sa partie : ces codes ne concernent que l'entrée.
// `apercuDefi` lit ce que l'ami voit avant de créer son compte (pseudo du créateur, taille, état du lien),
// sans session.
import type { Result } from './account';
import type { Db } from './supabase';

export const CODE_COMPTE_REQUIS = 'JGC01';
export const CODE_PSEUDO_REQUIS = 'JGP01';

/** Ce qui manque au joueur pour jouer contre d'autres joueurs. */
export type CompteRequis = 'compte' | 'pseudo';

/**
 * Lit une erreur de Supabase (RPC : `{ code, message }`) et dit si c'est un refus « compte requis » ou
 * « pseudo requis » ; null pour toute autre erreur.
 */
export function compteRequis(erreur: unknown): CompteRequis | null {
  const code = (erreur as { code?: unknown } | null | undefined)?.code;
  if (code === CODE_COMPTE_REQUIS) return 'compte';
  if (code === CODE_PSEUDO_REQUIS) return 'pseudo';
  return null;
}

/** État d'un lien de défi vu par l'ami. */
export type EtatLienDefi = 'libre' | 'pris' | 'expire' | 'fini';

export interface ApercuDefi {
  /** Pseudo de celui qui invite (null s'il a supprimé son compte ou n'a pas de pseudo). */
  createurPseudo: string | null;
  taille: number;
  etat: EtatLienDefi;
  /** Place de l'appelant s'il est déjà dans ce défi (il peut y retourner sans compte). */
  maPlace: 'createur' | 'invite' | null;
}

const ETATS: readonly string[] = ['libre', 'pris', 'expire', 'fini'];

/** Convertit une ligne renvoyée par `apercu_defi` ; null si elle est absente ou mal formée. */
export function lireApercu(ligne: unknown): ApercuDefi | null {
  if (!ligne || typeof ligne !== 'object') return null;
  const l = ligne as Record<string, unknown>;
  if (typeof l.etat !== 'string' || !ETATS.includes(l.etat) || typeof l.taille !== 'number') return null;
  return {
    createurPseudo: typeof l.createur_pseudo === 'string' ? l.createur_pseudo : null,
    taille: l.taille,
    etat: l.etat as EtatLienDefi,
    maPlace: l.ma_place === 'createur' || l.ma_place === 'invite' ? l.ma_place : null
  };
}

/**
 * Aperçu d'un défi par son jeton, sans session ni compte. `null` si le lien est inconnu ; erreur si le serveur
 * ne répond pas.
 */
export async function apercuDefi(db: Db, jeton: string): Promise<Result<ApercuDefi | null>> {
  const { data, error } = await db.rpc('apercu_defi', { p_jeton: jeton });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: lireApercu(Array.isArray(data) ? data[0] : null) };
}
