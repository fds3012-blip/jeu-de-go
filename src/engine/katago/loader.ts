// Chargement de KataGo : choix du backend TensorFlow.js et réseau mis en cache (Cache API).
// Toutes les dépendances sont injectables pour les tests (pas de navigateur dans Vitest).

export const MODEL_NAME = 'g170-b6c96-s175395328-d26788732';

/** Empreinte SHA-256 du fichier `.bin.gz` publié par KataGo (vérifiée à chaque téléchargement, #475). */
export const MODEL_SHA256 = 'f5d32604e3675c480c7c8f6aa579a1ea857135628a0afccc8fa56330fbacd38d';
/**
 * Empreinte du même réseau décompressé : un serveur peut servir le `.bin.gz` avec `Content-Encoding: gzip`
 * (c'est le cas de `vite preview`) ; le navigateur le décompresse alors en route. Les deux formes sont acceptées.
 */
export const MODEL_SHA256_DECOMPRESSE = '2bcc7c4daac6e33e9b9f5f8a427e1536b50aa705cfdb7fe21bffacbcdbfc7242';
/** Taille du fichier (octets) : sert à la progression quand le serveur ne donne pas `Content-Length`. */
export const MODEL_OCTETS = 3_827_339;
/** Taille décompressée : progression d'un fichier décompressé en route. */
export const MODEL_OCTETS_DECOMPRESSE = 4_124_446;
/** Nom publié, avec l'empreinte : un autre réseau aura un autre nom, le fichier peut donc être gardé un an. */
export const MODEL_FILE = `${MODEL_NAME}.${MODEL_SHA256.slice(0, 8)}.bin.gz`;

/**
 * URL par défaut du réseau (#475) : servi par l'app elle-même (`public/reseaux/`, en-têtes de cache long dans
 * vercel.json), relative à la page. Remplaçable par `VITE_KATAGO_MODEL_URL`.
 */
export const DEFAULT_MODEL_URL = `/reseaux/${MODEL_FILE}`;

/**
 * Repli si notre copie ne répond pas : la copie officielle du dépôt KataGo (cpp/tests/models), servie avec
 * `Access-Control-Allow-Origin: *`. C'était l'URL par défaut jusqu'à #475 : les joueurs qui l'ont en cache la gardent.
 */
export const LEGACY_MODEL_URL = `https://raw.githubusercontent.com/lightvector/KataGo/master/cpp/tests/models/${MODEL_NAME}.bin.gz`;

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

/** Progression du téléchargement : octets reçus, octets attendus. */
export type Progression = (recu: number, total: number) => void;

export interface LoadDeps {
  fetch: (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;
  caches?: Pick<CacheStorage, 'open'>;
  /** Appelé pendant le téléchargement (jamais pour une lecture du cache). */
  onProgress?: Progression;
  /**
   * Empreinte(s) SHA-256 acceptée(s) (hexadécimal) : un fichier différent est refusé et l'URL suivante essayée.
   * Plusieurs : le fichier tel quel et sa forme décompressée en route.
   */
  sha256?: string | string[];
  /** Calcul de l'empreinte (par défaut : crypto.subtle ; sans lui, pas de vérification). */
  digest?: (b: Uint8Array) => Promise<string | null>;
  /** `false` : lire le cache seulement, ne rien télécharger. */
  telechargement?: boolean;
  signal?: AbortSignal;
  /** Taille attendue si le serveur ne donne pas `Content-Length`. */
  totalParDefaut?: number;
  /** Taille attendue si le serveur compresse en route (`Content-Encoding`) : `Content-Length` compte alors autre chose. */
  totalDecompresse?: number;
}

export interface ModelBytes { bytes: Uint8Array; fromCache: boolean; url: string }

async function sha256Hex(b: Uint8Array): Promise<string | null> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) return null; // page non sécurisée (http d'un réseau local) : pas de vérification possible
  const h = new Uint8Array(await subtle.digest('SHA-256', b as BufferSource));
  return Array.from(h, x => x.toString(16).padStart(2, '0')).join('');
}

