// Issue #91, lot D : preuve de chaque problème (connexions, pierres de coupe, courses aux libertés).
// Pour chaque problème : position de départ légale, objectif atteint contre toute défense légale de Blanc,
// ensemble des coups gagnants exactement égal aux réponses acceptées, migration identique au fichier local.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_D from '../content/lots/d-connexions-semeai';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { captureAfter, legalMoves, saveAfter, winningMoves } from './lecteurs-lot-d';
import { groupAt, play, type Position } from './rules';
import { captureWorks, defenceFails } from './tactics';

const all = parsePuzzles(LOT_D);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const libs = (pos: Position, p: number) => groupAt(pos.board, pos.size, p).liberties.size;
const seq = (pos: Position, ...moves: string[]) => moves.reduce((q, m) => ok(play(q, m === 'passe' ? -1 : at(m))), pos);

/** Objectif de chaque problème : capturer les pierres blanches marquées, ou sauver les pierres noires marquées. */
const GOAL: Record<string, 'capture' | 'sauve'> = {
  d01: 'sauve', d02: 'sauve', d03: 'capture', d04: 'capture', d05: 'capture', d06: 'capture', d07: 'capture', d08: 'capture',
  d09: 'capture', d10: 'capture', d11: 'capture', d12: 'capture', d13: 'capture'
};
const wins = (p: Puzzle) => {
  const { pos, marked } = startOf(p);
  return (m: number) => (GOAL[p.id] === 'capture' ? captureAfter(pos, m, marked) : saveAfter(pos, m, marked));
};

