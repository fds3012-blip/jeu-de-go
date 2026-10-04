// Web Worker KataGo : charge TensorFlow.js et le réseau à la demande, puis analyse les positions.
// TensorFlow.js est importé dynamiquement : il n'entre ni dans le bundle principal, ni dans le Worker
// du moteur simple.
import type { Position } from '../../go/rules';
import { BACKEND_ORDER, loadModelBytes, selectBackend, type Backend } from './loader';
import { TfNet } from './net';
import { gunzip, parseNet } from './parse';
import { search, type AnalyzeOptions, type Analysis } from './search';

export type KgRequest =
  | { id: number; type: 'init'; url: string; backends?: Backend[] }
  | { id: number; type: 'analyze'; pos: Position; opts: AnalyzeOptions };

export type KgResponse =
  | { id: number; type: 'ready'; backend: Backend; name: string; ms: number; fromCache: boolean }
  | { id: number; type: 'analysis'; analysis: Analysis }
  | { id: number; type: 'error'; error: string };

let net: TfNet | null = null;
let queue: Promise<unknown> = Promise.resolve();
const post = (r: KgResponse) => (self as unknown as Worker).postMessage(r);

async function init(url: string, backends: Backend[] = BACKEND_ORDER) {
  const t0 = performance.now();
  const tf = await import('@tensorflow/tfjs');
  const env = {
    hasWebGPU: typeof navigator !== 'undefined' && 'gpu' in navigator,
    loadWebGPU: () => import('@tensorflow/tfjs-backend-webgpu'),
    check: async () => { const t = tf.tidy(() => tf.add(tf.scalar(1), tf.scalar(2))); const v = (await t.data())[0]; t.dispose(); return v === 3; },
  };
  // Premier backend choisi avant le téléchargement : sans aucun backend, inutile de télécharger le réseau.
  let backend: Backend = await selectBackend(tf, env, backends);
  const { bytes, fromCache } = await loadModelBytes(url, { fetch: u => fetch(u), caches: typeof caches !== 'undefined' ? caches : undefined });
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
      return { backend, name: net.name, ms: performance.now() - t0, fromCache };
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

self.onmessage = (e: MessageEvent<KgRequest>) => {
  const m = e.data;
  // Une requête à la fois : le GPU n'aime pas les évaluations entremêlées.
  queue = queue.then(async () => {
    try {
      if (m.type === 'init') {
        const r = await init(m.url, m.backends);
        post({ id: m.id, type: 'ready', ...r });
      } else {
        if (!net) throw new Error('KataGo non initialisé');
        post({ id: m.id, type: 'analysis', analysis: await search(net, m.pos, m.opts) });
      }
    } catch (err) {
      post({ id: m.id, type: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  });
};
