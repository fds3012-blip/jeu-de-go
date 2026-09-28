// Issue #136, lot N : preuve de chaque problème pour débutants (300 à 700) avec le moteur de règles.
// Lecteur exact (src/go/lecteurs-lot-n.ts) : tous les coups légaux et la passe, une fois avec le ko permis et une fois
// avec toute prise en ko interdite ; le résultat doit être le même.
// - Capturer : le coup gagne s'il prend une pierre marquée (T) dans le nombre de coups annoncé, contre toute défense.
// - Sauver : le coup gagne si, ensuite, Blanc ne peut prendre aucune pierre marquée (S) en HORIZON coups blancs, quoi
//   que Noir réponde. Les réponses laissent au moins deux libertés dans un espace ouvert ; chaque erreur perd la
//   pierre bien plus tôt que l'horizon.
// Les coups gagnants sont exactement les réponses acceptées (un test par coup, preuve-par-coup.ts), aucun doublon aux
// 8 symétries avec les problèmes existants, réfutations rejouées, migration identique au fichier.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_N from '../content/lots/n-debutants';
import { ALL_PUZZLES } from '../content/puzzles';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { AVEC_KO, SANS_KO, attackerCaptures, captureEn, defenderFails, legal, sauveEn } from './lecteurs-lot-n';
import { cederLaMain, preuveParCoup } from './preuve-par-coup';
import { groupAt, play, type Position } from './rules';

// Recette du 28/09 (#195) : longues preuves synchrones, voir cederLaMain (preuve-par-coup.ts).
beforeEach(cederLaMain);

const HORIZON = 4;
const all = parsePuzzles(LOT_N);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const label = (m: number) => (m < 0 ? 'passe' : toLabel(m, 9));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const seq = (pos: Position, ...moves: string[]) => moves.reduce((q, m) => ok(play(q, m === 'passe' ? -1 : at(m))), pos);
const libsOf = (pos: Position, l: string) => [...groupAt(pos.board, 9, at(l)).liberties].map(label).sort();
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;

type Objectif = { kind: 'capture'; k: number } | { kind: 'sauver' };
/** Objectif annoncé par l'énoncé. */
function objectifOf(p: Puzzle): Objectif {
  if (/\b[Ss]auve\b|Sauve-l/.test(p.prompt)) return { kind: 'sauver' };
  if (/en un coup\.$/.test(p.prompt)) return { kind: 'capture', k: 1 };
  if (/en deux coups au plus\.$/.test(p.prompt)) return { kind: 'capture', k: 2 };
  throw new Error(`énoncé inconnu : ${p.id}`);
}

/**
 * Réplique de Blanc annoncée par la réfutation après une erreur de Noir : `defaut` (citée dans le texte), sauf pour
 * les coups listés dans `sauf` (par exemple quand Noir a joué lui-même sur le point de la réplique).
 */
const REPLY: Record<string, { defaut: string; sauf?: Record<string, string> }> = {
  n01: { defaut: 'E3' },
  n02: { defaut: 'F1' },
  n03: { defaut: 'E4' },
  n04: { defaut: 'C7' },
  n05: { defaut: 'D4' },
  n06: { defaut: 'B1', sauf: { A1: 'passe' } },
  n07: { defaut: 'F2' },
  n08: { defaut: 'E4' },
  n09: { defaut: 'F5' },
  n10: { defaut: 'J8' },
  n11: { defaut: 'H3' },
  n12: { defaut: 'E9', sauf: { E9: 'F9' } },
  n13: { defaut: 'A4', sauf: { A4: 'B4' } },
  n14: { defaut: 'E5' },
  n15: { defaut: 'E3' },
  n16: { defaut: 'E1' },
};

/** Le coup noir `m` atteint-il l'objectif ? `o` : ko permis ou interdit. */
function gagne(p: Puzzle, m: number, o = AVEC_KO): boolean {
  const { pos, marked } = startOf(p), obj = objectifOf(p);
  return obj.kind === 'capture' ? captureEn(pos, m, marked, obj.k, o) : sauveEn(pos, m, marked, HORIZON, o);
}

describe('lot N : identifiants, doublons, migration (issue #136)', () => {
  it('n01, n02… sans trou, tous en 9 × 9, Noir au trait, difficulté croissante de 300 à 700', () => {
    expect(all).toHaveLength(LOT_N.length);
    expect(all.length).toBeGreaterThanOrEqual(15);
    expect(LOT_N.map(r => r.id)).toEqual(LOT_N.map((_, i) => `n${String(i + 1).padStart(2, '0')}`));
    expect(Object.keys(REPLY).sort()).toEqual(all.map(p => p.id));
    let prev = 0;
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toBeTruthy();
      expect(p.explanation, p.id).toBeTruthy();
      expect(p.difficulty).toBeGreaterThan(prev);
      expect(p.difficulty).toBeGreaterThanOrEqual(300);
      expect(p.difficulty).toBeLessThanOrEqual(700);
      prev = p.difficulty;
      objectifOf(p);
    }
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées) déjà utilisés', () => {
    const others = ALL_PUZZLES.filter(r => !/^n\d\d$/.test(r.id));
    expect(others.length).toBeGreaterThanOrEqual(129);
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_N) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260928040100_lot_n.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('n\d\d', null, 9,/g)).toHaveLength(LOT_N.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_N) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });
});

