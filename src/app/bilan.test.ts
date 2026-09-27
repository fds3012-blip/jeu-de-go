import { describe, expect, it } from 'vitest';
import { battu, enregistrer, fin, komiDepuisUrl, lireBilan, suivant, type Bilan } from './bilan';
import { OPPONENTS } from '../engine';

const [pomme, caillou] = OPPONENTS;

describe('bilan', () => {
  it("compte victoires et défaites par adversaire, sans modifier le bilan d'entrée", () => {
    const b0: Bilan = {};
    const b1 = enregistrer(b0, 'pomme', true);
    const b2 = enregistrer(b1, 'pomme', false);
    const b3 = enregistrer(b2, 'caillou', false);
    expect(b0).toEqual({});
    expect(b3).toEqual({ pomme: { v: 1, d: 1 }, caillou: { v: 0, d: 1 } });
    expect(battu(b3, 'pomme')).toBe(true);
    expect(battu(b3, 'caillou')).toBe(false);
  });

  it('relit le stockage en ignorant les entrées invalides', () => {
    expect(lireBilan(null)).toEqual({});
    expect(lireBilan('x')).toEqual({});
    expect(lireBilan({ pomme: { v: 2, d: 1 }, caillou: { v: 'a' }, x: null })).toEqual({ pomme: { v: 2, d: 1 } });
  });
});

describe('adversaire suivant', () => {
  it("suit l'ordre de OPPONENTS", () => {
    expect(suivant(OPPONENTS, 'pomme')?.id).toBe('caillou');
    expect(suivant(OPPONENTS, OPPONENTS[OPPONENTS.length - 1].id)).toBeUndefined();
    expect(suivant(OPPONENTS, 'inconnu')).toBeUndefined();
  });
});

describe('écran de fin', () => {
  it('victoire contre Pomme : on propose Caillou', () => {
    const f = fin(pomme, true, { pomme: { v: 1, d: 0 } }, OPPONENTS);
    expect(f.cta).toBe('Défier Caillou');
    expect(f.cible).toBe('caillou');
    expect(f.mochi).toContain('tu as battu Pomme');
  });

  it('victoires répétées : Mochi compte', () => {
    expect(fin(pomme, true, { pomme: { v: 3, d: 0 } }, OPPONENTS).mochi).toContain('3 victoires contre Pomme');
  });

  it('victoire contre le dernier adversaire : on rejoue contre lui', () => {
    const last = OPPONENTS[OPPONENTS.length - 1];
    const f = fin(last, true, { [last.id]: { v: 1, d: 0 } }, OPPONENTS);
    expect(f.cta).toBe(`Rejouer contre ${last.nom}`);
    expect(f.cible).toBe(last.id);
  });

  it('défaite : rejouer contre le même adversaire', () => {
    const f = fin(caillou, false, { caillou: { v: 0, d: 1 } }, OPPONENTS);
    expect(f.cta).toBe('Rejouer contre Caillou');
    expect(f.cible).toBe('caillou');
    expect(f.mochi).toContain('Caillou gagne');
    expect(f.mochi).not.toContain('bilan');
    expect(fin(caillou, false, { caillou: { v: 1, d: 2 } }, OPPONENTS).mochi).toContain('1 victoire, 2 défaites');
  });
});

describe('komi de test', () => {
  it('lit ?komi= et garde 6,5 sinon', () => {
    expect(komiDepuisUrl('')).toBe(6.5);
    expect(komiDepuisUrl('?komi=-100')).toBe(-100);
    expect(komiDepuisUrl('?komi=0,5')).toBe(0.5);
    expect(komiDepuisUrl('?komi=abc')).toBe(6.5);
    expect(komiDepuisUrl('?komi=')).toBe(6.5);
  });
});
