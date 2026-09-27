// Télécharge le réseau KataGo g170-b6c96 (~3,8 Mo) dans public/models/ pour l'héberger avec l'app.
// Le fichier est ignoré par git. Ensuite : VITE_KATAGO_MODEL_URL=/models/g170-b6c96-s175395328-d26788732.bin.gz
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const NAME = 'g170-b6c96-s175395328-d26788732.bin.gz';
const SOURCE = process.env.KATAGO_MODEL_SOURCE ?? `https://raw.githubusercontent.com/lightvector/KataGo/master/cpp/tests/models/${NAME}`;
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
const res = await fetch(SOURCE);
if (!res.ok) {
  console.error(`Échec du téléchargement (${res.status}) : ${SOURCE}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
if (buf[0] !== 0x1f || buf[1] !== 0x8b) {
  console.error('Fichier reçu invalide (pas un .gz)');
  process.exit(1);
}
await writeFile(out, buf);
console.log(`Enregistré : public/models/${NAME} (${buf.length} octets)`);