/** Lit la réponse en signalant la progression (lecture en flux quand c'est possible). */
async function lireAvecProgression(res: Response, onProgress: Progression | undefined, totalParDefaut = 0, totalDecompresse = 0): Promise<Uint8Array> {
  const annonce = Number(res.headers.get('content-length')) || 0;
  if (!onProgress || !res.body) return new Uint8Array(await res.arrayBuffer());
  // Compressé en route : `Content-Length` est la taille compressée, le flux donne les octets décompressés.
  let total = res.headers.get('content-encoding') ? totalDecompresse || annonce : annonce || totalParDefaut;
  const reader = res.body.getReader();
  const morceaux: Uint8Array[] = [];
  let recu = 0;
  onProgress(0, total);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    morceaux.push(value);
    recu += value.length;
    if (recu > total) total = recu; // `Content-Length` absent ou compressé : on ne dépasse jamais 100 %
    onProgress(recu, total);
  }
  const out = new Uint8Array(recu);
  let o = 0;
  for (const m of morceaux) { out.set(m, o); o += m.length; }
  onProgress(recu, recu);
  return out;
}

/**
 * Télécharge le réseau une seule fois : les chargements suivants viennent du cache du navigateur.
 * `urls` : dans l'ordre de préférence (#475 : notre copie, puis celle du dépôt KataGo). Le cache est consulté pour
 * chacune (un joueur qui a l'ancienne copie ne retélécharge rien) ; un nouveau téléchargement est rangé sous la
 * première URL.
 */
export async function loadModelBytes(urls: string | string[], deps: LoadDeps): Promise<ModelBytes> {
  const liste = typeof urls === 'string' ? [urls] : urls;
  if (!liste.length) throw new Error('Téléchargement du réseau impossible (aucune adresse)');
  let cache: Cache | undefined;
  try { cache = deps.caches ? await deps.caches.open(CACHE_NAME) : undefined; } catch { cache = undefined; }
  if (cache) {
    for (const url of liste) {
      const hit = await cache.match(url);
      if (hit) return { bytes: new Uint8Array(await hit.arrayBuffer()), fromCache: true, url };
    }
  }
  if (deps.telechargement === false) throw new Error('Téléchargement du réseau impossible (non autorisé ici)');
  const erreurs: string[] = [];
  for (const url of liste) {
    try {
      const res = await deps.fetch(url, deps.signal ? { signal: deps.signal } : undefined);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = await lireAvecProgression(res, deps.onProgress, deps.totalParDefaut, deps.totalDecompresse);
      if (bytes.length < 1024) throw new Error('Réseau trop petit : fichier invalide');
      if (deps.sha256) {
        const h = await (deps.digest ?? sha256Hex)(bytes);
        if (h !== null && ![deps.sha256].flat().includes(h)) throw new Error(`empreinte inattendue (${bytes.length} octets, ${h.slice(0, 8)}) : fichier refusé`);
      }
      if (cache) {
        try { await cache.put(liste[0], new Response(bytes as BlobPart, { headers: { 'content-type': 'application/octet-stream' } })); } catch { /* quota plein : on continue sans cache */ }
      }
      return { bytes, fromCache: false, url };
    } catch (e) {
      if (deps.signal?.aborted) throw new Error('Téléchargement du réseau interrompu', { cause: e });
      erreurs.push(`${url} : ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`Téléchargement du réseau impossible (${erreurs.join(' ; ')})`);
}

/** Ordre des backends à essayer : celui qui a déjà marché sur cet appareil d'abord (#475), puis les autres. */
export function ordreBackends(memorise?: Backend | null): Backend[] {
  return memorise && BACKEND_ORDER.includes(memorise) ? [memorise, ...BACKEND_ORDER.filter(b => b !== memorise)] : [...BACKEND_ORDER];
}
