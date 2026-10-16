// Issue #548, lot AA : preuve de chaque problème « entre deux » (difficulté 850 à 1250, de 15 à 5 kyu environ).
//
// Sept familles, chacune avec son outil exact. Chaque coup légal de Noir est jugé (dans la zone, ailleurs, et la
// passe) : les réponses acceptées sont exactement les coups qui atteignent le but. Chaque erreur est prouvée par un
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
// - prise en retour (« Capture les pierres marquées en deux coups au plus. ») : lecteur exact du lot N
//   (src/go/lecteurs-lot-n.ts), tous les coups légaux et la passe, avec et sans ko : même résultat ;
// - fin de partie : minimax exact de src/go/preuve-fin-de-partie.ts (bornes basse et haute égales), compté par
//   surfaces ; les chiffres des textes sont recomptés en règle japonaise (score()).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_AA from '../content/lots/aa-entre-deux';
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
const MIGRATION = '20261014160000_lot_aa';
const all = parsePuzzles(LOT_AA);
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

type Famille = 'vit' | 'tue' | 'ko-vit' | 'ko-tue' | 'seki' | 'capture' | 'fin';
/**
 * Pour chaque problème : la famille, le thème, la zone (fin de partie : les endroits ouverts, plus les points d'un ko),
 * la réplique citée par la réfutation (`sauf` : réplique propre à certaines erreurs ; `attendre` : erreurs après
 * lesquelles Blanc n'a même pas besoin de répondre), le nombre de coups (capture), l'écart minimal de toute erreur
 * (fin de partie, surfaces) et les pierres en atari au départ (le sujet du problème).
 */
const SPEC: Record<string, { famille: Famille; theme: string; zone?: string[]; reponse: string; sauf?: Record<string, string[]>;
  attendre?: string[]; k?: number; ecart?: number; atari?: string[] }> = {
  aa01: { famille: 'fin', theme: 'ko', zone: ['E9', 'E3', 'F3'], reponse: 'E3', ecart: 2, atari: ['F3'] },
  aa02: { famille: 'capture', theme: 'prise-en-retour', k: 2, reponse: 'C1', attendre: ['A1'] },
  aa03: { famille: 'fin', theme: 'fin-de-partie', zone: ['E9', 'D8', 'C1', 'D1', 'E1', 'F1', 'G1'], reponse: 'D1', sauf: { E1: ['C1', 'D1'] }, ecart: 2 },
  aa04: { famille: 'seki', theme: 'seki', zone: ['H9', 'H8', 'H7', 'J9', 'J8', 'J7'], reponse: 'J7' },
  aa05: { famille: 'vit', theme: 'vie-mort', zone: ['J9', 'J8', 'J7', 'J6', 'J5', 'J4'], reponse: 'J5' },
  aa06: { famille: 'vit', theme: 'vie-mort', zone: ['J2', 'H2', 'G2', 'J1', 'H1', 'G1', 'F1'], reponse: 'H1', sauf: { G1: ['H2'], H2: ['G1'] } },
  aa07: { famille: 'capture', theme: 'prise-en-retour', k: 2, reponse: 'H3' },
  aa08: { famille: 'vit', theme: 'vie-mort', zone: ['B8', 'C8', 'A9', 'B9', 'C9', 'D9'], reponse: 'C9' },
  aa09: { famille: 'seki', theme: 'seki', zone: ['B1', 'B2', 'B3', 'B4', 'A1', 'A2', 'A3', 'A4'], reponse: 'B3' },
  aa10: { famille: 'tue', theme: 'vie-mort', zone: ['B2', 'B3', 'A1', 'A2', 'A3', 'A4'], reponse: 'A3' },
  aa11: { famille: 'tue', theme: 'vie-mort', zone: ['A2', 'B2', 'C2', 'A1', 'B1', 'C1', 'D1'], reponse: 'B2' },
  aa12: { famille: 'ko-vit', theme: 'ko', zone: ['A2', 'B2', 'C2', 'A1', 'B1', 'C1', 'D1'], reponse: 'B2' },
  aa13: { famille: 'tue', theme: 'vie-mort', zone: ['J8', 'H8', 'G8', 'J9', 'H9', 'G9', 'F9'], reponse: 'H9' },
  aa14: { famille: 'seki', theme: 'seki', zone: ['J2', 'H2', 'G2', 'F2', 'J1', 'H1', 'G1', 'F1'], reponse: 'J2' },
  aa15: { famille: 'vit', theme: 'vie-mort', zone: ['J8', 'H8', 'G8', 'F8', 'J9', 'H9', 'G9', 'F9'], reponse: 'G8' },
  aa16: { famille: 'vit', theme: 'vie-mort', zone: ['C2', 'D2', 'E2', 'B1', 'C1', 'D1', 'E1', 'F1'], reponse: 'D2' },
  aa17: { famille: 'ko-tue', theme: 'ko', zone: ['H9', 'H8', 'H7', 'J9', 'J8', 'J7', 'J6'], reponse: 'J7' },
  aa18: { famille: 'tue', theme: 'vie-mort', zone: ['A9', 'B9', 'C9', 'D9', 'E9', 'F9'], reponse: 'B9' },
  aa19: { famille: 'tue', theme: 'vie-mort', zone: ['C8', 'D8', 'E8', 'C9', 'D9', 'E9', 'F9'], reponse: 'D9' },
  aa20: { famille: 'ko-tue', theme: 'ko', zone: ['J3', 'H3', 'J2', 'H2', 'J1', 'H1'], reponse: 'J2' },
};

