// Fichier généré par scripts/sync-functions.mjs depuis src/go : ne pas modifier ici.
// Logique pure utilisée par la fonction serveur des parties en ligne (issue #9) : validation des coups et comptage final.
// Sans dépendance React ni navigateur : copiée telle quelle dans supabase/functions/game-action/go par
// `npm run sync:functions` (les imports y reçoivent l'extension .ts exigée par Deno).
import { fromSgf, toSgf } from './coords.ts';
import { replay, type ReplayError } from './replay.ts';
import { groupAt, handicapPoints, type Color, type Position } from './rules.ts';
import { score, type Rules } from './score.ts';
import type { GameRecord } from './sgf.ts';

/** Partie telle que stockée dans la table `games`. */
export interface OnlineGame {
  size: number;
  komi: number;
  rules: Rules;
  handicap: number;
  moves: string; // coups SGF concaténés, `tt` = passe
}

export type MoveCheckError = ReplayError | 'format' | 'partie-invalide';

export const MOVE_ERROR_MESSAGES: Record<MoveCheckError, string> = {
  format: 'Coup invalide.',
  'hors-plateau': 'Ce coup est hors du plateau.',
  occupe: 'Cette intersection est déjà occupée.',
  suicide: 'Coup interdit : ta pierre n’aurait plus aucune liberté (suicide).',
  ko: 'Coup interdit par la règle du ko : joue ailleurs avant de reprendre.',
  superko: 'Coup interdit : cette position s’est déjà produite (superko).',
  tour: 'Ce n’est pas ton tour.',
  installation: 'Pierres de handicap invalides.',
  'partie-invalide': 'L’historique de la partie est invalide.'
};

/** Coup SGF (`aa`, `tt` = passe) vers index, ou null si le texte est mal formé ou hors du plateau. */
export function parseMove(s: string, size: number): number | null {
  if (s === 'tt') return -1;
  if (!/^[a-s]{2}$/.test(s)) return null;
  const p = fromSgf(s, size);
  return p < 0 ? null : p;
}

/** Superko positionnel en règles chinoises, ko simple en règles japonaises. */
export const usesSuperko = (rules: Rules) => rules === 'chinese';

/** Reconstruit la partie : pierres de handicap (Blanc commence alors), puis coups en alternance. Null si un coup est mal formé. */
export function recordFromOnlineGame(g: OnlineGame): GameRecord | null {
  if (g.moves.length % 2) return null;
  const setupBlack = g.handicap > 0 ? handicapPoints(g.size, g.handicap) : [];
  let color: Color = setupBlack.length ? 2 : 1;
  const moves: GameRecord['moves'] = [];
  for (let i = 0; i < g.moves.length; i += 2) {
    const p = parseMove(g.moves.slice(i, i + 2), g.size);
    if (p === null) return null;
    moves.push({ color, p });
    color = (3 - color) as Color;
  }
  return { size: g.size, komi: g.komi, rules: g.rules, setupBlack, setupWhite: [], moves };
}

export type ValidateResult =
  | { ok: true; color: Color; record: GameRecord; pos: Position; passes: number }
  | { ok: false; error: MoveCheckError; message: string };

const fail = (error: MoveCheckError): { ok: false; error: MoveCheckError; message: string } => ({ ok: false, error, message: MOVE_ERROR_MESSAGES[error] });

/** Couleur qui doit jouer (null si l'historique est invalide). */
export function colorToPlay(record: GameRecord): Color | null {
  const r = replay(record, { superko: usesSuperko(record.rules) });
  return r.ok ? r.pos.toPlay : null;
}

/**
 * Rejoue la partie puis le coup proposé (SGF, `tt` = passe) pour la couleur au trait.
 * Refuse : format, hors plateau, case occupée, suicide, ko (et superko en règles chinoises).
 */
export function validateMove(record: GameRecord, move: string): ValidateResult {
  const opts = { superko: usesSuperko(record.rules) };
  const before = replay(record, opts);
  if (!before.ok) return fail('partie-invalide');
  if (typeof move !== 'string') return fail('format');
  if (/^[a-z]{2}$/.test(move) && move !== 'tt' && parseMove(move, record.size) === null) return fail('hors-plateau');
  const p = parseMove(move, record.size);
  if (p === null) return fail('format');
  const color = before.pos.toPlay;
  const next: GameRecord = { ...record, moves: [...record.moves, { color, p }] };
  const after = replay(next, opts);
  if (!after.ok) return fail(after.error);
  return { ok: true, color, record: next, pos: after.pos, passes: after.passes };
}

