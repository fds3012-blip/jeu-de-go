// Issue #733, lot AC (chantier C4) : preuve de chaque problème de comptage du joueur de club (ac01 à ac05).
//
// Chaque position est une fin de partie construite : Noir (au trait) est devant d’un demi-point (komi 6,5, règle japonaise,
// pierres mortes retirées, territoire + prisonniers), et un seul coup l’empêche de perdre ce demi-point.
//
// Ce que la preuve établit, pour chacun des cinq problèmes :
// 1. la position est légale : aucun ko, aucune chaîne en atari (sauf les pierres mortes marquées), un seul groupe vivant
//    par couleur ;
// 2. la fin de partie est sûre : chaque point vide hors de la frontière est à un seul camp (defautsZoneFin), et chaque
//    « salle » de territoire est prouvée sûre par la recherche complète de src/go/preuve-vie-mort.ts : une pierre jetée
//    dedans, par l’adversaire, est prise quoi qu’il joue ensuite ; chaque camp a au moins deux salles (son groupe vit) ;
// 3. le compte : à la fin de la ligne optimale qui suit la réponse, tous les chemins optimaux donnent le même compte
//    (score()), les chiffres des textes en viennent ; Noir gagne d’un demi-point ; sans ko et sans prise ni atari ;
// 4. la réponse est le seul coup qui fait gagner Noir : valeur 7 (Noir − Blanc, sans komi) contre 6,5 de komi, tous les
//    autres coups légaux et la passe valent 6 au plus, dans les trois modèles de ko (Noir maître, Blanc maître, ko simple) ;
// 5. chaque erreur est réfutée : après n’importe quel coup légal autre que la réponse, Blanc joue la réponse et gagne,
//    quoi que Noir joue ensuite, même maître du ko ; le texte dit vrai sur le point voisin ;
// 6. les dames citées par les textes sont des dames (le compte ne change si personne n’y joue) ; le point voisin est une
//    dame après la réponse et le territoire de Blanc si Blanc y joue le premier.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_AC from '../content/lots/ac-compter';
import { LESSONS_FR } from '../content/lessons';
import { ALL_PUZZLES, CALENDRIER_GO_DU_JOUR, estGoDuJour } from '../content/puzzles';
import { GO_DU_JOUR } from '../content/goDuJour.gen';
import { memePosition, positionsDeLecon } from '../content/redites';
import { THEME_DU_PROBLEME, THEMES_DE_LECON, serieDeLecon, serieDeTheme } from '../content/themes';
import { PROBLEMES_EN } from '../content/problemes.en';
import { parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { butFin } from '../../outils/refutationsLocales';
import { ETAT_INITIAL, choisirProbleme } from '../app/coteJoueur';
import { KOMI_NORMAL } from '../app/equilibrage';
import { fromLabel, toLabel } from './coords';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { cederLaMain } from './preuve-par-coup';
import { defautsDeZone, evaluer } from './preuve-vie-mort';
import {
  PROFONDEUR_FIN, coupsFin, coupsLegaux, defautsZoneFin, estDame, jouer, proprietaires, valeurApres, valeurFin, valeursDepart, type ButFin,
} from './refutation-fin';
import { score } from './score';
import { groupAt, neighbors, type Color, type Position } from './rules';

beforeEach(cederLaMain);

const N = 9;
const nb = neighbors(N);
const all = parsePuzzles(LOT_AC);
const at = (l: string) => fromLabel(l, N);
const lab = (m: number) => (m < 0 ? 'passe' : toLabel(m, N));
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;
/** Nombre écrit à la française : « 20,5 ». */
const fr = (n: number) => String(n).replace('.', ',');
const LONG = 120_000;

/**
 * Ce que les textes affirment. `noir` et `blanc` : comptes avec komi à la fin de la ligne optimale ; `terrN` et `terrB` :
 * territoires (pierres mortes comprises) ; `prisN` et `prisB` : prisonniers ; `voisine` : le point qui devient territoire de
 * Blanc si Blanc joue la réponse, et une dame sinon ; `dames` : les dames citées ; `morte` : pierres mortes (point, camp).
 */
interface Attendu { noir: number; blanc: number; terrN: number; terrB: number; prisN: number; prisB: number; voisine: string; dames: string[]; mortes: [string, 1 | 2][] }
const ATTENDU: Record<string, Attendu> = {
  ac01: { noir: 21, blanc: 20.5, terrN: 21, terrB: 14, prisN: 0, prisB: 0, voisine: 'F8', dames: [], mortes: [] },
  ac02: { noir: 24, blanc: 23.5, terrN: 23, terrB: 17, prisN: 1, prisB: 0, voisine: 'D1', dames: [], mortes: [['F5', 2]] },
  ac03: { noir: 23, blanc: 22.5, terrN: 23, terrB: 15, prisN: 0, prisB: 1, voisine: 'F4', dames: ['C4', 'D5'], mortes: [['A1', 1]] },
  ac04: { noir: 24, blanc: 23.5, terrN: 24, terrB: 17, prisN: 0, prisB: 0, voisine: 'F1', dames: ['E4', 'F6'], mortes: [] },
  ac05: { noir: 22, blanc: 21.5, terrN: 21, terrB: 14, prisN: 1, prisB: 1, voisine: 'F4', dames: ['F8', 'G6'], mortes: [['A3', 2], ['H9', 1]] },
};
const IDS = Object.keys(ATTENDU);

const but = (p: Puzzle): ButFin => butFin(p)!;
const mortesDe = (p: Puzzle) => but(p).mortes;
const mortesSur = (q: Position, mortes: readonly number[]) => mortes.filter(m => q.board[m] !== 0);
const compte = (q: Position, mortes: readonly number[]) => score(q, KOMI_NORMAL, 'japanese', new Set(mortesSur(q, mortes)));

/** Positions finales de toutes les lignes optimales (les deux camps jouent un coup de valeur optimale) depuis `depart`. */
function feuillesOptimales(depart: Position, b: ButFin, passes = 0, maitre?: Color): Position[] {
  const vus = new Set<string>(), feuilles: Position[] = [];
  const rec = (p: Position, k: number) => {
    if (k >= 2) { feuilles.push(p); return; }
    const cle = `${p.toPlay}${k}${p.ko}:${p.board.join('')}`;
    if (vus.has(cle)) return;
    vus.add(cle);
    const enfants: { r: Position; v: number; k: number }[] = [];
    for (const m of coupsFin(p, b.zone, mortesSur(p, b.mortes), maitre)) {
      const r = jouer(p, m);
      if (!r) continue;
      const kk = m < 0 ? k + 1 : 0;
      const v = valeurFin(r, b, { maitre }, kk);
      if (v === null) throw new Error(`valeur non prouvée après ${lab(m)}`);
      enfants.push({ r, v, k: kk });
    }
    const opt = p.toPlay === 1 ? Math.max(...enfants.map(e => e.v)) : Math.min(...enfants.map(e => e.v));
    for (const e of enfants.filter(x => x.v === opt)) rec(e.r, e.k);
  };
  rec(depart, passes);
  return feuilles;
}

/** Salles de territoire : régions de points vides (pierres mortes retirées) à un seul camp, hors de la frontière. */
function salles(p: Puzzle) {
  const { pos } = startOf(p), b = but(p), owner = proprietaires(pos, b), vu = new Uint8Array(N * N), out: { camp: Color; points: number[] }[] = [];
  for (let s = 0; s < N * N; s++) {
    if (pos.board[s] || vu[s] || !owner[s]) continue;
    const points: number[] = [], pile = [s];
    vu[s] = 1;
    while (pile.length) {
      const q = pile.pop()!;
      points.push(q);
      for (const r of nb[q]) if (!pos.board[r] && !vu[r] && owner[r]) { vu[r] = 1; pile.push(r); }
    }
    out.push({ camp: owner[s] as Color, points });
  }
  return out;
}

/** Texte attendu de l’explication : les chiffres viennent de ATTENDU, vérifiés plus bas par score(). */
function phrases(id: string): string[] {
  const a = ATTENDU[id];
  switch (id) {
    case 'ac01': return [`Tu as ${a.terrN} points de territoire, Blanc ${a.terrB} + 6,5 = ${fr(a.blanc)}`, `${a.terrB + 1} + 6,5 = ${fr(a.blanc + 1)}`];
    case 'ac02': return [`${a.terrN} points de territoire (avec le point de la pierre morte, une fois retirée) + 1 prisonnier = ${a.noir}`, `Blanc a ${a.terrB} + 6,5 = ${fr(a.blanc)}`];
    case 'ac03': return [`Tu as ${a.terrN} points de territoire. Blanc a ${a.terrB} points de territoire (le point A1 compris, une fois ta pierre retirée) + 1 prisonnier + 6,5 = ${fr(a.blanc)}`];
    case 'ac04': return [`Avec E1, tu as ${a.noir} points, Blanc ${a.terrB} + 6,5 = ${fr(a.blanc)}`];
    default: return [`${a.terrN} points de territoire (le point A3 compris, une fois la pierre blanche retirée) + 1 prisonnier = ${a.noir}`, `Blanc a ${a.terrB} points de territoire (le point H9 compris, une fois ta pierre retirée) + 1 prisonnier + 6,5 = ${fr(a.blanc)}`];
  }
}

// ---------------------------------------------------------------------------------------------------------------

describe('lot AC : identifiants, énoncés, thème, séries, doublons, calendrier, migration (issue #733)', () => {
  it('ac01 à ac05, en 9 × 9, Noir au trait, du plus facile au plus dur, au palier Joueur de club (850 à 1050)', () => {
    expect(all).toHaveLength(5);
    expect(LOT_AC.map(r => r.id)).toEqual(IDS);
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toMatch(/^Pas tout à fait\. /);
      expect(p.explanation, p.id).toMatch(/^Bravo ! /);
      expect(p.prompt, p.id).toMatch(/^Komi : 6,5 points pour Blanc\. /);
      expect(p.difficulty % 50, p.id).toBe(0);
    }
    expect(all.map(p => p.difficulty)).toEqual([850, 900, 950, 1000, 1050]);
  });

  it('chaque problème a le thème « comptage » ; la série de la leçon 16 reste w07, w08, w09 (les nouveaux sont plus durs)', () => {
    for (const p of all) expect(THEME_DU_PROBLEME[p.id], p.id).toBe('comptage');
    expect(THEMES_DE_LECON.l16).toEqual(['comptage']);
    expect(serieDeLecon('l16', ALL_PUZZLES, new Set()).map(p => p.id)).toEqual(['w07', 'w08', 'w09']);
    expect(ALL_PUZZLES.filter(p => THEME_DU_PROBLEME[p.id] === 'comptage')).toHaveLength(8);
  });

  it('la série du thème Compter ne tourne plus en rond : après w07 à w09, les nouveaux, du plus facile au plus dur', () => {
    const ids = (faits: string[]) => serieDeTheme('comptage', ALL_PUZZLES, new Set(faits)).map(p => p.id);
    expect(ids([])).toEqual(['w07', 'w08', 'w09']);
    expect(ids(['w07', 'w08', 'w09'])).toEqual(['ac01', 'ac02', 'ac03']);
    expect(ids(['w07', 'w08', 'w09', 'ac01', 'ac02', 'ac03'])).toEqual(['ac04', 'ac05', 'w07']);
  });

  it('« à ta mesure » (choisirProbleme) peut proposer chaque problème du lot, jamais deux fois le même de suite', () => {
    const tous = parsePuzzles(ALL_PUZZLES);
    for (const p of all) {
      const reussis = new Set(tous.filter(x => x.id !== p.id).map(x => x.id));
      const etat = { ...ETAT_INITIAL, cote: p.difficulty + 300 };
      expect(choisirProbleme(tous, etat, reussis, { jour: 1, alea: () => 0 })?.id, p.id).toBe(p.id);
      expect(choisirProbleme(tous, etat, reussis, { jour: 1, eviter: p.id, alea: () => 0 }), p.id).toBeUndefined();
    }
    // Avec toute la banque à faire, un joueur de cote 1300 reçoit un vrai problème de la banque, jamais le précédent.
    const etat = { ...ETAT_INITIAL, cote: 1300, precedent: { id: 'ac03', difficulte: 950 } };
    const suivant = choisirProbleme(tous, etat, new Set(), { jour: 1, alea: () => 0 })!;
    expect(tous.some(x => x.id === suivant.id)).toBe(true);
    expect(suivant.id).not.toBe('ac03');
  });

  it('le lot AC n’est pas au Go du jour : le Go du jour léger est dans le JS initial (budget de 150 Ko), le calendrier et les jours déjà publiés ne changent pas', () => {
    for (const id of IDS) {
      expect(CALENDRIER_GO_DU_JOUR, id).not.toContain(id);
      expect(estGoDuJour(id), id).toBe(false);
    }
    // Le calendrier s’arrête au lot AB, au même endroit que la version légère de l’accueil, et commence où il commençait.
    expect(CALENDRIER_GO_DU_JOUR[0]).toBe('b1');
    expect(CALENDRIER_GO_DU_JOUR.at(-1)).toBe('ab21');
    expect(GO_DU_JOUR.map(([id]) => id)).toEqual(CALENDRIER_GO_DU_JOUR);
    expect(new Set(CALENDRIER_GO_DU_JOUR).size).toBe(CALENDRIER_GO_DU_JOUR.length);
    // Tous les autres problèmes du calendrier sont toujours de la banque : le lot AC est la seule différence.
    const horsCalendrier = ALL_PUZZLES.filter(p => !estGoDuJour(p.id)).map(p => p.id).sort();
    expect(horsCalendrier).toEqual(IDS);
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées)', () => {
    const autres = ALL_PUZZLES.filter(r => !/^ac\d\d$/.test(r.id));
    const ids = new Set(autres.map(r => r.id)), vues = new Set(autres.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_AC) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(vues.has(plainKey(s)), row.id).toBe(false);
      vues.add(plainKey(rowsOf(row.setup)));
    }
    expect(new Set(ALL_PUZZLES.map(p => p.id)).size).toBe(ALL_PUZZLES.length);
  });

  it('aucun problème ne reprend un exercice de leçon (symétries et échange des couleurs compris)', () => {
    const exercices = LESSONS_FR.flatMap(l => positionsDeLecon(l)).filter(r => r.length === 9);
    expect(exercices.length).toBeGreaterThan(10);
    for (const row of LOT_AC) for (const e of exercices) expect(memePosition(rowsOf(row.setup), e), row.id).toBe(false);
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261025140000_lot_ac.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('ac\d\d', null, 9,/g)).toHaveLength(LOT_AC.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_AC) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });

  it('chaque problème a son anglais, avec les mêmes chiffres', () => {
    for (const p of all) {
      const en = PROBLEMES_EN[p.id];
      expect(en, p.id).toBeTruthy();
      expect(en.title, p.id).toBeTruthy();
    }
  });
});

