// Issue #136, lot J : preuve de chaque problème avec le moteur de règles.
// Captures (j01 à j04) : lecteur exact (src/go/lecteurs-lot-j.ts), tous les coups légaux de Blanc et la passe, une
// fois avec le ko permis et une fois avec toute prise en ko interdite : le résultat doit être le même.
// Vie et mort (j05 à j11) : recherche complète dans l'espace clos (lecteur du lot C). Le défenseur gagne s'il atteint
// deux vrais yeux, l'attaquant s'il capture le groupe marqué ; une double passe ne compte pour personne, donc ni seki
// ni ko ne sont acceptés. Aucun doublon (8 symétries, marques ignorées), migration identique aux fichiers.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_J_CAP from '../content/lots/j-captures';
import LOT_J_VM from '../content/lots/j-vie-et-mort';
import { ALL_PUZZLES } from '../content/puzzles';
import { checkAnswer, parsePuzzles, startOf } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { solve, winningMoves, zoneOf } from './lecteurs-lot-c';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { blackCaptures, captureWinners, whiteFails } from './lecteurs-lot-j';
import { groupAt, play, type Position } from './rules';
import { hasTwoEyes } from './tactics';

const LOT_J = [...LOT_J_CAP, ...LOT_J_VM];
const at = (l: string) => fromLabel(l, 9);
const label = (m: number) => (m < 0 ? 'passe' : toLabel(m, 9));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const seq = (pos: Position, ...moves: string[]) => moves.reduce((q, m) => ok(play(q, m === 'passe' ? -1 : at(m))), pos);
const libs = (pos: Position, l: string) => groupAt(pos.board, 9, at(l)).liberties.size;
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;
const NO_KO = { ko: false };

describe('lot J : identifiants, doublons, migration (issue #136)', () => {
  it('j01, j02… sans trou, tous en 9 × 9, Noir au trait', () => {
    expect(LOT_J.map(r => r.id)).toEqual(LOT_J.map((_, i) => `j${String(i + 1).padStart(2, '0')}`));
    expect(parsePuzzles(LOT_J)).toHaveLength(LOT_J.length);
    for (const p of parsePuzzles(LOT_J)) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toBeTruthy();
      expect(p.explanation, p.id).toBeTruthy();
    }
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées) déjà utilisés', () => {
    const others = ALL_PUZZLES.filter(r => !/^j\d\d$/.test(r.id));
    expect(others.length).toBeGreaterThanOrEqual(117);
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_J) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260928020100_lot_j.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('j\d\d', null, 9,/g)).toHaveLength(LOT_J.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_J) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });
});

