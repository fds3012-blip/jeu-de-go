// Recette du 28/09 (#195) : preuve « les coups gagnants sont exactement les réponses acceptées », déclarée coup par coup.
// Un seul test par problème bloquait le processus de test jusqu'à 112 s sur une machine chargée ; au-delà de 60 s,
// Vitest perd le contact avec le fichier (« Timeout calling onTaskUpdate ») et la suite échoue alors que la preuve est
// bonne. La preuve reste la même : chaque coup légal de Noir gagne si et seulement s'il est accepté, et chaque réponse
// acceptée est un coup légal. `coups` : les coups de Noir à essayer (par défaut tous ses coups légaux, sans la passe ;
// le lot B y ajoute la passe). Utilisé seulement par les tests (src/go/lot-*.test.ts).
import { describe, expect, it } from 'vitest';
import { toLabel } from './coords';
import { legalMoves } from './lecteurs-lot-d';
import type { Position } from './rules';

export function preuveParCoup(id: string, pos: Position, answers: readonly number[], gagne: (m: number) => boolean,
  { coups = legalMoves(pos).filter(m => m !== -1), timeout = 120_000 }: { coups?: readonly number[]; timeout?: number } = {}): void {
  const acceptes = new Set(answers);
  describe(`${id} : les coups gagnants sont exactement les réponses acceptées`, () => {
    it('chaque réponse acceptée est un coup légal', () => {
      for (const a of answers) expect(coups, `${id} ${toLabel(a, pos.size)}`).toContain(a);
    });
    for (const m of coups) {
      const attendu = acceptes.has(m);
      it(`${toLabel(m, pos.size)} ${attendu ? 'gagne' : 'ne gagne pas'}`, () => {
        expect(gagne(m)).toBe(attendu);
      }, timeout);
    }
  });
}

/**
 * Rend la main à la boucle d'événements (à passer à `beforeEach`, ou à attendre entre deux morceaux d'un long calcul).
 * Vitest enchaîne les tests synchrones sans lire les réponses du processus principal ; un message resté plus de 60 s
 * sans réponse lue échoue (« Timeout calling onTaskUpdate »). Ce qui compte est le plus long bloc sans rendre la main :
 * au-delà de 30 s, outils/boucleLibre.setup.ts fait échouer le test (#586).
 */
export const cederLaMain = (): Promise<void> => new Promise(r => setImmediate(r));
