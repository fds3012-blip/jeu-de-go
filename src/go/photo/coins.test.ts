// Coins proposés (#655) : un point de départ, que le joueur ajuste. Mesuré sur des photos synthétiques.
import { describe, expect, it } from 'vitest';
import { coinsParDefaut, proposerCoins } from './coins';
import { quadrilatereValide } from './homographie';
import { hasard, synthetiser } from './synthese';

describe('coins proposés', () => {
  it('par défaut : un rectangle valide dans la photo', () => {
    const c = coinsParDefaut(800, 600);
    expect(quadrilatereValide(c)).toBe(true);
    for (const p of c) { expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(800); expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(600); }
  });

  it('sur le bois du goban : à moins d’une case de la grille dans 4 photos sur 5', () => {
    let proches = 0, n = 0;
    for (const taille of [9, 13, 19] as const) for (let g = 1; g <= 4; g++) {
      const r = hasard(taille * 1000 + g);
      const s = synthetiser({ graine: taille * 977 + g, taille, largeur: 480, hauteur: 360, inclinaison: r(), eclairage: r(), debord: 0.25 * r(), teinte: 2 * r() - 1 });
      const c = proposerCoins(s.image, taille);
      n++;
      if (!c) continue;
      const cote = Math.hypot(s.coins[1].x - s.coins[0].x, s.coins[1].y - s.coins[0].y) / (taille - 1);
      if (Math.max(...c.map((p, i) => Math.hypot(p.x - s.coins[i].x, p.y - s.coins[i].y))) < cote) proches++;
    }
    expect(proches / n).toBeGreaterThanOrEqual(0.8);
  }, 60_000);

  it('sans bois au centre (photo d’autre chose) : rien de proposé', () => {
    const data = new Uint8ClampedArray(200 * 150 * 4).fill(90);
    expect(proposerCoins({ width: 200, height: 150, data }, 19)).toBeNull();
  });
});
