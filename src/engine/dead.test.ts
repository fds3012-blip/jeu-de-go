import { fromRows } from '../go/position';
import { play, type Position } from '../go/rules';
import { score } from '../go/score';
import { deadStones } from './dead';
import { chooseMove } from './simple';
import { CAS } from './dead.fixtures';

// Recette du 28/09 (#195) : budget de temps levé, seul le plafond de simulations (600 en 9 × 9, 400 en 13 × 13) arrête
// l'estimation. Une graine donne donc toujours les mêmes pierres mortes, quelle que soit la charge de la machine.
// La vitesse réelle (moins de 300 ms en 9 × 9, moins d'1 s en 13 × 13) est vérifiée dans vitesse.test.ts.
const trouve = (pos: Position, seed = 7) => deadStones(pos, { seed, timeMs: Number.POSITIVE_INFINITY });

describe('pierres mortes (deadStones)', () => {
  it('au moins 7 positions en 9 × 9 et 3 en 13 × 13', () => {
    expect(CAS.filter(c => c.rows.length === 9).length).toBeGreaterThanOrEqual(7);
    expect(CAS.filter(c => c.rows.length === 13).length).toBeGreaterThanOrEqual(3);
  });

  for (const { nom, rows } of CAS) {
    it(nom, () => {
      const { pos, marked } = fromRows(rows, 1);
      for (const seed of [1, 7]) expect(trouve(pos, seed)).toEqual([...marked].sort((a, b) => a - b));
      // Même réponse quel que soit le joueur au trait.
      expect(trouve({ ...pos, toPlay: 2 })).toEqual([...marked].sort((a, b) => a - b));
    }, 20000);
  }

  it('plateau vide : rien de mort', () => {
    expect(deadStones(fromRows(Array(9).fill('.........')).pos)).toEqual([]);
  });

  it('le moteur passe après une passe quand il gagne une fois les pierres mortes retirées', () => {
    // Compte brut : la pierre noire morte en H4 annule le territoire blanc et Noir mène (37 à 15,5).
    // Pierre morte retirée, Blanc gagne (51,5 à 36) : il doit passer.
    const { pos } = fromRows(['...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO..X.', '...XO....', '...XO....', '...XO....'], 1);
    const r = play(pos, -1) as Position; // Noir passe, Blanc au trait
    expect(score(r, 6.5, 'chinese').winner).toBe(1);
    expect(score(r, 6.5, 'chinese', new Set(deadStones(r))).winner).toBe(2);
    expect(chooseMove(r, 'caillou', { seed: 3, timeMs: Number.POSITIVE_INFINITY, playouts: 2000 })).toBe(-1);
  });
});
