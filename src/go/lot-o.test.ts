// Issue #136, lot O : preuve de chaque problème du milieu de courbe (650 à 940) avec le moteur de règles.
// Filet (geta), prise en retour, échelle (pierre relais, échelle cassée), course aux libertés simple. Lecteur exact du lot N
// (src/go/lecteurs-lot-n.ts) : tous les coups légaux et la passe, une fois avec le ko permis et une fois avec toute
// prise en ko interdite ; le résultat doit être le même.
// Capturer : le coup gagne s'il prend une pierre marquée (T) dans le nombre de coups annoncé, contre toute défense.
// Les coups gagnants sont exactement les réponses acceptées (un test par coup, preuve-par-coup.ts), aucun doublon aux
// 8 symétries avec les problèmes existants, réfutations et explications rejouées, migration identique au fichier.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_O from '../content/lots/o-filets-echelles';
import { ALL_PUZZLES } from '../content/puzzles';
import { THEME_DU_PROBLEME } from '../content/themes';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { AVEC_KO, SANS_KO, attackerCaptures, captureEn, legal } from './lecteurs-lot-n';
import { cederLaMain, preuveParCoup } from './preuve-par-coup';
import { groupAt, play, type Position } from './rules';

// Recette du 28/09 (#195) : longues preuves synchrones, voir cederLaMain (preuve-par-coup.ts).
beforeEach(cederLaMain);

const all = parsePuzzles(LOT_O);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const label = (m: number) => (m < 0 ? 'passe' : toLabel(m, 9));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const seq = (pos: Position, ...moves: string[]) => moves.reduce((q, m) => ok(play(q, m === 'passe' ? -1 : at(m))), pos);
const libsOf = (pos: Position, l: string) => [...groupAt(pos.board, 9, at(l)).liberties].map(label).sort();
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;

const NOMBRES: Record<string, number> = { deux: 2, trois: 3, quatre: 4, cinq: 5 };
/** Nombre de coups noirs annoncé par l'énoncé. */
function coupsOf(p: Puzzle): number {
  const m = /^Capture (la pierre marquée|les pierres marquées) en (deux|trois|quatre|cinq) coups au plus\.$/.exec(p.prompt);
  if (!m) throw new Error(`énoncé inconnu : ${p.id}`);
  return NOMBRES[m[2]];
}

/** Thème de pratique attendu (src/content/themes.ts). */
const THEME: Record<string, string> = {
  o01: 'filet', o02: 'prise-en-retour', o03: 'semeai', o04: 'filet', o05: 'prise-en-retour', o06: 'filet',
  o07: 'prise-en-retour', o08: 'echelle', o09: 'filet', o10: 'semeai', o11: 'echelle', o12: 'filet',
};

/**
 * Réplique de Blanc annoncée par la réfutation après une erreur de Noir : `defaut` (citée dans le texte), sauf pour
 * les coups listés dans `sauf` (Noir a joué sur le point de la réplique ou l'a rendu inutile ; le texte les cite).
 */
const REPLY: Record<string, { defaut: string; sauf?: Record<string, string> }> = {
  o01: { defaut: 'E5', sauf: { E5: 'D6', E4: 'D6' } },
  o02: { defaut: 'E1' },
  o03: { defaut: 'C1', sauf: { C1: 'B1' } },
  o04: { defaut: 'E5', sauf: { E5: 'D4', F5: 'D4' } },
  o05: { defaut: 'A5' },
  o06: { defaut: 'G4', sauf: { G4: 'F5', H4: 'F5' } },
  o07: { defaut: 'G9' },
  o08: { defaut: 'E4' },
  o09: { defaut: 'E5', sauf: { E5: 'D6', F5: 'D6' } },
  o10: { defaut: 'C1', sauf: { E1: 'F1', C1: 'F1' } },
  o11: { defaut: 'D3' },
  o12: { defaut: 'F3', sauf: { F3: 'E4', F2: 'E4' } },
};

/** Le coup noir `m` prend-il une pierre marquée dans le nombre de coups annoncé ? `o` : ko permis ou interdit. */
function gagne(p: Puzzle, m: number, o = AVEC_KO): boolean {
  const { pos, marked } = startOf(p);
  return captureEn(pos, m, marked, coupsOf(p), o);
}

describe('lot O : identifiants, thèmes, doublons, migration (issue #136)', () => {
  it('o01, o02… sans trou, tous en 9 × 9, Noir au trait, difficulté croissante de 650 à 1000', () => {
    expect(all).toHaveLength(LOT_O.length);
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect(LOT_O.map(r => r.id)).toEqual(LOT_O.map((_, i) => `o${String(i + 1).padStart(2, '0')}`));
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

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées) déjà utilisés', () => {
    const others = ALL_PUZZLES.filter(r => !/^o\d\d$/.test(r.id));
    expect(others.length).toBeGreaterThanOrEqual(147);
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_O) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260928060100_lot_o.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('o\d\d', null, 9,/g)).toHaveLength(LOT_O.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_O) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });
});

