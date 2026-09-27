// Issue #136, lot I : preuve de chaque problème (vie et mort, puis captures) avec le moteur de règles.
// Même méthode que le lot C (src/go/lecteurs-lot-c.ts) : recherche complète dans l'espace clos. Le défenseur gagne
// s'il atteint deux vrais yeux, l'attaquant s'il capture le groupe marqué ; une double passe ne compte pour personne,
// donc ni seki ni ko ne sont acceptés. Aucun doublon (8 symétries, marques ignorées), migration identique au fichier.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_I_CAP from '../content/lots/i-captures';
import LOT_I_VM from '../content/lots/i-vie-et-mort-3';
import { ALL_PUZZLES } from '../content/puzzles';
import { checkAnswer, parsePuzzles, startOf } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { solve, winningMoves, zoneOf } from './lecteurs-lot-c';
import { whiteFails } from './lecteurs-lot-a';
import { captureWinners, plainKey, symmetries } from './lecteurs-lot-e';
import { groupAt, play, type Position } from './rules';
import { hasTwoEyes } from './tactics';

const LOT_I = [...LOT_I_VM, ...LOT_I_CAP];
const all = parsePuzzles(LOT_I_VM);
const at = (l: string) => fromLabel(l, 9);
const label = (m: number) => (m < 0 ? 'passe' : toLabel(m, 9));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const goalOf = (prompt: string): 'vivre' | 'tuer' => (prompt.startsWith('Noir joue et vit') ? 'vivre' : 'tuer');
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;

/** Réplique de Blanc annoncée par `setup.refutation` après une erreur. */
const REPLY: Record<string, string> = { i01: 'E2', i02: 'B1', i03: 'B1', i04: 'E1', i05: 'B1', i06: 'E1', i07: 'B1', i08: 'E2' };

