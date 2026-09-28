// Issue #136, lot P : preuve de chaque problème (660 à 800) avec le moteur de règles.
// Atari contre un mur, double atari, prise en retour sur le bord. Lecteur exact du lot N (src/go/lecteurs-lot-n.ts) :
// tous les coups légaux et la passe, une fois avec le ko permis et une fois avec toute prise en ko interdite ; le
// résultat doit être le même.
// Capturer : le coup gagne s'il prend une pierre marquée (T) dans le nombre de coups annoncé, contre toute défense.
// Les coups gagnants sont exactement les réponses acceptées (un test par coup, preuve-par-coup.ts), aucun doublon aux
// 8 symétries avec les problèmes existants, réfutations et explications rejouées, migration identique au fichier.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_P from '../content/lots/p-atari-snapback';
import { ALL_PUZZLES, CALENDRIER_GO_DU_JOUR } from '../content/puzzles';
import { THEME_DU_PROBLEME } from '../content/themes';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { AVEC_KO, SANS_KO, attackerCaptures, captureEn, legal } from './lecteurs-lot-n';
import { cederLaMain, preuveParCoup } from './preuve-par-coup';
import { groupAt, play, type Position } from './rules';

// Recette du 28/09 (#195) : longues preuves synchrones, voir cederLaMain (preuve-par-coup.ts).
beforeEach(cederLaMain);

const all = parsePuzzles(LOT_P);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const label = (m: number) => (m < 0 ? 'passe' : toLabel(m, 9));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const seq = (pos: Position, ...moves: string[]) => moves.reduce((q, m) => ok(play(q, m === 'passe' ? -1 : at(m))), pos);
const libsOf = (pos: Position, l: string) => [...groupAt(pos.board, 9, at(l)).liberties].map(label).sort();
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;

const NOMBRES: Record<string, number> = { deux: 2, trois: 3 };
/** Nombre de coups noirs annoncé par l'énoncé. */
function coupsOf(p: Puzzle): number {
  const m = /^Capture (une pierre marquée|les pierres marquées) en (deux|trois) coups au plus\.$/.exec(p.prompt);
  if (!m) throw new Error(`énoncé inconnu : ${p.id}`);
  return NOMBRES[m[2]];
}

/** Thème de pratique attendu (src/content/themes.ts). */
const THEME: Record<string, string> = { p01: 'atari', p02: 'double-atari', p03: 'prise-en-retour' };

/** Réplique de Blanc annoncée par la réfutation après une erreur de Noir (voir lot-o.test.ts). */
const REPLY: Record<string, { defaut: string; sauf?: Record<string, string> }> = {
  p01: { defaut: 'E5', sauf: { E6: 'F4' } },
  p02: { defaut: 'E2' },
  p03: { defaut: 'E1' },
};

function gagne(p: Puzzle, m: number, o = AVEC_KO): boolean {
  const { pos, marked } = startOf(p);
  return captureEn(pos, m, marked, coupsOf(p), o);
}

describe('lot P : identifiants, thèmes, doublons, calendrier, migration (issue #136)', () => {
  it('p01, p02… sans trou, tous en 9 × 9, Noir au trait, difficulté croissante de 650 à 1000', () => {
    expect(all).toHaveLength(LOT_P.length);
    expect(LOT_P.map(r => r.id)).toEqual(LOT_P.map((_, i) => `p${String(i + 1).padStart(2, '0')}`));
    expect(Object.keys(REPLY).sort()).toEqual(all.map(p => p.id));
    let prev = 0;
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toBeTruthy();
      expect(p.explanation, p.id).toBeTruthy();
      expect(p.difficulty).toBeGreaterThan(prev);
      expect(p.difficulty).toBeGreaterThanOrEqual(650);
      expect(p.difficulty).toBeLessThanOrEqual(1000);
      prev = p.difficulty;
      coupsOf(p);
    }
  });

  it('chaque problème a son thème de pratique', () => {
    for (const p of all) expect(THEME_DU_PROBLEME[p.id], p.id).toBe(THEME[p.id]);
  });

  it('le Go du jour garde son ordre : le lot P vient après le lot O', () => {
    const ids = LOT_P.map(r => r.id);
    // Lot Q (#136) ajouté après : le lot P reste d'un seul tenant, juste avant q01.
    const debut = CALENDRIER_GO_DU_JOUR.indexOf('p01');
    expect(CALENDRIER_GO_DU_JOUR.slice(debut, debut + ids.length)).toEqual(ids);
    expect(CALENDRIER_GO_DU_JOUR[debut + ids.length]).toBe('q01');
    expect(CALENDRIER_GO_DU_JOUR.indexOf('p01')).toBeGreaterThan(CALENDRIER_GO_DU_JOUR.indexOf('o12'));
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées) déjà utilisés', () => {
    const others = ALL_PUZZLES.filter(r => !/^p\d\d$/.test(r.id));
    expect(others.length).toBeGreaterThanOrEqual(159);
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_P) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260928070100_lot_p.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('p\d\d', null, 9,/g)).toHaveLength(LOT_P.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_P) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });
});

