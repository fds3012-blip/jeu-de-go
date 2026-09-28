import { describe, expect, it } from 'vitest';
import { CHAPITRES } from '../content/lessons';

// #228 : la fin de chapitre se compte dans le chapitre de la leçon (ici « Les bases », l1 à l7).
const LESSONS = CHAPITRES[0].lecons;
import { actionsFin, finDeChapitre, type Progression } from './apprendre';

const toutes = (sauf?: string): Progression =>
  Object.fromEntries(LESSONS.filter(l => l.id !== sauf).map(l => [l.id, l.steps.length]));

describe('fin de chapitre (#200)', () => {
  it('la dernière leçon terminée ferme le chapitre', () => {
    expect(LESSONS[LESSONS.length - 1].id).toBe('l7');
    expect(finDeChapitre(LESSONS, { l7: LESSONS[6].steps.length }, 'l7')).toBe(true);
  });

  it('une autre leçon ferme le chapitre seulement si toutes sont faites', () => {
    expect(finDeChapitre(LESSONS, { l3: LESSONS[2].steps.length }, 'l3')).toBe(false);
    expect(finDeChapitre(LESSONS, toutes('l2'), 'l3')).toBe(false);
    expect(finDeChapitre(LESSONS, toutes(), 'l3')).toBe(true);
    expect(finDeChapitre([], {}, 'l1')).toBe(false);
  });
});

describe('actions de fin de leçon (#200)', () => {
  it('leçon à thème : la série de 3 problèmes en relief, puis la leçon suivante', () => {
    expect(actionsFin({ chapitre: false, pratique: true, suivante: true, jouer: true })).toEqual({ principale: 'pratique', liens: ['suivante', 'chemin'] });
  });

  it('leçon sans thème : la leçon suivante, comme avant', () => {
    expect(actionsFin({ chapitre: false, pratique: false, suivante: true, jouer: true })).toEqual({ principale: 'suivante', liens: ['chemin'] });
  });

  it('fin de chapitre : « Joue contre Pomme » en relief', () => {
    expect(actionsFin({ chapitre: true, pratique: false, suivante: false, jouer: true })).toEqual({ principale: 'jouer', liens: ['chemin'] });
    expect(actionsFin({ chapitre: true, pratique: true, suivante: true, jouer: true })).toEqual({ principale: 'jouer', liens: ['pratique', 'chemin'] });
  });

  it('sans partie possible, la fin de chapitre ramène au chemin', () => {
    expect(actionsFin({ chapitre: true, pratique: false, suivante: false, jouer: false })).toEqual({ principale: 'chemin', liens: [] });
  });
});
