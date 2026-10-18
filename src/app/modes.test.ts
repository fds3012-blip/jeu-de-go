import { describe, expect, it } from 'vitest';
import { etapeDeLancement, modesAccueil, ORDRE_MODES, TUILES_MAX, type ContexteModes } from './modes';

const retour: ContexteModes = { comptes: true, enLigne: true, premierLancement: false };

describe('modes de l’accueil (#429, #432)', () => {
  it('dès le début, la partie en ligne classée est l’action principale ; l’ordi est la première tuile', () => {
    expect(modesAccueil(retour)).toEqual({ principal: 'en_ligne', tuiles: ['ordi', 'ami', 'deux'] });
  });

  it('tout premier lancement : l’écran « Joue ta première partie » garde l’ordi, la partie en ligne est la première tuile', () => {
    expect(modesAccueil({ ...retour, premierLancement: true })).toEqual({ principal: 'ordi', tuiles: ['en_ligne', 'ami', 'deux'] });
  });

  it('hors ligne, l’ordi reprend l’action principale (la partie en ligne reste une tuile)', () => {
    const m = modesAccueil({ ...retour, enLigne: false });
    expect(m.principal).toBe('ordi');
    expect(m.tuiles).toContain('en_ligne');
  });

  it('sans comptes : l’ordi en action principale, ni en ligne ni ami, « À deux » seul en tuile', () => {
    expect(modesAccueil({ ...retour, comptes: false })).toEqual({ principal: 'ordi', tuiles: ['deux'] });
  });

  it('#589, #647 : ni la partie guidée ni la partie de découverte sur l’accueil (elles sont dans Apprendre), dans aucun contexte', () => {
    for (const comptes of [true, false]) for (const enLigne of [true, false]) for (const premierLancement of [true, false]) {
      const m = modesAccueil({ comptes, enLigne, premierLancement });
      expect([m.principal, ...m.tuiles] as string[]).not.toContain('guidee');
      expect([m.principal, ...m.tuiles] as string[]).not.toContain('decouverte');
    }
  });

  it('chaque mode est joignable en 1 toucher (bouton ou tuile), une seule fois, trois tuiles au plus, dans tous les contextes', () => {
    for (const comptes of [true, false]) for (const enLigne of [true, false]) for (const premierLancement of [true, false]) {
      const m = modesAccueil({ comptes, enLigne, premierLancement });
      const tous = [m.principal, ...m.tuiles];
      expect(new Set(tous).size).toBe(tous.length);
      expect(tous.sort()).toEqual(ORDRE_MODES.filter(x => comptes || (x !== 'en_ligne' && x !== 'ami')).sort());
      expect(m.tuiles.length).toBeLessThanOrEqual(TUILES_MAX);
    }
  });
});

describe('étape de lancement (#613)', () => {
  it('l’ordi et à deux ouvrent la feuille de lancement', () => {
    expect(etapeDeLancement('ordi', { premierePartie: false })).toBe('ordi');
    expect(etapeDeLancement('deux', { premierePartie: false })).toBe('deux');
  });

  it('avant la toute première partie, aucune étape : la partie part tout de suite', () => {
    expect(etapeDeLancement('ordi', { premierePartie: true })).toBeNull();
    expect(etapeDeLancement('deux', { premierePartie: true })).toBeNull();
  });

  it('en ligne et un ami gardent leur écran : pas de feuille en plus', () => {
    for (const m of ['en_ligne', 'ami'] as const) {
      expect(etapeDeLancement(m, { premierePartie: false })).toBeNull();
      expect(etapeDeLancement(m, { premierePartie: true })).toBeNull();
    }
  });
});
