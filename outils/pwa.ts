/**
 * Service worker : liste des fichiers mis en cache dès l'installation (perf et hors-ligne, 29/09).
 *
 * Avant, seul `/` était mis en cache à l'installation. Le JS et le CSS de la première visite, chargés avant
 * que le service worker ne contrôle la page, n'étaient pas dans son cache : rouvrir l'app sans réseau
 * pouvait donner un écran vide. Le build injecte maintenant dans `dist/sw.js` :
 * - la version (empreinte des fichiers) : chaque déploiement installe un nouveau cache et efface l'ancien ;
 * - la liste des fichiers de l'app : JS initial, écrans chargés à la demande, CSS, polices, moteur simple.
 * Restent hors de cette liste (mis en cache au premier usage) : KataGo et TensorFlow.js, PostHog, Sentry.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/** Ce que le calcul lit d'un morceau du bundle Rollup. */
export interface Morceau {
  type: 'chunk' | 'asset';
  fileName: string;
  isEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  moduleIds?: string[];
  viteMetadata?: { importedCss: Set<string>; importedAssets: Set<string> };
}

/** Fichiers publics indispensables hors ligne. */
export const COQUILLE = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];

/** Un import dynamique fait partie de l'app s'il contient du code de src/ (pas PostHog ni Sentry seuls). */
const codeDeLApp = (m: Morceau) => (m.moduleIds ?? []).some(id => /\/src\//.test(id) && !id.includes('node_modules'));

/** Worker du moteur simple (adversaires de l'échelle) : nécessaire pour jouer hors ligne. KataGo reste à part. */
const WORKER_SIMPLE = /^assets\/simple\.worker-[\w-]+\.js$/;

export function listePrecache(bundle: Record<string, Morceau>): string[] {
  const vus = new Set<string>();
  const fichiers = new Set<string>();
  const visiter = (nom: string) => {
    const m = bundle[nom];
    if (!m || vus.has(nom)) return;
    vus.add(nom);
    fichiers.add(nom);
    if (m.type !== 'chunk') return;
    m.viteMetadata?.importedCss.forEach(f => fichiers.add(f));
    m.viteMetadata?.importedAssets.forEach(f => fichiers.add(f));
    m.imports?.forEach(visiter);
    m.dynamicImports?.forEach(d => { if (bundle[d] && codeDeLApp(bundle[d])) visiter(d); });
  };
  for (const m of Object.values(bundle)) if (m.type === 'chunk' && m.isEntry) visiter(m.fileName);
  for (const m of Object.values(bundle)) {
    if (m.type === 'asset' && (/\.(woff2|css)$/.test(m.fileName) || WORKER_SIMPLE.test(m.fileName))) fichiers.add(m.fileName);
  }
  return [...fichiers].filter(f => !f.endsWith('.map') && !f.endsWith('.html')).map(f => `/${f}`).sort();
}

/** Ligne de public/sw.js remplacée au build. */
export const MARQUEUR = /^const BUILD = \{[^\n]*\};$/m;

export function injecterDansSw(source: string, fichiers: string[]): string {
  if (!MARQUEUR.test(source)) throw new Error('public/sw.js : ligne `const BUILD = { … };` introuvable');
  const version = createHash('sha256').update(fichiers.join('\n')).digest('hex').slice(0, 12);
  return source.replace(MARQUEUR, `const BUILD = ${JSON.stringify({ version, precache: [...COQUILLE, ...fichiers] })};`);
}

/** Plugin Vite : calcule la liste pendant le build et l'écrit dans dist/sw.js une fois le build écrit. */
export function precacheSw(): Plugin {
  let outDir = 'dist';
  let fichiers: string[] = [];
  return {
    name: 'go-precache-sw',
    apply: 'build',
    configResolved(c) { outDir = join(c.root, c.build.outDir); },
    generateBundle(_, bundle) { fichiers = listePrecache(bundle as unknown as Record<string, Morceau>); },
    closeBundle() {
      const sw = join(outDir, 'sw.js');
      writeFileSync(sw, injecterDansSw(readFileSync(sw, 'utf8'), fichiers));
    },
  };
}
