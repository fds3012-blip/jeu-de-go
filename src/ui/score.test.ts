import { describe, expect, it } from 'vitest';
import { MOINS, score } from './score';

describe('score affiché (#509, point 19)', () => {
  it('signe moins typographique, jamais le tiret', () => {
    expect(score(-100, 'fr')).toBe(`${MOINS}100`);
    expect(score(-6.5, 'fr')).toBe(`${MOINS}6,5`);
    expect(score(-6.5, 'en')).toBe(`${MOINS}6.5`);
    expect(score(-1, 'fr')).not.toContain('-');
  });
  it('positif et nul inchangés, virgule en français', () => {
    expect(score(0, 'fr')).toBe('0');
    expect(score(7.5, 'fr')).toBe('7,5');
    expect(score(7.5, 'en')).toBe('7.5');
  });
});
