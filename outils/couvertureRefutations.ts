// Issue #554 : mesure de la couverture des réfutations prouvées (src/app/comprendreErreur.ts) sur la banque complète.
// Chaque coup faux légal de chaque problème est joué ; on compte ceux qui reçoivent une réponse prouvée, par série
// (src/app/seriesThemes.ts) et par thème (src/content/themes.ts), et on mesure le temps de chaque appel, comme dans
// l'app (lecture bornée à DELAI_LECTURE ms).
//
//   npx vite-node outils/couvertureRefutations.ts
import { ALL_PUZZLES } from '../src/content/puzzles';
import { THEME_DU_PROBLEME } from '../src/content/themes';
import { parsePuzzles, startOf } from '../src/data/puzzles';
import { play } from '../src/go/rules';
import { comprendreErreur } from '../src/app/comprendreErreur';
import { serieDe } from '../src/app/seriesThemes';

const tous = parsePuzzles(ALL_PUZZLES);
const parSerie = new Map<string, [number, number]>(), parTheme = new Map<string, [number, number]>();
const temps: number[] = [];
const ajoute = (m: Map<string, [number, number]>, k: string, ok: boolean) => {
  const v = m.get(k) ?? [0, 0];
  v[0] += ok ? 1 : 0; v[1]++;
  m.set(k, v);
};
let total = 0, couverts = 0;
for (const pz of tous) {
  const { pos } = startOf(pz);
  for (let f = 0; f < pos.board.length; f++) {
    if (pz.answers.includes(f) || typeof play(pos, f) === 'string') continue;
    const t0 = performance.now();
    const e = comprendreErreur(pz, f);
    temps.push(performance.now() - t0);
    total++; if (e) couverts++;
    ajoute(parSerie, serieDe(pz) ?? '(aucune)', !!e);
    ajoute(parTheme, THEME_DU_PROBLEME[pz.id] ?? '(aucun)', !!e);
  }
}
const pct = ([a, b]: [number, number]) => `${a} / ${b} (${(100 * a / b).toFixed(1)} %)`;
console.log(`Total : ${pct([couverts, total])}`);
console.log('\nPar série :');
for (const [k, v] of [...parSerie].sort()) console.log(`  ${k.padEnd(16)} ${pct(v)}`);
console.log('\nPar thème :');
for (const [k, v] of [...parTheme].sort()) console.log(`  ${k.padEnd(16)} ${pct(v)}`);
temps.sort((a, b) => a - b);
const q = (p: number) => temps[Math.min(temps.length - 1, Math.floor(p * temps.length))].toFixed(2);
console.log(`\nTemps par coup faux : médiane ${q(0.5)} ms, 95e centile ${q(0.95)} ms, 99e ${q(0.99)} ms, max ${q(1)} ms`);
