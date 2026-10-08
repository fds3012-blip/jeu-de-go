// Web Worker KataGo : charge TensorFlow.js et le réseau à la demande, puis analyse les positions.
// TensorFlow.js est importé dynamiquement : il n'entre ni dans le bundle principal, ni dans le Worker
// du moteur simple.
import type { Position } from '../../go/rules';
import { BACKEND_ORDER, loadModelBytes, MODEL_OCTETS, MODEL_OCTETS_DECOMPRESSE, selectBackend, type Backend } from './loader';
import { TfNet } from './net';
import { gunzip, parseNet } from './parse';
import { search, type AnalyzeOptions, type Analysis } from './search';

/** Où chercher le réseau (#475) : adresses dans l'ordre, empreinte attendue, téléchargement permis ou cache seul. */
export interface SourceReseau { urls: string[]; sha256?: string | string[]; telechargement?: boolean }

export type KgRequest =
  | ({ id: number; type: 'init'; backends?: Backend[] } & SourceReseau)
  | ({ id: number; type: 'precharger' } & SourceReseau)
  | { id: number; type: 'analyze'; pos: Position; opts: AnalyzeOptions };

/** Durées du démarrage (ms) : TensorFlow.js et backend, réseau (cache ou téléchargement), lecture et préchauffage. */
export interface EtapesDemarrage { backend: number; reseau: number; demarrage: number }

export type KgResponse =
  | { id: number; type: 'ready'; backend: Backend; name: string; ms: number; fromCache: boolean; url?: string; etapes?: EtapesDemarrage }
  | { id: number; type: 'progress'; recu: number; total: number }
  | { id: number; type: 'precharge'; fromCache: boolean; ms: number }
  | { id: number; type: 'analysis'; analysis: Analysis }
  | { id: number; type: 'error'; error: string };

let net: TfNet | null = null;
let queue: Promise<unknown> = Promise.resolve();
const post = (r: KgResponse) => (self as unknown as Worker).postMessage(r);

/** Progression envoyée à la page au plus toutes les 100 ms (et toujours à la fin). */
function progression(id: number) {
  let dernier = 0;
  return (recu: number, total: number) => {
    const t = performance.now();
    if (recu < total && t - dernier < 100) return;
    dernier = t;
    post({ id, type: 'progress', recu, total });
  };
}

function telecharger(id: number, src: SourceReseau, signal?: AbortSignal) {
  return loadModelBytes(src.urls, {
    fetch: (u, init) => fetch(u, init), caches: typeof caches !== 'undefined' ? caches : undefined,
    onProgress: progression(id), sha256: src.sha256, telechargement: src.telechargement, signal, totalParDefaut: MODEL_OCTETS, totalDecompresse: MODEL_OCTETS_DECOMPRESSE,
  });
}

async function init(id: number, src: SourceReseau, backends: Backend[] = BACKEND_ORDER) {
  const t0 = performance.now();
  // #475 : le réseau se télécharge (ou se lit du cache) pendant que TensorFlow.js se charge et choisit son backend,
  // au lieu d'attendre la fin de ce choix. Sans aucun backend, le téléchargement est interrompu.
  const arret = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  let tReseau = 0;
  const reseau = telecharger(id, src, arret?.signal).then(r => { tReseau = performance.now(); return r; });
  reseau.catch(() => {});
  // Cache seul (téléchargement non permis) : sans réseau en cache, inutile de charger TensorFlow.js.
  if (src.telechargement === false) await reseau;
  const tf = await import('@tensorflow/tfjs');
  const env = {
    hasWebGPU: typeof navigator !== 'undefined' && 'gpu' in navigator,
    loadWebGPU: () => import('@tensorflow/tfjs-backend-webgpu'),
    check: async () => { const t = tf.tidy(() => tf.add(tf.scalar(1), tf.scalar(2))); const v = (await t.data())[0]; t.dispose(); return v === 3; },
  };
  let backend: Backend;
  try { backend = await selectBackend(tf, env, backends); } catch (e) { arret?.abort(); throw e; }
  const tBackend = performance.now();
  const { bytes, fromCache, url } = await reseau;
  const parsed = parseNet(await gunzip(bytes));
  const { newPosition } = await import('../../go/rules');
  // #424 : un backend peut passer le petit calcul de contrôle puis échouer sur le vrai réseau (WebGPU récent de
  // Safari, WebGL d'un Worker sans OffscreenCanvas). On essaie alors le suivant, jusqu'au CPU, au lieu d'abandonner.
  const erreurs: string[] = [];
  for (;;) {
    try {
      net = new TfNet(tf, parsed);
      // Préchauffage : compile les shaders pour éviter un premier coup lent.
      await search(net, newPosition(9), { visits: 2 });
      const fin = performance.now();
      const etapes = { backend: Math.round(tBackend - t0), reseau: Math.round(tReseau - t0), demarrage: Math.round(fin - Math.max(tBackend, tReseau)) };
      return { backend, name: net.name, ms: fin - t0, fromCache, url, etapes };
    } catch (e) {
      erreurs.push(`${backend}: ${e instanceof Error ? e.message : String(e)}`);
      try { net?.dispose(); } catch { /* backend déjà cassé */ }
      net = null;
    }
    const reste = backends.slice(backends.indexOf(backend) + 1);
    if (!reste.length) throw new Error(`KataGo ne démarre sur aucun backend (${erreurs.join(' ; ')})`);
    backend = await selectBackend(tf, env, reste);
  }
}

/**
 * Préchargement discret (#475) : met le réseau en cache et charge le code de TensorFlow.js (gardé ensuite par le
 * service worker), sans choisir de backend ni réserver le GPU. Le démarrage suivant ne demande plus rien au réseau.
 */
async function precharger(id: number, src: SourceReseau) {
  const t0 = performance.now();
  const [r] = await Promise.all([telecharger(id, src), import('@tensorflow/tfjs')]);
  return { fromCache: r.fromCache, ms: performance.now() - t0 };
}

self.onmessage = (e: MessageEvent<KgRequest>) => {
  const m = e.data;
  // Une requête à la fois : le GPU n'aime pas les évaluations entremêlées.
  queue = queue.then(async () => {
    try {
      if (m.type === 'init') {
        const r = await init(m.id, m, m.backends);
        post({ id: m.id, type: 'ready', ...r });
      } else if (m.type === 'precharger') {
        post({ id: m.id, type: 'precharge', ...(await precharger(m.id, m)) });
      } else {
        if (!net) throw new Error('KataGo non initialisé');
        post({ id: m.id, type: 'analysis', analysis: await search(net, m.pos, m.opts) });
      }
    } catch (err) {
      post({ id: m.id, type: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  });
};