/** Coups SGF concaténés d'une partie. */
export function movesToString(record: GameRecord): string {
  return record.moves.map(m => toSgf(m.p, record.size)).join('');
}

/**
 * Le comptage commence après deux passes consécutives jouées depuis la dernière reprise
 * (`resumedAt` : nombre de coups au moment de la reprise, 0 sinon).
 */
export function countingStarts(passes: number, moveCount: number, resumedAt: number): boolean {
  return Math.min(passes, moveCount - resumedAt) >= 2;
}

/** Liste de pierres mortes (SGF concaténé) vers index ; null si mal formée. */
export function parseDead(s: string, size: number): number[] | null {
  if (typeof s !== 'string' || s.length % 2) return null;
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 2) {
    const p = parseMove(s.slice(i, i + 2), size);
    if (p === null || p < 0) return null;
    out.push(p);
  }
  return out;
}

/**
 * Pierres mortes normalisées : chaque pierre désignée entraîne tout son groupe, liste triée sans doublon.
 * Null si un point est vide ou hors du plateau.
 */
export function normalizeDead(pos: Position, dead: readonly number[]): number[] | null {
  const out = new Set<number>();
  for (const p of dead) {
    if (!Number.isInteger(p) || p < 0 || p >= pos.board.length || !pos.board[p]) return null;
    if (out.has(p)) continue;
    for (const s of groupAt(pos.board, pos.size, p).stones) out.add(s);
  }
  return [...out].sort((a, b) => a - b);
}

export const deadToString = (dead: readonly number[], size: number) => dead.map(p => toSgf(p, size)).join('');

export type FinalScore =
  | { ok: true; result: string; black: number; white: number; winner: 0 | 1 | 2; margin: number; dead: number[] }
  | { ok: false; error: 'partie-invalide' | 'pierres-mortes' };

/** Résultat au format SGF/base : `B+3.5`, `W+12`, `0` pour l'égalité (jigo). */
export function formatResult(winner: 0 | 1 | 2, margin: number): string {
  if (winner === 0) return '0';
  return `${winner === 1 ? 'B' : 'W'}+${Number(margin.toFixed(1))}`;
}

/** Score final après retrait des pierres mortes (score.ts), avec le komi et les règles de la partie. */
export function finalScore(record: GameRecord, dead: readonly number[], komi: number, rules: Rules): FinalScore {
  const r = replay(record, { superko: usesSuperko(record.rules) });
  if (!r.ok) return { ok: false, error: 'partie-invalide' };
  const d = normalizeDead(r.pos, dead);
  if (!d) return { ok: false, error: 'pierres-mortes' };
  const s = score(r.pos, komi, rules, new Set(d));
  const margin = Math.abs(s.black - s.white);
  const winner: 0 | 1 | 2 = margin < 1e-9 ? 0 : s.black > s.white ? 1 : 2;
  return { ok: true, result: formatResult(winner, margin), black: s.black, white: s.white, winner, margin: winner ? margin : 0, dead: d };
}

// ---------------------------------------------------------------------------
// Décision de la fonction serveur : à partir de la ligne `games` et de la demande, calcule l'écriture à faire.
// La fonction Deno se contente de lire la partie, d'appeler `planAction`, puis d'écrire sous condition.

/** Colonnes de `games` lues par la fonction serveur. */
export interface GameRow {
  id: string;
  black_id: string | null;
  white_id: string | null;
  bot_id: string | null;
  size: number;
  rules: string;
  komi: number | string;
  handicap: number;
  moves: string;
  status: string;
  counting: boolean;
  dead_stones: string | null;
  dead_proposed_by: string | null;
  resumed_at: number;
}

export type ActionRequest =
  | { action: 'move'; gameId: string; move: string }
  | { action: 'propose_dead'; gameId: string; dead: string }
  | { action: 'accept'; gameId: string }
  | { action: 'resume'; gameId: string };

/** Valeurs attendues au moment de l'écriture : si la ligne a changé entre-temps, l'écriture est refusée (409). */
export interface Expect { moves: string; counting: boolean; dead_stones: string | null }

