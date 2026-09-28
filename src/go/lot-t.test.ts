// Issue #136, lot T : preuve de chaque problème difficile (1100 à 1500) avec le moteur de règles.
// Deux familles, prouvées comme les lots qui leur servent de modèle :
// - tesuji de capture (comme le lot S) : lecteur exact du lot N (src/go/lecteurs-lot-n.ts), tous les coups légaux et
//   la passe, une fois avec le ko permis et une fois avec toute prise en ko interdite ; le résultat doit être le même.
//   Le coup gagne s'il prend une pierre marquée (T) dans le nombre de coups annoncé, contre toute défense ;
// - vie et mort (comme les lots Q et R) : outil src/go/preuve-vie-mort.ts, recherche complète dans la zone du
//   problème, les deux camps pouvant passer. Vivant : deux vrais yeux au sens de Benson, ou plus aucun coup légal pour
//   l'attaquant. Mort : capturé. Un ko, une répétition, une double passe ou la profondeur atteinte comptent comme
//   « non résolu » : jamais une preuve.
// Les coups gagnants sont exactement les réponses acceptées (un test par coup, preuve-par-coup.ts), chaque erreur
// (et la passe) échoue franchement et la réplique citée par la réfutation suffit, aucun doublon aux 8 symétries,
// suites des explications rejouées, calendrier du Go du jour (le lot T suit le lot S), migration identique au fichier.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LOT_T from '../content/lots/t-difficiles';
import { ALL_PUZZLES, CALENDRIER_GO_DU_JOUR } from '../content/puzzles';
import { THEME_DU_PROBLEME } from '../content/themes';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { AVEC_KO, SANS_KO, attackerCaptures, captureEn, defenderFails, legal } from './lecteurs-lot-n';
import { cederLaMain, preuveParCoup } from './preuve-par-coup';
import { coupsGagnants, defautsDeZone, evaluer, issueApres, yeuxDuGroupe, type Issue } from './preuve-vie-mort';
import { groupAt, neighbors, play, type Position } from './rules';

// Recette du 28/09 (#195) : longues preuves synchrones, voir cederLaMain (preuve-par-coup.ts).
beforeEach(cederLaMain);

const all = parsePuzzles(LOT_T);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const label = (m: number) => (m < 0 ? 'passe' : toLabel(m, 9));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const seq = (pos: Position, ...moves: string[]) => moves.reduce((q, m) => ok(play(q, m === 'passe' ? -1 : at(m))), pos);
const libsOf = (pos: Position, l: string) => [...groupAt(pos.board, 9, at(l)).liberties].map(label).sort();
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;

/** Zone commune des problèmes de vie et mort : le coin A1-F2 et A3-D3, fermé par un mur de l'attaquant. */
const COIN = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'A3', 'B3', 'C3', 'D3'];

type Genre = { genre: 'capture'; coups: number } | { genre: 'vie-mort'; but: 'vivre' | 'tuer'; vise: Issue };

const NOMBRES: Record<string, number> = { deux: 2, trois: 3, quatre: 4, cinq: 5 };
/** Genre du problème, d'après son énoncé. */
function genreOf(p: Puzzle): Genre {
  const m = /^Capture (la pierre marquée|les pierres marquées) en (deux|trois|quatre|cinq) coups au plus\.$/.exec(p.prompt);
  if (m) return { genre: 'capture', coups: NOMBRES[m[2]] };
  if (p.prompt.startsWith('Noir joue et vit.')) return { genre: 'vie-mort', but: 'vivre', vise: 1 };
  if (p.prompt.startsWith('Noir joue et tue.')) return { genre: 'vie-mort', but: 'tuer', vise: -1 };
  throw new Error(`énoncé inconnu : ${p.id}`);
}

/** Genre et thème de pratique attendus (src/content/themes.ts). */
const ATTENDU: Record<string, { genre: string; theme: string }> = {
  t01: { genre: 'capture', theme: 'filet' },
  t02: { genre: 'vivre', theme: 'vie-mort' },
  t03: { genre: 'vivre', theme: 'vie-mort' },
  t04: { genre: 'tuer', theme: 'vie-mort' },
  t05: { genre: 'tuer', theme: 'vie-mort' },
  t06: { genre: 'tuer', theme: 'vie-mort' },
};

