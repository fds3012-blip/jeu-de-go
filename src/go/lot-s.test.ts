// Issue #136, lot S : preuve de chaque tesuji de capture (900 à 1250) avec le moteur de règles.
// Fermer le côté ouvert contre le bord, filet, couper avant l'atari, échelle cassée, pierre relais, filet à distance.
// Lecteur exact du lot N (src/go/lecteurs-lot-n.ts) : tous les coups légaux et la passe, une fois avec le ko permis et
// une fois avec toute prise en ko interdite ; le résultat doit être le même.
// Capturer : le coup gagne s'il prend une pierre marquée (T) dans le nombre de coups annoncé, contre toute défense.
// Les coups gagnants sont exactement les réponses acceptées (un test par coup, preuve-par-coup.ts), chaque erreur est
// réfutée par la réplique citée, aucun doublon aux 8 symétries, suites des explications rejouées, calendrier du Go du
// jour (le lot S suit le lot R), migration identique au fichier.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_S from '../content/lots/s-tesuji';
import { ALL_PUZZLES, CALENDRIER_GO_DU_JOUR } from '../content/puzzles';
import { THEME_DU_PROBLEME } from '../content/themes';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { AVEC_KO, SANS_KO, attackerCaptures, captureEn, defenderFails, legal } from './lecteurs-lot-n';
import { cederLaMain, preuveParCoup } from './preuve-par-coup';
import { groupAt, play, type Position } from './rules';

// Recette du 28/09 (#195) : longues preuves synchrones, voir cederLaMain (preuve-par-coup.ts).
beforeEach(cederLaMain);

const all = parsePuzzles(LOT_S);
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
  s01: 'bord', s02: 'filet', s03: 'relier-couper', s04: 'echelle', s05: 'bord', s06: 'filet',
};

/**
 * Réplique de Blanc annoncée par la réfutation après une erreur de Noir : `defaut` (citée dans le texte), sauf pour
 * les coups listés dans `sauf` (Noir a joué sur le point de la réplique ou l'a rendu inutile ; le texte les cite).
 */
const REPLY: Record<string, { defaut: string; sauf?: Record<string, string> }> = {
  s01: { defaut: 'E2' },
  s02: { defaut: 'F5', sauf: { F5: 'E6', F4: 'E6' } },
  s03: { defaut: 'D3' },
  s04: { defaut: 'F3' },
  s05: { defaut: 'D3' },
  s06: { defaut: 'F5', sauf: { F5: 'E6', F4: 'E6' } },
};

/** Le coup noir `m` prend-il une pierre marquée dans le nombre de coups annoncé ? `o` : ko permis ou interdit. */
function gagne(p: Puzzle, m: number, o = AVEC_KO): boolean {
  const { pos, marked } = startOf(p);
  return captureEn(pos, m, marked, coupsOf(p), o);
}

describe('lot S : identifiants, thèmes, doublons, calendrier, migration (issue #136)', () => {
  it('s01, s02… sans trou, tous en 9 × 9, Noir au trait, difficulté croissante de 900 à 1300', () => {
    expect(all).toHaveLength(LOT_S.length);
    expect(LOT_S.length).toBeGreaterThanOrEqual(6);
    expect(LOT_S.length).toBeLessThanOrEqual(8);
    expect(LOT_S.map(r => r.id)).toEqual(LOT_S.map((_, i) => `s${String(i + 1).padStart(2, '0')}`));
    expect(Object.keys(REPLY).sort()).toEqual(all.map(p => p.id));
    expect(Object.keys(THEME).sort()).toEqual(all.map(p => p.id));
    let prev = 0;
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toBeTruthy();
      expect(p.explanation, p.id).toBeTruthy();
      expect(p.difficulty).toBeGreaterThan(prev);
      expect(p.difficulty).toBeGreaterThanOrEqual(900);
      expect(p.difficulty).toBeLessThanOrEqual(1300);
      prev = p.difficulty;
      coupsOf(p);
    }
  });

  it('chaque problème a son thème de pratique', () => {
    for (const p of all) expect(THEME_DU_PROBLEME[p.id], p.id).toBe(THEME[p.id]);
  });

  it('le Go du jour garde son ordre : le lot S, d’un seul tenant, vient juste après le lot R et ferme le calendrier', () => {
    const ids = LOT_S.map(r => r.id);
    expect(CALENDRIER_GO_DU_JOUR.slice(-ids.length)).toEqual(ids);
    expect(CALENDRIER_GO_DU_JOUR.indexOf('s01')).toBe(CALENDRIER_GO_DU_JOUR.indexOf('r06') + 1);
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées) déjà utilisés', () => {
    const others = ALL_PUZZLES.filter(r => !/^s\d\d$/.test(r.id));
    expect(others.length).toBeGreaterThanOrEqual(171);
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_S) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260929000100_lot_s.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('s\d\d', null, 9,/g)).toHaveLength(LOT_S.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_S) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });

  it('textes : « Blanc joue en X » et jamais « prend ta pierre en X » (#282)', () => {
    for (const p of all) for (const t of [p.prompt, p.explanation, p.refutation]) expect(t, p.id).not.toMatch(/prend ta pierre en/);
  });
});