describe('lot J : captures en deux coups (double atari par la coupe, prise en retour)', () => {
  const caps = parsePuzzles(LOT_J_CAP), K = 2;
  const pz = (id: string) => caps.find(p => p.id === id)!;

  it('difficulté 600 à 800 croissante, pierres blanches marquées, départ légal sans ko ni atari', () => {
    let prev = 0;
    for (const p of caps) {
      const { pos, marked } = startOf(p);
      expect(pos.ko).toBe(-1);
      expect(p.difficulty).toBeGreaterThan(prev);
      expect(p.difficulty).toBeGreaterThanOrEqual(600);
      expect(p.difficulty).toBeLessThanOrEqual(800);
      prev = p.difficulty;
      expect(p.prompt).toBe(marked.length > 1 ? 'Capture une des pierres marquées en deux coups au plus.' : 'Capture la pierre marquée en deux coups au plus.');
      for (const t of marked) {
        expect(pos.board[t]).toBe(2);
        expect(groupAt(pos.board, 9, t).liberties.size, `${p.id} ${label(t)}`).toBeGreaterThanOrEqual(2);
      }
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(groupAt(pos.board, 9, q).liberties.size, `${p.id} ${label(q)}`).toBeGreaterThan(0);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
    }
  });

  for (const row of LOT_J_CAP) {
    it(`${row.id} : pas de prise en un coup ; les réponses capturent contre toute défense, avec ou sans ko, et ce sont les seuls coups gagnants`, () => {
      const p = pz(row.id), { pos, marked } = startOf(p);
      expect(captureWinners(pos, marked, 1)).toEqual([]);
      expect(blackCaptures(pos, marked, 1)).toBe(false);
      for (const a of row.answers) {
        expect(whiteFails(ok(play(pos, at(a))), marked, K - 1), `${p.id} ${a}`).toBe(true);
        expect(whiteFails(ok(play(pos, at(a))), marked, K - 1, NO_KO), `${p.id} ${a} sans ko`).toBe(true);
      }
      expect(captureWinners(pos, marked, K)).toEqual([...row.answers].sort());
      expect(captureWinners(pos, marked, K, NO_KO)).toEqual([...row.answers].sort());
    }, 60000);
  }

  it('j01 : C2 met B2 (liberté B1) et D2 (liberté E2) en atari ; un seul atari, et Blanc relie en C2 avec deux libertés', () => {
    const { pos } = startOf(pz('j01')), c2 = seq(pos, 'C2');
    expect([...groupAt(c2.board, 9, at('B2')).liberties].map(label)).toEqual(['B1']);
    expect([...groupAt(c2.board, 9, at('D2')).liberties].map(label)).toEqual(['E2']);
    for (const m of ['B1', 'E2']) expect(libs(seq(pos, m, 'C2'), 'C2'), m).toBe(2);
  });

  it('j02 : prise en retour. B1, Blanc prend en B2 (pas de ko), B1 capture trois pierres. En B2, Blanc relie en B1 avec trois libertés', () => {
    const { pos } = startOf(pz('j02')), b1 = seq(pos, 'B1');
    expect(libs(b1, 'B1')).toBe(1);
    expect(libs(b1, 'A2')).toBe(1);
    const took = seq(b1, 'B2');
    expect(took.board[at('B1')]).toBe(0);
    expect(took.ko).toBe(-1);
    expect(libs(took, 'A2')).toBe(1);
    const back = seq(took, 'B1');
    expect(back.captures[1] - took.captures[1]).toBe(3);
    expect(back.board[at('A2')]).toBe(0);
    expect(libs(seq(pos, 'B2', 'B1'), 'A2')).toBe(3);
  });

  it('j03 : prise en retour. E1, Blanc prend en F1 (pas de ko), E1 capture trois pierres. En F1, Blanc relie en E1 : libertés B1 et C2', () => {
    const { pos } = startOf(pz('j03')), e1 = seq(pos, 'E1');
    expect(libs(e1, 'E1')).toBe(1);
    expect(libs(e1, 'E2')).toBe(1);
    const took = seq(e1, 'F1');
    expect(took.board[at('E1')]).toBe(0);
    expect(took.ko).toBe(-1);
    expect(libs(took, 'E2')).toBe(1);
    const back = seq(took, 'E1');
    expect(back.captures[1] - took.captures[1]).toBe(3);
    expect([...groupAt(seq(pos, 'F1', 'E1').board, 9, at('E2')).liberties].map(label).sort()).toEqual(['B1', 'C2']);
  });

  it('j04 : D2 met les deux groupes en atari (A1, E1) ; si Blanc prend C1 en D1, E1 capture ; un seul atari, et Blanc relie en D2', () => {
    const { pos } = startOf(pz('j04')), d2 = seq(pos, 'D2');
    expect([...groupAt(d2.board, 9, at('B2')).liberties].map(label)).toEqual(['A1']);
    expect([...groupAt(d2.board, 9, at('E2')).liberties].map(label)).toEqual(['E1']);
    expect(libs(d2, 'C1')).toBe(1);
    const d1 = seq(d2, 'D1');
    expect(d1.board[at('C1')]).toBe(0);
    expect(libs(d1, 'E2')).toBe(1);
    expect(seq(d1, 'E1').board[at('E2')]).toBe(0);
    for (const m of ['A1', 'E1']) {
      const r = seq(pos, m, 'D2');
      expect(blackCaptures(r, startOf(pz('j04')).marked, 1), m).toBe(false);
    }
  });
});