describe('lot AC : position légale, fin de partie sûre', () => {
  for (const p of all) {
    const { pos, marked } = startOf(p), b = but(p), mortes = new Set(mortesDe(p));

    it(`${p.id} : pas de ko, aucune chaîne en atari hors des pierres mortes, réponse légale, une seule chaîne vivante par couleur`, () => {
      expect(pos.ko).toBe(-1);
      const chaines = [0, 0, 0], vu = new Set<number>();
      for (let q = 0; q < N * N; q++) {
        if (!pos.board[q] || vu.has(q)) continue;
        const g = groupAt(pos.board, N, q);
        g.stones.forEach(s => vu.add(s));
        if (g.stones.some(s => mortes.has(s))) continue;
        expect(g.liberties.size, `${p.id} ${lab(q)}`).toBeGreaterThanOrEqual(2);
        chaines[pos.board[q]]++;
      }
      expect(chaines.slice(1), p.id).toEqual([1, 1]);
      expect(coupsLegaux(pos)).toContain(p.answers[0]);
      expect(p.answers).toHaveLength(1);
    });

    it(`${p.id} : pierres marquées = pierres mortes de l’énoncé ; chacune est prouvée morte quel que soit le camp au trait`, () => {
      expect([...marked].sort((x, y) => x - y)).toEqual([...mortes].sort((x, y) => x - y));
      expect(ATTENDU[p.id].mortes.map(([l, c]) => [at(l), c]).sort()).toEqual([...mortes].map(m => [m, pos.board[m]]).sort());
      expect(defautsZoneFin(pos, b), p.id).toEqual([]);
    });

    it(`${p.id} : la frontière (${b.zone.map(lab).join(' ')}) est la seule zone ouverte ; hors d’elle, chaque point vide est à un camp`, () => {
      const owner = proprietaires(pos, b);
      for (let q = 0; q < N * N; q++) if (!pos.board[q] && !b.zone.includes(q)) expect(owner[q], `${p.id} ${lab(q)}`).not.toBe(0);
      expect(b.zone.length).toBeLessThanOrEqual(5);
      expect(b.zone).toContain(p.answers[0]);
      expect(b.zone).toContain(at(ATTENDU[p.id].voisine));
      for (const d of ATTENDU[p.id].dames) expect(b.zone).toContain(at(d));
    });

    it(`${p.id} : chaque salle de territoire est sûre (une pierre jetée dedans meurt), chaque camp a au moins deux salles`, () => {
      const lesSalles = salles(p);
      for (const camp of [1, 2] as const) expect(lesSalles.filter(s => s.camp === camp).length, `${p.id} camp ${camp}`).toBeGreaterThanOrEqual(2);
      for (const s of lesSalles) {
        const intrus = (3 - s.camp) as Color;
        // Les pierres mortes de l’intrus qui touchent la salle en font partie (elles y sont déjà, et mortes).
        const mortesIci = [...mortes].filter(d => pos.board[d] === intrus && [...groupAt(pos.board, N, d).liberties].some(l => s.points.includes(l)));
        const zone = [...s.points, ...mortesIci.flatMap(d => groupAt(pos.board, N, d).stones)];
        expect(s.points.length, `${p.id} salle`).toBeLessThanOrEqual(12);
        for (const m of s.points) {
          const r = jouer({ ...pos, toPlay: intrus }, m);
          if (!r) continue;
          const q = { ...r, toPlay: s.camp };
          expect(defautsDeZone(q, m, zone), `${p.id} ${lab(m)} : zone fermée`).toEqual([]);
          expect(evaluer(q, m, zone, { budget: 5_000_000 }), `${p.id} : une pierre jetée en ${lab(m)} est prise`).toBe(-1);
        }
      }
    }, LONG);
  }
});

