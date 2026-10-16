// Issue #557, lot AB : preuve de chaque problème du joueur de club (difficulté 1250 à 1700, de 5 kyu vers le dan).
//
// Mêmes outils exacts que le lot AA (src/go/lot-aa.test.ts). Chaque coup légal de Noir est jugé (dans la zone, ailleurs,
// et la passe) : les réponses acceptées sont exactement les coups qui atteignent le but. Chaque erreur est prouvée par un
// outil qui ne tire jamais une conclusion d'une coupure, et la réplique citée par la réfutation est jouée.
// - « Noir joue et vit. » / « Noir joue et tue. » : src/go/preuve-vie-mort.ts, recherche complète dans la zone
//   (fermée, vérifiée par defautsDeZone) ; vivant = deux vrais yeux (Benson), mort = capturé ; un ko ou un seki ne
//   compte jamais comme une preuve. Erreur prouvée par src/go/preuve-ko.ts : après elle, Noir ne vit pas (ou ne tue pas)
//   même si son adversaire gagne tous les ko (pasDeVie, survit) ;
// - ko (« Obtiens au moins un ko ») : src/go/preuve-ko.ts. La réponse donne un vrai ko : le camp qui gagne tous les ko
//   obtient ce qu'il veut (evaluerMaitre), et la recherche sans ko ne tranche pas. Après une erreur, Noir échoue même
//   s'il gagne tous les ko ;
// - seki (« Sauve ton groupe marqué par un seki ») : après la réponse, le groupe ne peut plus être pris, même si Blanc
//   gagne tous les ko (survit), et ne fait pas deux yeux, même si Noir les gagne tous (pasDeVie). Après une erreur, il
//   meurt même si Noir gagne tous les ko ;
// - capture (« Capture les pierres marquées en deux (ou trois) coups au plus. ») : lecteur exact du lot N
//   (src/go/lecteurs-lot-n.ts), tous les coups légaux et la passe, avec et sans ko : même résultat ;
// - fin de partie : minimax exact de src/go/preuve-fin-de-partie.ts (bornes basse et haute égales), compté par
//   surfaces ; tout autre coup perd au moins `ecart` points, et la réplique citée le confirme.
// Chaque suite citée par une explication (« si Blanc joue X, tu réponds Y ») est rejouée (SUITES).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_AB from '../content/lots/ab-club';
import { LESSONS_FR } from '../content/lessons';
import { ALL_PUZZLES, CALENDRIER_GO_DU_JOUR } from '../content/puzzles';
import { memePosition, positionsDeLecon } from '../content/redites';
import { THEME_DU_PROBLEME } from '../content/themes';
import { PROBLEMES_EN } from '../content/problemes.en';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { legalMoves } from './lecteurs-lot-d';
import { AVEC_KO, SANS_KO, attackerCaptures, captureEn } from './lecteurs-lot-n';
import { cederLaMain, preuveParCoup } from './preuve-par-coup';
import { defautsDeZone, evaluer, issueApres, yeuxDuGroupe } from './preuve-vie-mort';
import { evaluerMaitre, pasDeVie, survit } from './preuve-ko';
import { valeurExacte, valeursDesCoups } from './preuve-fin-de-partie';
import { groupAt, neighbors, play, type Position } from './rules';
import { score } from './score';

beforeEach(cederLaMain);

const N = 9;
const MIGRATION = '20261016090000_lot_ab';
const all = parsePuzzles(LOT_AB);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, N);
const lab = (m: number) => (m < 0 ? 'passe' : toLabel(m, N));
const labels = (ps: Iterable<number>) => [...ps].map(lab).sort();
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;
const nb = neighbors(N);
const surfaces = { regle: 'chinese' as const };
const suite = (pos: Position, coups: string[]) => coups.reduce((p, c) => ok(play(p, c === 'passe' ? -1 : at(c))), pos);
const libs = (pos: Position, l: string) => labels(groupAt(pos.board, N, at(l)).liberties);

