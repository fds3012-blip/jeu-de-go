// #728 (C8) : mesure reproductible de la force d'un réseau KataGo candidat contre b6c96, sur les cas de vie et mort
// prouvés du dépôt, et de son coût par évaluation. Aucun réseau n'est lu par le jeu : cet outil tourne hors CI.
//
//   npm run fetch-model                                   (b6c96, copié depuis public/reseaux/)
//   curl -L -o public/models/g170e-b10c128-s1141046784-d204142634.bin.gz \
//     https://raw.githubusercontent.com/lightvector/KataGo/master/cpp/tests/models/g170e-b10c128-s1141046784-d204142634.bin.gz
//   npx vite-node outils/analyseForte.ts -- --modele g170e-b10c128-s1141046784-d204142634 --visites 64
//   npx vite-node outils/analyseForte.ts -- --modele <nom> --visites 64 --part 1/4 --sortie /tmp/p1.json   (4 processus)
//   npx vite-node outils/analyseForte.ts -- --fusion /tmp/p1.json /tmp/p2.json …                       (agrège)
//   npx vite-node outils/analyseForte.ts -- --comparer ref.json candidat.json                              (écarts appariés)
//   npx vite-node outils/analyseForte.ts -- --modele <nom> --perf                                         (coût par évaluation)
//
// Options : --visites N (64 : celle de l'analyse expliquée), --cas vm|connus|tout (vm : défaut), --part i/n,
// --sortie fichier.json, --perf. TensorFlow natif conseillé (TFJS_NODE_DIR=…), sinon moteur JS (50 fois plus lent :
// 0,9 s par visite pour b10 en 9 × 9, d'où le découpage --part). `npm i --no-save @tensorflow/tfjs-node` dans un dossier à part.
//
// Cas « vm » : les problèmes « Noir joue et vit / tue » (prompt), tous prouvés par les tests des lots (réponses = exactement
// les coups gagnants). Pour chacun :
//  - `okZone` : le coup le plus visité DANS LA ZONE du groupe (src/go/refutation-locale.ts) est une réponse prouvée : la
//    lecture locale, seule comparable (sur un plateau presque vide, jouer ailleurs n'est pas une erreur de lecture) ;
//  - `ok` : le coup le plus visité du plateau est une réponse prouvée ;
//  - `part` : part des visites de la racine sur les réponses prouvées ;
//  - `propBonne` : après la réponse prouvée, la propriété moyenne du groupe marqué donne le bon camp (c'est cette
//    propriété que l'analyse expliquée lit pour dire « groupe vivant / mort ») ;
//  - `propFaute` : après le meilleur coup de la zone qui n'est PAS une réponse prouvée, la propriété donne l'autre camp
//    (la réfutation est vue) ; absent si toute la zone ne contient que des réponses prouvées.
// Cas « connus » : src/go/explications-cas.ts (tactique et territoire), coup proposé et perte estimée de l'erreur jouée.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startOf } from '../src/data/puzzles';
import { chaine, ecarts, problemesVieMort, propDuGroupe, synthese, type MesureProbleme, type Resultat } from './analyseForteLib';
import { fromRows } from '../src/go/position';
import { fromLabel, toLabel } from '../src/go/coords';
import { CAS_CONNUS } from '../src/go/explications-cas';
import { play } from '../src/go/rules';
import { zoneDuGroupe } from '../src/go/refutation-locale';

const arg = (nom: string) => { const i = process.argv.indexOf(`--${nom}`); return i < 0 ? null : (process.argv[i + 1] ?? null); };
const drapeau = (nom: string) => process.argv.includes(`--${nom}`);

const pct = (a: number, b: number) => `${a}/${b} (${((100 * a) / Math.max(1, b)).toFixed(0)} %)`;

function resumer(r: Resultat) {
  const s = synthese(r.problemes);
  console.log(`${r.modele} (${r.moteur}, ${r.visites} visites demandées)`);
  console.log(`  meilleur coup dans la zone du groupe : ${pct(s.okZone, s.n)}`);
  console.log(`  meilleur coup sur tout le plateau : ${pct(s.ok, s.n)}, part moyenne des visites sur les réponses ${s.partMoyenne.toFixed(2)}`);
  console.log(`  propriété après la bonne réponse : ${pct(...s.propBonne)} ; après une faute : ${pct(...s.propFaute)} (réfutation vue)`);
  console.log(`  coût : ${s.msParVisite.toFixed(1)} ms par visite (sur cette machine)`);
  for (const c of r.connus) console.log(`  connu ${c.id} : joue ${c.joue}, réseau ${c.coup}, perte ${c.perte} pts`);
}

