// Issue #16, lot W : preuve de chaque problème d'entraînement des leçons 14 à 16 (seki, finir la partie, compter).
//
// Seki (w01 à w03) : outil src/go/preuve-vie-mort.ts, recherche complète dans une zone fermée (vérifiée par
// defautsDeZone), cible : le groupe blanc sans œil. Un coup noir hors de la zone y vaut une passe : la passe est essayée.
// - la réponse donne un seki : personne ne gagne, quel que soit le camp au trait ;
// - c'est un seki pur, sans ko : chaque point vide, rempli par Noir, fait vivre Blanc ; rempli par Blanc, le fait
//   mourir ; score() le voit (les libertés partagées ne sont à personne) ;
// - tout autre coup, et la passe, laisse Blanc vivre ; la réplique citée par la réfutation suffit.
//
// Fin de partie et comptage (w04 à w09) : score() en règle japonaise (territoire + prisonniers, pierres mortes
// comprises, komi à Blanc ; les points d'un seki ne comptent pas). Recherche complète de la fin : les deux camps jouent
// sur les points de frontière annoncés (ZONE), seulement s'ils sont encore ouverts (frontieresOuvertes) et collés à une
// de leurs pierres ou à une pierre adverse entrée dans la zone ; ou ils passent. Deux passes : on compte. Un coup hors
// de la zone tombe dans un territoire déjà fermé par la réponse : chez Noir, la pierre vit et coûte un point ; chez
// Blanc, elle est morte et devient prisonnière. La réponse est le seul meilleur coup ; les chiffres des textes viennent
// de score().
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_W from '../content/lots/w-seki-fin-compte';
import { LESSONS_FR } from '../content/lessons';
import { ALL_PUZZLES, CALENDRIER_GO_DU_JOUR } from '../content/puzzles';
import { memePosition, positionsDeLecon } from '../content/redites';
import { THEME_DU_PROBLEME, THEMES_DE_LECON, serieDeLecon } from '../content/themes';
import { PROBLEMES_EN } from '../content/problemes.en';
import { parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { legalMoves } from './lecteurs-lot-d';
import { cederLaMain, preuveParCoup } from './preuve-par-coup';
import { defautsDeZone, evaluer, issueApres } from './preuve-vie-mort';
import { frontieresOuvertes } from './frontieres';
import { score } from './score';
import { groupAt, neighbors, play, type Position } from './rules';
import { KOMI_NORMAL } from '../app/equilibrage';

beforeEach(cederLaMain);

const N = 9;
const all = parsePuzzles(LOT_W);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, N);
const label = (m: number) => (m < 0 ? 'passe' : toLabel(m, N));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;
const nb = neighbors(N);
/** Nombre écrit à la française : « 33,5 ». */
const fr = (n: number) => String(n).replace('.', ',');

type Genre = 'seki' | 'fin' | 'compte';
const GENRE: Record<string, Genre> = {
  w01: 'seki', w02: 'seki', w03: 'seki',
  w04: 'fin', w05: 'fin', w06: 'fin',
  w07: 'compte', w08: 'compte', w09: 'compte',
};
const THEME: Record<Genre, string> = { seki: 'seki', fin: 'fin-de-partie', compte: 'comptage' };
const LECON: Record<Genre, string> = { seki: 'l14', fin: 'l15', compte: 'l16' };

/** Seki : cible (le groupe blanc sans œil) et zone fermée (ses libertés et les pierres noires du dedans). */
const SEKI: Record<string, { cible: string; zone: string[] }> = {
  w01: { cible: 'C9', zone: ['D9', 'E9', 'F9', 'G9', 'H9'] },
  w02: { cible: 'A3', zone: ['A1', 'B1', 'C1', 'A2', 'B2', 'C2'] },
  w03: { cible: 'A3', zone: ['A1', 'B1', 'C1', 'A2', 'B2', 'C2'] },
};

