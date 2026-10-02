// Issue #16, lot V : preuve de chaque problème (prolongement des leçons 9 à 12) avec le moteur de règles.
// Trois familles, prouvées comme les lots qui leur servent de modèle :
// - capture (comme les lots N, P, S, T et U) : lecteur exact src/go/lecteurs-lot-n.ts, tous les coups légaux et la
//   passe, avec le ko permis puis avec toute prise en ko interdite ; le résultat doit être le même. Le coup gagne s'il
//   prend une pierre marquée dans le nombre de coups annoncé par l'énoncé, contre toute défense ;
// - sauver (comme le lot N) : après le coup, Blanc ne prend la pierre marquée en aucune suite de HORIZON coups blancs ;
//   après tout autre coup (et la passe), la réplique annoncée la capture aussitôt ;
// - vivre, tuer (comme les lots Q, R, T et U) : outil src/go/preuve-vie-mort.ts, recherche complète dans une zone
//   fermée. Un ko, une répétition, une double passe ou la profondeur atteinte comptent comme « non résolu ».
// Les coups gagnants sont exactement les réponses acceptées (un test par coup, preuve-par-coup.ts), chaque erreur
// (et la passe) échoue franchement et la réplique citée par la réfutation suffit, aucun doublon aux 8 symétries (ni
// avec les problèmes existants, ni avec les exercices des leçons), suites des explications rejouées, calendrier du Go
// du jour (le lot V suit le lot U), migration identique au fichier.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_V from '../content/lots/v-captures-lecons';
import { LESSONS_FR } from '../content/lessons';
import { ALL_PUZZLES, CALENDRIER_GO_DU_JOUR } from '../content/puzzles';
import { memePosition, positionsDeLecon } from '../content/redites';
import { THEME_DU_PROBLEME } from '../content/themes';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { AVEC_KO, SANS_KO, attackerCaptures, captureEn, legal, sauveEn } from './lecteurs-lot-n';
import { cederLaMain, preuveParCoup } from './preuve-par-coup';
import { coupsGagnants, defautsDeZone, evaluer, issueApres, yeuxDuGroupe, type Issue } from './preuve-vie-mort';
import { groupAt, neighbors, play, type Position } from './rules';
import { hasTwoEyes } from './tactics';

// Recette du 28/09 (#195) : longues preuves synchrones, voir cederLaMain (preuve-par-coup.ts).
beforeEach(cederLaMain);

const all = parsePuzzles(LOT_V);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const label = (m: number) => (m < 0 ? 'passe' : toLabel(m, 9));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const seq = (pos: Position, ...moves: string[]) => moves.reduce((q, m) => ok(play(q, m === 'passe' ? -1 : at(m))), pos);
const libsOf = (pos: Position, l: string) => [...groupAt(pos.board, 9, at(l)).liberties].map(label).sort();
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;
const chaine = (pos: Position, l: string) => groupAt(pos.board, 9, at(l)).stones.map(label).sort();

type Genre = 'capture' | 'sauver' | 'vivre' | 'tuer';

/** Horizon des problèmes « sauver » : Blanc ne doit pas prendre la pierre en HORIZON coups (comme le lot N). */
const HORIZON = 4;

/** Genre et thème de pratique de chaque problème. */
const ATTENDU: Record<string, { genre: Genre; theme: string }> = {
  v01: { genre: 'capture', theme: 'capture' },
  v02: { genre: 'sauver', theme: 'atari' },
  v03: { genre: 'capture', theme: 'atari' },
  v04: { genre: 'sauver', theme: 'atari' },
  v05: { genre: 'capture', theme: 'echelle' },
  v06: { genre: 'capture', theme: 'double-atari' },
  v07: { genre: 'capture', theme: 'echelle' },
  v08: { genre: 'capture', theme: 'filet' },
  v09: { genre: 'capture', theme: 'prise-en-retour' },
  v10: { genre: 'capture', theme: 'double-atari' },
  v11: { genre: 'capture', theme: 'filet' },
  v12: { genre: 'capture', theme: 'prise-en-retour' },
  v13: { genre: 'capture', theme: 'semeai' },
  v14: { genre: 'vivre', theme: 'vie-mort' },
  v15: { genre: 'tuer', theme: 'vie-mort' },
  v16: { genre: 'tuer', theme: 'vie-mort' },
};

