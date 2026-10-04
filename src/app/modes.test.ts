import { describe, expect, it } from 'vitest';
import { modesAccueil, ORDRE_MODES, type ContexteModes } from './modes';

const retour: ContexteModes = { comptes: true, enLigne: true, premierLancement: false };

describe('modes de l’accueil (#429, #432)', () => {
  it('dès le début, la partie en ligne classée est l’action principale ; l’ordi est la première tuile', () => {
    expect(modesAccueil(retour)).toEqual({ principal: 'en_ligne', tuiles: ['ordi', 'ami'], plus: ['deux', 'guidee'] });
  });

  it('tout premier lancement : l’écran « Joue ta première partie » garde l’ordi, la partie en ligne est la première tuile', () => {
    expect(modesAccueil({ ...retour, premierLancement: true })).toEqual({ principal: 'ordi', tuiles: ['en_ligne', 'ami'], plus: ['deux', 'guidee'] });
  });

  it('hors ligne, l’ordi reprend l’action principale (la partie en ligne reste une tuile)', () => {
    const m = modesAccueil({ ...retour, enLigne: false });
    expect(m.principal).toBe('ordi');
    expect(m.tuiles).toContain('en_ligne');
  });

  it('sans comptes : l’ordi en action principale, ni en ligne ni ami, les deux autres modes en tuiles, sans « Plus »', () => {
    expect(modesAccueil({ ...retour, comptes: false })).toEqual({ principal: 'ordi', tuiles: ['deux', 'guidee'], plus: [] });
  });

  it('chaque mode est joignable en 1 toucher (bouton ou tuile) ou 2 (« Plus »), une seule fois, dans tous les contextes', () => {
    for (const comptes of [true, false]) for (const enLigne of [true, false]) for (const premierLancement of [true, false]) {
      const m = modesAccueil({ comptes, enLigne, premierLancement });
      const tous = [m.principal, ...m.tuiles, ...m.plus];
      expect(new Set(tous).size).toBe(tous.length);
      expect(tous.sort()).toEqual(ORDRE_MODES.filter(x => comptes || (x !== 'en_ligne' && x !== 'ami')).sort());
      expect(m.tuiles.length + (m.plus.length ? 1 : 0)).toBeLessThanOrEqual(3);
    }
  });
});
