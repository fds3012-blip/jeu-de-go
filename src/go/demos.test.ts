// Leçons v2 (issue #101) : chaque démonstration est légale selon src/go, chaque question a la réponse annoncée,
// et chaque texte d'étape tient en 12 mots (hors vocabulaire entre parenthèses).
import { LESSONS, type LessonStep } from '../content/lessons';
import { imageDuGeste, imagesDemo, mots } from '../content/demo';
import { fromRows } from './position';
import { groupAt, neighbors, play } from './rules';
import { fromLabel, toLabel } from './coords';

const N = 9;
const at = (l: string) => fromLabel(l, N);
type Info = Extract<LessonStep, { kind: 'info' }>;
const step = (id: string, i: number) => LESSONS.find(l => l.id === id)!.steps[i];
const fin = (id: string, i: number) => { const s = step(id, i) as Info; return imagesDemo(s.rows, s.demo!, s.avant).at(-1)!; };
const suite = (id: string, i: number) => { const s = step(id, i) as Info; return imagesDemo(s.rows, s.demo!, s.avant); };
const labels = (ps: number[]) => ps.map(p => toLabel(p, N)).sort();
/** Leçons déjà réécrites « l'image d'abord ». */
const V2 = LESSONS.map(l => l.id);

describe('démonstrations : légalité', () => {
  for (const l of LESSONS) l.steps.forEach((s, i) => {
    if (s.kind !== 'info' || !s.demo) return;
    it(`${l.id}.${i + 1} : chaque temps se joue selon les règles`, () => {
      const images = imagesDemo(s.rows, s.demo!, s.avant);
      expect(images.length).toBeGreaterThan(1);
      // Chaque pose est un coup légal depuis l'image précédente (imagesDemo lève sinon) ; on rejoue pour le prouver.
      // #16 : les leçons de 13 × 13 et 19 × 19 nomment leurs points sur leur plateau (A à T sans I, 1 à 19).
      for (const t of s.demo!) if ('pose' in t) expect(fromLabel(t.pose, s.rows.length), t.pose).toBeGreaterThanOrEqual(0);
    });
  });
  it('imagesDemo refuse une zone sur une pierre (#228)', () => {
    expect(() => imagesDemo(step('l8', 0).rows, [{ zone: ['C4'] }])).toThrow(/pas vide/);
    expect(imagesDemo(step('l8', 0).rows, [{ zone: ['A1', 'B1'] }]).at(-1)!.yeux).toHaveLength(2);
  });
  it('leçon 8 : une seule étape sur six sans geste au plus (#228)', () => {
    const l8 = LESSONS.find(l => l.id === 'l8')!;
    expect(l8.steps.length).toBeLessThanOrEqual(6);
    expect(l8.steps.filter(s => s.kind === 'info' && !s.geste).length).toBeLessThanOrEqual(1);
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

describe('leçons 2 à 4 : ce que montre l’image', () => {
  it('l2.1 : la pierre blanche passe de 2 libertés à 1, en atari ; la position finale est celle de l’étape 2', () => {
    const im = suite('l2', 0);
    expect(im.at(-1)!.compteur?.n).toBe(1);
    expect(labels(im.at(-1)!.atari)).toEqual(['E5']);
    expect(im.at(-1)!.board).toEqual(fromRows(step('l2', 1).rows).pos.board);
  });
  it('l2.2 : Noir capture en F5', () => {
    expect(fin('l2', 1).board[at('E5')]).toBe(0);
  });
  it('l2.3 : s’allonger fait passer de 1 à 3 libertés ; la question (position miroir) a la même réponse, D4 → 3 libertés', () => {
    expect(suite('l2', 2).slice(-2).map(x => x.compteur?.n)).toEqual([1, 3]);
    const q = fromRows(step('l2', 3).rows);
    const r = play(q.pos, at('D4'));
    expect(typeof r !== 'string' && groupAt(r.board, N, q.marked[0]).liberties.size).toBe(3);
  });
  it('l2.5 : s’allonger en E6 laisse une seule liberté', () => {
    expect(fin('l2', 4).compteur?.n).toBe(1);
    expect(labels(fin('l2', 4).atari)).toEqual(['E5', 'E6']);
  });
  it('l3.1 et l3.2 : double atari, Blanc sauve D5, Noir prend F5', () => {
    expect(labels(fin('l3', 0).atari)).toEqual(['D5', 'F5']);
    const f = fin('l3', 1);
    expect(f.board[at('D5')]).toBe(2);
    expect(f.board[at('F5')]).toBe(0);
    expect(groupAt(f.board, N, at('D5')).liberties.size).toBe(3);
  });
  it('l3.4 : poussée vers le bord, la pierre s’allonge et meurt quand même (3 pierres prises)', () => {
    const f = fin('l3', 3);
    for (const l of ['C2', 'C1', 'D1']) expect(f.board[at(l)], l).toBe(0);
  });
  it('l3.6 et l3.7 : l’échelle garde 1 ou 2 libertés à chaque coup, puis prend 8 pierres au bord', () => {
    const tout = [...suite('l3', 5).slice(1), ...suite('l3', 6).slice(1)];
    for (const x of tout) if (x.compteur) expect(x.compteur.n).toBeLessThanOrEqual(2);
    const f = fin('l3', 6);
    expect(['E5', 'E4', 'F4', 'F3', 'G3', 'G2', 'G1', 'H1'].every(l => f.board[at(l)] === 0)).toBe(true);
    expect(f.board.filter(c => c === 2)).toHaveLength(0);
  });
  it('l4.1 à l4.3 : Noir prend, la reprise immédiate est barrée (ko), puis permise après deux coups ailleurs', () => {
    expect(fin('l4', 0).compteur?.n).toBe(1);
    expect(toLabel(fin('l4', 1).interdit!, N)).toBe('E5');
    const f = fin('l4', 2);
    expect(f.board[at('E5')]).toBe(2);
    expect(f.board[at('D5')]).toBe(0);
  });
  it('l4.5 : la question « touche » a pour réponse le point de ko', () => {
    const s = step('l4', 4) as Extract<LessonStep, { kind: 'touche' }>;
    const r = play(fromRows(step('l4', 3).rows).pos, at('F5'));
    if (typeof r === 'string') throw new Error(r);
    expect(r.board).toEqual(fromRows(s.rows).pos.board);
    expect(s.accept.map(at)).toEqual([r.ko]);
    expect(play(r, at('E5'))).toBe('ko');
  });
});

// Issue #198 : jouer dès le premier écran. Chaque geste de démonstration est vérifié avec src/go.
describe('gestes : l’élève joue dans la démonstration (#198)', () => {
  const avecGeste = LESSONS.flatMap(l => l.steps.map((s, i) => ({ id: `${l.id}.${i + 1}`, s })))
    .filter(x => x.s.kind === 'info' && x.s.geste) as { id: string; s: Info }[];

  it('au plus 35 % des étapes sans geste, et la leçon 1 commence par une pierre à poser', () => {
    const toutes = LESSONS.flatMap(l => l.steps);
    const sansGeste = toutes.filter(s => s.kind === 'info' && !s.geste);
    expect(sansGeste.length / toutes.length).toBeLessThanOrEqual(0.35);
    const premiere = step('l1', 0) as Info;
    expect(premiere.geste).toEqual({ pose: 'E5' });
    expect(imageDuGeste(premiere.rows, premiere.demo!, premiere.avant, premiere.geste!)).toBe(0);
  });

  for (const { id, s } of avecGeste) {
    const g = s.geste!;
    if ('pose' in g) it(`${id} : la pierre à poser (${g.pose}) est un coup noir légal de la démonstration, montré en vert`, () => {
      const im = imagesDemo(s.rows, s.demo!, s.avant);
      const k = imageDuGeste(s.rows, s.demo!, s.avant, g);
      const attente = im[k];
      const ici = (l: string) => fromLabel(l, s.rows.length);
      expect(attente.board[ici(g.pose)]).toBe(0);
      // Le coup de l'élève, rejoué avec src/go depuis l'image d'attente, donne l'image suivante de la démonstration.
      const r = play({ ...fromRows(s.rows).pos, board: attente.board.slice(), toPlay: 1, ko: -1 }, ici(g.pose));
      if (typeof r === 'string') throw new Error(r);
      expect(r.board).toEqual(im[k + 1].board);
      expect(im[k + 1].derniere).toBe(ici(g.pose));
      expect(s.text).toContain('point vert');
    });
    else it(`${id} : on touche avant la démonstration, et l’aide tient en 12 mots`, () => {
      expect(imageDuGeste(s.rows, s.demo!, s.avant, g)).toBe(0);
      expect(g.touche.length).toBeGreaterThan(0);
      expect(mots(g.no)).toBeLessThanOrEqual(12);
    });
  }

  it('l1.5 : les points à toucher sont exactement les pierres du groupe blanc, dont la démo montre la liberté', () => {
    const s = step('l1', 4) as Info;
    const g = s.geste as { touche: string[] };
    const { pos } = fromRows(s.rows);
    expect(labels(groupAt(pos.board, N, at('D5')).stones)).toEqual([...g.touche].sort());
    expect(g.touche.every(l => pos.board[at(l)] === 2)).toBe(true);
  });
  it('l5.1 : les points à toucher sont les deux yeux, vides et entourés par le seul groupe noir', () => {
    const s = step('l5', 0) as Info;
    const g = s.geste as { touche: string[] };
    const { pos } = fromRows(s.rows);
    const groupe = new Set(groupAt(pos.board, N, at('B2')).stones);
    expect([...g.touche].sort()).toEqual(labels(fin('l5', 0).yeux));
    for (const e of g.touche) {
      expect(pos.board[at(e)]).toBe(0);
      for (const q of neighbors(N)[at(e)]) expect(groupe.has(q), `${e} → ${toLabel(q, N)}`).toBe(true);
    }
  });
  it('l1.3 : l’élève pose D6 après les 4 libertés allumées ; la suite baisse le compteur 3, 2, 1', () => {
    const s = step('l1', 2) as Info;
    const k = imageDuGeste(s.rows, s.demo!, s.avant, s.geste!);
    const im = imagesDemo(s.rows, s.demo!);
    expect(im[k].compteur?.n).toBe(4);
    expect(im.slice(k + 1).map(x => x.compteur?.n)).toEqual([3, 2, 1]);
  });
  it('l3.2 : avec `avant`, l’attente vient après la réponse blanche D4, et l’élève prend F5', () => {
    const s = step('l3', 1) as Info;
    const k = imageDuGeste(s.rows, s.demo!, s.avant, s.geste!);
    const im = imagesDemo(s.rows, s.demo!, s.avant);
    expect(k).toBe(1);
    expect(im[k].derniere).toBe(at('D4'));
    expect(im[k + 1].board[at('F5')]).toBe(0);
  });
  it('imageDuGeste refuse une pierre absente ou blanche', () => {
    expect(() => imageDuGeste(step('l1', 0).rows, [{ pose: 'E5', couleur: 'W' }], [], { pose: 'E5' })).toThrow(/noire/);
    expect(() => imageDuGeste(step('l1', 0).rows, [{ pose: 'E5', couleur: 'B' }], [], { pose: 'D4' })).toThrow(/noire/);
  });
});
