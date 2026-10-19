// #673 : imprime les explications générées sur les analyses figées (src/go/explications-katago.json), pour la
// relecture écrite (docs/produit/analyse-expliquee-2026-10.md). Rien n'est recalculé avec le réseau.
//
//   npx vite-node outils/relectureExplications.ts [-- --en]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fromRows } from '../src/go/position';
import { toLabel } from '../src/go/coords';
import { expliquerErreur } from '../src/go/explication';
import { CAS_CONNUS } from '../src/go/explications-cas';
import { entreeDe, type FigeExplications } from '../src/go/explications-fige';
import { positionsDepuisSgf } from '../src/app/revue';
import { conseilFiable } from '../src/app/revue';
import { glosesDesErreurs, textesExplication } from '../src/app/analyseExpliquee';
import { choisirLangue } from '../src/content/i18n';
import type { Explication } from '../src/go/explication';

if (process.argv.includes('--en')) choisirLangue('en');
const fige: FigeExplications = JSON.parse(readFileSync(fileURLToPath(new URL('../src/go/explications-katago.json', import.meta.url)), 'utf8'));
const nom = (c: 1 | 2) => (c === 1 ? 'Noir' : 'Blanc');
const suite = (coups: number[], n: number) => coups.map(p => (p < 0 ? 'passe' : toLabel(p, n))).join(' ');

function imprimer(titre: string, x: Explication | null, n: number, adv: string, gloses?: Set<never>) {
  console.log(`\n### ${titre}`);
  if (!x) { console.log('(rien à expliquer)'); return; }
  const t = textesExplication(x, n, { adv, ...(gloses ? { gloses } : {}) });
  console.log(`- Faits : ${x.faits.map(f => f.type + ('cause' in f ? `/${f.cause}` : '') + ('etat' in f ? `/${f.etat}` : '') + ('lieu' in f ? `/${f.lieu}` : '')).join(', ') || '(aucun : positionnel' + (x.calme ? ', calme' : '') + ')'}`);
  console.log(`- Suite de ton coup : ${suite(x.suiteJoue.coups, n)} ; suite du bon coup : ${suite(x.suiteBon.coups, n)}`);
  console.log(`- Pourquoi c'est une erreur : ${t.erreur}`);
  console.log(`- Pourquoi ${toLabel(x.bon, n)} est meilleur : ${t.meilleur}`);
}

console.log('## Positions connues');
for (const f of fige.cas) {
  const c = CAS_CONNUS.find(x => x.id === f.id)!;
  const { pos } = fromRows(c.rows, c.trait);
  imprimer(`${c.id} : ${c.titre} (KataGo : ${toLabel(f.bon, pos.size)}, ${f.perte} points)`, expliquerErreur(entreeDe(pos, f)), pos.size, nom((3 - c.trait) as 1 | 2));
}

for (const p of fige.parties) {
  console.log(`\n## Partie ${p.id}`);
  const { positions } = positionsDepuisSgf(p.sgf);
  const n = positions[0].size;
  const xs = new Map<number, Explication>();
  for (const f of p.erreurs) {
    const avant = positions[f.coup! - 1];
    // Comme la revue : le bon coup n'est montré (et expliqué) que s'il est fiable.
    const c = avant.toPlay, gain = f.leadBon - (c === 1 ? f.avance! : -f.avance!);
    if (!conseilFiable(avant, f.bon, gain)) continue;
    const x = expliquerErreur(entreeDe(avant, f));
    if (x) xs.set(f.coup!, x);
  }
  const gloses = glosesDesErreurs(xs);
  for (const f of p.erreurs) {
    const avant = positions[f.coup! - 1];
    const titre = `Coup ${f.coup} (${nom(avant.toPlay)}, ${f.note}, ${f.perte} points) : ${f.joue < 0 ? 'passe' : toLabel(f.joue, n)}, KataGo ${toLabel(f.bon, n)}`;
    if (!xs.has(f.coup!)) { console.log(`\n### ${titre}\n(bon coup non montré : conseil jugé peu fiable par la revue)`); continue; }
    imprimer(titre, xs.get(f.coup!)!, n, nom((3 - avant.toPlay) as 1 | 2), gloses.get(f.coup!) as Set<never>);
  }
}
