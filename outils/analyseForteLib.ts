// #728 (C8) : parties pures de outils/analyseForte.ts (testées dans analyseForte.test.ts, sans réseau KataGo).
import { ALL_PUZZLES } from '../src/content/puzzles';
import { parsePuzzles, type Puzzle } from '../src/data/puzzles';
import type { Position } from '../src/go/rules';

export interface MesureProbleme {
  id: string; prompt: string; reponses: string[]; coup: string; ok: boolean; coupZone: string; okZone: boolean; part: number;
  propBonne: boolean | null; propFaute: boolean | null; fauteJouee: string | null; visites: number; ms: number;
}
export interface MesureConnu { id: string; coup: string; joue: string; perte: number; visites: number; ms: number }
export interface Resultat {
  modele: string; visites: number; moteur: string; problemes: MesureProbleme[]; connus: MesureConnu[];
}

/** Les problèmes « Noir/Blanc joue et vit/tue » : tous prouvés par les tests des lots (réponses = exactement les coups gagnants). */
export const estVieMort = (prompt: string): boolean => /^(Noir|Blanc) joue et (vit|tue)/.test(prompt);

export function problemesVieMort(): Puzzle[] {
  return parsePuzzles(ALL_PUZZLES.filter(p => estVieMort(p.prompt ?? ''))).sort((a, b) => a.id.localeCompare(b.id));
}

/** Moyenne de la propriété (+1 Noir, -1 Blanc) sur `pierres`, vue du camp `camp` (1 Noir, 2 Blanc) : > 0, le camp tient le groupe. */
export function propDuGroupe(own: ArrayLike<number>, pierres: number[], camp: 1 | 2): number {
  let s = 0;
  for (const p of pierres) s += own[p];
  return (camp === 1 ? 1 : -1) * (s / pierres.length);
}

/** Pierres de la chaîne du point `t` (toutes les pierres de sa couleur reliées par un côté). */
export function chaine(pos: Position, t: number): number[] {
  const n = pos.size, c = pos.board[t], vu = new Set([t]), pile = [t];
  while (pile.length) {
    const p = pile.pop()!, x = p % n, y = (p - x) / n;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const u = x + dx, v = y + dy, q = v * n + u;
      if (u < 0 || v < 0 || u >= n || v >= n || vu.has(q) || pos.board[q] !== c) continue;
      vu.add(q); pile.push(q);
    }
  }
  return [...vu];
}

export interface Synthese {
  n: number; okZone: number; ok: number; propBonne: [number, number]; propFaute: [number, number];
  partMoyenne: number; msParVisite: number;
}

/** Comptes d'un résultat : `[réussis, mesurés]` pour les propriétés (null = non mesuré). */
export function synthese(p: MesureProbleme[]): Synthese {
  const compte = (k: 'propBonne' | 'propFaute'): [number, number] => {
    const m = p.filter(x => x[k] !== null);
    return [m.filter(x => x[k]).length, m.length];
  };
  const visites = p.reduce((s, x) => s + x.visites, 0), ms = p.reduce((s, x) => s + x.ms, 0);
  return {
    n: p.length, okZone: p.filter(x => x.okZone).length, ok: p.filter(x => x.ok).length,
    propBonne: compte('propBonne'), propFaute: compte('propFaute'),
    partMoyenne: p.reduce((s, x) => s + x.part, 0) / Math.max(1, p.length), msParVisite: ms / Math.max(1, visites),
  };
}

/** Test des signes sur les paires (candidat réussit / référence échoue) : probabilité bilatérale exacte, sans hypothèse. */
export function testDesSignes(seulCandidat: number, seulReference: number): number {
  const n = seulCandidat + seulReference;
  if (n === 0) return 1;
  const k = Math.min(seulCandidat, seulReference);
  let c = 1, somme = 0; // c = C(n, i)
  for (let i = 0; i <= k; i++) { somme += c; c = (c * (n - i)) / (i + 1); }
  return Math.min(1, (2 * somme) / 2 ** n);
}

/** Écarts appariés entre deux résultats sur un même critère. */
export function ecarts(ref: MesureProbleme[], cand: MesureProbleme[], k: 'okZone' | 'propBonne' | 'propFaute') {
  const R = new Map(ref.map(x => [x.id, x]));
  let seulCandidat = 0, seulReference = 0, communs = 0;
  for (const c of cand) {
    const r = R.get(c.id);
    if (!r || r[k] === null || c[k] === null) continue;
    communs++;
    if (c[k] && !r[k]) seulCandidat++;
    if (!c[k] && r[k]) seulReference++;
  }
  return { communs, seulCandidat, seulReference, p: testDesSignes(seulCandidat, seulReference) };
}