/** Problèmes dont la position de départ a une chaîne en atari : c'est le sujet (capturer ou sauver en un coup). */
const ATARI_AU_DEPART = new Set(['v01', 'v02', 'v04']);

const NOMBRES: Record<string, number> = { 'un coup': 1, 'deux coups au plus': 2, 'trois coups au plus': 3, 'quatre coups au plus': 4, 'cinq coups au plus': 5 };
const CAPTURE = /(?:^|\. )Capture (la pierre marquée|les pierres marquées|une des pierres marquées) en (un coup|(?:deux|trois|quatre|cinq) coups au plus)\.$/;

/** Nombre de coups noirs annoncé par l'énoncé d'un problème de capture. */
function coupsOf(p: Puzzle): number {
  const m = CAPTURE.exec(p.prompt);
  if (!m) throw new Error(`énoncé inconnu : ${p.id}`);
  return NOMBRES[m[2]];
}

/** Début d'énoncé attendu pour les autres genres. */
const ENONCE: Record<Exclude<Genre, 'capture'>, RegExp> = {
  sauver: /^Ta pierre marquée est en atari \(une seule liberté\)\. Sauve-la\.$/,
  vivre: /^Noir joue et vit\. /,
  tuer: /^Noir joue et tue\. /,
};

/** Zone des problèmes de vie et mort : l'espace vide relié à la cible sans traverser l'attaquant (vérifié plus bas). */
const ZONE: Record<string, string[]> = {
  v14: ['C2', 'A1', 'C1', 'E1'],
  v15: ['D2', 'C1', 'E1', 'F1'],
  v16: ['A3', 'C3', 'D3', 'A2', 'E2', 'B1'],
};

/** Réplique de Blanc annoncée par la réfutation après une erreur de Noir (`sauf` : réplique → erreurs concernées). */
const REPLY: Record<string, { defaut: string; sauf?: Record<string, string[]> }> = {
  v01: { defaut: 'D4' },
  v02: { defaut: 'E4' },
  v03: { defaut: 'C5' },
  v04: { defaut: 'E1', sauf: { D1: ['E1'] } },
  v05: { defaut: 'E3' },
  v06: { defaut: 'E5' },
  v07: { defaut: 'E4' },
  v08: { defaut: 'E4', sauf: { D5: ['E4', 'E3'] } },
  v09: { defaut: 'D1' },
  v10: { defaut: 'C3' },
  v11: { defaut: 'F3', sauf: { E4: ['F3', 'G3'] } },
  v12: { defaut: 'D9' },
  v13: { defaut: 'F1', sauf: { E1: ['F1'], D1: ['C1'] } },
  v14: { defaut: 'C2' },
  v15: { defaut: 'D2' },
  v16: { defaut: 'A3' },
};

const genreOf = (p: Puzzle) => ATTENDU[p.id].genre;
const zoneFermee = (p: Puzzle) => genreOf(p) === 'vivre' || genreOf(p) === 'tuer';

/** Espace vide relié à la cible sans traverser une pierre de l'attaquant. */
function espaceDe(pos: Position, cible: number): number[] {
  const d = pos.board[cible], nb = neighbors(9), vu = new Set([cible]), pile = [cible], out: number[] = [];
  while (pile.length) {
    const q = pile.pop()!;
    for (const r of nb[q]) {
      if (vu.has(r) || (pos.board[r] !== 0 && pos.board[r] !== d)) continue;
      vu.add(r);
      pile.push(r);
      if (pos.board[r] === 0) out.push(r);
    }
  }
  return out.sort((a, b) => a - b);
}

/** Problème de vie et mort : cible (le groupe marqué), zone, issue visée. */
function probleme(p: Puzzle) {
  const { pos, marked } = startOf(p);
  const vise: Issue = genreOf(p) === 'vivre' ? 1 : -1;
  return { pos, marked, cible: marked[0], zone: ZONE[p.id].map(at), vise };
}

/** Le coup noir `m` atteint-il le but ? `o` : ko permis ou interdit (capture et sauver). */
function gagne(p: Puzzle, m: number, o = AVEC_KO): boolean {
  const { pos, marked } = startOf(p);
  const g = genreOf(p);
  if (g === 'capture') return captureEn(pos, m, marked, coupsOf(p), o);
  if (g === 'sauver') return sauveEn(pos, m, marked, HORIZON, o);
  const { cible, zone, vise } = probleme(p);
  return issueApres(pos, m, cible, zone) === vise;
}