/** Réplique de Blanc annoncée par la réfutation après une erreur de Noir (`sauf` : réplique → erreurs concernées). */
const REPLY: Record<string, { defaut: string; sauf?: Record<string, string[]> }> = {
  t01: { defaut: 'B2' },
  t02: { defaut: 'E1' },
  t03: { defaut: 'B1' },
  t04: { defaut: 'E2' },
  t05: { defaut: 'A2' },
  t06: { defaut: 'C1' },
};

function vieMort(p: Puzzle) {
  const g = genreOf(p);
  if (g.genre !== 'vie-mort') throw new Error(`${p.id} n'est pas un problème de vie et mort`);
  const { pos, marked } = startOf(p);
  return { pos, cible: marked[0], zone: COIN.map(at), ...g };
}

/** Le coup noir `m` atteint-il le but ? Capture : `o`, ko permis ou interdit. */
function gagne(p: Puzzle, m: number, o = AVEC_KO): boolean {
  const g = genreOf(p), { pos, marked } = startOf(p);
  if (g.genre === 'capture') return captureEn(pos, m, marked, g.coups, o);
  const { cible, zone, vise } = vieMort(p);
  return issueApres(pos, m, cible, zone) === vise;
}

const vm = all.filter(p => genreOf(p).genre === 'vie-mort');
const cap = all.filter(p => genreOf(p).genre === 'capture');

describe('lot T : identifiants, thèmes, doublons, calendrier, migration (issue #136)', () => {
  it('t01, t02… sans trou, tous en 9 × 9, Noir au trait, difficulté croissante de 1100 à 1500, genres mêlés', () => {
    expect(all).toHaveLength(LOT_T.length);
    expect(LOT_T.length).toBeGreaterThanOrEqual(6);
    expect(LOT_T.length).toBeLessThanOrEqual(8);
    expect(LOT_T.map(r => r.id)).toEqual(LOT_T.map((_, i) => `t${String(i + 1).padStart(2, '0')}`));
    expect(Object.keys(REPLY).sort()).toEqual(all.map(p => p.id));
    expect(Object.keys(ATTENDU).sort()).toEqual(all.map(p => p.id));
    let prev = 0;
    for (const p of all) {
      expect(p.size).toBe(9);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toBeTruthy();
      expect(p.explanation, p.id).toBeTruthy();
      expect(p.difficulty).toBeGreaterThan(prev);
      expect(p.difficulty).toBeGreaterThanOrEqual(1100);
      expect(p.difficulty).toBeLessThanOrEqual(1500);
      prev = p.difficulty;
      const g = genreOf(p);
      expect(g.genre === 'capture' ? 'capture' : g.but, p.id).toBe(ATTENDU[p.id].genre);
    }
    const genres = all.map(p => ATTENDU[p.id].genre);
    for (const g of ['capture', 'vivre', 'tuer']) expect(genres).toContain(g);
  });

  it('chaque problème a son thème de pratique', () => {
    for (const p of all) expect(THEME_DU_PROBLEME[p.id], p.id).toBe(ATTENDU[p.id].theme);
  });

  it('le Go du jour garde son ordre : le lot T, d’un seul tenant, vient juste après le lot S et ferme le calendrier', () => {
    const ids = LOT_T.map(r => r.id);
    expect(CALENDRIER_GO_DU_JOUR.slice(-ids.length)).toEqual(ids);
    expect(CALENDRIER_GO_DU_JOUR.indexOf('t01')).toBe(CALENDRIER_GO_DU_JOUR.indexOf('s06') + 1);
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées) déjà utilisés', () => {
    const others = ALL_PUZZLES.filter(r => !/^t\d\d$/.test(r.id));
    expect(others.length).toBeGreaterThanOrEqual(177);
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.filter(r => r.size === 9).map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_T) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260929010100_lot_t.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('t\d\d', null, 9,/g)).toHaveLength(LOT_T.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_T) {
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });

  it('textes : « Blanc joue X » et jamais « prend ta pierre en X » (#282)', () => {
    for (const p of all) for (const t of [p.prompt, p.explanation, p.refutation]) expect(t, p.id).not.toMatch(/prend ta pierre en/);
  });
});

