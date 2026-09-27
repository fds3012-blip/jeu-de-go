// Parties en ligne entre humains : toutes les actions de jeu passent par la fonction serveur `game-action`
// (supabase/functions/game-action), qui rejoue la partie et refuse les coups illégaux. La fonction SQL play_move
// n'est plus appelable par les clients. L'abandon reste l'appel RPC `resign_game`.
import type { Tables } from './database.types';
import type { Result } from './account';
import type { Db } from './supabase';

export type Game = Tables<'games'>;

export type GameAction =
  | { action: 'move'; gameId: string; move: string } // coup SGF, `tt` = passe
  | { action: 'propose_dead'; gameId: string; dead: string } // pierres mortes, SGF concaténé
  | { action: 'accept'; gameId: string }
  | { action: 'resume'; gameId: string };

/** Réponse de la fonction serveur. */
export type GameActionResponse =
  | { ok: true; game: Partial<Game> }
  | { ok: true; result: string; black: number; white: number }
  | { ok: false; error: string; message: string };

const FALLBACK = 'Impossible de joindre le serveur. Vérifie ta connexion et réessaie.';

/** Lit le message d'erreur renvoyé par la fonction (corps JSON `{ message }`), sinon un message générique. */
export async function errorMessage(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx && typeof (ctx as Response).json === 'function') {
    try {
      const body = (await (ctx as Response).json()) as { message?: unknown };
      if (typeof body.message === 'string' && body.message) return body.message;
    } catch {
      // corps illisible : message générique
    }
  }
  return FALLBACK;
}

export async function gameAction(db: Db, body: GameAction): Promise<Result<GameActionResponse & { ok: true }>> {
  const { data, error } = await db.functions.invoke<GameActionResponse>('game-action', { body });
  if (error) return { ok: false, error: await errorMessage(error) };
  if (!data || !data.ok) return { ok: false, error: data?.message ?? FALLBACK };
  return { ok: true, value: data };
}

/** Joue un coup (SGF deux lettres, `tt` pour passer). Refusé par le serveur s'il est illégal. */
export const playMove = (db: Db, gameId: string, move: string) => gameAction(db, { action: 'move', gameId, move });

/** Après deux passes : propose la liste des pierres mortes (l'autre joueur accepte ou reprend). */
export const proposeDeadStones = (db: Db, gameId: string, dead: string) => gameAction(db, { action: 'propose_dead', gameId, dead });

/** Accepte la proposition de l'adversaire : le serveur compte et met à jour les cotes si la partie est classée. */
export const acceptScore = (db: Db, gameId: string) => gameAction(db, { action: 'accept', gameId });

/** Refuse le comptage et reprend la partie. */
export const resumeGame = (db: Db, gameId: string) => gameAction(db, { action: 'resume', gameId });
