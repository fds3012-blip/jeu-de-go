import { describe, expect, it } from 'vitest';
import { entier } from './entier';

describe('entier (#509, L2)', () => {
  it('sépare les milliers par une espace insécable en français', () => {
    expect(entier(1284, 'fr')).toBe('1 284');
    expect(entier(1234567, 'fr')).toBe('1 234 567');
  });
  it('par une virgule en anglais', () => {
    expect(entier(1284, 'en')).toBe('1,284');
  });
  it('laisse les petits nombres tels quels', () => {
    expect(entier(0, 'fr')).toBe('0');
    expect(entier(999, 'fr')).toBe('999');
    expect(entier(7, 'en')).toBe('7');
  });
});
