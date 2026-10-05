// Parties lentes classées (issue #440) : 1 à 3 jours par coup, plusieurs parties à la fois, appariées par la cote.
// Toute la sécurité est côté serveur (supabase/migrations/20261005200100_parties_lentes.sql) :
// - `chercher_partie_lente` : entre dans la file lente, ou crée la partie (taille, délai, cote Glicko-2, 10 au plus) ;
// - `quitter_file_lente` : annule la recherche, ou efface « adversaire trouvé » une fois vu (rend la partie) ;
// - la recherche se lit dans `file_lente` (RLS : sa seule ligne) ;
// - une partie lente EST un défi classé (`defis` + `games.rated`) : coups par `game-action` (action `defi_coup`),
//   temps réel, délai et perte au temps comme les défis (src/data/defi.ts). La cote bouge par le serveur seul.
// Écran : src/app/Lentes.tsx (chargé à la demande) ; la partie se joue dans DefiPartie (src/app/Defis.tsx).
import { CODE_COMPTE_REQUIS, CODE_PSEUDO_REQUIS } from './compteRequis';
import { mesDefis, type EtatDefi } from './defi';
import type { Db } from './supabase';

export type TailleLente = 9 | 13 | 19;
export type DelaiJours = 1 | 2 | 3;

/** Réglages par défaut : 9 × 9, 1 jour par coup (issue #440). */
export const LENTE_DEFAUT: { taille: TailleLente; delai: DelaiJours } = { taille: 9, delai: 1 };
/** Parties lentes en cours au plus par joueur (le serveur fait foi : code JGL10). */
export const LENTES_MAX = 10;
export const CODE_LIMITE_LENTES = 'JGL10';

/** Refus connus, traduits par l'écran. `miseAJour` : le serveur n'a pas encore la migration. */
export type RefusLente = 'compte' | 'limite' | 'miseAJour' | 'serveur';

export function refusLente(erreur: unknown): RefusLente {
  const code = (erreur as { code?: unknown } | null | undefined)?.code;
  if (code === CODE_COMPTE_REQUIS || code === CODE_PSEUDO_REQUIS) return 'compte';
  if (code === CODE_LIMITE_LENTES) return 'limite';
  if (code === 'PGRST202' || code === 'PGRST205' || code === '42P01') return 'miseAJour';
  return 'serveur';
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: RefusLente };
const refus = (e: unknown): { ok: false; error: RefusLente } => ({ ok: false, error: refusLente(e) });

/** Recherche en cours du joueur (sa ligne de `file_lente`). `partieId` : adversaire trouvé pendant son absence. */
export interface RechercheLente {
  taille: TailleLente;
  delai: DelaiJours;
  /** Début de la recherche (ISO). */
  depuis: string;
  partieId: string | null;
}

const estTaille = (n: unknown): n is TailleLente => n === 9 || n === 13 || n === 19;
const estDelai = (n: unknown): n is DelaiJours => n === 1 || n === 2 || n === 3;

/** Ligne de `file_lente` → recherche ; null si elle est mal formée. */
export function lireLigneRecherche(l: Record<string, unknown> | null | undefined): RechercheLente | null {
  if (!l || !estTaille(l.size) || !estDelai(l.delai_jours) || typeof l.created_at !== 'string') return null;
  return { taille: l.size, delai: l.delai_jours, depuis: l.created_at, partieId: typeof l.partie_id === 'string' ? l.partie_id : null };
}

/**
 * Cherche une partie lente. Renvoie la partie si un adversaire attendait (elle commence tout de suite), sinon null :
 * la recherche reste ouverte, sans limite de durée.
 */
export async function chercherPartieLente(db: Db, taille: TailleLente, delai: DelaiJours): Promise<Result<string | null>> {
  const { data, error } = await db.rpc('chercher_partie_lente', { p_size: taille, p_delai_jours: delai });
  if (error) return refus(error);
  return { ok: true, value: data ?? null };
}

/** Annule la recherche, ou efface « adversaire trouvé ». Renvoie la partie trouvée pendant l'attente, ou null. */
export async function quitterFileLente(db: Db): Promise<Result<string | null>> {
  const { data, error } = await db.rpc('quitter_file_lente');
  if (error) return refus(error);
  return { ok: true, value: data ?? null };
}

/** La recherche en cours du joueur (RLS : sa seule ligne), ou null. */
export async function lireRecherche(db: Db, userId: string): Promise<Result<RechercheLente | null>> {
  const { data, error } = await db.from('file_lente').select('size, delai_jours, created_at, partie_id').eq('user_id', userId).maybeSingle();
  if (error) return refus(error);
  return { ok: true, value: lireLigneRecherche(data as Record<string, unknown> | null) };
}

/** Une partie lente est un défi classé : seuls les défis entre amis restent amicaux (rated = false). */
export const estLente = (d: Pick<EtatDefi, 'partie'>): boolean => d.partie.rated === true;

/** Les parties lentes du joueur (en cours et finies), lues comme ses défis, sous la RLS. */
export async function mesPartiesLentes(db: Db, userId: string): Promise<Result<EtatDefi[]>> {
  const r = await mesDefis(db, userId);
  if (!r.ok) return { ok: false, error: 'serveur' };
  return { ok: true, value: r.value.filter(estLente) };
}

/** Délai par coup d'une partie, en jours, lu dans `defis.delai_coup` (« 1 day », « 3 days », « 24:00:00 »). */
export function joursDuDelai(delai: unknown): number | null {
  if (typeof delai !== 'string' || !delai) return null;
  const j = /(\d+)\s*days?/.exec(delai);
  if (j) return Number(j[1]);
  const h = /^(\d+):\d\d:\d\d$/.exec(delai.trim());
  return h && Number(h[1]) % 24 === 0 ? Number(h[1]) / 24 : null;
}
