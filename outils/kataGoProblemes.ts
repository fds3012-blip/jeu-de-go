// #733 : contrôle KataGo des problèmes d'un lot (réseau g170 b6c96, komi 6,5, règle japonaise), figé dans
// src/go/preuves-katago-problemes.json, rejoué sans le réseau par src/go/preuves-katago-problemes.test.ts (CI).
// Ce module est pur (aucune dépendance à TensorFlow) : la fixture, sa clé et son jugement. Le calcul est dans
// outils/preuvesKataGoProblemes.ts.
import { createHash } from 'node:crypto';
import type { Puzzle } from '../src/data/puzzles';
import { toLabel } from '../src/go/coords';

export const REGLAGES_PROBLEMES = {
  modele: 'g170-b6c96-s175395328-d26788732',
  komi: 6.5,
  regles: 'japanese',
  /** Visites de la recherche à la racine, par symétrie. */
  visites: 64,
  /** Les 8 symétries du plateau (bit 1 transposer, bit 2 miroir gauche-droite, bit 4 miroir haut-bas). */
  symetries: [0, 1, 2, 3, 4, 5, 6, 7],
} as const;

/** Analyse figée d'un problème (position de départ, Noir au trait, ramenée dans le repère d'origine). */
export interface AnalyseProbleme {
  /** Empreinte de la position, du trait et des réponses : une fixture périmée est refusée. */
  cle: string;
  /** Les 6 premiers coups de la politique brute du réseau, moyennée sur les symétries : [point, probabilité]. */
  politique: [string, number][];
  /** Meilleur coup de la recherche (le plus visité), par symétrie. */
  recherche: { sym: number; meilleur: string; visites: number; sur: number }[];
  /** Propriété moyenne estimée par le réseau, ligne par ligne : N (Noir, au-dessus de 0,5), B (Blanc, sous -0,5), . sinon. */
  propriete: string[];
}
export interface PreuvesProblemes { reglages: typeof REGLAGES_PROBLEMES; problemes: Record<string, AnalyseProbleme> }

/** Empreinte de ce que la fixture suppose du problème. */
export function cleProbleme(p: Pick<Puzzle, 'rows' | 'toPlay' | 'answers' | 'size'>): string {
  return createHash('sha256').update(JSON.stringify([p.rows, p.toPlay, p.answers.map(a => toLabel(a, p.size))])).digest('hex').slice(0, 16);
}

/** Ce que KataGo pense de la réponse : rang dans la politique, probabilité, et symétries où la recherche la préfère. */
export function jugementKataGo(p: Pick<Puzzle, 'size' | 'answers'>, a: AnalyseProbleme) {
  const acceptees = new Set(p.answers.map(x => toLabel(x, p.size)));
  const rang = a.politique.findIndex(([l]) => acceptees.has(l));
  return {
    rang: rang < 0 ? Infinity : rang + 1,
    prior: rang < 0 ? 0 : a.politique[rang][1],
    symetriesOk: a.recherche.filter(r => acceptees.has(r.meilleur)).length,
    symetries: a.recherche.length,
  };
}
