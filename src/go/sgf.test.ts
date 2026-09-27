import { readSgf, writeSgf, type GameRecord } from './sgf';
import { replay, initialPosition } from './replay';
import { fromLabel, fromSgf, toLabel, toSgf, LETTERS } from './coords';
import { boardKey, handicapPoints, newPosition } from './rules';

const at = (l: string, size = 19) => fromLabel(l, size);
const rec = (moves: [1 | 2, string][], extra: Partial<GameRecord> = {}): GameRecord => ({
  size: 9, komi: 6.5, rules: 'japanese', setupBlack: [], setupWhite: [], ...extra,
  moves: moves.map(([color, l]) => ({ color, p: fromLabel(l, extra.size ?? 9) }))
});

describe('coordonnées', () => {
  it('saute la lettre I et numérote depuis le bas', () => {
    expect(LETTERS).toHaveLength(19);
    expect(LETTERS).not.toContain('I');
    expect(toLabel(at('T19'), 19)).toBe('T19');
    expect(at('T19')).toBe(18);
    expect(at('A1')).toBe(18 * 19);
    expect(at('j10')).toBe(9 * 19 + 8);
    expect(toLabel(-1, 19)).toBe('passe');
    expect(fromLabel('passe', 9)).toBe(-1);
  });
  it('refuse les coordonnées hors plateau', () => {
    for (const l of ['I5', 'K5', 'A0', 'A10', 'Z3', '', 'A', 'B2.5']) expect(() => fromLabel(l, 9)).toThrow();
  });
  it('SGF : aller-retour sur tout le plateau, tt = passe', () => {
    for (const size of [9, 13, 19]) for (let p = 0; p < size * size; p++) expect(fromSgf(toSgf(p, size), size)).toBe(p);
    expect(toSgf(-1, 19)).toBe('tt');
    expect(toSgf(at('A1'), 19)).toBe('as');
    expect(fromSgf('', 9)).toBe(-1);
    expect(fromSgf('jj', 9)).toBe(-1);
  });
});

describe('SGF', () => {
  it('écrit les passes en tt et relit [] comme [tt]', () => {
    const g = rec([[1, 'E5'], [2, 'passe'], [1, 'passe']]);
    const s = writeSgf(g);
    expect(s).toContain(';W[tt];B[tt]');
    expect(s).not.toContain('[]');
    expect(readSgf(s).moves).toEqual(g.moves);
    expect(readSgf('(;SZ[19];B[pd];W[];B[tt])').moves.map(m => m.p)).toEqual([at('Q16'), -1, -1]);
  });
  it('conserve handicap, pierres posées, trait, noms échappés et résultat', () => {
    const g: GameRecord = {
      size: 19, komi: 0.5, rules: 'chinese', black: 'Léa [1d]', white: 'Sensei \\ IA', result: 'W+R', handicap: 4, toPlay: 2,
      setupBlack: handicapPoints(19, 4), setupWhite: [], moves: [{ color: 2, p: at('C3') }, { color: 1, p: at('D3') }]
    };
    const s = writeSgf(g);
    expect(s).toContain('HA[4]');
    expect(s).toContain('AB[pd][dp][pp][dd]');
    expect(s).toContain('PL[W]');
    expect(readSgf(s)).toEqual(g);
  });
  it('lit un vrai fichier : espaces, commentaires, sauts de ligne doux, variantes', () => {
    const text = `
      (;GM[1]FF[4]CA[UTF-8]AP[CGoban:3]ST[2]
        RU[AGA]SZ[13]KM[7.50]
        PW[Blanc]PB[Noir]C[Partie \\
d'essai : \\] fermé]
        AB[dd] [jj]
        AW[gg]
        PL[b]
        ;B[dj]C[bon]
        (;W[jd];B[cc])
        (;W[aa]))`;
    const g = readSgf(text);
    expect(g.size).toBe(13);
    expect(g.komi).toBe(7.5);
    expect(g.rules).toBe('chinese');
    expect(g.toPlay).toBe(1);
    expect(g.setupBlack.map(p => toLabel(p, 13))).toEqual(['D10', 'K4']);
    expect(g.setupWhite.map(p => toLabel(p, 13))).toEqual(['G7']);
    expect(g.moves.map(m => toLabel(m.p, 13))).toEqual(['D4', 'K10', 'C11']);
    expect(g.handicap).toBeUndefined();
  });
  it('valeurs par défaut et erreurs', () => {
    const g = readSgf('(;GM[1];B[dd])');
    expect(g.size).toBe(19);
    expect(g.komi).toBe(6.5);
    expect(g.rules).toBe('japanese');
    expect(readSgf('(;SZ[9]KM[abc]PL[W])').komi).toBe(6.5);
    expect(readSgf('(;SZ[9]KM[abc]PL[W])').toPlay).toBe(2);
    expect(readSgf('(;B[aa])').moves).toEqual([{ color: 1, p: 0 }]); // coup dans le nœud racine
    expect(() => readSgf('bonjour')).toThrow();
    expect(() => readSgf('()')).toThrow('Aucun nœud');
    expect(() => readSgf('(;SZ[15])')).toThrow('non pris en charge');
    expect(() => readSgf('(;SZ[9];B[zz])')).toThrow('Coup SGF invalide');
    expect(() => readSgf('(;SZ[9];B[a])')).toThrow('Coup SGF invalide');
  });
});

