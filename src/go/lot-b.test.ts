// Issue #91, lot B : preuve de chaque problème de techniques de capture avec le moteur de règles.
// Position légale, réponse gagnante contre toute défense légale de Blanc (passe comprise),
// et réponses acceptées = exactement l'ensemble des coups noirs gagnants.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_B from '../content/lots/b-techniques';
import { BASE_PUZZLES, PUZZLES_16 } from '../content/puzzles';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { capturedAgainstAll, winningMoves } from './lecteurs-lot-b';
import { groupAt, play, type Position } from './rules';
import { canEscape, hasTwoEyes, ladderWorks } from './tactics';

const all = parsePuzzles(LOT_B);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const libs = (pos: Position, p: number) => groupAt(pos.board, pos.size, p).liberties.size;
const answer = (p: Puzzle, l: string): Position => {
  const r = checkAnswer(p, at(l));
  if (r.kind !== 'ok') throw new Error(`${p.id} : ${l} refusé (${r.kind})`);
  return r.after;
};
/** Double menace : Noir gagne s'il prend l'une des pierres marquées ; sinon, la cible est la première pierre marquée. */
const DOUBLE_MENACE = new Set(['k08', 'k10']);
const targets = (p: Puzzle): number | number[] => DOUBLE_MENACE.has(p.id) ? startOf(p).marked : startOf(p).marked[0];
const labels =(ms: number[]) => ms.map(m => toLabel(m, 9)).sort();
/** Même position, avec une intersection modifiée. */
const withStone = (pos: Position, l: string, c: 0 | 1 | 2): Position => {
  const board = pos.board.slice();
  board[at(l)] = c;
  return { ...pos, board };
};

