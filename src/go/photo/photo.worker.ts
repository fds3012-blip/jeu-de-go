// Worker de la photo du plateau (#655) : garde l'image et la lit sans bloquer l'écran (un 19 × 19 demande quelques
// centaines de millisecondes, plus sur un vieux téléphone). Rien ne sort de l'appareil : l'image ne quitte pas ce worker.
import { proposerCoins } from './coins';
import type { Coins } from './homographie';
import { reconnaitre, type ImageRGBA } from './reconnaissance';

export type DemandePhoto =
  | { id: number; quoi: 'image'; image: ImageRGBA }
  | { id: number; quoi: 'coins'; taille: number }
  | { id: number; quoi: 'lire'; coins: Coins; taille: number }
  | { id: number; quoi: 'oublier' };

export type ReponsePhoto =
  | { id: number; ok: true; coins?: Coins | null; plateau?: Int8Array; confiance?: Float32Array; incertaines?: number[] }
  | { id: number; ok: false };

let image: ImageRGBA | null = null;

self.onmessage = (e: MessageEvent<DemandePhoto>) => {
  const d = e.data, repondre = (r: ReponsePhoto) => (self as unknown as Worker).postMessage(r);
  try {
    if (d.quoi === 'image') { image = d.image; repondre({ id: d.id, ok: true }); return; }
    if (d.quoi === 'oublier') { image = null; repondre({ id: d.id, ok: true }); return; }
    if (!image) { repondre({ id: d.id, ok: false }); return; }
    if (d.quoi === 'coins') { repondre({ id: d.id, ok: true, coins: proposerCoins(image, d.taille) }); return; }
    const r = reconnaitre(image, d.coins, d.taille);
    repondre({ id: d.id, ok: true, plateau: r.plateau, confiance: r.confiance, incertaines: r.incertaines });
  } catch {
    repondre({ id: d.id, ok: false });
  }
};