type Famille = 'vit' | 'tue' | 'ko-vit' | 'ko-tue' | 'seki' | 'capture' | 'fin';
/**
 * Pour chaque problème : la famille, le thème, la zone (vie et mort, ko, seki : les points vides de l'espace et les
 * pierres de l'attaquant enfermées dedans ; fin de partie : les endroits ouverts), la réplique citée par la réfutation
 * (`sauf` : réplique propre à certaines erreurs ; `attendre` : erreurs après lesquelles Blanc n'a même pas besoin de
 * répondre ; `attendreTout` : aucune erreur n'a besoin de réponse), le nombre de coups (capture), l'écart minimal de
 * toute erreur (fin de partie, surfaces) et les suites citées par l'explication (coup blanc, réponse noire).
 */
const SPEC: Record<string, { famille: Famille; theme: string; zone?: string[]; reponse: string; sauf?: Record<string, string[]>;
  attendre?: string[]; attendreTout?: boolean; k?: number; ecart?: number; suites?: [string, string][] }> = {
  ab01: { famille: 'fin', theme: 'fin-de-partie', zone: ['D9', 'E9', 'A2', 'C2', 'D2', 'A1', 'B1', 'C1'], reponse: 'C1', ecart: 2, suites: [['D9', 'E9'], ['E9', 'D9']] },
  ab02: { famille: 'vit', theme: 'vie-mort', zone: ['B2', 'C2', 'D2', 'A1', 'B1', 'C1', 'D1'], reponse: 'B1', suites: [['C2', 'D2'], ['D2', 'C2']] },
  ab03: { famille: 'tue', theme: 'vie-mort', zone: ['D3', 'B2', 'D2', 'A1', 'B1', 'C1', 'D1'], reponse: 'B1', suites: [['D2', 'D3'], ['D3', 'D2']] },
  ab04: { famille: 'capture', theme: 'prise-en-retour', k: 2, reponse: 'E5', attendreTout: true },
  ab05: { famille: 'fin', theme: 'fin-de-partie', zone: ['D9', 'D8', 'A2', 'B2', 'C2', 'D2', 'A1', 'B1'], reponse: 'D2', ecart: 2, suites: [['D9', 'D8'], ['D8', 'D9']] },
  ab06: { famille: 'tue', theme: 'vie-mort', zone: ['A3', 'D3', 'A2', 'B2', 'D2', 'A1', 'D1'], reponse: 'A2', suites: [['B2', 'A3'], ['A3', 'B2']] },
  ab07: { famille: 'seki', theme: 'seki', zone: ['B2', 'C2', 'D2', 'A1', 'B1', 'C1', 'D1', 'E1'], reponse: 'C2' },
  ab08: { famille: 'ko-vit', theme: 'ko', zone: ['B2', 'C2', 'D2', 'A1', 'B1', 'C1', 'D1', 'E1'], reponse: 'B1', suites: [['D1', 'D2']] },
  ab09: { famille: 'capture', theme: 'capture', k: 2, reponse: 'E3', attendre: ['E2'] },
  ab10: { famille: 'vit', theme: 'vie-mort', zone: ['A2', 'B2', 'A1', 'B1', 'C1', 'D1'], reponse: 'B1', suites: [['A2', 'D1'], ['D1', 'A2']] },
  ab11: { famille: 'tue', theme: 'vie-mort', zone: ['C3', 'D3', 'A2', 'D2', 'A1', 'B1', 'D1'], reponse: 'A1', suites: [['D2', 'D3'], ['D3', 'D2']] },
  ab12: { famille: 'vit', theme: 'vie-mort', zone: ['F3', 'B2', 'C2', 'D2', 'B1', 'C1', 'D1', 'E1'], reponse: 'D1', suites: [['B2', 'C2'], ['C2', 'B2']] },
  ab13: { famille: 'seki', theme: 'seki', zone: ['B2', 'C2', 'D2', 'A1', 'B1', 'C1', 'D1', 'E1'], reponse: 'E1' },
  ab14: { famille: 'ko-tue', theme: 'ko', zone: ['B2', 'C2', 'D2', 'A1', 'B1', 'C1', 'D1', 'E1'], reponse: 'C2', suites: [['B1', 'C1'], ['D2', 'B1']] },
  ab15: { famille: 'capture', theme: 'relier-couper', k: 3, reponse: 'C2', sauf: { D2: ['B2', 'C2'] } },
  ab16: { famille: 'tue', theme: 'vie-mort', zone: ['E3', 'F3', 'C2', 'F2', 'B1', 'C1', 'D1', 'F1'], reponse: 'C1', suites: [['D1', 'B1'], ['B1', 'D1']] },
  ab17: { famille: 'vit', theme: 'vie-mort', zone: ['E3', 'F3', 'C2', 'B1', 'C1', 'D1', 'E1', 'F1'], reponse: 'C1', suites: [['E1', 'F1'], ['F1', 'E1']] },
  ab18: { famille: 'ko-vit', theme: 'ko', zone: ['B2', 'C2', 'D2', 'B1', 'C1', 'D1', 'E1'], reponse: 'C2' },
  ab19: { famille: 'tue', theme: 'vie-mort', zone: ['B3', 'C3', 'B2', 'E2', 'B1', 'D1', 'E1', 'F1'], reponse: 'E1', suites: [['B2', 'B3'], ['B3', 'B2']] },
  ab20: { famille: 'tue', theme: 'vie-mort', zone: ['B3', 'F3', 'D2', 'F2', 'C1', 'D1', 'E1', 'F1'], reponse: 'D1', suites: [['F2', 'F1'], ['F1', 'F2']] },
  ab21: { famille: 'tue', theme: 'vie-mort', zone: ['A2', 'C2', 'D2', 'E2', 'A1', 'B1', 'C1', 'D1', 'E1'], reponse: 'C1', suites: [['D2', 'D1'], ['E2', 'E1']] },
};