describe('lot AC : aucun ko, la réponse laisse un compte net', () => {
  for (const p of all) {
    const { pos } = startOf(p), b = but(p), a = ATTENDU[p.id];

    it(`${p.id} : aucun ko dans tout l’arbre de la fin (coups de la frontière des deux camps)`, () => {
      const vus = new Set<string>();
      let noeuds = 0;
      const rec = (q: Position, passes: number) => {
        if (passes >= 2) return;
        const cle = `${q.toPlay}${passes}${q.ko}:${q.board.join('')}`;
        if (vus.has(cle)) return;
        vus.add(cle);
        noeuds++;
        for (const m of coupsFin(q, b.zone, mortesSur(q, b.mortes))) {
          const r = jouer(q, m);
          if (!r) continue;
          expect(r.ko, `${p.id} ${lab(m)}`).toBe(-1);
          rec(r, m < 0 ? passes + 1 : 0);
        }
      };
      rec(pos, 0);
      expect(noeuds).toBeGreaterThan(1);
    });

    it(`${p.id} : après ${lab(p.answers[0])}, toutes les lignes optimales finissent sur le même compte (${a.noir} contre ${fr(a.blanc)}), sans prise ni atari`, () => {
      const apres = jouer(pos, p.answers[0])!;
      const feuilles = feuillesOptimales(apres, b);
      expect(feuilles.length).toBeGreaterThan(0);
      const comptes = new Set<string>();
      for (const f of feuilles) {
        const s = compte(f, b.mortes);
        comptes.add(`${s.black}|${s.white}|${s.territory[1]}|${s.territory[2]}`);
        expect(s.winner, p.id).toBe(1);
        expect(s.margin).toBe(0.5);
        // Nets : les pierres mortes sont encore là (on ne les a pas prises), aucune pierre vivante n’est prise.
        for (const m of b.mortes) expect(f.board[m], `${p.id} ${lab(m)}`).toBe(pos.board[m]);
        for (let q = 0; q < N * N; q++) if (pos.board[q] && !b.mortes.includes(q)) expect(f.board[q], `${p.id} ${lab(q)}`).toBe(pos.board[q]);
        // Le décompte annoncé, point par point.
        expect([s.black, s.white, s.territory[1], s.territory[2]]).toEqual([a.noir, a.blanc, a.terrN, a.terrB]);
        expect(s.black - s.territory[1], `${p.id} prisonniers de Noir`).toBe(a.prisN);
        expect(s.white - KOMI_NORMAL - s.territory[2], `${p.id} prisonniers de Blanc`).toBe(a.prisB);
        // Le point voisin est une dame : il touche les deux couleurs.
        expect(s.owner[at(a.voisine)], `${p.id} ${a.voisine}`).toBe(0);
        // Chaque pierre morte est dans le territoire de l’autre camp, une fois retirée.
        for (const [l, c] of a.mortes) expect(s.owner[at(l)], `${p.id} ${l}`).toBe(3 - c);
      }
      expect(comptes.size, p.id).toBe(1);
    });

    it(`${p.id} : si Noir passe, Blanc joue ${lab(p.answers[0])} : ${a.voisine} devient son territoire et Blanc gagne d’un demi-point`, () => {
      const apresPasse = jouer(pos, -1)!;
      const feuilles = feuillesOptimales(apresPasse, b, 1);
      for (const f of feuilles) {
        const s = compte(f, b.mortes);
        expect(s.winner, p.id).toBe(2);
        expect(s.margin).toBe(0.5);
        expect(s.owner[at(a.voisine)], `${p.id} ${a.voisine}`).toBe(2);
        expect(s.white, p.id).toBe(a.blanc + 1);
        expect(s.black, p.id).toBe(a.noir);
      }
    });

    it(`${p.id} : les dames citées sont des dames (le compte ne change pas), le point voisin n’en est pas une`, () => {
      for (const d of a.dames) expect(estDame(pos, at(d), b.mortes), `${p.id} ${d}`).toBe(true);
      expect(estDame(pos, at(a.voisine), b.mortes), `${p.id} ${a.voisine}`).toBe(false);
      // Au départ, Noir est déjà devant d’un demi-point (les points ouverts ne comptent pour personne).
      const s = compte(pos, b.mortes);
      expect([s.black, s.white, s.winner, s.margin]).toEqual([a.noir, a.blanc, 1, 0.5]);
    });
  }
});

