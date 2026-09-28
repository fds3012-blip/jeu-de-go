// Issue #136, lot R : preuve de chaque problème de vie et mort (700 à 1050) avec l'outil src/go/preuve-vie-mort.ts.
// Recherche complète dans la zone du problème (points listés ci-dessous), les deux camps pouvant passer.
// Vivant : deux vrais yeux au sens de Benson, ou plus aucun coup légal pour l'attaquant. Mort : capturé.
// Un ko, une répétition, une double passe ou la profondeur atteinte comptent comme « non résolu » : jamais une preuve.
// Chaque coup légal de Noir (dans la zone ou ailleurs, et la passe) est essayé : les réponses acceptées atteignent le
// but contre toute défense, chaque autre coup échoue franchement (Blanc obtient l'issue inverse, pas un ko ni un seki),
// et la réplique citée par la réfutation suffit. Aucun doublon aux 8 symétries, migration identique au fichier.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_R from '../content/lots/r-vie-mort';
import { ALL_PUZZLES, CALENDRIER_GO_DU_JOUR } from '../content/puzzles';
import { THEME_DU_PROBLEME } from '../content/themes';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { cederLaMain, preuveParCoup } from './preuve-par-coup';
import { defautsDeZone, issueApres, yeuxDuGroupe, type Issue } from './preuve-vie-mort';
import { groupAt, neighbors, play, type Position } from './rules';

beforeEach(cederLaMain);

const all = parsePuzzles(LOT_R);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const label = (m: number) => (m < 0 ? 'passe' : toLabel(m, 9));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const seq = (pos: Position, ...moves: string[]) => moves.reduce((q, m) => ok(play(q, m === 'passe' ? -1 : at(m))), pos);
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;
const libsOf = (pos: Position, l: string) => [...groupAt(pos.board, 9, at(l)).liberties].map(label).sort();

/** Zone de chaque problème : les points où la vie et la mort se jouent (pierres comprises, elles peuvent être prises). */
const ZONE: Record<string, string[]> = {
  r01: ['A1', 'B1', 'C1', 'A2', 'B2', 'C2'],
  r02: ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'],
  r03: ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'],
  r04: ['A1', 'B1', 'C1', 'A2', 'B2', 'C2'],
  r05: ['A1', 'B1', 'C1', 'D1', 'E1', 'F1'],
  r06: ['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3'],
};

/** Réplique de Blanc annoncée par la réfutation après une erreur de Noir (`sauf` : réplique → erreurs concernées). */
const REPLY: Record<string, { defaut: string; sauf?: Record<string, string[]> }> = {
  r01: { defaut: 'B2', sauf: { B1: ['A2', 'C2'] } },
  r02: { defaut: 'B1' },
  r03: { defaut: 'B1', sauf: { F1: ['C1'] } },
  r04: { defaut: 'A2', sauf: { C2: ['A1'] } },
  r05: { defaut: 'E1' },
  r06: { defaut: 'B2' },
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

describe('lot R : identifiants, thèmes, doublons, calendrier, migration (issue #136)', () => {
  it('r01, r02… sans trou, tous en 9 × 9, Noir au trait, difficulté croissante de 700 à 1100, « tue » et « vit » mêlés', () => {
    expect(all).toHaveLength(LOT_R.length);
    expect(LOT_R.length).toBeGreaterThanOrEqual(5);
    expect(LOT_R.length).toBeLessThanOrEqual(8);
    expect(LOT_R.map(r => r.id)).toEqual(LOT_R.map((_, i) => `r${String(i + 1).padStart(2, '0')}`));
    expect(Object.keys(ZONE).sort()).toEqual(all.map(p => p.id));
    expect(Object.keys(REPLY).sort()).toEqual(all.map(p => p.id));
    let prev = 0;
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toBeTruthy();
      expect(p.explanation, p.id).toBeTruthy();
      expect(p.difficulty).toBeGreaterThan(prev);
      expect(p.difficulty).toBeGreaterThanOrEqual(700);
      expect(p.difficulty).toBeLessThanOrEqual(1100);
      prev = p.difficulty;
    }
    const buts = all.map(p => butOf(p).but);
    expect(buts).toContain('vivre');
    expect(buts).toContain('tuer');
  });

  it('chaque problème a le thème vie et mort', () => {
    for (const p of all) expect(THEME_DU_PROBLEME[p.id], p.id).toBe('vie-mort');
  });

  it('le Go du jour garde son ordre : le lot R vient après le lot Q', () => {
    const ids = LOT_R.map(r => r.id);
    expect(CALENDRIER_GO_DU_JOUR.slice(-ids.length)).toEqual(ids);
    expect(CALENDRIER_GO_DU_JOUR.indexOf('r01')).toBeGreaterThan(CALENDRIER_GO_DU_JOUR.indexOf('q03'));
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées) déjà utilisés', () => {
    const others = ALL_PUZZLES.filter(r => !/^r\d\d$/.test(r.id));
    expect(others.length).toBeGreaterThanOrEqual(165);
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_R) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260928223100_lot_r.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('r\d\d', null, 9,/g)).toHaveLength(LOT_R.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_R) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });
});

