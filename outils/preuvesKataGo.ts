// Calcule les preuves KataGo des leçons d'ouverture et de joseki (#16) et les fige dans src/go/preuves-katago.json.
// Rejouées ensuite sans le modèle par src/go/lecons-ouverture.test.ts (CI).
//
//   npm run fetch-model
//   npm run preuves-katago            (toutes les leçons contrôlées)
//   npm run preuves-katago -- l30     (une leçon ; les analyses déjà figées et toujours valables sont gardées)
//
// TensorFlow natif conseillé (sinon des heures) : @tensorflow/tfjs-node, installé dans le projet
// (`npm i --no-save @tensorflow/tfjs-node`) ou dans un dossier à part désigné par TFJS_NODE_DIR.
// Réseau g170 b6c96, komi 6,5, règle japonaise ; réglages dans src/go/preuvesKataGo.ts (REGLAGES).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { LESSONS_FR } from '../src/content/lessons';
import { fromRows } from '../src/go/position';
import { play } from '../src/go/rules';
import { fromLabel } from '../src/go/coords';
import { CONTROLES, REGLAGES, cleDe, etiquette, inverser, positionsDe, rowsSym, temoins, transformer, type Analyse, type APosition, type Preuves } from '../src/go/preuvesKataGo';

const MODELE = fileURLToPath(new URL(`../public/models/${REGLAGES.modele}.bin.gz`, import.meta.url));
const FIXTURE = fileURLToPath(new URL('../src/go/preuves-katago.json', import.meta.url));

async function tensorflow() {
  const dir = process.env.TFJS_NODE_DIR;
  if (dir) return createRequire(`${dir}/x.js`)('@tensorflow/tfjs-node');
  const natif = '@tensorflow/tfjs-node';
  try { return await import(/* @vite-ignore */ natif); } catch { /* absent */ }
  console.warn('TensorFlow natif absent : moteur JS (très lent).');
  const tf = await import('@tensorflow/tfjs');
  await tf.setBackend('cpu');
  return tf;
}

if (!existsSync(MODELE)) { console.error('Réseau absent : npm run fetch-model'); process.exit(1); }
const tf = await tensorflow();
const { gunzip, parseNet } = await import('../src/engine/katago/parse');
const { TfNet } = await import('../src/engine/katago/net');
const { search } = await import('../src/engine/katago/search');
const net = new TfNet(tf, parseNet(await gunzip(new Uint8Array(readFileSync(MODELE)))));
const opts = (visits: number) => ({ komi: REGLAGES.komi, regles: REGLAGES.regles, visits, maxMoves: 12 });

const preuves: Preuves = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : { reglages: REGLAGES, positions: {} };
const memesReglages = JSON.stringify(preuves.reglages) === JSON.stringify(REGLAGES);
if (!memesReglages) preuves.positions = {};
preuves.reglages = REGLAGES;
/** Écrit la fixture, en gardant ce qu'un autre calcul lancé en parallèle (autre leçon) y a écrit entre-temps. */
const enregistrer = (retirer: string[] = []) => {
  const disque: Preuves | null = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : null;
  if (disque && JSON.stringify(disque.reglages) === JSON.stringify(REGLAGES)) {
    for (const [k, v] of Object.entries(disque.positions)) {
      const ici = preuves.positions[k];
      if (!ici) { preuves.positions[k] = v; continue; }
      // Même position analysée des deux côtés : on garde chaque coup jugé, d'où qu'il vienne.
      for (const [m, vals] of Object.entries(v.coups)) if (!ici.coups[m]) { ici.coups[m] = vals; (ici.repliques ??= {})[m] = v.repliques?.[m] ?? []; }
      if (ici.racines.length < v.racines.length) ici.racines = v.racines;
    }
  }
  for (const k of retirer) delete preuves.positions[k];
  const triees = Object.fromEntries(Object.entries(preuves.positions).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(FIXTURE, `${JSON.stringify({ ...preuves, positions: triees }, null, 0).replace(/("[BW]:[^"]+":)/g, '\n$1')}\n`);
};

async function racine(p: APosition, k: number) {
  const n = p.rows.length, { pos } = fromRows(rowsSym(p.rows, k), p.trait);
  const a = await search(net, pos, opts(REGLAGES.visitesRacine));
  return {
    sym: k, visites: a.visits,
    coups: a.moves.slice(0, 8).map(m => ({ l: etiquette(m.move < 0 ? -1 : inverser(m.move, n, k), n), visites: m.visits, avance: +m.lead.toFixed(2) })),
  };
}

/** Avance du joueur au trait après son coup `l`, dans la symétrie k. */
async function apres(p: APosition, l: string, k: number) {
  const n = p.rows.length, { pos } = fromRows(rowsSym(p.rows, k), p.trait);
  const r = play(pos, transformer(fromLabel(l, n), n, k));
  if (typeof r === 'string') throw new Error(`${l} : ${r}`);
  const a = await search(net, r, opts(REGLAGES.visitesCoup));
  await new Promise(res => setTimeout(res, 0));
  const rep = a.moves[0]?.move ?? -1;
  return { avance: +(-a.lead).toFixed(2), replique: etiquette(rep < 0 ? -1 : inverser(rep, n, k), n) };
}

const filtre = process.argv.slice(2).filter(a => /^l\d+$/.test(a));
const t0 = Date.now();
for (const c of CONTROLES) {
  if (filtre.length && !filtre.includes(c.lecon)) continue;
  const l = LESSONS_FR.find(x => x.id === c.lecon);
  if (!l) throw new Error(`${c.lecon} : leçon absente`);
  for (const p of positionsDe(l, c)) {
    const a: Analyse = preuves.positions[p.cle] ?? { rows: p.rows, trait: p.trait, racines: [], coups: {}, repliques: {} };
    if (a.racines.length !== REGLAGES.symetries.length) a.racines = [];
    for (const k of REGLAGES.symetries) if (!a.racines.some(r => r.sym === k)) a.racines.push(await racine(p, k));
    for (const m of [...new Set([...p.coups, ...temoins(a)])]) {
      if (a.coups[m]?.length === REGLAGES.symetries.length && a.repliques?.[m]?.length === REGLAGES.symetries.length) continue;
      a.coups[m] = []; a.repliques ??= {}; a.repliques[m] = [];
      for (const k of REGLAGES.symetries) { const r = await apres(p, m, k); a.coups[m].push(r.avance); a.repliques[m].push(r.replique); }
      console.log(`${c.lecon}.${c.etape + 1} ${p.trait === 1 ? 'Noir' : 'Blanc'} ${m} : ${a.coups[m].join(' ')} (${((Date.now() - t0) / 60000).toFixed(1)} min)`);
    }
    preuves.positions[cleDe(p.rows, p.trait)] = a;
    enregistrer();
  }
}
// Les positions qui ne servent plus à aucune leçon sont retirées (toutes les leçons contrôlées sont relues).
if (!filtre.length) {
  const utiles = new Set(CONTROLES.flatMap(c => positionsDe(LESSONS_FR.find(x => x.id === c.lecon)!, c).map(p => p.cle)));
  enregistrer();
  enregistrer(Object.keys(preuves.positions).filter(k => !utiles.has(k)));
}
console.log(`Preuves KataGo figées dans src/go/preuves-katago.json (${((Date.now() - t0) / 60000).toFixed(1)} min).`);
