import { describe, expect, it } from 'vitest';
import { aFeter } from './fetesPaliers';

describe('fête des paliers complets', () => {
  const ps = [{ id: 'debutant', complet: true }, { id: 'novice', complet: true }, { id: 'apprenti', complet: false }];
  it('ne fête que les paliers complets pas encore vus', () => {
    expect(aFeter(ps, ['debutant'])).toEqual(['novice']);
    expect(aFeter(ps, ['debutant', 'novice'])).toEqual([]);
  });
  it('ignore un stockage mal formé', () => {
    expect(aFeter(ps, 'x')).toEqual(['debutant', 'novice']);
    expect(aFeter(ps, [3, null])).toEqual(['debutant', 'novice']);
  });
});
