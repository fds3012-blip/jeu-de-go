// #733 : calcule le contrôle KataGo des problèmes d'un lot et le fige dans src/go/preuves-katago-problemes.json.
//
//   npm run preuves-katago-problemes -- ac01 ac02        (ces problèmes ; les autres analyses sont gardées)
//   npm run preuves-katago-problemes -- --lot ac         (tout le lot AC : ac01, ac02…)
//
// Réseau : public/models/<modele>.bin.gz (`npm run fetch-model`), sinon public/reseaux/*.bin.gz (réseau du dépôt) ;
// MODELE=<fichier> pour en désigner un autre. TensorFlow natif conseillé (TFJS_NODE_DIR), comme outils/preuvesKataGo.ts.
// Pour chaque problème : politique brute du réseau et recherche de REGLAGES_PROBLEMES.visites visites, dans chacune des
// 8 symétries du plateau, et propriété moyenne par point. Jugement : outils/kataGoProblemes.ts.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ALL_PUZZLES } from '../src/content/puzzles';
import { parsePuzzles } from '../src/data/puzzles';
import { toLabel } from '../src/go/coords';
import { fromRows } from '../src/go/position';
import { inverser, rowsSym } from '../src/go/preuvesKataGo';
import { REGLAGES_PROBLEMES, cleProbleme, type PreuvesProblemes } from './kataGoProblemes';

const FIXTURE = fileURLToPath(new URL('../src/go/preuves-katago-problemes.json', import.meta.url));
const dossier = (d: string) => fileURLToPath(new URL(`../public/${d}/`, import.meta.url));

function chercherModele(): string {
  if (process.env.MODELE) return process.env.MODELE;
  const voulu = `${dossier('models')}${REGLAGES_PROBLEMES.modele}.bin.gz`;
  if (existsSync(voulu)) return voulu;
  const repo = existsSync(dossier('reseaux')) ? readdirSync(dossier('reseaux')).find(f => f.startsWith(REGLAGES_PROBLEMES.modele) && f.endsWith('.bin.gz')) : undefined;
  if (repo) return `${dossier('reseaux')}${repo}`;
  console.error('Réseau absent : npm run fetch-model'); process.exit(1);
}

async function tensorflow() {
  const dir = process.env.TFJS_NODE_DIR;
  if (dir) return createRequire(`${dir}/x.js`)('@tensorflow/tfjs-node');
  console.warn('TensorFlow natif absent : moteur JS (lent).');
  const tf = await import('@tensorflow/tfjs');
  await tf.setBackend('cpu');
  return tf;
}

const args = process.argv.slice(2);
const iLot = args.indexOf('--lot');
const lot = iLot >= 0 ? args[iLot + 1] : null;
const tous = parsePuzzles(ALL_PUZZLES);
const demandes = lot ? tous.filter(p => new RegExp(`^${lot}\\d+$`).test(p.id)) : tous.filter(p => args.includes(p.id));
if (!demandes.length) { console.error('Aucun problème : passe des identifiants ou --lot <lettres>'); process.exit(1); }

const tf = await tensorflow();
const { gunzip, parseNet } = await import('../src/engine/katago/parse');
const { TfNet } = await import('../src/engine/katago/net');
const { search } = await import('../src/engine/katago/search');
const net = new TfNet(tf, parseNet(await gunzip(new Uint8Array(readFileSync(chercherModele())))));

const fixture: PreuvesProblemes = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : { reglages: REGLAGES_PROBLEMES, problemes: {} };
if (JSON.stringify(fixture.reglages) !== JSON.stringify(REGLAGES_PROBLEMES)) fixture.problemes = {};
fixture.reglages = REGLAGES_PROBLEMES;
const enregistrer = () => {
  const triees = Object.fromEntries(Object.entries(fixture.problemes).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(FIXTURE, `${JSON.stringify({ ...fixture, problemes: triees }, null, 0).replace(/("[a-z]+\d+":)/g, '\n$1')}\n`);
};

const t0 = Date.now();
for (const p of demandes) {
  const n = p.size, L = (m: number) => (m < 0 || m === n * n ? 'passe' : toLabel(m, n));
  const prior = new Map<string, number>(), own = new Float64Array(n * n), recherche: { sym: number; meilleur: string; visites: number; sur: number }[] = [];
  const k = REGLAGES_PROBLEMES.symetries.length;
  for (const sym of REGLAGES_PROBLEMES.symetries) {
    const { pos } = fromRows(rowsSym(p.rows, sym), p.toPlay);
    const a = await search(net, pos, { komi: REGLAGES_PROBLEMES.komi, regles: REGLAGES_PROBLEMES.regles, visits: REGLAGES_PROBLEMES.visites, maxMoves: 8 });
    for (let q = 0; q < n * n; q++) own[inverser(q, n, sym)] += a.ownership[q] / k;
    if (a.policy) for (let q = 0; q <= n * n; q++) if (a.policy[q]) { const l = q === n * n ? 'passe' : L(inverser(q, n, sym)); prior.set(l, (prior.get(l) ?? 0) + a.policy[q] / k); }
    const best = a.moves[0];
    recherche.push({ sym, meilleur: best.move < 0 ? 'passe' : L(inverser(best.move, n, sym)), visites: best.visits, sur: a.visits });
    await new Promise(res => setTimeout(res, 0));
  }
  const propriete = Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => { const o = own[y * n + x]; return o > 0.5 ? 'N' : o < -0.5 ? 'B' : '.'; }).join(''));
  fixture.problemes[p.id] = {
    cle: cleProbleme(p),
    politique: [...prior].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([l, v]) => [l, Math.round(v * 100) / 100] as [string, number]),
    recherche, propriete,
  };
  enregistrer();
  console.log(`${p.id} : ${fixture.problemes[p.id].politique.slice(0, 3).map(([l, v]) => `${l} ${v}`).join(' | ')} ; recherche ${recherche.map(r => r.meilleur).join(' ')} (${((Date.now() - t0) / 60000).toFixed(1)} min)`);
}
console.log(`Contrôle KataGo figé dans src/go/preuves-katago-problemes.json (${((Date.now() - t0) / 60000).toFixed(1)} min).`);
