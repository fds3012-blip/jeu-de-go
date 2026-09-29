// Issue #136, lot U : preuve de chaque problème (relier, couper, vie et mort de haut de courbe) avec le moteur de règles.
// Deux familles, prouvées comme les lots qui leur servent de modèle :
// - zone fermée (comme les lots Q, R et T) : outil src/go/preuve-vie-mort.ts, recherche complète dans la zone du
//   problème, les deux camps pouvant passer. Vivant : deux vrais yeux au sens de Benson, ou plus aucun coup légal pour
//   l'attaquant. Mort : capturé. Un ko, une répétition, une double passe ou la profondeur atteinte comptent comme
//   « non résolu » : jamais une preuve.
//   · relier : deux pierres noires marquées, sur deux groupes ; l'un vit déjà sans condition (Benson), l'autre non.
//     Le coup gagne si ce second groupe finit vivant (il ne peut l'être qu'en se reliant : la zone est trop petite
//     pour lui seul) contre toute défense ;
//   · couper : la même chose en blanc ; le coup gagne si le groupe blanc qui ne vit pas seul finit capturé ;
//   · vivre, tuer : un seul groupe marqué, comme les lots Q, R et T ;
// - capture (comme les lots S et T) : lecteur exact du lot N (src/go/lecteurs-lot-n.ts), tous les coups légaux et la
//   passe, avec le ko permis puis avec toute prise en ko interdite ; le résultat doit être le même.
// Les coups gagnants sont exactement les réponses acceptées (un test par coup, preuve-par-coup.ts), chaque erreur
// (et la passe) échoue franchement et la réplique citée par la réfutation suffit, aucun doublon aux 8 symétries,
// suites des explications rejouées, calendrier du Go du jour (le lot U suit le lot T), migration identique au fichier.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_U from '../content/lots/u-relier-vie-mort';
import { ALL_PUZZLES, CALENDRIER_GO_DU_JOUR } from '../content/puzzles';
import { THEME_DU_PROBLEME } from '../content/themes';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { AVEC_KO, SANS_KO, attackerCaptures, captureEn, defenderFails, legal } from './lecteurs-lot-n';
import { cederLaMain, preuveParCoup } from './preuve-par-coup';
import { coupsGagnants, defautsDeZone, evaluer, issueApres, yeuxDuGroupe, type Issue } from './preuve-vie-mort';
import { groupAt, neighbors, play, type Position } from './rules';
import { hasTwoEyes } from './tactics';

// Recette du 28/09 (#195) : longues preuves synchrones, voir cederLaMain (preuve-par-coup.ts).
beforeEach(cederLaMain);

const all = parsePuzzles(LOT_U);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const label = (m: number) => (m < 0 ? 'passe' : toLabel(m, 9));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const seq = (pos: Position, ...moves: string[]) => moves.reduce((q, m) => ok(play(q, m === 'passe' ? -1 : at(m))), pos);
const libsOf = (pos: Position, l: string) => [...groupAt(pos.board, 9, at(l)).liberties].map(label).sort();
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;
const chaine = (pos: Position, l: string) => groupAt(pos.board, 9, at(l)).stones.map(label);

type Genre = 'relier' | 'couper' | 'vivre' | 'tuer' | 'capture';

/** Genre, thème de pratique et, pour la capture, nombre de coups annoncé. */
const ATTENDU: Record<string, { genre: Genre; theme: string; coups?: number }> = {
  u01: { genre: 'couper', theme: 'relier-couper' },
  u02: { genre: 'relier', theme: 'relier-couper' },
  u03: { genre: 'capture', theme: 'relier-couper', coups: 3 },
  u04: { genre: 'couper', theme: 'relier-couper' },
  u05: { genre: 'couper', theme: 'relier-couper' },
  u06: { genre: 'relier', theme: 'relier-couper' },
  u07: { genre: 'relier', theme: 'relier-couper' },
  u08: { genre: 'tuer', theme: 'vie-mort' },
  u09: { genre: 'tuer', theme: 'vie-mort' },
  u10: { genre: 'tuer', theme: 'vie-mort' },
  u11: { genre: 'tuer', theme: 'vie-mort' },
  u12: { genre: 'vivre', theme: 'vie-mort' },
  u13: { genre: 'vivre', theme: 'vie-mort' },
  u14: { genre: 'tuer', theme: 'vie-mort' },
  u15: { genre: 'vivre', theme: 'vie-mort' },
};