describe('lot V : identifiants, énoncés, thèmes, doublons, calendrier, migration (issue #16)', () => {
  it('v01, v02… sans trou, tous en 9 × 9, Noir au trait, difficulté croissante de 400 à 1400, par paliers', () => {
    expect(all).toHaveLength(LOT_V.length);
    expect(LOT_V.length).toBe(16);
    expect(LOT_V.map(r => r.id)).toEqual(LOT_V.map((_, i) => `v${String(i + 1).padStart(2, '0')}`));
    for (const table of [ATTENDU, REPLY]) expect(Object.keys(table).sort()).toEqual(all.map(p => p.id));
    expect(Object.keys(ZONE).sort()).toEqual(all.filter(zoneFermee).map(p => p.id));
    let prev = 0;
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toMatch(/^Pas tout à fait\. /);
      expect(p.explanation, p.id).toBeTruthy();
      expect(p.difficulty).toBeGreaterThan(prev);
      prev = p.difficulty;
      const g = genreOf(p);
      if (g === 'capture') coupsOf(p);
      else expect(p.prompt, p.id).toMatch(ENONCE[g]);
    }
    // Six faciles (400 à 700), six moyens (700 à 1100), quatre plus durs (1100 à 1400).
    const d = all.map(p => p.difficulty);
    expect(d.filter(x => x >= 400 && x < 700)).toHaveLength(6);
    expect(d.filter(x => x >= 700 && x < 1100)).toHaveLength(6);
    expect(d.filter(x => x >= 1100 && x <= 1400)).toHaveLength(4);
  });

  it('chaque problème a son thème de pratique, et chaque thème des leçons 9 à 12 en reçoit au moins un', () => {
    for (const p of all) expect(THEME_DU_PROBLEME[p.id], p.id).toBe(ATTENDU[p.id].theme);
    const themes = new Set(all.map(p => ATTENDU[p.id].theme));
    for (const t of ['filet', 'prise-en-retour', 'semeai', 'vie-mort']) expect(themes).toContain(t);
  });

  it('le Go du jour garde son ordre : le lot V, d’un seul tenant, vient juste après le lot U et juste avant w01', () => {
    const ids = LOT_V.map(r => r.id);
    // Lot W (#16, leçons 14 à 16) ajouté après : le lot V reste d'un seul tenant, juste avant w01.
    const debut = CALENDRIER_GO_DU_JOUR.indexOf('v01');
    expect(CALENDRIER_GO_DU_JOUR.slice(debut, debut + ids.length)).toEqual(ids);
    expect(CALENDRIER_GO_DU_JOUR[debut + ids.length]).toBe('w01');
    expect(CALENDRIER_GO_DU_JOUR.indexOf('v01')).toBe(CALENDRIER_GO_DU_JOUR.indexOf('u15') + 1);
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées) déjà utilisés', () => {
    const others = ALL_PUZZLES.filter(r => !/^v\d\d$/.test(r.id));
    expect(others.length).toBeGreaterThanOrEqual(198);
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_V) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('aucun problème ne reprend un exercice de leçon (symétries et échange des couleurs compris)', () => {
    const exercices = LESSONS_FR.flatMap(l => positionsDeLecon(l)).filter(r => r.length === 9);
    expect(exercices.length).toBeGreaterThan(10);
    for (const row of LOT_V) for (const e of exercices) expect(memePosition(rowsOf(row.setup), e), row.id).toBe(false);
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260930210100_lot_v.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('v\d\d', null, 9,/g)).toHaveLength(LOT_V.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_V) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });

  it('textes : « Blanc joue X » et jamais « prend ta pierre en X » (#282)', () => {
    for (const p of all) for (const t of [p.prompt, p.explanation, p.refutation]) expect(t, p.id).not.toMatch(/prend ta pierre en/);
  });
});

