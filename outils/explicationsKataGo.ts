// #673 : fige les analyses du vrai KataGo qui éprouvent l'analyse expliquée de la revue (src/go/explication.ts) dans
// src/go/explications-katago.json. Relues ensuite sans le réseau par src/go/explication-katago.test.ts (CI).
//
//   npm run fetch-model
//   TFJS_NODE_DIR=… npx vite-node outils/explicationsKataGo.ts            (tout)
//   TFJS_NODE_DIR=… npx vite-node outils/explicationsKataGo.ts -- --voir  (affiche, n'écrit rien)
//
// 1. Positions dont la bonne explication est connue (src/go/explications-cas.ts) : l'erreur est jouée, puis deux
//    recherches, comme `analyseErreur` (src/engine/revueKataGo.ts) dans la revue.
// 2. Vraies parties (PARTIES_RELUES) : chaque position est d'abord analysée comme dans la revue (`analyseRevue`,
//    32 visites), les coups sont notés (`noterCoups`), puis chaque perte notée (imprécision, erreur, coup manqué, gaffe),
//    des deux camps, reçoit les deux recherches de `analyseErreur`.
// Réseau g170-b6c96, règle par défaut du moteur (celle de la revue sans handicap ni règle chinoise), komi de la partie.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { fromRows } from '../src/go/position';
import { fromLabel, toLabel } from '../src/go/coords';
import { play, type Position } from '../src/go/rules';
import { CAS_CONNUS, PARTIES_RELUES } from '../src/go/explications-cas';
import { SGF_424 } from '../src/app/partie424.fixture';
import { noterCoups, positionsDepuisSgf, type AnalyseRevue } from '../src/app/revue';
import { VISITES_ERREUR } from '../src/engine/revueKataGo';
import type { FigeErreur, FigeExplications } from '../src/go/explications-fige';

const MODELE_NOM = 'g170-b6c96-s175395328-d26788732';
const MODELE = fileURLToPath(new URL(`../public/models/${MODELE_NOM}.bin.gz`, import.meta.url));
const FIXTURE = fileURLToPath(new URL('../src/go/explications-katago.json', import.meta.url));
const VOIR = process.argv.includes('--voir');
/** `--cas id` : seulement ce cas connu (affiché, rien n'est écrit), sans les parties. */
const SEUL = process.argv.includes('--cas') ? process.argv[process.argv.indexOf('--cas') + 1] : null;
const PERTES = new Set(['imprecision', 'erreur', 'manque', 'grosse']);

async function tensorflow() {
  const dir = process.env.TFJS_NODE_DIR;
  if (dir) return createRequire(`${dir}/x.js`)('@tensorflow/tfjs-node');
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

const arrondi = (o: ArrayLike<number> | undefined) => (o ? Array.from(o, v => Math.round(v * 100) / 100) : undefined);
const L = (p: number, n: number) => (p < 0 ? 'passe' : toLabel(p, n));

/** Les deux recherches de `analyseErreur`. */
async function deuxRecherches(avant: Position, joue: number, komi: number): Promise<Omit<FigeErreur, 'id' | 'perte'>> {
  const opts = { komi, visits: VISITES_ERREUR, maxMoves: 6 };
  const apres = play(avant, joue);
  if (typeof apres === 'string') throw new Error(`coup ${joue} : ${apres}`);
  const a = await search(net, avant, opts);
  const r = await search(net, apres, opts);
  const b = a.moves[0], top = r.moves[0];
  return {
    joue, bon: b.move, leadBon: Math.round(b.lead * 100) / 100, visitesBon: b.visits, pvBon: b.pv ?? [b.move], ownBon: arrondi(a.ownershipApres),
    leadRiposte: Math.round((top?.lead ?? -r.lead) * 100) / 100, visitesRiposte: top?.visits ?? 0, pvRiposte: top?.pv ?? [], ownJoue: arrondi(r.ownership),
  };
}

const fige: FigeExplications = { reglages: { modele: MODELE_NOM, visites: VISITES_ERREUR, visitesRevue: 32 }, cas: [], parties: [] };
const t0 = Date.now();

for (const c of CAS_CONNUS) {
  if (SEUL && c.id !== SEUL) continue;
  const { pos } = fromRows(c.rows, c.trait), n = pos.size;
  const joue = c.joue === '-1' ? -1 : fromLabel(c.joue, n);
  const x = await deuxRecherches(pos, joue, 6.5);
  const perte = Math.max(0, Math.round((x.leadBon + x.leadRiposte) * 10) / 10);
  fige.cas.push({ id: c.id, perte, ...x });
  console.log(`${c.id} : joue ${c.joue}, KataGo ${L(x.bon, n)} (${x.visitesBon} v.), perte ${perte}, suite ${x.pvBon.map(p => L(p, n)).join(' ')} | riposte ${x.pvRiposte.map(p => L(p, n)).join(' ')} (${x.visitesRiposte} v.)`);
}

for (const [id, brut] of Object.entries(SEUL ? {} : PARTIES_RELUES)) {
  const sgf = brut ?? SGF_424;
  const { positions, komi } = positionsDepuisSgf(sgf);
  const n = positions[0].size;
  const analyses: AnalyseRevue[] = [];
  for (const p of positions) {
    const a = await search(net, p, { komi, visits: 32, maxMoves: 6 });
    analyses.push({ lead: p.toPlay === 1 ? a.lead : -a.lead, engine: 'katago', coups: a.moves.map(m => ({ move: m.move, visits: m.visits, lead: m.lead, ...(m.pv ? { pv: m.pv } : {}) })) });
  }
  const notes = noterCoups(positions, analyses, {});
  const erreurs: FigeErreur[] = [];
  for (const nt of notes) {
    if (!nt || !PERTES.has(nt.note)) continue;
    const avant = positions[nt.coup - 1], joue = positions[nt.coup].lastMove ?? -1;
    const x = await deuxRecherches(avant, joue, komi);
    erreurs.push({ id: `${id}.${nt.coup}`, coup: nt.coup, note: nt.note, perte: Math.round(nt.perte * 10) / 10, avance: Math.round((analyses[nt.coup].lead) * 100) / 100, ...x });
    console.log(`${id} coup ${nt.coup} (${nt.note}, ${nt.perte.toFixed(1)} pts) : joue ${L(joue, n)}, KataGo ${L(x.bon, n)} ; suite ${x.pvBon.slice(0, 5).map(p => L(p, n)).join(' ')} | riposte ${x.pvRiposte.slice(0, 4).map(p => L(p, n)).join(' ')}`);
  }
  fige.parties.push({ id, sgf, erreurs });
}

if (!VOIR && !SEUL) {
  // Une ligne par erreur : diff lisible, fichier compact.
  const corps = JSON.stringify(fige).replace(/(\{"id":)/g, '\n$1');
  writeFileSync(FIXTURE, `${corps}\n`);
  console.log(`Analyses figées dans src/go/explications-katago.json (${((Date.now() - t0) / 60000).toFixed(1)} min).`);
}
