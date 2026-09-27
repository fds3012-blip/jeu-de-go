// Issue #91, lot F : preuve de chaque problème (courses aux libertés, coupes, connexions).
// Pour chaque problème : position de départ légale, objectif atteint contre toute défense légale de Blanc,
// ensemble des coups gagnants exactement égal aux réponses acceptées, aucun doublon (même à une symétrie
// près) avec les autres problèmes, migration identique au fichier local.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_F from '../content/lots/f-semeai-2';
import { ALL_PUZZLES } from '../content/puzzles';
import { checkAnswer, parsePuzzles, startOf } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { canonical, captureAfter, saveAfter, winningMoves } from './lecteurs-lot-f';
import { groupAt, play, type Position } from './rules';
import { captureWorks } from './tactics';

const all = parsePuzzles(LOT_F);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const libs = (pos: Position, p: number) => groupAt(pos.board, pos.size, p).liberties.size;
const seq = (pos: Position, ...moves: string[]) => moves.reduce((q, m) => ok(play(q, m === 'passe' ? -1 : at(m))), pos);
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;

/** Objectif de chaque problème : capturer les pierres blanches marquées, ou sauver les pierres noires marquées. */
const GOAL: Record<string, 'capture' | 'sauve'> = {
  f01: 'sauve', f02: 'capture', f03: 'capture', f04: 'capture', f05: 'capture', f06: 'capture', f07: 'capture'
};

