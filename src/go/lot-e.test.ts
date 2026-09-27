// Issue #91, lot E : preuve de chaque variante de capture et d'atari avec le moteur de règles.
// Objectif : Noir capture une pierre marquée blanche en au plus `k` coups noirs, quelle que soit la défense de
// Blanc (tous ses coups légaux et la passe). Avec `atari`, le premier coup doit aussi mettre la cible en atari,
// comme le dit la consigne. Les réponses acceptées sont exactement les coups noirs qui atteignent cet objectif.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_E from '../content/lots/e-capture-2';
import { ALL_PUZZLES } from '../content/puzzles';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { blackCaptures, whiteFails } from './lecteurs-lot-a';
import { captureWinners, plainKey, symmetries } from './lecteurs-lot-e';
import { groupAt, play, type Position } from './rules';

const SPEC: Record<string, { k: number; atari?: boolean }> = {
  e01: { k: 1 }, e02: { k: 1 }, e03: { k: 1 }, e04: { k: 2 }, e05: { k: 1 }, e06: { k: 3, atari: true }, e07: { k: 2 }, e08: { k: 2 }, e09: { k: 2 },
  e10: { k: 2 }, e11: { k: 3, atari: true }, e12: { k: 3 }, e13: { k: 3 }
};

const all = parsePuzzles(LOT_E);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const libs = (pos: Position, p: number) => groupAt(pos.board, pos.size, p).liberties.size;
const targetsOf = (p: Puzzle) => { const { pos, marked } = startOf(p); return marked.filter(m => pos.board[m] === 2); };
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const rowsOf = (r: { setup: unknown }) => (r.setup as { rows: string[] }).rows;

/** Lecture des littéraux SQL d'une ligne `(... , '...', array['E4'], ..., 350)`. */
function parseSqlRows(sql: string) {
  const body = sql.slice(sql.indexOf(' values') + 7, sql.lastIndexOf('on conflict'));
  const rows: (string | number | null | string[])[][] = [];
  let i = 0, cur: (string | number | null | string[])[] | null = null, arr: string[] | null = null;
  const str = () => { let s = ''; i++; for (;;) { if (body[i] === "'") { if (body[i + 1] === "'") { s += "'"; i += 2; continue; } i++; return s; } s += body[i++]; } };
  while (i < body.length) {
    const c = body[i];
    if (c === "'") { const s = str(); if (arr) arr.push(s); else cur!.push(s); continue; }
    if (body.startsWith('array[', i)) { arr = []; i += 6; continue; }
    if (c === ']') { cur!.push(arr!); arr = null; i++; continue; }
    if (c === '(') { cur = []; i++; continue; }
    if (c === ')') { rows.push(cur!); cur = null; i++; continue; }
    if (body.startsWith('null', i)) { cur!.push(null); i += 4; continue; }
    const num = /^\d+/.exec(body.slice(i));
    if (num && cur) { cur.push(Number(num[0])); i += num[0].length; continue; }
    i++;
  }
  return rows;
}