describe('lot T : départ légal et problème réel', () => {
  for (const p of all) {
    it(`${p.id} : chaque chaîne a deux libertés au moins, pas de ko, réponses légales`, () => {
      const { pos, marked } = startOf(p);
      expect(pos.ko).toBe(-1);
      expect(marked.length).toBeGreaterThan(0);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(groupAt(pos.board, 9, q).liberties.size, `${p.id} ${label(q)}`).toBeGreaterThanOrEqual(2);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
    });
  }

  for (const p of cap) {
    it(`${p.id} : cibles blanches d'une seule chaîne, pas de prise plus rapide`, () => {
      const { pos, marked } = startOf(p), g = genreOf(p);
      if (g.genre !== 'capture') throw new Error(p.id);
      for (const t of marked) expect(pos.board[t], p.id).toBe(2);
      expect(groupAt(pos.board, 9, marked[0]).stones.length, p.id).toBe(marked.length);
      // Il faut bien k coups : aucune prise en k - 1 coups.
      for (let m = 0; m < 81; m++) expect(captureEn(pos, m, marked, g.coups - 1), `${p.id} ${label(m)}`).toBe(false);
    });
  }

  for (const p of vm) {
    it(`${p.id} : un seul groupe marqué, du bon camp, zone fermée, réponses dans la zone`, () => {
      const { pos, cible, zone, but } = vieMort(p);
      expect(startOf(p).marked, p.id).toHaveLength(1);
      expect(pos.board[cible], p.id).toBe(but === 'vivre' ? 1 : 2);
      expect(defautsDeZone(pos, cible, zone), p.id).toEqual([]);
      // Aucun point vide de la zone ne touche un point vide hors de la zone : une pierre jouée dans la zone n'y gagne
      // jamais une liberté que l'adversaire ne pourrait pas remplir.
      const nb = neighbors(9);
      for (const z of zone) for (const r of nb[z]) if (pos.board[r] === 0) expect(zone, `${p.id} ${label(z)}-${label(r)}`).toContain(r);
      for (const a of p.answers) expect(zone, `${p.id} ${label(a)}`).toContain(a);
    });
  }
});

describe('lot T : les coups gagnants sont exactement les réponses acceptées', () => {
  for (const p of all) {
    const { pos } = startOf(p), capture = genreOf(p).genre === 'capture';
    preuveParCoup(p.id, pos, p.answers, m => {
      const r = gagne(p, m);
      if (capture) expect(gagne(p, m, SANS_KO), `${p.id} ${label(m)} sans ko`).toBe(r);
      return r;
    });
  }
});

// Un test par erreur (comme preuveParCoup) : un seul bloc synchrone risquerait « Timeout calling onTaskUpdate ».
describe('lot T : chaque erreur échoue franchement, et la réfutation dit vrai', () => {
  for (const p of all) {
    const { pos, marked } = startOf(p), g = genreOf(p), spec = REPLY[p.id];
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
          if (g.genre === 'capture') {
            const puni = ok(play(apres, at(r)));
            for (const o of [AVEC_KO, SANS_KO]) expect(attackerCaptures(puni, marked, g.coups - 1, o), `${p.id} ${label(m)} puis ${r}`).toBe(false);
          } else {
            const { cible, zone, vise } = vieMort(p);
            expect(issueApres(pos, m, cible, zone), `${p.id} ${label(m)}`).toBe(-vise);
            expect(issueApres(apres, at(r), cible, zone), `${p.id} ${label(m)} puis ${r}`).toBe(-vise);
          }
        }, 120_000);
      }
    });
  }
});

