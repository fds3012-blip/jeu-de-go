// Issue #500, lot Y : preuve de chaque problème de fin de partie (yose) de la série « Fin de partie ».
//
// Méthode des leçons 32 et suivantes (src/go/lecons-32-plus.test.ts) : minimax exact de src/go/preuve-fin-de-partie.ts
// (élagage alpha-bêta ; bornes basse et haute égales, sinon aucune preuve) sur les endroits encore ouverts (ZONE : les
// régions vides qui touchent les deux couleurs), en comptage par surfaces. Ce compte ne pénalise pas une pierre prise
// chez soi, et un coup chez soi vaut une passe : la recherche ne voit que la vraie valeur des coups. Les chiffres
// annoncés au joueur sont recomptés en règle japonaise (score() de src/go/score.ts) sur les suites citées.
//
// Tous les coups légaux de Noir sont jugés (preuveParCoup), pas seulement ceux de la zone :
// - dans la zone : valeur exacte de la recherche ;
// - dans un territoire noir fermé : la pierre reste, puis recherche exacte sur la zone ;
// - dans un territoire blanc fermé : la pierre est morte, comme une pierre jetée chez l'adversaire en fin de partie
//   (même règle que le lot W) ; retirée, elle ne compte pas en surfaces : le coup vaut une passe.
// Les réponses acceptées sont exactement les coups qui atteignent la valeur de la position ; tout autre coup perd au
// moins ECART points (surfaces). Après chaque erreur, la réplique citée par la réfutation (« Blanc joue … ») est jouée,
// et Noir finit au moins un point plus bas.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_Y from '../content/lots/y-fin-de-partie';
import { LESSONS_FR } from '../content/lessons';
import { ALL_PUZZLES, CALENDRIER_GO_DU_JOUR } from '../content/puzzles';
import { memePosition, positionsDeLecon } from '../content/redites';
import { THEME_DU_PROBLEME, THEMES_DE_LECON, serieDeLecon } from '../content/themes';
import { PROBLEMES_EN } from '../content/problemes.en';
import { parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { problemesDe, seriesDisponibles } from '../app/seriesThemes';
import { fromLabel, toLabel } from './coords';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { legalMoves } from './lecteurs-lot-d';
import { cederLaMain, preuveParCoup } from './preuve-par-coup';
import { valeurExacte, valeursDesCoups } from './preuve-fin-de-partie';
import { groupAt, neighbors, play, type Position } from './rules';
import { score } from './score';

beforeEach(cederLaMain);

const N = 9;
const all = parsePuzzles(LOT_Y);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, N);
const lab = (m: number) => (m < 0 ? 'passe' : toLabel(m, N));
const labels = (ps: Iterable<number>) => [...ps].map(lab).sort();
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;
const nb = neighbors(N);
const surfaces = { regle: 'chinese' as const };
/** Joue une suite de coups (étiquettes ou « passe »), en alternant à partir du camp au trait. */
const suite = (pos: Position, coups: string[]) => coups.reduce((p, c) => ok(play(p, at(c))), pos);
/** Noir moins Blanc, règle japonaise (territoire et prisonniers), sans komi, partie arrêtée là. */
const japonais = (pos: Position) => { const s = score(pos, 0, 'japanese'); return s.black - s.white; };

/** Endroits encore ouverts : les points vides dont la région vide touche les deux couleurs. */
function ouverts(pos: Position): number[] {
  const vu = new Set<number>(), out: number[] = [];
  for (let p = 0; p < N * N; p++) {
    if (pos.board[p] || vu.has(p)) continue;
    const region: number[] = [], pile = [p], bord = new Set<number>();
    vu.add(p);
    while (pile.length) {
      const q = pile.pop()!;
      region.push(q);
      for (const r of nb[q]) {
        if (pos.board[r]) bord.add(pos.board[r]);
        else if (!vu.has(r)) { vu.add(r); pile.push(r); }
      }
    }
    if (bord.size === 2) out.push(...region);
  }
  return out.sort((a, b) => a - b);
}

/** Pour chaque problème : la zone ouverte, l'écart minimal prouvé, les chaînes en atari au départ (le sujet). */
const SPEC: Record<string, { zone: string[]; ecart: number; sujet?: string[] }> = {
  y01: { zone: ['A1', 'B1', 'C1', 'D1'], ecart: 2 },
};

