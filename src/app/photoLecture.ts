// Photo du plateau (#655) : ouverture de l'image et lecture dans un worker. Tout reste sur l'appareil : l'image est
// décodée par le navigateur, réduite dans un canvas, puis confiée au worker de lecture ; rien n'est envoyé ni gardé.
import type { Coins } from '../go/photo/homographie';
import type { Reconnaissance } from '../go/photo/reconnaissance';
import type { DemandePhoto, ReponsePhoto } from '../go/photo/photo.worker';

/** Plus grand côté gardé : assez pour un 19 × 19 (environ 70 pixels par case), léger pour un vieux téléphone. */
export const COTE_MAX = 1600;

/** Une demande au worker, sans son numéro (posé à l'envoi). */
type SansId<T> = T extends unknown ? Omit<T, 'id'> : never;

export interface PhotoOuverte { canvas: HTMLCanvasElement; image: ImageData }

/** Taille réduite pour que le plus grand côté tienne dans `max`. */
export function tailleReduite(l: number, h: number, max = COTE_MAX): { l: number; h: number } {
  const k = Math.min(1, max / Math.max(l, h));
  return { l: Math.max(1, Math.round(l * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Décode la photo choisie (orientation de l'appareil respectée) et la réduit. Lève une erreur si ce n'est pas une image. */
export async function ouvrirPhoto(fichier: Blob): Promise<PhotoOuverte> {
  if (fichier.type && !fichier.type.startsWith('image/')) throw new Error('pas une image');
  let source: CanvasImageSource, l: number, h: number, fermer = () => {};
  if (typeof createImageBitmap === 'function') {
    const b = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
    source = b; l = b.width; h = b.height; fermer = () => b.close();
  } else {
    const url = URL.createObjectURL(fichier);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      source = img; l = img.naturalWidth; h = img.naturalHeight;
    } finally { URL.revokeObjectURL(url); }
  }
  const t = tailleReduite(l, h), canvas = document.createElement('canvas');
  canvas.width = t.l; canvas.height = t.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas indisponible');
  ctx.drawImage(source, 0, 0, t.l, t.h);
  fermer();
  return { canvas, image: ctx.getImageData(0, 0, t.l, t.h) };
}

export interface Lecteur {
  proposerCoins(taille: number): Promise<Coins | null>;
  lire(coins: Coins, taille: number): Promise<Reconnaissance>;
  /** Oublie l'image et arrête le worker. */
  fermer(): void;
}

/**
 * Lecteur de la photo, dans un worker (l'écran reste fluide). Sans worker (navigateur ancien, tests), la lecture se fait
 * sur le fil principal, avec les mêmes fonctions.
 */
export async function creerLecteur(image: ImageData): Promise<Lecteur> {
  let w: Worker | null;
  try { w = new Worker(new URL('../go/photo/photo.worker.ts', import.meta.url), { type: 'module' }); } catch { w = null; }
  if (!w) return lecteurLocal(image);
  const worker = w, attentes = new Map<number, (r: ReponsePhoto) => void>();
  let suivant = 1;
  worker.onmessage = (e: MessageEvent<ReponsePhoto>) => { attentes.get(e.data.id)?.(e.data); attentes.delete(e.data.id); };
  const demander = (d: SansId<DemandePhoto>, transfert: Transferable[] = []) => new Promise<ReponsePhoto>((resolve, reject) => {
    const id = suivant++;
    attentes.set(id, resolve);
    worker.onerror = () => { for (const f of attentes.values()) f({ id: 0, ok: false }); attentes.clear(); reject(new Error('worker')); };
    worker.postMessage({ ...d, id } as DemandePhoto, transfert);
  });
  // L'image part dans le worker (copie) : l'écran garde son canvas pour l'affichage et la loupe.
  const copie = { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
  const r = await demander({ quoi: 'image', image: copie }, [copie.data.buffer]).catch(() => null);
  if (!r?.ok) { worker.terminate(); return lecteurLocal(image); }
  return {
    async proposerCoins(taille) {
      const r = await demander({ quoi: 'coins', taille });
      return r.ok ? r.coins ?? null : null;
    },
    async lire(coins, taille) {
      const r = await demander({ quoi: 'lire', coins, taille });
      if (!r.ok || !r.plateau || !r.confiance) throw new Error('lecture');
      return { taille, plateau: r.plateau, confiance: r.confiance, incertaines: r.incertaines ?? [] };
    },
    fermer() { worker.postMessage({ id: 0, quoi: 'oublier' } satisfies DemandePhoto); worker.terminate(); attentes.clear(); },
  };
}

async function lecteurLocal(image: ImageData): Promise<Lecteur> {
  const [{ proposerCoins }, { reconnaitre }] = await Promise.all([import('../go/photo/coins'), import('../go/photo/reconnaissance')]);
  return {
    proposerCoins: async taille => proposerCoins(image, taille),
    lire: async (coins, taille) => reconnaitre(image, coins, taille),
    fermer() {},
  };
}