/** Fin de partie et comptage : points de frontière, pierres mortes (avec leur zone fermée), komi. */
const FIN: Record<string, { zone: string[]; mortes?: Record<string, string[]>; komi: number }> = {
  w04: { zone: ['E5', 'E4', 'E3', 'D3', 'F3'], komi: 0 },
  w05: { zone: ['E7', 'E3', 'D3', 'C3'], komi: 0 },
  w06: { zone: ['F5', 'F4', 'F6', 'A8'], mortes: { A9: ['A8'] }, komi: 0 },
  w07: { zone: ['E5'], komi: KOMI_NORMAL },
  w08: { zone: ['E6', 'F6', 'J8'], mortes: { J9: ['J8'] }, komi: KOMI_NORMAL },
  w09: { zone: ['G7', 'F7', 'B2', 'C1'], komi: KOMI_NORMAL },
};

// ---------------------------------------------------------------------------------------------------------------
// Fin de partie : recherche complète sur les points de frontière.

/** Pierres mortes encore sur le plateau. */
const mortesSur = (p: Position, mortes: number[]) => mortes.filter(m => p.board[m] !== 0);

/** Coups de frontière du camp au trait (voir l'en-tête), puis la passe. */
function coupsDeFin(p: Position, zone: number[], mortes: number[]): number[] {
  const ouverts = new Set(frontieresOuvertes(p.board, N, mortesSur(p, mortes)));
  const adv = 3 - p.toPlay;
  return [...zone.filter(z => ouverts.has(z) && nb[z].some(q => p.board[q] === p.toPlay || (p.board[q] === adv && zone.includes(q)))), -1];
}

/** Valeur Noir − Blanc (komi compris) après une suite parfaite des deux camps ; `passes` : passes déjà jouées. */
function valeurFin(pos: Position, zone: number[], mortes: number[], komi: number, passes = 0, memo = new Map<string, number>()): number {
  const rec = (p: Position, k: number): number => {
    if (k >= 2) { const s = score(p, komi, 'japanese', new Set(mortesSur(p, mortes))); return s.black - s.white; }
    const cle = `${p.toPlay}${k}${p.ko}${p.captures[1]},${p.captures[2]}:${p.board.join('')}`;
    const connu = memo.get(cle);
    if (connu !== undefined) return connu;
    const max = p.toPlay === 1;
    let best = max ? -Infinity : Infinity;
    for (const m of coupsDeFin(p, zone, mortes)) {
      const r = play(p, m);
      if (typeof r === 'string') continue;
      const v = rec(r, m === -1 ? k + 1 : 0);
      best = max ? Math.max(best, v) : Math.min(best, v);
    }
    memo.set(cle, best);
    return best;
  };
  return rec(pos, passes);
}

/** Données d'un problème de fin : position, zone, mortes, propriétaire de chaque point une fois la réponse jouée. */
function fin(p: Puzzle) {
  const spec = FIN[p.id];
  const { pos } = startOf(p);
  const zone = spec.zone.map(at), mortes = Object.keys(spec.mortes ?? {}).map(at);
  const apres = ok(play(pos, p.answers[0]));
  const proprio = score(apres, spec.komi, 'japanese', new Set(mortes)).owner;
  return { pos, zone, mortes, komi: spec.komi, proprio };
}

/** Valeur du premier coup noir `m` (point du plateau ou -1), suivi d'une fin parfaite. */
function valeurCoup(p: Puzzle, m: number, memo = new Map<string, number>()): number {
  const { pos, zone, mortes, komi, proprio } = fin(p);
  const r = ok(play(pos, m));
  // Hors de la zone, la pierre tombe dans un territoire fermé : chez Blanc, elle est morte.
  const morts = m >= 0 && !zone.includes(m) && proprio[m] === 2 ? [...mortes, m] : mortes;
  return valeurFin(r, zone, morts, komi, m === -1 ? 1 : 0, memo);
}

