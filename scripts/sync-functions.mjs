// Copie les règles du go (src/go) dans la fonction serveur supabase/functions/game-action/go.
// Deno exige l'extension des imports relatifs : `from './rules'` devient `from './rules.ts'`.
// Usage : npm run sync:functions (un test Vitest vérifie que la copie est à jour).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const GO_FILES = ['coords.ts', 'rules.ts', 'score.ts', 'sgf.ts', 'replay.ts', 'server.ts'];
export const SRC_DIR = 'src/go';
export const OUT_DIR = 'supabase/functions/game-action/go';

const HEADER = '// Fichier généré par scripts/sync-functions.mjs depuis src/go : ne pas modifier ici.\n';

/** Transforme un module de src/go en module Deno. */
export function toDeno(source) {
  return HEADER + source.replace(/(from\s+'\.\/[\w-]+)(')/g, '$1.ts$2');
}

async function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  await mkdir(`${root}${OUT_DIR}`, { recursive: true });
  for (const f of GO_FILES) {
    const src = await readFile(`${root}${SRC_DIR}/${f}`, 'utf8');
    await writeFile(`${root}${OUT_DIR}/${f}`, toDeno(src));
    console.log(`${OUT_DIR}/${f}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
