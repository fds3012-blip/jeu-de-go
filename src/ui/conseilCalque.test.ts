import { describe, expect, it } from 'vitest';
import { reperes } from './conseilCalque';

// 9 × 9, index y * 9 + x. E5 = 40, E4 = 49, D5 = 39, F5 = 41.
const plateau = (pierres: Record<number, number>) => { const b = new Array(81).fill(0); for (const [p, c] of Object.entries(pierres)) b[+p] = c; return b; };

describe('calque du conseil : repères (#509, point 3)', () => {
  it('pierre en atari et point à jouer : un halo sur la pierre, la cible sur le point vide, aucune pastille', () => {
    const r = reperes([40, 49], 49, plateau({ 40: 2, 39: 1, 41: 1, 31: 1 }));
    expect(r).toEqual({ cible: 49, halos: [40], points: [] });
  });
  it('sans point nommé : une pastille sur chaque point vide de la zone, aucune cible', () => {
    const r = reperes([20, 21, 29, 30], null, plateau({}));
    expect(r.cible).toBeNull();
    expect(r.points).toEqual([20, 21, 29, 30]);
  });
  it('point nommé sur une pierre (« ton groupe en E5 ») : pas de cible, la pierre a son halo, la liberté sa pastille', () => {
    const r = reperes([40, 49], 40, plateau({ 40: 1 }));
    expect(r).toEqual({ cible: null, halos: [40], points: [49] });
  });
  it('la pierre nommée hors zone garde son halo ; doublons et points hors plateau ignorés', () => {
    const r = reperes([49, 49, -1, 81], 40, plateau({ 40: 2 }));
    expect(r).toEqual({ cible: null, halos: [40], points: [49] });
  });
});