describe('lot P : départ légal et problème réel', () => {
  for (const p of all) {
    it(`${p.id} : chaque chaîne a deux libertés au moins, pas de ko, cibles blanches, pas de prise plus rapide`, () => {
      const { pos, marked } = startOf(p), k = coupsOf(p);
      expect(pos.ko).toBe(-1);
      expect(marked.length).toBeGreaterThan(0);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(groupAt(pos.board, 9, q).liberties.size, `${p.id} ${label(q)}`).toBeGreaterThanOrEqual(2);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
      for (const t of marked) {
        expect(pos.board[t], p.id).toBe(2);
        expect(groupAt(pos.board, 9, t).liberties.size, p.id).toBe(2);
      }
      for (let m = 0; m < 81; m++) expect(captureEn(pos, m, marked, k - 1), `${p.id} ${label(m)}`).toBe(false);
    });
  }
});

describe('lot P : les coups gagnants sont exactement les réponses acceptées, avec ou sans ko', () => {
  for (const p of all) {
    const { pos } = startOf(p);
    preuveParCoup(p.id, pos, p.answers, m => {
      const r = gagne(p, m);
      expect(gagne(p, m, SANS_KO), `${p.id} ${label(m)} sans ko`).toBe(r);
      return r;
    });
  }
});

describe('lot P : les réfutations disent vrai', () => {
  for (const p of all) {
    it(`${p.id} : après chaque erreur (et la passe), Blanc joue la réplique annoncée et Noir échoue, avec ou sans ko`, () => {
      const { pos, marked } = startOf(p), k = coupsOf(p), spec = REPLY[p.id];
      expect(p.refutation).toMatch(new RegExp(`Blanc (joue|s'allonge en) ${spec.defaut}\\b`));
      const sauf = Object.entries(spec.sauf ?? {});
      if (sauf.length) expect(p.refutation, p.id).toMatch(new RegExp(`ou (en )?${sauf[0][1]} si tu as joué ${sauf.map(([s]) => s).join(' ou ')},`));
      const wrong = [...Array(81).keys(), -1].filter(m => !p.answers.includes(m) && legal(pos, m, AVEC_KO));
      for (const s of Object.keys(spec.sauf ?? {})) expect(wrong.map(label), p.id).toContain(s);
      for (const m of wrong) {
        const r = spec.sauf?.[label(m)] ?? spec.defaut;
        const after = ok(play(ok(play(pos, m)), at(r)));
        for (const o of [AVEC_KO, SANS_KO]) expect(attackerCaptures(after, marked, k - 1, o), `${p.id} ${label(m)} puis ${r}`).toBe(false);
      }
    }, 120_000);
  }
});

describe('lot P : les suites des explications', () => {
  const start = (id: string) => startOf(pz(id)).pos;
  const pris = (pos: Position, l: string) => pos.board[at(l)] === 0;

  it('p01 : deux libertés, E5 et F4 ; l’une prise, Blanc s’allonge sur l’autre et reste en atari', () => {
    expect(libsOf(start('p01'), 'D4')).toEqual(['E5', 'F4']);
    for (const [a, b, c] of [['E5', 'F4', 'F3'], ['F4', 'E5', 'E6']]) {
      const x = seq(start('p01'), a);
      expect(libsOf(x, 'D4'), a).toEqual([b]);
      const y = seq(x, b);
      expect(libsOf(y, 'D4'), a).toEqual([c]);
      expect(pris(seq(y, c), 'D4'), a).toBe(true);
    }
    // Réfutation : après E6, Blanc s'allonge en F4 et garde deux libertés.
    expect(libsOf(seq(start('p01'), 'E6', 'F4'), 'D4')).toEqual(['E5', 'F3']);
  });

  it('p02 : E2 met D2 et F2 en atari ; D1 sauve D2, F1 prend F2 ; F1 sauve F2, D1 prend D2 ; sinon E2 relie', () => {
    const x = seq(start('p02'), 'E2');
    expect(libsOf(x, 'D2')).toEqual(['D1']);
    expect(libsOf(x, 'F2')).toEqual(['F1']);
    expect(pris(seq(x, 'D1', 'F1'), 'F2')).toBe(true);
    expect(pris(seq(x, 'F1', 'D1'), 'D2')).toBe(true);
    expect(libsOf(seq(start('p02'), 'passe', 'E2'), 'D2')).toEqual(['D1', 'E1', 'E3', 'F1']);
  });

  it('p03 : E1 n’a qu’une liberté, E2 ; Blanc prend, ses cinq pierres n’ont que E1, et E1 prend cinq pierres', () => {
    const s = seq(start('p03'), 'E1');
    expect(libsOf(s, 'E1')).toEqual(['E2']);
    expect(libsOf(s, 'D1')).toEqual(['E2']);
    const prise = seq(s, 'E2');
    expect(prise.board[at('E1')]).toBe(0);
    expect(groupAt(prise.board, 9, at('D1')).stones).toHaveLength(5);
    expect(libsOf(prise, 'D1')).toEqual(['E1']);
    const reprise = seq(prise, 'E1');
    expect(reprise.captures[1]).toBe(5);
    expect(pris(reprise, 'D1')).toBe(true);
    // E2 d'abord : Blanc joue E1 et relie ses quatre pierres à F1, G1 et H1.
    expect(libsOf(seq(start('p03'), 'E2', 'E1'), 'D1')).toEqual(['G2', 'H2', 'J1']);
  });
});