/** Énoncé attendu (début de la consigne) pour chaque famille. */
const ENONCE: Record<Famille, RegExp> = {
  vit: /^Noir joue et vit\./,
  tue: /^Noir joue et tue\./,
  'ko-vit': /^Noir joue : vivre sans ko est impossible ici\. Obtiens au moins un ko/,
  'ko-tue': /^Noir joue : tuer sans ko est impossible ici\. Obtiens au moins un ko/,
  seki: /^Sauve ton groupe marqué par un seki \(vie commune\) : il ne peut plus faire deux yeux\.$/,
  capture: /^Capture les pierres marquées en deux coups au plus\.$/,
  fin: /./,
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

/**
 * Le but est-il atteint après le coup noir `m` ? (Vie et mort, ko, seki.) La cible est noire pour vivre et pour le seki,
 * blanche pour tuer.
 */
function atteint(p: Puzzle, m: number): boolean {
  const { pos, cible, zone } = lm(p);
  const r = play(pos, m);
  if (typeof r === 'string') return false;
  switch (famille(p)) {
    case 'vit': return issueApres(pos, m, cible, zone) === 1;
    case 'tue': return issueApres(pos, m, cible, zone) === -1;
    // Noir vit s'il gagne tous les ko ; Noir tue s'il gagne tous les ko.
    case 'ko-vit': return evaluerMaitre(r, cible, zone, 1) === 1;
    case 'ko-tue': return evaluerMaitre(r, cible, zone, 1) === -1;
    // Le groupe noir ne peut plus être pris, même si Blanc gagne tous les ko.
    case 'seki': return survit(r, cible, zone, { maitre: 2 });
    default: throw new Error(p.id);
  }
}

/**
 * Échec prouvé dans la position `r` (Noir a joué, au besoin Blanc aussi), sans jamais s'appuyer sur une coupure :
 * le camp de Noir n'obtient pas son but, même s'il gagne tous les ko (ou même si l'adversaire les gagne tous, quand le but
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

/** Fin de partie : valeur exacte (surfaces) de chaque coup légal de Noir, comme les lots Y et Z. */
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

describe('lot AA : identifiants, énoncés, thèmes, doublons, calendrier, migration (issue #548)', () => {
  it('aa01 à aa20, en 9 × 9, Noir au trait, de 850 à 1250, du plus facile au plus dur', () => {
    expect(LOT_AA.map(r => r.id)).toEqual(LOT_AA.map((_, i) => `aa${String(i + 1).padStart(2, '0')}`));
    expect(LOT_AA.length).toBeGreaterThanOrEqual(20);
    expect(LOT_AA.length).toBeLessThanOrEqual(25);
    expect(all).toHaveLength(LOT_AA.length);
    expect(Object.keys(SPEC).sort()).toEqual(all.map(p => p.id));
    let prev = 0;
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.difficulty, p.id).toBeGreaterThanOrEqual(850);
      expect(p.difficulty, p.id).toBeLessThanOrEqual(1250);
      expect(p.difficulty % 50, p.id).toBe(0);
      expect(p.difficulty, p.id).toBeGreaterThanOrEqual(prev);
      prev = p.difficulty;
      expect(p.prompt, p.id).toMatch(ENONCE[famille(p)]);
      expect(p.explanation, p.id).toMatch(/^Bravo ! /);
      expect(p.refutation, p.id).toMatch(/^Pas tout à fait\. Blanc joue [A-J]\d\b/);
      expect(p.refutation, p.id).toContain(`Blanc joue ${SPEC[p.id].reponse}`);
      for (const [r, erreurs] of Object.entries(SPEC[p.id].sauf ?? {})) expect(p.refutation, p.id).toContain(`ou ${r} si tu as joué ${erreurs.join(' ou ')}`);
      for (const e of SPEC[p.id].attendre ?? []) expect(p.refutation, p.id).toContain(`Si tu as joué ${e}, il n’a même pas besoin de répondre.`);
    }
    // Les familles, et les deux buts de vie et mort et de ko, sont tous présents.
    expect(new Set(Object.values(SPEC).map(s => s.famille)).size).toBe(7);
  });

  it('chaque problème a son thème, et le lot comble les thèmes rares (ko, seki, prise en retour, fin de partie)', () => {
    for (const p of all) expect(THEME_DU_PROBLEME[p.id], p.id).toBe(SPEC[p.id].theme);
    const n = (t: string) => all.filter(p => SPEC[p.id].theme === t).length;
    expect(n('ko')).toBeGreaterThanOrEqual(4);
    expect(n('seki')).toBeGreaterThanOrEqual(3);
    expect(n('prise-en-retour')).toBeGreaterThanOrEqual(2);
    expect(n('fin-de-partie')).toBeGreaterThanOrEqual(1);
  });

  it('le Go du jour garde son ordre : les jours déjà publiés ne changent pas, le lot AA vient d’un seul tenant après le lot Z, puis le lot AB (#557)', () => {
    const ids = LOT_AA.map(r => r.id), debut = CALENDRIER_GO_DU_JOUR.indexOf('aa01');
    expect(CALENDRIER_GO_DU_JOUR.slice(debut, debut + ids.length)).toEqual(ids);
    expect(CALENDRIER_GO_DU_JOUR[debut + ids.length]).toBe('ab01');
    // Le tri des fichiers range « aa- » après « z- », et non entre « a- » et « b- » (src/content/puzzles.ts) : tout ce qui
    // précède le lot AA garde sa place, et le lot Z reste juste avant lui.
    expect(CALENDRIER_GO_DU_JOUR.indexOf('aa01')).toBe(CALENDRIER_GO_DU_JOUR.indexOf('z15') + 1);
    expect(CALENDRIER_GO_DU_JOUR.indexOf('b1')).toBe(0);
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées)', () => {
    const others = ALL_PUZZLES.filter(r => !/^aa\d\d$/.test(r.id));
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_AA) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('aucun problème ne reprend un exercice de leçon (symétries et échange des couleurs compris)', () => {
    const exercices = LESSONS_FR.flatMap(l => positionsDeLecon(l)).filter(r => r.length === 9);
    for (const row of LOT_AA) for (const e of exercices) expect(memePosition(rowsOf(row.setup), e), row.id).toBe(false);
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, `../../supabase/migrations/${MIGRATION}.sql`), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('aa\d\d', null, 9,/g)).toHaveLength(LOT_AA.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_AA) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });

  it('chaque problème a son anglais', () => {
    for (const p of all) expect(PROBLEMES_EN[p.id], p.id).toBeTruthy();
  });
});