describe('lot E : variantes de capture et d’atari (issue #91)', () => {
  it('en 9 × 9, Noir au trait, difficulté 350 à 750 croissante, textes complets', () => {
    expect(all.map(p => p.id)).toEqual(Object.keys(SPEC));
    expect(all.length).toBe(LOT_E.length);
    let prev = 0;
    for (const row of LOT_E) {
      expect(row.size).toBe(9);
      expect(row.difficulty).toBeGreaterThanOrEqual(350);
      expect(row.difficulty).toBeLessThanOrEqual(750);
      expect(row.difficulty, row.id).toBeGreaterThan(prev);
      prev = row.difficulty;
      expect(row.title && row.prompt && row.explanation, row.id).toBeTruthy();
      expect(row.explanation, row.id).toMatch(/libert/);
    }
    for (const p of all) { expect(p.toPlay).toBe(1); expect(p.refutation, p.id).toBeTruthy(); expect(targetsOf(p).length, p.id).toBeGreaterThan(0); }
  });

  it('le lot est chargé, et aucune position ne double un problème existant, même tournée ou retournée', () => {
    for (const row of LOT_E) expect(ALL_PUZZLES.some(p => p.id === row.id), row.id).toBe(true);
    const others = ALL_PUZZLES.filter(p => !p.id.startsWith('e'));
    expect(others.length).toBeGreaterThanOrEqual(74);
    const known = new Set(others.map(p => plainKey(rowsOf(p))));
    const seen = new Set<string>();
    for (const row of LOT_E) {
      for (const s of symmetries(rowsOf(row))) expect(known.has(plainKey(s)), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row)));
    }
  });

  it('positions de départ légales : chaque chaîne a au moins une liberté', () => {
    for (const p of all) {
      const { pos } = startOf(p);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(libs(pos, q), `${p.id} ${toLabel(q, 9)}`).toBeGreaterThan(0);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
    }
  });

  for (const row of LOT_E) {
    it(`${row.id} : les réponses capturent quoi que fasse Blanc, et ce sont les seuls coups gagnants`, () => {
      const p = pz(row.id), targets = targetsOf(p), { k, atari } = SPEC[p.id];
      for (const a of row.answers) expect(whiteFails(ok(play(startOf(p).pos, at(a))), targets, k - 1), `${p.id} ${a}`).toBe(true);
      expect(captureWinners(startOf(p).pos, targets, k, atari)).toEqual([...row.answers].sort());
    });
  }

  it('e03 : après E8, ta pierre E6 a deux libertés', () => {
    expect(libs(ok(play(startOf(pz('e03')).pos, at('E8'))), at('E6'))).toBe(2);
  });

  it('e05 : après B1, tes pierres ont deux libertés ; en F1, elles restent en atari', () => {
    const start = startOf(pz('e05')).pos;
    expect(libs(ok(play(start, at('B1'))), at('D1'))).toBe(2);
    expect(libs(ok(play(start, at('F1'))), at('D1'))).toBe(1);
  });

  it('e06 : après F4 puis E3, Blanc a deux libertés et Noir ne le capture plus en trois coups', () => {
    const p = pz('e06'), t = targetsOf(p)[0], r = ok(play(ok(play(startOf(p).pos, at('F4'))), at('E3')));
    expect(libs(r, t)).toBe(2);
    expect(blackCaptures(r, [t], 3)).toBe(false);
  });

  it('e07, e09 à e13 : même avec un coup noir de plus, aucune autre solution', () => {
    for (const id of ['e07', 'e09', 'e10', 'e11', 'e12', 'e13']) {
      const p = pz(id), { k, atari } = SPEC[id];
      expect(captureWinners(startOf(p).pos, targetsOf(p), k + 1, atari), id).toEqual([...p.answers.map(a => toLabel(a, 9))].sort());
    }
  });

  it('e11 : après A4, Blanc s’allonge en B3 et a trois libertés', () => {
    const p = pz('e11'), t = targetsOf(p)[0];
    expect(libs(ok(play(ok(play(startOf(p).pos, at('A4'))), at('B3'))), t)).toBe(3);
  });

  it('e04, e07, e09 : après le mauvais atari, Blanc s’allonge, a deux libertés et Noir ne le prend plus en un coup', () => {
    for (const [id, wrong, ext] of [['e04', 'B1', 'A3'], ['e07', 'E2', 'F1'], ['e09', 'F8', 'G9']]) {
      const p = pz(id), t = targetsOf(p)[0], r = ok(play(ok(play(startOf(p).pos, at(wrong))), at(ext)));
      expect(libs(r, t), id).toBe(2);
      expect(blackCaptures(r, [t], 1), id).toBe(false);
    }
  });

  it('la migration insère exactement ce contenu, sans rien modifier ni supprimer', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260927190500_lot_e_capture.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing;\s*$/);
    expect(parseSqlRows(sql)).toEqual(LOT_E.map(r => [r.id, null, r.size, JSON.stringify(r.setup), r.answers, r.title, r.prompt, r.explanation, r.difficulty]));
  });
});
