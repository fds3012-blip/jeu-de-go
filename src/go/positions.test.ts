// Positions réelles : échelle (shicho), ko, triple ko et superko, seki, retour de capture (snapback).
import { canEscape as escapes, ladderWorks } from './tactics';
import { boardKey, groupAt, handicapPoints, isLegal, newPosition, play, playSuperko, type Position } from './rules';
import { fromRows } from './position';
import { fromLabel, toLabel } from './coords';
import { findSeki, score } from './score';

const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const libs = (pos: Position, p: number) => groupAt(pos.board, pos.size, p).liberties;

describe('échelle (shicho)', () => {
  // Pierre blanche en Q16, entourée par Noir : l'échelle part vers le coin en bas à gauche.
  const rows = (breaker: boolean) => Array.from({ length: 19 }, (_, y) => [...Array(19)].map((_, x) => {
    if ((x === 15 && y === 2) || (x === 14 && y === 3) || (x === 16 && y === 4)) return 'X';
    if (x === 15 && y === 3) return 'O';
    if (breaker && x === 4 && y === 14) return 'O';
    return '.';
  }).join(''));
  const target = 3 * 19 + 15;

  it('fonctionne sur un plateau vide et capture au bord', () => {
    const { pos } = fromRows(rows(false));
    expect(ladderWorks(pos, target)).toBe(true);
    // On la joue vraiment : Noir met en atari du bon côté, Blanc s'allonge, jusqu'à la capture.
    let p = ok(play(pos, fromLabel('R16', 19)));
    let moves = 1;
    while (p.board[target]) {
      p = ok(play(p, [...libs(p, target)][0])); // Blanc s'allonge
      const l = [...libs(p, target)];
      expect(l.length).toBeLessThanOrEqual(2);
      const atari = l.find(m => { const r = play(p, m); return typeof r !== 'string' && (r.board[target] === 0 || (libs(r, target).size === 1 && !escapes(r, target, 0))); })!;
      p = ok(play(p, atari));
      moves += 2;
    }
    expect(p.captures[1]).toBeGreaterThan(20);
    expect(moves).toBeGreaterThan(20);
  });
  it('échoue avec une pierre blanche sur le chemin (casseur d’échelle)', () => {
    const atari = (b: boolean) => ok(play(fromRows(rows(b)).pos, fromLabel('R16', 19)));
    expect(escapes(atari(false), target, 0)).toBe(false);
    expect(escapes(atari(true), target, 0)).toBe(true);
  });
});

describe('ko', () => {
  const koRows = ['.........', '.........', '.........', '....XO...', '...XO.O..', '....XO...', '.........', '.........', '.........'];
  it('Blanc reprend après une menace ailleurs, et Noir à son tour', () => {
    const { pos } = fromRows(koRows);
    let p = ok(play(pos, fromLabel('F5', 9)));
    expect(p.ko).toBe(fromLabel('E5', 9));
    expect(isLegal(p, fromLabel('E5', 9))).toBe(false);
    p = ok(play(p, fromLabel('A1', 9))); // menace
    p = ok(play(p, fromLabel('B1', 9))); // réponse
    p = ok(play(p, fromLabel('E5', 9))); // Blanc reprend
    expect(p.captures[2]).toBe(1);
    expect(play(p, fromLabel('F5', 9))).toBe('ko');
    const after = ok(play(ok(play(p, -1)), -1));
    expect(after.ko).toBe(-1);
    expect(isLegal(after, fromLabel('F5', 9))).toBe(true);
  });
  it('capturer deux pierres n’est pas un ko', () => {
    const { pos: p2 } = fromRows(['.........', '.........', '....X....', '...XOX...', '...XO.O..', '....XO...', '.........', '.........', '.........']);
    const r2 = ok(play(p2, fromLabel('F5', 9)));
    expect(r2.captures[1]).toBe(2);
    expect(r2.ko).toBe(-1);
  });
  it('retour de capture (snapback) : la reprise immédiate est permise', () => {
    // Noir se sacrifie en B1, Blanc capture en A1, Noir reprend aussitôt en B1 tout le groupe : ce n'est pas un ko.
    const { pos } = fromRows(['.........', '.........', '.........', '.........', '.........', '.........', 'XXXX.....', 'OOOX.....', '..OX.....']);
    const sac = ok(play(pos, fromLabel('B1', 9)));
    const take = ok(play(sac, fromLabel('A1', 9)));
    expect(take.captures[2]).toBe(1);
    expect(take.ko).toBe(-1);
    const back = ok(play(take, fromLabel('B1', 9)));
    expect(back.captures[1]).toBe(5);
  });
});

