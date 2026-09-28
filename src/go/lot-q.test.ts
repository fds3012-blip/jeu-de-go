// Issue #136, lot Q : preuve de chaque problème de vie et mort (600 à 850) avec l'outil src/go/preuve-vie-mort.ts.
// Recherche complète dans la zone du problème (points jouables listés ci-dessous), les deux camps pouvant passer.
// Vivant : deux vrais yeux au sens de Benson, ou plus aucun coup légal pour l'attaquant. Mort : capturé.
// Un ko, une répétition, une double passe ou la profondeur atteinte comptent comme « non résolu » : jamais une preuve.
// Chaque coup légal de Noir (dans la zone ou ailleurs, et la passe) est essayé : les réponses acceptées atteignent le
// but contre toute défense, chaque autre coup échoue franchement (Blanc obtient l'issue inverse, pas un ko), et la
// réplique citée par la réfutation suffit. Aucun doublon aux 8 symétries, migration identique au fichier.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_Q from '../content/lots/q-vie-mort';
import { ALL_PUZZLES, CALENDRIER_GO_DU_JOUR } from '../content/puzzles';
import { THEME_DU_PROBLEME } from '../content/themes';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { avantMiseAJour } from './miseAJourTextes';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { cederLaMain, preuveParCoup } from './preuve-par-coup';
import { defautsDeZone, issueApres, yeuxDuGroupe, type Issue } from './preuve-vie-mort';
import { groupAt, play, type Position } from './rules';
import { hasTwoEyes } from './tactics';

beforeEach(cederLaMain);

const all = parsePuzzles(LOT_Q);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const label = (m: number) => (m < 0 ? 'passe' : toLabel(m, 9));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const seq = (pos: Position, ...moves: string[]) => moves.reduce((q, m) => ok(play(q, m === 'passe' ? -1 : at(m))), pos);
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;
const libsOf = (pos: Position, l: string) => [...groupAt(pos.board, 9, at(l)).liberties].map(label).sort();

/** Zone de chaque problème : les points où la vie et la mort se jouent. */
const ZONE: Record<string, string[]> = {
  q01: ['A1', 'C1', 'D2'],
  q02: ['C1', 'E1', 'F2'],
  q03: ['C1', 'D1', 'E1', 'F1', 'G1'],
};

/** Réplique de Blanc annoncée par la réfutation après une erreur de Noir. */
const REPLY: Record<string, { defaut: string; sauf?: Record<string, string> }> = {
  q01: { defaut: 'D2' },
  q02: { defaut: 'F2' },
  q03: { defaut: 'G1', sauf: { E1: 'D1' } },
};

/** But annoncé par l'énoncé, et issue visée (du point de vue du groupe marqué). */
function butOf(p: Puzzle): { but: 'vivre' | 'tuer'; vise: Issue } {
  if (p.prompt.startsWith('Noir joue et vit.')) return { but: 'vivre', vise: 1 };
  if (p.prompt.startsWith('Noir joue et tue.')) return { but: 'tuer', vise: -1 };
  throw new Error(`énoncé inconnu : ${p.id}`);
}

function probleme(p: Puzzle) {
  const { pos, marked } = startOf(p);
  return { pos, cible: marked[0], zone: ZONE[p.id].map(at), ...butOf(p) };
}

describe('lot Q : identifiants, thèmes, doublons, calendrier, migration (issue #136)', () => {
  it('q01, q02… sans trou, tous en 9 × 9, Noir au trait, difficulté croissante de 500 à 900', () => {
    expect(all).toHaveLength(LOT_Q.length);
    expect(LOT_Q.length).toBeGreaterThanOrEqual(3);
    expect(LOT_Q.map(r => r.id)).toEqual(LOT_Q.map((_, i) => `q${String(i + 1).padStart(2, '0')}`));
    expect(Object.keys(ZONE).sort()).toEqual(all.map(p => p.id));
    expect(Object.keys(REPLY).sort()).toEqual(all.map(p => p.id));
    let prev = 0;
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toBeTruthy();
      expect(p.explanation, p.id).toBeTruthy();
      expect(p.difficulty).toBeGreaterThan(prev);
      expect(p.difficulty).toBeGreaterThanOrEqual(500);
      expect(p.difficulty).toBeLessThanOrEqual(900);
      prev = p.difficulty;
      butOf(p);
    }
  });

  it('chaque problème a le thème vie et mort', () => {
    for (const p of all) expect(THEME_DU_PROBLEME[p.id], p.id).toBe('vie-mort');
  });

  it('le Go du jour garde son ordre : le lot Q vient après le lot P', () => {
    const ids = LOT_Q.map(r => r.id);
    // Lot R (#136) ajouté après : le lot Q reste d'un seul tenant, juste avant r01.
    const debut = CALENDRIER_GO_DU_JOUR.indexOf('q01');
    expect(CALENDRIER_GO_DU_JOUR.slice(debut, debut + ids.length)).toEqual(ids);
    expect(CALENDRIER_GO_DU_JOUR[debut + ids.length]).toBe('r01');
    expect(CALENDRIER_GO_DU_JOUR.indexOf('q01')).toBeGreaterThan(CALENDRIER_GO_DU_JOUR.indexOf('p03'));
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées) déjà utilisés', () => {
    const others = ALL_PUZZLES.filter(r => !/^q\d\d$/.test(r.id));
    expect(others.length).toBeGreaterThanOrEqual(162);
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_Q) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260928210100_lot_q.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('q\d\d', null, 9,/g)).toHaveLength(LOT_Q.length);
    const q = (s: string) => s.replace(/'/g, "''");
    // Textes corrigés depuis par 20260928233100_textes_problemes (#282) : on compare au texte d'avant, refait par avantMiseAJour.
    for (const row of LOT_Q.map(r => avantMiseAJour(r))) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });
});

