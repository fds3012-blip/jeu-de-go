// #528 : handicap (points classiques, Blanc commence), compensation en règle chinoise, et comptage chinois contre
// comptage japonais sur une partie réelle (issue #424) : la différence entre les deux se déduit exactement des coups.
import { describe, expect, it } from 'vitest';
import { groupAt, handicapPoints, newPosition, play, type Position } from './rules';
import { compensationHandicap, handicapDe, score } from './score';
import { fromLabel, toLabel } from './coords';
import { readSgf, writeSgf } from './sgf';
import { initialPosition, replay } from './replay';
import { SGF_424 } from '../app/partie424.fixture';

const labels = (size: number, n: number) => handicapPoints(size, n).map(p => toLabel(p, size)).sort();

describe('pierres de handicap aux points classiques', () => {
  it('19 × 19 : hoshi de 4-4, puis côtés, puis tengen', () => {
    expect(labels(19, 2)).toEqual(['D4', 'Q16']);
    expect(labels(19, 4)).toEqual(['D16', 'D4', 'Q16', 'Q4']);
    expect(labels(19, 5)).toEqual(['D16', 'D4', 'K10', 'Q16', 'Q4']);
    expect(labels(19, 6)).toEqual(['D10', 'D16', 'D4', 'Q10', 'Q16', 'Q4']);
    expect(labels(19, 9)).toEqual(['D10', 'D16', 'D4', 'K10', 'K16', 'K4', 'Q10', 'Q16', 'Q4']);
  });
  it('13 × 13 (4-4) et 9 × 9 (3-3)', () => {
    expect(labels(13, 4)).toEqual(['D10', 'D4', 'K10', 'K4']);
    expect(labels(13, 5)).toContain('G7');
    expect(labels(9, 2)).toEqual(['C3', 'G7']);
    expect(labels(9, 4)).toEqual(['C3', 'C7', 'G3', 'G7']);
    expect(labels(9, 9)).toEqual(['C3', 'C5', 'C7', 'E3', 'E5', 'E7', 'G3', 'G5', 'G7']);
  });
  it('de 2 à 9 pierres, toutes distinctes, sur chaque taille', () => {
    for (const size of [9, 13, 19]) for (let n = 2; n <= 9; n++) expect(new Set(handicapPoints(size, n)).size).toBe(n);
  });
  it('Blanc commence, et le handicap se relit sur la position de départ', () => {
    const pos = newPosition(19, handicapPoints(19, 4));
    expect(pos.toPlay).toBe(2);
    expect(handicapDe(pos)).toBe(4);
    expect(handicapDe(newPosition(9))).toBe(0);
    // Une position avec des pierres blanches n'est pas un handicap ; Noir au trait non plus.
    expect(handicapDe({ ...pos, toPlay: 1 })).toBe(0);
    const avecBlanc = newPosition(9, handicapPoints(9, 2));
    avecBlanc.board[0] = 2;
    expect(handicapDe(avecBlanc)).toBe(0);
  });
});

describe('compensation du handicap', () => {
  it('règle chinoise : 1 point par pierre ; japonaise : rien', () => {
    expect(compensationHandicap('chinese', 4)).toBe(4);
    expect(compensationHandicap('japanese', 4)).toBe(0);
    expect(compensationHandicap('chinese', 0)).toBe(0);
  });
  it('position de départ à 4 pierres, komi 0,5 : tout le plateau est à Noir, Blanc reçoit 4,5 en chinois', () => {
    const pos = newPosition(9, handicapPoints(9, 4));
    const cn = score(pos, 0.5, 'chinese', new Set(), 4);
    expect(cn.black).toBe(81);
    expect(cn.white).toBe(4.5);
    expect(cn.compensation).toBe(4);
    const jp = score(pos, 0.5, 'japanese', new Set(), 4);
    expect(jp.black).toBe(77);
    expect(jp.white).toBe(0.5);
    expect(jp.compensation).toBe(0);
  });
});

/** Rejoue une partie en comptant les pierres posées par chaque camp (installation comprise). */
function rejouer(sgf: string): { pos: Position; poses: [number, number, number] } {
  const g = readSgf(sgf);
  let pos = initialPosition(g)!;
  const poses: [number, number, number] = [0, g.setupBlack.length, g.setupWhite.length];
  for (const m of g.moves) {
    const r = play(pos, m.p);
    if (typeof r === 'string') throw new Error(r);
    if (m.p >= 0) poses[m.color]++;
    pos = r;
  }
  return { pos, poses };
}

describe('comptage chinois exact contre comptage japonais (partie réelle #424)', () => {
  const { pos, poses } = rejouer(SGF_424);

  it('le comptage japonais retrouve le résultat de la partie (B+17,5)', () => {
    const jp = score(pos, 6.5, 'japanese');
    expect(jp.winner).toBe(1);
    expect(jp.margin).toBe(17.5);
  });

  it('écart chinois − écart japonais = pierres posées par Noir − pierres posées par Blanc, quelles que soient les pierres mortes', () => {
    // Surface = territoire + pierres vivantes ; pierres vivantes = pierres posées − pierres perdues (prisonniers de l'autre).
    const blanc = pos.board.findIndex(v => v === 2), noir = pos.board.findIndex(v => v === 1);
    const groupes = [new Set<number>(), new Set(groupAt(pos.board, 9, blanc).stones), new Set(groupAt(pos.board, 9, noir).stones)];
    for (const dead of groupes) {
      const cn = score(pos, 6.5, 'chinese', dead), jp = score(pos, 6.5, 'japanese', dead);
      expect((cn.black - cn.white) - (jp.black - jp.white)).toBe(poses[1] - poses[2]);
    }
  });

  it('même partie rejouée avec 2 pierres noires posées d’avance, règle chinoise : la compensation rend l’écart japonais, à la parité près', () => {
    // On pose 2 pierres noires sur des points restés vides en fin de partie : la partie rejouée reste légale.
    const g = readSgf(SGF_424);
    const vides = [fromLabel('J1', 9), fromLabel('J2', 9)].filter(p => pos.board[p] === 0 && !g.moves.some(m => m.p === p));
    expect(vides.length).toBe(2);
    const avecHandicap = writeSgf({ ...g, rules: 'chinese', komi: 0.5, handicap: 2, setupBlack: vides, toPlay: 1 });
    const rejoue = replay(readSgf(avecHandicap));
    expect(rejoue.ok).toBe(true);
    const { pos: fin, poses: p2 } = rejouer(avecHandicap);
    const cn = score(fin, 0.5, 'chinese', new Set(), 2), jp = score(fin, 0.5, 'japanese', new Set(), 2);
    expect(cn.compensation).toBe(2);
    // Écart chinois − compensation − écart japonais = coups de Noir − coups de Blanc (hors handicap) : 0 ou 1.
    expect((cn.black - cn.white) - (jp.black - jp.white)).toBe(p2[1] - p2[2] - 2);
    expect(Math.abs(p2[1] - 2 - p2[2])).toBeLessThanOrEqual(1);
  });
});