describe('lot B : techniques de capture', () => {
  it('identifiants, taille, trait, difficulté croissante de 600 à 1100', () => {
    expect(all.map(p => p.id)).toEqual(LOT_B.map(r => r.id));
    expect(all.length).toBe(LOT_B.length);
    let prev = 0;
    for (const p of all) {
      expect(p.id).toMatch(/^k\d\d$/);
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toBeTruthy();
      expect(p.explanation, p.id).toBeTruthy();
      expect(p.difficulty).toBeGreaterThanOrEqual(Math.max(600, prev));
      expect(p.difficulty).toBeLessThanOrEqual(1100);
      prev = p.difficulty;
    }
  });

  it('aucun doublon avec les problèmes existants', () => {
    const old = [...BASE_PUZZLES, ...PUZZLES_16];
    const key = (r: { setup: unknown }) => JSON.stringify((r.setup as { rows: string[] }).rows);
    for (const r of LOT_B) {
      expect(old.some(o => o.id === r.id)).toBe(false);
      expect(old.some(o => key(o) === key(r))).toBe(false);
    }
  });

  it('positions de départ légales : chaque chaîne a au moins une liberté, une pierre marquée blanche', () => {
    for (const p of all) {
      const { pos, marked } = startOf(p);
      expect(marked.length, p.id).toBeGreaterThan(0);
      expect(pos.board[marked[0]], p.id).toBe(2);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(libs(pos, q), `${p.id} ${q}`).toBeGreaterThan(0);
    }
  });

  it('chaque réponse gagne contre toutes les défenses légales de Blanc, passe comprise', () => {
    for (const p of all) {
      const t = targets(p);
      for (const a of labels(p.answers)) expect(capturedAgainstAll(answer(p, a), t), `${p.id} ${a}`).toBe(true);
    }
  });

  it.each(LOT_B.map(r => r.id))('%s : les réponses acceptées sont exactement les coups gagnants de Noir', id => {
    const p = pz(id), { pos } = startOf(p);
    expect(labels(winningMoves(pos, targets(p))), id).toEqual(labels(p.answers));
  }, 20000);

  it('la migration insère exactement ces problèmes, sans toucher aux anciens', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260927170200_lot_b_techniques.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    const q = (s: string) => s.replace(/'/g, "''");
    const rows = LOT_B.map(row => ` ('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    expect(sql).toContain(`values\n${rows.join(',\n')}\non conflict (id) do nothing;`);
    expect(sql.match(/^ \('k\d\d'/gm)?.length).toBe(LOT_B.length);
  });
});

describe('bord', () => {
  it('k02 : F2 laisse deux libertés sur la première ligne ; Blanc s’allonge, Noir remet en atari et capture', () => {
    const p = pz('k02'), { pos, marked: [t] } = startOf(p), r = answer(p, 'F2');
    expect(libs(pos, t)).toBe(3);
    expect(libs(r, t)).toBe(2);
    const d1 = ok(play(r, at('D1')));
    const c1 = ok(play(d1, at('C1')));
    expect(libs(c1, t)).toBe(1);
    const f1 = ok(play(c1, at('F1')));
    expect(libs(f1, t)).toBe(1);
    expect(ok(play(f1, at('G1'))).board[t]).toBe(0);
    const wrong = ok(play(ok(play(pos, at('D1'))), at('F2')));
    expect(libs(wrong, t)).toBeGreaterThanOrEqual(3);
  });
});

describe('échelles', () => {
  it('k01 : E2 lance une échelle le long du bord ; après F1, Blanc sort en E2', () => {
    const p = pz('k01'), t = startOf(p).marked[0], r = answer(p, 'E2');
    expect(libs(r, t)).toBe(1);
    expect(canEscape(r, t)).toBe(false);
    const f1 = ok(play(ok(play(startOf(p).pos, at('F1'))), at('E2')));
    expect(ladderWorks(f1, t)).toBe(false);
  });

  it('k03 : les deux mises en atari sont des échelles qui marchent', () => {
    const p = pz('k03'), t = startOf(p).marked[0];
    for (const a of ['E6', 'D5']) {
      const r = answer(p, a);
      expect(libs(r, t), a).toBe(1);
      expect(canEscape(r, t), a).toBe(false);
    }
  });

  it('k05 : la pierre blanche B3 casse l’échelle de E6, pas celle de D5', () => {
    const p = pz('k05'), { pos, marked: [t] } = startOf(p);
    expect(ladderWorks(pos, t)).toBe(true);
    const e6 = ok(play(pos, at('E6')));
    expect(canEscape(e6, t)).toBe(true);
    expect(canEscape(answer(p, 'D5'), t)).toBe(false);
    // Sans B3, E6 gagnerait aussi : c'est bien elle qui casse l'échelle.
    expect(canEscape(ok(play(withStone(pos, 'B3', 0), at('E6'))), t)).toBe(false);
  });

  it('k07 : la pierre relais G7 neutralise G8 ; sans elle, aucune échelle ne marche', () => {
    const p = pz('k07'), { pos, marked: [t] } = startOf(p);
    expect(canEscape(answer(p, 'D5'), t)).toBe(false);
    expect(canEscape(ok(play(pos, at('E6'))), t)).toBe(true);
    const sansRelais = withStone(pos, 'G7', 0);
    expect(ladderWorks(sansRelais, t)).toBe(false);
    expect(winningMoves(sansRelais, t)).toEqual([]);
  });
});

describe('pierre qui coupe', () => {
  it('k06 : E4 lance une échelle qui marche ; après F5, la pierre sort en E4 avec trois libertés', () => {
    const p = pz('k06'), { pos, marked: [t] } = startOf(p), r = answer(p, 'E4');
    expect(libs(r, t)).toBe(1);
    expect(canEscape(r, t)).toBe(false);
    const f5 = ok(play(ok(play(pos, at('F5'))), at('E4')));
    expect(libs(f5, t)).toBe(3);
  });
});

describe('manque de libertés et double menace', () => {
  it('k04 : après B1, Blanc ne peut prendre la pierre qu’en se mettant en atari ; sinon B1 lui donne deux yeux', () => {
    const p = pz('k04'), { pos, marked: [t] } = startOf(p), r = answer(p, 'B1');
    expect(libs(r, t)).toBe(2);
    for (const w of ['A1', 'C1']) {
      const x = ok(play(r, at(w)));
      expect(libs(x, t), w).toBe(1);
      const back = ok(play(x, at(w === 'A1' ? 'C1' : 'A1')));
      expect(back.board[t], w).toBe(0);
    }
    for (const b of ['A1', 'C1', 'F5']) expect(hasTwoEyes(ok(play(ok(play(pos, at(b))), at('B1'))), t), b).toBe(true);
  });

  it('k08 : E4 coupe en deux groupes à deux libertés ; sans E4, Blanc relie tout en E4', () => {
    const p = pz('k08'), { pos, marked } = startOf(p), r = answer(p, 'E4');
    expect(labels(marked)).toEqual(['D4', 'D5', 'F4']);
    expect(libs(r, at('D5'))).toBe(2);
    expect(libs(r, at('F4'))).toBe(2);
    const joined = ok(play(ok(play(pos, at('D6'))), at('E4')));
    expect(groupAt(joined.board, 9, at('D5')).stones).toContain(at('F4'));
  });
});

describe('double menace au bord', () => {
  it('k10 : après E3, Blanc ne peut pas protéger les deux côtés ; sans E3, Blanc prend la pierre qui coupe', () => {
    const p = pz('k10'), { pos } = startOf(p), r = answer(p, 'E3');
    const left = at('C2'), right = at('F2');
    expect(libs(r, at('E2'))).toBe(4);
    // Blanc sort à gauche : Noir ferme à droite, et le groupe de droite, à deux libertés, est pris contre toute défense.
    const d3 = ok(play(ok(play(r, at('D3'))), at('F3')));
    expect(libs(d3, right)).toBe(2);
    expect(capturedAgainstAll(d3, right)).toBe(true);
    const f3 = ok(play(ok(play(r, at('F3'))), at('D3')));
    expect(libs(f3, left)).toBe(2);
    expect(capturedAgainstAll(f3, left)).toBe(true);
    // Sans E3 : Blanc met la pierre E2 en atari en E3.
    const wrong = ok(play(ok(play(pos, at('D3'))), at('E3')));
    expect(libs(wrong, at('E2'))).toBe(1);
  });
});

describe('filet', () => {
  it('k09 : D6 enferme la pierre ; les deux sorties sont capturées, les atari directs échouent', () => {
    const p = pz('k09'), { pos, marked: [t] } = startOf(p), r = answer(p, 'D6');
    // Sortie E6 : E7 met en atari, Blanc s'allonge en D5, C5 capture.
    const e6 = ok(play(ok(play(r, at('E6'))), at('E7')));
    expect(libs(e6, t)).toBe(1);
    const d5 = ok(play(e6, at('D5')));
    expect(libs(d5, t)).toBe(1);
    expect(ok(play(d5, at('C5'))).board[t]).toBe(0);
    // Sortie D5 : C5 met en atari, Blanc s'allonge en E6, E7 capture.
    const c5 = ok(play(ok(play(r, at('D5'))), at('C5')));
    expect(libs(c5, t)).toBe(1);
    const e6b = ok(play(c5, at('E6')));
    expect(libs(e6b, t)).toBe(1);
    expect(ok(play(e6b, at('E7'))).board[t]).toBe(0);
    for (const direct of ['E6', 'D5']) expect(canEscape(ok(play(pos, at(direct))), t), direct).toBe(true);
  });
});
