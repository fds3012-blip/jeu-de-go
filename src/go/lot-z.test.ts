// Issue #539, lot Z : preuve de chaque problème du joueur de club (1200 à 1600).
//
// Trois familles, chacune avec son outil exact :
// - vie et mort (« Noir joue et vit. », « Noir joue et tue. ») : src/go/preuve-vie-mort.ts, recherche complète dans la
//   zone (fermée, vérifiée par defautsDeZone) ; vivant = deux vrais yeux (Benson) ; mort = capturé ; un ko, un seki, une
//   répétition ou la profondeur comptent comme « non résolu », jamais comme une preuve ;
// - course aux libertés (« Noir joue et gagne la course ») : src/go/preuve-course.ts, les deux chaînes marquées (S noire,
//   T blanche), zone = leurs libertés (fermée, vérifiée par defautsCourse) ; gagné = la chaîne blanche est prise ;
// - fin de partie : src/go/preuve-fin-de-partie.ts, minimax exact (alpha-bêta, bornes basse et haute égales) sur les
//   endroits ouverts, compté par surfaces ; les chiffres des textes sont recomptés en règle japonaise (score()).
// Chaque coup légal de Noir est jugé (dans la zone, ailleurs, et la passe) : les réponses acceptées sont exactement les
// coups qui atteignent le but. Après chaque erreur (hors passe), la réplique citée par la réfutation est jouée et Noir
// n'atteint plus le but.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_Z from '../content/lots/z-club';
import { LESSONS_FR } from '../content/lessons';
import { ALL_PUZZLES, CALENDRIER_GO_DU_JOUR } from '../content/puzzles';
import { memePosition, positionsDeLecon } from '../content/redites';
import { THEME_DU_PROBLEME } from '../content/themes';
import { PROBLEMES_EN } from '../content/problemes.en';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { legalMoves } from './lecteurs-lot-d';
import { cederLaMain, preuveParCoup } from './preuve-par-coup';
import { defautsDeZone, evaluer, issueApres, yeuxDuGroupe } from './preuve-vie-mort';
import { defautsCourse, evaluerCourse } from './preuve-course';
import { valeurExacte, valeursDesCoups } from './preuve-fin-de-partie';
import { groupAt, isLegal, neighbors, play, type Position } from './rules';
import { score } from './score';

beforeEach(cederLaMain);

const N = 9;
const all = parsePuzzles(LOT_Z);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, N);
const lab = (m: number) => (m < 0 ? 'passe' : toLabel(m, N));
const labels = (ps: Iterable<number>) => [...ps].map(lab).sort();
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;
const nb = neighbors(N);
const surfaces = { regle: 'chinese' as const };
const suite = (pos: Position, coups: string[]) => coups.reduce((p, c) => ok(play(p, c === 'passe' ? -1 : at(c))), pos);
const japonais = (pos: Position) => { const s = score(pos, 0, 'japanese'); return s.black - s.white; };
const libs = (pos: Position, l: string) => labels(groupAt(pos.board, N, at(l)).liberties);

type Famille = 'vie-mort' | 'course' | 'fin';
/**
 * Pour chaque problème : la famille, la zone (vie et mort ; fin de partie : les endroits ouverts, recalculés et comparés),
 * la réplique citée par la réfutation (`sauf` : réplique propre à certaines erreurs ; `attendre` : erreurs après lesquelles
 * Blanc n'a même pas besoin de répondre ; `sansKo` : erreurs qui ne tuent pas, mais ne laissent qu'un ko ou un seki),
 * et pour la fin de partie l'écart minimal (surfaces) de toute erreur.
 */