/** Valeur exacte (surfaces) de chaque premier coup de Noir : tous les coups légaux, passe comprise. */
function valeurs(p: Puzzle) {
  const { pos } = startOf(p);
  const zone = ouverts(pos);
  const proprio = score(pos, 0, 'chinese').owner;
  const dansZone = valeursDesCoups(pos, zone, surfaces);
  const passe = dansZone.get(-1)!;
  const v = new Map<number, number>();
  for (const m of legalMoves(pos)) {
    if (m < 0 || zone.includes(m)) v.set(m, dansZone.get(m)!);
    // Profondeur 15 : la même que valeursDesCoups après un premier coup.
    else if (proprio[m] === 1) v.set(m, valeurExacte(ok(play(pos, m)), zone, { ...surfaces, profondeur: 15 }));
    else v.set(m, passe);
  }
  const best = Math.max(...v.values());
  return { pos, zone, proprio, v, best, passe };
}

const VALEURS = new Map<string, ReturnType<typeof valeurs>>();
const valeursDe = (p: Puzzle) => { if (!VALEURS.has(p.id)) VALEURS.set(p.id, valeurs(p)); return VALEURS.get(p.id)!; };

// ---------------------------------------------------------------------------------------------------------------

describe('lot Y : identifiants, énoncés, thème, série, doublons, calendrier, migration (issue #500)', () => {
  it('y01 et suivants, en 9 × 9, Noir au trait, ouverts à un débutant, du plus facile au plus dur', () => {
    expect(LOT_Y.map(r => r.id)).toEqual(LOT_Y.map((_, i) => `y${String(i + 1).padStart(2, '0')}`));
    expect(Object.keys(SPEC).sort()).toEqual(all.map(p => p.id));
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.answers, p.id).toHaveLength(1);
      expect(p.refutation, p.id).toMatch(/^Pas tout à fait\. Blanc joue [A-J]\d /);
      expect(p.refutation, p.id).toContain(`Blanc joue ${lab(p.answers[0])}`);
      expect(p.explanation, p.id).toMatch(/^Bravo ! /);
      // 650 et plus : la série de fin de la leçon 15 (« Finir la partie ») garde les trois problèmes du lot W.
      expect(p.difficulty, p.id).toBeGreaterThanOrEqual(650);
      expect(p.difficulty, p.id).toBeLessThan(850);
      expect(p.difficulty % 50, p.id).toBe(0);
    }
    const d = all.map(p => p.difficulty);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
  });

  it('chaque problème a le thème « fin de partie » ; les séries des leçons de fin de partie ne changent pas', () => {
    for (const p of all) expect(THEME_DU_PROBLEME[p.id], p.id).toBe('fin-de-partie');
    for (const l of ['l15', 'l22', 'l23', 'l32', 'l33']) {
      expect(THEMES_DE_LECON[l], l).toEqual(['fin-de-partie']);
      expect(serieDeLecon(l, ALL_PUZZLES, new Set()).map(p => p.id), l).toEqual(['w04', 'w05', 'w06']);
    }
  });

  it('la série « Fin de partie » réunit le lot W (finir, compter) et ce lot', () => {
    const banque = parsePuzzles(ALL_PUZZLES);
    expect(problemesDe(banque, 'fin-de-partie').map(p => p.id).sort())
      .toEqual(['w04', 'w05', 'w06', 'w07', 'w08', 'w09', ...LOT_Y.map(r => r.id)].sort());
    if (LOT_Y.length >= 2) expect(seriesDisponibles(banque)).toContain('fin-de-partie');
  });

  it('le Go du jour garde son ordre : le lot Y, d’un seul tenant, vient juste après le lot X et ferme le calendrier', () => {
    const ids = LOT_Y.map(r => r.id);
    const debut = CALENDRIER_GO_DU_JOUR.indexOf('y01');
    expect(CALENDRIER_GO_DU_JOUR.slice(-ids.length)).toEqual(ids);
    expect(debut).toBe(CALENDRIER_GO_DU_JOUR.indexOf('x08') + 1);
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées)', () => {
    const others = ALL_PUZZLES.filter(r => !/^y\d\d$/.test(r.id));
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_Y) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('aucun problème ne reprend un exercice de leçon (symétries et échange des couleurs compris)', () => {
    const exercices = LESSONS_FR.flatMap(l => positionsDeLecon(l)).filter(r => r.length === 9);
    expect(exercices.length).toBeGreaterThan(10);
    for (const row of LOT_Y) for (const e of exercices) expect(memePosition(rowsOf(row.setup), e), row.id).toBe(false);
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261008235100_lot_y.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('y\d\d', null, 9,/g)).toHaveLength(LOT_Y.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_Y) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });

  it('chaque problème a son anglais', () => {
    for (const p of all) expect(PROBLEMES_EN[p.id], p.id).toBeTruthy();
  });
});

