// Chargement de KataGo : choix du backend TensorFlow.js et réseau mis en cache (Cache API).
// Toutes les dépendances sont injectables pour les tests (pas de navigateur dans Vitest).

export const MODEL_NAME = 'g170-b6c96-s175395328-d26788732';

/**
 * URL par défaut du réseau : copie officielle dans le dépôt KataGo (cpp/tests/models), servie avec
 * `Access-Control-Allow-Origin: *`. Pour l'héberger soi-même : `npm run fetch-model` puis
 * `VITE_KATAGO_MODEL_URL=/models/g170-b6c96-s175395328-d26788732.bin.gz`.
 */
export const DEFAULT_MODEL_URL = `https://raw.githubusercontent.com/lightvector/KataGo/master/cpp/tests/models/${MODEL_NAME}.bin.gz`;

export const CACHE_NAME = 'katago-reseaux-v1';

export type Backend = 'webgpu' | 'webgl' | 'cpu';
export const BACKEND_ORDER: Backend[] = ['webgpu', 'webgl', 'cpu'];

/** Le strict nécessaire de TensorFlow.js pour choisir un backend. */
export interface TfBackendApi {
  setBackend(name: string): Promise<boolean>;
  ready(): Promise<void>;
  getBackend(): string;
}

export interface BackendEnv {
  /** WebGPU exposé par le navigateur (navigator.gpu). */
  hasWebGPU: boolean;
  /** Charge et enregistre le backend WebGPU (paquet séparé de TensorFlow.js). */
  loadWebGPU: () => Promise<unknown>;
  /** Petit calcul de contrôle : un backend qui s'initialise mais calcule faux est écarté. */
  check?: () => Promise<boolean>;
}

/** Essaie WebGPU, puis WebGL, puis CPU. Renvoie le premier backend qui fonctionne vraiment. */
export async function selectBackend(tf: TfBackendApi, env: BackendEnv, order: Backend[] = BACKEND_ORDER): Promise<Backend> {
  const errors: string[] = [];
  for (const b of order) {
    try {
      if (b === 'webgpu') {
        if (!env.hasWebGPU) { errors.push('webgpu: absent'); continue; }
        await env.loadWebGPU();
      }
      if (!(await tf.setBackend(b))) { errors.push(`${b}: refusé`); continue; }
      await tf.ready();
      if (tf.getBackend() !== b) { errors.push(`${b}: non actif`); continue; }
      if (env.check && !(await env.check())) { errors.push(`${b}: calcul incorrect`); continue; }
      return b;
    } catch (e) {
      errors.push(`${b}: ${String(e)}`);
    }
  }
  throw new Error(`Aucun backend TensorFlow.js utilisable (${errors.join(' ; ')})`);
}

export interface LoadDeps {
  fetch: (url: string) => Promise<Response>;
  caches?: Pick<CacheStorage, 'open'>;
}

/** Télécharge le réseau une seule fois : les chargements suivants viennent du cache du navigateur. */
export async function loadModelBytes(url: string, deps: LoadDeps): Promise<{ bytes: Uint8Array; fromCache: boolean }> {
  let cache: Cache | undefined;
  try { cache = deps.caches ? await deps.caches.open(CACHE_NAME) : undefined; } catch { cache = undefined; }
  if (cache) {
    const hit = await cache.match(url);
    if (hit) return { bytes: new Uint8Array(await hit.arrayBuffer()), fromCache: true };
  }
  const res = await deps.fetch(url);
  if (!res.ok) throw new Error(`Téléchargement du réseau impossible (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length < 1024) throw new Error('Réseau trop petit : fichier invalide');
  if (cache) {
    try { await cache.put(url, new Response(bytes as BlobPart, { headers: { 'content-type': 'application/octet-stream' } })); } catch { /* quota plein : on continue sans cache */ }
  }
  return { bytes, fromCache: false };
}