/** Début d'énoncé attendu pour chaque genre : l'énoncé dit ce qu'il faut faire. */
const ENONCE: Record<Genre, RegExp> = {
  relier: /^Relie /,
  couper: /^Coupe /,
  vivre: /^Noir joue et vit\. /,
  tuer: /^Noir joue et tue\. /,
  capture: /^Capture la pierre marquée en trois coups au plus\.$/,
};

/**
 * Zone de chaque problème en zone fermée : les points vides que la recherche peut jouer. C'est exactement l'espace
 * vide relié à la cible sans traverser une pierre de l'attaquant (vérifié plus bas).
 */
const ZONE: Record<string, string[]> = {
  u01: ['F3', 'G3', 'A2', 'C2', 'E1', 'G1'],
  u02: ['A2', 'C2', 'E2', 'F2', 'E1', 'F1', 'G1'],
  u04: ['E9', 'F9', 'A8', 'C8', 'E8', 'F7', 'G7'],
  u05: ['E3', 'G3', 'A2', 'C2', 'F2', 'F1', 'G1'],
  u06: ['D3', 'D2', 'G2', 'J2', 'D1', 'E1'],
  u07: ['F3', 'A2', 'C2', 'E2', 'F2', 'G2', 'E1', 'F1'],
  u08: ['C2', 'D2', 'F2', 'B1', 'E1', 'F1'],
  u09: ['G3', 'J3', 'D2', 'F2', 'H2', 'D1', 'G1'],
  u10: ['D9', 'E9', 'H9', 'E8', 'H8', 'J8', 'G7'],
  u11: ['G9', 'G8', 'J7', 'H6', 'J6', 'G5', 'J4'],
  u12: ['A3', 'D3', 'A2', 'B2', 'C2', 'D2', 'F2', 'B1', 'F1'],
  u13: ['A3', 'B3', 'C2', 'D2', 'F2', 'B1', 'C1', 'E1', 'F1'],
  u14: ['C9', 'A8', 'D8', 'E8', 'F8', 'A7', 'E7'],
  u15: ['D3', 'E3', 'A2', 'B2', 'C2', 'D2', 'E2', 'C1', 'D1'],
};

/** Réplique de Blanc annoncée par la réfutation après une erreur de Noir (`sauf` : réplique → erreurs concernées). */
const REPLY: Record<string, { defaut: string; sauf?: Record<string, string[]> }> = {
  u01: { defaut: 'E1' },
  u02: { defaut: 'F2' },
  u03: { defaut: 'C4' },
  u04: { defaut: 'E8' },
  u05: { defaut: 'F2' },
  u06: { defaut: 'E1' },
  u07: { defaut: 'G2' },
  u08: { defaut: 'D2' },
  u09: { defaut: 'H2' },
  u10: { defaut: 'H8' },
  u11: { defaut: 'J6' },
  u12: { defaut: 'B2' },
  u13: { defaut: 'C2' },
  u14: { defaut: 'E8' },
  u15: { defaut: 'D2', sauf: { D1: ['C2'], C2: ['D1'] } },
};

const genreOf = (p: Puzzle) => ATTENDU[p.id].genre;
const zoneFermee = (p: Puzzle) => genreOf(p) !== 'capture';

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

/** Problème en zone fermée : cible (le groupe marqué qui ne vit pas encore sans condition), zone, issue visée. */
function probleme(p: Puzzle) {
  const g = genreOf(p);
  if (g === 'capture') throw new Error(`${p.id} n'est pas en zone fermée`);
  const { pos, marked } = startOf(p);
  const faibles = marked.filter(m => !hasTwoEyes(pos, m));
  const vise: Issue = g === 'relier' || g === 'vivre' ? 1 : -1;
  return { pos, marked, cible: faibles[0], faibles, zone: ZONE[p.id].map(at), vise, genre: g };
}

/** Le coup noir `m` atteint-il le but ? Capture : `o`, ko permis ou interdit. */
function gagne(p: Puzzle, m: number, o = AVEC_KO): boolean {
  const { pos, marked } = startOf(p);
  if (genreOf(p) === 'capture') return captureEn(pos, m, marked, ATTENDU[p.id].coups!, o);
  const { cible, zone, vise } = probleme(p);
  return issueApres(pos, m, cible, zone) === vise;
}

