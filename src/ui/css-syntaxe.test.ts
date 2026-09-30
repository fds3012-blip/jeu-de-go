// #324 : une déclaration sans sélecteur, dans apprendre.css, faisait ignorer la règle suivante (`.pastille-ok`) ;
// seul indice, un avertissement du build. Chaque feuille de src/ passe ici par le même minifieur (esbuild, via Vite) :
// aucun avertissement de syntaxe n'est accepté.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformWithEsbuild } from 'vite';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function feuilles(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? feuilles(join(dossier, e.name)) : e.name.endsWith('.css') ? [join(dossier, e.name)] : []);
}

describe('feuilles de style sans erreur de syntaxe (#324)', () => {
  const toutes = feuilles(SRC);

  it('trouve les feuilles de src/', () => {
    expect(toutes.some(f => f.endsWith('apprendre.css'))).toBe(true);
  });

  it.each(toutes.map(f => [f.slice(SRC.length), f]))('%s', async (_nom, f) => {
    const r = await transformWithEsbuild(readFileSync(f, 'utf8'), f, { loader: 'css', minify: true });
    expect(r.warnings.map(w => `${w.location?.line}: ${w.text}`)).toEqual([]);
  });

  it('une déclaration orpheline est bien signalée', async () => {
    const r = await transformWithEsbuild('/* x */\n  background: red; }\n.a { padding: 0; }', 'x.css', { loader: 'css', minify: true });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
