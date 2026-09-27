// Rejoue une partie (GameRecord, lu depuis un SGF) en validant chaque coup. Sert aussi au serveur (issue #9).
import { boardKey, newPosition, playSuperko, type Color, type Position, type SuperkoError } from './rules';
import type { GameRecord } from './sgf';

export type ReplayError = SuperkoError | 'tour' | 'installation';

export interface ReplayOptions {
  superko?: boolean; // superko positionnel (défaut : ko simple)
  strictTurns?: boolean; // exige l'alternance des couleurs (défaut : oui)
}

export type ReplayResult =
  | { ok: true; pos: Position; passes: number } // passes : passes consécutives à la fin (2 = partie terminée)
  | { ok: false; index: number; error: ReplayError; pos: Position }; // index du coup refusé (-1 : pierres d'installation), pos : position avant ce coup

/** Position de départ : pierres AB/AW puis trait (PL, sinon Blanc après un handicap, sinon Noir). */
export function initialPosition(g: GameRecord): Position | null {
  const pos = newPosition(g.size);
  for (const [list, c] of [[g.setupBlack, 1], [g.setupWhite, 2]] as const) {
    for (const p of list) {
      if (p < 0 || p >= g.size * g.size || pos.board[p]) return null;
      pos.board[p] = c;
    }
  }
  pos.toPlay = g.toPlay ?? (g.setupBlack.length && !g.setupWhite.length ? 2 : 1);
  return pos;
}

export function replay(g: GameRecord, opts: ReplayOptions = {}): ReplayResult {
  const { superko = false, strictTurns = true } = opts;
  let pos = initialPosition(g);
  if (!pos) return { ok: false, index: -1, error: 'installation', pos: newPosition(g.size) };
  const seen = new Set<string>([boardKey(pos.board)]);
  let passes = 0;
  for (let i = 0; i < g.moves.length; i++) {
    const m = g.moves[i];
    if (m.color !== pos.toPlay) {
      if (strictTurns) return { ok: false, index: i, error: 'tour', pos };
      pos = { ...pos, toPlay: m.color as Color, ko: -1 };
    }
    const r = playSuperko(pos, m.p, superko ? seen : new Set());
    if (typeof r === 'string') return { ok: false, index: i, error: r, pos };
    pos = r;
    seen.add(boardKey(pos.board));
    passes = m.p === -1 ? passes + 1 : 0;
  }
  return { ok: true, pos, passes };
}
