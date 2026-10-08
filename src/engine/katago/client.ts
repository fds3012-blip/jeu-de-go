// Côté page : pilote le Worker KataGo. Si le Worker, le backend ou le réseau manquent,
// `analyze` échoue vite et l'appelant se replie sur le moteur simple.
import type { Position } from '../../go/rules';
import type { AnalyzeOptions, Analysis } from './search';
import type { EtapesDemarrage, KgRequest, KgResponse, SourceReseau } from './worker';
import { DEFAULT_MODEL_URL, ordreBackends, type Backend } from './loader';

export type KataGoState = 'inactif' | 'chargement' | 'pret' | 'indisponible';

/** Téléchargement du réseau en cours (#475) : octets reçus et attendus. */
export interface ProgressionReseau { recu: number; total: number }

export interface KataGoInfo {
  state: KataGoState; backend?: Backend; name?: string; loadMs?: number; fromCache?: boolean; error?: string;
  /** Pendant un téléchargement du réseau (démarrage ou préchargement). */
  progression?: ProgressionReseau;
  /** Préchargement discret (#475) : sans effet sur `state`, qui reste `inactif` jusqu'au démarrage. */
  prechargement?: 'en-cours' | 'fait' | 'echec';
  /** Pourquoi le préchargement a échoué (diagnostic). */
  erreurPrechargement?: string;
  /** Adresse d'où vient le réseau et durées du démarrage (mesure, #475). */
  url?: string;
  etapes?: EtapesDemarrage;
}

/** Backend qui a déjà marché sur cet appareil (#475) : lu au démarrage, écrit après un succès, effacé après un échec. */
export interface MemoBackend { lire(): Backend | null; ecrire(b: Backend | null): void }

/** Ce dont le client a besoin d'un Worker (un faux suffit dans les tests). */
export interface WorkerLike {
  postMessage(m: KgRequest): void;
  onmessage: ((e: MessageEvent<KgResponse>) => void) | null;
  onerror: ((e: unknown) => void) | null;
  terminate(): void;
}

export interface ClientOptions {
  makeWorker: () => WorkerLike;
  /** Une seule adresse (ancienne forme) ; `urls` l'emporte. */
  url?: string;
  /** Adresses du réseau, dans l'ordre (#475 : notre copie, puis le repli). */
  urls?: string[];
  /** Empreinte(s) SHA-256 acceptée(s) du fichier. */
  sha256?: string | string[];
  /** Téléchargement permis (sinon : cache seulement). Lu à chaque démarrage. */
  telechargement?: () => boolean;
  memo?: MemoBackend;
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
  private prechargeEnCours: Promise<boolean> | null = null;
  private abonnes = new Set<(i: KataGoInfo) => void>();

  constructor(private o: ClientOptions) {}

  /** Suit les changements d'état (progression du téléchargement comprise). Renvoie de quoi se désabonner. */
  ecouter(f: (i: KataGoInfo) => void): () => void {
    this.abonnes.add(f);
    return () => { this.abonnes.delete(f); };
  }

  private maj(i: KataGoInfo) {
    this.info = i;
    for (const f of this.abonnes) { try { f(i); } catch { /* un abonné cassé ne bloque pas les autres */ } }
  }

  private source(): SourceReseau {
    const urls = this.o.urls?.length ? this.o.urls : [this.o.url ?? DEFAULT_MODEL_URL];
    return { urls, ...(this.o.sha256 ? { sha256: this.o.sha256 } : {}), telechargement: this.o.telechargement ? this.o.telechargement() : true };
  }

  private worker(): WorkerLike {
    if (this.w) return this.w;
    const w = this.o.makeWorker();
    w.onmessage = e => {
      const r = e.data;
      if (r.type === 'progress') { this.maj({ ...this.info, progression: { recu: r.recu, total: r.total } }); return; }
      this.pending.get(r.id)?.(r);
      this.pending.delete(r.id);
    };
    w.onerror = e => this.fail(`worker: ${String((e as ErrorEvent)?.message ?? e)}`);
    return (this.w = w);
  }

  private send(m: KgRequest): Promise<KgResponse> {
    return new Promise(resolve => { this.pending.set(m.id, resolve); this.w!.postMessage(m); });
  }

  private fail(error: string) {
    this.maj({ state: 'indisponible', error });
    this.w?.terminate();
    this.w = null;
    for (const [id, cb] of this.pending) cb({ id, type: 'error', error });
    this.pending.clear();
  }

  /**
   * Préchargement discret (#475) : met le réseau en cache et le code de TensorFlow.js en mémoire du navigateur,
   * sans démarrer KataGo (pas de GPU réservé). Ne fait rien si KataGo est déjà en route. Vrai si c'est fait.
   */
  precharger(): Promise<boolean> {
    if (this.info.state !== 'inactif') return Promise.resolve(this.info.state !== 'indisponible');
    if (this.prechargeEnCours) return this.prechargeEnCours;
    this.maj({ ...this.info, prechargement: 'en-cours' });
    this.prechargeEnCours = (async () => {
      try {
        this.worker();
        const r = await this.send({ id: this.next++, type: 'precharger', ...this.source() });
        const ok = r.type === 'precharge';
        // Un démarrage a pu commencer pendant ce temps : on ne touche plus qu'au drapeau de préchargement.
        const { progression: _p, ...reste } = this.info;
        this.maj({ ...reste, prechargement: ok ? 'fait' : 'echec', ...(r.type === 'error' ? { erreurPrechargement: r.error } : {}) });
        return ok;
      } catch (e) {
        this.maj({ ...this.info, prechargement: 'echec', erreurPrechargement: String(e) });
        return false;
      }
    })();
    return this.prechargeEnCours;
  }

  /** Lance le chargement (idempotent). Peut être appelé tôt, par exemple au choix de l'adversaire. */
  start(): Promise<void> {
    if (this.ready) return this.ready;
    this.maj({ state: 'chargement', ...(this.info.prechargement ? { prechargement: this.info.prechargement } : {}) });
    this.ready = (async () => {
      try { this.worker(); } catch (e) { this.fail(String(e)); throw e; }
      const memo = this.o.memo?.lire() ?? null;
      const r = await this.send({ id: this.next++, type: 'init', ...this.source(), ...(memo ? { backends: ordreBackends(memo) } : {}) });
      if (r.type !== 'ready') {
        const erreur = r.type === 'error' ? r.error : '';
        // Un échec de téléchargement ne dit rien du backend : on garde celui qui a marché.
        if (!/téléchargement/i.test(erreur)) this.o.memo?.ecrire(null);
        this.fail(r.type === 'error' ? r.error : 'réponse inattendue');
        throw new Error(this.info.error);
      }
      this.o.memo?.ecrire(r.backend);
      this.maj({ state: 'pret', backend: r.backend, name: r.name, loadMs: r.ms, fromCache: r.fromCache, ...(r.url ? { url: r.url } : {}), ...(r.etapes ? { etapes: r.etapes } : {}) });
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

  dispose() { this.w?.terminate(); this.w = null; this.ready = null; this.prechargeEnCours = null; this.maj({ state: 'inactif' }); }
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