describe('lot I : vie et mort de haut niveau (issue #136)', () => {
  it('problèmes i01, i02… sans trou, 9 × 9, Noir au trait, difficulté croissante de 1100 à 1500', () => {
    expect(all).toHaveLength(LOT_I_VM.length);
    expect(LOT_I.map(r => r.id)).toEqual(LOT_I.map((_, i) => `i${String(i + 1).padStart(2, '0')}`));
    expect(Object.keys(REPLY).sort()).toEqual(all.map(p => p.id).sort());
    let prev = 0;
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toBeTruthy();
      expect(p.explanation, p.id).toBeTruthy();
      expect(p.prompt, p.id).toMatch(/^Noir joue et (vit|tue)\./);
      expect(p.difficulty).toBeGreaterThanOrEqual(prev);
      expect(p.difficulty).toBeGreaterThanOrEqual(1100);
      expect(p.difficulty).toBeLessThanOrEqual(1500);
      prev = p.difficulty;
    }
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées) déjà utilisés', () => {
    const others = ALL_PUZZLES.filter(r => !/^i\d\d$/.test(r.id));
    expect(others.length).toBeGreaterThanOrEqual(107);
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_I) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  for (const p of all) {
    const goal = goalOf(p.prompt);
    describe(`${p.id} (${goal})`, () => {
      const { pos, marked } = startOf(p);
      const t = marked[0];

      it('position de départ légale : chaque chaîne a une liberté, pas de ko, une seule pierre marquée de la couleur attendue', () => {
        expect(pos.ko).toBe(-1);
        expect(marked).toHaveLength(1);
        expect(pos.board[t]).toBe(goal === 'vivre' ? 1 : 2);
        for (let q = 0; q < 81; q++) if (pos.board[q]) expect(groupAt(pos.board, 9, q).liberties.size, label(q)).toBeGreaterThan(0);
        for (const a of p.answers) expect(checkAnswer(p, a).kind).toBe('ok');
      });

      it('espace vraiment clos : petit, et chaque mur de l’attaquant garde au moins deux libertés dehors', () => {
        const z = zoneOf(pos, t), inZone = new Set(z.cells), d = pos.board[t];
        expect(z.cells.length).toBeLessThanOrEqual(20);
        expect(z.walls.length).toBeGreaterThan(0);
        for (const w of z.walls) expect(w.outside).toBeGreaterThanOrEqual(2);
        for (const c of z.cells) for (const r of groupAt(pos.board, 9, c).stones) if (pos.board[r] === d) expect(inZone.has(r)).toBe(true);
        for (const w of z.walls) for (const s of w.stones) expect(inZone.has(s)).toBe(false);
      });

      it('le problème en est un : si Noir passe, Blanc au trait atteint son but', () => {
        const { cells } = zoneOf(pos, t);
        expect(solve(ok(play(pos, -1)), t, cells)).toBe(goal === 'vivre' ? -1 : 1);
      });

      it('les réponses acceptées sont exactement les coups gagnants, et le ko n’y change rien', () => {
        const win = winningMoves(pos, t, goal);
        expect(win.map(label).sort()).toEqual(p.answers.map(label).sort());
        expect(winningMoves(pos, t, goal, { ko: false }).map(label).sort()).toEqual(win.map(label).sort());
        expect(win).not.toContain(-1);
      });

      it('après la réponse, l’objectif est atteint contre toute défense de Blanc', () => {
        const { cells } = zoneOf(pos, t);
        for (const a of p.answers) {
          const r = ok(play(pos, a));
          expect(solve(r, t, cells)).toBe(goal === 'vivre' ? 1 : -1);
          expect(solve(r, t, cells, { ko: false })).toBe(goal === 'vivre' ? 1 : -1);
        }
      });

      it(`la réfutation dit vrai : après toute erreur, Blanc répond ${REPLY[p.id]} et gagne`, () => {
        const { cells } = zoneOf(pos, t), reply = at(REPLY[p.id]);
        expect(p.refutation).toContain(`Blanc joue ${REPLY[p.id]}`);
        const wrong = [...cells.filter(c => pos.board[c] === 0 && !p.answers.includes(c)), -1];
        for (const m of wrong) {
          const r = play(pos, m);
          if (typeof r === 'string') continue;
          const after = ok(play(r, reply));
          expect(solve(after, t, cells), `${p.id} ${label(m)}`).toBe(goal === 'vivre' ? -1 : 1);
          // Même si toute prise qui crée un ko est interdite, Noir n'atteint pas son but.
          expect(solve(after, t, cells, { ko: false }), `${p.id} ${label(m)} sans ko`).not.toBe(goal === 'vivre' ? 1 : -1);
        }
      });
    });
  }

  describe('les suites des explications', () => {
    const pz = (id: string) => all.find(p => p.id === id)!;
    const seq = (pos: Position, ...moves: string[]) => moves.reduce((q, m) => ok(play(q, m === 'passe' ? -1 : at(m))), pos);
    const libs = (pos: Position, l: string) => groupAt(pos.board, 9, at(l)).liberties.size;
    /** Coups noirs qui gagnent encore après la suite `moves` (Noir au trait). */
    const replies = (id: string, ...moves: string[]) => {
      const p = pz(id), { pos, marked } = startOf(p), { cells } = zoneOf(pos, marked[0]), r = seq(pos, ...moves);
      const target = goalOf(p.prompt) === 'vivre' ? 1 : -1;
      return [...cells.filter(c => r.board[c] === 0), -1].filter(m => {
        const x = play(r, m);
        return typeof x !== 'string' && solve(x, marked[0], cells) === target;
      }).map(label).sort();
    };

    it('i02 : B1 fait deux yeux d’un coup, A1 et C1', () => {
      const p = pz('i02'), { pos, marked } = startOf(p);
      expect(hasTwoEyes(seq(pos, 'B1'), marked[0])).toBe(true);
    });

    it('i03 : B1 met C1 en atari ; si Blanc s’allonge en D1, E1 capture les deux pierres', () => {
      const { pos } = startOf(pz('i03')), b1 = seq(pos, 'B1');
      expect(libs(b1, 'C1')).toBe(1);
      const d1 = seq(b1, 'D1');
      expect(libs(d1, 'C1')).toBe(1);
      const e1 = seq(d1, 'E1');
      expect(e1.board[at('C1')]).toBe(0);
      expect(e1.board[at('D1')]).toBe(0);
    });

    it('i04 : E1 met D1 en atari ; si Blanc s’allonge en C1, B1 capture les deux pierres ; sinon C1 capture D1', () => {
      const { pos } = startOf(pz('i04')), e1 = seq(pos, 'E1');
      expect(libs(e1, 'D1')).toBe(1);
      const b1 = seq(e1, 'C1', 'B1');
      expect(b1.board[at('C1')]).toBe(0);
      expect(b1.board[at('D1')]).toBe(0);
      expect(seq(e1, 'passe', 'C1').board[at('D1')]).toBe(0);
    });

    it('i05 : après B1, F1 et G1 sont deux points équivalents à droite', () => {
      expect(replies('i05', 'B1', 'F1')).toEqual(['G1']);
      expect(replies('i05', 'B1', 'G1')).toEqual(['F1']);
    });

    it('i06 : E1 garde deux libertés, D1 et F1 ; en D1, la pierre n’en a qu’une et Blanc la prend en E1', () => {
      const { pos } = startOf(pz('i06'));
      expect([...groupAt(seq(pos, 'E1').board, 9, at('E1')).liberties].map(label).sort()).toEqual(['D1', 'F1']);
      const d1 = seq(pos, 'D1');
      expect(libs(d1, 'D1')).toBe(1);
      expect(seq(d1, 'E1').board[at('D1')]).toBe(0);
    });

    it('i07 : après B1, si Blanc joue F1, Noir joue H1, et inversement', () => {
      expect(replies('i07', 'B1', 'F1')).toEqual(['H1']);
      expect(replies('i07', 'B1', 'H1')).toEqual(['F1']);
    });
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260928000100_lot_i.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('i\d\d', null, 9,/g)).toHaveLength(LOT_I.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_I) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });
});