describe('lot AC : la réponse est le seul coup qui fait gagner Noir', () => {
  for (const p of all) {
    const { pos } = startOf(p), b = but(p), rep = p.answers[0];
    for (const [modele, maitre] of [['Noir maître du ko', 1], ['Blanc maître du ko', 2], ['ko simple', undefined]] as const) {
      it(`${p.id} (${modele}) : ${lab(rep)} vaut 7 (victoire d’un demi-point), tout autre coup légal et la passe valent 6 au plus`, async () => {
        const owner = proprietaires(pos, b);
        const valeurs = new Map<number, number>();
        for (const m of coupsLegaux(pos)) {
          await cederLaMain();
          const v = valeurApres(pos, b, m, owner, { maitre });
          expect(v, `${p.id} ${lab(m)} : valeur prouvée`).not.toBeNull();
          valeurs.set(m, v!);
        }
        expect(valeurs.get(rep), p.id).toBe(7);
        expect(valeurs.get(rep)!).toBeGreaterThan(KOMI_NORMAL);
        for (const [m, v] of valeurs) if (m !== rep) expect(v, `${p.id} ${lab(m)}`).toBeLessThanOrEqual(6);
        expect(valeurs.get(-1), `${p.id} passe`).toBe(6);
        // Les valeurs de outils/referencesFin.ts (le bon coup dans les deux modèles de ko, la passe) sont celles-ci.
        if (maitre === 1) expect(valeursDepart(pos, b, { maitre }).meilleure).toBe(7);
      }, LONG);
    }
  }
});

