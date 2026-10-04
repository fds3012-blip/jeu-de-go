// Issue #416 : l'appli s'appelle Mochi Go et vit sur https://mochi-go.app.
// L'ancienne adresse Vercel ne doit plus revenir dans le code ni dans la page (liens de partage, aperçus).
// Seule exception, hors de ce test : supabase/auth/reglages.json, où elle reste en secours pour la connexion.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = fileURLToPath(new URL('..', import.meta.url));
// Écrite en deux morceaux, pour que ce fichier ne se signale pas lui-même.
const ANCIENNE = ['jeu-de-go', 'vercel.app'].join('.');
const TEXTE = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.html', '.json', '.webmanifest', '.svg', '.md', '.txt']);

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap(nom => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return TEXTE.has(extname(nom)) ? [chemin] : [];
  });
}

describe('adresse de l’appli (#416)', () => {
  const cibles = [...fichiers(join(racine, 'src')), ...fichiers(join(racine, 'public')), join(racine, 'index.html')];

  test('l’ancienne adresse n’apparaît ni dans src/, ni dans public/, ni dans index.html', () => {
    const fautifs = cibles.filter(f => readFileSync(f, 'utf8').includes(ANCIENNE)).map(f => relative(racine, f));
    expect(fautifs).toEqual([]);
  });

  test('le test parcourt bien les fichiers attendus', () => {
    const noms = cibles.map(f => relative(racine, f).replaceAll('\\', '/'));
    expect(noms).toContain('index.html');
    expect(noms).toContain('src/app/goDuJour.ts');
    expect(noms).toContain('public/manifest.webmanifest');
  });

  test('page et manifeste portent le nom Mochi Go et la nouvelle adresse', () => {
    const html = readFileSync(join(racine, 'index.html'), 'utf8');
    expect(html).toMatch(/<title>Mochi Go\b/);
    expect(html).toContain('<meta property="og:url" content="https://mochi-go.app/" />');
    const manifeste = JSON.parse(readFileSync(join(racine, 'public/manifest.webmanifest'), 'utf8')) as { name: string; short_name: string };
    expect(manifeste.short_name).toBe('Mochi Go');
    expect(manifeste.name.startsWith('Mochi Go')).toBe(true);
  });
});