describe('lot T : les suites des explications et des réfutations', () => {
  const start = (id: string) => startOf(pz(id)).pos;
  const pris = (pos: Position, l: string) => pos.board[at(l)] === 0;
  const yeux = (pos: Position, l: string) => yeuxDuGroupe(pos, at(l)).map(y => [label(y.point), y.vrai]);
  /** Blanc au trait : Noir prend-il encore les pierres marquées de t01 en `n` coups, quoi que Blanc joue ? */
  const prendEncore = (pos: Position, n: number) => defenderFails(pos, startOf(pz('t01')).marked, n);
  /** Coups gagnants de Noir (zone et passe) dans un problème de vie et mort, après une suite de coups. */
  const gagnants = (id: string, ...moves: string[]) => {
    const { pos, cible, zone, but } = vieMort(pz(id));
    return coupsGagnants(seq(pos, ...moves), cible, zone, but).map(label);
  };
  /** Issue (du point de vue du groupe marqué), le camp au trait jouant le premier. */
  const issue = (id: string, ...moves: string[]) => {
    const { pos, cible, zone } = vieMort(pz(id));
    return evaluer(seq(pos, ...moves), cible, zone);
  };

  it('t01 : trois libertés ; après B2, B4 puis C4 ou B3 puis C3, et Noir prend au quatrième coup ; B2 blanc s’échappe', () => {
    expect(libsOf(start('t01'), 'A4')).toEqual(['A2', 'B3', 'B4']);
    const b4 = seq(start('t01'), 'B2', 'B4', 'C4');
    expect(libsOf(b4, 'A4')).toEqual(['A2', 'B3']);
    expect(prendEncore(b4, 2)).toBe(true);
    const b3 = seq(start('t01'), 'B2', 'B3', 'C3');
    expect(libsOf(b3, 'A4')).toEqual(['A2', 'B4']);
    expect(prendEncore(b3, 2)).toBe(true);
    // Une suite complète : B2, B4, C4, B3, C3, A2, A1.
    const fin = seq(start('t01'), 'B2', 'B4', 'C4', 'B3', 'C3', 'A2', 'A1');
    expect(pris(fin, 'A4')).toBe(true);
    // B2 blanc : Noir ne prend plus en quatre coups, même en jouant le premier ensuite.
    expect(attackerCaptures(seq(start('t01'), 'passe', 'B2'), startOf(pz('t01')).marked, 4)).toBe(false);
  });

  it('t02 : E1 met D1 en atari ; après F1, C1 prend D1 et Noir vit ; E1 blanc relie D1', () => {
    const e1 = seq(start('t02'), 'E1');
    expect(libsOf(e1, 'D1')).toEqual(['C1']);
    const f1 = seq(e1, 'F1');
    expect(gagnants('t02', 'E1', 'F1')).toContain('C1');
    expect(pris(seq(f1, 'C1'), 'D1')).toBe(true);
    expect(issue('t02', 'E1', 'F1', 'C1')).toBe(1);
    const relie = seq(start('t02'), 'passe', 'E1');
    expect(groupAt(relie.board, 9, at('D1')).stones.map(label)).toContain('E1');
  });

  it('t03 : B1 fait de A1 un vrai œil ; C2 appelle C3 (atari), C3 appelle C2 ; B1 blanc ôte l’œil A1', () => {
    expect(yeux(seq(start('t03'), 'B1'), 'A2')).toContainEqual(['A1', true]);
    expect(gagnants('t03', 'B1', 'C2')).toEqual(['C3']);
    expect(libsOf(seq(start('t03'), 'B1', 'C2', 'C3'), 'C2')).toEqual(['D1']);
    expect(gagnants('t03', 'B1', 'C3')).toEqual(['C2']);
    expect(yeux(seq(start('t03'), 'passe', 'B1'), 'A2').map(y => y[0])).not.toContain('A1');
  });

  it('t04 : E2 met F1-F2 en atari ; après E1, B1 est le seul œil ; E2 blanc fait deux yeux, B1 et E1', () => {
    const e2 = seq(start('t04'), 'E2');
    expect(libsOf(e2, 'F1')).toEqual(['E1']);
    const relie = seq(e2, 'E1');
    expect(groupAt(relie.board, 9, at('A1')).stones.map(label)).toContain('F1');
    expect(yeux(relie, 'A1')).toEqual([['B1', true]]);
    expect(issue('t04', 'E2', 'E1')).toBe(-1);
    const vit = seq(start('t04'), 'passe', 'E2');
    expect(yeux(vit, 'A1')).toEqual(expect.arrayContaining([['B1', true], ['E1', true]]));
  });

  it('t05 : A2 empêche l’œil A1 ; après A1, A3 relie et Blanc meurt ; A2 blanc fait de A1 un œil', () => {
    const a2 = seq(start('t05'), 'A2');
    expect(yeux(a2, 'B1').map(y => y[0])).not.toContain('A1');
    const a1 = seq(a2, 'A1');
    expect(libsOf(a1, 'A2')).toEqual(['A3']);
    expect(gagnants('t05', 'A2', 'A1')).toEqual(['A3']);
    expect(groupAt(seq(a1, 'A3').board, 9, at('A2')).stones.map(label)).toContain('B3');
    expect(issue('t05', 'A2', 'A1', 'A3')).toBe(-1);
    expect(yeux(seq(start('t05'), 'passe', 'A2'), 'B1')).toContainEqual(['A1', true]);
  });

  it('t06 : après C1, D1 appelle E2 et E2 appelle D1, un seul coup chaque fois', () => {
    expect(gagnants('t06', 'C1', 'D1')).toEqual(['E2']);
    expect(gagnants('t06', 'C1', 'E2')).toEqual(['D1']);
  });
});
