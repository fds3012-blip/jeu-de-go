import { describe, expect, it } from 'vitest';
import { valeurDefilee } from './defilement';

describe('chiffres qui défilent', () => {
  it('part de 0, monte sans dépasser, et arrive exactement sur la cible', () => {
    expect(valeurDefilee(12.5, 0)).toBe(0);
    const suite = [0.1, 0.3, 0.5, 0.7, 0.9].map(t => valeurDefilee(12.5, t));
    for (let i = 1; i < suite.length; i++) expect(suite[i]).toBeGreaterThanOrEqual(suite[i - 1]);
    expect(Math.max(...suite)).toBeLessThanOrEqual(12);
    expect(valeurDefilee(12.5, 1)).toBe(12.5);
    expect(valeurDefilee(12.5, 3)).toBe(12.5);
  });

  it('ralentit en arrivant (décélération)', () => {
    expect(valeurDefilee(100, 0.5)).toBeGreaterThan(50);
  });
});