describe('lot D : connexions et courses aux libertés', () => {
  it('lisibles, en 9 × 9, Noir au trait, difficultés croissantes de 600 à 1300', () => {
    expect(all.map(p => p.id)).toEqual(Object.keys(GOAL));
    expect(all).toHaveLength(LOT_D.length);
    let prev = 0;
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toBeTruthy();
      expect(p.difficulty).toBeGreaterThanOrEqual(600);
      expect(p.difficulty).toBeLessThanOrEqual(1300);
      expect(p.difficulty).toBeGreaterThan(prev);
      prev = p.difficulty;
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
      const found = winningMoves(startOf(p).pos, wins(p)).map(m => toLabel(m, 9)).sort();
      expect(found, p.id).toEqual(p.answers.map(a => toLabel(a, 9)).sort());
    }
  }, 30000);

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260927170400_lot_d_connexions_semeai.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    const q = (s: string) => s.replace(/'/g, "''");
    const tuples = LOT_D.map(row =>
      `('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    for (const t of tuples) expect(sql).toContain(t);
    expect(sql.match(/\('d\d\d', null, 9,/g)).toHaveLength(LOT_D.length);
  });
});

describe('chaque problème, coup par coup', () => {
  it('d01 : D4 relie au grand groupe ; D3 se remplit une liberté et Blanc capture en D4', () => {
    const p = pz('d01'), [s] = startOf(p).marked, { pos } = startOf(p);
    expect(libs(pos, s)).toBe(2);
    const r = ok(play(pos, at('D4')));
    expect(groupAt(r.board, 9, s).stones).toContain(at('E4'));
    expect(captureWorks(r, s)).toBe(false);
    // Erreur D3 : une seule liberté, Blanc capture en D4.
    expect(seq(pos, 'D3', 'D4').board[s]).toBe(0);
    // Refutation : Blanc coupe en D4 ; si Noir prend D4 en D3, Blanc reprend trois pierres en D4 (pas un ko).
    const cut = seq(pos, 'passe', 'D4');
    expect(libs(cut, s)).toBe(1);
    const take = seq(cut, 'D3');
    expect(take.captures[1]).toBe(1);
    expect(take.ko).toBe(-1);
    const back = seq(take, 'D4');
    expect(back.board[s]).toBe(0);
    expect(back.captures[2]).toBe(3);
  });

  it('d02 : E3 donne trois libertés aux pierres de coupe ; sinon Blanc les capture en E3', () => {
    const p = pz('d02'), [s] = startOf(p).marked, { pos } = startOf(p);
    expect(libs(pos, s)).toBe(1);
    const r = ok(play(pos, at('E3')));
    expect(libs(r, s)).toBe(3);
    expect(captureWorks(r, s)).toBe(false);
    for (const m of legalMoves(pos).filter(m => m !== at('E3'))) expect(ok(play(ok(play(pos, m)), at('E3'))).board[s], toLabel(m, 9)).toBe(0);
  });

  it('d05 : deux libertés contre deux ; A2 met Blanc en atari, A1 marche aussi (Blanc prend en A2 mais reste en atari)', () => {
    const p = pz('d05'), [t] = startOf(p).marked, { pos } = startOf(p), k = at('C1');
    expect(libs(pos, t)).toBe(2);
    expect(libs(pos, k)).toBe(2);
    const a2 = ok(play(pos, at('A2')));
    expect(libs(a2, t)).toBe(1);
    expect(defenceFails(a2, t, 6)).toBe(true);
    const a1 = seq(pos, 'A1', 'A2');
    expect(libs(a1, t)).toBe(1);
    expect(seq(a1, 'A1').board[t]).toBe(0);
    // Réfutation : Noir passe, Blanc prend D2, et Blanc capture le groupe noir en premier.
    const lost = seq(pos, 'passe', 'D2', 'A2', 'D1');
    expect(lost.board[k]).toBe(0);
  });

  it('d07 : trois libertés contre trois, celui qui joue d’abord gagne', () => {
    const p = pz('d07'), [t] = startOf(p).marked, { pos } = startOf(p), k = at('C1');
    expect(libs(pos, t)).toBe(3);
    expect(libs(pos, k)).toBe(3);
    // Après A3, chaque coup blanc sur les libertés noires reçoit la réponse sur les siennes.
    const r = seq(pos, 'A3', 'D3', 'A2', 'D2', 'A1');
    expect(r.board[t]).toBe(0);
    expect(r.board[k]).toBe(1);
    // Réfutation : Noir passe, Blanc gagne d'un coup.
    const lost = seq(pos, 'passe', 'D3', 'A3', 'D2', 'A2', 'D1');
    expect(lost.board[k]).toBe(0);
  });

  it('d10 : libertés extérieures d’abord ; remplir la liberté commune C1 perd', () => {
    const p = pz('d10'), [t] = startOf(p).marked, { pos } = startOf(p), k = at('C2');
    expect(libs(pos, t)).toBe(3);
    expect(libs(pos, k)).toBe(3);
    // La liberté commune C1 touche les deux groupes.
    expect(groupAt(pos.board, 9, t).liberties.has(at('C1'))).toBe(true);
    expect(groupAt(pos.board, 9, k).liberties.has(at('C1'))).toBe(true);
    const a2 = ok(play(pos, at('A2')));
    expect(libs(a2, t)).toBe(2);
    expect(libs(a2, k)).toBe(3);
    expect(seq(a2, 'E2', 'A1', 'E1', 'C1').board[t]).toBe(0);
    // A1 : Blanc prend en A2, mais n'a toujours que deux libertés.
    expect(libs(seq(pos, 'A1', 'A2'), t)).toBe(2);
    // Réfutation : après C1, deux libertés de chaque côté et Blanc au trait : E2, puis E1, capture le groupe noir.
    const c1 = ok(play(pos, at('C1')));
    expect(libs(c1, t)).toBe(2);
    expect(libs(c1, k)).toBe(2);
    expect(seq(c1, 'E2', 'A2', 'E1').board[k]).toBe(0);
  });

  it('d12 : l’œil E1 fait gagner la course ; C1 laisse l’œil seul, A1 est pris en A2', () => {
    const p = pz('d12'), [t] = startOf(p).marked, { pos } = startOf(p), k = at('C2');
    expect(libs(pos, t)).toBe(3);
    expect(libs(pos, k)).toBe(2);
    const a2 = ok(play(pos, at('A2')));
    // Blanc ne peut pas jouer dans l'œil, et C1 le met en atari.
    expect(play(a2, at('E1'))).toBe('suicide');
    expect(libs(seq(a2, 'C1'), t)).toBe(1);
    expect(seq(a2, 'passe', 'A1', 'passe', 'C1').board[t]).toBe(0);
    // Réfutations.
    expect(seq(pos, 'C1', 'E1').board[k]).toBe(0);
    const a1 = seq(pos, 'A1', 'A2');
    expect(a1.board[at('A1')]).toBe(0);
    expect(libs(a1, t)).toBe(2);
    expect(play(a1, at('A1'))).toBe('suicide');
  });

  it('d03 : E2 coupe et met en atari ; D1 laisse Blanc se relier en E2', () => {
    const p = pz('d03'), [t] = startOf(p).marked, { pos } = startOf(p);
    const e2 = ok(play(pos, at('E2')));
    expect(libs(e2, t)).toBe(1);
    const e1 = seq(e2, 'D1', 'E1');
    expect(e1.board[t]).toBe(0);
    expect(e1.captures[1]).toBe(3);
    const d1 = seq(pos, 'D1', 'E2');
    expect(groupAt(d1.board, 9, t).stones).toContain(at('F2'));
    expect(captureWorks(d1, t)).toBe(false);
  });

  it('d11 : quatre contre quatre avec une liberté commune ; C1 d’abord perd', () => {
    const p = pz('d11'), [t] = startOf(p).marked, { pos } = startOf(p), k = at('C2');
    expect(libs(pos, t)).toBe(4);
    expect(libs(pos, k)).toBe(4);
    const r = seq(pos, 'A3', 'D3', 'A2', 'E2', 'A1', 'E1');
    expect(libs(r, t)).toBe(1);
    expect(libs(r, k)).toBe(1);
    expect(seq(r, 'C1').board[t]).toBe(0);
    expect(seq(pos, 'C1', 'D3', 'A3', 'E2', 'A2', 'E1').board[k]).toBe(0);
  });

  it('d04 : F8 coupe sur le bord ; E9 laisse Blanc se relier en F8', () => {
    const p = pz('d04'), [t] = startOf(p).marked, { pos } = startOf(p);
    expect(libs(ok(play(pos, at('F8'))), t)).toBe(1);
    const r = seq(pos, 'F8', 'E9', 'F9');
    expect(r.board[t]).toBe(0);
    expect(r.captures[1]).toBe(4);
    const e9 = seq(pos, 'E9', 'F8');
    expect(groupAt(e9.board, 9, t).stones).toContain(at('G8'));
    expect(captureWorks(e9, t)).toBe(false);
  });

  it('d08 : quatre libertés contre quatre dans le coin, sans liberté commune', () => {
    const p = pz('d08'), [t] = startOf(p).marked, { pos } = startOf(p), k = at('G9');
    expect(libs(pos, t)).toBe(4);
    expect(libs(pos, k)).toBe(4);
    const shared = [...groupAt(pos.board, 9, t).liberties].filter(l => groupAt(pos.board, 9, k).liberties.has(l));
    expect(shared).toEqual([]);
    expect(seq(pos, 'J7', 'F7', 'J8', 'F8', 'J6', 'F9', 'J9').board[t]).toBe(0);
    expect(seq(pos, 'passe', 'F7', 'J7', 'F8', 'J8', 'F9', 'J6', 'F6').board[k]).toBe(0);
  });

  it('d09 : une liberté extérieure et une commune de chaque côté ; G1 perd', () => {
    const p = pz('d09'), [t] = startOf(p).marked, { pos } = startOf(p), k = at('G2');
    expect(libs(pos, t)).toBe(2);
    expect(libs(pos, k)).toBe(2);
    const j1 = ok(play(pos, at('J1')));
    expect(libs(j1, t)).toBe(1);
    expect(play(j1, at('G1'))).toBe('suicide');
    expect(seq(j1, 'E1', 'G1').board[t]).toBe(0);
    expect(seq(pos, 'G1', 'E1').board[k]).toBe(0);
  });

  it('d06 : G4 coupe avant de prendre ; F5 prend une pierre mais F4 s’échappe en G4', () => {
    const p = pz('d06'), [a, b] = startOf(p).marked, { pos } = startOf(p);
    const g4 = ok(play(pos, at('G4')));
    expect(libs(g4, a)).toBe(1);
    expect(libs(g4, b)).toBe(1);
    const joined = seq(g4, 'F5');
    expect(libs(joined, a)).toBe(1);
    const r = seq(joined, 'F6');
    expect(r.board[a]).toBe(0);
    expect(r.board[b]).toBe(0);
    const f5 = ok(play(pos, at('F5')));
    expect(f5.board[a]).toBe(0);
    const out = seq(f5, 'G4');
    expect(groupAt(out.board, 9, b).stones).toContain(at('G3'));
    expect(captureWorks(out, b)).toBe(false);
  });

  it('d13 : l’œil et la liberté commune battent quatre libertés', () => {
    const p = pz('d13'), [t] = startOf(p).marked, { pos } = startOf(p), k = at('G8');
    expect(libs(pos, t)).toBe(4);
    expect(libs(pos, k)).toBe(3);
    const j8 = ok(play(pos, at('J8')));
    expect(play(j8, at('E9'))).toBe('suicide');
    expect(libs(j8, t)).toBe(3);
    expect(libs(seq(j8, 'G9'), t)).toBe(2);
    expect(seq(j8, 'C8', 'J7', 'passe', 'J9', 'passe', 'G9').board[t]).toBe(0);
  });
});