describe('lot O : départ légal et problème réel', () => {
  for (const p of all) {
    it(`${p.id} : chaque chaîne a deux libertés au moins, pas de ko, cibles blanches, pas de prise plus rapide`, () => {
      const { pos, marked } = startOf(p), k = coupsOf(p);
      expect(pos.ko).toBe(-1);
      expect(marked.length).toBeGreaterThan(0);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(groupAt(pos.board, 9, q).liberties.size, `${p.id} ${label(q)}`).toBeGreaterThanOrEqual(2);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
      for (const t of marked) expect(pos.board[t], p.id).toBe(2);
      // Les cibles ont deux libertés (trois dans les courses aux libertés, o03 et o10) ; il faut bien k coups :
      // aucune prise en k - 1 coups.
      const minLibs = Math.min(...marked.map(t => groupAt(pos.board, 9, t).liberties.size));
      expect(minLibs, p.id).toBe(THEME[p.id] === 'semeai' ? 3 : 2);
      for (let m = 0; m < 81; m++) expect(captureEn(pos, m, marked, k - 1), `${p.id} ${label(m)}`).toBe(false);
    });
  }
});

describe('lot O : les coups gagnants sont exactement les réponses acceptées, avec ou sans ko', () => {
  for (const p of all) {
    const { pos } = startOf(p);
    preuveParCoup(p.id, pos, p.answers, m => {
      const r = gagne(p, m);
      expect(gagne(p, m, SANS_KO), `${p.id} ${label(m)} sans ko`).toBe(r);
      return r;
    });
  }
});

