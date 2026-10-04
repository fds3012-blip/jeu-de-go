import { describe, expect, it } from 'vitest';
import { estDebutant, modesAccueil, ORDRE_MODES, type ContexteModes } from './modes';

const confirme: ContexteModes = { comptes: true, enLigne: true, pommeBattue: true, basesFaites: true };
const debutant: ContexteModes = { ...confirme, pommeBattue: false };

describe('modes de l’accueil (#429)', () => {
  it('le débutant garde l’ordi ; la partie en ligne est la première tuile', () => {
    expect(modesAccueil(debutant)).toEqual({ principal: 'ordi', tuiles: ['en_ligne', 'ami'], plus: ['deux', 'guidee'] });
    expect(modesAccueil({ ...confirme, basesFaites: false }).principal).toBe('ordi');
  });

  it('Pomme battue et bases faites : la partie en ligne classée passe en action principale, l’ordi juste à côté', () => {
    expect(modesAccueil(confirme)).toEqual({ principal: 'en_ligne', tuiles: ['ordi', 'ami'], plus: ['deux', 'guidee'] });
  });

  it('hors ligne, l’ordi reprend l’action principale (la partie en ligne reste une tuile)', () => {
    const m = modesAccueil({ ...confirme, enLigne: false });
    expect(m.principal).toBe('ordi');
    expect(m.tuiles).toContain('en_ligne');
  });

  it('sans comptes : ni en ligne ni ami, les deux autres modes en tuiles, sans « Plus »', () => {
    expect(modesAccueil({ ...confirme, comptes: false })).toEqual({ principal: 'ordi', tuiles: ['deux', 'guidee'], plus: [] });
  });

  it('chaque mode est joignable en 1 toucher (bouton ou tuile) ou 2 (« Plus »), une seule fois, dans tous les contextes', () => {
    for (const comptes of [true, false]) for (const enLigne of [true, false]) for (const pommeBattue of [true, false]) for (const basesFaites of [true, false]) {
      const m = modesAccueil({ comptes, enLigne, pommeBattue, basesFaites });
      const tous = [m.principal, ...m.tuiles, ...m.plus];
      expect(new Set(tous).size).toBe(tous.length);
      expect(tous.sort()).toEqual(ORDRE_MODES.filter(x => comptes || (x !== 'en_ligne' && x !== 'ami')).sort());
      expect(m.tuiles.length + (m.plus.length ? 1 : 0)).toBeLessThanOrEqual(3);
    }
  });

  it('débutant : Pomme pas battue ou premières leçons pas faites', () => {
    expect(estDebutant(confirme)).toBe(false);
    expect(estDebutant({ ...confirme, basesFaites: false })).toBe(true);
    expect(estDebutant(debutant)).toBe(true);
  });
});