describe('lot V : départ légal et problème réel', () => {
  for (const p of all) {
    it(`${p.id} : chaînes à deux libertés au moins (sauf l'atari du sujet), pas de ko, réponses légales`, () => {
      const { pos, marked } = startOf(p);
      expect(pos.ko).toBe(-1);
      expect(marked.length).toBeGreaterThan(0);
      let enAtari = 0;
      for (let q = 0; q < 81; q++) if (pos.board[q] && groupAt(pos.board, 9, q).liberties.size < 2) enAtari++;
      if (ATARI_AU_DEPART.has(p.id)) expect(enAtari, p.id).toBeGreaterThan(0);
      else expect(enAtari, p.id).toBe(0);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
    });
  }

  for (const p of all.filter(q => genreOf(q) === 'capture')) {
    it(`${p.id} : cibles blanches, une seule chaîne sauf « une des pierres », pas de prise plus rapide`, () => {
      const { pos, marked } = startOf(p), k = coupsOf(p);
      for (const t of marked) expect(pos.board[t], p.id).toBe(2);
      if (!p.prompt.includes('une des pierres')) expect(groupAt(pos.board, 9, marked[0]).stones.length, p.id).toBe(marked.length);
      else expect(new Set(marked.map(t => Math.min(...groupAt(pos.board, 9, t).stones))).size, p.id).toBeGreaterThan(1);
      if (k > 1) for (let m = 0; m < 81; m++) expect(captureEn(pos, m, marked, k - 1), `${p.id} ${label(m)}`).toBe(false);
    });
  }

  for (const p of all.filter(q => genreOf(q) === 'sauver')) {
    it(`${p.id} : une pierre noire marquée, en atari, que Blanc prend au coup suivant si Noir passe`, () => {
      const { pos, marked } = startOf(p);
      expect(marked).toHaveLength(1);
      expect(pos.board[marked[0]]).toBe(1);
      expect(groupAt(pos.board, 9, marked[0]).liberties.size).toBe(1);
      expect(attackerCaptures(ok(play(pos, -1)), marked, 1)).toBe(true);
    });
  }

  for (const p of all.filter(zoneFermee)) {
    it(`${p.id} : un seul groupe marqué, du bon camp, pas encore vivant ; zone fermée et naturelle`, () => {
      const { pos, marked, cible, zone } = probleme(p);
      expect(marked, p.id).toHaveLength(1);
      expect(pos.board[cible], p.id).toBe(genreOf(p) === 'vivre' ? 1 : 2);
      expect(hasTwoEyes(pos, cible), p.id).toBe(false);
      expect(defautsDeZone(pos, cible, zone), p.id).toEqual([]);
      expect(zone.map(label).sort(), p.id).toEqual(espaceDe(pos, cible).map(label).sort());
      const nb = neighbors(9);
      for (const z of zone) for (const r of nb[z]) if (pos.board[r] === 0) expect(zone, `${p.id} ${label(z)}-${label(r)}`).toContain(r);
      for (const a of p.answers) expect(zone, `${p.id} ${label(a)}`).toContain(a);
    });
  }
});

describe('lot V : les coups gagnants sont exactement les réponses acceptées', () => {
  for (const p of all) {
    const { pos } = startOf(p), lecteur = !zoneFermee(p);
    preuveParCoup(p.id, pos, p.answers, m => {
      const r = gagne(p, m);
      if (lecteur) expect(gagne(p, m, SANS_KO), `${p.id} ${label(m)} sans ko`).toBe(r);
      return r;
    });
  }
});

// Un test par erreur (comme preuveParCoup) : un seul bloc synchrone risquerait « Timeout calling onTaskUpdate ».
describe('lot V : chaque erreur échoue franchement, et la réfutation dit vrai', () => {
  for (const p of all) {
    const { pos, marked } = startOf(p), spec = REPLY[p.id];
    const sauf = new Map<string, string>();
    for (const [r, erreurs] of Object.entries(spec.sauf ?? {})) for (const e of erreurs) sauf.set(e, r);
    const wrong = [...Array(81).keys(), -1].filter(m => !p.answers.includes(m) && legal(pos, m, AVEC_KO) !== null);
    describe(`${p.id} : après chaque autre coup (et la passe), Blanc joue la réplique annoncée et Noir échoue`, () => {
      it('la réfutation cite la réplique, et chaque exception vise une vraie erreur', () => {
        expect(p.refutation).toMatch(new RegExp(`Blanc joue ${spec.defaut}\\b`));
        for (const [r, erreurs] of Object.entries(spec.sauf ?? {})) expect(p.refutation).toContain(`ou ${r} si tu as joué ${erreurs.join(' ou ')}`);
        for (const s of sauf.keys()) expect(wrong.map(label), p.id).toContain(s);
        expect(wrong).toContain(-1);
      });
      for (const m of wrong) {
        const r = sauf.get(label(m)) ?? spec.defaut;
        it(`${label(m)} échoue, et ${r} le punit`, () => {
          const apres = ok(play(pos, m));
          const g = genreOf(p);
          if (g === 'capture') {
            const k = coupsOf(p), puni = ok(play(apres, at(r)));
            for (const o of [AVEC_KO, SANS_KO]) expect(attackerCaptures(puni, marked, k - 1, o), `${p.id} ${label(m)} puis ${r}`).toBe(false);
          } else if (g === 'sauver') {
            // La réplique capture la pierre marquée tout de suite.
            expect(ok(play(apres, at(r))).board[marked[0]], `${p.id} ${label(m)} puis ${r}`).toBe(0);
          } else {
            const { cible, zone, vise } = probleme(p);
            expect(issueApres(pos, m, cible, zone), `${p.id} ${label(m)}`).toBe(-vise);
            expect(issueApres(apres, at(r), cible, zone), `${p.id} ${label(m)} puis ${r}`).toBe(-vise);
          }
        }, 120_000);
      }
    });
  }
});