describe('lot U : identifiants, énoncés, thèmes, doublons, calendrier, migration (issue #136)', () => {
  it('u01, u02… sans trou, tous en 9 × 9, Noir au trait, difficulté croissante de 800 à 1500, genres mêlés', () => {
    expect(all).toHaveLength(LOT_U.length);
    expect(LOT_U.length).toBeGreaterThanOrEqual(12);
    expect(LOT_U.length).toBeLessThanOrEqual(20);
    expect(LOT_U.map(r => r.id)).toEqual(LOT_U.map((_, i) => `u${String(i + 1).padStart(2, '0')}`));
    for (const table of [ATTENDU, REPLY]) expect(Object.keys(table).sort()).toEqual(all.map(p => p.id));
    expect(Object.keys(ZONE).sort()).toEqual(all.filter(zoneFermee).map(p => p.id));
    let prev = 0;
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toMatch(/^Pas tout à fait\. /);
      expect(p.explanation, p.id).toBeTruthy();
      expect(p.difficulty).toBeGreaterThan(prev);
      expect(p.difficulty).toBeGreaterThanOrEqual(800);
      expect(p.difficulty).toBeLessThanOrEqual(1500);
      prev = p.difficulty;
      expect(p.prompt, p.id).toMatch(ENONCE[genreOf(p)]);
    }
    const genres = all.map(genreOf);
    for (const g of ['relier', 'couper', 'vivre', 'tuer', 'capture'] as Genre[]) expect(genres).toContain(g);
    // Relier et couper d'abord (jusqu'à 1050), puis la vie et la mort de haut de courbe.
    for (const p of all) expect(ATTENDU[p.id].theme === 'relier-couper', p.id).toBe(p.difficulty <= 1050);
  });

  it('chaque problème a son thème de pratique', () => {
    for (const p of all) expect(THEME_DU_PROBLEME[p.id], p.id).toBe(ATTENDU[p.id].theme);
  });

  it('le Go du jour garde son ordre : le lot U, d’un seul tenant, vient juste après le lot T et ferme le calendrier', () => {
    const ids = LOT_U.map(r => r.id);
    expect(CALENDRIER_GO_DU_JOUR.slice(-ids.length)).toEqual(ids);
    expect(CALENDRIER_GO_DU_JOUR.indexOf('u01')).toBe(CALENDRIER_GO_DU_JOUR.indexOf('t06') + 1);
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées) déjà utilisés', () => {
    const others = ALL_PUZZLES.filter(r => !/^u\d\d$/.test(r.id));
    expect(others.length).toBeGreaterThanOrEqual(183);
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_U) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260929234100_lot_u.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('u\d\d', null, 9,/g)).toHaveLength(LOT_U.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_U) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });

  it('textes : « Blanc joue X » et jamais « prend ta pierre en X » (#282)', () => {
    for (const p of all) for (const t of [p.prompt, p.explanation, p.refutation]) expect(t, p.id).not.toMatch(/prend ta pierre en/);
  });
});

describe('lot U : départ légal et problème réel', () => {
  for (const p of all) {
    it(`${p.id} : chaque chaîne a deux libertés au moins, pas de ko, réponses légales`, () => {
      const { pos, marked } = startOf(p);
      expect(pos.ko).toBe(-1);
      expect(marked.length).toBeGreaterThan(0);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(groupAt(pos.board, 9, q).liberties.size, `${p.id} ${label(q)}`).toBeGreaterThanOrEqual(2);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
    });
  }

  for (const p of all.filter(q => !zoneFermee(q))) {
    it(`${p.id} : cible blanche d'une seule chaîne, pas de prise plus rapide`, () => {
      const { pos, marked } = startOf(p), k = ATTENDU[p.id].coups!;
      for (const t of marked) expect(pos.board[t], p.id).toBe(2);
      expect(groupAt(pos.board, 9, marked[0]).stones.length, p.id).toBe(marked.length);
      for (let m = 0; m < 81; m++) expect(captureEn(pos, m, marked, k - 1), `${p.id} ${label(m)}`).toBe(false);
    });
  }

  for (const p of all.filter(zoneFermee)) {
    it(`${p.id} : groupes marqués du bon camp, zone fermée et naturelle, réponses dans la zone`, () => {
      const { pos, marked, cible, faibles, zone, genre } = probleme(p);
      const camp = genre === 'relier' || genre === 'vivre' ? 1 : 2;
      for (const m of marked) expect(pos.board[m], `${p.id} ${label(m)}`).toBe(camp);
      // Un seul groupe à sauver ou à prendre ; relier et couper : un second groupe marqué, déjà vivant sans condition.
      expect(faibles, p.id).toHaveLength(1);
      if (genre === 'relier' || genre === 'couper') {
        expect(marked, p.id).toHaveLength(2);
        const vivant = marked.find(m => m !== cible)!;
        expect(hasTwoEyes(pos, vivant), p.id).toBe(true);
        expect(groupAt(pos.board, 9, vivant).stones, p.id).not.toContain(cible);
      } else expect(marked, p.id).toHaveLength(1);
      expect(defautsDeZone(pos, cible, zone), p.id).toEqual([]);
      expect(zone.map(label).sort(), p.id).toEqual(espaceDe(pos, cible).map(label).sort());
      // Aucun point vide de la zone ne touche un point vide hors de la zone : une pierre jouée dans la zone n'y gagne
      // jamais une liberté que l'adversaire ne pourrait pas remplir.
      const nb = neighbors(9);
      for (const z of zone) for (const r of nb[z]) if (pos.board[r] === 0) expect(zone, `${p.id} ${label(z)}-${label(r)}`).toContain(r);
      for (const a of p.answers) expect(zone, `${p.id} ${label(a)}`).toContain(a);
    });
  }
});