/** `--comparer reference.json candidat.json` : écarts appariés (test des signes exact). */
if (drapeau('comparer')) {
  const [ref, cand] = process.argv.slice(process.argv.indexOf('--comparer') + 1).filter(a => !a.startsWith('--')).map(f => JSON.parse(readFileSync(f, 'utf8')) as Resultat);
  console.log(`${cand.modele} contre ${ref.modele}, ${cand.visites} visites`);
  for (const k of ['okZone', 'propBonne', 'propFaute'] as const) {
    const e = ecarts(ref.problemes, cand.problemes, k);
    console.log(`  ${k} : ${e.communs} paires, candidat seul ${e.seulCandidat}, référence seule ${e.seulReference}, p = ${e.p.toFixed(4)}`);
  }
  process.exit(0);
}

if (drapeau('fusion')) {
  const fichiers = process.argv.slice(process.argv.indexOf('--fusion') + 1).filter(a => !a.startsWith('--'));
  const parts: Resultat[] = fichiers.map(f => JSON.parse(readFileSync(f, 'utf8')));
  const tous: Resultat = { ...parts[0], problemes: parts.flatMap(x => x.problemes), connus: parts.flatMap(x => x.connus) };
  tous.problemes.sort((a, b) => a.id.localeCompare(b.id));
  resumer(tous);
  if (arg('sortie')) writeFileSync(arg('sortie')!, `${JSON.stringify(tous)}\n`);
  process.exit(0);
}

const NOM = arg('modele') ?? 'g170-b6c96-s175395328-d26788732';
const VISITES = Number(arg('visites') ?? 64);
const CAS = arg('cas') ?? 'vm';
const MODELE = fileURLToPath(new URL(`../public/models/${NOM}.bin.gz`, import.meta.url));
if (!existsSync(MODELE)) { console.error(`Réseau absent : public/models/${NOM}.bin.gz (voir l'en-tête de l'outil)`); process.exit(1); }

async function tensorflow() {
  const dir = process.env.TFJS_NODE_DIR;
  if (dir) return { tf: createRequire(`${dir}/x.js`)('@tensorflow/tfjs-node'), moteur: 'tfjs-node' };
  const tf = await import('@tensorflow/tfjs');
  await tf.setBackend('cpu');
  return { tf, moteur: 'tfjs-cpu (JS)' };
}
const { tf, moteur } = await tensorflow();
const { gunzip, parseNet } = await import('../src/engine/katago/parse');
const { TfNet } = await import('../src/engine/katago/net');
const { search } = await import('../src/engine/katago/search');
const net = new TfNet(tf, parseNet(await gunzip(new Uint8Array(readFileSync(MODELE)))));

if (drapeau('perf')) {
  // Coût d'une évaluation (une visite = une évaluation) sur le plateau 9 × 9 puis 19 × 19, après 3 évaluations de chauffe.
  const { newPosition } = await import('../src/go/rules');
  for (const n of [9, 19]) {
    const pos = newPosition(n);
    await search(net, pos, { komi: 6.5, visits: 3 });
    const t = performance.now();
    const a = await search(net, pos, { komi: 6.5, visits: 24 });
    console.log(`${NOM} ${moteur} ${n}x${n} : ${((performance.now() - t) / a.visits).toFixed(1)} ms par visite (${a.visits} visites)`);
  }
  process.exit(0);
}

const [pi, pn] = (arg('part') ?? '1/1').split('/').map(Number);
const opts = { komi: 6.5, visits: VISITES, maxMoves: 40 };
const L = (m: number, n: number) => (m < 0 ? 'passe' : toLabel(m, n));
const resultat: Resultat = { modele: NOM, visites: VISITES, moteur, problemes: [], connus: [] };

