// Partie en direct contre un humain (issue #360) : file d'attente, partie classée, pendule tenue par le serveur.
// Toute la sécurité est côté serveur (supabase/migrations/20261004180100_partie_en_direct.sql) :
// - `find_match` : entre dans la file, ou crée la partie classée (taille, cadence, comptage, cote Glicko-2) ;
// - `quitter_file_attente` : annule l'attente (rend la partie si un adversaire l'a déjà créée) ;
// - `pendule_direct` : signe de présence, constat de la perte au temps, état de la pendule et de la partie ;
// - les coups, le comptage et l'acceptation passent par la fonction serveur `game-action` (src/data/games.ts),
//   l'abandon par `resign_game`. La cote bouge une seule fois, par le serveur (`apply_game_rating`, #417).
// Écran : src/app/Direct.tsx (chargé à la demande).
import { CODE_COMPTE_REQUIS, CODE_PSEUDO_REQUIS } from './compteRequis';
import type { Game } from './games';
import type { Db } from './supabase';
import { lireEtatDirect, type Cadence, type EtatDirect } from '../go/pendule';

export type Regles = 'japanese' | 'chinese';
export type Taille = 9 | 13 | 19;

/** Refus connus, traduits par l'écran. `miseAJour` : le serveur n'a pas encore la nouvelle `find_match`. */
export type RefusDirect = 'compte' | 'miseAJour' | 'introuvable' | 'serveur';

export function refusDirect(erreur: unknown): RefusDirect {
  const code = (erreur as { code?: unknown } | null | undefined)?.code;
  if (code === CODE_COMPTE_REQUIS || code === CODE_PSEUDO_REQUIS) return 'compte';
  // PostgREST : fonction inconnue avec ces paramètres (migration pas encore appliquée).
  if (code === 'PGRST202') return 'miseAJour';
  if (code === 'P0002') return 'introuvable';
  return 'serveur';
}

/** Résultat d'un appel : la valeur, ou un refus connu. */
export type Result<T, E = RefusDirect> = { ok: true; value: T } | { ok: false; error: E };

const refus = (error: unknown): { ok: false; error: RefusDirect } => ({ ok: false, error: refusDirect(error) });

/**
 * Cherche un adversaire. Renvoie l'identifiant de la partie dès qu'elle existe (créée par cet appel, par un adversaire
 * pendant l'attente, ou partie en direct déjà en cours), sinon null : le joueur attend, et rappelle cette fonction.
 */
export async function chercherAdversaire(db: Db, taille: Taille, cadence: Cadence, regles: Regles): Promise<Result<string | null, RefusDirect>> {
  const { data, error } = await db.rpc('find_match', { p_size: taille, p_cadence: cadence, p_regles: regles });
  if (error) return refus(error);
  return { ok: true, value: data ?? null };
}

/** Quitte la file. Renvoie la partie si un adversaire l'a déjà créée (l'écran l'ouvre au lieu d'annuler). */
export async function annulerAttente(db: Db): Promise<Result<string | null, RefusDirect>> {
  const { data, error } = await db.rpc('quitter_file_attente');
  if (error) return refus(error);
  return { ok: true, value: data ?? null };
}

/** État de la partie lu avec l'heure du client à l'envoi et à la réception (pour caler la pendule affichée). */
export interface Lecture { etat: EtatDirect; envoi: number; reception: number }

/** Pendule et partie : vaut aussi signe de présence ; le serveur y constate la perte au temps. */
export async function lirePendule(db: Db, partieId: string, horloge: () => number = Date.now): Promise<Result<Lecture, RefusDirect>> {
  const envoi = horloge();
  const { data, error } = await db.rpc('pendule_direct', { p_partie: partieId });
  const reception = horloge();
  if (error) return refus(error);
  const etat = lireEtatDirect(data);
  return etat ? { ok: true, value: { etat, envoi, reception } } : { ok: false, error: 'serveur' };
}

/** Ligne fixe de la partie (joueurs, taille, règles) : lue une fois, sous la RLS des parties. */
export async function lirePartieDirect(db: Db, partieId: string): Promise<Result<Game, RefusDirect>> {
  const { data, error } = await db.from('games').select('*').eq('id', partieId).maybeSingle();
  if (error) return refus(error);
  return data ? { ok: true, value: data } : { ok: false, error: 'introuvable' };
}

/** Partie à jour : la ligne fixe, avec les coups, le comptage et le résultat lus dans l'état de la pendule. */
export function avecEtat(g: Game, e: EtatDirect): Game {
  return { ...g, moves: e.coups, counting: e.comptage, dead_stones: e.mortes, dead_proposed_by: e.mortesPar, status: e.statut, result: e.resultat };
}

/**
 * Suit la partie en temps réel : coups (table `games`) et pendule (table `parties_direct`, lue par ses deux joueurs).
 * `onChange` est appelé à chaque changement ; l'écran relit alors la pendule. Renvoie la fonction qui arrête le suivi.
 */
export function abonnerDirect(db: Db, partieId: string, onChange: () => void): () => void {
  const canal = db.channel(`direct-${partieId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${partieId}` }, onChange)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'parties_direct', filter: `partie_id=eq.${partieId}` }, onChange)
    .subscribe();
  return () => { void db.removeChannel(canal); };
}

/** Abandonne la partie (le serveur compte la cote). Renvoie le résultat (`W+R` ou `B+R`). */
export async function abandonnerDirect(db: Db, partieId: string): Promise<Result<string, RefusDirect>> {
  const { data, error } = await db.rpc('resign_game', { p_game: partieId });
  if (error || !data) return refus(error);
  return { ok: true, value: data };
}
