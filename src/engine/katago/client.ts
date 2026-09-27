// Côté page : pilote le Worker KataGo. Si le Worker, le backend ou le réseau manquent,
// `analyze` échoue vite et l'appelant se replie sur le moteur simple.
import type { Position } from '../../go/rules';
import type { AnalyzeOptions, Analysis } from './search';
import type { KgRequest, KgResponse } from './worker';
import { DEFAULT_MODEL_URL, type Backend } from './loader';

export type KataGoState = 'inactif' | 'chargement' | 'pret' | 'indisponible';

export interface KataGoInfo { state: KataGoState; backend?: Backend; name?: string; loadMs?: number; fromCache?: boolean; error?: string }

/** Ce dont le client a besoin d'un Worker (un faux suffit dans les tests). */
export interface WorkerLike {
  postMessage(m: KgRequest): void;
  onmessage: ((e: MessageEvent<KgResponse>) => void) | null;
  onerror: ((e: unknown) => void) | null;
  terminate(): void;
}

export interface ClientOptions {
  makeWorker: () => WorkerLike;
  url?: string;
  /** Attente maximale du chargement avant de rendre la main (le chargement continue en fond). */
  initWaitMs?: number;
  /** Délai maximal d'une analyse. */
  timeoutMs?: number;
}

export class KataGoClient {
  info: KataGoInfo = { state: 'inactif' };
  private w: WorkerLike | null = null;
  private next = 1;
  private pending = new Map<number, (r: KgResponse) => void>();
  private ready: Promise<void> | null = null;

  constructor(private o: ClientOptions) {}

  private send(m: KgRequest): Promise<KgResponse> {
    return new Promise(resolve => { this.pending.set(m.id, resolve); this.w!.postMessage(m); });
  }

  private fail(error: string) {
    this.info = { state: 'indisponible', error };
    this.w?.terminate();
    this.w = null;
    for (const [id, cb] of this.pending) cb({ id, type: 'error', error });
    this.pending.clear();
  }

  /** Lance le chargement (idempotent). Peut être appelé tôt, par exemple au choix de l'adversaire. */
  start(): Promise<void> {
    if (this.ready) return this.ready;
    this.info = { state: 'chargement' };
    this.ready = (async () => {
      try {
        this.w = this.o.makeWorker();
        this.w.onmessage = e => { this.pending.get(e.data.id)?.(e.data); this.pending.delete(e.data.id); };
        this.w.onerror = e => this.fail(`worker: ${String((e as ErrorEvent)?.message ?? e)}`);
      } catch (e) { this.fail(String(e)); throw e; }
      const r = await this.send({ id: this.next++, type: 'init', url: this.o.url ?? DEFAULT_MODEL_URL });
      if (r.type !== 'ready') { this.fail(r.type === 'error' ? r.error : 'réponse inattendue'); throw new Error(this.info.error); }
      this.info = { state: 'pret', backend: r.backend, name: r.name, loadMs: r.ms, fromCache: r.fromCache };
    })();
    this.ready.catch(() => {});
    return this.ready;
  }

  async analyze(pos: Position, opts: AnalyzeOptions = {}): Promise<Analysis> {
    if (this.info.state === 'indisponible') throw new Error(`KataGo indisponible : ${this.info.error}`);
    const ready = this.start();
    await withTimeout(ready, this.o.initWaitMs ?? 15000, 'KataGo pas encore prêt');
    const r = await withTimeout(this.send({ id: this.next++, type: 'analyze', pos, opts }), this.o.timeoutMs ?? 20000, 'analyse trop longue');
    if (r.type !== 'analysis') throw new Error(r.type === 'error' ? r.error : 'réponse inattendue');
    return r.analysis;
  }

  dispose() { this.w?.terminate(); this.w = null; this.ready = null; this.info = { state: 'inactif' }; }
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
