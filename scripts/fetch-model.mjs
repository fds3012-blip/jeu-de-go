// Met le réseau KataGo g170-b6c96 (~3,8 Mo) dans public/models/ pour les tests qui tournent avec le vrai réseau
// (src/engine/katago/real.test.ts, e2e/revue-katago.spec.ts, outils/preuvesKataGo.ts…). public/models/ est ignoré
// par git : ces tests restent donc facultatifs, en local comme en CI.
// Depuis #475, le réseau est versionné dans public/reseaux/ (servi par l'app) : on le recopie, sans réseau.
// KATAGO_MODEL_SOURCE=<url> force un téléchargement.
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const NAME = 'g170-b6c96-s175395328-d26788732.bin.gz';
const VERSIONNE = fileURLToPath(new URL('../public/reseaux/g170-b6c96-s175395328-d26788732.f5d32604.bin.gz', import.meta.url));
const SOURCE = process.env.KATAGO_MODEL_SOURCE;
const dir = fileURLToPath(new URL('../public/models/', import.meta.url));
const out = dir + NAME;

try {
  const s = await stat(out);
  if (s.size > 1_000_000) {
    console.log(`Déjà présent : public/models/${NAME} (${s.size} octets)`);
    process.exit(0);
  }
} catch {
  /* absent */
}
await mkdir(dir, { recursive: true });
if (!SOURCE && existsSync(VERSIONNE)) {
  await copyFile(VERSIONNE, out);
  console.log(`Copié depuis public/reseaux/ : public/models/${NAME}`);
  process.exit(0);
}
const url = SOURCE ?? `https://raw.githubusercontent.com/lightvector/KataGo/master/cpp/tests/models/${NAME}`;
const res = await fetch(url);
if (!res.ok) {
  console.error(`Échec du téléchargement (${res.status}) : ${url}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
if (buf[0] !== 0x1f || buf[1] !== 0x8b) {
  console.error('Fichier reçu invalide (pas un .gz)');
  process.exit(1);
}
await writeFile(out, buf);
console.log(`Enregistré : public/models/${NAME} (${buf.length} octets)`);