describe('superko positionnel', () => {
  // Trois ko indépendants : Noir et Blanc peuvent tourner en rond sans jamais violer le ko simple.
  const N = 19, oy = 6, offs = [0, 6, 12];
  function tripleKo(): Position {
    const pos = newPosition(N);
    offs.forEach((ox, k) => {
      const set = (x: number, y: number, c: 1 | 2) => { pos.board[(y + oy) * N + x + ox] = c; };
      set(4, 3, 1); set(3, 4, 1); set(4, 5, 1); set(5, 3, 2); set(6, 4, 2); set(5, 5, 2);
      if (k === 0) set(5, 4, 1); else set(4, 4, 2);
    });
    return pos;
  }
  const koB = (k: number) => (4 + oy) * N + 5 + offs[k], koW = (k: number) => (4 + oy) * N + 4 + offs[k];
  const cycle = [koB(1), koW(0), koB(2), koW(1), koB(0), koW(2)];

  it('le ko simple laisse la position se répéter', () => {
    let p = tripleKo();
    const start = boardKey(p.board);
    for (const m of cycle) p = ok(play(p, m));
    expect(boardKey(p.board)).toBe(start);
    expect(p.toPlay).toBe(1);
  });
  it('le superko refuse le coup qui recrée la position de départ', () => {
    let p = tripleKo();
    const seen = new Set([boardKey(p.board)]);
    for (const m of cycle.slice(0, 5)) { p = ok(playSuperko(p, m, seen)); seen.add(boardKey(p.board)); }
    expect(playSuperko(p, cycle[5], seen)).toBe('superko');
    expect(typeof playSuperko(p, -1, seen)).not.toBe('string'); // passer reste permis
    expect(playSuperko(p, koW(2) - 1, seen)).toBe('occupe');
  });
});

describe('seki', () => {
  // 9 × 9 : groupes intérieurs sans œil, deux libertés partagées en E9 et E8.
  const seki9 = ['..OX.OX..', '..OX.OX..', ...Array(7).fill('..OXXOX..')];
  // 13 × 13 : chaque groupe intérieur a un œil (E1 pour Noir, J1 pour Blanc) et une liberté partagée en G13.
  const seki13 = ['..OXXX.OOOX..', ...Array(11).fill('..OXXXXOOOX..'), '..OX.XXO.OX..'];

  it('personne ne peut jouer dans les libertés partagées sans perdre son groupe', () => {
    const { pos } = fromRows(seki9);
    for (const c of [1, 2] as const) {
      const r = ok(play({ ...pos, toPlay: c }, fromLabel('E9', 9)));
      const capture = ok(play(r, fromLabel('E8', 9)));
      expect(capture.captures[3 - c]).toBeGreaterThan(8);
    }
  });
  it('les points neutres du seki ne sont à personne (japonais et chinois)', () => {
    const { pos } = fromRows(seki9);
    const jp = score(pos, 0, 'japanese');
    expect(jp.territory).toEqual([0, 18, 18]);
    expect(jp.owner[fromLabel('E9', 9)]).toBe(0);
    expect(jp.owner[fromLabel('E8', 9)]).toBe(0);
    expect(jp.seki.length).toBe(16 + 9);
    const cn = score(pos, 0, 'chinese');
    expect(cn.black).toBe(25 + 18);
    expect(cn.white).toBe(18 + 18);
  });
  it('les yeux d’un groupe en seki : neutres en japonais, comptés en chinois', () => {
    const { pos } = fromRows(seki13);
    expect(play(pos, fromLabel('J1', 13))).toBe('suicide');
    const jp = score(pos, 6.5, 'japanese');
    expect(jp.territory).toEqual([0, 26, 26]);
    expect(jp.owner[fromLabel('E1', 13)]).toBe(0);
    expect(jp.owner[fromLabel('J1', 13)]).toBe(0);
    expect(jp.black).toBe(26);
    expect(jp.white).toBe(32.5);
    const cn = score(pos, 7, 'chinese');
    expect(cn.territory).toEqual([0, 27, 27]);
    expect(cn.black).toBe(90);
    expect(cn.white).toBe(78 + 7);
    expect(cn.winner).toBe(1);
    expect(cn.margin).toBe(5);
  });
  it('un simple point neutre (dame) n’est pas un seki', () => {
    const { pos } = fromRows(Array(9).fill('...X.O...'));
    expect(findSeki(pos.board, 9).size).toBe(0);
    const s = score(pos, 6.5, 'japanese');
    expect(s.territory).toEqual([0, 27, 27]);
    expect(s.seki).toEqual([]);
  });
});