const SPEC: Record<string, { famille: Famille; zone?: string[]; reponse?: string; sauf?: Record<string, string[]>;
  attendre?: string[]; sansKo?: string[]; ecart?: number; sujet?: string }> = {
  z01: { famille: 'vie-mort', zone: ['A1', 'B1', 'C1', 'E1'], reponse: 'B1' },
  z02: { famille: 'course', reponse: 'A2', sauf: { F1: ['A2'] } },
  z03: { famille: 'vie-mort', zone: ['J9', 'J8', 'J6', 'J5'], reponse: 'J5' },
  z04: { famille: 'fin', zone: ['E9', 'A1', 'B1', 'C1'], reponse: 'E9', ecart: 4, sujet: 'C9' },
  z05: { famille: 'vie-mort', zone: ['A2', 'B2', 'A1', 'B1', 'C1'], reponse: 'B1' },
  z06: { famille: 'course', reponse: 'A2', sauf: { B1: ['A2'] } },
  z07: { famille: 'course', reponse: 'A2', sauf: { B1: ['A2'] } },
  z08: { famille: 'fin', zone: ['F9', 'A1', 'B1', 'C1', 'D1'], reponse: 'F9', ecart: 6, sujet: 'C9' },
  z09: { famille: 'vie-mort', zone: ['B2', 'C2', 'A1', 'B1', 'C1'], reponse: 'B1' },
  z10: { famille: 'vie-mort', zone: ['A1', 'C1', 'D1'], reponse: 'D1' },
  z11: { famille: 'course', reponse: 'A2', attendre: ['A2'] },
  z12: { famille: 'fin', zone: ['E9', 'E2', 'A1', 'B1', 'C1', 'D1'], reponse: 'E9', ecart: 4, sujet: 'B9' },
  z13: { famille: 'course', reponse: 'J2', sauf: { B1: ['F1'] } },
  z14: { famille: 'course', reponse: 'A2', sauf: { J2: ['A2', 'J1'] } },
  z15: { famille: 'vie-mort', zone: ['A2', 'B2', 'C2', 'A1', 'B1', 'C1'], reponse: 'B2', sauf: { B1: ['C1'] }, sansKo: ['A2', 'B1'] },
};

const THEME: Record<Famille, string> = { 'vie-mort': 'vie-mort', course: 'semeai', fin: 'fin-de-partie' };

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

/** Vie et mort : cible marquée, zone, issue visée (du point de vue du groupe marqué). */
function vieMort(p: Puzzle) {
  const { pos, marked } = startOf(p);
  const vivre = p.prompt.startsWith('Noir joue et vit.');
  if (!vivre && !p.prompt.startsWith('Noir joue et tue.')) throw new Error(`énoncé inconnu : ${p.id}`);
  return { pos, cible: marked[0], zone: SPEC[p.id].zone!.map(at), vise: (vivre ? 1 : -1) as 1 | -1 };
}

/** Course : la chaîne noire marquée (a), la blanche (b), et leurs libertés (la zone). */
function course(p: Puzzle) {
  const { pos, marked } = startOf(p);
  const a = marked.find(q => pos.board[q] === 1)!, b = marked.find(q => pos.board[q] === 2)!;
  const zone = [...new Set([...groupAt(pos.board, N, a).liberties, ...groupAt(pos.board, N, b).liberties])].sort((x, y) => x - y);
  return { pos, a, b, zone };
}
/** Issue (camp noir) après le coup `m` du camp au trait ; null si illégal. Un coup qui crée un ko vaut 0. */
const issueCourse = (pos: Position, m: number, a: number, b: number, zone: number[]) => {
  const r = play(pos, m);
  if (typeof r === 'string') return null;
  return r.ko !== -1 ? 0 : evaluerCourse(r, a, b, zone);
};

/** Fin de partie : valeur exacte (surfaces) de chaque coup légal de Noir, comme le lot Y. */
function valeurs(p: Puzzle) {
  const { pos } = startOf(p);
  const zone = ouverts(pos);
  const proprio = score(pos, 0, 'chinese').owner;
  const dansZone = valeursDesCoups(pos, zone, { ...surfaces, profondeur: 18 });
  const passe = dansZone.get(-1)!;
  const v = new Map<number, number>();
  for (const m of legalMoves(pos)) {
    if (m < 0 || zone.includes(m)) v.set(m, dansZone.get(m)!);
    else if (proprio[m] === 1) v.set(m, valeurExacte(ok(play(pos, m)), zone, { ...surfaces, profondeur: 17 }));
    else v.set(m, passe);
  }
  return { pos, zone, proprio, v, best: Math.max(...v.values()) };
}
const VALEURS = new Map<string, ReturnType<typeof valeurs>>();
const valeursDe = (p: Puzzle) => { if (!VALEURS.has(p.id)) VALEURS.set(p.id, valeurs(p)); return VALEURS.get(p.id)!; };

/** Réplique citée après l'erreur `m`. */
const repliqueDe = (id: string, m: string) =>
  Object.entries(SPEC[id].sauf ?? {}).find(([, erreurs]) => erreurs.includes(m))?.[0] ?? SPEC[id].reponse!;

// ---------------------------------------------------------------------------------------------------------------