describe('lot Q : départ légal et zone fermée', () => {
  for (const p of all) {
    it(`${p.id} : un seul groupe marqué, du bon camp, zone fermée, pas de ko, chaque chaîne a deux libertés au moins`, () => {
      const { pos, cible, zone, but } = probleme(p);
      expect(startOf(p).marked, p.id).toHaveLength(1);
      expect(pos.board[cible], p.id).toBe(but === 'vivre' ? 1 : 2);
      expect(defautsDeZone(pos, cible, zone), p.id).toEqual([]);
      expect(pos.ko).toBe(-1);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(groupAt(pos.board, 9, q).liberties.size, `${p.id} ${label(q)}`).toBeGreaterThanOrEqual(2);
      for (const a of p.answers) {
        expect(checkAnswer(p, a).kind, p.id).toBe('ok');
        expect(zone, `${p.id} ${label(a)}`).toContain(a);
      }
    });
  }
});

describe('lot Q : les coups gagnants sont exactement les réponses acceptées', () => {
  for (const p of all) {
    const { pos, cible, zone, vise } = probleme(p);
    preuveParCoup(p.id, pos, p.answers, m => issueApres(pos, m, cible, zone) === vise);
  }
});

describe('lot Q : chaque erreur échoue franchement, et la réfutation dit vrai', () => {
  for (const p of all) {
    it(`${p.id} : après chaque autre coup (et la passe), Blanc joue la réplique annoncée et obtient l'issue inverse`, () => {
      const { pos, cible, zone, vise } = probleme(p), spec = REPLY[p.id];
      expect(p.refutation).toMatch(new RegExp(`Blanc joue ${spec.defaut}\\b`));
      for (const [s, r] of Object.entries(spec.sauf ?? {})) expect(p.refutation).toContain(`ou ${r} si tu as joué ${s}`);
      const wrong = [...Array(81).keys(), -1].filter(m => !p.answers.includes(m) && typeof play(pos, m) !== 'string');
      for (const s of Object.keys(spec.sauf ?? {})) expect(wrong.map(label), p.id).toContain(s);
      for (const m of wrong) {
        expect(issueApres(pos, m, cible, zone), `${p.id} ${label(m)}`).toBe(-vise);
        const r = spec.sauf?.[label(m)] ?? spec.defaut;
        const apres = ok(play(pos, m));
        expect(issueApres(apres, at(r), cible, zone), `${p.id} ${label(m)} puis ${r}`).toBe(-vise);
      }
    }, 120_000);
  }
});

describe('lot Q : les explications', () => {
  const start = (id: string) => startOf(pz(id)).pos;
  const yeux = (pos: Position, l: string) => yeuxDuGroupe(pos, at(l)).map(y => [label(y.point), y.vrai]);

  it('q01 : C1 est un œil, faux tant que D2 est vide ; D2 relie D1-E1 et donne deux vrais yeux, A1 et C1', () => {
    expect(libsOf(start('q01'), 'D1')).toEqual(['C1', 'D2']);
    const bon = seq(start('q01'), 'D2');
    expect(yeux(bon, 'B2')).toEqual([['A1', true], ['C1', true]]);
    expect(hasTwoEyes(bon, at('B2'))).toBe(true);
    const faux = seq(start('q01'), 'passe', 'D2');
    expect(libsOf(faux, 'D1')).toEqual(['C1']);
    expect(yeux(faux, 'B2')).toEqual([['A1', true], ['C1', false]]);
  });

  it('q02 : F2 laisse une liberté à F1-G1, E1 ; E1 devient un faux œil ; sinon F2 blanc donne deux vrais yeux', () => {
    const bon = seq(start('q02'), 'F2');
    expect(libsOf(bon, 'F1')).toEqual(['E1']);
    expect(yeux(bon, 'B2')).toEqual([['C1', true], ['E1', false]]);
    const vit = seq(start('q02'), 'passe', 'F2');
    expect(hasTwoEyes(vit, at('B2'))).toBe(true);
  });

  it('q03 : G1 laisse quatre points dont F1, qui touche ta pierre ; après G1 blanc, quatre points en ligne fermés', () => {
    const g1 = seq(start('q03'), 'G1');
    expect(groupAt(g1.board, 9, at('G1')).stones.map(label)).toContain('H1');
    const vit = seq(start('q03'), 'passe', 'G1');
    expect(libsOf(vit, 'B2')).toEqual(['C1', 'D1', 'E1', 'F1']);
  });
});
