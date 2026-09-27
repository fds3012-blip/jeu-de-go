// Issue #136, lot G : preuve de chaque problème (relier deux groupes).
// Pour chaque problème : position de départ légale, tes groupes marqués restent tous hors de prise contre toute
// défense légale de Blanc, ensemble des coups gagnants exactement égal aux réponses acceptées, aucun doublon
// (même à une symétrie près) avec les autres problèmes, migration identique au fichier local.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_G from '../content/lots/g-relier';
import { ALL_PUZZLES } from '../content/puzzles';
import { checkAnswer, parsePuzzles, startOf } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { canonical, saveAllAfter, winningMoves } from './lecteurs-lot-f';
import { groupAt, play, type Position } from './rules';
import { captureWorks } from './tactics';

const all = parsePuzzles(LOT_G);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const libs = (pos: Position, p: number) => groupAt(pos.board, pos.size, p).liberties.size;
const seq = (pos: Position, ...moves: string[]) => moves.reduce((q, m) => ok(play(q, m === 'passe' ? -1 : at(m))), pos);
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;

describe('lot G : relier deux groupes', () => {
  it('lisibles, en 9 × 9, Noir au trait, difficultés croissantes', () => {
    expect(all.map(p => p.id)).toEqual(['g01', 'g02', 'g03']);
    expect(all).toHaveLength(LOT_G.length);
    let prev = 0;
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toBeTruthy();
      expect(p.difficulty).toBeGreaterThan(prev);
      prev = p.difficulty;
    }
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près) déjà utilisés', () => {
    const others = ALL_PUZZLES.filter(r => !r.id.startsWith('g'));
    expect(others.length).toBeGreaterThanOrEqual(101);
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => canonical(rowsOf(r.setup))));
    for (const row of LOT_G) {
      expect(ids.has(row.id), row.id).toBe(false);
      const c = canonical(rowsOf(row.setup));
      expect(seen.has(c), row.id).toBe(false);
      seen.add(c);
    }
  });

  it('positions de départ légales : chaque chaîne a une liberté, pierres marquées noires sur deux groupes, pas de ko', () => {
    for (const p of all) {
      const { pos, marked } = startOf(p);
      expect(pos.ko).toBe(-1);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(libs(pos, q), `${p.id} ${toLabel(q, 9)}`).toBeGreaterThan(0);
      for (const t of marked) expect(pos.board[t], p.id).toBe(1);
      const groups = new Set(marked.map(t => Math.min(...groupAt(pos.board, 9, t).stones)));
      expect(groups.size, p.id).toBe(2);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
    }
  });

  it('les coups gagnants sont exactement les réponses acceptées', () => {
    for (const p of all) {
      const { pos, marked } = startOf(p);
      const found = winningMoves(pos, m => saveAllAfter(pos, m, marked)).map(m => toLabel(m, 9)).sort();
      expect(found, p.id).toEqual(p.answers.map(a => toLabel(a, 9)).sort());
    }
  }, 180000);

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260927220100_lot_g_relier.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_G) {
      expect(sql).toContain(
        `('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
    expect(sql.match(/\('g\d\d', null, 9,/g)).toHaveLength(LOT_G.length);
  });
});

describe('chaque problème, coup par coup', () => {
  it('g01 : D3 relie les deux groupes ; sinon Blanc coupe en D3 et prend un des deux', () => {
    const p = pz('g01'), { pos } = startOf(p), l = at('B3'), r = at('F3');
    const d3 = ok(play(pos, at('D3')));
    expect(groupAt(d3.board, 9, l).stones).toContain(r);
    // Refutation : Noir joue ailleurs (C2), Blanc coupe en D3 ; il menace alors les deux groupes.
    const cut = seq(pos, 'C2', 'D3');
    expect(groupAt(cut.board, 9, l).stones).not.toContain(r);
    expect(saveAllAfter(pos, at('C2'), [l, r])).toBe(false);
  });

  it('g02 : D1 capture la pierre de coupe D2 ; C1 et E1 la laissent en atari ; ailleurs, Blanc s’allonge en D1', () => {
    const p = pz('g02'), { pos } = startOf(p), d2 = at('D2');
    expect(libs(pos, d2)).toBe(1);
    const d1 = ok(play(pos, at('D1')));
    expect(d1.board[d2]).toBe(0);
    expect(d1.captures[1]).toBe(1);
    expect(play(d1, d2)).toBe('suicide');
    const c1 = seq(pos, 'C1', 'D1');
    expect(libs(c1, d2)).toBe(1);
    expect(seq(c1, 'E1').board[d2]).toBe(0);
    const ext = seq(pos, 'H5', 'D1');
    expect(libs(ext, d2)).toBe(2);
    expect(seq(ext, 'passe', 'C1', 'passe', 'B1').board[at('B2')]).toBe(0);
    expect(captureWorks(seq(ext, 'passe'), at('B2'))).toBe(true);
  });

  it('g03 : le groupe de gauche est en atari ; D1 capture D2 et sauve les deux groupes ; sinon Blanc prend en C1', () => {
    const p = pz('g03'), { pos } = startOf(p), b2 = at('B2'), f2 = at('F2');
    expect(libs(pos, b2)).toBe(1);
    expect(libs(pos, f2)).toBe(2);
    expect(libs(pos, at('D2'))).toBe(1);
    const d1 = ok(play(pos, at('D1')));
    expect(d1.captures[1]).toBe(1);
    expect(libs(d1, b2)).toBe(2);
    expect(play(d1, at('D2'))).toBe('suicide');
    // Refutation : E1, par exemple, laisse Blanc capturer en C1.
    expect(seq(pos, 'E1', 'C1').board[b2]).toBe(0);
  });
});
