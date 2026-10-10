// Partie guidée de découverte (#524) : une vraie partie 9 × 9 contre Mochi, scénarisée, où chaque notion du go arrive
// au moment où elle se produit. Le joueur a Noir ; Mochi joue Blanc, doucement, pour montrer chaque idée.
//
// Le scénario est une suite de moments. Chaque moment attend une action du joueur (poser une pierre, toucher un point
// interdit, passer, ou lire une étape du comptage), puis Mochi répond. Les textes (français, anglais) sont dans
// decouverte.fr.ts et decouverte.en.ts, sous l'identifiant du moment.
//
// Règle d'or : aucune explication fausse. src/content/decouverte.test.ts rejoue toute la partie avec le moteur de
// src/go et vérifie chaque affirmation des textes (libertés, atari, captures, échelle, ko, yeux, pierre morte,
// frontières, score final en règle japonaise avec le komi de l'app).
import { fromLabel } from '../go/coords';
import { newPosition, play, type Position } from '../go/rules';

/** Les notions, dans l'ordre où la partie les fait vivre. */
export const NOTIONS = [
  'poser', 'libertes', 'atari', 'capture', 'sauver', 'couper', 'echelle', 'relier',
  'territoire', 'ko', 'yeux', 'frontiere', 'mort', 'passer', 'comptage',
] as const;
export type Notion = typeof NOTIONS[number];

/** Taille du plateau de la découverte. */
export const TAILLE = 9;

/** Étape du comptage final, dans l'ordre où Mochi la raconte. */
export type VueComptage = 'mortes' | 'territoire' | 'prisonniers' | 'blanc' | 'komi' | 'resultat';

interface Base {
  /** Identifiant stable : clé des textes et de la mesure. */
  id: string;
  notion: Notion;
  /** Pierres dont on montre les libertés (points verts), recalculées par le moteur. */
  libs?: string[];
  /** Pierres marquées (celles dont parle Mochi). */
  cibles?: string[];
}

export type Moment =
  /**
   * Poser une pierre. `attendu` : le coup du scénario (le repère). `reponse` : le coup de Mochi ensuite (`passe` pour
   * passer). `bravo` : un mot après le bon coup, avec « Continuer » ; sans lui, Mochi répond tout de suite.
   * `erreurs` : coups faux qui ont leur propre explication (texte `<id>.non.<coup>`) ; les autres ont `<id>.non`.
   */
  | (Base & { type: 'coup'; attendu: string; reponse: string; bravo?: boolean; erreurs?: string[] })
  /** Toucher un point interdit pour voir le refus du moteur (`ko` ou `suicide`). Plusieurs points possibles. */
  | (Base & { type: 'essai'; points: string[]; refus: 'ko' | 'suicide' })
  /** Mochi explique, « Continuer ». */
  | (Base & { type: 'info' })
  /** Passer (le bouton « Passer » est l'action principale). Fin de la partie : deux passes de suite. */
  | (Base & { type: 'passe' })
  /** Une étape du comptage, « Continuer ». */
  | (Base & { type: 'compte'; vue: VueComptage });

/** La pierre morte laissée par Mochi chez le joueur : retirée au comptage, comptée comme prisonnier de Noir. */
export const MORTES = ['E3'];

