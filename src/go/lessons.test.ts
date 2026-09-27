import { LESSONS } from '../content/lessons';
import { fromRows } from './position';
import { play } from './rules';
import { fromLabel } from './coords';
import { score } from './score';

describe('leçons', () => {
  for (const lesson of LESSONS) {
    it(`${lesson.id} : chaque bonne réponse est un coup légal`, () => {
      for (const step of lesson.steps) {
        const { pos } = fromRows(step.rows);
        if (step.kind === 'move' && step.accept !== 'line3') {
          for (const a of step.accept) expect(typeof play(pos, fromLabel(a, 9))).not.toBe('string');
        }
        if (step.kind === 'quiz' && step.terr) {
          expect(String(score(pos, 0, 'japanese').territory[1])).toBe(step.choices[step.answer]);
        }
      }
    });
  }
  it('la leçon 1 capture bien la pierre marquée', () => {
    const step = LESSONS[0].steps[1];
    const { pos, marked } = fromRows(step.rows);
    const r = play(pos, fromLabel('E5', 9));
    if (typeof r === 'string') throw new Error(r);
    expect(r.board[marked[0]]).toBe(0);
  });
});