describe('lot Z : identifiants, énoncés, thèmes, doublons, calendrier, migration (issue #539)', () => {
  it('z01 à z15, en 9 × 9, Noir au trait, de 1200 à 1600, du plus facile au plus dur', () => {
    expect(LOT_Z.map(r => r.id)).toEqual(LOT_Z.map((_, i) => `z${String(i + 1).padStart(2, '0')}`));
    expect(LOT_Z.length).toBeGreaterThanOrEqual(15);
    expect(Object.keys(SPEC).sort()).toEqual(all.map(p => p.id));
    let prev = 0;
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.difficulty, p.id).toBeGreaterThanOrEqual(1200);
      expect(p.difficulty, p.id).toBeLessThanOrEqual(1600);
      expect(p.difficulty % 50, p.id).toBe(0);
      expect(p.difficulty, p.id).toBeGreaterThanOrEqual(prev);
      prev = p.difficulty;
      expect(p.explanation, p.id).toMatch(/^Bravo ! /);
      expect(p.refutation, p.id).toMatch(/^Pas tout à fait\. Blanc joue [A-J]\d\b/);
      expect(p.refutation, p.id).toContain(`Blanc joue ${SPEC[p.id].reponse}`);
      for (const [r, erreurs] of Object.entries(SPEC[p.id].sauf ?? {})) expect(p.refutation, p.id).toContain(`ou ${r} si tu as joué ${erreurs.join(' ou ')}`);
    }
    // Les trois familles, et les deux buts de vie et mort, sont présents.
    const familles = new Set(Object.values(SPEC).map(s => s.famille));
    expect([...familles].sort()).toEqual(['course', 'fin', 'vie-mort']);
    const vm = all.filter(p => SPEC[p.id].famille === 'vie-mort');
    expect(vm.some(p => p.prompt.startsWith('Noir joue et vit.'))).toBe(true);
    expect(vm.some(p => p.prompt.startsWith('Noir joue et tue.'))).toBe(true);
    for (const p of all.filter(q => SPEC[q.id].famille === 'course')) expect(p.prompt, p.id).toMatch(/^Noir joue et gagne la course aux libertés/);
  });

  it('chaque problème a le thème de sa famille', () => {
    for (const p of all) expect(THEME_DU_PROBLEME[p.id], p.id).toBe(THEME[SPEC[p.id].famille]);
  });

  it('le Go du jour garde son ordre : le lot Z, d’un seul tenant, vient juste après le lot Y, puis le lot AA (#548)', () => {
    const ids = LOT_Z.map(r => r.id), debut = CALENDRIER_GO_DU_JOUR.indexOf('z01');
    expect(CALENDRIER_GO_DU_JOUR.slice(debut, debut + ids.length)).toEqual(ids);
    expect(debut).toBe(CALENDRIER_GO_DU_JOUR.indexOf('y04') + 1);
    expect(CALENDRIER_GO_DU_JOUR[debut + ids.length]).toBe('aa01');
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées)', () => {
    const others = ALL_PUZZLES.filter(r => !/^z\d\d$/.test(r.id));
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_Z) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('aucun problème ne reprend un exercice de leçon (symétries et échange des couleurs compris)', () => {
    const exercices = LESSONS_FR.flatMap(l => positionsDeLecon(l)).filter(r => r.length === 9);
    for (const row of LOT_Z) for (const e of exercices) expect(memePosition(rowsOf(row.setup), e), row.id).toBe(false);
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261014120000_lot_z.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('z\d\d', null, 9,/g)).toHaveLength(LOT_Z.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_Z) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });

  it('chaque problème a son anglais', () => {
    for (const p of all) expect(PROBLEMES_EN[p.id], p.id).toBeTruthy();
  });
});

