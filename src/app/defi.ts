// « Un défi par jour » (issue #199) : le Go du jour, une leçon terminée ou la Révision du jour font vivre la série.
// Logique pure, sans React. Branchement sur l'appareil : defiAppareil.ts.
//
// HYPOTHÈSE À TESTER EN A/B (docs/data/tableaux-de-bord.md, section 3, « Série : un défi par jour ») :
// compter n'importe quel défi du jour, et non plus le seul Go du jour, fait monter J7 sans changer l'action proposée
// (chez Duolingo, n'importe quelle leçon entretient la série). Mettre `SERIE_UN_DEFI` à false rend l'ancienne règle.
//
// Limite connue : c'est la série de l'appareil. Côté serveur, la série d'un joueur connecté reste celle du Go du jour
// (colonnes de `profiles`, calculées par la base) ; aucune migration ici. L'écran affiche la plus longue des deux.
import type { Serie } from './goDuJour';

/** Vrai : un défi par jour (Go du jour, leçon ou révision). Faux : seul le Go du jour compte (règle d'avant #199). */
export const SERIE_UN_DEFI = true;

export type Defi = 'go_du_jour' | 'lecon' | 'revision';

/** Ce défi fait-il vivre la série ? Le Go du jour toujours ; la leçon et la révision seulement avec `SERIE_UN_DEFI`. */
export function compteDansSerie(defi: Defi, unDefi: boolean = SERIE_UN_DEFI): boolean {
  return defi === 'go_du_jour' || unDefi;
}

/**
 * Le Go du jour n° `numero` est-il réussi ? Avant #199, la série ne vivait que par lui : son `dernier` suffisait.
 * Depuis, une leçon peut avancer la série ; on garde donc à part le numéro du dernier Go du jour réussi (`fait`).
 * Sans ce repère (appareil d'avant #199), on relit l'ancienne règle.
 */
export function goDuJourFait(serie: Serie | null, fait: number | null, numero: number): boolean {
  return fait !== null ? fait === numero : serie?.dernier === numero;
}

/**
 * Repère du dernier Go du jour réussi, après un défi. Le Go du jour l'avance ; un autre défi le fige à sa valeur
 * d'avant (sur un appareil d'avant #199, c'est le `dernier` de la série, qui ne venait que du Go du jour).
 */
export function faitApres(fait: number | null, serie: Serie | null, defi: Defi, numero: number): number {
  if (defi === 'go_du_jour') return numero;
  return fait ?? serie?.dernier ?? 0;
}

/** Relit le repère gardé sur l'appareil. */
export function lireFait(brut: unknown): number | null {
  return Number.isInteger(brut) ? (brut as number) : null;
}
