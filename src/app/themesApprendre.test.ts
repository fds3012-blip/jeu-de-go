import { describe, expect, it } from 'vitest';
import { LESSONS } from '../content/lessons';
import { THEMES, THEMES_DE_LECON } from '../content/themesLecons';
import { traduire } from '../content/i18n/secondaires';
import { MOTIFS } from '../ui/vignettes';
import { VIGNETTE_DE_THEME, leconsDuTheme, themesAvecLecons } from './themesApprendre';

const lecon = (id: string, n = 3) => ({ id, steps: Array.from({ length: n }) });

describe('« Par thème » dans Apprendre (#590)', () => {
  it('seulement les thèmes qui ont une leçon publiée, dans l’ordre où le chemin les fait découvrir', () => {
    const t = themesAvecLecons([lecon('l1'), lecon('l2'), lecon('l3'), lecon('l20')], {});
    expect(t.map(x => x.theme)).toEqual(['capture', 'atari', 'double-atari', 'bord', 'echelle']);
    expect(t[0].lecons).toEqual(['l1', 'l20']);
  });

  it('compte les leçons faites de chaque thème (une leçon commencée n’est pas faite)', () => {
    const t = themesAvecLecons([lecon('l1'), lecon('l20'), lecon('l21')], { l1: 3, l20: 1, l21: 9 });
    expect(t).toEqual([{ theme: 'capture', lecons: ['l1', 'l20', 'l21'], faites: 2, vignette: 'l1' }]);
  });

  it('une leçon sans thème, ou inconnue, n’ajoute rien ; aucune leçon, aucun thème', () => {
    expect(themesAvecLecons([lecon('l28'), lecon('zz')], {})).toEqual([]);
    expect(themesAvecLecons([], {})).toEqual([]);
  });

  it('#614 : la vignette de chaque carte est la première leçon du thème qui n’illustre pas déjà une carte d’avant', () => {
    const t = themesAvecLecons([lecon('l1'), lecon('l2'), lecon('l3'), lecon('l27'), lecon('l42')], {});
    // La leçon 3 sert trois thèmes et dessine l'échelle : le double atari a sa propre vignette (#671), la leçon 3 reste
    // écartée, le bord et l'échelle prennent leur leçon suivante.
    expect(Object.fromEntries(t.map(x => [x.theme, x.vignette]))).toEqual({ capture: 'l1', atari: 'l2', 'double-atari': 'theme-double-atari', bord: 'l27', echelle: 'l42', ouverture: 'l27' });
  });

  it('#614 : sur le vrai chemin, quinze thèmes et quinze vignettes différentes, chacune dessinée', () => {
    const t = themesAvecLecons(LESSONS, {});
    expect(t).toHaveLength(15);
    expect(new Set(t.map(x => x.vignette)).size).toBe(15);
    expect(new Set(t.map(x => JSON.stringify(MOTIFS[x.vignette]))).size).toBe(15);
    for (const x of t) {
      // Une leçon du thème, ou la vignette propre au thème (#671).
      expect([...x.lecons, VIGNETTE_DE_THEME[x.theme]], x.theme).toContain(x.vignette);
      expect(MOTIFS[x.vignette], x.vignette).toBeDefined();
    }
  });

  it('#671 : la carte Double atari a sa vignette propre, plus celle de l’échelle ; la carte Échelle garde la sienne', () => {
    const v = Object.fromEntries(themesAvecLecons(LESSONS, {}).map(x => [x.theme, x.vignette]));
    expect(v['double-atari']).toBe('theme-double-atari');
    expect(v['double-atari']).not.toBe('l3');
    expect(v.echelle).toBe('l42');
    expect(Object.values(v)).not.toContain('l3');
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

  it('#614 : la ligne de chaque carte tient en 8 mots au plus (E4), en français et en anglais', () => {
    for (const cle of [...THEMES, 'sauver', 'tesuji'] as const) {
      for (const l of ['fr', 'en'] as const) {
        const texte = traduire(l, `themes.desc.${cle}`);
        expect(texte.split(/[\s\u00a0]+/).filter(m => /\p{L}/u.test(m)).length, `${l} ${cle} : ${texte}`).toBeLessThanOrEqual(8);
      }
    }
  });
});

describe('#652 : sans chemin, chaque leçon reste accessible par un thème', () => {
  it('les 48 leçons publiées sont dans la page d’au moins un thème de la grille, chacune une fois par thème', () => {
    const grille = themesAvecLecons(LESSONS, {});
    const pages = grille.map(x => leconsDuTheme(x.theme, LESSONS).map(l => l.id));
    const atteintes = new Set(pages.flat());
    expect(LESSONS.length).toBeGreaterThanOrEqual(48);
    for (const l of LESSONS) expect(atteintes.has(l.id), `${l.id} (${l.title}) n’est dans aucun thème`).toBe(true);
    for (const p of pages) expect(new Set(p).size).toBe(p.length);
  });
  it('la grille montre tous les thèmes qui ont une leçon (plus de pli « Tous les thèmes »)', () => {
    const avecLecon = THEMES.filter(th => LESSONS.some(l => (THEMES_DE_LECON[l.id] ?? []).includes(th)));
    expect(themesAvecLecons(LESSONS, {}).map(x => x.theme).sort()).toEqual([...avecLecon].sort());
  });
  it('dans la page d’un thème, les leçons gardent l’ordre du programme (celui des rangs et du verrou du compte)', () => {
    const rang = new Map(LESSONS.map((l, i) => [l.id, i]));
    for (const th of THEMES) {
      const r = leconsDuTheme(th, LESSONS).map(l => rang.get(l.id)!);
      expect(r).toEqual([...r].sort((a, b) => a - b));
    }
  });
});