describe('rejouer une partie', () => {
  it('rejoue une partie valide jusqu’aux deux passes', () => {
    const g = readSgf('(;SZ[9]KM[6.5];B[ee];W[gc];B[cg];W[gg];B[tt];W[])');
    const r = replay(g);
    if (!r.ok) throw new Error(r.error);
    expect(r.passes).toBe(2);
    expect(r.pos.board[at('E5', 9)]).toBe(1);
    expect(r.pos.lastMove).toBe(-1);
  });
  it('signale le coup illégal et son index', () => {
    const occ = replay(rec([[1, 'E5'], [2, 'E5']]));
    expect(occ).toMatchObject({ ok: false, index: 1, error: 'occupe' });
    const sui = replay(rec([[1, 'B9'], [2, 'E5'], [1, 'A8'], [2, 'A9']]));
    expect(sui).toMatchObject({ ok: false, index: 3, error: 'suicide' });
    if (!sui.ok) expect(sui.pos.board[at('A8', 9)]).toBe(1);
    const ko = replay(rec([[1, 'F5'], [2, 'E5']], {
      setupBlack: ['E6', 'D5', 'E4'].map(l => at(l, 9)), setupWhite: ['F6', 'E5', 'G5', 'F4'].map(l => at(l, 9)), toPlay: 1
    }));
    expect(ko).toMatchObject({ ok: false, index: 1, error: 'ko' });
    const out = replay({ ...rec([]), moves: [{ color: 1, p: 81 }] });
    expect(out).toMatchObject({ ok: false, index: 0, error: 'hors-plateau' });
  });
  it('vérifie l’alternance des couleurs, sauf si on la désactive', () => {
    const g = rec([[1, 'E5'], [1, 'D5']]);
    expect(replay(g)).toMatchObject({ ok: false, index: 1, error: 'tour' });
    expect(replay(g, { strictTurns: false }).ok).toBe(true);
    expect(replay(rec([[2, 'E5']]))).toMatchObject({ ok: false, index: 0, error: 'tour' });
  });
  it('après un handicap, Blanc commence', () => {
    const g = rec([[2, 'C3'], [1, 'D3']], { size: 19, setupBlack: handicapPoints(19, 2), handicap: 2 });
    const r = replay(g);
    expect(r.ok).toBe(true);
    expect(initialPosition(g)?.toPlay).toBe(2);
  });
  it('refuse des pierres d’installation en double', () => {
    const g = rec([], { setupBlack: [at('E5', 9)], setupWhite: [at('E5', 9)] });
    expect(initialPosition(g)).toBeNull();
    expect(replay(g)).toMatchObject({ ok: false, index: -1, error: 'installation' });
  });
  it('superko en option : le triple ko est refusé au sixième coup', () => {
    // Trois ko côte à côte sur 19 × 19, rangée 11. Noir tient le premier, Blanc les deux autres.
    const N = 19, oy = 6, offs = [0, 6, 12], B: number[] = [], W: number[] = [];
    offs.forEach((ox, k) => {
      const p = (x: number, y: number) => (y + oy) * N + x + ox;
      B.push(p(4, 3), p(3, 4), p(4, 5)); W.push(p(5, 3), p(6, 4), p(5, 5));
      if (k === 0) B.push(p(5, 4)); else W.push(p(4, 4));
    });
    const koB = (k: number) => (4 + oy) * N + 5 + offs[k], koW = (k: number) => (4 + oy) * N + 4 + offs[k];
    const cycle = [koB(1), koW(0), koB(2), koW(1), koB(0), koW(2)];
    const g: GameRecord = { size: 19, komi: 7, rules: 'chinese', setupBlack: B, setupWhite: W, toPlay: 1, moves: cycle.map((p, i) => ({ color: i % 2 ? 2 : 1, p })) };
    const simple = replay(g);
    if (!simple.ok) throw new Error(simple.error);
    expect(boardKey(simple.pos.board)).toBe(boardKey(initialPosition(g)!.board));
    expect(replay(g, { superko: true })).toMatchObject({ ok: false, index: 5, error: 'superko' });
    expect(replay(readSgf(writeSgf(g)), { superko: true })).toMatchObject({ ok: false, index: 5 });
  });
  it('position de départ vide pour un plateau sans installation', () => {
    expect(initialPosition(rec([]))).toEqual(newPosition(9));
  });
});