export type GamePatch = Partial<Pick<GameRow, 'moves' | 'counting' | 'dead_stones' | 'dead_proposed_by' | 'resumed_at'>>;

export type ActionPlan =
  | { ok: true; kind: 'update'; expect: Expect; patch: GamePatch }
  | { ok: true; kind: 'finish'; expect: Expect; result: string; black: number; white: number }
  | { ok: false; status: number; error: string; message: string };

const refuse = (status: number, error: string, message: string): ActionPlan => ({ ok: false, status, error, message });

/** Vérifie la forme de la demande envoyée par le client. */
export function parseActionRequest(body: unknown): ActionRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.gameId !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.gameId)) return null;
  if (b.action === 'move' && typeof b.move === 'string' && b.move.length <= 4) return { action: 'move', gameId: b.gameId, move: b.move };
  if (b.action === 'propose_dead' && typeof b.dead === 'string' && b.dead.length <= 722) return { action: 'propose_dead', gameId: b.gameId, dead: b.dead };
  if (b.action === 'accept' || b.action === 'resume') return { action: b.action, gameId: b.gameId };
  return null;
}

export function planAction(game: GameRow, userId: string, req: ActionRequest): ActionPlan {
  if (game.bot_id !== null) return refuse(400, 'bot', 'Réservé aux parties entre humains.');
  if (game.status !== 'active') return refuse(409, 'terminee', 'La partie n’est pas en cours.');
  const color: Color | 0 = userId === game.black_id ? 1 : userId === game.white_id ? 2 : 0;
  if (!color) return refuse(403, 'spectateur', 'Tu ne joues pas dans cette partie.');
  const rules: Rules = game.rules === 'chinese' ? 'chinese' : 'japanese';
  const komi = Number(game.komi);
  const record = recordFromOnlineGame({ size: game.size, komi, rules, handicap: game.handicap, moves: game.moves });
  if (!record) return refuse(500, 'partie-invalide', MOVE_ERROR_MESSAGES['partie-invalide']);
  const expect: Expect = { moves: game.moves, counting: game.counting, dead_stones: game.dead_stones };

  if (req.action === 'move') {
    if (game.counting) return refuse(409, 'comptage', 'Comptage en cours : reprends la partie pour jouer.');
    const toPlay = colorToPlay(record);
    if (toPlay === null) return refuse(500, 'partie-invalide', MOVE_ERROR_MESSAGES['partie-invalide']);
    if (toPlay !== color) return refuse(409, 'tour', MOVE_ERROR_MESSAGES.tour);
    const v = validateMove(record, req.move);
    if (!v.ok) return refuse(422, v.error, v.message);
    const moves = movesToString(v.record);
    const counting = countingStarts(v.passes, v.record.moves.length, game.resumed_at);
    return { ok: true, kind: 'update', expect, patch: counting ? { moves, counting, dead_stones: null, dead_proposed_by: null } : { moves } };
  }

  if (!game.counting) return refuse(409, 'pas-de-comptage', 'Le comptage commence après deux passes de suite.');

  if (req.action === 'resume') {
    return { ok: true, kind: 'update', expect, patch: { counting: false, dead_stones: null, dead_proposed_by: null, resumed_at: record.moves.length } };
  }

  if (req.action === 'propose_dead') {
    const final = replay(record, { superko: usesSuperko(rules) });
    const parsed = parseDead(req.dead, game.size);
    const dead = final.ok && parsed ? normalizeDead(final.pos, parsed) : null;
    if (!dead) return refuse(422, 'pierres-mortes', 'Pierres mortes invalides : choisis des pierres présentes sur le plateau.');
    return { ok: true, kind: 'update', expect, patch: { dead_stones: deadToString(dead, game.size), dead_proposed_by: userId } };
  }

  // accept
  if (game.dead_stones === null || !game.dead_proposed_by) return refuse(409, 'pas-de-proposition', 'Aucune proposition de pierres mortes à accepter.');
  if (game.dead_proposed_by === userId) return refuse(409, 'proposition-propre', 'C’est à l’autre joueur d’accepter ta proposition.');
  const dead = parseDead(game.dead_stones, game.size);
  const s = dead ? finalScore(record, dead, komi, rules) : null;
  if (!s || !s.ok) return refuse(500, 'partie-invalide', 'Comptage impossible.');
  return { ok: true, kind: 'finish', expect, result: s.result, black: s.black, white: s.white };
}
