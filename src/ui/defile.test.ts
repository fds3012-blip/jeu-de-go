import { describe, expect, it } from 'vitest';
import { ecart, ralenti, valeurDefilee } from './defile';

describe('chiffres qui défilent', () => {
  it('part de la valeur de départ et arrive exactement sur la valeur finale', () => {
    expect(valeurDefilee(800, 812, 0)).toBe(800);
    expect(valeurDefilee(800, 812, 1)).toBe(812);
    expect(valeurDefilee(800, 812, 5)).toBe(812);
    expect(valeurDefilee(812, 800, 1)).toBe(800);
  });
  it('ralenti de fin : monotone, plus avancé que le linéaire à mi-course', () => {
    expect(ralenti(0.5)).toBeGreaterThan(0.5);
    let prev = -1;
    for (let t = 0; t <= 1; t += 0.1) { expect(ralenti(t)).toBeGreaterThanOrEqual(prev); prev = ralenti(t); }
    expect(ralenti(-1)).toBe(0);
  });
  it('écart signé avec un vrai signe moins', () => {
    expect(ecart(800, 812)).toBe('+12');
    expect(ecart(812, 800)).toBe('−12');
    expect(ecart(800, 800)).toBe('0');
  });
});