describe('lot Z : départ légal, zone fermée', () => {
  for (const p of all) {
    it(`${p.id} : pas de ko, chaque chaîne a deux libertés au moins, zone fermée, réponses légales`, () => {
      const { pos } = startOf(p);
      expect(pos.ko).toBe(-1);
      // Fin de partie : seules les pierres blanches que la réponse prend sont en atari (le sujet du problème).
      const prises = SPEC[p.id].famille === 'fin' ? groupAt(pos.board, N, at(SPEC[p.id].sujet!)).stones : [];
      for (let q = 0; q < N * N; q++) {
        if (!pos.board[q]) continue;
        const n = groupAt(pos.board, N, q).liberties.size;
        if (prises.includes(q)) expect(n, `${p.id} ${lab(q)}`).toBe(1);
        else expect(n, `${p.id} ${lab(q)}`).toBeGreaterThanOrEqual(2);
      }
      if (prises.length) expect(labels(groupAt(pos.board, N, prises[0]).liberties)).toEqual([...p.answers].map(lab));
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
      const f = SPEC[p.id].famille;
      if (f === 'vie-mort') {
        const { cible, zone, vise } = vieMort(p);
        expect(startOf(p).marked).toHaveLength(1);
        expect(pos.board[cible]).toBe(vise === 1 ? 1 : 2);
        expect(defautsDeZone(pos, cible, zone)).toEqual([]);
        // Aucun point vide de la zone ne touche un point vide hors de la zone.
        for (const z of zone) for (const r of nb[z]) if (!pos.board[r]) expect(zone, `${lab(z)}-${lab(r)}`).toContain(r);
      } else if (f === 'course') {
        const { a, b, zone } = course(p);
        expect(startOf(p).marked).toHaveLength(2);
        expect(defautsCourse(pos, a, b, zone)).toEqual([]);
      } else {
        expect(labels(ouverts(pos))).toEqual([...SPEC[p.id].zone!].sort());
        const proprio = score(pos, 0, 'chinese').owner;
        for (let q = 0; q < N * N; q++) if (!pos.board[q] && !ouverts(pos).includes(q)) expect(proprio[q], lab(q)).not.toBe(0);
      }
    });
  }
});

describe('lot Z : les coups gagnants sont exactement les réponses acceptées', () => {
  for (const p of all) {
    const f = SPEC[p.id].famille, { pos } = startOf(p);
    if (f === 'vie-mort') {
      const { cible, zone, vise } = vieMort(p);
      preuveParCoup(p.id, pos, p.answers, m => issueApres(pos, m, cible, zone) === vise);
    } else if (f === 'course') {
      const { a, b, zone } = course(p);
      preuveParCoup(p.id, pos, p.answers, m => issueCourse(pos, m, a, b, zone) === 1);
    } else {
      preuveParCoup(p.id, pos, p.answers, m => { const { v, best } = valeursDe(p); return v.get(m) === best; });
      it(`${p.id} : tout autre coup, et la passe, perd au moins ${SPEC[p.id].ecart} points (surfaces)`, () => {
        const { v, best } = valeursDe(p);
        for (const [m, x] of v) if (!p.answers.includes(m)) expect(best - x, lab(m)).toBeGreaterThanOrEqual(SPEC[p.id].ecart!);
      }, 120_000);
    }
  }
});

