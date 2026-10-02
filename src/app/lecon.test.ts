import { describe, expect, it } from 'vitest';
import { LESSONS_FR } from '../content/lessons';
import { fromLabel } from '../go/coords';
import { doitGuider, etatsPoints, humeurMochi, pointsGuide } from './lecon';

describe('humeurMochi', () => {
  it('suit le moment : neutre pour la consigne, content, pensif après une erreur, fier à la fin', () => {
    expect(humeurMochi('consigne')).toBe('neutre');
    expect(humeurMochi('juste')).toBe('content');
    expect(humeurMochi('revoir')).toBe('pensif');
    expect(humeurMochi('fin')).toBe('fier');
  });
});

describe('pointsGuide', () => {
  const l1 = LESSONS_FR.find(l => l.id === 'l1')!;
  it('leçon 1, étape 1 : le point à poser de la démonstration, tant que le geste est attendu', () => {
    expect(pointsGuide(l1.steps[0], true)).toEqual([fromLabel('E5', 9)]);
    expect(pointsGuide(l1.steps[0], false)).toEqual([]);
  });
  it('démonstration « touche » : les pierres à toucher', () => {
    const touche = LESSONS_FR.flatMap(l => l.steps).find(s => s.kind === 'info' && s.geste && 'touche' in s.geste)!;
    expect(pointsGuide(touche, true).length).toBeGreaterThan(0);
  });
  it('étape à jouer : les points d’aide déjà verts, jamais la réponse', () => {
    const avecAide = LESSONS_FR.flatMap(l => l.steps).find(s => s.kind === 'move' && (s.libs ?? s.aide))!;
    expect(pointsGuide(avecAide, false).length).toBeGreaterThan(0);
    expect(pointsGuide({ kind: 'move', rows: [], accept: ['E5'], text: '', ok: '', no: '' }, false)).toEqual([]);
    expect(pointsGuide({ kind: 'quiz', rows: [], text: '', choices: ['1'], answer: 0, ok: '', no: '' }, false)).toEqual([]);
    expect(pointsGuide({ kind: 'touche', rows: [], accept: ['E5'], text: '', ok: '', no: '' }, false)).toEqual([]);
  });
});

describe('doitGuider', () => {
  it('une seule fois, et seulement s’il y a un point à montrer', () => {
    expect(doitGuider(null, [40])).toBe(true);
    expect(doitGuider('1', [40])).toBe(false);
    expect(doitGuider(null, [])).toBe(false);
  });
});

describe('etatsPoints', () => {
  it('faites, puis la prochaine en cours, puis à venir ; aucun chiffre', () => {
    expect(etatsPoints(4, 0)).toEqual(['encours', 'avenir', 'avenir', 'avenir']);
    expect(etatsPoints(4, 2)).toEqual(['faite', 'faite', 'encours', 'avenir']);
    expect(etatsPoints(4, 4)).toEqual(['faite', 'faite', 'faite', 'faite']);
  });
});
