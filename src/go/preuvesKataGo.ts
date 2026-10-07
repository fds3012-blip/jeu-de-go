// Preuves KataGo des leçons d'ouverture (13 × 13) et de joseki (19 × 19) (#16).
//
// Le moteur de règles de src/go ne sait pas juger une ouverture : KataGo le fait. Les analyses sont calculées une fois
// (`npm run preuves-katago`, réseau g170 local, voir outils/preuvesKataGo.ts), figées dans
// src/go/preuves-katago.json, puis rejouées par src/go/lecons-ouverture.test.ts : la CI n'a pas besoin du modèle.
//
// Ce module dit QUOI juger (les positions tirées des leçons elles-mêmes) et COMMENT (les seuils). Il ne dépend pas de
// TensorFlow.
//
// « Graines » : la recherche (src/engine/katago/search.ts) est déterministe. Comme KataGo, on fait varier l'entrée du
// réseau par les symétries du plateau (rotation, miroir) : chaque symétrie est une analyse indépendante, et un coup
// n'est retenu que si toutes le jugent de la même façon.
import { fromRows } from './position';
import { play, type Position } from './rules';
import { fromLabel, toLabel } from './coords';
import type { Lesson, LessonStep } from '../content/lessons';

export const REGLAGES = {
  modele: 'g170-b6c96-s175395328-d26788732',
  komi: 6.5,
  regles: 'japanese',
  /** Visites de la recherche à la racine (meilleurs coups du plateau entier), par symétrie. */
  visitesRacine: 800,
  /** Visites de la recherche après chaque coup jugé, par symétrie. */
  visitesCoup: 400,
  /** Symétries : bit 1 transposer, bit 2 miroir gauche-droite, bit 4 miroir haut-bas. 0 identité, 6 demi-tour, 3 et 5 quarts de tour. */
  symetries: [0, 3, 5, 6],
} as const;

/** Une réponse acceptée perd au plus TOLERANCE point (moyenne des symétries) face au meilleur coup du plateau entier. */
export const TOLERANCE = 1;
/** Un coup refusé perd au moins MARGE points de plus que la moins bonne réponse acceptée (moyenne), et MARGE / 2 dans chaque symétrie. */
export const MARGE = 2;
/** Un coup joué par une démonstration (Noir ou Blanc) perd au plus TOLERANCE_DEMO point face au meilleur coup. */
export const TOLERANCE_DEMO = 1.5;

/** Ce qu'on juge dans une étape. `duel` : une question à choix « lequel est le meilleur ? » entre deux coups. */
export type Controle =
  /** `pires` : coups que la leçon déconseille sans les refuser (« le centre en dernier ») : moins bons que chaque réponse. */
  | { lecon: string; etape: number; type: 'exercice'; pires?: string[] }
  | { lecon: string; etape: number; type: 'demo' }
  | { lecon: string; etape: number; type: 'duel'; meilleur: string; pire: string };

/** Les étapes jugées par KataGo. Les autres étapes de ces leçons ne portent pas de jugement (repères, vocabulaire). */
export const CONTROLES: Controle[] = [
  // l29 : l'ouverture en 13 × 13.
  { lecon: 'l29', etape: 0, type: 'demo' },
  { lecon: 'l29', etape: 1, type: 'exercice' },
  { lecon: 'l29', etape: 2, type: 'duel', meilleur: 'K4', pire: 'E4' },
  { lecon: 'l29', etape: 3, type: 'demo' },
  { lecon: 'l29', etape: 4, type: 'exercice', pires: ['G7'] },
  // l30 : le san-san.
  { lecon: 'l30', etape: 0, type: 'demo' },
  { lecon: 'l30', etape: 1, type: 'exercice' },
  { lecon: 'l30', etape: 2, type: 'demo' },
  { lecon: 'l30', etape: 3, type: 'exercice' },
  // l31 : le 3-4 et l'approche.
  { lecon: 'l31', etape: 0, type: 'demo' },
  { lecon: 'l31', etape: 1, type: 'demo' },
  { lecon: 'l31', etape: 2, type: 'exercice' },
  { lecon: 'l31', etape: 3, type: 'exercice' },
];

/** Une position à analyser : `rows` (X noir, O blanc), le joueur au trait, et les coups à juger. */
export interface APosition { cle: string; rows: string[]; trait: 1 | 2; coups: string[] }

const versRows = (pos: Position): string[] => {
  const n = pos.size;
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => '.XO'[pos.board[y * n + x]]).join(''));
};
export const cleDe = (rows: string[], trait: 1 | 2) => `${trait === 1 ? 'B' : 'W'}:${rows.join('/')}`;
const aPos = (rows: string[], trait: 1 | 2, coups: string[]): APosition => ({ cle: cleDe(rows, trait), rows, trait, coups });

