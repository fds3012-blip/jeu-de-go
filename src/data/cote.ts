// Cote de jeu (issue #417) : lecture de la cote, de son historique sur 30 jours, du gain d'une partie classée, et
// choix du point de départ. Toute écriture passe par le serveur (supabase/migrations/20261004120100_cote_glicko.sql) :
// `choisir_depart_cote` pour le départ, `apply_game_rating` (interne) après chaque partie classée entre humains.
// Le client ne fait que lire : profil public (`profiles`), son propre historique (`rating_history`, RLS).
import type { Result } from './account';
import { CODE_COMPTE_REQUIS, CODE_PSEUDO_REQUIS } from './compteRequis';
import type { Db } from './supabase';
import type { Depart } from '../go/cote';

export interface MaCote {
  cote: number;
  provisoire: boolean;
  /** Parties classées comptées. Le départ se choisit tant qu'il vaut 0. */
  parties: number;
  depart: Depart | null;
  /** Grade choisi à « Je joue en club » : kyu, 0 pour le 1er dan. */
  departKyu: number | null;
}

export interface PointCourbe {
  /** Date ISO. */
  le: string;
  cote: number;
}

/** Gain d'une partie classée, lu dans l'historique du joueur. */
export interface GainPartie {
  avant: number;
  apres: number;
  ecart: number;
  provisoire: boolean;
}

/** Fenêtre de la courbe du Profil. */
export const JOURS_COURBE = 30;

const DEPARTS_CONNUS: readonly string[] = ['decouvre', 'regles', 'club'];

/** Convertit une ligne de `profiles` ; null si elle est mal formée. */
export function lireMaCote(l: unknown): MaCote | null {
  if (!l || typeof l !== 'object') return null;
  const p = l as Record<string, unknown>;
  if (typeof p.rating !== 'number') return null;
  return {
    cote: p.rating,
    provisoire: p.cote_provisoire !== false,
    parties: typeof p.cote_parties === 'number' ? p.cote_parties : 0,
    depart: typeof p.cote_depart === 'string' && DEPARTS_CONNUS.includes(p.cote_depart) ? (p.cote_depart as Depart) : null,
    departKyu: typeof p.cote_depart_kyu === 'number' ? p.cote_depart_kyu : null,
  };
}

/** La cote du joueur et sa courbe sur 30 jours (parties classées et départ), du plus ancien au plus récent. */
export async function chargerMaCote(db: Db, userId: string, maintenant = Date.now()): Promise<Result<{ cote: MaCote; courbe: PointCourbe[] }>> {
  const depuis = new Date(maintenant - JOURS_COURBE * 864e5).toISOString();
  const [p, h] = await Promise.all([
    db.from('profiles').select('rating, cote_provisoire, cote_parties, cote_depart, cote_depart_kyu').eq('id', userId).maybeSingle(),
    db.from('rating_history').select('rating, created_at').eq('user_id', userId).in('kind', ['game', 'depart'])
      .gte('created_at', depuis).order('created_at', { ascending: true }).limit(200),
  ]);
  const cote = p.error ? null : lireMaCote(p.data);
  if (!cote) return { ok: false, error: 'profil' };
  const courbe = h.error ? [] : (h.data ?? [])
    .filter(x => typeof x.rating === 'number' && typeof x.created_at === 'string')
    .map(x => ({ le: x.created_at, cote: x.rating }));
  return { ok: true, value: { cote, courbe } };
}

/** Cote publique d'un joueur (carte de l'adversaire) ; null si inconnue. */
export async function coteJoueur(db: Db, id: string): Promise<{ cote: number; provisoire: boolean } | null> {
  const { data, error } = await db.from('profiles').select('rating, cote_provisoire').eq('id', id).maybeSingle();
  if (error || !data || typeof data.rating !== 'number') return null;
  return { cote: data.rating, provisoire: data.cote_provisoire !== false };
}

/** Points gagnés ou perdus dans une partie classée ; null tant que le serveur ne l'a pas comptée. */
export async function gainDePartie(db: Db, gameId: string, userId: string): Promise<GainPartie | null> {
  const [h, p] = await Promise.all([
    db.from('rating_history').select('rating, ecart').eq('user_id', userId).eq('game_id', gameId).eq('kind', 'game').maybeSingle(),
    db.from('profiles').select('cote_provisoire').eq('id', userId).maybeSingle(),
  ]);
  if (h.error || !h.data || typeof h.data.rating !== 'number' || typeof h.data.ecart !== 'number') return null;
  return { avant: h.data.rating - h.data.ecart, apres: h.data.rating, ecart: h.data.ecart, provisoire: p.data?.cote_provisoire !== false };
}

/** Refus connus de `choisir_depart_cote`. */
export const CODES_DEPART = {
  JGR01: 'dejaLancee',
  JGR02: 'invalide',
  JGR03: 'partieEnCours',
  [CODE_COMPTE_REQUIS]: 'compte',
  [CODE_PSEUDO_REQUIS]: 'compte',
} as const;
export type RefusDepart = (typeof CODES_DEPART)[keyof typeof CODES_DEPART] | 'serveur';

export function refusDepart(erreur: unknown): RefusDepart {
  const code = (erreur as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && code in CODES_DEPART ? CODES_DEPART[code as keyof typeof CODES_DEPART] : 'serveur';
}

/** Choisit le point de départ (avant la première partie classée). Renvoie la nouvelle cote. */
export async function choisirDepart(db: Db, depart: Depart, kyu?: number): Promise<{ ok: true; value: number } | { ok: false; error: RefusDepart }> {
  // `p_kyu` absent (undefined, non envoyé) hors « Je joue en club ».
  const { data, error } = await db.rpc('choisir_depart_cote', { p_depart: depart, p_kyu: depart === 'club' ? kyu : undefined });
  if (error || typeof data !== 'number') return { ok: false, error: refusDepart(error) };
  return { ok: true, value: data };
}
