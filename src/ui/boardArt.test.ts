import { describe, expect, it } from 'vitest';
import { C, M, R, R_NOIR, VARIANTES_COQUILLAGE, boardWidth, diffBoards, hoshi, jitter, jitterMax, coordBand, coordCenter, viewBoxOf, shellStriae, shellVariant, woodDataUrl } from './boardArt';

describe('géométrie', () => {
  it('garde la grille attendue par e2e/plateau.ts', () => {
    expect([C, M]).toEqual([40, 34]);
    expect(boardWidth(9)).toBe(388);
    expect(boardWidth(19)).toBe(788);
  });
  it('pierre noire plus large de 0,7 %', () => {
    expect(R_NOIR / R).toBeCloseTo(1.007, 6);
    expect(2 * R_NOIR).toBeLessThan(C); // deux pierres voisines ne se chevauchent pas
  });
  it('hoshi : 5 en 9 × 9 et 13 × 13, 9 en 19 × 19', () => {
    expect(hoshi(9)).toHaveLength(5);
    expect(hoshi(13)).toHaveLength(5);
    expect(hoshi(19)).toHaveLength(9);
    expect(hoshi(9)).toContain(40);
  });
});

describe('variante de coquillage', () => {
  it('est déterministe et dans [0, 9]', () => {
    for (const size of [9, 13, 19]) for (let p = 0; p < size * size; p++) {
      const v = shellVariant(p, size);
      expect(v).toBe(shellVariant(p, size));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(VARIANTES_COQUILLAGE);
    }
  });
  it('utilise les 10 variantes et varie entre voisines', () => {
    const vs = Array.from({ length: 361 }, (_, p) => shellVariant(p, 19));
    expect(new Set(vs).size).toBe(10);
    const pareilles = vs.filter((v, p) => p % 19 < 18 && v === vs[p + 1]).length;
    expect(pareilles / 342).toBeLessThan(0.2);
  });
  it('chaque variante a ses propres stries, identiques d’un appel à l’autre', () => {
    const a = shellStriae(3), b = shellStriae(3), c = shellStriae(4);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.length).toBeGreaterThan(12);
    for (const s of a) { expect(s.o).toBeGreaterThan(0); expect(s.o).toBeLessThan(0.25); }
  });
});

describe('micro-décalage', () => {
  it('est déterministe et reste sous 1 px à l’écran', () => {
    for (const size of [9, 13, 19]) {
      // plateau affiché sur au moins 358 px de large (iPhone 390, gouttières de 16 px)
      const pxParUnite = 358 / viewBoxOf(size).span;
      let max = 0;
      for (let p = 0; p < size * size; p++) {
        const [dx, dy] = jitter(p, size);
        expect(jitter(p, size)).toEqual([dx, dy]);
        max = Math.max(max, Math.hypot(dx, dy));
      }
      expect(max).toBeLessThanOrEqual(jitterMax(size) + 1e-9);
      expect(max * pxParUnite).toBeLessThanOrEqual(1);
      expect(max).toBeGreaterThan(jitterMax(size) * 0.8); // le décalage est bien visible
    }
  });
});

describe('coordonnées', () => {
  it('ne passent pas sous les pierres du bord et restent sur le bois', () => {
    for (const size of [9, 13, 19]) {
      const c = coordCenter(size), fs = (9.2 * viewBoxOf(size).span) / 358;
      expect(c + fs / 2).toBeLessThanOrEqual(M - R_NOIR); // bas du texte au-dessus des pierres de la première ligne
      expect(c - fs / 2).toBeGreaterThanOrEqual(-coordBand(size)); // haut du texte dans le bois
    }
  });
});

describe('bois', () => {
  it('est une image data: SVG construite une seule fois', () => {
    const u = woodDataUrl();
    expect(u.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(u)).toContain('feTurbulence');
    expect(woodDataUrl()).toBe(u);
  });
});

describe('diffBoards', () => {
  const b = (cells: Record<number, number>, n = 9) => { const a = new Int8Array(n * n); for (const k in cells) a[+k] = cells[k]; return a; };
  it('repère la pierre posée et les pierres prises', () => {
    expect(diffBoards(b({ 1: 1 }), b({ 9: 1 }))).toBeNull(); // la pierre « prise » est de la même couleur : pas un coup
    expect(diffBoards(b({ 0: 2, 1: 1 }), b({ 1: 1, 9: 1 }))).toEqual({ placed: 9, captured: [0] });
    expect(diffBoards(b({}), b({ 40: 1 }))).toEqual({ placed: 40, captured: [] });
  });
  it('ignore les changements qui ne sont pas un coup (annulation, nouvelle position)', () => {
    expect(diffBoards(b({ 40: 1 }), b({}))).toBeNull();
    expect(diffBoards(b({}), b({ 1: 1, 2: 2 }))).toBeNull();
    expect(diffBoards(b({}), b({}, 13))).toBeNull();
  });
});
