// Leçons v2 (issue #101) : chaque démonstration est légale selon src/go, chaque question a la réponse annoncée,
// et chaque texte d'étape tient en 12 mots (hors vocabulaire entre parenthèses).
import { LESSONS, type LessonStep } from '../content/lessons';
import { imagesDemo, mots } from '../content/demo';
import { fromRows } from './position';
import { play } from './rules';
import { fromLabel, toLabel } from './coords';

const N = 9;
const at = (l: string) => fromLabel(l, N);
type Info = Extract<LessonStep, { kind: 'info' }>;
const step = (id: string, i: number) => LESSONS.find(l => l.id === id)!.steps[i];
const fin = (id: string, i: number) => { const s = step(id, i) as Info; return imagesDemo(s.rows, s.demo!).at(-1)!; };
const labels = (ps: number[]) => ps.map(p => toLabel(p, N)).sort();
/** Leçons déjà réécrites « l'image d'abord ». */
const V2 = ['l1', 'l5', 'l6'];

describe('démonstrations : légalité', () => {
  for (const l of LESSONS) l.steps.forEach((s, i) => {
    if (s.kind !== 'info' || !s.demo) return;
    it(`${l.id}.${i + 1} : chaque temps se joue selon les règles`, () => {
      const images = imagesDemo(s.rows, s.demo!);
      expect(images.length).toBeGreaterThan(1);
      // Chaque pose est un coup légal depuis l'image précédente (imagesDemo lève sinon) ; on rejoue pour le prouver.
      for (const t of s.demo!) if ('pose' in t) expect(t.pose).toMatch(/^[A-HJ][1-9]$/);
    });
  });
  it('imagesDemo refuse un coup illégal et un faux interdit', () => {
    const rows = fromRowsYeux();
    expect(() => imagesDemo(rows, [{ pose: 'A1', couleur: 'W' }])).toThrow(/suicide/);
    expect(() => imagesDemo(rows, [{ interdit: 'H8', couleur: 'W' }])).toThrow(/légal/);
  });
});

function fromRowsYeux() { return step('l5', 0).rows; }

describe('démonstrations : ce que montre l’image', () => {
  it('l1.1 : quatre libertés s’allument une à une, compteur 1 à 4', () => {
    const s = step('l1', 0) as Info;
    const im = imagesDemo(s.rows, s.demo!);
    expect(im.slice(-4).map(x => x.compteur?.n)).toEqual([1, 2, 3, 4]);
    expect(labels(im.at(-1)!.libs)).toEqual(['D5', 'E4', 'E6', 'F5']);
  });
  it('l1.3 : le compteur baisse 4, 3, 2, 1, puis l’atari clignote ; la position finale est celle de la question', () => {
    const s = step('l1', 2) as Info;
    const im = imagesDemo(s.rows, s.demo!);
    expect(im.slice(-4).map(x => x.compteur?.n)).toEqual([4, 3, 2, 1]);
    expect(labels(im.at(-1)!.atari)).toEqual(['D5']);
    expect(labels(im.at(-1)!.libs)).toEqual(['E5']);
    expect(im.at(-1)!.board).toEqual(fromRows(step('l1', 3).rows).pos.board);
  });
  it('l1.5 : le groupe n’a qu’une liberté, en E4, celle de la question suivante', () => {
    expect(labels(fin('l1', 4).libs)).toEqual(['E4']);
    expect(labels(fin('l1', 4).atari)).toEqual(['D5', 'E5']);
    const r = play(fromRows(step('l1', 5).rows).pos, at('E4'));
    expect(typeof r !== 'string' && r.captures[1]).toBe(2);
  });
  it('l5.1 et l5.3 : les yeux marqués sont A1 et C1', () => {
    expect(labels(fin('l5', 0).yeux)).toEqual(['A1', 'C1']);
    expect(labels(fin('l5', 2).yeux)).toEqual(['A1', 'C1']);
  });
  it('l5.2 : Blanc ne peut jouer ni en A1 ni en C1 (suicide)', () => {
    const { pos } = fromRows(step('l5', 1).rows, 2);
    for (const e of ['A1', 'C1']) expect(play(pos, at(e))).toBe('suicide');
    expect(toLabel(fin('l5', 1).interdit!, N)).toBe('C1');
  });
});

describe('textes : 12 mots au plus', () => {
  it('compte les mots hors parenthèses et ponctuation', () => {
    expect(mots("Plus qu'une : c'est l'atari (une liberté) !")).toBe(4);
  });
  for (const l of LESSONS.filter(x => V2.includes(x.id))) l.steps.forEach((s, i) => {
    it(`${l.id}.${i + 1} : « ${s.text} »`, () => expect(mots(s.text)).toBeLessThanOrEqual(12));
  });
});