/** Position finale après la réponse et une fin parfaite (les deux camps passent quand c'est leur meilleur choix). */
function finale(p: Puzzle, ...debut: string[]): Position {
  const { pos, zone, mortes, komi } = fin(p);
  let q = debut.reduce((x, l) => ok(play(x, l === 'passe' ? -1 : at(l))), pos);
  let passes = debut.at(-1) === 'passe' ? 1 : 0;
  const memo = new Map<string, number>();
  while (passes < 2) {
    let choix = -1, val = q.toPlay === 1 ? -Infinity : Infinity;
    for (const m of coupsDeFin(q, zone, mortes)) {
      const r = play(q, m);
      if (typeof r === 'string') continue;
      const v = m === -1 && passes === 1
        ? (() => { const s = score(r, komi, 'japanese', new Set(mortesSur(r, mortes))); return s.black - s.white; })()
        : valeurFin(r, zone, mortes, komi, m === -1 ? passes + 1 : 0, memo);
      // À valeur égale, on préfère passer : la position finale est la plus simple.
      if (q.toPlay === 1 ? v > val || (v === val && m === -1) : v < val || (v === val && m === -1)) { val = v; choix = m; }
    }
    q = ok(play(q, choix));
    passes = choix === -1 ? passes + 1 : 0;
  }
  return q;
}

const compte = (p: Puzzle, q: Position) => score(q, FIN[p.id].komi, 'japanese', new Set(mortesSur(q, fin(p).mortes)));

// ---------------------------------------------------------------------------------------------------------------

describe('lot W : identifiants, énoncés, thèmes, séries, doublons, calendrier, migration (issue #16)', () => {
  it('w01 à w09, en 9 × 9, Noir au trait, trois par leçon, ouverts à un débutant, du plus facile au plus dur', () => {
    expect(all).toHaveLength(9);
    expect(LOT_W.map(r => r.id)).toEqual(LOT_W.map((_, i) => `w${String(i + 1).padStart(2, '0')}`));
    expect(Object.keys(GENRE).sort()).toEqual(all.map(p => p.id));
    expect([...Object.keys(SEKI), ...Object.keys(FIN)].sort()).toEqual(all.map(p => p.id));
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toMatch(/^Pas tout à fait\. /);
      expect(p.explanation, p.id).toMatch(/^Bravo ! /);
      expect(p.difficulty, p.id).toBeGreaterThanOrEqual(400);
      expect(p.difficulty, p.id).toBeLessThan(850);
      // Multiples de 50 : un nouveau problème ne passe jamais devant un ancien de même difficulté (placement).
      expect(p.difficulty % 50, p.id).toBe(0);
    }
    for (const g of ['seki', 'fin', 'compte'] as const) {
      const d = all.filter(p => GENRE[p.id] === g).map(p => p.difficulty);
      expect(d, g).toHaveLength(3);
      expect([...d].sort((a, b) => a - b), g).toEqual(d);
    }
  });

  it('chaque problème a le thème de sa leçon ; la série de fin des leçons 14, 15 et 16 est ce lot, dans l’ordre', () => {
    for (const p of all) expect(THEME_DU_PROBLEME[p.id], p.id).toBe(THEME[GENRE[p.id]]);
    for (const g of ['seki', 'fin', 'compte'] as const) {
      expect(THEMES_DE_LECON[LECON[g]]).toEqual([THEME[g]]);
      const attendu = all.filter(p => GENRE[p.id] === g).map(p => p.id);
      expect(serieDeLecon(LECON[g], ALL_PUZZLES, new Set()).map(p => p.id), g).toEqual(attendu);
    }
  });

  it('le Go du jour garde son ordre : le lot W, d’un seul tenant, vient juste après le lot V et ferme le calendrier', () => {
    const ids = LOT_W.map(r => r.id);
    expect(CALENDRIER_GO_DU_JOUR.slice(-ids.length)).toEqual(ids);
    expect(CALENDRIER_GO_DU_JOUR.indexOf('w01')).toBe(CALENDRIER_GO_DU_JOUR.indexOf('v16') + 1);
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées)', () => {
    const others = ALL_PUZZLES.filter(r => !/^w\d\d$/.test(r.id));
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_W) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('aucun problème ne reprend un exercice de leçon (symétries et échange des couleurs compris)', () => {
    const exercices = LESSONS_FR.flatMap(l => positionsDeLecon(l)).filter(r => r.length === 9);
    expect(exercices.length).toBeGreaterThan(10);
    for (const row of LOT_W) for (const e of exercices) expect(memePosition(rowsOf(row.setup), e), row.id).toBe(false);
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261002120100_lot_w.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('w\d\d', null, 9,/g)).toHaveLength(LOT_W.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_W) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });

  it('textes : la réfutation dit « Blanc joue » la réponse (l’aide la joue), sauf la dame ; mots du go expliqués', () => {
    for (const p of all) {
      if (p.id === 'w07') expect(p.refutation).not.toMatch(/Blanc joue/);
      else expect(p.refutation, p.id).toContain(`Blanc joue ${label(p.answers[0])}`);
      expect(p.refutation, p.id).not.toMatch(/prend ta pierre en/);
    }
    for (const p of all.filter(x => GENRE[x.id] === 'seki')) expect(p.prompt).toBe('Sauve tes pierres marquées par un seki (vie commune).');
    expect(pz('w04').explanation).toContain('point neutre (dame)');
    expect(pz('w05').prompt).toContain('dame (point neutre)');
    expect(pz('w07').prompt).toContain('point neutre (dame)');
  });

  it('chaque problème a son anglais', () => {
    for (const p of all) expect(PROBLEMES_EN[p.id], p.id).toBeTruthy();
  });
});

