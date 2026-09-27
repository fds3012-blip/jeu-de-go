import { describe, expect, it } from 'vitest';
import { legendeSerie, niveau, suivant } from './problemes';

describe('niveau', () => {
  it('trois crans selon la difficulté', () => {
    expect(niveau(400)).toEqual({ mot: 'Facile', crans: 1 });
    expect(niveau(500)).toEqual({ mot: 'Moyen', crans: 2 });
    expect(niveau(749)).toEqual({ mot: 'Moyen', crans: 2 });
    expect(niveau(750)).toEqual({ mot: 'Difficile', crans: 3 });
  });
});

describe('suivant', () => {
  const l = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('le prochain pas réussi après le problème courant', () => {
    expect(suivant(l, l[0], new Set())).toBe(l[1]);
    expect(suivant(l, l[0], new Set(['b']))).toBe(l[2]);
  });
  it('revient au début, sans reproposer le problème courant', () => {
    expect(suivant(l, l[2], new Set())).toBe(l[0]);
    expect(suivant(l, l[2], new Set(['a', 'b']))).toBeUndefined();
  });
});

describe('legendeSerie', () => {
  it('accorde « jour »', () => {
    expect(legendeSerie(0)).toBe('jour de suite');
    expect(legendeSerie(1)).toBe('jour de suite');
    expect(legendeSerie(4)).toBe('jours de suite');
  });
});