describe('lot U : les coups gagnants sont exactement les réponses acceptées', () => {
  for (const p of all) {
    const { pos } = startOf(p), capture = !zoneFermee(p);
    preuveParCoup(p.id, pos, p.answers, m => {
      const r = gagne(p, m);
      if (capture) expect(gagne(p, m, SANS_KO), `${p.id} ${label(m)} sans ko`).toBe(r);
      return r;
    });
  }
});

// Un test par erreur (comme preuveParCoup) : un seul bloc synchrone risquerait « Timeout calling onTaskUpdate ».
describe('lot U : chaque erreur échoue franchement, et la réfutation dit vrai', () => {
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
          if (!zoneFermee(p)) {
            const k = ATTENDU[p.id].coups!, puni = ok(play(apres, at(r)));
            for (const o of [AVEC_KO, SANS_KO]) expect(attackerCaptures(puni, marked, k - 1, o), `${p.id} ${label(m)} puis ${r}`).toBe(false);
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

describe('lot U : les suites des explications et des réfutations', () => {
  const start = (id: string) => startOf(pz(id)).pos;
  const yeux = (pos: Position, l: string) => yeuxDuGroupe(pos, at(l)).map(y => [label(y.point), y.vrai]);
  const vraisYeux = (pos: Position, l: string) => yeuxDuGroupe(pos, at(l)).filter(y => y.vrai).map(y => label(y.point)).sort();
  /** Coups gagnants de Noir (zone et passe) après une suite de coups. */
  const gagnants = (id: string, ...moves: string[]) => {
    const { pos, cible, zone, genre } = probleme(pz(id));
    const but = genre === 'relier' || genre === 'vivre' ? 'vivre' : 'tuer';
    return coupsGagnants(seq(pos, ...moves), cible, zone, but).map(label);
  };
  /** Issue (du point de vue du groupe marqué qui ne vit pas seul), le camp au trait jouant le premier. */
  const issue = (id: string, ...moves: string[]) => {
    const { pos, cible, zone } = probleme(pz(id));
    return evaluer(seq(pos, ...moves), cible, zone);
  };

  it('u01 : E1 ferme le premier rang ; E1 blanc relie F1 à D1 et tout profite des yeux A2 et C2', () => {
    expect(chaine(seq(start('u01'), 'E1'), 'F1')).not.toContain('D1');
    expect(issue('u01', 'E1')).toBe(-1);
    const relie = seq(start('u01'), 'passe', 'E1');
    expect(chaine(relie, 'D1')).toEqual(expect.arrayContaining(['F1', 'F2', 'G2']));
    expect(vraisYeux(relie, 'B2')).toEqual(['A2', 'C2']);
    expect(hasTwoEyes(relie, at('G2'))).toBe(true);
  });

  it('u02 : F2 rejoint G2 ; E2 blanc est en atari et E1 le prend ; E1 ou F1 blanc, et E2 relie ; F2 blanc met G2 en atari', () => {
    const e2 = seq(start('u02'), 'F2', 'E2');
    expect(libsOf(e2, 'E2')).toEqual(['E1']);
    expect(gagnants('u02', 'F2', 'E2')).toContain('E1');
    expect(seq(e2, 'E1').board[at('E2')]).toBe(0);
    expect(gagnants('u02', 'F2', 'E1')).toContain('E2');
    expect(gagnants('u02', 'F2', 'F1')).toContain('E2');
    expect(hasTwoEyes(seq(start('u02'), 'F2', 'E1', 'E2'), at('G2'))).toBe(true);
    expect(libsOf(seq(start('u02'), 'passe', 'F2'), 'G2')).toEqual(['G1']);
  });

  it('u03 : C4 met C3 en atari du côté de C5 ; B3, puis B4 ; Noir prend au troisième coup ; C4 blanc s’échappe', () => {
    const { marked } = startOf(pz('u03'));
    const c4 = seq(start('u03'), 'C4');
    expect(libsOf(c4, 'C3')).toEqual(['B3']);
    const b4 = seq(c4, 'B3', 'B4');
    expect(libsOf(b4, 'C3')).toEqual(['A3']);
    expect(defenderFails(b4, marked, 1)).toBe(true);
    expect(seq(b4, 'A3', 'A4').board[at('C3')]).toBe(0);
    const fuite = seq(start('u03'), 'passe', 'C4');
    expect(chaine(fuite, 'C3')).toContain('C5');
    expect(attackerCaptures(fuite, marked, 3)).toBe(false);
  });

  it('u04 : E8 coupe ; E9 appelle F9, F9 appelle E9 ; E8 blanc relie F8 et G8 au groupe qui a les yeux A8 et C8', () => {
    expect(gagnants('u04', 'E8', 'E9')).toEqual(['F9']);
    expect(gagnants('u04', 'E8', 'F9')).toEqual(['E9']);
    const relie = seq(start('u04'), 'passe', 'E8');
    expect(chaine(relie, 'D8')).toEqual(expect.arrayContaining(['F8', 'G8']));
    expect(vraisYeux(relie, 'B8')).toEqual(['A8', 'C8']);
  });

  it('u05 : F2 coupe G2 de E2 ; F1 appelle G1, G1 appelle F1 ; F2 blanc relie G2 à E2', () => {
    expect(gagnants('u05', 'F2', 'F1')).toEqual(['G1']);
    expect(gagnants('u05', 'F2', 'G1')).toEqual(['F1']);
    const relie = seq(start('u05'), 'passe', 'F2');
    expect(chaine(relie, 'E2')).toContain('G2');
    expect(vraisYeux(relie, 'B2')).toEqual(['A2', 'C2']);
  });

  it('u06 : E1 touche D1 ; D1 blanc est en atari et D2 le prend ; sinon D1 relie ; E1 blanc laisse la colonne C seule', () => {
    const e1 = seq(start('u06'), 'E1');
    expect(chaine(e1, 'E1')).toContain('F1');
    // Libertés du groupe de droite : ses deux yeux, G2 et J2, et D1.
    expect(libsOf(e1, 'E1')).toEqual(['D1', 'G2', 'J2']);
    expect(libsOf(seq(e1, 'D1'), 'D1')).toEqual(['D2']);
    expect(gagnants('u06', 'E1', 'D1')).toEqual(['D2']);
    expect(gagnants('u06', 'E1', 'D3')).toEqual(['D1']);
    expect(gagnants('u06', 'E1', 'D2')).toEqual(['D1']);
    const ferme = seq(start('u06'), 'passe', 'E1');
    expect(libsOf(ferme, 'C2')).toEqual(['D1', 'D2', 'D3']);
    expect(issue('u06', 'passe', 'E1')).toBe(-1);
  });

  it('u07 : G2 relie G3 et G1 ; F2 appelle F1, F1 appelle F2 ; G2 blanc laisse G3 avec la seule liberté F3', () => {
    expect(chaine(seq(start('u07'), 'G2'), 'G3')).toContain('G1');
    expect(gagnants('u07', 'G2', 'F2')).toEqual(['F1']);
    expect(gagnants('u07', 'G2', 'F1')).toEqual(['F2']);
    expect(libsOf(seq(start('u07'), 'passe', 'G2'), 'G3')).toEqual(['F3']);
  });

  it('u08 : D2 blanc ferait deux yeux, C2 et B1 ; D2 noir touche C2, qui n’est plus un œil', () => {
    expect(vraisYeux(seq(start('u08'), 'passe', 'D2'), 'A1')).toEqual(['B1', 'C2']);
    const d2 = seq(start('u08'), 'D2');
    expect(yeux(d2, 'A1').map(y => y[0])).not.toContain('C2');
    expect(issue('u08', 'D2')).toBe(-1);
  });

  it('u09 : H2 blanc ferait deux yeux, F2 et G1 ; après H2, J3 met le coin en atari, G1 le sauve et il reste un œil', () => {
    expect(vraisYeux(seq(start('u09'), 'passe', 'H2'), 'J1')).toEqual(['F2', 'G1']);
    const j3 = seq(start('u09'), 'H2', 'passe', 'J3');
    expect(libsOf(j3, 'J1')).toEqual(['G1']);
    const g1 = seq(j3, 'G1');
    expect(vraisYeux(g1, 'J1')).toEqual(['F2']);
    expect(evaluer(g1, at('J1'), ZONE.u09.map(at))).toBe(-1);
  });

  it('u10 : H8 blanc ferait deux yeux, J8 et H9 ; H8 noir les touche tous les deux', () => {
    expect(vraisYeux(seq(start('u10'), 'passe', 'H8'), 'J9')).toEqual(['H9', 'J8']);
    const h8 = seq(start('u10'), 'H8');
    for (const l of ['J8', 'H9']) expect(yeux(h8, 'J9').map(y => y[0])).not.toContain(l);
  });

  it('u11 : J6 blanc ferait deux yeux, J7 et H6 ; J6 noir les touche et coupe H5, J5 et H4', () => {
    expect(vraisYeux(seq(start('u11'), 'passe', 'J6'), 'J9')).toEqual(['H6', 'J7']);
    const j6 = seq(start('u11'), 'J6');
    expect(neighbors(9)[at('J6')].map(label).sort()).toEqual(['H6', 'J5', 'J7']);
    expect(chaine(start('u11'), 'H5').sort()).toEqual(['H4', 'H5', 'J5']);
    // J6 blanc relie H5-J5-H4 ; J7 et H6, deux yeux, font le lien avec le reste du groupe.
    expect(chaine(seq(start('u11'), 'passe', 'J6'), 'J6')).toEqual(expect.arrayContaining(['H4', 'H5', 'J5']));
    expect(yeux(j6, 'J9')).toEqual([]);
  });

  it('u12 : après B2, A2 appelle A3 et A3 appelle A2, un seul coup chaque fois ; B2 blanc tue', () => {
    expect(gagnants('u12', 'B2', 'A2')).toEqual(['A3']);
    expect(gagnants('u12', 'B2', 'A3')).toEqual(['A2']);
    expect(issue('u12', 'passe', 'B2')).toBe(-1);
  });

  it('u13 : C2 fait de D2 un œil ; F2 appelle E1, E1 appelle F1 ; C2 blanc prolonge C3', () => {
    expect(yeux(seq(start('u13'), 'C2'), 'A1')).toContainEqual(['D2', true]);
    expect(gagnants('u13', 'C2', 'F2')).toEqual(['E1']);
    expect(gagnants('u13', 'C2', 'E1')).toEqual(['F1']);
    expect(chaine(seq(start('u13'), 'passe', 'C2'), 'C3')).toContain('C2');
  });

  it('u14 : après E8, D8 appelle A7 (il ne reste que l’œil C9) et A7 appelle D8 (atari, C9 à remplir)', () => {
    expect(gagnants('u14', 'E8', 'D8')).toEqual(['A7']);
    expect(vraisYeux(seq(start('u14'), 'E8', 'D8', 'A7'), 'A9')).toEqual(['C9']);
    expect(gagnants('u14', 'E8', 'A7')).toEqual(['D8']);
    expect(libsOf(seq(start('u14'), 'E8', 'A7', 'D8'), 'D9')).toEqual(['C9']);
  });

  it('u15 : après D2, E2 appelle D1 seul ; D1 appelle E2 ou C1 ; C2 puis D1, ou D1 puis C2 : Blanc tue', () => {
    expect(gagnants('u15', 'D2', 'E2')).toEqual(['D1']);
    expect(gagnants('u15', 'D2', 'D1').sort()).toEqual(['C1', 'E2']);
    expect(issue('u15', 'C2', 'D1')).toBe(-1);
    expect(issue('u15', 'D1', 'C2')).toBe(-1);
  });
});