describe('lot W : départ légal', () => {
  for (const p of all) {
    it(`${p.id} : pas de ko, aucune chaîne en atari hors des pierres mortes et du sujet, réponse légale`, () => {
      const { pos } = startOf(p);
      expect(pos.ko).toBe(-1);
      const mortes = new Set(Object.keys(FIN[p.id]?.mortes ?? {}).map(at));
      // w02 : A1 n'a qu'une liberté, B1 ; c'est le sujet (Blanc la prend en B1). w03 : C2 aussi (en B2).
      const sujet = new Set(p.id === 'w02' ? [at('A1')] : p.id === 'w03' ? [at('C2')] : []);
      for (let q = 0; q < 81; q++) {
        if (!pos.board[q] || mortes.has(q) || sujet.has(q)) continue;
        expect(groupAt(pos.board, N, q).liberties.size, `${p.id} ${label(q)}`).toBeGreaterThanOrEqual(2);
      }
      for (const a of p.answers) expect(legalMoves(pos), `${p.id} ${label(a)}`).toContain(a);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Seki

describe('lot W, seki : la réponse fait seki, tout autre coup laisse Blanc vivre', () => {
  for (const p of all.filter(x => GENRE[x.id] === 'seki')) {
    const { pos, marked } = startOf(p);
    const cible = at(SEKI[p.id].cible), zone = SEKI[p.id].zone.map(at);
    const coups = [...zone.filter(z => pos.board[z] === 0), -1];

    it(`${p.id} : zone fermée ; cible blanche sans œil ; les pierres marquées sont noires, dans la zone`, () => {
      expect(defautsDeZone(pos, cible, zone)).toEqual([]);
      expect(pos.board[cible]).toBe(2);
      expect(marked.length).toBeGreaterThan(0);
      for (const m of marked) { expect(pos.board[m]).toBe(1); expect(zone).toContain(m); }
      // Les libertés de la cible sont toutes dans la zone (vérifié par defautsDeZone) et la cible n'a aucun œil.
      expect([...groupAt(pos.board, N, cible).liberties].every(l => nb[l].some(q => pos.board[q] !== 2))).toBe(true);
    });

    it(`${p.id} : seul ${label(p.answers[0])} donne un seki (0) ; tout autre coup et la passe laissent Blanc vivre (+1)`, () => {
      const issues = coups.map(m => [label(m), issueApres(pos, m, cible, zone)] as const);
      expect(issues.filter(([, v]) => v !== 1).map(([m]) => m)).toEqual(p.answers.map(label));
      expect(issueApres(pos, p.answers[0], cible, zone)).toBe(0);
    }, 120_000);

    it(`${p.id} : après ${label(p.answers[0])}, seki pur : qui remplit une liberté partagée meurt ; score() le voit`, () => {
      const f = ok(play(pos, p.answers[0]));
      const vides = zone.filter(z => f.board[z] === 0);
      expect(vides).toHaveLength(2);
      for (const c of [1, 2] as const) expect(evaluer({ ...f, toPlay: c }, cible, zone), `trait ${c}`).toBe(0);
      for (const z of vides) {
        // Chaque point vide touche la cible et chaque pierre noire du dedans : une liberté partagée.
        for (const m of zone.filter(q => f.board[q] === 1)) expect([...groupAt(f.board, N, m).liberties].sort()).toEqual([...vides].sort());
        expect([...groupAt(f.board, N, cible).liberties].sort()).toEqual([...vides].sort());
        expect(issueApres({ ...f, toPlay: 1 }, z, cible, zone), `Noir ${label(z)}`).toBe(1);
        expect(issueApres({ ...f, toPlay: 2 }, z, cible, zone), `Blanc ${label(z)}`).toBe(-1);
      }
      const s = score(f, 0, 'japanese');
      for (const z of vides) expect(s.owner[z]).toBe(0);
      expect(s.seki).toContain(cible);
      for (const m of marked) expect(s.seki).toContain(m);
      expect(p.explanation).toContain(vides.map(label).sort().join(' et '));
    }, 120_000);

    it(`${p.id} : après chaque erreur, Blanc joue ${label(p.answers[0])} et vit (la réfutation dit vrai)`, () => {
      for (const m of coups.filter(x => !p.answers.includes(x))) {
        const r = ok(play(pos, m));
        expect(issueApres(r, p.answers[0], cible, zone), label(m)).toBe(1);
        const w = ok(play(r, p.answers[0]));
        if (p.id === 'w02') expect(w.board[at('A1')], label(m)).toBe(0);
        if (p.id === 'w03') expect(w.board[at('C2')], label(m)).toBe(0);
      }
      if (p.id === 'w02') expect(p.refutation).toContain('il prend A1');
      if (p.id === 'w03') expect(p.refutation).toContain('il prend C2');
    }, 120_000);
  }

  it('w01 : F9 relie E9 et G9 ; D9 ou H9 laisse une chaîne que F9 blanc capture aussitôt', () => {
    const { pos } = startOf(pz('w01'));
    expect(groupAt(ok(play(pos, at('F9'))).board, N, at('E9')).stones.map(label).sort()).toEqual(['E9', 'F9', 'G9']);
    for (const [faux, prise] of [['D9', 'E9'], ['H9', 'G9']]) {
      const w = ok(play(ok(play(pos, at(faux))), at('F9')));
      expect(w.board[at(prise)], faux).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Fin de partie et comptage

describe('lot W, fin de partie et comptage : la réponse est le seul meilleur coup', () => {
  for (const p of all.filter(x => GENRE[x.id] !== 'seki')) {
    const { pos, zone, mortes, proprio } = fin(p);
    const memo = new Map<string, number>();
    const meilleure = valeurCoup(p, p.answers[0], memo);

    it(`${p.id} : pierres mortes prouvées mortes, quel que soit le camp au trait ; chaque coup hors zone est dans un territoire fermé`, () => {
      for (const [m, z] of Object.entries(FIN[p.id].mortes ?? {})) {
        for (const c of [1, 2] as const) {
          const q = { ...pos, toPlay: c };
          expect(defautsDeZone(q, at(m), z.map(at))).toEqual([]);
          expect(evaluer(q, at(m), z.map(at)), `${m}, trait ${c}`).toBe(-1);
        }
        expect(startOf(p).marked).toContain(at(m));
      }
      for (const m of legalMoves(pos)) if (m >= 0 && !zone.includes(m)) expect(proprio[m], label(m)).not.toBe(0);
      for (const a of p.answers) expect(zone).toContain(a);
    });

    // w07 : la dame ne vaut rien, passer vaut donc autant que la remplir (vérifié plus bas). Le lecteur de problèmes n'a
    // pas de bouton « passer » et l'énoncé demande de remplir la dame : la preuve porte sur les coups du plateau.
    const coups = p.id === 'w07' ? legalMoves(pos).filter(m => m !== -1) : legalMoves(pos);
    preuveParCoup(p.id, pos, p.answers, m => valeurCoup(p, m, memo) === meilleure, { coups });
    if (p.id === 'w07') it('w07 : passer vaut autant que remplir la dame : elle ne rapporte rien', () => {
      expect(valeurCoup(p, -1, memo)).toBe(meilleure);
    });

    it(`${p.id} : après chaque erreur, Blanc joue ${label(p.answers[0])} et Noir finit plus bas`, () => {
      for (const m of legalMoves(pos).filter(x => !p.answers.includes(x))) {
        const r = ok(play(pos, m));
        const morts = m >= 0 && !zone.includes(m) && proprio[m] === 2 ? [...mortes, m] : mortes;
        const w = play(r, p.answers[0]);
        if (p.id === 'w07') continue; // la dame : la réfutation ne cite pas de réplique
        expect(typeof w, label(m)).not.toBe('string');
        const v = valeurFin(ok(w), zone, morts, FIN[p.id].komi);
        if (GENRE[p.id] === 'fin') expect(v, label(m)).toBeLessThanOrEqual(meilleure - 1);
        else expect(v, label(m)).toBeLessThan(0);
      }
    }, 120_000);
  }
});

describe('lot W : les chiffres et les suites des textes', () => {
  it('w04 : après E5, plus aucun point ouvert ; E4 ferme aussi mais laisse la dame E5, un point de moins', () => {
    const p = pz('w04'), { pos } = startOf(p);
    expect(frontieresOuvertes(ok(play(pos, at('E5'))).board, N)).toEqual([]);
    const e4 = ok(play(pos, at('E4')));
    expect(frontieresOuvertes(e4.board, N).map(label)).toEqual(['E5']);
    expect(valeurCoup(p, at('E4'))).toBe(valeurCoup(p, at('E5')) - 1);
    // Si Noir passe, Blanc entre en E5 et la frontière se ferme en E4 : un point de moins.
    const f = finale(p, 'passe', 'E5');
    expect(f.board[at('E4')]).toBe(1);
    const s = compte(p, f), s0 = compte(p, finale(p, 'E5'));
    expect(s.black - s.white).toBe(s0.black - s0.white - 1);
  });

  it('w05 : après E3, seule la dame E7 reste ouverte ; elle ne change rien ; D3 ou la dame d’abord coûtent un point', () => {
    const p = pz('w05'), { pos } = startOf(p);
    const e3 = ok(play(pos, at('E3')));
    expect(frontieresOuvertes(e3.board, N).map(label)).toEqual(['E7']);
    const avant = score(e3, 0, 'japanese');
    for (const c of [1, 2] as const) {
      const d = score(ok(play({ ...e3, toPlay: c }, at('E7'))), 0, 'japanese');
      expect([d.black, d.white], `couleur ${c}`).toEqual([avant.black, avant.white]);
    }
    for (const l of ['D3', 'E7']) expect(valeurCoup(p, at(l)), l).toBe(valeurCoup(p, at('E3')) - 1);
    expect(groupAt(e3.board, N, at('E3')).stones).toContain(at('E2'));
  });

  it('w06 : F4 ferme au contact ; prendre A9 (en A8) coûte deux points ; A9 retirée compte comme prisonnière', () => {
    const p = pz('w06'), { pos } = startOf(p);
    const f4 = ok(play(pos, at('F4')));
    expect(frontieresOuvertes(f4.board, N, [at('A9')])).toEqual([]);
    expect(groupAt(f4.board, N, at('F4')).liberties.size).toBeGreaterThanOrEqual(2);
    expect(valeurCoup(p, at('A8'))).toBe(valeurCoup(p, at('F4')) - 2);
    expect(valeurCoup(p, at('F5'))).toBe(valeurCoup(p, at('F4')) - 1);
    const s = score(f4, 0, 'japanese', new Set([at('A9')]));
    expect(s.owner[at('A9')]).toBe(1);
    expect(s.black).toBe(s.territory[1] + 1);
  });

  it('w07 : E5 est le seul point neutre, il touche Noir et Blanc ; le remplir ne change pas le compte (31 chacun)', () => {
    const p = pz('w07'), { pos } = startOf(p);
    expect(frontieresOuvertes(pos.board, N).map(label)).toEqual(['E5']);
    expect(new Set(nb[at('E5')].map(q => pos.board[q]))).toEqual(new Set([1, 2]));
    const avant = score(pos, KOMI_NORMAL, 'japanese');
    expect([avant.territory[1], avant.territory[2]]).toEqual([31, 31]);
    for (const c of [1, 2] as const) {
      const d = score(ok(play({ ...pos, toPlay: c }, at('E5'))), KOMI_NORMAL, 'japanese');
      expect([d.black, d.white], `couleur ${c}`).toEqual([avant.black, avant.white]);
    }
    expect(p.explanation).toContain(`${avant.territory[1]} points de territoire chacun`);
  });

  it('w08 : après E6, 33 de territoire (J9 comprise) + 1 prisonnier = 34 ; Blanc 27 + 6,5 = 33,5 ; F6 : 33', () => {
    const p = pz('w08');
    const s = compte(p, finale(p, 'E6'));
    expect([s.territory[1], s.black, s.territory[2], s.white]).toEqual([33, 34, 27, 33.5]);
    expect(s.owner[at('J9')]).toBe(1);
    expect(s.winner).toBe(1);
    expect(s.margin).toBe(0.5);
    const t = `${s.territory[1]} points de territoire (J9 comprise, une fois retirée) + 1 prisonnier = ${s.black}. Blanc a ${s.territory[2]} + ${fr(KOMI_NORMAL)} = ${fr(s.white)}.`;
    expect(p.explanation).toContain(t);
    const f6 = compte(p, finale(p, 'F6'));
    expect([f6.black, f6.white, f6.winner]).toEqual([33, 33.5, 2]);
    expect(p.explanation).toContain(`En F6, tu n'en avais que ${f6.black}`);
    // Réfutation : après n'importe quelle erreur puis E6 blanc, Noir a 33 points au plus ; Blanc garde 33,5.
    const { pos } = startOf(p);
    for (const m of legalMoves(pos).filter(x => x !== at('E6'))) {
      const debut = [label(m), 'E6'];
      if (m >= 0 && !FIN.w08.zone.includes(label(m))) continue; // hors zone : prouvé par la recherche ci-dessus
      const r = compte(p, finale(p, ...debut));
      expect(r.black, label(m)).toBeLessThanOrEqual(33);
      expect(r.white, label(m)).toBe(33.5);
    }
    expect(p.refutation).toContain('33 points au plus. Blanc a 27 + 6,5 = 33,5');
  });

  it('w09 : après G7, Noir 25, Blanc 18 + 6,5 = 24,5 ; B2 et C1 (le seki) ne sont à personne ; F7 : 24', () => {
    const p = pz('w09');
    const g7 = finale(p, 'G7');
    const s = compte(p, g7);
    expect([s.black, s.territory[2], s.white, s.winner, s.margin]).toEqual([25, 18, 24.5, 1, 0.5]);
    for (const l of ['B2', 'C1']) expect(s.owner[at(l)], l).toBe(0);
    for (const l of ['A1', 'C2', 'A3', 'D1']) expect(s.seki, l).toContain(at(l));
    expect(p.explanation).toContain(`tu as ${s.black} points. B2 et C1, dans le seki, ne sont à personne. Blanc a ${s.territory[2]} + ${fr(KOMI_NORMAL)} = ${fr(s.white)}.`);
    const f7 = compte(p, finale(p, 'F7'));
    expect([f7.black, f7.winner]).toEqual([24, 2]);
    expect(p.explanation).toContain(`En F7, tu n'en avais que ${f7.black}`);
    // Le seki du coin est pur : remplir B2 ou C1 met Noir en atari, Blanc prend ses pierres.
    const { pos } = startOf(p), zone = ['A1', 'B1', 'C1', 'A2', 'B2', 'C2'].map(at);
    expect(defautsDeZone(pos, at('A3'), zone)).toEqual([]);
    for (const l of ['B2', 'C1']) {
      const r = ok(play(pos, at(l)));
      expect(groupAt(r.board, N, at(l)).liberties.size, l).toBe(1);
      expect(issueApres(pos, at(l), at('A3'), zone), l).toBe(1);
      expect(issueApres({ ...pos, toPlay: 2 }, at(l), at('A3'), zone), `Blanc ${l}`).toBe(-1);
    }
  });
});