/** Énoncé attendu (début de la consigne) pour chaque famille. */
const ENONCE: Record<Famille, RegExp> = {
  vit: /^Noir joue et vit\./,
  tue: /^Noir joue et tue\./,
  'ko-vit': /^Noir joue : vivre sans ko est impossible ici\. Obtiens au moins un ko/,
  'ko-tue': /^Noir joue : tuer sans ko est impossible ici\. Obtiens au moins un ko/,
  seki: /^Sauve ton groupe marqué par un seki \(vie commune\) : il ne peut plus faire deux yeux\.$/,
  capture: /^Capture les pierres marquées en (deux|trois) coups au plus\./,
  fin: /Joue le coup qui rapporte le plus\.$/,
};

const L_ET_M: readonly Famille[] = ['vit', 'tue', 'ko-vit', 'ko-tue', 'seki'];
const famille = (p: Puzzle) => SPEC[p.id].famille;

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

/** Vie et mort, ko, seki : position, groupe marqué (la cible) et zone. */
function lm(p: Puzzle) {
  const { pos, marked } = startOf(p);
  return { pos, cible: marked[0], zone: SPEC[p.id].zone!.map(at) };
}

/** Le but est-il atteint dans la position `r` (Noir vient de jouer) ? */
function atteintDans(p: Puzzle, r: Position): boolean {
  const { cible, zone } = lm(p);
  switch (famille(p)) {
    case 'vit': return evaluer(r, cible, zone) === 1;
    case 'tue': return evaluer(r, cible, zone) === -1;
    case 'ko-vit': return evaluerMaitre(r, cible, zone, 1) === 1;
    case 'ko-tue': return evaluerMaitre(r, cible, zone, 1) === -1;
    case 'seki': return survit(r, cible, zone, { maitre: 2 });
    default: throw new Error(p.id);
  }
}

/** Le but est-il atteint après le coup noir `m` ? Un coup qui crée un ko ne prouve rien en vie et mort. */
function atteint(p: Puzzle, m: number): boolean {
  const { pos, cible, zone } = lm(p);
  const r = play(pos, m);
  if (typeof r === 'string') return false;
  const f = famille(p);
  if (f === 'vit' || f === 'tue') return issueApres(pos, m, cible, zone) === (f === 'vit' ? 1 : -1);
  return atteintDans(p, r);
}

/**
 * Échec prouvé dans la position `r` (Noir a joué, au besoin Blanc aussi), sans jamais s'appuyer sur une coupure :
 * Noir n'obtient pas son but, même s'il gagne tous les ko (ou même si l'adversaire les gagne tous, quand le but
 * était une vie ou une prise sans ko).
 */
