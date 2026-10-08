// Issue #16, lot X : preuve de chaque problème d'entraînement des leçons 4 (le ko), 6 (territoire et ouverture)
// et 8 (les premiers coups). La leçon 7 (compter) reprend le lot W : ses séries sont vérifiées ici aussi.
//
// Ko (x01 à x03), 9 × 9, règles de src/go (capture, suicide, ko simple), recherche sur tous les coups légaux :
// - x01 : C1 est la seule prise ; elle fait un ko (Blanc ne reprend pas tout de suite en B1, mais le peut après un
//   échange ailleurs) ; après tout autre coup, Blanc relie en C1 et sa pierre a au moins deux libertés ;
// - x02 : E9 est le seul coup (passe comprise) après lequel Blanc ne peut prendre aucune pierre noire ; après tout autre
//   coup, Blanc prend en E9, et c'est un ko ; après E9, le groupe noir a trois libertés ;
// - x03 : F5 est le seul coup après lequel Blanc ne peut pas prendre la pierre marquée ; F5 prend E5 en ko ; s'allonger
//   en E7 est un suicide ; après tout autre coup, Blanc relie en F5 (la réplique montrée) ou prend en E7.
//
// Ouverture (x04 à x08), 13 × 13 : un seul coin est libre (aucune pierre dans son carré de 6 × 6). Les réponses
// acceptées sont exactement ses points 3-3, 3-4, 4-3 et 4-4 (3e et 4e lignes depuis les deux bords). Ce test le
// vérifie toujours. Le moteur de règles ne peut pas juger une ouverture : KataGo le fait, dans le bloc
// « ouverture selon KataGo », lancé à la demande (voir son en-tête) : le meilleur coup de tout le plateau est une
// réponse, chaque réponse en est à moins de TOLERANCE points, et chaque coup sur les deux lignes du bord perd au moins
// MARGE point de plus que la moins bonne réponse.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import LOT_X from '../content/lots/x-ko-ouverture';
import { LESSONS_FR } from '../content/lessons';
import { ALL_PUZZLES, CALENDRIER_GO_DU_JOUR } from '../content/puzzles';
import { memePosition, positionsDeLecon } from '../content/redites';
import { THEME_DU_PROBLEME, THEMES_DE_LECON, serieDeLecon } from '../content/themes';
import { PROBLEMES_EN } from '../content/problemes.en';
import { parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { plainKey, symmetries } from './lecteurs-lot-e';
import { legalMoves } from './lecteurs-lot-d';
import { groupAt, play, type Position } from './rules';

const all = parsePuzzles(LOT_X);
const pz = (id: string) => all.find(p => p.id === id)!;
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const rowsOf = (setup: unknown) => (setup as { rows: string[] }).rows;
const at9 = (l: string) => fromLabel(l, 9);
const lab = (p: Puzzle, m: number) => (m < 0 ? 'passe' : toLabel(m, p.size));
const libs = (pos: Position, p: number) => groupAt(pos.board, pos.size, p).liberties;
const KO = ['x01', 'x02', 'x03'];
const OUVERTURE = ['x04', 'x05', 'x06', 'x07', 'x08'];

/** Coups noirs légaux (passe comprise) après lesquels Blanc peut capturer une des pierres `cibles`. */
function blancPrend(pos: Position, m: number, cibles: number[]): number[] {
  const r = ok(play(pos, m));
  return legalMoves(r).filter(w => w >= 0 && cibles.some(c => r.board[c] === 1 && ok(play(r, w)).board[c] === 0));
}

/** Coups noirs (passe comprise) après lesquels Blanc ne peut prendre aucune des `cibles`. */
const sauvent = (pos: Position, cibles: number[]) => legalMoves(pos).filter(m => blancPrend(pos, m, cibles).length === 0);

describe('lot X : identifiants, énoncés, thèmes, séries, doublons, calendrier, migration (issue #16)', () => {
  it('x01 à x08 : trois de ko en 9 × 9, cinq d’ouverture en 13 × 13, Noir au trait, ouverts à un débutant', () => {
    expect(all).toHaveLength(LOT_X.length);
    expect(LOT_X.map(r => r.id)).toEqual([...KO, ...OUVERTURE]);
    for (const p of all) {
      expect(p.size, p.id).toBe(KO.includes(p.id) ? 9 : 13);
      expect(p.toPlay).toBe(1);
      expect(p.refutation, p.id).toMatch(/^Pas tout à fait\. /);
      expect(p.explanation, p.id).toMatch(/^Bravo ! /);
      expect(p.difficulty, p.id).toBeGreaterThanOrEqual(300);
      expect(p.difficulty, p.id).toBeLessThan(850);
      expect(p.difficulty % 50, p.id).toBe(0);
    }
    for (const g of [KO, OUVERTURE]) {
      const d = g.map(id => pz(id).difficulty);
      expect([...d].sort((a, b) => a - b)).toEqual(d);
    }
  });

  it('thèmes : ko et ouverture ; séries des leçons 4, 6, 7 et 8', () => {
    for (const id of KO) expect(THEME_DU_PROBLEME[id], id).toBe('ko');
    for (const id of OUVERTURE) expect(THEME_DU_PROBLEME[id], id).toBe('ouverture');
    expect(THEMES_DE_LECON.l4).toEqual(['ko']);
    expect(THEMES_DE_LECON.l6).toEqual(['ouverture', 'comptage']);
    expect(THEMES_DE_LECON.l7).toEqual(['fin-de-partie', 'comptage']);
    expect(THEMES_DE_LECON.l8).toEqual(['ouverture']);
    const serie = (l: string, faits: string[] = []) => serieDeLecon(l, ALL_PUZZLES, new Set(faits)).map(p => p.id);
    expect(serie('l4')).toEqual(['x01', 'x02', 'x03']);
    // Leçon 6 : une ouverture, un comptage (la dame, w07), une ouverture.
    expect(serie('l6')).toEqual(['x04', 'w07', 'x05']);
    // Leçon 7 : fermer une frontière (w04), compter (w07), fermer encore (w05). Déjà vu w07 après la leçon 6 : w08.
    expect(serie('l7')).toEqual(['w04', 'w07', 'w05']);
    expect(serie('l7', ['x04', 'w07', 'x05'])).toEqual(['w04', 'w08', 'w05']);
    // Leçon 8 : trois ouvertures neuves après la leçon 6, sinon les trois plus faciles.
    expect(serie('l8')).toEqual(['x04', 'x05', 'x06']);
    expect(serie('l8', ['x04', 'w07', 'x05'])).toEqual(['x06', 'x07', 'x08']);
  });

  // #500 : le lot Y (fin de partie) vient après lui et ferme désormais le calendrier (vérifié par src/go/lot-y.test.ts).
  it('le Go du jour garde son ordre : le lot X, d’un seul tenant, vient juste après le lot W', () => {
    const ids = LOT_X.map(r => r.id);
    const debut = CALENDRIER_GO_DU_JOUR.indexOf('x01');
    expect(CALENDRIER_GO_DU_JOUR.slice(debut, debut + ids.length)).toEqual(ids);
    expect(CALENDRIER_GO_DU_JOUR.indexOf('x01')).toBe(CALENDRIER_GO_DU_JOUR.indexOf('w09') + 1);
  });

  it('aucun doublon : ni identifiant, ni position (à une rotation ou un miroir près, marques ignorées)', () => {
    const others = ALL_PUZZLES.filter(r => !/^x\d\d$/.test(r.id));
    const ids = new Set(others.map(r => r.id)), seen = new Set(others.map(r => plainKey(rowsOf(r.setup))));
    for (const row of LOT_X) {
      expect(ids.has(row.id), row.id).toBe(false);
      for (const s of symmetries(rowsOf(row.setup))) expect(seen.has(plainKey(s)), row.id).toBe(false);
      seen.add(plainKey(rowsOf(row.setup)));
    }
  });

  it('aucun problème ne reprend un exercice de leçon (symétries et échange des couleurs compris)', () => {
    const exercices = LESSONS_FR.flatMap(l => positionsDeLecon(l));
    for (const row of LOT_X) for (const e of exercices) {
      if (e.length === row.size) expect(memePosition(rowsOf(row.setup), e), row.id).toBe(false);
    }
  });

  it('la migration insère exactement ces problèmes, sans rien modifier', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261002121100_lot_x.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate|alter)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    expect(sql.match(/\('x\d\d', null, \d+,/g)).toHaveLength(LOT_X.length);
    const q = (s: string) => s.replace(/'/g, "''");
    for (const row of LOT_X) {
      expect(sql).toContain(`('${row.id}', null, ${row.size}, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });

  it('textes : le ko est expliqué ; l’ouverture nomme le coin et les lignes ; aucun chiffre de progression', () => {
    for (const id of KO) expect(`${pz(id).prompt} ${pz(id).explanation}`, id).toMatch(/\bko\b/);
    expect(pz('x02').prompt).toContain('atari');
    for (const id of OUVERTURE) {
      expect(pz(id).explanation, id).toMatch(/3-3|3-4|4-4/);
      expect(pz(id).refutation, id).toMatch(/coin/);
    }
  });

  it('chaque problème a son anglais', () => {
    for (const p of all) {
      const en = PROBLEMES_EN[p.id];
      expect(en, p.id).toBeTruthy();
      expect(en.refutation, p.id).toMatch(/^Not quite\. /);
      expect(en.explanation, p.id).toMatch(/^Well done! /);
    }
  });
});

describe('lot X, ko : départ légal, réponse unique, le ko est bien un ko', () => {
  it('départ : pas de ko en cours ; seules les pierres du sujet sont en atari', () => {
    const sujet: Record<string, string[]> = { x01: ['B1'], x02: ['D9'], x03: ['E6', 'E5'] };
    for (const id of KO) {
      const { pos } = startOf(pz(id));
      expect(pos.ko).toBe(-1);
      const enAtari = [...pos.board.keys()].filter(q => pos.board[q] && libs(pos, q).size < 2).map(q => toLabel(q, 9)).sort();
      expect(enAtari, id).toEqual([...sujet[id]].sort());
    }
  });

  it('x01 : C1 est la seule prise ; elle fait un ko en B1 ; sinon Blanc relie en C1', () => {
    const p = pz('x01'), { pos } = startOf(p);
    const prises = legalMoves(pos).filter(m => ok(play(pos, m)).captures[1] > 0);
    expect(prises.map(m => lab(p, m))).toEqual(['C1']);
    expect(p.answers.map(m => lab(p, m))).toEqual(['C1']);
    const apres = ok(play(pos, at9('C1')));
    expect(apres.captures[1]).toBe(1);
    expect([...libs(apres, at9('C1'))].map(q => toLabel(q, 9))).toEqual(['B1']); // « n'a plus qu'une liberté, B1 »
    expect(play(apres, at9('B1'))).toBe('ko'); // Blanc ne reprend pas tout de suite
    const echange = ok(play(ok(play(apres, at9('H8'))), at9('J2')));
    expect(ok(play(echange, at9('B1'))).board[at9('C1')]).toBe(0); // après un échange ailleurs, il le peut
    for (const m of legalMoves(pos)) {
      if (m === at9('C1')) continue;
      const r = ok(play(ok(play(pos, m)), at9('C1')));
      expect(libs(r, at9('B1')).size, lab(p, m)).toBeGreaterThanOrEqual(2);
    }
  });

  it('x02 : seul E9 empêche Blanc de prendre ; sinon Blanc prend en E9, et c’est un ko ; après E9, trois libertés', () => {
    const p = pz('x02'), { pos, marked } = startOf(p);
    expect(marked.map(q => toLabel(q, 9))).toEqual(['D9']);
    expect(sauvent(pos, marked).map(m => lab(p, m))).toEqual(['E9']);
    for (const m of legalMoves(pos)) {
      if (m === at9('E9')) continue;
      const r = ok(play(ok(play(pos, m)), at9('E9')));
      expect(r.board[at9('D9')], lab(p, m)).toBe(0);
      expect(r.ko, lab(p, m)).toBe(at9('D9'));
    }
    const apres = ok(play(pos, at9('E9')));
    expect(groupAt(apres.board, 9, at9('D9')).stones).toHaveLength(4);
    expect(libs(apres, at9('D9')).size).toBe(3);
  });

  it('x03 : seul F5 sauve E6 ; F5 prend E5 en ko ; E7 est un suicide ; sinon Blanc prend en E7', () => {
    const p = pz('x03'), { pos, marked } = startOf(p);
    expect(marked.map(q => toLabel(q, 9))).toEqual(['E6']);
    expect(sauvent(pos, marked).map(m => lab(p, m))).toEqual(['F5']);
    expect(play(pos, at9('E7'))).toBe('suicide');
    const apres = ok(play(pos, at9('F5')));
    expect(apres.captures[1]).toBe(1);
    expect(apres.board[at9('E5')]).toBe(0);
    expect(apres.ko).toBe(at9('E5'));
    expect(play(apres, at9('E5'))).toBe('ko');
    expect([...libs(apres, at9('E6'))].map(q => toLabel(q, 9)).sort()).toEqual(['E5', 'E7']);
    // « S'il joue ailleurs, relie-toi en E5 : le ko est fini » : plus aucune pierre noire en atari.
    const relie = ok(play(ok(play(apres, at9('B8'))), at9('E5')));
    for (let q = 0; q < 81; q++) if (relie.board[q] === 1) expect(libs(relie, q).size, toLabel(q, 9)).toBeGreaterThanOrEqual(2);
    for (const m of legalMoves(pos)) {
      if (m === at9('F5')) continue;
      // Après une erreur, l'aide fait jouer Blanc en F5 (src/app/aide.ts, refutation) : E5 est reliée, E6 reste en
      // atari ; et Blanc la prendrait aussi en E7.
      const r = ok(play(ok(play(pos, m)), at9('F5')));
      expect(libs(r, at9('E5')).size, lab(p, m)).toBeGreaterThanOrEqual(2);
      expect(libs(r, at9('E6')).size, lab(p, m)).toBe(1);
      expect(ok(play(ok(play(pos, m)), at9('E7'))).board[at9('E6')], lab(p, m)).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Ouverture

/** Coin libre : le seul coin dont le carré de 6 × 6 n'a aucune pierre. Renvoie ses points 3-3, 3-4, 4-3 et 4-4. */
function pointsDuCoinLibre(rows: string[]): { coin: string; points: string[] } {
  const n = rows.length, k = 6;
  const coins = [['bas-gauche', 0, n - 1], ['bas-droite', n - 1, n - 1], ['haut-gauche', 0, 0], ['haut-droite', n - 1, 0]] as const;
  const libres = coins.filter(([, cx, cy]) => {
    for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) {
      const x = cx === 0 ? dx : n - 1 - dx, y = cy === 0 ? dy : n - 1 - dy;
      if (rows[y][x] !== '.') return false;
    }
    return true;
  });
  expect(libres, rows.join('/')).toHaveLength(1);
  const [coin, cx, cy] = libres[0];
  const points: string[] = [];
  for (const a of [2, 3]) for (const b of [2, 3]) {
    const x = cx === 0 ? a : n - 1 - a, y = cy === 0 ? b : n - 1 - b;
    points.push(toLabel(y * n + x, n));
  }
  return { coin, points: points.sort() };
}

const NOM_DU_COIN: Record<string, RegExp> = {
  'bas-gauche': /en bas à gauche/, 'bas-droite': /en bas à droite/, 'haut-gauche': /en haut à gauche/, 'haut-droite': /en haut à droite/,
};

describe('lot X, ouverture : un seul coin libre, les réponses sont ses points 3-3, 3-4 et 4-4', () => {
  for (const id of OUVERTURE) {
    it(`${id} : réponses = 3-3, 3-4, 4-3 et 4-4 du coin libre ; position de début de partie, sans prise possible`, () => {
      const p = pz(id), { pos } = startOf(p);
      const { coin, points } = pointsDuCoinLibre(p.rows);
      expect(p.answers.map(m => lab(p, m)).sort()).toEqual(points);
      for (const a of p.answers) expect(legalMoves(pos)).toContain(a);
      // Le texte nomme le bon coin.
      expect(`${p.prompt} ${p.explanation} ${p.refutation}`, id).toMatch(NOM_DU_COIN[coin]);
      // Début de partie : pas plus de pierres noires que blanches + 1, aucune pierre en atari ni au contact.
      const noires = pos.board.filter(c => c === 1).length, blanches = pos.board.filter(c => c === 2).length;
      expect(noires === blanches || noires === blanches - 1, `${id} : ${noires} noires, ${blanches} blanches`).toBe(true);
      for (let q = 0; q < pos.board.length; q++) if (pos.board[q]) expect(libs(pos, q).size, lab(p, q)).toBe(4);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Ouverture selon KataGo. Désactivé par défaut (une dizaine de minutes sur un processeur sans TensorFlow natif, avec 1 visite).
//   npm run fetch-model
//   npm i --no-save @tensorflow/tfjs-node   (conseillé)
//   LOT_X_KATAGO=1 npx vitest run src/go/lot-x.test.ts
// Pour chaque problème, chaque coup légal de Noir est joué, puis KataGo (réseau g170 b6c96, komi 6,5, règle japonaise)
// cherche VISITES visites depuis la position obtenue : l'avance de Noir mesure le coup.

const MODELE = fileURLToPath(new URL('../../public/models/g170-b6c96-s175395328-d26788732.bin.gz', import.meta.url));
const KATAGO = process.env.LOT_X_KATAGO === '1' && existsSync(MODELE);
const VISITES = Number(process.env.LOT_X_VISITES ?? 1);
/** Écart maximal (en points) entre une réponse acceptée et le meilleur coup du plateau. */
const TOLERANCE = 2.5;
/** Un coup sur la 1re ou la 2e ligne perd au moins MARGE points de plus que la moins bonne réponse. */
const MARGE = 1;

describe.skipIf(!KATAGO)('lot X, ouverture selon KataGo (LOT_X_KATAGO=1)', () => {
  let evaluer: (pos: Position) => Promise<number>;
  beforeAll(async () => {
    const tf = await import('@tensorflow/tfjs');
    const natif = '@tensorflow/tfjs-node';
    try { await import(/* @vite-ignore */ natif); await tf.setBackend('tensorflow'); } catch { await tf.setBackend('cpu'); }
    const { gunzip, parseNet } = await import('../engine/katago/parse');
    const { TfNet } = await import('../engine/katago/net');
    const { search } = await import('../engine/katago/search');
    const net = new TfNet(tf, parseNet(await gunzip(new Uint8Array(readFileSync(MODELE)))));
    evaluer = async pos => -(await search(net, pos, { komi: 6.5, visits: VISITES })).lead;
  }, 60000);

  for (const id of OUVERTURE) {
    it(`${id} : le meilleur coup est une réponse ; chaque réponse à moins de ${TOLERANCE} points ; la 2e ligne derrière chaque réponse`, async () => {
      const p = pz(id), { pos } = startOf(p), n = p.size;
      const valeurs = new Map<number, number>();
      for (const m of legalMoves(pos)) {
        if (m >= 0) valeurs.set(m, await evaluer(ok(play(pos, m))));
        // Rend la main à Vitest entre deux coups (sinon ses messages internes expirent).
        await new Promise(r => setTimeout(r, 0));
      }
      const tri = [...valeurs.entries()].sort((a, b) => b[1] - a[1]);
      const [meilleur, v0] = tri[0];
      console.log(`${id} : ${tri.slice(0, 8).map(([m, v]) => `${lab(p, m)} ${(v0 - v).toFixed(1)}`).join(', ')}`);
      expect(p.answers, `meilleur ${lab(p, meilleur)}`).toContain(meilleur);
      for (const a of p.answers) expect(v0 - valeurs.get(a)!, lab(p, a)).toBeLessThanOrEqual(TOLERANCE);
      const pire = Math.min(...p.answers.map(a => valeurs.get(a)!));
      const ligne = (m: number) => Math.min(m % n, Math.floor(m / n), n - 1 - (m % n), n - 1 - Math.floor(m / n));
      for (const [m, v] of valeurs) if (ligne(m) <= 1) expect(pire - v, lab(p, m)).toBeGreaterThanOrEqual(MARGE);
    }, 4 * 3600 * 1000);
  }
});
