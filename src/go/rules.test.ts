import { newPosition, play, groupAt, type Position } from './rules';
import { fromRows } from './position';
import { fromLabel, toLabel, toSgf, fromSgf } from './coords';
import { score } from './score';
import { readSgf, writeSgf } from './sgf';

const at = (l: string, size = 9) => fromLabel(l, size);
function seq(pos: Position, labels: string[]): Position {
  for (const l of labels) {
    const r = play(pos, l === 'passe' ? -1 : at(l, pos.size));
    if (typeof r === 'string') throw new Error(`${l} : ${r}`);
    pos = r;
  }
  return pos;
}

describe('coordonnées', () => {
  it('convertit dans les deux sens, sans la lettre I', () => {
    expect(toLabel(at('J9'), 9)).toBe('J9');
    expect(toLabel(at('A1'), 9)).toBe('A1');
    expect(at('A9')).toBe(0);
    expect(toSgf(at('A9'), 9)).toBe('aa');
    expect(fromSgf('tt', 19)).toBe(-1);
  });
});

describe('captures et coups interdits', () => {
  it('capture une pierre en atari', () => {
    const { pos } = fromRows(['.........', '.........', '.........', '...X.....', '..XO.....', '...X.....', '.........', '.........', '.........']);
    const r = play(pos, at('E5'));
    if (typeof r === 'string') throw new Error(r);
    expect(r.board[at('D5')]).toBe(0);
    expect(r.captures[1]).toBe(1);
  });
  it('refuse le suicide et une intersection occupée', () => {
    const { pos } = fromRows(['.X.......', 'X........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'], 2);
    expect(play(pos, at('A9'))).toBe('suicide');
    expect(play(pos, at('B9'))).toBe('occupe');
  });
  it('interdit de reprendre un ko immédiatement', () => {
    const { pos } = fromRows(['.........', '.........', '.........', '....XO...', '...XO.O..', '....XO...', '.........', '.........', '.........']);
    const r = play(pos, at('F5'));
    if (typeof r === 'string') throw new Error(r);
    expect(r.captures[1]).toBe(1);
    expect(play(r, at('E5'))).toBe('ko');
    const later = seq(r, ['A1', 'B1']);
    expect(typeof play(later, at('E5'))).not.toBe('string');
  });
  it('capture un groupe entier', () => {
    const { pos } = fromRows(['.........', '.........', '.........', '...XX....', '..XOOX...', '...X.....', '.........', '.........', '.........']);
    const r = play(pos, at('E4'));
    if (typeof r === 'string') throw new Error(r);
    expect(r.captures[1]).toBe(2);
    expect(groupAt(r.board, 9, at('E4')).stones.length).toBe(2); // E4 se relie à D4
  });
  it('gère le handicap : Blanc commence', () => {
    expect(newPosition(9, [20, 60]).toPlay).toBe(2);
  });
});

describe('comptage', () => {
  it('compte territoire et komi', () => {
    const { pos } = fromRows(Array(9).fill('...XO....'));
    const jp = score(pos, 6.5, 'japanese');
    expect(jp.territory[1]).toBe(27);
    expect(jp.territory[2]).toBe(36);
    expect(jp.winner).toBe(2);
    expect(jp.margin).toBe(15.5);
    expect(score(pos, 7.5, 'chinese').black).toBe(36);
  });
  it('retire les pierres mortes et les compte comme prisonniers', () => {
    const { pos } = fromRows(Array(8).fill('...XO....').concat(['...XO..X.']));
    const s = score(pos, 6.5, 'japanese', new Set([at('H1')]));
    expect(s.territory[2]).toBe(36);
    expect(s.white).toBe(36 + 1 + 6.5);
  });
});

describe('SGF', () => {
  it('écrit puis relit une partie', () => {
    const g = { size: 9, komi: 6.5, rules: 'japanese' as const, black: 'Florian', white: 'Pomme', setupBlack: [], setupWhite: [], moves: [{ color: 1 as const, p: at('E5') }, { color: 2 as const, p: -1 }] };
    const back = readSgf(writeSgf(g));
    expect(back.black).toBe('Florian');
    expect(back.moves).toEqual(g.moves);
  });
  it('suit la ligne principale et ignore les variantes', () => {
    const g = readSgf('(;GM[1]SZ[9]KM[7]RU[Chinese];B[ee];W[gc](;B[cg];W[gg])(;B[aa]))');
    expect(g.moves.map(m => toLabel(m.p, 9))).toEqual(['E5', 'G7', 'C3', 'G3']);
    expect(g.rules).toBe('chinese');
    expect(g.komi).toBe(7);
  });
});
