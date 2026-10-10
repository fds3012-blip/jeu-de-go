import { describe, expect, it } from 'vitest';
import { ajouterGain, XP_SEANCE_VIDE } from './xpSeance';

describe('XP d’une séance (#509, L1)', () => {
  it('additionne le gain, le bonus « première fois » et l’objectif de la semaine', () => {
    let x = ajouterGain(XP_SEANCE_VIDE, { source: 'erreursRejouees', points: 30, bonus: 20 });
    x = ajouterGain(x, { source: 'objectif', points: 30, bonus: 0 });
    expect(x).toEqual({ points: 60, bonus: 20, objectif: 30 });
  });
});