describe('lot V : les suites des explications et des réfutations', () => {
  const start = (id: string) => startOf(pz(id)).pos;
  const cibles = (id: string) => startOf(pz(id)).marked;
  /** Noir au trait prend-il une cible en `k` coups ? */
  const prend = (id: string, k: number, ...moves: string[]) => attackerCaptures(seq(start(id), ...moves), cibles(id), k);
  /** Coups noirs qui prennent une cible en `k` coups après la suite. */
  const prises = (id: string, k: number, ...moves: string[]) => {
    const p = seq(start(id), ...moves);
    return [...Array(81).keys()].filter(m => captureEn(p, m, cibles(id), k)).map(label);
  };
  const vraisYeux = (pos: Position, l: string) => yeuxDuGroupe(pos, at(l)).filter(y => y.vrai).map(y => label(y.point)).sort();
  const gagnants = (id: string, ...moves: string[]) => {
    const { pos, cible, zone } = probleme(pz(id));
    const p = seq(pos, ...moves);
    const but = (p.toPlay === 1) === (genreOf(pz(id)) === 'vivre') ? 'vivre' : 'tuer';
    return coupsGagnants(p, cible, zone, but).map(label);
  };

  it('v01 : les deux pierres n’ont qu’une liberté, D4 ; D4 les prend ; D4 blanc les allonge', () => {
    expect(libsOf(start('v01'), 'D5')).toEqual(['D4']);
    const d4 = seq(start('v01'), 'D4');
    expect(d4.board[at('D5')]).toBe(0);
    expect(d4.board[at('E5')]).toBe(0);
    expect(libsOf(seq(start('v01'), 'passe', 'D4'), 'D5')).toEqual(['C4', 'D3']);
  });

  it('v02 : E4 relie E5 à E3, avec plusieurs libertés ; E4 blanc prend E5', () => {
    const e4 = seq(start('v02'), 'E4');
    expect(chaine(e4, 'E5')).toEqual(['E3', 'E4', 'E5']);
    expect(libsOf(e4, 'E5').length).toBeGreaterThanOrEqual(3);
    expect(seq(start('v02'), 'passe', 'E4').board[at('E5')]).toBe(0);
  });

  it('v03 : C5 laisse D6 seule ; D6 blanc bute sur E6 et D5, et D7 prend ; C5 blanc garde assez de libertés', () => {
    const c5 = seq(start('v03'), 'C5');
    expect(libsOf(c5, 'C6')).toEqual(['D6']);
    const d6 = seq(c5, 'D6');
    expect(libsOf(d6, 'C6')).toEqual(['D7']);
    expect(seq(d6, 'D7').board[at('C6')]).toBe(0);
    expect(libsOf(seq(start('v03'), 'passe', 'C5'), 'C6').length).toBeGreaterThanOrEqual(2);
  });

  it('v04 : D2 blanc est en atari ; D1 la prend et E2 gagne D2 ; E1 laisse E2 en atari, D1 blanc la prend', () => {
    expect(libsOf(start('v04'), 'D2')).toEqual(['D1']);
    const d1 = seq(start('v04'), 'D1');
    expect(d1.board[at('D2')]).toBe(0);
    expect(libsOf(d1, 'E2')).toEqual(['D2', 'E1']);
    const e1 = seq(start('v04'), 'E1');
    expect(libsOf(e1, 'E2')).toEqual(['D1']);
    expect(seq(e1, 'D1').board[at('E2')]).toBe(0);
  });

  it('v05 : l’échelle E3, D2, C2, D1, E1, C1, puis B1 prend ; E3 blanc s’échappe', () => {
    expect(libsOf(seq(start('v05'), 'E3'), 'D3')).toEqual(['D2']);
    expect(prises('v05', 3, 'E3', 'D2')).toContain('C2');
    expect(prises('v05', 2, 'E3', 'D2', 'C2', 'D1')).toContain('E1');
    const fin = seq(start('v05'), 'E3', 'D2', 'C2', 'D1', 'E1', 'C1');
    expect(libsOf(fin, 'D3')).toEqual(['B1']);
    expect(seq(fin, 'B1').board[at('D3')]).toBe(0);
    expect(prend('v05', 4, 'passe', 'E3')).toBe(false);
  });

  it('v06 : E5 met D5 (C5) et E4 (E3) en atari ; C5 blanc et E3 prend, E3 blanc et C5 prend ; E5 blanc relie', () => {
    const e5 = seq(start('v06'), 'E5');
    expect(libsOf(e5, 'D5')).toEqual(['C5']);
    expect(libsOf(e5, 'E4')).toEqual(['E3']);
    expect(seq(e5, 'C5', 'E3').board[at('E4')]).toBe(0);
    expect(seq(e5, 'E3', 'C5').board[at('D5')]).toBe(0);
    expect(chaine(seq(start('v06'), 'passe', 'E5'), 'D5')).toEqual(['D5', 'E4', 'E5']);
  });

  it('v07 : E4, F3, F2, G3, H3, G2, H2, G1, puis F1 prend grâce à H1 ; E4 blanc s’échappe', () => {
    expect(prises('v07', 4, 'E4', 'F3')).toEqual(['F2']);
    expect(prises('v07', 3, 'E4', 'F3', 'F2', 'G3')).toContain('H3');
    expect(prises('v07', 2, 'E4', 'F3', 'F2', 'G3', 'H3', 'G2')).toContain('H2');
    const fin = seq(start('v07'), 'E4', 'F3', 'F2', 'G3', 'H3', 'G2', 'H2', 'G1');
    expect(libsOf(fin, 'F4')).toEqual(['F1']);
    expect(seq(fin, 'F1').board[at('F4')]).toBe(0);
    expect(prend('v07', 5, 'passe', 'E4')).toBe(false);
  });

  it('v08 : après le filet E5, D5 appelle D6 et E4 appelle E3, un atari chaque fois ; E4 blanc s’échappe', () => {
    const e5 = seq(start('v08'), 'E5');
    expect(libsOf(e5, 'D4')).toEqual(['D5', 'E4']);
    expect(prises('v08', 2, 'E5', 'D5')).toEqual(['D6']);
    expect(libsOf(seq(e5, 'D5', 'D6'), 'D4')).toEqual(['E4']);
    expect(prises('v08', 2, 'E5', 'E4')).toEqual(['E3']);
    expect(libsOf(seq(e5, 'E4', 'E3'), 'D4')).toEqual(['D5']);
    expect(prend('v08', 3, 'passe', 'E4')).toBe(false);
    expect(prend('v08', 2, 'E4', 'D5')).toBe(false);
  });

  it('v09 : D1 donne une pierre ; D2 blanc la prend et laisse trois pierres avec la seule liberté D1 ; D1 blanc relie', () => {
    const d1 = seq(start('v09'), 'D1');
    expect(libsOf(d1, 'D1')).toEqual(['D2']);
    const d2 = seq(d1, 'D2');
    expect(d2.board[at('D1')]).toBe(0);
    expect(chaine(d2, 'E1')).toEqual(['D2', 'E1', 'E2']);
    expect(libsOf(d2, 'E1')).toEqual(['D1']);
    const repris = seq(d2, 'D1');
    expect(repris.ko).toBe(-1);
    for (const l of ['D2', 'E1', 'E2']) expect(repris.board[at(l)]).toBe(0);
    expect(chaine(seq(start('v09'), 'passe', 'D1'), 'E1')).toEqual(expect.arrayContaining(['B1', 'C1', 'D1']));
  });

  it('v10 : C3 laisse C5-C4 avec B4 et D3 avec E3 ; C3 blanc relie tout', () => {
    const c3 = seq(start('v10'), 'C3');
    expect(libsOf(c3, 'C5')).toEqual(['B4']);
    expect(libsOf(c3, 'D3')).toEqual(['E3']);
    expect(chaine(seq(start('v10'), 'passe', 'C3'), 'C5')).toEqual(['C3', 'C4', 'C5', 'D3']);
  });

  it('v11 : après le filet F4, E4 appelle E5 et F3 appelle G3, un atari chaque fois ; F3 blanc s’échappe', () => {
    expect(prises('v11', 2, 'F4', 'E4')).toEqual(['E5']);
    expect(libsOf(seq(start('v11'), 'F4', 'E4', 'E5'), 'E3')).toEqual(['F3']);
    expect(prises('v11', 2, 'F4', 'F3')).toEqual(['G3']);
    expect(libsOf(seq(start('v11'), 'F4', 'F3', 'G3'), 'E3')).toEqual(['E4']);
    expect(prend('v11', 3, 'passe', 'F3')).toBe(false);
  });

  it('v12 : D9 donne une pierre ; D8 blanc la prend et laisse quatre pierres avec la seule liberté D9 ; D9 blanc relie', () => {
    const d8 = seq(start('v12'), 'D9', 'D8');
    expect(chaine(d8, 'E9')).toEqual(['D8', 'E7', 'E8', 'E9']);
    expect(libsOf(d8, 'E9')).toEqual(['D9']);
    const repris = seq(d8, 'D9');
    expect(repris.ko).toBe(-1);
    expect(repris.board[at('E8')]).toBe(0);
    expect(chaine(seq(start('v12'), 'passe', 'D9'), 'E9')).toEqual(expect.arrayContaining(['B9', 'C9', 'D9']));
  });

  it('v13 : trois libertés chacun ; par un bout puis coup pour coup ; C1 au milieu est mise en atari', () => {
    expect(libsOf(start('v13'), 'B2')).toEqual(['B1', 'C1', 'D1']);
    expect(libsOf(start('v13'), 'E2')).toEqual(['E1', 'F1', 'G1']);
    expect(prises('v13', 2, 'D1', 'E1')).toEqual(['B1']);
    expect(prises('v13', 2, 'B1', 'E1')).toEqual(expect.arrayContaining(['D1']));
    expect(prises('v13', 2, 'D1', 'F1')).toEqual(expect.arrayContaining(['B1']));
    expect(libsOf(seq(start('v13'), 'C1', 'D1'), 'C1')).toEqual(['B1']);
    expect(libsOf(seq(start('v13'), 'C1', 'B1'), 'C1')).toEqual(['D1']);
    expect(prend('v13', 3, 'passe', 'F1')).toBe(false);
  });

  it('v14 : C2 relie tout, A1 et C1 sont deux vrais yeux ; C2 blanc coupe et tue', () => {
    const c2 = seq(start('v14'), 'C2');
    expect(chaine(c2, 'A2')).toEqual(expect.arrayContaining(['D1', 'D2', 'E2']));
    expect(vraisYeux(c2, 'A2')).toEqual(['A1', 'C1']);
    expect(hasTwoEyes(c2, at('A2'))).toBe(true);
    const coupe = seq(start('v14'), 'passe', 'C2');
    expect(chaine(coupe, 'A2')).not.toContain('D2');
    expect(evaluer(coupe, at('A2'), ZONE.v14.map(at))).toBe(-1);
  });

  it('v15 : D2 blanc relie tout et fait deux yeux ; D2 noir isole D1 et C1 devient un faux œil', () => {
    const vit = seq(start('v15'), 'passe', 'D2');
    expect(evaluer(vit, at('B1'), ZONE.v15.map(at))).toBe(1);
    const d2 = seq(start('v15'), 'D2');
    expect(chaine(d2, 'D1')).toEqual(['D1']);
    expect(yeuxDuGroupe(d2, at('B1')).find(y => label(y.point) === 'C1')?.vrai).not.toBe(true);
    expect(gagnants('v15', 'D2')).toEqual([]);
  });

  it('v16 : A3 blanc fait deux yeux, A2 et B1 ; A3 noir en laisse un ; A2 tout de suite est prise en A3', () => {
    expect(vraisYeux(seq(start('v16'), 'passe', 'A3'), 'B2')).toEqual(['A2', 'B1']);
    expect(gagnants('v16', 'A3')).toEqual([]);
    const a2 = seq(start('v16'), 'A2', 'A3');
    expect(a2.board[at('A2')]).toBe(0);
    expect(evaluer(a2, at('B3'), ZONE.v16.map(at))).toBe(1);
  });
});
