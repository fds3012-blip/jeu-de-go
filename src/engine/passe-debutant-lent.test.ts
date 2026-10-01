// Recette du 30/09 : `passe-debutant.test.ts` échouait par moments (« écart 15,5 > 12 ») quand la machine était chargée.
// Cause : l'estimation des pierres mortes utilisée par Pomme après une passe s'arrêtait à 150 ms ; sur un appareil lent,
// moins de simulations, d'autres pierres jugées mortes, et Pomme fermait un autre « trou » (16 points de plus).
// Ici l'horloge du moteur est simulée (chaque lecture avance de `pas` ms) : le coup de Pomme ne doit pas dépendre de la vitesse.
import { describe, expect, it, vi } from 'vitest';

let t = 0, pas = 0.01;
vi.mock('./sim', async orig => ({ ...(await orig<typeof import('./sim')>()), now: () => (t += pas) }));

import { chooseMoveDetail, deadStones } from './index';
import { score } from '../go/score';
import { newPosition, play, type Position } from '../go/rules';
import { isEye, rng } from './sim';

const SANS_LIMITE = 1e12;

function avanceBlanc(pos: Position, seed: number): number {
  const s = score(pos, 0.5, 'japanese', new Set(deadStones(pos, { seed, playouts: 400, timeMs: SANS_LIMITE })));
  return s.white - s.black;
}

/** Même partie scriptée que passe-debutant.test.ts (40 coups, graine 2 : le cas qui échouait). */
function partie(plis: number, seed: number): { avant: number; apres: number; coups: number[] } {
  const r = rng(seed * 7919 + 1), coups: number[] = [];
  let pos = newPosition(9);
  for (let i = 0; i < plis; i++) {
    let m = -1;
    if (pos.toPlay === 1) {
      const vides = [...pos.board.keys()].filter(p => !pos.board[p] && !isEye(pos.board, 9, p, 1) && typeof play(pos, p) !== 'string');
      if (vides.length) m = vides[Math.floor(r() * vides.length)];
    } else m = chooseMoveDetail(pos, 'pomme', { seed: seed + i, komi: 0.5, timeMs: SANS_LIMITE, playouts: 250, accommodant: true }).move;
    const q = play(pos, m);
    pos = typeof q === 'string' ? (play(pos, -1) as Position) : q;
  }
  if (pos.toPlay !== 1) pos = play(pos, chooseMoveDetail(pos, 'pomme', { seed, komi: 0.5, timeMs: SANS_LIMITE, playouts: 250 }).move) as Position;
  const avant = avanceBlanc(pos, seed);
  for (let passes = 1; passes <= 20; passes++) {
    pos = play(pos, -1) as Position;
    const c = chooseMoveDetail(pos, 'pomme', { seed: seed + 99 + passes, komi: 0.5, timeMs: SANS_LIMITE, playouts: 250, accommodant: true, passesJoueur: passes });
    coups.push(c.move);
    if (c.move === -1) break;
    pos = play(pos, c.move) as Position;
  }
  return { avant, apres: avanceBlanc(pos, seed), coups };
}

describe('Pomme répond aux passes de la même façon sur un appareil lent', () => {
  it('40 coups, graine 2 : mêmes coups et même écart, horloge rapide ou lente', () => {
    pas = 0.01;
    const rapide = partie(40, 2);
    for (const p of [2, 3.5]) {
      pas = p;
      const lent = partie(40, 2);
      expect(lent.coups, `horloge ${p} ms par lecture`).toEqual(rapide.coups);
      expect(lent.apres - lent.avant, `horloge ${p} ms par lecture`).toBeLessThanOrEqual(12);
    }
  }, 120_000);
});