function echec(p: Puzzle, r: Position): boolean {
  const { cible, zone } = lm(p);
  switch (famille(p)) {
    case 'vit': return pasDeVie(r, cible, zone, { maitre: 2 });
    case 'tue': return survit(r, cible, zone, { maitre: 2 });
    case 'ko-vit': return evaluerMaitre(r, cible, zone, 1) === -1;
    case 'ko-tue': return evaluerMaitre(r, cible, zone, 1) === 1 || survit(r, cible, zone, { maitre: 1 });
    case 'seki': return evaluerMaitre(r, cible, zone, 1) === -1;
    default: throw new Error(p.id);
  }
}

/** Fin de partie : valeur exacte (surfaces) de chaque coup légal de Noir, comme les lots Y, Z et AA. */
function valeurs(p: Puzzle) {
  const { pos } = startOf(p);
  const zone = SPEC[p.id].zone!.map(at);
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

/** Capture : le coup noir `m` prend-il une pierre marquée en `k` coups au plus, avec et sans ko (même résultat) ? */
function prend(p: Puzzle, m: number): boolean {
  const { pos, marked } = startOf(p), k = SPEC[p.id].k!;
  const r = captureEn(pos, m, marked, k, AVEC_KO);
  expect(captureEn(pos, m, marked, k, SANS_KO), `${p.id} ${lab(m)} sans ko`).toBe(r);
  return r;
}

/** Réplique citée après l'erreur `m`. */
const repliqueDe = (id: string, m: string) =>
  Object.entries(SPEC[id].sauf ?? {}).find(([, erreurs]) => erreurs.includes(m))?.[0] ?? SPEC[id].reponse;

// ---------------------------------------------------------------------------------------------------------------

describe('lot AB : identifiants, énoncés, thèmes, doublons, calendrier, migration (issue #557)', () => {
  it('ab01 à ab21, en 9 × 9, Noir au trait, de 1250 à 1700, du plus facile au plus dur', () => {
    expect(LOT_AB.map(r => r.id)).toEqual(LOT_AB.map((_, i) => `ab${String(i + 1).padStart(2, '0')}`));
    expect(LOT_AB.length).toBeGreaterThanOrEqual(20);
    expect(LOT_AB.length).toBeLessThanOrEqual(25);
    expect(all).toHaveLength(LOT_AB.length);
    expect(Object.keys(SPEC).sort()).toEqual(all.map(p => p.id));
    let prev = 0;
    for (const p of all) {
      const s = SPEC[p.id];
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.difficulty, p.id).toBeGreaterThanOrEqual(1250);
      expect(p.difficulty, p.id).toBeLessThanOrEqual(1700);
      expect(p.difficulty % 50, p.id).toBe(0);
      expect(p.difficulty, p.id).toBeGreaterThanOrEqual(prev);
      prev = p.difficulty;
      expect(p.prompt, p.id).toMatch(ENONCE[s.famille]);
      if (s.famille === 'capture') expect(p.prompt, p.id).toContain(s.k === 3 ? 'trois coups' : 'deux coups');
      expect(p.explanation, p.id).toMatch(/^Bravo ! /);
      if (s.attendreTout) expect(p.refutation, p.id).toMatch(/^Pas tout à fait\. Blanc n’a même pas besoin de répondre/);
      else {
        expect(p.refutation, p.id).toMatch(/^Pas tout à fait\. Blanc joue [A-J]\d\b/);
        expect(p.refutation, p.id).toContain(`Blanc joue ${s.reponse}`);
      }
      for (const [r, erreurs] of Object.entries(s.sauf ?? {})) expect(p.refutation, p.id).toContain(`ou ${r} si tu as joué ${erreurs.join(' ou ')}`);
      for (const e of s.attendre ?? []) expect(p.refutation, p.id).toContain(`Si tu as joué ${e}, il n’a même pas besoin de répondre.`);
      // Chaque suite citée l'est dans l'explication.
      for (const [w, n] of s.suites ?? []) expect(p.explanation, p.id).toMatch(new RegExp(`${w}[^.]*${n}`));
    }
    // Les sept familles, dont les deux buts de vie et mort et de ko, sont toutes présentes.
    expect(new Set(Object.values(SPEC).map(s => s.famille)).size).toBe(7);
  });

  it('chaque problème a son thème, et le lot apporte des thèmes de club (tesuji, ko, seki, prise en retour, fin de partie)', () => {
    for (const p of all) expect(THEME_DU_PROBLEME[p.id], p.id).toBe(SPEC[p.id].theme);
    const n = (t: string) => all.filter(p => SPEC[p.id].theme === t).length;
    expect(n('ko')).toBeGreaterThanOrEqual(3);
    expect(n('seki')).toBeGreaterThanOrEqual(2);
    expect(n('prise-en-retour')).toBeGreaterThanOrEqual(1);
    expect(n('capture') + n('relier-couper')).toBeGreaterThanOrEqual(2);
    expect(n('fin-de-partie')).toBeGreaterThanOrEqual(2);
    // La vie et mort reste au plus la moitié du lot : la place va aux tesuji, au ko, au seki et à la fin de partie.
    expect(n('vie-mort')).toBeLessThanOrEqual(Math.ceil(LOT_AB.length / 2));
  });

  it('le Go du jour garde son ordre : les jours déjà publiés ne changent pas, et le lot AB, d’un seul tenant, ferme le calendrier', () => {
    const ids = LOT_AB.map(r => r.id);
    expect(CALENDRIER_GO_DU_JOUR.slice(-ids.length)).toEqual(ids);
    expect(CALENDRIER_GO_DU_JOUR.indexOf('ab01')).toBe(CALENDRIER_GO_DU_JOUR.indexOf('aa20') + 1);
    expect(CALENDRIER_GO_DU_JOUR.indexOf('b1')).toBe(0);
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées)', () => {
    const others = ALL_PUZZLES.filter(r => !/^ab\d\d$/.test(r.id));
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_AB) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('aucun problème ne reprend un exercice de leçon (symétries et échange des couleurs compris)', () => {
    const exercices = LESSONS_FR.flatMap(l => positionsDeLecon(l)).filter(r => r.length === 9);
    for (const row of LOT_AB) for (const e of exercices) expect(memePosition(rowsOf(row.setup), e), row.id).toBe(false);
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, `../../supabase/migrations/${MIGRATION}.sql`), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('ab\d\d', null, 9,/g)).toHaveLength(LOT_AB.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_AB) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });

  it('chaque problème a son anglais', () => {
    for (const p of all) expect(PROBLEMES_EN[p.id], p.id).toBeTruthy();
  });
});

