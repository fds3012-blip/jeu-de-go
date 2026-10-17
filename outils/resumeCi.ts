// Issue #586 : résumé lisible de `npm test` dans la page du job GitHub Actions ($GITHUB_STEP_SUMMARY).
// Les journaux bruts ne sont pas toujours lisibles (agents, API) : ici, les erreurs hors test (« Unhandled Errors », qui
// font échouer le passage sans aucun test rouge), les tests en échec, les fichiers et tests les plus lents, et les plus
// longs blocs synchrones (outils/boucleLibre.setup.ts). Branché par vite.config.ts quand GITHUB_STEP_SUMMARY existe.
import { appendFileSync } from 'node:fs';
import type { Reporter, SerializedError, TestModule, TestRunEndReason } from 'vitest/node';

const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const cellule = (t: string) => t.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 300);

export default class ResumeCi implements Reporter {
  onTestRunEnd(modules: ReadonlyArray<TestModule>, erreurs: ReadonlyArray<SerializedError>, raison: TestRunEndReason) {
    const fichier = process.env.GITHUB_STEP_SUMMARY;
    if (!fichier) return;
    const tests = modules.flatMap(m => [...m.children.allTests()].map(t => ({ m, t, d: t.diagnostic(), r: t.result() })));
    const echecs = tests.filter(x => x.r.state === 'failed');
    const lignes = [`## npm test : ${raison === 'passed' ? 'vert' : raison === 'failed' ? 'rouge' : 'interrompu'}`, ''];
    lignes.push(`${modules.length} fichiers, ${tests.length} tests, ${echecs.length} en échec, ${erreurs.length} erreur(s) hors test.`, '');
    if (erreurs.length) {
      lignes.push('### Erreurs hors test (font échouer le passage même si tous les tests sont verts)', '');
      for (const e of erreurs) lignes.push(`- \`${cellule(`${e.name ?? 'Error'}: ${e.message}`)}\``, ...(e.stack ? ['  ```', ...e.stack.split('\n').slice(0, 6).map(l => `  ${l}`), '  ```'] : []));
      lignes.push('');
    }
    if (echecs.length) {
      lignes.push('### Tests en échec', '', '| Fichier | Test | Erreur |', '|---|---|---|');
      for (const { m, t, r } of echecs.slice(0, 30)) {
        const err = r.state === 'failed' ? r.errors?.[0]?.message ?? '' : '';
        lignes.push(`| ${cellule(m.moduleId.replace(process.cwd() + '/', ''))} | ${cellule(t.fullName)} | ${cellule(err)} |`);
      }
      lignes.push('');
    }
    const lents = [...modules].map(m => ({ m, d: m.diagnostic().duration })).sort((a, b) => b.d - a.d).slice(0, 10);
    lignes.push('### Fichiers les plus lents', '', '| Fichier | Durée |', '|---|---|');
    for (const { m, d } of lents) lignes.push(`| ${cellule(m.moduleId.replace(process.cwd() + '/', ''))} | ${s(d)} |`);
    lignes.push('', '### Plus longs blocs synchrones (limite : outils/boucleLibre.setup.ts)', '', '| Test | Bloc | Durée du test |', '|---|---|---|');
    const blocs = tests.map(x => ({ ...x, b: x.t.meta().blocMs ?? 0 })).sort((a, b) => b.b - a.b).slice(0, 10);
    for (const { t, b, d } of blocs) lignes.push(`| ${cellule(t.fullName)} | ${s(b)} | ${s(d?.duration ?? 0)} |`);
    appendFileSync(fichier, lignes.join('\n') + '\n');
  }
}
