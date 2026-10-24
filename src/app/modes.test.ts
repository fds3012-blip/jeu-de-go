import { describe, expect, it } from 'vitest';
import { assezDeMonde, etapeDeLancement, modesAccueil, ORDRE_MODES, SEUIL_EN_LIGNE, TUILES_MAX, type ContexteModes } from './modes';

/** Joueur qui revient, avec des comptes, en ligne, et assez de monde pour jouer en ligne. */
const retour: ContexteModes = { comptes: true, enLigne: true, premierLancement: false, joueursEnLigne: SEUIL_EN_LIGNE };

describe('modes de l’accueil (#429, #432, #695)', () => {
  it('#695 : le seuil est 4 joueurs en ligne (une seule constante)', () => {
    expect(SEUIL_EN_LIGNE).toBe(4);
    expect(assezDeMonde(SEUIL_EN_LIGNE - 1)).toBe(false);
    expect(assezDeMonde(SEUIL_EN_LIGNE)).toBe(true);
    expect(assezDeMonde(SEUIL_EN_LIGNE + 10)).toBe(true);
  });

  it('#695 : compteur inconnu, vide ou absurde : on compte moins que le seuil', () => {
    for (const n of [null, undefined, NaN, -1, 0]) expect(assezDeMonde(n)).toBe(false);
  });

  it('#695 : sous le seuil (même zéro ou inconnu), l’ordi est l’action principale ; « En ligne » reste la première tuile', () => {
    for (const joueursEnLigne of [null, 0, 1, SEUIL_EN_LIGNE - 1]) {
      expect(modesAccueil({ ...retour, joueursEnLigne })).toEqual({ principal: 'ordi', tuiles: ['en_ligne', 'ami', 'deux'] });
    }
  });

  it('#695 : au seuil et au-dessus, la partie en ligne classée redevient l’action principale ; l’ordi est la première tuile', () => {
    for (const joueursEnLigne of [SEUIL_EN_LIGNE, SEUIL_EN_LIGNE + 1, 500]) {
      expect(modesAccueil({ ...retour, joueursEnLigne })).toEqual({ principal: 'en_ligne', tuiles: ['ordi', 'ami', 'deux'] });
    }
  });

  it('#695 : « En ligne » reste joignable en un toucher sous le seuil, avec des comptes', () => {
    const m = modesAccueil({ ...retour, joueursEnLigne: 0 });
    expect(m.tuiles).toContain('en_ligne');
  });

  it('tout premier lancement : l’écran « Joue ta première partie » garde l’ordi, même avec du monde ; la partie en ligne est la première tuile', () => {
    expect(modesAccueil({ ...retour, premierLancement: true })).toEqual({ principal: 'ordi', tuiles: ['en_ligne', 'ami', 'deux'] });
  });

  it('tout premier lancement : l’écran « Joue ta première partie » garde l’ordi, la partie en ligne est la première tuile', () => {
    expect(modesAccueil({ ...retour, premierLancement: true })).toEqual({ principal: 'ordi', tuiles: ['en_ligne', 'ami', 'deux'] });
  });

  it('hors ligne, l’ordi garde l’action principale, quel que soit le dernier compteur connu (la partie en ligne reste une tuile)', () => {
    const m = modesAccueil({ ...retour, enLigne: false });
    expect(m.principal).toBe('ordi');
    expect(m.tuiles).toContain('en_ligne');
  });

  it('sans comptes : l’ordi en action principale, ni en ligne ni ami, « À deux » seul en tuile', () => {
    expect(modesAccueil({ ...retour, comptes: false, joueursEnLigne: 50 })).toEqual({ principal: 'ordi', tuiles: ['deux'] });
  });

  it('#589, #647 : ni la partie guidée ni la partie de découverte sur l’accueil (elles sont dans Apprendre), dans aucun contexte', () => {
    for (const comptes of [true, false]) for (const enLigne of [true, false]) for (const premierLancement of [true, false]) for (const joueursEnLigne of [null, 0, SEUIL_EN_LIGNE]) {
      const m = modesAccueil({ comptes, enLigne, premierLancement, joueursEnLigne });
      expect([m.principal, ...m.tuiles] as string[]).not.toContain('guidee');
      expect([m.principal, ...m.tuiles] as string[]).not.toContain('decouverte');
    }
  });

  it('chaque mode est joignable en 1 toucher (bouton ou tuile), une seule fois, trois tuiles au plus, dans tous les contextes', () => {
    for (const comptes of [true, false]) for (const enLigne of [true, false]) for (const premierLancement of [true, false]) for (const joueursEnLigne of [null, 0, SEUIL_EN_LIGNE]) {
      const m = modesAccueil({ comptes, enLigne, premierLancement, joueursEnLigne });
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