describe('lot AB : départ légal, zone fermée', () => {
  for (const p of all) {
    it(`${p.id} : pas de ko, chaque chaîne a deux libertés au moins, zone fermée, réponses légales`, () => {
      const { pos, marked } = startOf(p);
      const f = famille(p);
      expect(pos.ko).toBe(-1);
      for (let q = 0; q < N * N; q++) if (pos.board[q]) expect(groupAt(pos.board, N, q).liberties.size, `${p.id} ${lab(q)}`).toBeGreaterThanOrEqual(2);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
      if (L_ET_M.includes(f)) {
        const { cible, zone } = lm(p);
        expect(marked, p.id).toHaveLength(1);
        expect(pos.board[cible]).toBe(f === 'tue' || f === 'ko-tue' ? 2 : 1);
        expect(defautsDeZone(pos, cible, zone)).toEqual([]);
        // Aucun point vide de la zone ne touche un point vide hors de la zone ; les pierres de la zone sont celles de
        // l'attaquant, enfermées (toutes leurs libertés dans la zone).
        for (const z of zone) {
          for (const r of nb[z]) if (!pos.board[r]) expect(zone, `${lab(z)}-${lab(r)}`).toContain(r);
          if (pos.board[z]) {
            expect(pos.board[z], lab(z)).toBe(3 - pos.board[cible]);
            for (const l of groupAt(pos.board, N, z).liberties) expect(zone, `${lab(z)} liberté ${lab(l)}`).toContain(l);
          }
        }
      } else if (f === 'capture') {
        expect(marked.length).toBeGreaterThan(0);
        const chaine = groupAt(pos.board, N, marked[0]);
        expect(labels(chaine.stones)).toEqual(labels(marked));
        for (const t of marked) expect(pos.board[t]).toBe(2);
        expect(chaine.liberties.size).toBe(2);
        // Pas de prise plus rapide : en moins de coups, rien n'est pris.
        for (const m of legalMoves(pos)) if (m >= 0) expect(captureEn(pos, m, marked, SPEC[p.id].k! - 1), `${p.id} ${lab(m)}`).toBe(false);
      } else {
        const zone = SPEC[p.id].zone!.map(at);
        expect(labels(ouverts(pos))).toEqual([...SPEC[p.id].zone!].sort());
        const proprio = score(pos, 0, 'chinese').owner;
        for (let q = 0; q < N * N; q++) if (!pos.board[q] && !zone.includes(q)) expect(proprio[q], lab(q)).not.toBe(0);
      }
    });
  }
});