describe('lot O : les réfutations disent vrai', () => {
  for (const p of all) {
    it(`${p.id} : après chaque erreur (et la passe), Blanc joue la réplique annoncée et Noir échoue, avec ou sans ko`, () => {
      const { pos, marked } = startOf(p), k = coupsOf(p), spec = REPLY[p.id];
      expect(p.refutation).toMatch(new RegExp(`Blanc (joue|s'allonge en) ${spec.defaut}\\b`));
      // « ou en D6 si tu as joué E5 ou E4 » : la réfutation cite l'autre réplique et les coups qui la déclenchent.
      const sauf = Object.entries(spec.sauf ?? {});
      if (sauf.length) expect(p.refutation, p.id).toMatch(new RegExp(`ou (en )?${sauf[0][1]} si tu as joué ${sauf.map(([s]) => s).join(' ou ')},`));
      for (const [, r] of sauf) expect(r, p.id).toBe(sauf[0][1]);
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

describe('lot O : les suites des explications', () => {
  const start = (id: string) => startOf(pz(id)).pos;
  const pris = (pos: Position, l: string) => pos.board[at(l)] === 0;

  it('les filets : chaque sortie est suivie d’un atari, puis de la prise si Blanc s’allonge', () => {
    // [id, filet, cible, sortie 1, atari 1, sortie 2, atari 2]
    const cas: [string, string, string, string, string, string, string][] = [
      ['o01', 'E6', 'D5', 'D6', 'C6', 'E5', 'E4'],
      ['o04', 'D5', 'E4', 'D4', 'D3', 'E5', 'F5'],
      ['o06', 'G5', 'F4', 'F5', 'E5', 'G4', 'H4'],
      ['o09', 'D5', 'E6', 'D6', 'C6', 'E5', 'F5'],
      ['o12', 'E3', 'F4', 'E4', 'D4', 'F3', 'F2'],
    ];
    for (const [id, filet, t, s1, a1, s2, a2] of cas) {
      expect(libsOf(start(id), t), id).toEqual([s1, s2].sort());
      // Sortie 1, atari : il ne reste que la sortie 2 ; Blanc s'y allonge, il est encore en atari, et tu prends.
      const x = seq(start(id), filet, s1, a1);
      expect(libsOf(x, t), id).toEqual([s2]);
      expect(libsOf(seq(x, s2), t), id).toEqual([a2]);
      expect(pris(seq(x, s2, a2), t), id).toBe(true);
      // Sortie 2 d'abord : même chose de l'autre côté.
      const y = seq(start(id), filet, s2, a2);
      expect(libsOf(y, t), id).toEqual([s1]);
      expect(libsOf(seq(y, s1), t), id).toEqual([a1]);
      expect(pris(seq(y, s1, a1), t), id).toBe(true);
    }
  });

  it('les prises en retour : ta pierre a une liberté, Blanc la prend, puis tu reprends trois pierres', () => {
    // [id, sacrifice, point de prise, cible, relié par Blanc après l'autre atari, libertés alors]
    const cas: [string, string, string, string, string[]][] = [
      ['o02', 'E1', 'E2', 'D2', ['G2', 'H2', 'J1']],
      ['o05', 'A5', 'B5', 'A4', ['A9', 'B7', 'B8']],
      ['o07', 'G9', 'G8', 'F9', ['H7', 'J6']],
    ];
    for (const [id, a, b, t, apresAutre] of cas) {
      const s = seq(start(id), a);
      expect(libsOf(s, a), id).toEqual([b]);
      expect(libsOf(s, t), id).toEqual([b]);
      const prise = seq(s, b);
      expect(prise.board[at(a)], id).toBe(0);
      expect(libsOf(prise, t), id).toEqual([a]);
      const reprise = seq(prise, a);
      expect(reprise.captures[1], id).toBe(3);
      expect(pris(reprise, t), id).toBe(true);
      // L'atari de l'autre côté : Blanc joue le point du sacrifice et relie ses pierres.
      expect(libsOf(seq(start(id), b, a), t), id).toEqual(apresAutre);
    }
  });

  it('o03 : trois libertés chacun ; après D1, E1 ou F1, Blanc remplit C1 et tu gagnes d’un coup', () => {
    expect(libsOf(start('o03'), 'A2')).toEqual(['A1', 'B1', 'C1']);
    expect(libsOf(start('o03'), 'D2')).toEqual(['D1', 'E1', 'F1']);
    for (const [a, b, c] of [['D1', 'E1', 'F1'], ['E1', 'D1', 'F1'], ['F1', 'E1', 'D1']]) {
      const r = seq(start('o03'), a, 'C1', b, 'B1');
      expect(libsOf(r, 'A2'), a).toEqual(['A1']);
      expect(libsOf(r, 'D2'), a).toEqual([c]);
      expect(pris(seq(r, c), 'D2'), a).toBe(true);
    }
  });

  it('o10 : D1, C1, F1 : deux atari ; E1 prend D1, puis D1 prend quatre pierres ; en E1, F1 met en atari et donne G1', () => {
    const d1 = seq(start('o10'), 'D1', 'C1');
    expect(libsOf(d1, 'D1')).toEqual(['E1']);
    const f1 = seq(d1, 'F1');
    expect(libsOf(f1, 'D2')).toEqual(['E1']);
    const e1 = seq(f1, 'E1');
    expect(e1.board[at('D1')]).toBe(0);
    expect(libsOf(e1, 'D2')).toEqual(['D1']);
    const fin = seq(e1, 'D1');
    expect(fin.captures[1]).toBe(4);
    expect(pris(fin, 'D2')).toBe(true);
    const milieu = seq(start('o10'), 'E1', 'F1');
    expect(libsOf(milieu, 'E1')).toEqual(['D1']);
    expect(libsOf(milieu, 'D2')).toEqual(['D1', 'G1']);
  });

  it('o08 : E4, F3, F2, G3, H3 : une seule liberté, G2 ; puis G1 ; sans H2, Blanc aurait G1 et H2 ; après F3, E4 : D4 et E5', () => {
    const x = seq(start('o08'), 'E4', 'F3', 'F2', 'G3', 'H3');
    expect(libsOf(x, 'F4')).toEqual(['G2']);
    expect(libsOf(seq(x, 'G2'), 'F4')).toEqual(['G1']);
    expect(pris(seq(x, 'G2', 'G1'), 'F4')).toBe(true);
    const sansRelais = ok(play({ ...x, board: x.board.map((c, i) => (i === at('H2') ? 0 : c)) }, at('G2')));
    expect(libsOf(sansRelais, 'F4')).toEqual(['G1', 'H2']);
    expect(libsOf(seq(start('o08'), 'F3', 'E4'), 'F4')).toEqual(['D4', 'E5']);
  });

  it('o11 : D3, puis C5, B5, A5 en atari à chaque fois, et A2 prend ; après C4 puis D3, Blanc se relie à E2', () => {
    const lignes = [['D3', 'C4'], ['C5', 'B4'], ['B5', 'A4'], ['A5', 'A3']];
    let pos = start('o11');
    for (const [noir, blanc] of lignes) {
      pos = seq(pos, noir);
      expect(libsOf(pos, 'C3'), noir).toEqual([blanc]);
      pos = seq(pos, blanc);
    }
    expect(libsOf(pos, 'C3')).toEqual(['A2']);
    expect(pris(seq(pos, 'A2'), 'C3')).toBe(true);
    // Échelle cassée : après C4 et D3, quel que soit l'atari noir, Blanc se relie à E2 avec trois libertés au moins.
    for (const [noir, blanc] of [['D2', 'E3'], ['E3', 'D2']]) {
      const r = seq(start('o11'), 'C4', 'D3', noir, blanc);
      expect(groupAt(r.board, 9, at("C3")).stones.includes(at("E2")), noir).toBe(true);
      expect(libsOf(r, 'C3').length, noir).toBeGreaterThanOrEqual(3);
    }
  });
});
