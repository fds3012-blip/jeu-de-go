// Issue #91, lot A : preuve de chaque problème de capture et d'atari avec le moteur de règles.
// Objectif d'un problème : Noir capture une pierre marquée blanche en au plus `k` coups noirs, quelle que soit
// la défense de Blanc (tous ses coups légaux et la passe). Pour les problèmes « mets en atari du bon côté »,
// le premier coup doit en plus mettre la cible en atari, comme le dit la consigne.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_A from '../content/lots/a-capture';
import { BASE_PUZZLES, PUZZLES_16 } from '../content/puzzles';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { whiteFails } from './lecteurs-lot-a';
import { groupAt, play, type Position } from './rules';

/** Nombre de coups noirs permis, et premier coup obligatoirement atari. */
const SPEC: Record<string, { k: number; atari?: boolean }> = {
  a01: { k: 1 }, a02: { k: 1 }, a03: { k: 1 }, a04: { k: 1 }, a05: { k: 1 }, a06: { k: 1 }, a07: { k: 1 }, a08: { k: 1 },
  a09: { k: 3, atari: true }, a10: { k: 3, atari: true }, a11: { k: 2 }, a12: { k: 3, atari: true },
  a13: { k: 2 }, a14: { k: 2 }, a15: { k: 1 }, a16: { k: 1 }, a17: { k: 1 }, a18: { k: 1 }, a19: { k: 1 }, a20: { k: 1 }
};

const all = parsePuzzles(LOT_A);
const at = (l: string) => fromLabel(l, 9);
const libs = (pos: Position, p: number) => groupAt(pos.board, pos.size, p).liberties.size;
const targetsOf = (p: Puzzle) => { const { pos, marked } = startOf(p); return marked.filter(m => pos.board[m] === 2); };

/** Tous les coups noirs légaux qui atteignent l'objectif du problème. */
function winners(p: Puzzle): string[] {
  const { pos } = startOf(p), targets = targetsOf(p), { k, atari } = SPEC[p.id], out: string[] = [];
  for (let m = 0; m < 81; m++) {
    const r = play(pos, m);
    if (typeof r === 'string') continue;
    if (atari && targets.every(t => r.board[t] === 2 && libs(r, t) !== 1)) continue;
    if (whiteFails(r, targets, k - 1)) out.push(toLabel(m, 9));
  }
  return out.sort();
}

/** Lecture des littéraux SQL d'une ligne `(... , '...', array['E4'], ..., 300)`. */
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

