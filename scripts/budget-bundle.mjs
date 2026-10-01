// Budget de taille du chargement initial (perf, 29/09 ; docs/qa/perf-2026-09-29.md).
//
//   npm run build && npm run budget
//
// Lit dist/index.html, suit les imports statiques du JS d'entrée et mesure, compressé en gzip,
// ce qu'un téléphone doit télécharger avant d'afficher l'accueil. Échoue si un budget est dépassé.
// Le moteur KataGo, TensorFlow.js, PostHog, Sentry et les écrans chargés à la demande n'en font pas partie :
// si l'un d'eux entre dans le JS initial, le budget saute.
//
// Relever un budget est une décision : dis pourquoi dans la PR.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const KO = 1024;
export const BUDGETS = {
  jsInitial: 250 * KO, // gzip ; 260 Ko le 29/09 après découpage par écran (314 Ko avant), 230 Ko le 30/09 sans l'anglais (#325)
  cssInitial: 30 * KO, // gzip ; 22 Ko le 29/09
  polices: 80 * KO, // woff2 (déjà compressé) ; 70 Ko le 29/09
  morceauAlaDemande: 60 * KO, // gzip, chaque écran chargé à la demande
};

const DIST = new URL('../dist/', import.meta.url).pathname;
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html introuvable : lance `npm run build` avant.');
  process.exit(1);
}

const gz = f => gzipSync(readFileSync(join(DIST, f))).length;
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const attr = (re) => [...html.matchAll(re)].map(m => m[1].replace(/^\//, ''));
const entrees = attr(/<script[^>]+type="module"[^>]+src="([^"]+)"/g);
const preload = attr(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g);
const css = attr(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g);

/** Imports statiques d'un morceau : `import"./x.js"`, `from"./x.js"` (sortie minifiée de Rollup). */
function importsStatiques(fichier) {
  const src = readFileSync(join(DIST, fichier), 'utf8');
  return [...src.matchAll(/(?:\bfrom|\bimport)\s*["'](\.\/[^"']+\.js)["']/g)].map(m => join('assets', m[1].slice(2)));
}
/** Imports dynamiques d'un morceau : `import("./x.js")`. */
function importsDynamiques(fichier) {
  const src = readFileSync(join(DIST, fichier), 'utf8');
  return [...src.matchAll(/import\(\s*["'](\.\/[^"']+\.js)["']\s*\)/g)].map(m => join('assets', m[1].slice(2)));
}

const initial = new Set();
const file = [...entrees, ...preload];
while (file.length) {
  const f = file.pop();
  if (initial.has(f)) continue;
  initial.add(f);
  file.push(...importsStatiques(f));
}

const lignes = [];
let echec = false;
function verifier(nom, taille, budget) {
  const ok = taille <= budget;
  if (!ok) echec = true;
  lignes.push(`${ok ? 'ok  ' : 'TROP'} ${nom.padEnd(44)} ${(taille / KO).toFixed(1).padStart(7)} Ko / ${(budget / KO).toFixed(0)} Ko`);
}

const jsInitial = [...initial].reduce((s, f) => s + gz(f), 0);
verifier('JS initial (gzip)', jsInitial, BUDGETS.jsInitial);
verifier('CSS initial (gzip)', css.reduce((s, f) => s + gz(f), 0), BUDGETS.cssInitial);
const polices = readdirSync(join(DIST, 'assets')).filter(f => f.endsWith('.woff2'));
verifier('Polices (woff2)', polices.reduce((s, f) => s + readFileSync(join(DIST, 'assets', f)).length, 0), BUDGETS.polices);

// Écrans chargés à la demande depuis le JS initial. Rollup nomme chaque morceau d'après son module d'entrée :
// les écrans (src/app/Game.tsx…) commencent par une majuscule ; PostHog (`module-…`) et Sentry (`index-…`), non.
const aLaDemande = new Set([...initial].flatMap(importsDynamiques).filter(f => !initial.has(f)));
const ecrans = [...aLaDemande].filter(f => /^assets\/[A-Z]/.test(f)).sort();
if (ecrans.length === 0) {
  echec = true;
  lignes.push('TROP aucun écran chargé à la demande : le découpage de src/app/ecrans.ts a disparu ?');
}
for (const f of ecrans) verifier(`à la demande : ${f.replace('assets/', '')}`, gz(f), BUDGETS.morceauAlaDemande);

console.log('JS initial :');
for (const f of [...initial].sort()) console.log(`     ${f.padEnd(44)} ${(gz(f) / KO).toFixed(1).padStart(7)} Ko`);
console.log('\nBudgets :');
console.log(lignes.join('\n'));
if (echec) {
  console.error('\nBudget dépassé. Charge le code à la demande (src/app/ecrans.ts) ou explique la hausse dans la PR.');
  process.exit(1);
}