describe('lot F : courses aux libertés, coupes et connexions', () => {
  it('lisibles, en 9 × 9, Noir au trait, difficultés croissantes de 650 à 1300', () => {
    expect(all.map(p => p.id)).toEqual(Object.keys(GOAL));
    expect(all).toHaveLength(LOT_F.length);
    let prev = 0;
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toBeTruthy();
      expect(p.difficulty).toBeGreaterThanOrEqual(650);
      expect(p.difficulty).toBeLessThanOrEqual(1300);
      expect(p.difficulty).toBeGreaterThan(prev);
      prev = p.difficulty;
    }
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près) déjà utilisés', () => {
    const others = ALL_PUZZLES.filter(r => !r.id.startsWith('f'));
    expect(others.length).toBeGreaterThanOrEqual(74);
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => canonical(rowsOf(r.setup))));
    for (const row of LOT_F) {
      expect(ids.has(row.id), row.id).toBe(false);
      const c = canonical(rowsOf(row.setup));
      expect(seen.has(c), row.id).toBe(false);
      seen.add(c);
    }
  });

  it('positions de départ légales : chaque chaîne a une liberté, pierres marquées de la bonne couleur, pas de ko', () => {
    for (const p of all) {
      const { pos, marked } = startOf(p);
      expect(marked.length, p.id).toBeGreaterThan(0);
      expect(pos.ko).toBe(-1);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(libs(pos, q), `${p.id} ${toLabel(q, 9)}`).toBeGreaterThan(0);
      for (const t of marked) expect(pos.board[t], p.id).toBe(GOAL[p.id] === 'capture' ? 2 : 1);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
    }
  });

  it('les coups gagnants sont exactement les réponses acceptées', () => {
    for (const p of all) {
      const { pos, marked } = startOf(p);
      const test = (m: number) => (GOAL[p.id] === 'capture' ? captureAfter(pos, m, marked) : saveAfter(pos, m, marked));
      const found = winningMoves(pos, test).map(m => toLabel(m, 9)).sort();
      expect(found, p.id).toEqual(p.answers.map(a => toLabel(a, 9)).sort());
    }
  }, 30000);

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260927190600_lot_f_semeai.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_F) {
      expect(sql).toContain(
        `('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
    expect(sql.match(/\('f\d\d', null, 9,/g)).toHaveLength(LOT_F.length);
  });
});

describe('chaque problème, coup par coup', () => {
  it('f06 : B5 bloque la sortie ; sinon Blanc se relie au mur en B5', () => {
    const p = pz('f06'), [t] = startOf(p).marked, { pos } = startOf(p), k = at('C1');
    expect(libs(pos, t)).toBe(4);
    expect(libs(pos, k)).toBe(4);
    const b5 = ok(play(pos, at('B5')));
    expect(libs(b5, t)).toBe(3);
    expect(seq(b5, 'D4', 'A3', 'D3', 'A2', 'D2', 'A1').board[t]).toBe(0);
    const a3 = seq(pos, 'A3', 'B5');
    expect(groupAt(a3.board, 9, t).stones).toContain(at('C5'));
    expect(captureWorks(a3, t)).toBe(false);
  });

  it('f01 : D4 capture les deux pierres qui touchent tes pierres de coupe ; sinon Blanc prend en B5', () => {
    const p = pz('f01'), [s] = startOf(p).marked, { pos } = startOf(p);
    expect(libs(pos, s)).toBe(1);
    const d4 = ok(play(pos, at('D4')));
    expect(d4.captures[1]).toBe(2);
    expect(libs(d4, s)).toBeGreaterThanOrEqual(2);
    expect(libs(ok(play(pos, at('B5'))), s)).toBe(2);
    expect(seq(pos, 'passe', 'B5').board[s]).toBe(0);
  });

  it('f05 : trois contre trois avec une sortie en B5 ; la bloquer gagne', () => {
    const p = pz('f05'), [t] = startOf(p).marked, { pos } = startOf(p), k = at('C1');
    expect(libs(pos, t)).toBe(3);
    expect(libs(pos, k)).toBe(3);
    const b5 = ok(play(pos, at('B5')));
    expect(libs(b5, t)).toBe(2);
    expect(seq(b5, 'D4', 'A2', 'D3', 'A1').board[t]).toBe(0);
    const a2 = seq(pos, 'A2', 'B5');
    expect(groupAt(a2.board, 9, t).stones).toContain(at('C5'));
    expect(captureWorks(a2, t)).toBe(false);
  });

  it('f03 : C2 met en atari du bon côté ; E2 laisse Blanc se relier en C2', () => {
    const p = pz('f03'), [t] = startOf(p).marked, { pos } = startOf(p);
    const c2 = ok(play(pos, at('C2')));
    expect(libs(c2, t)).toBe(1);
    expect(libs(c2, at('B2'))).toBe(1);
    expect(play(c2, at('E2'))).toBe('suicide');
    const e2 = seq(pos, 'E2', 'C2');
    expect(groupAt(e2.board, 9, t).stones).toContain(at('B2'));
    expect(libs(e2, at('B1'))).toBe(1);
  });

  it('f04 : E9 coupe au bord, la dernière liberté D7 est interdite à Blanc ; D7 laisse Blanc se relier', () => {
    const p = pz('f04'), [t] = startOf(p).marked, { pos } = startOf(p);
    const e9 = ok(play(pos, at('E9')));
    expect(libs(e9, t)).toBe(1);
    expect(play(e9, at('D7'))).toBe('suicide');
    const d7 = seq(pos, 'D7', 'E9');
    expect(groupAt(d7.board, 9, t).stones).toContain(at('F9'));
    expect(captureWorks(d7, t)).toBe(false);
  });

  it('f02 : deux contre deux avec une sortie en H5 ; la bloquer met Blanc en atari', () => {
    const p = pz('f02'), [t] = startOf(p).marked, { pos } = startOf(p), k = at('G9');
    expect(libs(pos, t)).toBe(2);
    expect(libs(pos, k)).toBe(2);
    const h5 = ok(play(pos, at('H5')));
    expect(libs(h5, t)).toBe(1);
    expect(seq(h5, 'F7', 'J9').board[t]).toBe(0);
    const j9 = seq(pos, 'J9', 'H5');
    expect(groupAt(j9.board, 9, t).stones).toContain(at('G5'));
    expect(captureWorks(j9, t)).toBe(false);
  });

  it('f07 : sortie B5 puis libertés extérieures, la commune C1 en dernier', () => {
    const p = pz('f07'), [t] = startOf(p).marked, { pos } = startOf(p), k = at('C2');
    expect(libs(pos, t)).toBe(4);
    expect(libs(pos, k)).toBe(4);
    expect(groupAt(pos.board, 9, k).liberties.has(at('C1'))).toBe(true);
    const b5 = ok(play(pos, at('B5')));
    expect(libs(b5, t)).toBe(3);
    expect(seq(b5, 'D3', 'A2', 'E2', 'A1', 'E1', 'C1').board[t]).toBe(0);
    const a2 = seq(pos, 'A2', 'B5');
    expect(groupAt(a2.board, 9, t).stones).toContain(at('C5'));
    expect(captureWorks(a2, t)).toBe(false);
  });
});