// Captures : lecteur exact du lot A (tous les coups légaux de Blanc et la passe ; Noir capture en au plus k coups).
describe('lot I : captures en trois coups (échelle, filet)', () => {
  const caps = parsePuzzles(LOT_I_CAP), K = 3;
  const pz = (id: string) => caps.find(p => p.id === id)!;
  const seq = (pos: Position, ...moves: string[]) => moves.reduce((q, m) => ok(play(q, at(m))), pos);
  const libs = (pos: Position, l: string) => groupAt(pos.board, 9, at(l)).liberties.size;

  it('en 9 × 9, Noir au trait, difficulté 400 à 600 croissante, une pierre blanche marquée, textes complets', () => {
    expect(caps).toHaveLength(LOT_I_CAP.length);
    let prev = 0;
    for (const p of caps) {
      const { pos, marked } = startOf(p);
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(pos.ko).toBe(-1);
      expect(p.difficulty).toBeGreaterThan(prev);
      expect(p.difficulty).toBeGreaterThanOrEqual(400);
      expect(p.difficulty).toBeLessThanOrEqual(600);
      prev = p.difficulty;
      expect(p.prompt).toBe('Capture la pierre marquée en trois coups au plus.');
      expect(p.refutation, p.id).toBeTruthy();
      expect(p.explanation, p.id).toMatch(/libert/);
      expect(marked).toHaveLength(1);
      expect(pos.board[marked[0]]).toBe(2);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(groupAt(pos.board, 9, q).liberties.size, `${p.id} ${label(q)}`).toBeGreaterThan(0);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
    }
  });

  for (const row of LOT_I_CAP) {
    it(`${row.id} : les réponses capturent quoi que fasse Blanc, et ce sont les seuls coups gagnants`, () => {
      const p = pz(row.id), { pos, marked } = startOf(p);
      for (const a of row.answers) expect(whiteFails(ok(play(pos, at(a))), marked, K - 1), `${p.id} ${a}`).toBe(true);
      expect(captureWinners(pos, marked, K)).toEqual([...row.answers].sort());
    }, 60000);
  }

  it('i09 : D2 puis C1, D1 : de nouveau en atari ; B1, A1 capture les trois pierres. En C1, Blanc s’allonge en D2 avec trois libertés', () => {
    const { pos } = startOf(pz('i09'));
    expect(libs(seq(pos, 'D2'), 'C2')).toBe(1);
    const d1 = seq(pos, 'D2', 'C1', 'D1');
    expect(libs(d1, 'C2')).toBe(1);
    const a1 = seq(d1, 'B1', 'A1');
    for (const l of ['C2', 'C1', 'B1']) expect(a1.board[at(l)], l).toBe(0);
    expect(libs(seq(pos, 'C1', 'D2'), 'C2')).toBe(3);
  });

  it('i10 : le filet D4 ; C4 puis C5, ou D3 puis E3 : atari, puis capture. Un atari direct laisse deux libertés', () => {
    const { pos } = startOf(pz('i10')), c3 = at('C3');
    const a = seq(pos, 'D4', 'C4', 'C5');
    expect(libs(a, 'C3')).toBe(1);
    expect(seq(a, 'D3', 'E3').board[c3]).toBe(0);
    const b = seq(pos, 'D4', 'D3', 'E3');
    expect(libs(b, 'C3')).toBe(1);
    expect(seq(b, 'C4', 'C5').board[c3]).toBe(0);
    expect(libs(seq(pos, 'C4', 'D3'), 'C3')).toBe(2);
    expect(libs(seq(pos, 'D3', 'C4'), 'C3')).toBe(2);
  });
});