describe('lot J : vie et mort de 800 à 1000', () => {
  const all = parsePuzzles(LOT_J_VM);
  const goalOf = (prompt: string): 'vivre' | 'tuer' => (prompt.startsWith('Noir joue et vit') ? 'vivre' : 'tuer');
  /** Réplique de Blanc annoncée par `setup.refutation` : la même après toute erreur, ou une par erreur. */
  const REPLY: Record<string, string | Record<string, string>> = {
    j05: 'G1', j06: 'D3', j07: { A1: 'E1', C1: 'E1', D1: 'B1', passe: 'E1' }, j08: 'G1', j09: 'B1', j10: 'E1', j11: 'A1'
  };

  it('difficulté croissante de 800 à 1000, énoncés « Noir joue et vit / tue »', () => {
    expect(Object.keys(REPLY).sort()).toEqual(all.map(p => p.id).sort());
    let prev = 0;
    for (const p of all) {
      expect(p.prompt, p.id).toMatch(/^Noir joue et (vit|tue)\./);
      expect(p.difficulty).toBeGreaterThan(prev);
      expect(p.difficulty).toBeGreaterThanOrEqual(800);
      expect(p.difficulty).toBeLessThanOrEqual(1000);
      prev = p.difficulty;
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
        expect(winningMoves(pos, t, goal, NO_KO).map(label).sort()).toEqual(win.map(label).sort());
        expect(win).not.toContain(-1);
      });

      it('après la réponse, l’objectif est atteint contre toute défense de Blanc', () => {
        const { cells } = zoneOf(pos, t);
        for (const a of p.answers) {
          const r = ok(play(pos, a));
          expect(solve(r, t, cells)).toBe(goal === 'vivre' ? 1 : -1);
          expect(solve(r, t, cells, NO_KO)).toBe(goal === 'vivre' ? 1 : -1);
        }
      });

      it('la réfutation dit vrai : après toute erreur, Blanc joue la réplique annoncée et gagne', () => {
        const { cells } = zoneOf(pos, t), spec = REPLY[p.id];
        const replyTo = (m: number) => (typeof spec === 'string' ? spec : spec[label(m)]);
        for (const r of new Set(typeof spec === 'string' ? [spec] : Object.values(spec))) expect(p.refutation).toContain(`Blanc joue ${r}`);
        const wrong = [...cells.filter(c => pos.board[c] === 0 && !p.answers.includes(c)), -1];
        if (typeof spec !== 'string') expect(Object.keys(spec).sort()).toEqual(wrong.filter(m => typeof play(pos, m) !== 'string').map(label).sort());
        for (const m of wrong) {
          const r = play(pos, m);
          if (typeof r === 'string') continue;
          const after = ok(play(r, at(replyTo(m))));
          expect(solve(after, t, cells), `${p.id} ${label(m)}`).toBe(goal === 'vivre' ? -1 : 1);
          expect(solve(after, t, cells, NO_KO), `${p.id} ${label(m)} sans ko`).not.toBe(goal === 'vivre' ? 1 : -1);
        }
      });
    });
  }

  describe('les suites des explications', () => {
    const pz = (id: string) => all.find(p => p.id === id)!;
    const start = (id: string) => startOf(pz(id));
    /** Coups noirs qui gagnent encore après la suite `moves` (Noir au trait). */
    const replies = (id: string, ...moves: string[]) => {
      const p = pz(id), { pos, marked } = startOf(p), { cells } = zoneOf(pos, marked[0]), r = seq(pos, ...moves);
      const target = goalOf(p.prompt) === 'vivre' ? 1 : -1;
      return [...cells.filter(c => r.board[c] === 0), -1].filter(m => {
        const x = play(r, m);
        return typeof x !== 'string' && solve(x, marked[0], cells) === target;
      }).map(label).sort();
    };

    it('j05 : si Blanc joue G1, F1 est un œil et C1-D1 en donne un second : il vit ; en F1, ta pierre n’a qu’une liberté et Blanc la prend en G1', () => {
      const { pos, marked } = start('j05'), { cells } = zoneOf(pos, marked[0]), g1 = seq(pos, 'passe', 'G1');
      expect(solve(g1, marked[0], cells)).toBe(1);
      // Noir entre en C1 ou en D1 : Blanc répond sur l'autre point et a deux vrais yeux.
      expect(hasTwoEyes(seq(g1, 'C1', 'D1'), marked[0]) || seq(g1, 'C1', 'D1').board[at('C1')] === 0).toBe(true);
      expect(hasTwoEyes(seq(g1, 'D1', 'C1'), marked[0]) || seq(g1, 'D1', 'C1').board[at('D1')] === 0).toBe(true);
      const f1 = seq(pos, 'F1');
      expect(libs(f1, 'F1')).toBe(1);
      expect(seq(f1, 'G1').board[at('F1')]).toBe(0);
    });

    it('j06 : si Blanc joue D3, il a deux yeux (B2, D2) ; en D2, ta pierre n’a qu’une liberté et Blanc la prend en D3', () => {
      const { pos, marked } = start('j06');
      expect(hasTwoEyes(seq(pos, 'passe', 'D3'), marked[0])).toBe(true);
      const d2 = seq(pos, 'D2');
      expect(libs(d2, 'D2')).toBe(1);
      expect(seq(d2, 'D3').board[at('D2')]).toBe(0);
    });

    it('j07 : après E1, B1 et C1 sont deux points équivalents ; après B1, D1 et E1 aussi', () => {
      expect(replies('j07', 'E1', 'B1')).toEqual(['C1']);
      expect(replies('j07', 'E1', 'C1')).toEqual(['B1']);
      expect(replies('j07', 'B1', 'D1')).toEqual(['E1']);
      expect(replies('j07', 'B1', 'E1')).toEqual(['D1']);
    });

    it('j08 : F1 a deux libertés, E1 et G1 ; si Blanc joue G1, elle est en atari', () => {
      const { pos } = start('j08');
      expect([...groupAt(pos.board, 9, at('F1')).liberties].map(label).sort()).toEqual(['E1', 'G1']);
      expect(libs(seq(pos, 'passe', 'G1'), 'F1')).toBe(1);
    });

    it('j09 : si Blanc joue B1, il a deux yeux, B2 et A1', () => {
      const { pos, marked } = start('j09');
      expect(hasTwoEyes(seq(pos, 'passe', 'B1'), marked[0])).toBe(true);
    });

    it('j10 : A1 n’a qu’une liberté, B1 ; si Blanc joue E1 puis prend A1, il a deux yeux', () => {
      const { pos, marked } = start('j10');
      expect([...groupAt(pos.board, 9, at('A1')).liberties].map(label)).toEqual(['B1']);
      const r = seq(pos, 'passe', 'E1', 'passe', 'B1');
      expect(r.board[at('A1')]).toBe(0);
      expect(hasTwoEyes(r, marked[0])).toBe(true);
    });

    it('j11 : si Blanc joue A1, il a deux yeux, A2 et B1', () => {
      const { pos, marked } = start('j11');
      expect(hasTwoEyes(seq(pos, 'passe', 'A1'), marked[0])).toBe(true);
    });
  });
});