describe('lot S : départ légal et problème réel', () => {
  for (const p of all) {
    it(`${p.id} : chaque chaîne a deux libertés au moins, pas de ko, cibles blanches, pas de prise plus rapide`, () => {
      const { pos, marked } = startOf(p), k = coupsOf(p);
      expect(pos.ko).toBe(-1);
      expect(marked.length).toBeGreaterThan(0);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(groupAt(pos.board, 9, q).liberties.size, `${p.id} ${label(q)}`).toBeGreaterThanOrEqual(2);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
      for (const t of marked) expect(pos.board[t], p.id).toBe(2);
      // Il faut bien k coups : aucune prise en k - 1 coups.
      for (let m = 0; m < 81; m++) expect(captureEn(pos, m, marked, k - 1), `${p.id} ${label(m)}`).toBe(false);
    });
  }
});

describe('lot S : les coups gagnants sont exactement les réponses acceptées, avec ou sans ko', () => {
  for (const p of all) {
    const { pos } = startOf(p);
    preuveParCoup(p.id, pos, p.answers, m => {
      const r = gagne(p, m);
      expect(gagne(p, m, SANS_KO), `${p.id} ${label(m)} sans ko`).toBe(r);
      return r;
    });
  }
});

describe('lot S : les réfutations disent vrai', () => {
  for (const p of all) {
    it(`${p.id} : après chaque erreur (et la passe), Blanc joue la réplique annoncée et Noir échoue, avec ou sans ko`, () => {
      const { pos, marked } = startOf(p), k = coupsOf(p), spec = REPLY[p.id];
      expect(p.refutation).toMatch(new RegExp(`Blanc (joue|s'allonge en) ${spec.defaut}\\b`));
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

describe('lot S : les suites des explications', () => {
  const start = (id: string) => startOf(pz(id)).pos;
  const pris = (pos: Position, l: string) => pos.board[at(l)] === 0;
  const cibles = (id: string) => startOf(pz(id)).marked;
  /** Blanc au trait : Noir prend-il encore en `n` coups, quoi que Blanc joue ? */
  const prendEncore = (id: string, pos: Position, n: number) => defenderFails(pos, cibles(id), n);

  it('s01 : trois libertés ; après E2, D2 puis D1 ou C2 puis C1 laissent Blanc en atari jusqu’à la prise', () => {
    expect(libsOf(start('s01'), 'D3')).toEqual(['C2', 'D2', 'E2']);
    const d = seq(start('s01'), 'E2', 'D2', 'D1');
    expect(libsOf(d, 'D3')).toEqual(['C2']);
    expect(libsOf(seq(d, 'C2'), 'D3')).toEqual(['C1']);
    expect(pris(seq(d, 'C2', 'C1'), 'D3')).toBe(true);
    const c = seq(start('s01'), 'E2', 'C2', 'C1');
    expect(libsOf(c, 'D3')).toEqual(['D2']);
    expect(libsOf(seq(c, 'D2'), 'D3')).toEqual(['D1']);
    expect(pris(seq(c, 'D2', 'D1'), 'D3')).toBe(true);
  });

  it('s02 : le filet F6 ; chaque sortie est suivie d’un atari, puis de la prise si Blanc s’allonge', () => {
    expect(libsOf(start('s02'), 'E5')).toEqual(['E6', 'F5']);
    const x = seq(start('s02'), 'F6', 'E6', 'E7');
    expect(libsOf(x, 'E5')).toEqual(['F5']);
    expect(libsOf(seq(x, 'F5'), 'E5')).toEqual(['F4']);
    expect(pris(seq(x, 'F5', 'F4'), 'E5')).toBe(true);
    const y = seq(start('s02'), 'F6', 'F5', 'F4');
    expect(libsOf(y, 'E5')).toEqual(['E6']);
    expect(libsOf(seq(y, 'E6'), 'E5')).toEqual(['E7']);
    expect(pris(seq(y, 'E6', 'E7'), 'E5')).toBe(true);
  });

  it('s03 : D3 coupe et met en atari ; F3 G3 F2 G2 F1 : E1 et G1 ; E1 G1 H1 prend ; après F3, D3 relie E3 à D4', () => {
    const d3 = seq(start('s03'), 'D3');
    expect(libsOf(d3, 'E3')).toEqual(['F3']);
    const f1 = seq(d3, 'F3', 'G3', 'F2', 'G2', 'F1');
    expect(libsOf(seq(d3, 'F3', 'G3'), 'E3')).toEqual(['F2']);
    expect(libsOf(seq(d3, 'F3', 'G3', 'F2', 'G2'), 'E3')).toEqual(['F1']);
    expect(libsOf(f1, 'E3')).toEqual(['E1', 'G1']);
    expect(libsOf(seq(f1, 'E1', 'G1'), 'E3')).toEqual(['H1']);
    expect(pris(seq(f1, 'E1', 'G1', 'H1'), 'E3')).toBe(true);
    const relie = seq(start('s03'), 'F3', 'D3');
    expect(groupAt(relie.board, 9, at('E3')).stones.map(label)).toContain('D4');
  });

  it('s04 : F3, D3, C3, D2, C2, D1, E1, C1, B1 : atari à chaque coup noir, sauf après D1 ; après D3 puis F3, trois libertés', () => {
    let pos = start('s04');
    const attendu: [string, string, string[]][] = [
      ['F3', 'D3', ['D3']], ['C3', 'D2', ['D2']], ['C2', 'D1', ['D1']], ['E1', 'C1', ['C1']],
    ];
    for (const [noir, blanc, libs] of attendu) {
      pos = seq(pos, noir);
      expect(libsOf(pos, 'E3'), noir).toEqual(libs);
      pos = seq(pos, blanc);
    }
    expect(libsOf(seq(start('s04'), 'F3', 'D3', 'C3', 'D2', 'C2', 'D1'), 'E3')).toEqual(['C1', 'E1']);
    expect(libsOf(pos, 'E3')).toEqual(['B1']);
    expect(pris(seq(pos, 'B1'), 'E3')).toBe(true);
    expect(libsOf(seq(start('s04'), 'D3', 'F3'), 'E3')).toEqual(['F2', 'F4', 'G3']);
  });

  it('s05 : D3 laisse deux libertés ; F3 puis G3 : atari ; E2 puis D2, et Noir prend encore ; après F3, D3 s’échappe', () => {
    const d3 = seq(start('s05'), 'D3');
    expect(libsOf(d3, 'E3')).toEqual(['E2', 'F3']);
    expect(libsOf(seq(d3, 'F3', 'G3'), 'E3')).toEqual(['E2']);
    expect(prendEncore('s05', seq(d3, 'F3', 'G3'), 3)).toBe(true);
    expect(prendEncore('s05', seq(d3, 'E2', 'D2'), 3)).toBe(true);
    expect(libsOf(seq(start('s05'), 'F3', 'D3'), 'E3').length).toBeGreaterThanOrEqual(3);
  });

  it('s06 : G5 ne touche pas la pierre ; E6 D6 F6 F7 G6 G7, puis F5 F4 prend ; F5 F4, et Noir prend encore', () => {
    expect(libsOf(seq(start('s06'), 'G5'), 'E5')).toEqual(['E6', 'F5']);
    const haut = seq(start('s06'), 'G5', 'E6', 'D6', 'F6', 'F7', 'G6', 'G7');
    expect(libsOf(haut, 'E5')).toEqual(['F5']);
    expect(libsOf(seq(haut, 'F5'), 'E5')).toEqual(['F4']);
    expect(pris(seq(haut, 'F5', 'F4'), 'E5')).toBe(true);
    expect(prendEncore('s06', seq(start('s06'), 'G5', 'F5', 'F4'), 3)).toBe(true);
  });
});
