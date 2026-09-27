import { describe, expect, it } from 'vitest';
import { cadrage, centreVertical } from './cadrage';
import { BASE_PUZZLES } from '../content/puzzles';

const vide: string[] = Array(9).fill('.........');
const avec = (pts: [number, number][]) => vide.map((r, y) => [...r].map((c, x) => (pts.some(([a, b]) => a === x && b === y) ? 'X' : c)).join(''));

describe('cadrage', () => {
  it('plateau vide : tout le plateau', () => {
    expect(cadrage(vide)).toEqual({ x: 0, y: 0, k: 9 });
  });
  it('fenêtre carrée autour des pierres, avec une ligne de marge', () => {
    const f = cadrage(avec([[3, 3], [5, 4]]));
    expect(f.k).toBe(5);
    expect(f.x).toBeLessThanOrEqual(2);
    expect(f.x + f.k - 1).toBeGreaterThanOrEqual(6);
  });
  it('ne sort jamais du plateau', () => {
    const f = cadrage(avec([[8, 8]]));
    expect(f.x + f.k).toBeLessThanOrEqual(9);
    expect(f.y + f.k).toBeLessThanOrEqual(9);
    expect(f.x).toBeGreaterThanOrEqual(0);
  });
  it('toutes les pierres des problèmes de base sont dans leur miniature', () => {
    for (const pz of BASE_PUZZLES) {
      const rows = (pz.setup as { rows: string[] }).rows, f = cadrage(rows);
      rows.forEach((r, y) => [...r].forEach((c, x) => {
        if (c === '.') return;
        expect(x).toBeGreaterThanOrEqual(f.x); expect(x).toBeLessThan(f.x + f.k);
        expect(y).toBeGreaterThanOrEqual(f.y); expect(y).toBeLessThan(f.y + f.k);
      }));
    }
  });
});

describe('centreVertical', () => {
  it('milieu des lignes occupées', () => {
    expect(centreVertical(avec([[1, 2], [4, 6]]))).toBe(4);
    expect(centreVertical(vide)).toBe(4);
  });
});
