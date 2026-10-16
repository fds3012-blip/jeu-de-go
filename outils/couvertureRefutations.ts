// Issue #554 : mesure de la couverture des réfutations prouvées (src/app/comprendreErreur.ts) sur la banque complète.
// Chaque coup faux légal de chaque problème est joué ; on compte ceux qui reçoivent une réponse prouvée, par série
// (src/app/seriesThemes.ts) et par thème (src/content/themes.ts), et on mesure le temps de chaque appel, comme dans
// l'app (lecture bornée à DELAI_LECTURE ms). « Avant » : la lecture de capture en direct seule (#549) ; « après » :
// comprendreErreur, avec les réfutations figées (#554 : vie et mort ; #558 : fin de partie, comptage, ko).
//
//   npx vite-node outils/couvertureRefutations.ts
import { ALL_PUZZLES } from '../src/content/puzzles';
import { THEME_DU_PROBLEME } from '../src/content/themes';
import { parsePuzzles, startOf, type Puzzle } from '../src/data/puzzles';
import { play } from '../src/go/rules';
import { compteur } from '../src/go/lecture-capture';
import { comprendreErreur, comprendreParCapture, type ErreurComprise } from '../src/app/comprendreErreur';
import { serieDe } from '../src/app/seriesThemes';

type Compte = [number, number];
const pct = ([a, b]: Compte) => `${String(a).padStart(5)} / ${String(b).padStart(5)} (${(100 * a / b).toFixed(1).padStart(5)} %)`;
const centiles = (t: number[]) => {
  t.sort((a, b) => a - b);
  const q = (p: number) => t[Math.min(t.length - 1, Math.floor(p * t.length))].toFixed(2);
  return `médiane ${q(0.5)} ms, 95e centile ${q(0.95)} ms, max ${q(1)} ms`;
};

function mesurer(nom: string, lire: (pz: Puzzle, f: number) => ErreurComprise | null) {
  const parSerie = new Map<string, Compte>(), parTheme = new Map<string, Compte>(), temps = new Map<string, number[]>();
  const ajoute = <K>(m: Map<K, Compte>, k: K, ok: boolean) => { const v = m.get(k) ?? [0, 0]; v[0] += ok ? 1 : 0; v[1]++; m.set(k, v); };
  for (const pz of parsePuzzles(ALL_PUZZLES)) {
    const { pos } = startOf(pz), serie = serieDe(pz) ?? '(aucune)';
    for (let f = 0; f < pos.board.length; f++) {
      if (pz.answers.includes(f) || typeof play(pos, f) === 'string') continue;
      const t0 = performance.now(), ok = !!lire(pz, f), dt = performance.now() - t0;
      for (const k of [serie, 'TOUT']) temps.set(k, [...(temps.get(k) ?? []), dt]);
      ajoute(parSerie, 'TOUT', ok);
      ajoute(parSerie, serie, ok);
      ajoute(parTheme, THEME_DU_PROBLEME[pz.id] ?? '(aucun)', ok);
    }
  }
  console.log(`\n== ${nom}\nPar série :`);
  for (const [k, v] of [...parSerie].sort()) console.log(`  ${k.padEnd(16)} ${pct(v)}   temps : ${centiles(temps.get(k)!)}`);
  console.log('Par thème :');
  for (const [k, v] of [...parTheme].sort()) console.log(`  ${k.padEnd(16)} ${pct(v)}`);
}

mesurer('Avant (#549 : lecture de capture en direct seule)', (pz, f) => comprendreParCapture(pz, f, compteur()));
mesurer('Après (#554, #558 : réfutations figées, puis lecture en direct pour les autres problèmes)', (pz, f) => comprendreErreur(pz, f));