/** Le premier coup de Mochi, avant le premier moment : il n'y en a pas, Noir commence. */
export const SCENARIO: Moment[] = [
  // 1. Poser une pierre.
  { id: 'poser', notion: 'poser', type: 'coup', attendu: 'E5', reponse: 'D5', bravo: true },
  // 2. Libertés : la pierre de Mochi en a 3 ; le joueur en prend une.
  { id: 'libertes', notion: 'libertes', type: 'coup', attendu: 'D6', reponse: 'G4', libs: ['D5'], cibles: ['D5'], bravo: true, erreurs: ['C5', 'D4'] },
  // 3. Atari : une seule liberté.
  { id: 'atari', notion: 'atari', type: 'coup', attendu: 'D4', reponse: 'H7', libs: ['D5'], cibles: ['D5'], bravo: true, erreurs: ['C5'] },
  // 4. Capture : sur la dernière liberté. Premier prisonnier.
  { id: 'capture', notion: 'capture', type: 'coup', attendu: 'C5', reponse: 'F5', libs: ['D5'], cibles: ['D5'], bravo: true },
  // 5. Se sauver : Mochi met G5 en atari, le joueur s'allonge.
  { id: 'sauver', notion: 'sauver', type: 'coup', attendu: 'G5', reponse: 'H5', cibles: ['F5', 'G4'] },
  { id: 'sauver2', notion: 'sauver', type: 'coup', attendu: 'G6', reponse: 'G3', libs: ['G5'], cibles: ['G5'], bravo: true },
  // 6. Couper : F5 et G4 ne se relient plus qu'en F4.
  { id: 'couper', notion: 'couper', type: 'coup', attendu: 'F4', reponse: 'F6', cibles: ['F5', 'G4'], bravo: true, erreurs: ['F6'] },
  // 7. Échelle : atari du bon côté, puis la prise de 3 pierres.
  { id: 'echelle', notion: 'echelle', type: 'coup', attendu: 'F7', reponse: 'E6', libs: ['F5'], cibles: ['F5'], erreurs: ['E6'] },
  { id: 'echelle2', notion: 'echelle', type: 'coup', attendu: 'E7', reponse: 'G7', libs: ['F5'], cibles: ['F5'], bravo: true },
  // 8. Relier : G7 menace de couper en F6.
  { id: 'relier', notion: 'relier', type: 'coup', attendu: 'F6', reponse: 'H6', cibles: ['G6', 'F7'], bravo: true },
  // 9. Territoire : les murs de la frontière.
  { id: 'territoire', notion: 'territoire', type: 'coup', attendu: 'F8', reponse: 'G8' },
  { id: 'territoire2', notion: 'territoire', type: 'coup', attendu: 'F3', reponse: 'H2' },
  { id: 'territoire3', notion: 'territoire', type: 'coup', attendu: 'E2', reponse: 'G1' },
  { id: 'territoire4', notion: 'territoire', type: 'coup', attendu: 'F1', reponse: 'G9' },
  // 10. Ko : atari qui se met lui-même en atari, Mochi prend, reprise interdite, coup ailleurs, reprise permise.
  { id: 'ko', notion: 'ko', type: 'coup', attendu: 'G2', reponse: 'F2', libs: ['G1'], cibles: ['G1'] },
  { id: 'ko2', notion: 'ko', type: 'essai', points: ['G2'], refus: 'ko' },
  { id: 'ko3', notion: 'ko', type: 'coup', attendu: 'E1', reponse: 'H9', libs: ['F1'], cibles: ['F1'] },
  { id: 'ko4', notion: 'ko', type: 'coup', attendu: 'G2', reponse: 'H1', bravo: true },
  { id: 'ko5', notion: 'ko', type: 'coup', attendu: 'F2', reponse: 'J8' },
  // 11. Deux yeux : le joueur essaie de jouer dans un œil de Mochi.
  { id: 'yeux', notion: 'yeux', type: 'essai', points: ['H8', 'J9'], refus: 'suicide' },
  { id: 'yeux2', notion: 'yeux', type: 'info' },
  // 12. Frontière ouverte : F9 touche la pierre G9 de Mochi.
  { id: 'frontiere', notion: 'frontiere', type: 'coup', attendu: 'F9', reponse: 'E3', bravo: true },
  // 13. Groupe mort : la pierre E3 ne peut ni sortir ni faire deux yeux.
  { id: 'mort', notion: 'mort', type: 'coup', attendu: 'D3', reponse: 'passe', cibles: ['E3'], bravo: true },
  // 14. Passer : deux passes de suite, la partie s'arrête.
  { id: 'passer', notion: 'passer', type: 'passe' },
  // 15. Comptage (règle japonaise) : territoire + prisonniers ; komi pour Blanc.
  { id: 'compte', notion: 'comptage', type: 'compte', vue: 'mortes', cibles: MORTES },
  { id: 'compte2', notion: 'comptage', type: 'compte', vue: 'territoire' },
  { id: 'compte3', notion: 'comptage', type: 'compte', vue: 'prisonniers' },
  { id: 'compte4', notion: 'comptage', type: 'compte', vue: 'blanc' },
  { id: 'compte5', notion: 'comptage', type: 'compte', vue: 'komi' },
  { id: 'compte6', notion: 'comptage', type: 'compte', vue: 'resultat' },
];

/** Index (base 0) de la notion d'un moment dans NOTIONS. */
export const rangNotion = (m: Moment): number => NOTIONS.indexOf(m.notion);

/** Premier moment de chaque notion : la notion se compte comme commencée là (progression, mesure). */
export function estDebutDeNotion(i: number): boolean {
  return i === 0 || SCENARIO[i - 1]?.notion !== SCENARIO[i]?.notion;
}

const point = (s: string) => (s === 'passe' ? -1 : fromLabel(s, TAILLE));

/** Coups joués par un moment (le joueur, puis Mochi). Un essai, une info, un compte n'en jouent aucun. */
export function coupsDu(m: Moment): string[] {
  if (m.type === 'coup') return [m.attendu, m.reponse];
  if (m.type === 'passe') return ['passe'];
  return [];
}

/** Joue un coup du scénario ; une erreur ici veut dire un scénario faux (le test le vérifie). */
export function jouer(pos: Position, coup: string): Position {
  const r = play(pos, point(coup));
  if (typeof r === 'string') throw new Error(`Découverte : ${coup} refusé (${r})`);
  return r;
}

/**
 * Position au début du moment `i`, et le dernier coup joué (pour son anneau). Rejoue tout le scénario depuis le plateau
 * vide : la reprise après un rechargement n'a besoin que de l'index.
 */
export function positionAvant(i: number): { pos: Position; dernier: number | null } {
  let pos = newPosition(TAILLE), dernier: number | null = null;
  for (const m of SCENARIO.slice(0, Math.max(0, Math.min(i, SCENARIO.length)))) {
    for (const c of coupsDu(m)) { pos = jouer(pos, c); dernier = point(c); }
  }
  return { pos, dernier };
}

/** Index des points d'une liste d'étiquettes. */
export const points = (l: readonly string[] | undefined): number[] => (l ?? []).map(point);