describe('lot AA : départ légal, zone fermée', () => {
  for (const p of all) {
    it(`${p.id} : pas de ko, chaque chaîne a deux libertés au moins (sauf le sujet), zone fermée, réponses légales`, () => {
      const { pos, marked } = startOf(p);
      const f = famille(p), sujet = new Set((SPEC[p.id].atari ?? []).flatMap(l => groupAt(pos.board, N, at(l)).stones));
      expect(pos.ko).toBe(-1);
      for (let q = 0; q < N * N; q++) {
        if (!pos.board[q]) continue;
        const n = groupAt(pos.board, N, q).liberties.size;
        if (sujet.has(q)) expect(n, `${p.id} ${lab(q)}`).toBe(1);
        else expect(n, `${p.id} ${lab(q)}`).toBeGreaterThanOrEqual(2);
      }
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
      if (L_ET_M.includes(f)) {
        const { cible, zone } = lm(p);
        expect(marked, p.id).toHaveLength(1);
        expect(pos.board[cible]).toBe(f === 'tue' || f === 'ko-tue' ? 2 : 1);
        expect(defautsDeZone(pos, cible, zone)).toEqual([]);
        // Aucun point vide de la zone ne touche un point vide hors de la zone.
        for (const z of zone) for (const r of nb[z]) if (!pos.board[r]) expect(zone, `${lab(z)}-${lab(r)}`).toContain(r);
      } else if (f === 'capture') {
        expect(marked.length).toBeGreaterThan(0);
        const chaine = groupAt(pos.board, N, marked[0]);
        expect(labels(chaine.stones)).toEqual(labels(marked));
        for (const t of marked) expect(pos.board[t]).toBe(2);
        expect(chaine.liberties.size).toBe(2);
        // Pas de prise plus rapide : en un seul coup, rien n'est pris.
        for (const m of legalMoves(pos)) if (m >= 0) expect(captureEn(pos, m, marked, SPEC[p.id].k! - 1), `${p.id} ${lab(m)}`).toBe(false);
      } else {
        const zone = SPEC[p.id].zone!.map(at), ouv = ouverts(pos);
        for (const o of ouv) expect(zone, lab(o)).toContain(o);
        const proprio = score(pos, 0, 'chinese').owner;
        for (let q = 0; q < N * N; q++) if (!pos.board[q] && !zone.includes(q)) expect(proprio[q], lab(q)).not.toBe(0);
      }
    });
  }
});

