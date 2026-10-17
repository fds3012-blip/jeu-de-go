import { describe, expect, it } from 'vitest';
import { LESSONS } from '../content/lessons';
import { THEMES_DE_LECON } from '../content/themesLecons';
import { leconsDuTheme, themesAvecLecons } from './themesApprendre';

const lecon = (id: string, n = 3) => ({ id, steps: Array.from({ length: n }) });

describe('« Par thème » dans Apprendre (#590)', () => {
  it('seulement les thèmes qui ont une leçon publiée, dans l’ordre où le chemin les fait découvrir', () => {
    const t = themesAvecLecons([lecon('l1'), lecon('l2'), lecon('l3'), lecon('l20')], {});
    expect(t.map(x => x.theme)).toEqual(['capture', 'atari', 'double-atari', 'bord', 'echelle']);
    expect(t[0].lecons).toEqual(['l1', 'l20']);
  });

  it('compte les leçons faites de chaque thème (une leçon commencée n’est pas faite)', () => {
    const t = themesAvecLecons([lecon('l1'), lecon('l20'), lecon('l21')], { l1: 3, l20: 1, l21: 9 });
    expect(t).toEqual([{ theme: 'capture', lecons: ['l1', 'l20', 'l21'], faites: 2 }]);
  });

  it('une leçon sans thème, ou inconnue, n’ajoute rien ; aucune leçon, aucun thème', () => {
    expect(themesAvecLecons([lecon('l28'), lecon('zz')], {})).toEqual([]);
    expect(themesAvecLecons([], {})).toEqual([]);
  });

  it('les leçons d’un thème, dans l’ordre du chemin', () => {
    expect(leconsDuTheme('ko', [lecon('l45'), lecon('l4'), lecon('l1'), lecon('l25')]).map(l => l.id)).toEqual(['l45', 'l4', 'l25']);
  });

  it('sur le vrai chemin : chaque thème affiché a au moins une leçon, et chaque leçon à thème y figure', () => {
    const t = themesAvecLecons(LESSONS, {});
    expect(t.length).toBeGreaterThan(0);
    for (const x of t) expect(x.lecons.length, x.theme).toBeGreaterThan(0);
    for (const l of LESSONS) for (const th of THEMES_DE_LECON[l.id] ?? []) expect(t.find(x => x.theme === th)?.lecons).toContain(l.id);
  });
});
