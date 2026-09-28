// Redites (issue #237, constat N3) : le même exercice ne doit pas revenir quatre fois en 24 heures
// (étape de leçon, pratique de fin de leçon, Go du jour, Révision du jour). Logique pure, sans React.
//
// Deux exercices sont « le même » quand leurs positions sont identiques à symétrie près : les 8 rotations et
// miroirs du goban, et l'échange des couleurs (le même exercice joué par Blanc). Les marques de pierre (T, S)
// comptent comme des pierres ordinaires. Le trait n'est pas comparé : sur ces positions, c'est toujours à celui
// qui a le coup juste de jouer. Exemples : l'étape 4 de la leçon 1 et le problème b1 « Capture la pierre ».
import type { Lesson } from './lessons';

/** Position d'un exercice : lignes du goban (X noir, O blanc, S et T marquées, . vide), du haut vers le bas. */
export type Lignes = readonly string[];

const PIERRE: Record<string, string> = { X: 'X', S: 'X', O: 'O', T: 'O' };

function grille(rows: Lignes): string[][] {
  return rows.map(r => [...r].map(c => PIERRE[c] ?? '.'));
}

/** Les 8 symétries du carré appliquées à une grille N × N. */
function symetries(g: string[][]): string[][][] {
  const n = g.length;
  const out: string[][][] = [];
  const tourner = (m: string[][]) => m.map((_, y) => m.map((__, x) => m[n - 1 - x][y]));
  const miroir = (m: string[][]) => m.map(r => [...r].reverse());
  let m = g;
  for (let i = 0; i < 4; i++) {
    out.push(m, miroir(m));
    m = tourner(m);
  }
  return out;
}

const inverser = (g: string[][]) => g.map(r => r.map(c => (c === 'X' ? 'O' : c === 'O' ? 'X' : c)));
const texte = (g: string[][]) => g.map(r => r.join('')).join('/');

/** Forme canonique d'une position : la plus petite de ses 16 variantes (8 symétries, 2 couleurs). */
export function formeCanonique(rows: Lignes): string {
  const g = grille(rows);
  let min: string | null = null;
  for (const v of [...symetries(g), ...symetries(inverser(g))]) {
    const s = `${g.length}:${texte(v)}`;
    if (min === null || s < min) min = s;
  }
  return min ?? '';
}

/** Vrai si les deux positions sont la même à symétrie (et échange des couleurs) près. */
export function memePosition(a: Lignes, b: Lignes): boolean {
  return a.length === b.length && formeCanonique(a) === formeCanonique(b);
}

/** Positions des exercices d'une leçon (étapes où l'élève joue ou touche un point). */
export function positionsDeLecon(lecon: Pick<Lesson, 'steps'>): Lignes[] {
  return lecon.steps.filter(s => s.kind === 'move' || s.kind === 'touche').map(s => s.rows);
}

/**
 * Liste d'exclusion : problèmes qui ne sont pas la même position qu'une étape de leçon, mais le même exercice
 * (même forme, une pierre de décor en plus ou en moins, ou déplacée sur le goban). La symétrie ne les voit pas.
 * Relevés à la main en comparant les étapes de leçon (`positionsDeLecon`) aux séries de pratique :
 * - l1 : a01 « Première capture » (une pierre seule, trois pierres noires autour : l'étape 4 sans la pierre blanche F5) ;
 *        n01 « Deux pierres d'un coup » (deux pierres blanches alignées, une seule liberté : l'étape 6 tournée d'un quart).
 * Les étapes identiques à symétrie près (b1 à b6 pour les leçons 1 à 3) sont vues sans liste.
 */
export const PROCHES_DE_LECON: Readonly<Record<string, readonly string[]>> = {
  l1: ['a01', 'n01'],
};

/** Vrai si le problème répète un exercice de la leçon : même position à symétrie près, ou dans la liste d'exclusion. */
export function estRedite(p: { id: string; rows?: Lignes }, lecon: Pick<Lesson, 'id' | 'steps'>): boolean {
  if (PROCHES_DE_LECON[lecon.id]?.includes(p.id)) return true;
  return !!p.rows && reprend(p.rows, positionsDeLecon(lecon));
}

/** Vrai si la position `rows` reprend l'une des positions données (par exemple celles d'une leçon). */
export function reprend(rows: Lignes, positions: readonly Lignes[]): boolean {
  if (!positions.length) return false;
  const c = formeCanonique(rows);
  return positions.some(p => p.length === rows.length && formeCanonique(p) === c);
}