describe('lot AA : les coups gagnants sont exactement les réponses acceptées', () => {
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

describe('lot AA : la réponse atteint vraiment le but annoncé', () => {
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
        }
        if (f === 'seki') {
          // Ni vie ni prise : le groupe ne fait pas deux yeux, même si Noir gagne tous les ko.
          expect(pasDeVie(r, cible, zone, { maitre: 1 }), lab(a)).toBe(true);
          expect(issueApres(pos, a, cible, zone), lab(a)).toBe(0);
        }
      }
    }, 120_000);
  }
});

describe('lot AA : la passe n’atteint pas le but, et chaque erreur est punie par la réplique citée', () => {
  for (const p of all) {
    const f = famille(p), { pos, marked } = startOf(p), spec = SPEC[p.id];
    const erreurs = legalMoves(pos).filter(m => m >= 0 && !p.answers.includes(m));
    it(`${p.id} : les répliques d’exception visent de vraies erreurs`, () => {
      for (const l of [...Object.values(spec.sauf ?? {}).flat(), ...(spec.attendre ?? [])]) expect(erreurs.map(lab), l).toContain(l);
    });
    if (L_ET_M.includes(f)) {
      for (const m of [...erreurs, -1]) {
        const l = lab(m), r = m < 0 ? 'passe' : repliqueDe(p.id, l);
        it(`${p.id} : ${l} échoue (prouvé), puis ${m < 0 ? spec.reponse : r} le confirme`, () => {
          const apres = ok(play(pos, m));
          expect(echec(p, apres), l).toBe(true);
          expect(echec(p, ok(play(apres, at(m < 0 ? spec.reponse : r)))), `${l} puis ${r}`).toBe(true);
        }, 120_000);
      }
    } else if (f === 'capture') {
      for (const m of [...erreurs, -1]) {
        const l = lab(m), attend = spec.attendre?.includes(l);
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

describe('lot AA : ce que disent les textes', () => {
  const start = (id: string) => startOf(pz(id)).pos;
  const vit = (id: string, pos: Position) => { const { cible, zone } = lm(pz(id)); return evaluer(pos, cible, zone); };

  it('aa01 : E3 relie F3 ; après E9, Blanc prend en E3 (ko), relie en F3, et Noir perd 1 point ; E9 ne vaut rien', () => {
    const pos = start('aa01');
    expect(libs(pos, 'F3')).toEqual(['E3']);
    expect(libs(suite(pos, ['E3']), 'F3').length).toBeGreaterThanOrEqual(2);
    const ko = suite(pos, ['E9', 'E3']);
    expect(ko.board[at('F3')]).toBe(0);
    expect(ko.captures[2]).toBe(1);
    expect(lab(ko.ko)).toBe('F3');
    expect(play(ko, at('F3'))).toBe('ko');
    expect(japonais(suite(pos, ['E3', 'E9'])) - japonais(suite(pos, ['E9', 'E3', 'passe', 'F3']))).toBe(1);
    expect(japonais(suite(pos, ['E3', 'E9']))).toBe(japonais(suite(pos, ['E3', 'passe'])));
    expect(japonais(suite(pos, ['E3', 'passe', 'E9']))).toBe(japonais(suite(pos, ['E3', 'passe'])));
  });

  it('aa02 : C1 se met en atari ; si Blanc la prend en D1, il ne lui reste que C1, et Noir y prend 6 pierres ; sinon D1 prend ; D1 d’abord : Blanc prend en C1 et se relie à B1', () => {
    const pos = start('aa02');
    const c1 = suite(pos, ['C1']);
    expect(libs(c1, 'C1')).toEqual(['D1']);
    const d1 = suite(c1, ['D1']);
    expect(d1.board[at('C1')]).toBe(0);
    expect(libs(d1, 'D2')).toEqual(['C1']);
    expect(suite(d1, ['C1']).captures[1]).toBe(6);
    expect(suite(c1, ['passe', 'D1']).captures[1]).toBe(5);
    const err = suite(pos, ['D1', 'C1']);
    expect(err.board[at('D1')]).toBe(0);
    expect(groupAt(err.board, N, at('D2')).stones).toContain(at('B1'));
    expect(libs(err, 'D2').length).toBeGreaterThanOrEqual(2);
  });

  it('aa03 : E1 est un hane sous E2 ; Blanc bloque en F1, Noir relie en D1 ; bloquer en D1 vaut 1 point de moins ; E9 et D8 sont des dames', () => {
    const { pos, v } = valeursDe(pz('aa03'));
    // La suite annoncée est la meilleure des deux côtés.
    const e1 = suite(pos, ['E1']);
    const vb = valeursDesCoups(e1, SPEC.aa03.zone!.map(at), { ...surfaces, profondeur: 17 });
    expect(Math.min(...vb.values())).toBe(vb.get(at('F1')));
    expect(vb.get(at('F1'))).toBe(v.get(at('E1')));
    const f1 = suite(e1, ['F1']);
    const vn = valeursDesCoups(f1, SPEC.aa03.zone!.map(at), { ...surfaces, profondeur: 16 });
    expect(Math.max(...vn.values())).toBe(vn.get(at('D1')));
    // En japonais : la suite du hane rapporte 1 point de plus que bloquer en D1 (Blanc ferme alors en E1).
    expect(japonais(suite(pos, ['E1', 'F1', 'D1'])) - japonais(suite(pos, ['D1', 'E1']))).toBe(1);
    expect(ouverts(suite(pos, ['E1', 'F1', 'D1'])).map(lab).sort()).toEqual(['D8', 'E9']);
    expect(ouverts(suite(pos, ['D1', 'E1'])).map(lab).sort()).toEqual(['D8', 'E9']);
    // Les dames ne rapportent rien, à personne.
    const fin = suite(pos, ['E1', 'F1', 'D1']);
    for (const s of [['E9'], ['passe', 'E9'], ['D8'], ['passe', 'D8']]) expect(japonais(suite(fin, s)), s.join(' ')).toBe(japonais(fin));
  });

  it('aa04 : après J7, H9 et J8 sont les deux libertés partagées ; qui en remplit une se fait prendre ; seki', () => {
    const pos = start('aa04'), f = suite(pos, ['J7']);
    expect(libs(f, 'G9')).toEqual(['H9', 'J8']);
    expect(libs(f, 'H8')).toEqual(['H9', 'J8']);
    expect(libs(f, 'J9')).toEqual(['H9', 'J8']);
    for (const [moi, lui] of [['H9', 'J8'], ['J8', 'H9']]) {
      expect(suite(f, ['passe', moi, lui]).board[at('G9')], `Noir ${moi}`).toBe(0);
      expect(suite(f, [moi, lui]).board[at('H8')], `Blanc ${moi}`).toBe(0);
    }
    const s = score(f, 0, 'japanese');
    expect(s.seki).toContain(at('G9'));
    expect(s.seki).toContain(at('H8'));
    expect(evaluerMaitre(suite(pos, ['passe', 'J7']), at('G9'), SPEC.aa04.zone!.map(at), 1)).toBe(-1);
  });

  it('aa05 : après J5, J6 est un vrai œil et J8-J9 un espace fermé par Noir ; Blanc en J5 d’abord : pas deux yeux', () => {
    const pos = start('aa05'), j5 = suite(pos, ['J5']);
    expect(yeuxDuGroupe(j5, at('H9')).filter(y => y.vrai).map(y => lab(y.point))).toContain('J6');
    for (const l of ['J8', 'J9']) for (const r of nb[at(l)]) expect(j5.board[r] === 1 || ['J8', 'J9'].includes(lab(r)), lab(r)).toBe(true);
    expect(vit('aa05', j5)).toBe(1);
    expect(pasDeVie(suite(pos, ['passe', 'J5']), at('H9'), SPEC.aa05.zone!.map(at), { maitre: 2 })).toBe(true);
  });

  it('aa06 : sept points ; après H1, H2 et J2 sont miai ; en H2, Blanc répond G1 et il ne reste qu’un ko', () => {
    const { pos, cible, zone } = lm(pz('aa06'));
    expect(zone.filter(z => !pos.board[z])).toHaveLength(7);
    expect(vit('aa06', suite(pos, ['H1', 'H2', 'J2']))).toBe(1);
    expect(vit('aa06', suite(pos, ['H1', 'J2', 'H2']))).toBe(1);
    const h2 = suite(pos, ['H2', 'G1']);
    expect(evaluer(h2, cible, zone)).toBe(0);
    expect(evaluerMaitre(h2, cible, zone, 1)).toBe(1);
    expect(evaluerMaitre(h2, cible, zone, 2)).toBe(-1);
  });

  it('aa07 : H3 laisse une liberté, J3 ; si Blanc prend en J3, il ne reste que H3 et Noir prend 5 pierres ; J3 d’abord : Blanc relie en H3', () => {
    const pos = start('aa07'), h3 = suite(pos, ['H3']);
    expect(libs(h3, 'G4')).toEqual(['J3']);
    const j3 = suite(h3, ['J3']);
    expect(j3.board[at('H3')]).toBe(0);
    expect(libs(j3, 'G4')).toEqual(['H3']);
    expect(suite(j3, ['H3']).captures[1]).toBe(5);
    const err = suite(pos, ['J3', 'H3']);
    expect(groupAt(err.board, N, at('G4')).stones).toEqual(expect.arrayContaining([at('H2'), at('H1')]));
    expect(libs(err, 'G4').length).toBeGreaterThanOrEqual(2);
    // Après toute erreur, H3 blanc relie les pierres marquées à H2 et H1.
    for (const m of legalMoves(pos).filter(x => x >= 0 && x !== at('H3') && x !== at('H2'))) {
      const r = play(ok(play(pos, m)), at('H3'));
      if (typeof r !== 'string') expect(groupAt(r.board, N, at('G4')).stones, lab(m)).toEqual(expect.arrayContaining([at('H2'), at('H1')]));
    }
  });

  it('aa08 : C9 met C8 en atari ; B8 blanc puis B9 prend deux pierres ; B9 blanc puis B8 prend C8 ; après une erreur et C9, C8 a deux libertés au moins', () => {
    const pos = start('aa08'), c9 = suite(pos, ['C9']);
    expect(libs(c9, 'C8')).toEqual(['B8']);
    const a = suite(c9, ['B8', 'B9']);
    expect(a.captures[1]).toBe(2);
    expect(vit('aa08', a)).toBe(1);
    const b = suite(c9, ['B9', 'B8']);
    expect(b.captures[1]).toBe(1);
    expect(b.board[at('C8')]).toBe(0);
    expect(vit('aa08', b)).toBe(1);
    for (const m of [...legalMoves(pos).filter(x => x >= 0 && x !== at('C9')), -1]) {
      const r = play(ok(play(pos, m)), at('C9'));
      if (typeof r !== 'string') expect(groupAt(r.board, N, at('C8')).liberties.size, lab(m)).toBeGreaterThanOrEqual(2);
    }
  });

  it('aa09 : sans réponse, A4 met A2 et A3 en atari et Noir vit ; Blanc doit jouer A4 lui-même ; puis B2 et B4 sont partagées', () => {
    const { pos, cible, zone } = lm(pz('aa09')), b3 = suite(pos, ['B3']);
    const a4 = suite(b3, ['passe', 'A4']);
    expect(libs(a4, 'A2')).toEqual(['B2']);
    expect(evaluer(a4, cible, zone)).toBe(1);
    // Toute autre réponse blanche que A4 laisse Noir vivre.
    for (const w of [...zone.filter(z => !b3.board[z]), -1].filter(w => w !== at('A4'))) {
      const r = play(b3, w);
      if (typeof r === 'string') continue;
      const vivre = [...zone.filter(z => !r.board[z]), -1].some(n => issueApres(r, n, cible, zone) === 1);
      expect(vivre, `Blanc ${lab(w)}`).toBe(true);
    }
    const f = suite(b3, ['A4']);
    expect(libs(f, 'C1')).toEqual(['B2', 'B4']);
    expect(libs(f, 'A2')).toEqual(['B2', 'B4']);
    for (const [moi, lui] of [['B2', 'B4'], ['B4', 'B2']]) {
      expect(suite(f, [moi, lui]).board[at('C1')], `Noir ${moi}`).toBe(0);
      expect(suite(f, ['passe', moi, lui]).board[at('A2')], `Blanc ${moi}`).toBe(0);
    }
  });

  it('aa10, aa11, aa13, aa19 : le point vital, puis les deux réponses miai', () => {
    const cas: [string, string, string, string][] = [['aa10', 'A3', 'A2', 'A4'], ['aa11', 'B2', 'A2', 'B1'], ['aa13', 'H9', 'H8', 'G9'], ['aa19', 'D9', 'D8', 'E9']];
    for (const [id, v, x, y] of cas) {
      const pos = start(id);
      expect(vit(id, suite(pos, [v, x, y])), `${id} ${x}`).toBe(-1);
      expect(vit(id, suite(pos, [v, y, x])), `${id} ${y}`).toBe(-1);
    }
    // aa10 : A3 touche B3, A2 et A4 ; aa13 : H9 touche J9, G9 et H8.
    expect(labels(nb[at('A3')].filter(r => SPEC.aa10.zone!.includes(lab(r))))).toEqual(['A2', 'A4', 'B3']);
    expect(labels(nb[at('H9')].filter(r => SPEC.aa13.zone!.includes(lab(r))))).toEqual(['G9', 'H8', 'J9']);
    // aa11 : Blanc vient de jouer C1.
    expect(start('aa11').board[at('C1')]).toBe(2);
  });

  it('aa12 : B2 met A2 en atari, et c’est un ko', () => {
    expect(libs(suite(start('aa12'), ['B2']), 'A2')).toEqual(['A1']);
  });

  it('aa14 : J2 prend une liberté au carré ; après J2, J1, F1 et F2 sont toutes partagées ; personne ne prend l’autre ; Blanc en J2 d’abord a plus de libertés', () => {
    const { pos, zone } = lm(pz('aa14'));
    expect(libs(pos, 'G2')).toContain('J2');
    const f = suite(pos, ['J2']);
    expect(libs(f, 'J3')).toEqual(['F1', 'F2', 'J1']);
    expect(libs(f, 'G2')).toEqual(['F1', 'F2', 'J1']);
    expect(survit({ ...f, toPlay: 2 }, at('J3'), zone, { maitre: 2 })).toBe(true);
    expect(survit({ ...f, toPlay: 1 }, at('G2'), zone, { maitre: 1 })).toBe(true);
    for (const m of [...legalMoves(pos).filter(x => x >= 0 && x !== at('J2')), -1]) {
      const r = play(ok(play(pos, m)), at('J2'));
      if (typeof r === 'string') continue;
      expect(groupAt(r.board, N, at('G2')).liberties.size, lab(m)).toBeGreaterThan(groupAt(r.board, N, at('J3')).liberties.size);
    }
  });

  it('aa15 : G8 laisse à H8 deux libertés, J8 et H9 ; après une erreur, G8 blanc agrandit H8', () => {
    const pos = start('aa15');
    expect(libs(suite(pos, ['G8']), 'H8')).toEqual(['H9', 'J8']);
    for (const m of [...legalMoves(pos).filter(x => x >= 0 && x !== at('G8')), -1]) {
      const r = play(ok(play(pos, m)), at('G8'));
      if (typeof r !== 'string') expect(groupAt(r.board, N, at('H8')).stones, lab(m)).toContain(at('G8'));
    }
  });

  it('aa16 : après D2, B1 et C1 sont miai, E1 et F1 aussi', () => {
    const pos = start('aa16');
    for (const [x, y] of [['B1', 'C1'], ['C1', 'B1'], ['E1', 'F1'], ['F1', 'E1']]) expect(vit('aa16', suite(pos, ['D2', x, y])), x).toBe(1);
    expect(pos.board[at('C2')]).toBe(2);
  });

  it('aa18 : B9 se relie à C9 ; puis D9 et F9 sont miai ; après une erreur et B9 blanc, C9 est en atari', () => {
    const pos = start('aa18');
    expect(groupAt(suite(pos, ['B9']).board, N, at('C9')).stones).toContain(at('B9'));
    expect(vit('aa18', suite(pos, ['B9', 'D9', 'F9']))).toBe(-1);
    expect(vit('aa18', suite(pos, ['B9', 'F9', 'D9']))).toBe(-1);
    for (const m of [...legalMoves(pos).filter(x => x >= 0 && x !== at('B9')), -1]) {
      const r = play(ok(play(pos, m)), at('B9'));
      if (typeof r !== 'string') expect(groupAt(r.board, N, at('C9')).liberties.size, lab(m)).toBe(1);
    }
  });

  it('aa20 : après J2, si Blanc joue J1, Noir prend en H1 et c’est un ko', () => {
    const r = suite(start('aa20'), ['J2', 'J1', 'H1']);
    expect(r.captures[1]).toBe(1);
    expect(r.ko).not.toBe(-1);
  });
});