describe('lot AB : les coups gagnants sont exactement les réponses acceptées', () => {
  for (const p of all) {
    const f = famille(p), { pos } = startOf(p);
    if (L_ET_M.includes(f)) preuveParCoup(p.id, pos, p.answers, m => atteint(p, m));
    else if (f === 'capture') preuveParCoup(p.id, pos, p.answers, m => prend(p, m));
    else {
      preuveParCoup(p.id, pos, p.answers, m => { const { v, best } = valeursDe(p); return v.get(m) === best; });
      it(`${p.id} : tout autre coup, et la passe, perd au moins ${SPEC[p.id].ecart} points (surfaces)`, () => {
        const { v, best } = valeursDe(p);
        for (const [m, x] of v) if (!p.answers.includes(m)) expect(best - x, lab(m)).toBeGreaterThanOrEqual(SPEC[p.id].ecart!);
      }, 120_000);
    }
  }
});

describe('lot AB : la réponse atteint vraiment le but annoncé', () => {
  for (const p of all.filter(q => L_ET_M.includes(famille(q)))) {
    const f = famille(p);
    it(`${p.id} : ${f}`, () => {
      const { pos, cible, zone } = lm(p);
      for (const a of p.answers) {
        const r = ok(play(pos, a));
        if (f === 'ko-vit' || f === 'ko-tue') {
          // Un vrai ko : chaque camp obtient ce qu'il veut s'il gagne tous les ko, et rien ne se tranche sans ko.
          expect(issueApres(pos, a, cible, zone), lab(a)).toBe(0);
          expect(evaluerMaitre(r, cible, zone, 1), lab(a)).toBe(f === 'ko-vit' ? 1 : -1);
          expect(evaluerMaitre(r, cible, zone, 2), lab(a)).toBe(f === 'ko-vit' ? -1 : 1);
          // Sans ko, Noir n'avait aucun coup qui tranche : le ko est bien nécessaire.
          for (const m of zone.filter(z => !pos.board[z])) expect(issueApres(pos, m, cible, zone), lab(m)).not.toBe(f === 'ko-vit' ? 1 : -1);
        }
        if (f === 'seki') {
          // Ni vie ni prise : le groupe ne fait pas deux yeux, même si Noir gagne tous les ko ; sans le coup, Blanc tue.
          expect(pasDeVie(r, cible, zone, { maitre: 1 }), lab(a)).toBe(true);
          expect(issueApres(pos, a, cible, zone), lab(a)).toBe(0);
          expect(evaluerMaitre({ ...pos, toPlay: 2 }, cible, zone, 2)).toBe(-1);
        }
      }
    }, 120_000);
  }
});

