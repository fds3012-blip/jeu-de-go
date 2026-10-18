// PNG RGBA 8 bits, encodage et décodage minimaux (#655), pour les photos de test seulement (Node : node:zlib).
// Jamais importé par l'app : le navigateur décode les photos lui-même (createImageBitmap).
import { deflateSync, inflateSync } from 'node:zlib';
import type { ImageRGBA } from './reconnaissance';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const v of b) c = TABLE_CRC[(c ^ v) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function morceau(type: string, donnees: Uint8Array): Buffer {
  const longueur = Buffer.alloc(4); longueur.writeUInt32BE(donnees.length);
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(donnees)]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corps));
  return Buffer.concat([longueur, corps, crc]);
}

/** Encode une image RGBA en PNG (filtre « Sub » sur chaque ligne : fichiers plus petits). */
export function encoderPng(img: ImageRGBA): Buffer {
  const { width: w, height: h, data } = img, ligne = w * 4;
  const brut = Buffer.alloc((ligne + 1) * h);
  for (let y = 0; y < h; y++) {
    brut[y * (ligne + 1)] = 1;
    for (let i = 0; i < ligne; i++) {
      const v = data[y * ligne + i], gauche = i >= 4 ? data[y * ligne + i - 4] : 0;
      brut[y * (ligne + 1) + 1 + i] = (v - gauche) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([SIGNATURE, morceau('IHDR', ihdr), morceau('IDAT', deflateSync(brut, { level: 9 })), morceau('IEND', new Uint8Array())]);
}

/** Décode un PNG RGB ou RGBA 8 bits, non entrelacé (ceux de encoderPng, et la plupart des PNG courants). */
export function decoderPng(fichier: Uint8Array): ImageRGBA & { data: Uint8ClampedArray } {
  const b = Buffer.from(fichier);
  if (!b.subarray(0, 8).equals(SIGNATURE)) throw new Error('pas un PNG');
  let pos = 8, w = 0, h = 0, canaux = 4;
  const idat: Buffer[] = [];
  while (pos < b.length) {
    const n = b.readUInt32BE(pos), type = b.toString('ascii', pos + 4, pos + 8), d = b.subarray(pos + 8, pos + 8 + n);
    if (type === 'IHDR') {
      w = d.readUInt32BE(0); h = d.readUInt32BE(4);
      if (d[8] !== 8 || (d[9] !== 6 && d[9] !== 2) || d[12] !== 0) throw new Error('PNG non pris en charge');
      canaux = d[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(d);
    pos += 12 + n;
  }
  const brut = inflateSync(Buffer.concat(idat)), ligne = w * canaux, sortie = new Uint8Array(ligne * h);
  for (let y = 0; y < h; y++) {
    const f = brut[y * (ligne + 1)], src = y * (ligne + 1) + 1;
    for (let i = 0; i < ligne; i++) {
      const a = i >= canaux ? sortie[y * ligne + i - canaux] : 0, hb = y ? sortie[(y - 1) * ligne + i] : 0;
      const c = y && i >= canaux ? sortie[(y - 1) * ligne + i - canaux] : 0;
      let pred = 0;
      if (f === 1) pred = a; else if (f === 2) pred = hb; else if (f === 3) pred = (a + hb) >> 1;
      else if (f === 4) { const p = a + hb - c, pa = Math.abs(p - a), pb = Math.abs(p - hb), pc = Math.abs(p - c); pred = pa <= pb && pa <= pc ? a : pb <= pc ? hb : c; }
      sortie[y * ligne + i] = (brut[src + i] + pred) & 0xff;
    }
  }
  const data = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    for (let k = 0; k < 3; k++) data[p * 4 + k] = sortie[p * canaux + k];
    data[p * 4 + 3] = canaux === 4 ? sortie[p * canaux + 3] : 255;
  }
  return { width: w, height: h, data };
}
