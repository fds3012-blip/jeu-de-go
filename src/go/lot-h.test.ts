// Issue #136, lot H : preuve de chaque problème (relier pour sauver).
// Position de départ légale sans ko, pierres marquées toutes sauvées contre toute défense légale de Blanc,
// coups gagnants exactement égaux aux réponses acceptées, aucun doublon (8 symétries), migration identique.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_H from '../content/lots/h-relier-2';
import { ALL_PUZZLES } from '../content/puzzles';
import { checkAnswer, parsePuzzles, startOf } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { canonical, saveAllAfter } from './lecteurs-lot-f';
import { cederLaMain, preuveParCoup } from './preuve-par-coup';
import { groupAt, play, type Position } from './rules';

// Recette du 28/09 (#195) : longues preuves synchrones, voir cederLaMain (preuve-par-coup.ts).
beforeEach(cederLaMain);

const all = parsePuzzles(LOT_H);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const libs = (pos: Position, p: number) => groupAt(pos.board, pos.size, p).liberties.size;
const seq = (pos: Position, ...moves: string[]) => moves.reduce((q, m) => ok(play(q, m === 'passe' ? -1 : at(m))), pos);
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;

describe('lot H : relier pour sauver', () => {
  it('lisibles, en 9 × 9, Noir au trait', () => {
    expect(all.map(p => p.id)).toEqual(['h01']);
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toBeTruthy();
    }
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près) déjà utilisés', () => {
    const others = ALL_PUZZLES.filter(r => !r.id.startsWith('h'));
    expect(others.length).toBeGreaterThanOrEqual(106);
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => canonical(rowsOf(r.setup))));
    for (const row of LOT_H) {
      expect(ids.has(row.id), row.id).toBe(false);
      const c = canonical(rowsOf(row.setup));
      expect(seen.has(c), row.id).toBe(false);
      seen.add(c);
    }
  });

  it('positions de départ légales : chaque chaîne a une liberté, pierres marquées noires, pas de ko', () => {
    for (const p of all) {
      const { pos, marked } = startOf(p);
      expect(pos.ko).toBe(-1);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(libs(pos, q), `${p.id} ${toLabel(q, 9)}`).toBeGreaterThan(0);
      for (const t of marked) expect(pos.board[t], p.id).toBe(1);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
    }
  });

  // Recette du 28/09 (#195) : preuve déclarée coup par coup (voir preuve-par-coup.ts), même vérification qu'avant.
  for (const p of all) {
    const { pos, marked } = startOf(p);
    preuveParCoup(p.id, pos, p.answers, m => saveAllAfter(pos, m, marked));
  }

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260927231100_lot_h.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_H) {
      expect(sql).toContain(
        `('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
    expect(sql.match(/\('h\d\d', null, 9,/g)).toHaveLength(LOT_H.length);
  });
});

describe('chaque problème, coup par coup', () => {
  it('h01 : E3 en atari ; E2 relie à D2 ; la coupe C2 se capture en C1 ; sinon Blanc prend en E2', () => {
    const p = pz('h01'), { pos } = startOf(p), e3 = at('E3');
    expect(libs(pos, e3)).toBe(1);
    const e2 = ok(play(pos, at('E2')));
    expect(groupAt(e2.board, 9, e3).stones).toContain(at('D2'));
    expect(libs(e2, e3)).toBe(2);
    const cut = seq(e2, 'C2');
    expect(libs(cut, at('C2'))).toBe(1);
    expect(seq(cut, 'C1').board[at('C2')]).toBe(0);
    // Refutation : Noir joue ailleurs (C2), Blanc capture E3 en E2.
    expect(seq(pos, 'C2', 'E2').board[e3]).toBe(0);
  });
});