describe('lot AC : chaque erreur est réfutée, la réplique citée est la bonne', () => {
  for (const p of all) {
    const { pos } = startOf(p), b = but(p), rep = p.answers[0], a = ATTENDU[p.id];

    it(`${p.id} : après chaque coup légal autre que ${lab(rep)}, Blanc joue ${lab(rep)} et gagne quoi que Noir joue (même maître du ko)`, async () => {
      const owner = proprietaires(pos, b);
      let essais = 0;
      for (const m of coupsLegaux(pos).filter(x => x >= 0 && x !== rep)) {
        await cederLaMain();
        const r1 = jouer(pos, m)!;
        // Une pierre jetée chez Blanc est morte ; chez Noir, elle reste (et coûte un point) : comme dans les autres lots.
        const apres: ButFin = { zone: b.zone, mortes: !b.zone.includes(m) && owner[m] === 2 ? [...b.mortes, m] : b.mortes };
        expect(r1.board[rep], `${p.id} ${lab(m)} : la réponse est encore libre`).toBe(0);
        expect(jouer(r1, rep), `${p.id} ${lab(m)} : la réplique est légale`).not.toBeNull();
        const v = valeurApres(r1, apres, rep, owner, { maitre: 1, profondeur: PROFONDEUR_FIN - 1 });
        expect(v, `${p.id} ${lab(m)} puis ${lab(rep)} : valeur prouvée`).not.toBeNull();
        expect(v!, `${p.id} ${lab(m)} puis ${lab(rep)}`).toBeLessThanOrEqual(6);
        essais++;
      }
      expect(essais).toBe(coupsLegaux(pos).filter(x => x >= 0 && x !== rep).length);
      expect(essais).toBeGreaterThan(20);
    }, LONG);

    it(`${p.id} : la phrase « ${a.voisine} devient son territoire » est vraie après chaque erreur ordinaire (coup dans la frontière ou dans un territoire)`, async () => {
      // Le coup faux est joué, Blanc répond, puis la fin se joue : le point voisin finit chez Blanc (sauf si Noir l’a joué).
      const owner = proprietaires(pos, b);
      for (const m of coupsLegaux(pos).filter(x => x >= 0 && x !== rep && x !== at(a.voisine))) {
        await cederLaMain();
        const r1 = jouer(pos, m)!, r2 = jouer(r1, rep)!;
        const apres: ButFin = { zone: b.zone, mortes: !b.zone.includes(m) && owner[m] === 2 ? [...b.mortes, m] : b.mortes };
        for (const f of feuillesOptimales(r2, apres)) {
          const s = compte(f, apres.mortes);
          expect(s.owner[at(a.voisine)], `${p.id} ${lab(m)} : ${a.voisine}`).toBe(2);
          expect(s.winner, `${p.id} ${lab(m)}`).toBe(2);
        }
      }
    }, LONG);

    it(`${p.id} : si Noir joue le point voisin ${a.voisine}, Blanc joue ${lab(rep)} et gagne encore`, () => {
      const owner = proprietaires(pos, b), m = at(a.voisine);
      const r1 = jouer(pos, m)!, r2 = jouer(r1, rep)!;
      const apres: ButFin = { zone: b.zone, mortes: !b.zone.includes(m) && owner[m] === 2 ? [...b.mortes, m] : b.mortes };
      for (const f of feuillesOptimales(r2, apres)) expect(compte(f, apres.mortes).winner, p.id).toBe(2);
    });

    it(`${p.id} : le texte de la réfutation nomme la réplique, le texte de l’explication a les bons chiffres`, () => {
      expect(p.refutation, p.id).toContain(`Blanc joue ${lab(rep)} : ${a.voisine} devient son territoire, et il gagne.`);
      for (const f of phrases(p.id)) expect(p.explanation, `${p.id} : « ${f} »`).toContain(f);
      expect(p.explanation).toContain(`Si Blanc jouait ${lab(rep)}, ${a.voisine} deviendrait son territoire`);
      expect(p.explanation).toContain('tu gagnes d’un demi-point');
      for (const d of a.dames) expect((p.explanation ?? '') + (p.refutation ?? ''), `${p.id} ${d}`).toContain(d);
      if (a.prisN || a.prisB) expect(p.explanation).toMatch(/prisonnier/);
    });
  }
});
