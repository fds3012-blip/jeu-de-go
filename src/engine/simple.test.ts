import { play, newPosition, type Position } from '../go/rules';
import { fromRows } from '../go/position';
import { fromLabel } from '../go/coords';
import { chooseMove, isEye, OPPONENTS } from './simple';
import { bestMove } from './index';

const at = (l: string, size = 9) => fromLabel(l, size);

describe('moteur simple', () => {
  it('expose Pomme et Caillou', () => {
    expect(OPPONENTS.map(o => o.id)).toEqual(['pomme', 'caillou']);
    for (const o of OPPONENTS) expect(o.description.length).toBeGreaterThan(10);
  });

  it('capture une pierre en atari évidente', () => {
    // La pierre blanche en E5 n'a plus qu'une liberté, en F5.
    const { pos } = fromRows(['.........', '.........', '.........', '....X....', '...XO....', '....X....', '.........', '.........', '.........'], 1);
    for (const seed of [1, 2, 3]) expect(chooseMove(pos, 'caillou', { seed })).toBe(at('F5'));
  });

  it('sauve son groupe en atari', () => {
    // Blanc au trait : ses deux pierres D5-E5 sont en atari, la seule sortie est F5.
    const { pos } = fromRows(['.........', '.........', '.........', '...XX....', '..XOO....', '...XX....', '.........', '.........', '.........'], 2);
    for (const seed of [1, 2, 3]) expect(chooseMove(pos, 'caillou', { seed })).toBe(at('F5'));
  });

  it('ne remplit pas son propre œil et passe quand il ne reste rien à jouer', () => {
    // Blanc vivant à deux yeux (A9 et C9) ; Noir vivant à deux yeux (F8 et G3).
    const rows = [
      '.O.OXXXXX',
      'OOOOX.XXX',
      'OOOOXXXXX',
      'OOOOXXXXX',
      'OOOOXXXXX',
      'OOOOXXXXX',
      'OOOOXX.XX',
      'OOOOXXXXX',
      'OOOOXXXXX',
    ];
    const { pos } = fromRows(rows, 2);
    expect(isEye(pos.board, 9, at('A9'), 2)).toBe(true);
    expect(chooseMove(pos, 'caillou', { seed: 4 })).toBe(-1);
    expect(chooseMove(pos, 'pomme', { seed: 4 })).toBe(-1);
  });

  it('ne remplit jamais un œil, même quand d’autres coups existent', () => {
    const { pos } = fromRows(['.O.O.....', 'OOOO.....', '.........', '.........', '.........', '.........', '.........', '.........', '.........'], 2);
    for (const seed of [1, 2, 3, 4, 5]) {
      const m = chooseMove(pos, 'pomme', { seed });
      expect(m).not.toBe(at('A9'));
      expect(m).not.toBe(at('C9'));
    }
  });

  it('ne joue que des coups légaux, en moins d’une seconde en 9 × 9', async () => {
    let pos: Position = newPosition(9);
    for (let i = 0; i < 12; i++) {
      const t0 = performance.now();
      const m = await bestMove(pos, i % 2 ? 'pomme' : 'caillou', { seed: i + 1 });
      expect(performance.now() - t0).toBeLessThan(1000);
      const r = play(pos, m);
      expect(typeof r).not.toBe('string');
      pos = r as Position;
    }
  });

  it('une partie ordi contre ordi en 9 × 9 se termine par deux passes', () => {
    let pos: Position = newPosition(9), passes = 0, n = 0;
    while (passes < 2) {
      const m = chooseMove(pos, n % 2 ? 'pomme' : 'caillou', { seed: n + 7, timeMs: 60, playouts: 400 });
      const r = play(pos, m);
      if (typeof r === 'string') throw new Error(`coup illégal ${m} : ${r}`);
      passes = m === -1 ? passes + 1 : 0;
      pos = r; n++;
      expect(n).toBeLessThan(400);
    }
    expect(pos.lastMove).toBe(-1);
  }, 60000);
});
