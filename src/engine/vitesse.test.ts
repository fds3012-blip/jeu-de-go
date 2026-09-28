// Vitesse du moteur simple et de l'estimation des pierres mortes, avec l'horloge réelle (recette du 28/09, #195).
// Les seuils sont ceux d'avant (1 s par coup, 300 ms en 9 × 9 et 1 s en 13 × 13 pour les pierres mortes), mais on mesure
// le temps de calcul du processus (process.cpuUsage) et non le temps écoulé : quand la machine est chargée (CI, autres
// fichiers de tests en parallèle), le temps écoulé compte aussi l'attente du processeur, qui n'est pas du travail du
// moteur. Une boucle trop lente échoue toujours ; une machine occupée, non.
import { newPosition, play, type Position } from '../go/rules';
import { fromRows } from '../go/position';
import { deadStones } from './dead';
import { bestMove } from './index';
import { CAS } from './dead.fixtures';

/** Millisecondes de calcul (utilisateur + système) prises par `f`. */
async function tempsCalcul(f: () => unknown): Promise<number> {
  const avant = process.cpuUsage();
  await f();
  const { user, system } = process.cpuUsage(avant);
  return (user + system) / 1000;
}

describe('vitesse du moteur', () => {
  it('Pomme et Caillou répondent en moins d’une seconde de calcul par coup en 9 × 9', async () => {
    let pos: Position = newPosition(9);
    for (let i = 0; i < 12; i++) {
      let m = -1;
      const ms = await tempsCalcul(async () => { m = await bestMove(pos, i % 2 ? 'pomme' : 'caillou', { seed: i + 1 }); });
      expect(ms, `coup ${i + 1}`).toBeLessThan(1000);
      pos = play(pos, m) as Position;
    }
  }, 60000);

  it('pierres mortes : moins de 300 ms de calcul en 9 × 9, moins d’1 s en 13 × 13', async () => {
    for (const { nom, rows } of CAS) {
      const { pos } = fromRows(rows, 1);
      const ms = await tempsCalcul(() => deadStones(pos));
      expect(ms, nom).toBeLessThan(rows.length === 9 ? 300 : 1000);
    }
  });
});
