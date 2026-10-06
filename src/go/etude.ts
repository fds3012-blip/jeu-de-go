// Goban libre (#372) : une position posée à la main, puis une variante jouée avec les règles. Logique pure.
//
// - La position de départ se pose pierre par pierre (Noir, Blanc, Effacer). Elle reste légale : une pierre posée
//   qui laisserait un groupe, le sien ou un voisin, sans liberté est refusée (rien n'est capturé en posant).
// - « Au trait » dit qui joue le prochain coup (utile à l'analyse).
// - La variante : une seule branche à la fois, jouée avec les règles (prises, ko, suicide interdit). « Revenir »
//   remet la position de départ intacte.
// - Export SGF : la position en AB/AW, le trait en PL, la variante en coups ; se relit avec `readSgf` (import).
import { groupAt, play, type Color, type MoveError, type Position } from './rules';
import { readSgf, writeSgf, type GameRecord } from './sgf';

export type Outil = 'noir' | 'blanc' | 'effacer' | 'jouer';
export const TAILLES_ETUDE = [9, 13, 19] as const;
export type TailleEtude = (typeof TAILLES_ETUDE)[number];
export const KOMI_ETUDE = 6.5;

export interface Etude {
  size: TailleEtude;
  /** Position posée (0 vide, 1 noir, 2 blanc). */
  depart: Int8Array;
  /** Camp au trait au départ. */
  trait: Color;
  /** Coups de la variante, depuis la position de départ (-1 : passe). */
  variante: number[];
}

export function etudeVide(size: TailleEtude = 9): Etude {
  return { size, depart: new Int8Array(size * size), trait: 1, variante: [] };
}

/** Position de départ (sans ko, sans dernier coup). */
export function positionDepart(e: Etude): Position {
  return { size: e.size, board: e.depart, toPlay: e.trait, ko: -1, captures: [0, 0, 0], lastMove: null };
}

/** Positions de la variante : [départ, après le coup 1, …]. Une variante abîmée s'arrête au premier coup refusé. */
export function positionsEtude(e: Etude): Position[] {
  const out = [positionDepart(e)];
  for (const p of e.variante) {
    const r = play(out[out.length - 1], p);
    if (typeof r === 'string') break;
    out.push(r);
  }
  return out;
}

export type RefusPose = 'sansLiberte';

/** Vrai si chaque groupe touché par `p` (le sien et ses voisins) garde au moins une liberté. */
function legaleAutour(board: Int8Array, size: number, p: number): boolean {
  const aVoir = [p];
  const x = p % size, y = Math.floor(p / size);
  if (x > 0) aVoir.push(p - 1);
  if (x < size - 1) aVoir.push(p + 1);
  if (y > 0) aVoir.push(p - size);
  if (y < size - 1) aVoir.push(p + size);
  return aVoir.every(q => !board[q] || groupAt(board, size, q).liberties.size > 0);
}

/**
 * Pose (ou efface) une pierre dans la position de départ. La variante en cours est abandonnée (elle partait d'une
 * autre position). Refus si la position devient illégale (groupe sans liberté).
 */
export function poser(e: Etude, p: number, outil: Exclude<Outil, 'jouer'>): Etude | RefusPose {
  if (p < 0 || p >= e.size * e.size) return e;
  const c = outil === 'noir' ? 1 : outil === 'blanc' ? 2 : 0;
  if (e.depart[p] === c) {
    // Toucher une pierre de la même couleur l'enlève : poser et retirer avec le même outil.
    if (c === 0) return e;
    const depart = e.depart.slice();
    depart[p] = 0;
    return { ...e, depart, variante: [] };
  }
  const depart = e.depart.slice();
  depart[p] = c;
  if (c && !legaleAutour(depart, e.size, p)) return 'sansLiberte';
  return { ...e, depart, variante: [] };
}

/** Joue un coup de la variante, avec les règles. */
export function jouerVariante(e: Etude, p: number): Etude | MoveError {
  const pos = positionsEtude(e).at(-1)!;
  const r = play(pos, p);
  if (typeof r === 'string') return r;
  return { ...e, variante: [...e.variante, p] };
}

/** Nombre de pierres sur la position posée. */
export const pierresPosees = (e: Etude): number => e.depart.reduce((n, c) => n + (c ? 1 : 0), 0);

// ---------- SGF ----------

/** L'étude en SGF : position en AB/AW, trait en PL, variante en coups alternés. */
export function etudeVersSgf(e: Etude): string {
  const setupBlack: number[] = [], setupWhite: number[] = [];
  e.depart.forEach((c, p) => { if (c === 1) setupBlack.push(p); else if (c === 2) setupWhite.push(p); });
  const positions = positionsEtude(e);
  const moves = positions.slice(1).map((q, k) => ({ color: positions[k].toPlay, p: q.lastMove ?? -1 }));
  const g: GameRecord = { size: e.size, komi: KOMI_ETUDE, rules: 'japanese', toPlay: e.trait, setupBlack, setupWhite, moves };
  return writeSgf(g);
}

/** Relit une étude exportée (ou tout SGF de taille 9, 13 ou 19) ; `null` si le fichier ne convient pas. */
export function etudeDepuisSgf(texte: string): Etude | null {
  let g: GameRecord;
  try { g = readSgf(texte); } catch { return null; }
  if (g.size !== 9 && g.size !== 13 && g.size !== 19) return null;
  const e = etudeVide(g.size);
  for (const p of g.setupBlack) e.depart[p] = 1;
  for (const p of g.setupWhite) e.depart[p] = 2;
  e.trait = g.toPlay ?? (g.moves[0]?.color ?? 1);
  let cur: Etude = e;
  for (const m of g.moves) {
    const r = jouerVariante(cur, m.p);
    if (typeof r === 'string') break;
    cur = r;
  }
  return cur;
}

// ---------- Stockage (appareil) ----------

export const ETUDE_KEY = 'go.etude.v1';

/** Étude gardée sur l'appareil, ou `null` si absente ou abîmée. */
export function lireEtude(brut: unknown): Etude | null {
  if (!brut || typeof brut !== 'object') return null;
  const o = brut as Record<string, unknown>;
  return typeof o.sgf === 'string' ? etudeDepuisSgf(o.sgf) : null;
}
