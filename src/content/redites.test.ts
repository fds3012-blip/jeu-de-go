import { describe, expect, it } from 'vitest';
import { PROCHES_DE_LECON, estRedite, formeCanonique, memePosition, positionsDeLecon, reprend } from './redites';
import { LESSONS } from './lessons';
import { ALL_PUZZLES } from './puzzles';
import { serieDeLecon, TAILLE_SERIE } from './themes';
import { parsePuzzles } from '../data/puzzles';

// #237, N3 : le même exercice ne revient pas quatre fois en 24 heures.
const B1 = ['.........', '.........', '.........', '...X.....', '..XT.O...', '...X.....', '.........', '.........', '.........'];
const tourner = (r: string[]) => r.map((_, y) => r.map((__, x) => r[r.length - 1 - x][y]).join(''));
const miroir = (r: string[]) => r.map(l => [...l].reverse().join(''));
const INVERSE: Record<string, string> = { X: 'O', O: 'X', S: 'T', T: 'S' };
const couleurs = (r: string[]) => r.map(l => l.replace(/[XOST]/g, c => INVERSE[c]));

describe('même position à symétrie près', () => {
  it('reconnaît les rotations, les miroirs et l’échange des couleurs', () => {
    expect(memePosition(B1, B1)).toBe(true);
    expect(memePosition(B1, tourner(B1))).toBe(true);
    expect(memePosition(B1, tourner(tourner(tourner(B1))))).toBe(true);
    expect(memePosition(B1, miroir(B1))).toBe(true);
    expect(memePosition(B1, couleurs(miroir(B1)))).toBe(true);
    // Les marques ne comptent pas : une pierre marquée est une pierre.
    expect(memePosition(B1, B1.map(l => l.replace('T', 'O')))).toBe(true);
  });

  it('distingue une autre position ou une autre taille', () => {
    const autre = B1.map((l, y) => (y === 6 ? '....O....' : l));
    expect(memePosition(B1, autre)).toBe(false);
    expect(memePosition(B1, B1.slice(0, 8).map(l => l.slice(0, 8)))).toBe(false);
    expect(formeCanonique(B1)).toBe(formeCanonique(tourner(B1)));
  });

  it('l’étape 4 de la leçon 1 est le problème b1 « Capture la pierre »', () => {
    const l1 = LESSONS.find(l => l.id === 'l1')!;
    const positions = positionsDeLecon(l1);
    expect(positions.length).toBeGreaterThan(0);
    expect(reprend(B1, positions)).toBe(true);
    expect(reprend(B1, [])).toBe(false);
  });
});

describe('pratique de fin de leçon sans redite', () => {
  const pb = (id: string, difficulty: number, rows?: string[]) => ({ id, difficulty, rows });
  const autre = B1.map((l, y) => (y === 7 ? '..O......' : l));

  it('un problème identique à une étape de la leçon passe en dernier', () => {
    const liste = [pb('b1', 100, B1), pb('a01', 300, autre), pb('a02', 320), pb('a03', 340), pb('a04', 360)];
    expect(serieDeLecon('l1', liste, new Set()).map(p => p.id)).toEqual(['b1', 'a01', 'a02']);
    const vue = (p: { rows?: string[] }) => !!p.rows && reprend(p.rows, [tourner(B1)]);
    expect(serieDeLecon('l1', liste, new Set(), TAILLE_SERIE, vue).map(p => p.id)).toEqual(['a01', 'a02', 'a03']);
    // Même après les réussis : on ne reprend la redite que faute d'autre chose.
    expect(serieDeLecon('l1', liste, new Set(['a01', 'a02', 'a03', 'a04']), TAILLE_SERIE, vue).map(p => p.id)).toEqual(['a01', 'a02', 'a03']);
    expect(serieDeLecon('l1', liste.slice(0, 2), new Set(), TAILLE_SERIE, vue).map(p => p.id)).toEqual(['a01', 'b1']);
  });

  it('avec la vraie banque, aucune pratique ne reprend une étape de sa leçon', () => {
    const banque = parsePuzzles(ALL_PUZZLES);
    // La banque contient bien des redites de leçon (b1 à b6 sont les étapes des leçons 1 à 3).
    const l1 = LESSONS.find(l => l.id === 'l1')!;
    expect(banque.filter(p => reprend(p.rows, positionsDeLecon(l1))).map(p => p.id)).toContain('b1');
    for (const lecon of LESSONS) {
      const serie = serieDeLecon(lecon.id, banque, new Set(), TAILLE_SERIE, p => estRedite(p, lecon));
      for (const p of serie) expect(estRedite(p, lecon), `${lecon.id} ${p.id}`).toBe(false);
    }
    // Leçon 1 : ni b1 (l'étape 4), ni a01 et n01 (même forme), qui ouvraient la série avant #237.
    expect(serieDeLecon('l1', banque, new Set()).map(p => p.id)).toEqual(['a01', 'n01', 'a02']);
    const ids = serieDeLecon('l1', banque, new Set(), TAILLE_SERIE, p => estRedite(p, l1)).map(p => p.id);
    expect(ids).not.toContain('b1');
    expect(ids).not.toContain('a01');
    expect(ids).not.toContain('n01');
    expect(ids).toHaveLength(TAILLE_SERIE);
  });

  it('la liste d’exclusion ne cite que des problèmes et des leçons qui existent', () => {
    const ids = new Set(ALL_PUZZLES.map(p => p.id));
    for (const [lecon, liste] of Object.entries(PROCHES_DE_LECON)) {
      expect(LESSONS.some(l => l.id === lecon), lecon).toBe(true);
      for (const id of liste) expect(ids.has(id), id).toBe(true);
    }
  });
});