describe('lot N : départ légal et problème réel', () => {
  for (const p of all) {
    it(`${p.id} : chaque chaîne a une liberté, pas de ko, marques de la bonne couleur, pas de réussite plus rapide ou sans rien faire`, () => {
      const { pos, marked } = startOf(p), obj = objectifOf(p);
      expect(pos.ko).toBe(-1);
      expect(marked.length).toBeGreaterThan(0);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(groupAt(pos.board, 9, q).liberties.size, `${p.id} ${label(q)}`).toBeGreaterThan(0);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
      const minLibs = Math.min(...marked.map(t => groupAt(pos.board, 9, t).liberties.size));
      if (obj.kind === 'capture') {
        for (const t of marked) expect(pos.board[t], p.id).toBe(2);
        // Il faut exactement k coups : les cibles ont k libertés au moins, et aucune prise en k - 1 coups.
        expect(minLibs).toBe(obj.k);
        if (obj.k > 1) for (let m = 0; m < 81; m++) expect(captureEn(pos, m, marked, obj.k - 1), `${p.id} ${label(m)}`).toBe(false);
      } else {
        for (const t of marked) expect(pos.board[t], p.id).toBe(1);
        // Les pierres marquées sont en atari, comme le dit l'énoncé, et si Noir passe, Blanc les prend.
        expect(minLibs).toBe(1);
        expect(attackerCaptures(ok(play(pos, -1)), marked, 1)).toBe(true);
        expect(gagne(p, -1)).toBe(false);
      }
    });
  }
});

describe('lot N : les coups gagnants sont exactement les réponses acceptées, avec ou sans ko', () => {
  for (const p of all) {
    const { pos } = startOf(p);
    preuveParCoup(p.id, pos, p.answers, m => {
      const r = gagne(p, m);
      expect(gagne(p, m, SANS_KO), `${p.id} ${label(m)} sans ko`).toBe(r);
      return r;
    });
  }
});

describe('lot N : les réfutations disent vrai', () => {
  for (const p of all) {
    it(`${p.id} : après chaque erreur (et la passe), Blanc joue la réplique annoncée et Noir échoue, avec ou sans ko`, () => {
      const { pos, marked } = startOf(p), obj = objectifOf(p), spec = REPLY[p.id];
      expect(p.refutation).toMatch(new RegExp(`Blanc (joue|s'allonge en|prend ta pierre en) ${spec.defaut}\\b|Blanc joue ${spec.defaut}\\b`));
      const wrong = [...Array(81).keys(), -1].filter(m => !p.answers.includes(m) && legal(pos, m, AVEC_KO));
      for (const s of Object.keys(spec.sauf ?? {})) expect(wrong.map(label), p.id).toContain(s);
      for (const m of wrong) {
        const r = spec.sauf?.[label(m)] ?? spec.defaut;
        const after = ok(play(ok(play(pos, m)), r === 'passe' ? -1 : at(r)));
        for (const o of [AVEC_KO, SANS_KO]) {
          if (obj.kind === 'capture') expect(attackerCaptures(after, marked, obj.k - 1, o), `${p.id} ${label(m)} puis ${r}`).toBe(false);
          else expect(defenderFails(after, marked, HORIZON - 1, o), `${p.id} ${label(m)} puis ${r}`).toBe(true);
        }
      }
    }, 120_000);
  }
});