describe('lot R : départ légal et zone fermée', () => {
  for (const p of all) {
    it(`${p.id} : un seul groupe marqué, du bon camp, zone fermée, pas de ko, chaque chaîne a deux libertés au moins`, () => {
      const { pos, cible, zone, but } = probleme(p);
      expect(startOf(p).marked, p.id).toHaveLength(1);
      expect(pos.board[cible], p.id).toBe(but === 'vivre' ? 1 : 2);
      expect(defautsDeZone(pos, cible, zone), p.id).toEqual([]);
      // Aucun point vide de la zone ne touche un point vide hors de la zone : une pierre jouée dans la zone n'y gagne
      // jamais une liberté que l'adversaire ne pourrait pas remplir.
      const nb = neighbors(9);
      for (const z of zone) for (const r of nb[z]) if (pos.board[r] === 0) expect(zone, `${p.id} ${label(z)}-${label(r)}`).toContain(r);
      expect(pos.ko).toBe(-1);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(groupAt(pos.board, 9, q).liberties.size, `${p.id} ${label(q)}`).toBeGreaterThanOrEqual(2);
      for (const a of p.answers) {
        expect(checkAnswer(p, a).kind, p.id).toBe('ok');
        expect(zone, `${p.id} ${label(a)}`).toContain(a);
      }
    });
  }
});

describe('lot R : les coups gagnants sont exactement les réponses acceptées', () => {
  for (const p of all) {
    const { pos, cible, zone, vise } = probleme(p);
    preuveParCoup(p.id, pos, p.answers, m => issueApres(pos, m, cible, zone) === vise);
  }
});

// Un test par erreur (comme preuveParCoup) : r06 demande une dizaine de secondes en tout, un seul bloc synchrone
// risquerait « Timeout calling onTaskUpdate » sur une machine chargée.
describe('lot R : chaque erreur échoue franchement, et la réfutation dit vrai', () => {
  for (const p of all) {
    const { pos, cible, zone, vise } = probleme(p), spec = REPLY[p.id];
    const sauf = new Map<string, string>();
    for (const [r, erreurs] of Object.entries(spec.sauf ?? {})) for (const e of erreurs) sauf.set(e, r);
    const wrong = [...Array(81).keys(), -1].filter(m => !p.answers.includes(m) && typeof play(pos, m) !== 'string');
    describe(`${p.id} : après chaque autre coup (et la passe), Blanc joue la réplique annoncée et obtient l'issue inverse`, () => {
      it('la réfutation cite la réplique, et chaque exception vise une vraie erreur', () => {
        expect(p.refutation).toMatch(new RegExp(`Blanc joue ${spec.defaut}\\b`));
        for (const [r, erreurs] of Object.entries(spec.sauf ?? {})) expect(p.refutation).toContain(`ou ${r} si tu as joué ${erreurs.join(' ou ')}`);
        for (const s of sauf.keys()) expect(wrong.map(label), p.id).toContain(s);
        expect(wrong).toContain(-1);
      });
      for (const m of wrong) {
        const r = sauf.get(label(m)) ?? spec.defaut;
        it(`${label(m)} échoue, et ${r} le punit`, () => {
          expect(issueApres(pos, m, cible, zone), `${p.id} ${label(m)}`).toBe(-vise);
          expect(issueApres(ok(play(pos, m)), at(r), cible, zone), `${p.id} ${label(m)} puis ${r}`).toBe(-vise);
        }, 120_000);
      }
    });
  }
});

describe('lot R : les explications', () => {
  const start = (id: string) => startOf(pz(id)).pos;
  const yeux = (pos: Position, l: string) => yeuxDuGroupe(pos, at(l)).map(y => [label(y.point), y.vrai]);

  it('r01 : le groupe noir n’a aucune liberté hors des six points A1-C2', () => {
    expect(libsOf(start('r01'), 'B3').every(l => ZONE.r01.includes(l))).toBe(true);
  });

  it('r02 : B1 blanc ferait de C1 un deuxième œil ; B1 noir l’en empêche', () => {
    expect(yeux(seq(start('r02'), 'passe', 'B1'), 'D2')).toEqual([['C1', true]]);
    expect(yeux(seq(start('r02'), 'B1'), 'D2')).toEqual([]);
  });

  it('r03 : B1 fait de C1 un vrai œil ; sinon B1 puis A1 blancs se relient à A2', () => {
    expect(yeux(seq(start('r03'), 'B1'), 'D2')).toEqual([['C1', true]]);
    const relie = seq(start('r03'), 'passe', 'B1', 'passe', 'A1');
    expect(groupAt(relie.board, 9, at('A2')).stones.map(label)).toContain('B1');
  });

  it('r04 : A2 met B2 en atari ; A1 est un faux œil tant que B2 est blanc, un vrai œil une fois B2 pris', () => {
    const a2 = seq(start('r04'), 'A2');
    expect(libsOf(a2, 'B2')).toEqual(['C2']);
    expect(yeux(a2, 'B3')).toEqual([['A1', false]]);
    const allonge = seq(start('r04'), 'A2', 'C2');
    expect(libsOf(allonge, 'B2')).toEqual(['C1']);
    const pris = seq(allonge, 'C1');
    expect(pris.board[at('B2')]).toBe(0);
    expect(pris.board[at('C2')]).toBe(0);
    expect(yeux(pris, 'B3')).toContainEqual(['A1', true]);
    expect(yeux(seq(start('r04'), 'A2', 'passe', 'C2'), 'B3')).toContainEqual(['A1', true]);
    expect(libsOf(seq(start('r04'), 'C2'), 'B2')).toEqual(['A2']);
  });

  it('r05 : E1 blanc ferait de D1 un deuxième œil ; E1 noir, relié à F1, l’en empêche', () => {
    expect(yeux(seq(start('r05'), 'passe', 'E1'), 'C2')).toEqual([['D1', true]]);
    const e1 = seq(start('r05'), 'E1');
    expect(groupAt(e1.board, 9, at('E1')).stones.map(label)).toContain('F1');
    expect(yeux(e1, 'C2')).toEqual([]);
  });
});