describe('comptage : pierres mortes et prisonniers', () => {
  it('japonais : territoire + prisonniers + pierres mortes ; chinois : pierres + territoire', () => {
    const { pos } = fromRows(Array(8).fill('...XO....').concat(['...XO..X.']));
    pos.captures = [0, 3, 2];
    const dead = new Set([fromLabel('H1', 9)]);
    const jp = score(pos, 6.5, 'japanese', dead);
    expect(jp.black).toBe(27 + 3);
    expect(jp.white).toBe(36 + 2 + 1 + 6.5);
    const cn = score(pos, 7.5, 'chinese', dead);
    expect(cn.black).toBe(27 + 9);
    expect(cn.white).toBe(36 + 9 + 7.5);
    expect(cn.owner[fromLabel('H1', 9)]).toBe(2);
  });
  it('égalité parfaite : pas de vainqueur noir, écart nul', () => {
    const { pos } = fromRows(Array(9).fill('...X.O...'));
    const s = score(pos, 0, 'japanese');
    expect(s.margin).toBe(0);
    expect(s.winner).toBe(2);
  });
});

describe('handicap', () => {
  it('place 2 à 9 pierres sur les hoshi en 9, 13 et 19', () => {
    expect(handicapPoints(19, 2).map(p => toLabel(p, 19))).toEqual(['Q16', 'D4']);
    expect(handicapPoints(19, 4).map(p => toLabel(p, 19))).toEqual(['Q16', 'D4', 'Q4', 'D16']);
    expect(handicapPoints(19, 5).map(p => toLabel(p, 19))).toContain('K10');
    expect(handicapPoints(19, 6).map(p => toLabel(p, 19)).slice(4)).toEqual(['D10', 'Q10']);
    expect(handicapPoints(19, 7).map(p => toLabel(p, 19))).toContain('K10');
    expect(handicapPoints(19, 8).map(p => toLabel(p, 19))).not.toContain('K10');
    expect(handicapPoints(19, 9).map(p => toLabel(p, 19)).sort()).toEqual(['D10', 'D16', 'D4', 'K10', 'K16', 'K4', 'Q10', 'Q16', 'Q4']);
    expect(handicapPoints(13, 9).map(p => toLabel(p, 13)).sort()).toEqual(['D10', 'D4', 'D7', 'G10', 'G4', 'G7', 'K10', 'K4', 'K7']);
    expect(handicapPoints(9, 5).map(p => toLabel(p, 9))).toEqual(['G7', 'C3', 'G3', 'C7', 'E5']);
    for (const size of [9, 13, 19]) for (let n = 2; n <= 9; n++) {
      const pts = handicapPoints(size, n);
      expect(new Set(pts).size).toBe(n);
      expect(newPosition(size, pts).toPlay).toBe(2);
    }
  });
});
