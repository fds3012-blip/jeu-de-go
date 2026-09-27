// Problèmes : lecture de la table `puzzles`, vérification des réponses avec les règles de src/go,
// enregistrement des essais par la fonction serveur `record_puzzle_attempt` (cote et série de jours).
import type { Json, Tables } from './database.types';
import type { Db } from './supabase';
import type { Result } from './account';
import { fromRows } from '../go/position';
import { play, type MoveError, type Position } from '../go/rules';
import { fromLabel } from '../go/coords';

/** Colonnes utiles d'une ligne de `puzzles`. */
export type PuzzleRow = Pick<Tables<'puzzles'>, 'id' | 'size' | 'answers' | 'title' | 'prompt' | 'explanation' | 'difficulty'> & { setup: Json };

export interface Puzzle {
  id: string;
  size: 9 | 13 | 19;
  rows: string[];
  toPlay: 1 | 2;
  /** Points acceptés (index internes). Chaque réponse est un premier coup correct. */
  answers: number[];
  /** Suite à rejouer par « Voir la suite » (index internes, couleurs alternées). */
  line: number[];
  title: string;
  prompt: string;
  explanation: string | null;
  difficulty: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Valide et convertit une ligne de la base. Renvoie null si elle est mal formée (elle est alors ignorée). */
export function parsePuzzle(row: PuzzleRow): Puzzle | null {
  const size = row.size;
  if (size !== 9 && size !== 13 && size !== 19) return null;
  const setup = row.setup;
  if (!isRecord(setup) || !Array.isArray(setup.rows)) return null;
  const rows = setup.rows;
  if (rows.length !== size || !rows.every(r => typeof r === 'string' && r.length === size && /^[.XOST]+$/.test(r))) return null;
  const toPlay = setup.toPlay === 'W' ? 2 : setup.toPlay === 'B' || setup.toPlay === undefined ? 1 : null;
  if (!toPlay) return null;
  try {
    const answers = row.answers.map(a => fromLabel(a, size));
    if (!answers.length || answers.some(p => p < 0)) return null;
    // Suite enregistrée : colonne `solution` si elle existe un jour (voir la réponse de l'issue #11), sinon la première réponse.
    const stored = (row as { solution?: unknown }).solution;
    const line = Array.isArray(stored) && stored.every(s => typeof s === 'string') && stored.length
      ? (stored as string[]).map(s => fromLabel(s, size))
      : [answers[0]];
    return {
      id: row.id, size, rows: rows as string[], toPlay, answers, line,
      title: row.title ?? 'Problème', prompt: row.prompt ?? 'Trouve le meilleur coup.',
      explanation: row.explanation, difficulty: row.difficulty
    };
  } catch {
    return null;
  }
}

export function parsePuzzles(rows: PuzzleRow[]): Puzzle[] {
  return rows.map(parsePuzzle).filter((p): p is Puzzle => p !== null);
}

/** Position de départ et pierres marquées. */
export function startOf(pz: Puzzle): { pos: Position; marked: number[] } {
  return fromRows(pz.rows, pz.toPlay);
}

export type Check =
  | { kind: 'ok'; after: Position }
  | { kind: 'wrong'; after: Position }
  | { kind: 'illegal'; reason: MoveError };

/** Vérifie un coup du joueur : coup interdit, bonne réponse ou erreur. */
export function checkAnswer(pz: Puzzle, p: number): Check {
  const r = play(startOf(pz).pos, p);
  if (typeof r === 'string') return { kind: 'illegal', reason: r };
  return pz.answers.includes(p) ? { kind: 'ok', after: r } : { kind: 'wrong', after: r };
}

/** Positions successives de la suite (la première est la position de départ). S'arrête au premier coup illégal. */
export function solutionFrames(pz: Puzzle): Position[] {
  const frames = [startOf(pz).pos];
  for (const p of pz.line) {
    const r = play(frames[frames.length - 1], p);
    if (typeof r === 'string') break;
    frames.push(r);
  }
  return frames;
}

/** Problème du jour : le même pour tout le monde un jour donné (date locale), il change à minuit. */
export function puzzleOfDay<T>(list: T[], date: Date): T | undefined {
  if (!list.length) return undefined;
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return list[((day % list.length) + list.length) % list.length];
}

export const ILLEGAL_TEXT: Record<MoveError, string> = {
  occupe: 'Il y a déjà une pierre ici.',
  ko: 'Interdit à cause du ko : tu ne peux pas reprendre tout de suite.',
  suicide: 'Interdit : ta pierre n’aurait aucune liberté.',
  'hors-plateau': 'Ce point est hors du plateau.'
};

// ---- Accès à la base ----

export async function fetchPuzzles(db: Db): Promise<Result<Puzzle[]>> {
  const { data, error } = await db.from('puzzles')
    .select('id, size, setup, answers, title, prompt, explanation, difficulty')
    .is('owner_id', null).order('id');
  if (error) return { ok: false, error: 'Impossible de charger les problèmes.' };
  return { ok: true, value: parsePuzzles(data) };
}

export interface PuzzleStats { rating: number; streak: number; solved: string[]; attempted: string[] }

/** Cote problèmes, série de jours et problèmes déjà tentés du joueur connecté. */
export async function fetchPuzzleStats(db: Db, userId: string): Promise<Result<PuzzleStats>> {
  const [profile, attempts] = await Promise.all([
    db.from('profiles').select('puzzle_rating, streak_days, streak_last').eq('id', userId).maybeSingle(),
    db.from('puzzle_attempts').select('puzzle_id, solved').eq('user_id', userId)
  ]);
  if (profile.error || attempts.error || !profile.data) return { ok: false, error: 'Impossible de charger ta cote.' };
  const rows = attempts.data ?? [];
  return {
    ok: true,
    value: {
      rating: profile.data.puzzle_rating,
      streak: liveStreak(profile.data.streak_days, profile.data.streak_last, new Date()),
      solved: [...new Set(rows.filter(r => r.solved).map(r => r.puzzle_id))],
      attempted: [...new Set(rows.map(r => r.puzzle_id))]
    }
  };
}

/** La série affichée retombe à 0 si le dernier problème réussi date d'avant-hier ou plus. */
export function liveStreak(days: number, last: string | null, now: Date): number {
  if (!last || days <= 0) return 0;
  const [y, m, d] = last.split('-').map(Number);
  const lastDay = Date.UTC(y, m - 1, d), today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return (today - lastDay) / 86_400_000 <= 1 ? days : 0;
}

/** Enregistre un essai et renvoie la nouvelle cote problèmes. */
export async function recordPuzzleAttempt(db: Db, puzzleId: string, solved: boolean): Promise<Result<number>> {
  const { data, error } = await db.rpc('record_puzzle_attempt', { p_puzzle: puzzleId, p_solved: solved });
  if (error || typeof data !== 'number') return { ok: false, error: 'Essai non enregistré. Vérifie ta connexion.' };
  return { ok: true, value: data };
}