describe('lot AB : la passe n’atteint pas le but, et chaque erreur est punie par la réplique citée', () => {
  for (const p of all) {
    const f = famille(p), { pos, marked } = startOf(p), spec = SPEC[p.id];
    const erreurs = legalMoves(pos).filter(m => m >= 0 && !p.answers.includes(m));
    it(`${p.id} : les répliques d’exception visent de vraies erreurs`, () => {
      for (const l of [...Object.values(spec.sauf ?? {}).flat(), ...(spec.attendre ?? [])]) expect(erreurs.map(lab), l).toContain(l);
    });
    if (L_ET_M.includes(f)) {
      for (const m of [...erreurs, -1]) {
        const l = lab(m), r = m < 0 ? spec.reponse : repliqueDe(p.id, l);
        it(`${p.id} : ${l} échoue (prouvé), puis ${r} le confirme`, () => {
          const apres = ok(play(pos, m));
          expect(echec(p, apres), l).toBe(true);
          expect(echec(p, ok(play(apres, at(r)))), `${l} puis ${r}`).toBe(true);
        }, 120_000);
      }
    } else if (f === 'capture') {
      for (const m of [...erreurs, -1]) {
        const l = lab(m), attend = spec.attendreTout || spec.attendre?.includes(l);
        it(`${p.id} : ${l} ne prend rien, et ${attend ? 'Blanc peut attendre' : `${repliqueDe(p.id, l)} l’en empêche`}`, () => {
          expect(captureEn(pos, m, marked, spec.k!, AVEC_KO)).toBe(false);
          const r = ok(play(ok(play(pos, m)), attend ? -1 : at(repliqueDe(p.id, l))));
          for (const o of [AVEC_KO, SANS_KO]) expect(attackerCaptures(r, marked, spec.k! - 1, o), `${l} ${o.ko}`).toBe(false);
        }, 120_000);
      }
    } else {
      it(`${p.id} : après chaque erreur, Blanc joue la réplique citée et Noir finit plus bas d’au moins ${spec.ecart} points`, () => {
        const { zone, proprio, best } = valeursDe(p);
        for (const m of [...erreurs, -1]) {
          const r = ok(play(pos, m >= 0 && !zone.includes(m) && proprio[m] === 2 ? -1 : m));
          const w = ok(play(r, at(repliqueDe(p.id, lab(m)))));
          expect(valeurExacte(w, zone, { ...surfaces, profondeur: 16 }), lab(m)).toBeLessThanOrEqual(best - spec.ecart!);
        }
      }, 120_000);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------

describe('lot AB : ce que disent les textes', () => {
  const start = (id: string) => startOf(pz(id)).pos;

  it('chaque suite citée (« si Blanc joue X, tu réponds Y ») garde le but', () => {
    for (const p of all) {
      const s = SPEC[p.id];
      for (const [w, n] of s.suites ?? []) {
        const r = suite(startOf(p).pos, [lab(p.answers[0]), w, n]);
        if (s.famille === 'fin') {
          const { zone, best } = valeursDe(p);
          expect(valeurExacte(r, zone, { ...surfaces, profondeur: 15 }), `${p.id} ${w} ${n}`).toBe(best);
        } else {
          expect(atteintDans(p, r), `${p.id} ${w} ${n}`).toBe(true);
        }
      }
    }
  }, 300_000);

  it('ab01 : Blanc vient de glisser en D1 ; C1 bloque au contact ; C2 laisse Blanc avancer en C1 ; le haut vaut moins', () => {
    const pos = start('ab01'), { v, best } = valeursDe(pz('ab01'));
    expect(pos.board[at('D1')]).toBe(2);
    expect(pos.board[at('D2')]).toBe(0);
    expect(libs(suite(pos, ['C1']), 'D1').length).toBeGreaterThanOrEqual(2);
    expect(v.get(at('C2'))).toBe(best - 2);
    // Après C2, Blanc avance en C1 : la valeur reste celle de l'erreur.
    expect(valeurExacte(suite(pos, ['C2', 'C1']), SPEC.ab01.zone!.map(at), { ...surfaces, profondeur: 16 })).toBe(best - 2);
    expect(v.get(at('D9'))!).toBeLessThan(v.get(at('C2'))!);
    expect(v.get(at('E9'))!).toBeLessThan(v.get(at('C2'))!);
  });

  it('ab02 : B1 fait de A1 un œil ; sept points en L', () => {
    const pos = start('ab02');
    expect(SPEC.ab02.zone).toHaveLength(7);
    expect(SPEC.ab10.zone).toHaveLength(6);
    expect(yeuxDuGroupe(suite(pos, ['B1']), at('D3')).filter(y => y.vrai).map(y => lab(y.point))).toContain('A1');
  });

  it('ab03, ab06, ab19, ab20 : le point vital touche les points annoncés', () => {
    const touche = (id: string, l: string) => labels(nb[at(l)].filter(r => SPEC[id].zone!.includes(lab(r))));
    expect(touche('ab03', 'B1')).toEqual(['A1', 'B2', 'C1']);
    expect(touche('ab06', 'A2')).toEqual(['A1', 'A3', 'B2']);
    expect(touche('ab19', 'E1')).toEqual(['D1', 'E2', 'F1']);
    expect(touche('ab20', 'D1')).toEqual(['C1', 'D2', 'E1']);
  });

  it('ab04 : D5 se met en atari ; si Blanc prend en E5, il ne lui reste que D5, et Noir prend 9 pierres ; E5 pareil', () => {
    const pos = start('ab04');
    for (const [a, b] of [['D5', 'E5'], ['E5', 'D5']]) {
      const r1 = suite(pos, [a]);
      expect(libs(r1, a)).toEqual([b]);
      const r2 = suite(r1, [b]);
      expect(r2.board[at(a)]).toBe(0);
      expect(libs(r2, 'C6')).toEqual([a]);
      expect(suite(r2, [a]).captures[1]).toBe(9);
    }
  });

  it('ab05 : Blanc a joué D1 en hane sous C1 ; D2 la met en atari ; B2 et C2 rapportent moins', () => {
    const pos = start('ab05'), { v, best } = valeursDe(pz('ab05'));
    expect(pos.board[at('D1')]).toBe(2);
    expect(pos.board[at('C1')]).toBe(1);
    expect(libs(suite(pos, ['D2']), 'D1')).toHaveLength(1);
    expect(v.get(at('B2'))!).toBeLessThan(best);
    expect(v.get(at('C2'))!).toBeLessThan(best);
  });

  it('ab07, ab13 : les pierres blanches enfermées ne sont pas prises par la réponse, et le seki est compté', () => {
    for (const [id, pierre] of [['ab07', 'B2'], ['ab13', 'C2']]) {
      const r = suite(start(id), [lab(pz(id).answers[0])]);
      expect(r.board[at(pierre)]).toBe(2);
      expect(r.captures[1]).toBe(0);
    }
  });

  it('ab09 : E3 garde une liberté (E2) et laisse une seule liberté à l’anneau (D3) ; après D3 blanc, E2 prend tout ; D3 d’abord : Blanc prend en E3 et respire', () => {
    const pos = start('ab09'), e3 = suite(pos, ['E3']);
    expect(libs(e3, 'E3')).toEqual(['D3', 'E2']);
    expect(libs(e3, 'C4')).toEqual(['D3']);
    const d3 = suite(e3, ['D3']);
    expect(libs(d3, 'C4')).toEqual(['E2']);
    expect(suite(d3, ['E2']).captures[1]).toBe(8);
    const err = suite(pos, ['D3', 'E3']);
    expect(err.board[at('D3')]).toBe(0);
    expect(libs(err, 'C4').length).toBeGreaterThanOrEqual(2);
  });

  it('ab15 : Blanc veut relier C3-D3 à C1 et D1 ; après E1, D2 puis E2 et C2 puis B2 prennent en deux coups', () => {
    const pos = start('ab15');
    expect(libs(pos, 'C1')).toContain('D2');
    const e1 = suite(pos, ['E1']), marked = startOf(pz('ab15')).marked;
    for (const [w, n] of [['D2', 'E2'], ['C2', 'B2']]) expect(captureEn(suite(e1, [w]), at(n), marked, 2, AVEC_KO), `${w} ${n}`).toBe(true);
  });

  it('ab12, ab17 : la réponse fait un vrai œil au point annoncé', () => {
    for (const [id, oeil] of [['ab12', 'E1'], ['ab17', 'C2']]) {
      const p = pz(id), r = suite(start(id), [lab(p.answers[0])]);
      expect(yeuxDuGroupe(r, startOf(p).marked[0]).filter(y => y.vrai).map(y => lab(y.point)), id).toContain(oeil);
    }
  });

  it('ab14 : ta pierre B2 est déjà dans l’espace blanc ; ab21 : neuf points avec B2 dedans', () => {
    expect(start('ab14').board[at('B2')]).toBe(1);
    expect(SPEC.ab21.zone).toHaveLength(9);
    expect(start('ab21').board[at('B2')]).toBe(2);
  });
});
