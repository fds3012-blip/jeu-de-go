// Issue #91, lot C : preuve de chaque problème de vie et mort (m01 à m13) avec le moteur de règles.
// Recherche complète dans l'espace clos (src/go/lecteurs-lot-c.ts) : le défenseur gagne s'il atteint deux vrais yeux,
// l'attaquant s'il capture le groupe marqué. Une double passe ne compte pour personne : ni seki ni ko ne sont acceptés.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_C from '../content/lots/c-vie-et-mort';
import { checkAnswer, parsePuzzles, startOf } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { solve, winningMoves, zoneOf } from './lecteurs-lot-c';
import { groupAt, play, type Position } from './rules';
import { hasTwoEyes } from './tactics';

const all = parsePuzzles(LOT_C);
const at = (l: string) => fromLabel(l, 9);
const label = (m: number) => (m < 0 ? 'passe' : toLabel(m, 9));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const goalOf = (prompt: string): 'vivre' | 'tuer' => (prompt.startsWith('Noir joue et vit') ? 'vivre' : 'tuer');

/** Réplique de Blanc annoncée par `setup.refutation` après une erreur. */
const REPLY: Record<string, string> = { m01: 'E1', m02: 'A5', m03: 'E1', m04: 'F9', m05: 'A1', m06: 'E1', m07: 'B1', m08: 'C8', m09: 'D8', m10: 'E1', m11: 'E1', m12: 'E2', m13: 'E2' };

describe('lot C : vie et mort (issue #91)', () => {
  it('problèmes m01, m02… sans trou, 9 × 9, Noir au trait, difficulté croissante de 500 à 1300', () => {
    expect(all).toHaveLength(LOT_C.length);
    expect(all.map(p => p.id)).toEqual(LOT_C.map((_, i) => `m${String(i + 1).padStart(2, '0')}`));
    let prev = 0;
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toBeTruthy();
      expect(p.explanation, p.id).toBeTruthy();
      expect(p.prompt, p.id).toMatch(/^Noir joue et (vit|tue)\./);
      expect(p.difficulty).toBeGreaterThan(prev);
      expect(p.difficulty).toBeGreaterThanOrEqual(500);
      expect(p.difficulty).toBeLessThanOrEqual(1300);
      prev = p.difficulty;
    }
  });

  for (const p of all) {
    const goal = goalOf(p.prompt);
    describe(`${p.id} (${goal})`, () => {
      const { pos, marked } = startOf(p);
      const t = marked[0];

      it('position de départ légale : chaque chaîne a une liberté, une seule pierre marquée, de la couleur attendue', () => {
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
        // Aucune pierre du défenseur et aucune case vide de la zone ne touche l'extérieur sans passer par un mur.
        for (const c of z.cells) for (const r of groupAt(pos.board, 9, c).stones) if (pos.board[r] === d) expect(inZone.has(r)).toBe(true);
        for (const w of z.walls) for (const s of w.stones) expect(inZone.has(s)).toBe(false);
      });

      it('les réponses acceptées sont exactement les coups gagnants, et le ko n’y change rien', () => {
        const win = winningMoves(pos, t, goal);
        expect(win.map(label).sort()).toEqual(p.answers.map(label).sort());
        // Mêmes coups gagnants si toute prise qui crée un ko est interdite : aucune solution ne passe par un ko.
        expect(winningMoves(pos, t, goal, { ko: false }).map(label).sort()).toEqual(win.map(label).sort());
        // La passe ne gagne pas : un coup hors de la zone, qui ne change rien dedans, ne gagne pas non plus.
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
        const wrong = [...cells.filter(c => pos.board[c] === 0 && !p.answers.includes(c)), -1];
        for (const m of wrong) {
          const r = play(pos, m);
          if (typeof r === 'string') continue;
          const after = ok(play(r, reply));
          // Vivre : le groupe noir finit capturé. Tuer : le groupe blanc vit sans condition.
          expect(solve(after, t, cells), `${p.id} ${label(m)}`).toBe(goal === 'vivre' ? -1 : 1);
        }
      });
    });
  }

  it('problèmes « vivre » : la réponse mène à deux vrais yeux d’un point', () => {
    const eyes: Record<string, string[]> = { m01: ['E1'], m03: ['E1'], m06: ['E1', 'C1'], m10: ['E1'], m12: ['E2'] };
    for (const [id, line] of Object.entries(eyes)) {
      const p = all.find(q => q.id === id)!, { pos, marked } = startOf(p);
      let r = pos;
      for (const m of line) { r = ok(play(r, at(m))); if (r.toPlay === 2) r = ok(play(r, -1)); }
      expect(hasTwoEyes(r, marked[0]), id).toBe(true);
    }
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260927170300_lot_c_vie_mort.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('m\d\d', null, 9,/g)).toHaveLength(LOT_C.length);
    for (const row of LOT_C) {
      const q = (s: string) => s.replace(/'/g, "''");
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });
});
