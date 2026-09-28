import { describe, expect, it } from 'vitest';
import { ALL_PUZZLES } from './puzzles';
import { LESSONS } from './lessons';
import { OUVERT_DEBUTANT, THEME_DU_PROBLEME, THEMES, THEMES_DE_LECON, TAILLE_SERIE, serieDeLecon, themeDe } from './themes';
import { traduire } from './i18n';

describe('thèmes des problèmes (#200)', () => {
  it('chaque problème de la banque a un thème, et un seul', () => {
    expect(ALL_PUZZLES.length).toBeGreaterThanOrEqual(129); // la banque grandit lot après lot : chaque nouveau problème doit recevoir un thème
    for (const p of ALL_PUZZLES) expect(themeDe(p.id), p.id).toBeDefined();
    // Aucun identifiant en double dans la table, aucun identifiant inconnu.
    const ids = Object.keys(THEME_DU_PROBLEME);
    expect(ids).toHaveLength(ALL_PUZZLES.length);
    expect(new Set(ids)).toEqual(new Set(ALL_PUZZLES.map(p => p.id)));
  });

  it('chaque thème a au moins 3 problèmes', () => {
    for (const t of THEMES) expect(ALL_PUZZLES.filter(p => themeDe(p.id) === t).length, t).toBeGreaterThanOrEqual(3);
  });

  it('chaque thème de leçon a au moins 3 problèmes ouverts à un débutant', () => {
    for (const [lecon, themes] of Object.entries(THEMES_DE_LECON)) {
      expect(LESSONS.some(l => l.id === lecon), lecon).toBe(true);
      for (const t of themes) {
        const ouverts = ALL_PUZZLES.filter(p => themeDe(p.id) === t && p.difficulty < OUVERT_DEBUTANT);
        expect(ouverts.length, `${lecon} ${t}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('les leçons de capture, d’atari, de techniques et de vie et mort ont une série', () => {
    expect(Object.keys(THEMES_DE_LECON).sort()).toEqual(['l1', 'l2', 'l3', 'l5']);
  });

  it('quelques classements de référence', () => {
    expect(themeDe('b6')).toBe('echelle');
    expect(themeDe('c3')).toBe('filet');
    expect(themeDe('c4')).toBe('prise-en-retour');
    expect(themeDe('c1')).toBe('double-atari');
    expect(themeDe('m07')).toBe('vie-mort');
    expect(themeDe('d07')).toBe('semeai');
    expect(themeDe('k04')).toBe('vie-mort'); // manque de libertés : Blanc ne vit pas
  });

  it('chaque thème a un nom en français et en anglais', () => {
    for (const t of THEMES) {
      expect(traduire('fr', `theme.${t}`)).not.toBe(`theme.${t}`);
      expect(traduire('en', `theme.${t}`)).not.toBe(`theme.${t}`);
    }
  });
});

describe('série de fin de leçon', () => {
  const pb = (id: string, difficulty: number) => ({ id, difficulty });
  const liste = [pb('a06', 420), pb('a01', 300), pb('a02', 320), pb('a03', 340), pb('b4', 400), pb('c1', 450), pb('a09', 480), pb('k03', 700), pb('i09', 450)];

  it('prend les 3 plus faciles non réussis du thème', () => {
    expect(serieDeLecon('l1', liste, new Set()).map(p => p.id)).toEqual(['a01', 'a02', 'a03']);
    expect(serieDeLecon('l1', liste, new Set(['a01'])).map(p => p.id)).toEqual(['a02', 'a03', 'a06']);
  });

  it('complète avec les plus faciles déjà réussis', () => {
    expect(serieDeLecon('l1', liste, new Set(['a01', 'a02', 'a03'])).map(p => p.id)).toEqual(['a06', 'a01', 'a02']);
    expect(serieDeLecon('l1', liste, new Set(['a01', 'a02', 'a03', 'a06'])).map(p => p.id)).toEqual(['a01', 'a02', 'a03']);
  });

  it('leçon 3 : un problème de chaque piège', () => {
    expect(serieDeLecon('l3', liste, new Set()).map(p => p.id)).toEqual(['c1', 'a09', 'i09']);
    expect(serieDeLecon('l3', liste, new Set(['i09'])).map(p => p.id)).toEqual(['c1', 'a09', 'k03']);
  });

  it('aucune série pour une leçon sans thème', () => {
    expect(serieDeLecon('l4', liste, new Set())).toEqual([]);
    expect(serieDeLecon('inconnue', liste, new Set())).toEqual([]);
  });

  it('avec la vraie banque, chaque leçon à thème donne 3 problèmes distincts, faciles pour un débutant', () => {
    for (const lecon of Object.keys(THEMES_DE_LECON)) {
      const s = serieDeLecon(lecon, ALL_PUZZLES, new Set());
      expect(s, lecon).toHaveLength(TAILLE_SERIE);
      expect(new Set(s.map(p => p.id)).size).toBe(TAILLE_SERIE);
      for (const p of s) {
        expect(THEMES_DE_LECON[lecon]).toContain(themeDe(p.id));
        expect(p.difficulty).toBeLessThan(OUVERT_DEBUTANT);
      }
    }
  });
});