describe('lot A : capture et atari (issue #91)', () => {
  it('en 9 × 9, Noir au trait, difficulté 300 à 650 (croissante de a01 à a14), textes complets', () => {
    expect(all.map(p => p.id)).toEqual(Object.keys(SPEC));
    expect(all.length).toBe(LOT_A.length);
    let prev = 0;
    for (const row of LOT_A) {
      expect(row.size).toBe(9);
      expect(row.difficulty).toBeGreaterThanOrEqual(300);
      expect(row.difficulty).toBeLessThanOrEqual(650);
      if (row.id <= 'a14') { expect(row.difficulty, row.id).toBeGreaterThan(prev); prev = row.difficulty; }
      expect(row.title && row.prompt && row.explanation, row.id).toBeTruthy();
      expect(row.explanation, row.id).toMatch(/libert/);
    }
    for (const p of all) { expect(p.toPlay).toBe(1); expect(p.refutation, p.id).toBeTruthy(); expect(targetsOf(p).length, p.id).toBeGreaterThan(0); }
  });

  it('aucune position en double, ni dans le lot ni avec les problèmes existants', () => {
    const key = (r: { setup: unknown }) => JSON.stringify((r.setup as { rows: string[] }).rows);
    const keys = [...BASE_PUZZLES, ...PUZZLES_16, ...LOT_A].map(key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('positions de départ légales : chaque chaîne a au moins une liberté', () => {
    for (const p of all) {
      const { pos } = startOf(p);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(libs(pos, q), `${p.id} ${toLabel(q, 9)}`).toBeGreaterThan(0);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
    }
  });

  for (const row of LOT_A) {
    it(`${row.id} : les réponses capturent quoi que fasse Blanc, et ce sont les seuls coups gagnants`, () => {
      const p = all.find(x => x.id === row.id)!, targets = targetsOf(p), { k } = SPEC[p.id];
      for (const a of row.answers) {
        const r = play(startOf(p).pos, at(a));
        if (typeof r === 'string') throw new Error(r);
        expect(whiteFails(r, targets, k - 1), `${p.id} ${a}`).toBe(true);
      }
      expect(winners(p)).toEqual([...row.answers].sort());
    });
  }

  it('a07 : après la capture, tes pierres ont trois libertés ; en C1, Blanc les prend en A2', () => {
    const p = all.find(x => x.id === 'a07')!, start = startOf(p).pos;
    const good = play(start, at('A2'));
    if (typeof good === 'string') throw new Error(good);
    expect(libs(good, at('B2'))).toBe(3);
    const c1 = play(start, at('C1'));
    if (typeof c1 === 'string') throw new Error(c1);
    expect(libs(c1, at('B2'))).toBe(1);
    const taken = play(c1, at('A2'));
    if (typeof taken === 'string') throw new Error(taken);
    expect(taken.board[at('B2')]).toBe(0);
  });

  it('a08 : F9 est un suicide ; après D8, ta pierre E9 a deux libertés', () => {
    const p = all.find(x => x.id === 'a08')!, start = startOf(p).pos;
    expect(play(start, at('F9'))).toBe('suicide');
    const good = play(start, at('D8'));
    if (typeof good === 'string') throw new Error(good);
    expect(libs(good, at('E9'))).toBe(2);
  });

  it('a17 : après B6, ta pierre A5 a deux libertés', () => {
    const p = all.find(x => x.id === 'a17')!, good = play(startOf(p).pos, at('B6'));
    if (typeof good === 'string') throw new Error(good);
    expect(libs(good, at('A5'))).toBe(2);
  });

  it('a18 : E5 prend les deux pierres et relie D5 et F5', () => {
    const p = all.find(x => x.id === 'a18')!, good = play(startOf(p).pos, at('E5'));
    if (typeof good === 'string') throw new Error(good);
    expect(good.captures[1]).toBe(2);
    expect(groupAt(good.board, 9, at('D5')).stones).toContain(at('F5'));
  });

  it('a19 : après G8, tes pierres du coin ont deux libertés ; en J8, elles restent en atari', () => {
    const p = all.find(x => x.id === 'a19')!, start = startOf(p).pos, good = play(start, at('G8'));
    if (typeof good === 'string') throw new Error(good);
    expect(libs(good, at('H9'))).toBe(2);
    const j8 = play(start, at('J8'));
    if (typeof j8 === 'string') throw new Error(j8);
    expect(libs(j8, at('H9'))).toBe(1);
    const taken = play(j8, at('J7'));
    if (typeof taken === 'string') throw new Error(taken);
    expect(taken.board[at('H9')]).toBe(0);
  });

  it('les réfutations des mises en atari du mauvais côté disent vrai : Blanc a trois libertés', () => {
    for (const [id, wrong, ext] of [['a09', 'E1', 'F2'], ['a10', 'F5', 'E4'], ['a12', 'C1', 'B2']]) {
      const p = all.find(x => x.id === id)!, t = targetsOf(p)[0];
      const r = play(startOf(p).pos, at(wrong));
      if (typeof r === 'string') throw new Error(r);
      expect(libs(r, t), id).toBe(1);
      const e = play(r, at(ext));
      if (typeof e === 'string') throw new Error(e);
      expect(libs(e, t), id).toBe(3);
    }
  });

  it('la migration insère exactement ce contenu, sans rien modifier ni supprimer', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260927170100_lot_a_capture.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing;\s*$/);
    const rows = parseSqlRows(sql);
    expect(rows).toEqual(LOT_A.map(r => [r.id, null, r.size, JSON.stringify(r.setup), r.answers, r.title, r.prompt, r.explanation, r.difficulty]));
    for (const r of rows) expect(JSON.parse(r[3] as string)).toEqual(LOT_A.find(x => x.id === r[0])!.setup);
  });
});
