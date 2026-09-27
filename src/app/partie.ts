// Logique pure de l'écran de partie : barre d'avantage, liste des coups, détection d'atari.
import { groupAt, neighbors, type Color, type Position } from '../go/rules';
import { toLabel } from '../go/coords';

const virgule = (n: number) => String(n).replace('.', ',');

/** Avance arrondie au demi-point (le komi a souvent une demie). */
export function arrondiDemi(n: number): number {
  return Math.round(n * 2) / 2;
}

/** Libellé de la barre d'avantage : « Noir +3,5 », « Blanc +12 » ou « À égalité ». `lead` : avance de Noir. */
export function libelleAvantage(lead: number): string {
  const a = arrondiDemi(lead);
  if (a === 0) return 'À égalité';
  return `${a > 0 ? 'Noir' : 'Blanc'} +${virgule(Math.abs(a))}`;
}

/**
 * Part de la barre occupée par Noir, entre 4 % et 96 % : la barre ne se remplit jamais complètement,
 * et un écart d'un plateau entier (taille × 1,5 points) en occupe environ les trois quarts.
 */
export function partNoir(lead: number, size: number): number {
  const p = 0.5 + 0.5 * Math.tanh(lead / (size * 1.5));
  return Math.min(0.96, Math.max(0.04, p));
}

/** Libellé d'un coup dans la liste : « 8. D6 », « 9. passe ». `numero` commence à 1. */
export function libelleCoup(numero: number, coup: number, size: number): string {
  return `${numero}. ${toLabel(coup, size)}`;
}

/** Coups joués depuis le début (index de plateau, -1 = passe), tirés de l'historique des positions. */
export function coupsJoues(history: Position[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < history.length; i++) out.push(history[i].lastMove ?? -1);
  return out;
}

export interface Atari { pierres: number[]; liberte: number }

/** Groupes de couleur `c` qui n'ont plus qu'une liberté. */
export function groupesEnAtari(board: Int8Array, size: number, c: Color): Atari[] {
  const vu = new Uint8Array(board.length), out: Atari[] = [];
  for (let p = 0; p < board.length; p++) {
    if (board[p] !== c || vu[p]) continue;
    const g = groupAt(board, size, p);
    for (const s of g.stones) vu[s] = 1;
    if (g.liberties.size === 1) out.push({ pierres: g.stones, liberte: [...g.liberties][0] });
  }
  return out;
}

/**
 * Groupes de couleur `c` mis en atari par le dernier coup : en atari dans `apres`,
 * et qui ne l'étaient pas déjà dans `avant` (on ne répète pas l'alerte à chaque coup).
 */
export function nouveauxAtari(avant: Int8Array, apres: Int8Array, size: number, c: Color): Atari[] {
  const deja = new Set<number>();
  for (const g of groupesEnAtari(avant, size, c)) for (const s of g.pierres) deja.add(s);
  return groupesEnAtari(apres, size, c).filter(g => g.pierres.some(s => !deja.has(s)));
}

/** Le coup `m` met-il en atari (une seule liberté) un groupe de l'autre couleur ? */
export function metEnAtari(r: Position, m: number): boolean {
  const c = r.board[m], size = r.size;
  return m >= 0 && neighbors(size)[m].some(q => r.board[q] === 3 - c && groupAt(r.board, size, q).liberties.size === 1);
}

// Aide de Mochi en partie (#35) : alerte d'atari contre les adversaires débutants.

/** Réglage « Aide de Mochi en partie » : `auto` = seulement contre les débutants (Pomme, Caillou). */
export type ReglageAide = 'auto' | 'oui' | 'non';
/** Adversaires contre lesquels l'aide est active par défaut. À partir de Bambou (13 kyu), elle est coupée. */
export const ADVERSAIRES_DEBUTANTS: readonly string[] = ['pomme', 'caillou'];

/** L'aide de Mochi est-elle active contre l'adversaire `id` ? */
export function aideActive(reglage: ReglageAide | undefined, id: string): boolean {
  if (reglage === 'oui') return true;
  if (reglage === 'non') return false;
  return ADVERSAIRES_DEBUTANTS.includes(id);
}

export const ALERTE_ATARI = "Atari ! Ton groupe n'a plus qu'une liberté. Sauve-le ou contre-attaque.";
export const EXPLICATION_ATARI = "Atari : il ne reste qu'une liberté, la pierre peut être prise au prochain coup.";

/** Message du coach quand un de tes groupes est mis en atari ; la première fois, le mot est expliqué. */
export function messageAtari(premiereFois: boolean): string {
  return premiereFois ? `${ALERTE_ATARI} ${EXPLICATION_ATARI}` : ALERTE_ATARI;
}
