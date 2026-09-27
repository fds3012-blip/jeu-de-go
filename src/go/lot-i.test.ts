// Issue #136, lot I : preuve de chaque problème de vie et mort (i01…) avec le moteur de règles.
// Même méthode que le lot C (src/go/lecteurs-lot-c.ts) : recherche complète dans l'espace clos. Le défenseur gagne
// s'il atteint deux vrais yeux, l'attaquant s'il capture le groupe marqué ; une double passe ne compte pour personne,
// donc ni seki ni ko ne sont acceptés. Aucun doublon (8 symétries, marques ignorées), migration identique au fichier.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_I from '../content/lots/i-vie-et-mort-3';
import { ALL_PUZZLES } from '../content/puzzles';
import { checkAnswer, parsePuzzles, startOf } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { solve, winningMoves, zoneOf } from './lecteurs-lot-c';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { groupAt, play, type Position } from './rules';

const all = parsePuzzles(LOT_I);
const at = (l: string) => fromLabel(l, 9);
const label = (m: number) => (m < 0 ? 'passe' : toLabel(m, 9));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const goalOf = (prompt: string): 'vivre' | 'tuer' => (prompt.startsWith('Noir joue et vit') ? 'vivre' : 'tuer');
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;

/** Réplique de Blanc annoncée par `setup.refutation` après une erreur. */
const REPLY: Record<string, string> = { i01: 'E2', i02: 'B1', i03: 'B1', i04: 'B1', i05: 'E2' };

describe('lot I : vie et mort de haut niveau (issue #136)', () => {
  it('problèmes i01, i02… sans trou, 9 × 9, Noir au trait, difficulté croissante de 1100 à 1500', () => {
    expect(all).toHaveLength(LOT_I.length);
    expect(all.map(p => p.id)).toEqual(LOT_I.map((_, i) => `i${String(i + 1).padStart(2, '0')}`));
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