if (CAS === 'vm' || CAS === 'tout') {
  const choisis = problemesVieMort();
  for (const [i, pz] of choisis.entries()) {
    if (i % pn !== pi - 1) continue;
    const { pos, marked } = startOf(pz), n = pos.size;
    const vivre = /joue et vit/.test(pz.prompt);
    const defenseur = pos.board[marked[0]] as 1 | 2, attaquant = (3 - defenseur) as 1 | 2;
    const bonCamp = vivre ? defenseur : attaquant;
    const reponses = new Set(pz.answers.map(r => L(r, n)));
    const t = performance.now();
    const a = await search(net, pos, opts);
    const meilleur = a.moves[0];
    const part = a.moves.filter(m => reponses.has(L(m.move, n))).reduce((s, m) => s + m.visits, 0) / Math.max(1, a.moves.reduce((s, m) => s + m.visits, 0));
    // Meilleur coup DANS la zone du groupe (la lecture locale) : un réseau qui préfère jouer ailleurs sur un plateau presque
    // vide n'a pas forcément mal lu la vie et mort. Classement : visites, puis probabilité brute de la politique.
    const zone = new Set(zoneDuGroupe(pos, marked[0]));
    const candidats = [...zone].filter(p => pos.board[p] === 0).map(p => ({ p, v: a.moves.find(m => m.move === p)?.visits ?? 0, pr: a.policy?.[p] ?? 0 }));
    candidats.sort((x, y) => y.v - x.v || y.pr - x.pr);
    const coupZone = candidats[0] ? L(candidats[0].p, n) : '-';
    // Propriété du groupe marqué après la réponse prouvée (la première), vue du camp qui doit gagner.
    const apresBon = play(pos, pz.answers[0]);
    let propBonne: boolean | null = null;
    if (typeof apresBon !== 'string') {
      const b = await search(net, apresBon, { ...opts, maxMoves: 1 });
      propBonne = propDuGroupe(b.ownership, chaine(apresBon, marked[0]), bonCamp) > 0;
    }
    // Propriété après le meilleur coup DE LA ZONE qui n'est pas une réponse prouvée : le groupe doit aller à l'autre camp.
    const fauteZone = candidats.find(c => !reponses.has(L(c.p, n)));
    const faute = fauteZone ? { move: fauteZone.p } : undefined;
    let propFaute: boolean | null = null;
    if (faute) {
      const apresFaute = play(pos, faute.move);
      if (typeof apresFaute !== 'string') {
        const f = await search(net, apresFaute, { ...opts, maxMoves: 1 });
        // La pierre marquée peut avoir été prise par la faute : propriété lue sur son point, sans chaîne.
        const pierres = apresFaute.board[marked[0]] === defenseur ? chaine(apresFaute, marked[0]) : [marked[0]];
        propFaute = propDuGroupe(f.ownership, pierres, bonCamp) < 0;
      }
    }
    const m: MesureProbleme = {
      id: pz.id, prompt: pz.prompt.slice(0, 40), reponses: pz.answers.map(r => L(r, n)), coup: L(meilleur.move, n), ok: reponses.has(L(meilleur.move, n)), coupZone, okZone: reponses.has(coupZone),
      part: +part.toFixed(3), propBonne, propFaute, fauteJouee: faute ? L(faute.move, n) : null, visites: a.visits, ms: Math.round(performance.now() - t),
    };
    resultat.problemes.push(m);
    console.log(`${pz.id} (${vivre ? 'vit' : 'tue'}) : global ${m.coup} ${m.ok ? 'OK' : 'raté'}, zone ${m.coupZone} ${m.okZone ? 'OK' : 'raté'} (réponses ${m.reponses.join('/')}, part ${m.part}), propriété bonne ${m.propBonne}, faute ${m.fauteJouee ?? '-'} ${m.propFaute} [${m.ms} ms]`);
  }
}

if (CAS === 'connus' || CAS === 'tout') {
  for (const c of CAS_CONNUS) {
    const { pos } = fromRows(c.rows, c.trait), n = pos.size;
    const joue = c.joue === '-1' ? -1 : fromLabel(c.joue, n);
    const apres = play(pos, joue);
    if (typeof apres === 'string') throw new Error(`${c.id} : ${apres}`);
    const t = performance.now();
    const a = await search(net, pos, opts);
    const r = await search(net, apres, opts);
    const perte = Math.max(0, Math.round((a.moves[0].lead + (r.moves[0]?.lead ?? -r.lead)) * 10) / 10);
    resultat.connus.push({ id: c.id, coup: L(a.moves[0].move, n), joue: c.joue, perte, visites: a.visits, ms: Math.round(performance.now() - t) });
  }
}

resumer(resultat);
if (arg('sortie')) writeFileSync(arg('sortie')!, `${JSON.stringify(resultat)}\n`);