describe('lot Y : départ légal, zone fermée', () => {
  for (const p of all) {
    it(`${p.id} : pas de ko, aucune chaîne en atari hors du sujet ; zone ouverte annoncée ; le reste est fermé`, () => {
      const { pos } = startOf(p);
      expect(pos.ko).toBe(-1);
      const sujet = new Set((SPEC[p.id].sujet ?? []).map(at));
      for (let q = 0; q < N * N; q++) {
        if (!pos.board[q] || sujet.has(q)) continue;
        expect(groupAt(pos.board, N, q).liberties.size, `${p.id} ${lab(q)}`).toBeGreaterThanOrEqual(2);
      }
      for (const s of sujet) expect(groupAt(pos.board, N, s).liberties.size, `${p.id} sujet ${lab(s)}`).toBe(1);
      const zone = ouverts(pos);
      expect(labels(zone)).toEqual([...SPEC[p.id].zone].sort());
      // Hors de la zone, chaque point vide est déjà à quelqu'un (territoire fermé).
      const proprio = score(pos, 0, 'chinese').owner;
      for (let q = 0; q < N * N; q++) if (!pos.board[q] && !zone.includes(q)) expect(proprio[q], lab(q)).not.toBe(0);
      for (const a of p.answers) expect(zone).toContain(a);
    });
  }
});

describe('lot Y : la réponse est le seul meilleur coup (minimax exact, comptage par surfaces)', () => {
  for (const p of all) {
    const coups = legalMoves(startOf(p).pos).filter(m => m !== -1);
    preuveParCoup(p.id, startOf(p).pos, p.answers, m => { const { v, best } = valeursDe(p); return v.get(m) === best; }, { coups });

    it(`${p.id} : tout autre coup, et la passe, perd au moins ${SPEC[p.id].ecart} points`, () => {
      const { v, best } = valeursDe(p);
      for (const [m, x] of v) if (!p.answers.includes(m)) expect(best - x, lab(m)).toBeGreaterThanOrEqual(SPEC[p.id].ecart);
    }, 120_000);

    it(`${p.id} : après chaque erreur, Blanc joue ${lab(p.answers[0])} et Noir finit au moins un point plus bas`, () => {
      const { pos, zone, proprio, best } = valeursDe(p);
      const a = p.answers[0];
      for (const m of legalMoves(pos).filter(x => !p.answers.includes(x))) {
        // Une pierre jetée chez Blanc est morte : retirée, c'est une passe.
        const r = ok(play(pos, m >= 0 && !zone.includes(m) && proprio[m] === 2 ? -1 : m));
        const w = ok(play(r, a));
        expect(valeurExacte(w, zone, { ...surfaces, profondeur: 14 }), lab(m)).toBeLessThanOrEqual(best - 1);
      }
    }, 120_000);
  }
});

// ---------------------------------------------------------------------------------------------------------------

describe('lot Y : les chiffres et les suites des textes (règle japonaise)', () => {
  it('y01 : D1 garde A1, B1 et C1 ; reculer en C1 laisse Blanc avancer en D1 : un point de moins', () => {
    const p = pz('y01'), { pos } = startOf(p);
    const d1 = suite(pos, ['D1']);
    expect(ouverts(d1)).toEqual([]);
    for (const l of ['A1', 'B1', 'C1']) expect(score(d1, 0, 'japanese').owner[at(l)], l).toBe(1);
    expect(japonais(suite(pos, ['C1', 'D1']))).toBe(japonais(d1) - 1);
    // Sans réponse, Blanc avance en D1 et Noir bloque en C1 : un point de moins aussi.
    expect(japonais(suite(pos, ['passe', 'D1', 'C1']))).toBe(japonais(d1) - 1);
  });
});