describe('lot N : les suites des explications', () => {
  const start = (id: string) => startOf(pz(id)).pos;

  it('n01 : E5 et E4 forment une chaîne à une liberté, E3 ; ailleurs, Blanc s’allonge en E3 avec trois libertés', () => {
    expect(libsOf(start('n01'), 'E5')).toEqual(['E3']);
    expect(seq(start('n01'), 'E3').board[at('E4')]).toBe(0);
    expect(libsOf(seq(start('n01'), 'A1', 'E3'), 'E5')).toEqual(['D3', 'E2', 'F3']);
  });

  it('n02 : F1 prend trois pierres ; après C4, F1 donne deux libertés, E1 et F2', () => {
    expect(seq(start('n02'), 'F1').captures[1]).toBe(3);
    expect(libsOf(seq(start('n02'), 'C4', 'F1'), 'F1')).toEqual(['E1', 'F2']);
  });

  it('n03, n04, n05 : l’allongement donne trois libertés ; B8, H3 et G2 sont en atari', () => {
    expect(libsOf(seq(start('n03'), 'E4'), 'E5')).toEqual(['D4', 'E3', 'F4']);
    expect(libsOf(start('n03'), 'B8')).toEqual(['B7']);
    expect(libsOf(seq(start('n04'), 'C7'), 'C8')).toEqual(['B7', 'C6', 'D7']);
    expect(libsOf(start('n04'), 'H3')).toEqual(['H2']);
    expect(libsOf(seq(start('n05'), 'D4'), 'D5')).toEqual(['C4', 'D3', 'E4']);
    expect(libsOf(start('n05'), 'G2')).toEqual(['G3']);
  });

  it('n06 : A2 puis B1, ou B1 puis A2 : une seule liberté, A1', () => {
    expect(libsOf(seq(start('n06'), 'A2', 'B1'), 'B2')).toEqual(['A1']);
    expect(libsOf(seq(start('n06'), 'B1', 'A2'), 'B2')).toEqual(['A1']);
  });

  it('n07 à n11 : après l’atari et l’allongement, une seule liberté ; après l’autre atari, Blanc respire', () => {
    const cas: [string, string, string, string, string[], string, string, string[]][] = [
      ['n07', 'E2', 'F2', 'E1', ['F1'], 'E1', 'F2', ['F1', 'F3', 'G2']],
      ['n08', 'E5', 'E4', 'F5', ['F6'], 'F5', 'E4', ['D4', 'E3']],
      ['n09', 'E5', 'F5', 'E4', ['F4'], 'E4', 'F5', ['F4', 'F6', 'G4', 'G6', 'H5']],
      ['n10', 'H8', 'J8', 'H9', ['J9'], 'H9', 'J8', ['J7', 'J9']],
      ['n11', 'H4', 'H3', 'J4', ['J3'], 'J4', 'H3', ['G3', 'H2', 'J3']],
    ];
    for (const [id, t, bon, suite, reste, faux, fuite, respire] of cas) {
      expect(libsOf(seq(start(id), bon, suite), t), id).toEqual(reste);
      expect(seq(start(id), bon, suite, reste[0]).board[at(t)], id).toBe(0);
      expect(libsOf(seq(start(id), faux, fuite), t), id).toEqual(respire);
    }
  });

  it('n12 : E9 te met en atari (F9) ; B9 prend C9, et Blanc ne peut pas y jouer', () => {
    expect(libsOf(seq(start('n12'), 'E9'), 'D9')).toEqual(['F9']);
    const b9 = seq(start('n12'), 'B9');
    expect(b9.captures[1]).toBe(1);
    expect(libsOf(b9, 'D9')).toEqual(['C9', 'E9']);
    expect(play(b9, at('C9'))).toBe('suicide');
  });

  it('n13 : A4 ne donne que deux libertés, puis B4 remet en atari ; B4 prend B5, et Blanc ne peut pas y jouer', () => {
    expect(libsOf(seq(start('n13'), 'A4'), 'A5')).toEqual(['A3', 'B4']);
    expect(libsOf(seq(start('n13'), 'A4', 'B4'), 'A5')).toEqual(['A3']);
    const b4 = seq(start('n13'), 'B4');
    expect(b4.captures[1]).toBe(1);
    expect(libsOf(b4, 'A5')).toEqual(['A4', 'B5']);
    expect(play(b4, at('B5'))).toBe('suicide');
  });

  it('n14 : E5 est un double atari (D4, F6) ; après un seul atari, E5 relie avec trois libertés', () => {
    const e5 = seq(start('n14'), 'E5');
    expect(libsOf(e5, 'D5')).toEqual(['D4']);
    expect(libsOf(e5, 'F5')).toEqual(['F6']);
    expect(libsOf(seq(start('n14'), 'D4', 'E5'), 'D5')).toEqual(['E4', 'E6', 'F6']);
  });

  it('n15 : E3 puis E1 : trois pierres à une liberté, F1 ; E1 prend D1, puis E3 donne trois libertés', () => {
    const r = seq(start('n15'), 'E3', 'E1');
    expect(libsOf(r, 'E2')).toEqual(['F1']);
    expect(seq(r, 'F1').captures[1]).toBe(3);
    expect(libsOf(seq(start('n15'), 'E1', 'E3'), 'E2')).toEqual(['D3', 'E4', 'F3']);
  });

  it('n16 : F2 est en atari (F1) ; après E1 puis D1, F1 prend F2 ; A9 prend deux pierres mais E1 prend ta pierre', () => {
    expect(libsOf(start('n16'), 'F2')).toEqual(['F1']);
    expect(libsOf(seq(start('n16'), 'E1'), 'E2')).toEqual(['D1', 'F1']);
    expect(seq(start('n16'), 'E1', 'D1', 'F1').board[at('F2')]).toBe(0);
    const a9 = seq(start('n16'), 'A9');
    expect(a9.captures[1]).toBe(2);
    expect(seq(a9, 'E1').board[at('E2')]).toBe(0);
  });
});