/** Points nommés d'une étape « move » : réponses acceptées puis coups refusés. */
export function pointsExercice(s: Extract<LessonStep, { kind: 'move' }>): { accept: string[]; refus: string[] } {
  if (!Array.isArray(s.accept)) throw new Error('exercice KataGo : réponses explicites attendues');
  return { accept: [...s.accept], refus: (s.refus ?? []).flatMap(r => r.points) };
}

/** Positions à analyser pour un contrôle (sans les marques T et S). */
export function positionsDe(l: Lesson, c: Controle): APosition[] {
  const s = l.steps[c.etape], n = s.rows.length;
  const propre = (rows: string[]) => rows.map(r => r.replace(/T/g, 'O').replace(/S/g, 'X'));
  if (c.type === 'exercice') {
    if (s.kind !== 'move') throw new Error(`${l.id}.${c.etape + 1} : pas un exercice`);
    const { accept, refus } = pointsExercice(s);
    return [aPos(propre(s.rows), 1, [...accept, ...refus, ...(c.pires ?? [])])];
  }
  if (c.type === 'duel') return [aPos(propre(s.rows), 1, [c.meilleur, c.pire])];
  if (s.kind !== 'info' || !s.demo) throw new Error(`${l.id}.${c.etape + 1} : pas une démonstration`);
  // Chaque pierre de la démonstration est jugée depuis la position juste avant elle, avec sa couleur au trait.
  let pos = fromRows(propre(s.rows)).pos;
  const out: APosition[] = [];
  for (const t of [...(s.avant ?? []), ...s.demo]) {
    if (!('pose' in t)) continue;
    const trait = t.couleur === 'B' ? 1 : 2;
    const avantCoup = { ...pos, toPlay: trait } as Position;
    if ((s.avant ?? []).indexOf(t) < 0) out.push(aPos(versRows(avantCoup), trait, [t.pose]));
    const r = play(avantCoup, fromLabel(t.pose, n));
    if (typeof r === 'string') throw new Error(`${t.pose} : ${r}`);
    pos = r;
  }
  return out;
}

// ---- Symétries -------------------------------------------------------------------------------------------------

/** Image d'un index (y * n + x) par la symétrie k. */
export function transformer(p: number, n: number, k: number): number {
  let x = p % n, y = (p - x) / n;
  if (k & 1) [x, y] = [y, x];
  if (k & 2) x = n - 1 - x;
  if (k & 4) y = n - 1 - y;
  return y * n + x;
}
/** Antécédent d'un index par la symétrie k. */
export function inverser(p: number, n: number, k: number): number {
  let x = p % n, y = (p - x) / n;
  if (k & 4) y = n - 1 - y;
  if (k & 2) x = n - 1 - x;
  if (k & 1) [x, y] = [y, x];
  return y * n + x;
}
export function rowsSym(rows: string[], k: number): string[] {
  const n = rows.length, g = Array.from({ length: n }, () => Array<string>(n).fill('.'));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const q = transformer(y * n + x, n, k);
    g[Math.floor(q / n)][q % n] = rows[y][x];
  }
  return g.map(r => r.join(''));
}
export const etiquette = (p: number, n: number) => (p < 0 ? 'passe' : toLabel(p, n));

// ---- Fixture et jugement ----------------------------------------------------------------------------------------

/** Analyse figée d'une position. Avances en points pour le joueur au trait, une valeur par symétrie (ordre de REGLAGES). */
export interface Analyse {
  rows: string[];
  trait: 1 | 2;
  /** Meilleurs coups de la recherche à la racine, par symétrie, ramenés dans le repère d'origine. */
  racines: { sym: number; visites: number; coups: { l: string; visites: number; avance: number }[] }[];
  /** Avance du joueur au trait après chaque coup jugé (recherche depuis la position obtenue), par symétrie. */
  coups: Record<string, number[]>;
  /** Meilleure réponse de l'adversaire après chaque coup jugé, par symétrie (citée par les réfutations). */
  repliques: Record<string, string[]>;
}
export interface Preuves { reglages: typeof REGLAGES; positions: Record<string, Analyse> }

const moyenne = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

/** Valeur moyenne de chaque coup jugé, le meilleur coup jugé, et la perte de chaque coup face à lui. */
export function bilan(a: Analyse) {
  const moy = Object.fromEntries(Object.entries(a.coups).map(([l, v]) => [l, moyenne(v)]));
  const [meilleur, vMax] = Object.entries(moy).sort((x, y) => y[1] - x[1])[0];
  const perte = (l: string) => vMax - moy[l];
  return { moy, meilleur, vMax, perte };
}

/** Coups à juger en plus de ceux de la leçon : les 3 premiers de la racine dans chaque symétrie (le meilleur du plateau). */
export function temoins(a: Pick<Analyse, 'racines'>): string[] {
  return [...new Set(a.racines.flatMap(r => r.coups.slice(0, 3).map(c => c.l)))].filter(l => l !== 'passe');
}
