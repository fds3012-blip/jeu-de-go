// Issue #549 : maîtrise par thème. Le réglage MAITRISE_CIBLE vise le passage au thème suivant (`theme_suivant` /
// `theme_maitrise`, cible 50 %) : il doit tenir dans chaque série affichée et rester un objectif, jamais un total.
import { describe, expect, it } from 'vitest';
import { ALL_PUZZLES } from '../content/puzzles';
import { parsePuzzles } from '../data/puzzles';
import { MIN_PAR_SERIE, problemesDe, seriesDisponibles, type SerieTheme } from './seriesThemes';
import { MAITRISE_CIBLE, maitriseDe, maitrises, themeSuivant, vientDeMaitriser } from './maitriseThemes';

const liste = parsePuzzles(ALL_PUZZLES);
const series = seriesDisponibles(liste);

describe('maîtrise par thème', () => {
  it('l’objectif tient dans chaque série affichée, et il est plus petit que la série (jamais un total)', () => {
    expect(MAITRISE_CIBLE).toBeLessThanOrEqual(MIN_PAR_SERIE);
    for (const s of series) {
      expect(maitriseDe(liste, s, new Set()).cible).toBe(MAITRISE_CIBLE);
      expect(problemesDe(liste, s).length, s).toBeGreaterThan(MAITRISE_CIBLE);
    }
  });

  it('compte les problèmes différents réussis de la série, plafonnés à l’objectif', () => {
    const ids = problemesDe(liste, 'capturer').map(p => p.id);
    const autre = problemesDe(liste, 'sauver')[0].id;
    expect(maitriseDe(liste, 'capturer', new Set([ids[0], ids[1], autre]))).toEqual({ reussis: 2, cible: MAITRISE_CIBLE, maitrise: false });
    expect(maitriseDe(liste, 'capturer', new Set(ids)).reussis).toBe(MAITRISE_CIBLE);
    expect(maitriseDe(liste, 'capturer', new Set(ids)).maitrise).toBe(true);
  });

  it('le Go du jour exclu ne compte pas', () => {
    const ids = problemesDe(liste, 'capturer').slice(0, MAITRISE_CIBLE).map(p => p.id);
    expect(maitriseDe(liste, 'capturer', new Set(ids), ids[0]).maitrise).toBe(false);
  });

  it('vient de maîtriser : une seule fois, au passage de l’objectif', () => {
    const ids = problemesDe(liste, 'capturer').map(p => p.id);
    const avant = new Set(ids.slice(0, MAITRISE_CIBLE - 1));
    expect(vientDeMaitriser(liste, 'capturer', avant, ids[MAITRISE_CIBLE - 1])).toBe(true);
    expect(vientDeMaitriser(liste, 'capturer', avant, ids[0])).toBe(false); // déjà réussi
    const deja = new Set(ids.slice(0, MAITRISE_CIBLE));
    expect(vientDeMaitriser(liste, 'capturer', deja, ids[MAITRISE_CIBLE])).toBe(false);
  });

  it('thème suivant : le prochain pas encore maîtrisé, dans l’ordre des séries, en revenant au début', () => {
    const m = maitrises(liste, series, new Set());
    expect(themeSuivant('capturer', series, m)).toBe('sauver');
    const tout = new Set(liste.map(p => p.id));
    const presque = maitrises(liste, series, new Set([...tout].filter(id => !problemesDe(liste, 'capturer').some(p => p.id === id))));
    const derniere = series.at(-1) as SerieTheme;
    expect(themeSuivant(derniere, series, presque)).toBe('capturer');
    expect(themeSuivant('capturer', series, maitrises(liste, series, tout))).toBeNull();
  });
});
