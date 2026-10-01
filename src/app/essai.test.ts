import { describe, expect, it } from 'vitest';
import {
  LECONS_ESSAI, PARTIES_ESSAI, decider, etatCompte, libreSansCompte, lireEssai, noterPartieTerminee, partiesRestantes, partiesTerminees,
} from './essai';

describe('essai sans compte (#343)', () => {
  it('3 parties, leçons 1 à 3 et le Go du jour sont libres', () => {
    expect(PARTIES_ESSAI).toBe(3);
    expect(LECONS_ESSAI).toBe(3);
    expect(libreSansCompte({ quoi: 'partie' }, 0)).toBe(true);
    expect(libreSansCompte({ quoi: 'partie' }, 2)).toBe(true);
    expect(libreSansCompte({ quoi: 'partie' }, 3)).toBe(false);
    expect(libreSansCompte({ quoi: 'lecon', rang: 0 }, 99)).toBe(true);
    expect(libreSansCompte({ quoi: 'lecon', rang: 2 }, 0)).toBe(true);
    expect(libreSansCompte({ quoi: 'lecon', rang: 3 }, 0)).toBe(false);
    expect(libreSansCompte({ quoi: 'go_du_jour' }, 99)).toBe(true);
  });

  it('le reste demande un compte, avec la bonne raison', () => {
    expect(decider({ quoi: 'partie' }, 'aucun', 3)).toEqual({ ok: false, raison: 'parties' });
    expect(decider({ quoi: 'lecon', rang: 3 }, 'aucun', 0)).toEqual({ ok: false, raison: 'lecons' });
    expect(decider({ quoi: 'probleme' }, 'aucun', 0)).toEqual({ ok: false, raison: 'problemes' });
    expect(decider({ quoi: 'placement' }, 'aucun', 0)).toEqual({ ok: false, raison: 'placement' });
    expect(decider({ quoi: 'import' }, 'aucun', 0)).toEqual({ ok: false, raison: 'import' });
    expect(decider({ quoi: 'defi' }, 'aucun', 0)).toEqual({ ok: false, raison: 'defi' });
    expect(decider({ quoi: 'en_ligne' }, 'aucun', 0)).toEqual({ ok: false, raison: 'en_ligne' });
  });

  it('une session anonyme ou sans pseudo reste à l’essai ; un compte complet ouvre tout', () => {
    expect(decider({ quoi: 'defi' }, 'anonyme', 0).ok).toBe(false);
    expect(decider({ quoi: 'partie' }, 'sans_pseudo', 5).ok).toBe(false);
    expect(decider({ quoi: 'partie' }, 'complet', 50).ok).toBe(true);
    expect(decider({ quoi: 'defi' }, 'complet', 0).ok).toBe(true);
    expect(decider({ quoi: 'lecon', rang: 11 }, 'complet', 0).ok).toBe(true);
  });

  it('ne bloque pas pendant le chargement de la session', () => {
    expect(decider({ quoi: 'lecon', rang: 8 }, 'chargement', 9).ok).toBe(true);
  });

  it('sans service de compte, tout est libre sauf le défi et le jeu en ligne', () => {
    expect(decider({ quoi: 'partie' }, 'aucun', 10, false).ok).toBe(true);
    expect(decider({ quoi: 'probleme' }, 'aucun', 10, false).ok).toBe(true);
    expect(decider({ quoi: 'defi' }, 'aucun', 0, false)).toEqual({ ok: false, raison: 'defi' });
    expect(decider({ quoi: 'en_ligne' }, 'aucun', 0, false)).toEqual({ ok: false, raison: 'en_ligne' });
  });

  it('compte les parties sur l’appareil, bilan d’avant #343 compris', () => {
    expect(lireEssai(null)).toEqual({ terminees: 0 });
    expect(lireEssai({ terminees: 'x' })).toEqual({ terminees: 0 });
    expect(lireEssai({ terminees: -4 })).toEqual({ terminees: 0 });
    expect(lireEssai({ terminees: 2.7 })).toEqual({ terminees: 2 });
    const e = noterPartieTerminee(noterPartieTerminee({ terminees: 0 }));
    expect(e).toEqual({ terminees: 2 });
    expect(partiesTerminees(e, {})).toBe(2);
    expect(partiesTerminees({ terminees: 0 }, { pomme: { v: 2, d: 3 } })).toBe(5);
    expect(partiesRestantes(1)).toBe(2);
    expect(partiesRestantes(7)).toBe(0);
  });

  it('état du compte : chargement, aucun, anonyme, sans pseudo, complet', () => {
    expect(etatCompte(undefined, undefined)).toBe('chargement');
    expect(etatCompte(null, undefined)).toBe('aucun');
    expect(etatCompte({ anonyme: true }, null)).toBe('anonyme');
    expect(etatCompte({ anonyme: false }, undefined)).toBe('chargement');
    expect(etatCompte({ anonyme: false }, null)).toBe('sans_pseudo');
    expect(etatCompte({ anonyme: false }, 'Florian')).toBe('complet');
  });
});