describe('lot Z : la passe n’atteint pas le but, et chaque erreur est punie par la réplique citée', () => {
  for (const p of all) {
    const f = SPEC[p.id].famille, { pos } = startOf(p), spec = SPEC[p.id];
    const erreurs = legalMoves(pos).filter(m => m >= 0 && !p.answers.includes(m));
    it(`${p.id} : les répliques d’exception visent de vraies erreurs`, () => {
      for (const l of [...Object.values(spec.sauf ?? {}).flat(), ...(spec.attendre ?? []), ...(spec.sansKo ?? [])]) expect(erreurs.map(lab), l).toContain(l);
    });
    if (f === 'vie-mort') {
      const { cible, zone, vise } = vieMort(p);
      it(`${p.id} : la passe ne suffit pas`, () => expect(issueApres(pos, -1, cible, zone)).not.toBe(vise));
      for (const m of erreurs) {
        const l = lab(m), r = repliqueDe(p.id, l);
        it(`${p.id} : ${l} échoue, puis ${r} le punit`, () => {
          const apres = ok(play(pos, m));
          if (spec.sansKo?.includes(l)) {
            // Pas de prise sans ko : la recherche ne trouve ni la mort ni la vie franches.
            expect(issueApres(pos, m, cible, zone)).toBe(0);
          } else {
            expect(issueApres(pos, m, cible, zone)).toBe(-vise);
            expect(issueApres(apres, at(r), cible, zone), `${l} puis ${r}`).toBe(-vise);
          }
        }, 120_000);
      }
    } else if (f === 'course') {
      const { a, b, zone } = course(p);
      it(`${p.id} : la passe ne gagne pas ; Blanc au trait gagne la course`, () => {
        expect(issueCourse(pos, -1, a, b, zone)).not.toBe(1);
        expect(evaluerCourse({ ...pos, toPlay: 2 }, a, b, zone)).toBe(-1);
      });
      for (const m of erreurs) {
        const l = lab(m);
        it(`${p.id} : ${l} ne gagne pas, et ${spec.attendre?.includes(l) ? 'Blanc peut attendre' : `${repliqueDe(p.id, l)} l’en empêche`}`, () => {
          expect(issueCourse(pos, m, a, b, zone)).not.toBe(1);
          const apres = ok(play(pos, m));
          const r = spec.attendre?.includes(l) ? -1 : at(repliqueDe(p.id, l));
          expect(issueCourse(apres, r, a, b, zone), `${l} puis ${lab(r)}`).not.toBe(1);
        }, 120_000);
      }
    } else {
      it(`${p.id} : après chaque erreur, Blanc joue ${spec.reponse} et Noir finit plus bas d’au moins ${spec.ecart} points`, () => {
        const { zone, proprio, best } = valeursDe(p);
        for (const m of [...erreurs, -1]) {
          const r = ok(play(pos, m >= 0 && !zone.includes(m) && proprio[m] === 2 ? -1 : m));
          const w = ok(play(r, at(spec.reponse!)));
          expect(valeurExacte(w, zone, { ...surfaces, profondeur: 16 }), lab(m)).toBeLessThanOrEqual(best - spec.ecart!);
        }
      }, 120_000);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------

describe('lot Z : ce que disent les textes', () => {
  const start = (id: string) => startOf(pz(id)).pos;
  const vrais = (pos: Position, l: string) => yeuxDuGroupe(pos, at(l)).filter(y => y.vrai).map(y => lab(y.point)).sort();
  const vit = (pos: Position, l: string, zone: string[]) => evaluer(pos, at(l), zone.map(at));

  it('z01 : B1 et F1 étaient miai ; après B1, A1 et C1 sont deux vrais yeux ; Blanc B1 d’abord ne laissait qu’un œil', () => {
    const avant = start('z01').board.slice(); avant[at('F1')] = 0;
    const libre: Position = { ...start('z01'), board: avant, toPlay: 2 };
    const z = [...SPEC.z01.zone!, 'F1'];
    expect(vit(libre, 'B2', z)).toBe(1);
    expect(issueApres(libre, at('F1'), at('B2'), z.map(at))).toBe(1);
    const b1 = suite(start('z01'), ['B1']);
    expect(vrais(b1, 'B2')).toEqual(['A1', 'C1']);
    expect(issueApres(ok(play(start('z01'), at('E1'))), at('B1'), at('B2'), SPEC.z01.zone!.map(at))).toBe(-1);
  });

  it('z02 : deux libertés dehors chacun et une liberté commune, F1', () => {
    const pos = start('z02');
    expect(libs(pos, 'C2')).toEqual(['A1', 'A2', 'F1']);
    expect(libs(pos, 'G2')).toEqual(['F1', 'J1', 'J2']);
  });

  it('z03 : J8-J9 est déjà un œil ; après J5, J6 est le deuxième ; J4 et J5 étaient miai', () => {
    const j5 = suite(start('z03'), ['J5']);
    expect(vrais(j5, 'H8')).toEqual(['J6']);
    for (const l of ['J8', 'J9']) expect(nb[at(l)].every(r => j5.board[r] === 1 || [at('J8'), at('J9')].includes(r)), l).toBe(true);
    const avant = start('z03').board.slice(); avant[at('J4')] = 0;
    const libre: Position = { ...start('z03'), board: avant, toPlay: 2 };
    const z = [...SPEC.z03.zone!, 'J4'];
    expect(vit(libre, 'H8', z)).toBe(1);
    expect(labels(z.map(at).filter(w => !libre.board[w] && isLegal(libre, w) && evaluer(ok(play(ok(play(libre, w)), -1)), at('H8'), z.map(at)) !== 1))).toEqual(['J4', 'J5']);
  });

  it('z04 : E9 prend deux pierres (4 points) ; en bas, Blanc C1 puis Noir B1 ne coûte qu’un point', () => {
    const pos = start('z04');
    const e9 = suite(pos, ['E9']);
    expect(e9.captures[1]).toBe(2);
    expect(japonais(suite(pos, ['E9', 'passe'])) - japonais(suite(pos, ['passe', 'E9']))).toBe(4);
    expect(japonais(suite(pos, ['C1', 'passe'])) - japonais(suite(pos, ['passe', 'C1', 'B1']))).toBe(1);
    expect(ouverts(suite(pos, ['E9', 'C1', 'B1']))).toEqual([]);
  });

  it('z05 et z09 : grappe de cinq ; B1 touche trois des autres points ; Blanc en B1 vivait', () => {
    for (const id of ['z05', 'z09']) {
      const { pos, cible, zone } = vieMort(pz(id));
      expect(nb[at('B1')].filter(r => zone.includes(r)).length, id).toBe(3);
      expect(issueApres({ ...pos, toPlay: 2 }, at('B1'), cible, zone), id).toBe(1);
    }
  });

  it('z06 et z07 : l’œil B1 et A2 pour Noir, J1-J2 (z06) ou J2 et l’œil G1 (z07) pour Blanc ; après J2, Blanc n’a plus que G1', () => {
    expect(libs(start('z06'), 'C2')).toEqual(['A2', 'B1']);
    expect(libs(start('z06'), 'F2')).toEqual(['J1', 'J2']);
    expect(libs(start('z07'), 'C2')).toEqual(['A2', 'B1']);
    expect(libs(start('z07'), 'F2')).toEqual(['G1', 'J2']);
    expect(libs(suite(start('z07'), ['J2']), 'F2')).toEqual(['G1']);
  });

  it('z08 : F9 prend trois pierres (6 points) ; Blanc D1 puis Noir C1 ne coûte qu’un point', () => {
    const pos = start('z08');
    expect(suite(pos, ['F9']).captures[1]).toBe(3);
    expect(japonais(suite(pos, ['F9', 'passe'])) - japonais(suite(pos, ['passe', 'F9']))).toBe(6);
    expect(japonais(suite(pos, ['D1', 'passe'])) - japonais(suite(pos, ['passe', 'D1', 'C1']))).toBe(1);
  });

  it('z10 : A1 est un œil ; après D1, C1 est le deuxième ; D1 et E1 étaient miai', () => {
    const d1 = suite(start('z10'), ['D1']);
    expect(vrais(d1, 'B2')).toEqual(['A1', 'C1']);
    const avant = start('z10').board.slice(); avant[at('E1')] = 0;
    const libre: Position = { ...start('z10'), board: avant, toPlay: 2 };
    const z = [...SPEC.z10.zone!, 'E1'];
    expect(vit(libre, 'B2', z)).toBe(1);
    expect(labels(z.map(at).filter(w => !libre.board[w] && isLegal(libre, w) && evaluer(ok(play(ok(play(libre, w)), -1)), at('B2'), z.map(at)) !== 1))).toEqual(['D1', 'E1']);
  });

  it('z11 : E1 est commune ; après E1, Blanc n’a plus que son œil G1 (atari), Noir garde A1 et A2', () => {
    const pos = start('z11');
    expect(libs(pos, 'C2')).toEqual(['A1', 'A2', 'E1']);
    expect(libs(pos, 'F2')).toEqual(['E1', 'G1']);
    const e1 = suite(pos, ['E1']);
    expect(libs(e1, 'F2')).toEqual(['G1']);
    expect(libs(e1, 'C2')).toEqual(['A1', 'A2']);
  });

  it('z12 : E9 prend trois pierres (6 points)', () => {
    const pos = start('z12');
    expect(suite(pos, ['E9']).captures[1]).toBe(3);
    expect(japonais(suite(pos, ['E9', 'passe'])) - japonais(suite(pos, ['passe', 'E9']))).toBe(6);
  });

  it('z13 et z14 : J1 d’abord laisse une pierre à une liberté, que Blanc prend en J2', () => {
    for (const id of ['z13', 'z14']) {
      const j1 = suite(start(id), ['J1']);
      expect(libs(j1, 'J1'), id).toEqual(['J2']);
      expect(suite(start(id), ['J1', 'J2']).board[at('J1')], id).toBe(0);
    }
    expect(libs(start('z13'), 'C2')).toEqual(['B1', 'F1']);
    expect(libs(start('z13'), 'G2')).toEqual(['F1', 'J1', 'J2']);
    expect(libs(start('z14'), 'C2')).toEqual(['A1', 'A2', 'C1']);
    expect(libs(start('z14'), 'F2')).toEqual(['G1', 'J1', 'J2']);
  });

  it('z15 : six points en rectangle, sans liberté dehors ; B2 tue sans ko', () => {
    const { pos, cible, zone } = vieMort(pz('z15'));
    // L'espace : six points vides d'un seul tenant, entourés par Blanc et le bord ; ses libertés sont toutes dedans.
    expect(labels(zone.filter(z => !pos.board[z]))).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    for (const l of groupAt(pos.board, N, cible).liberties) expect(zone).toContain(l);
    for (const z of zone) for (const r of nb[z]) expect(pos.board[r] !== 1, lab(r)).toBe(true);
    expect(issueApres(pos, at('B2'), cible, zone)).toBe(-1);
  });
});
