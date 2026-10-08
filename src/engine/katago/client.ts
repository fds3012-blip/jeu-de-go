// Côté page : pilote le Worker KataGo. Si le Worker, le backend ou le réseau manquent,
// `analyze` échoue vite et l'appelant se replie sur le moteur simple.
import type { Position } from '../../go/rules';
import type { AnalyzeOptions, Analysis } from './search';
import type { EtapesDemarrage, KgRequest, KgResponse, SourceReseau } from './worker';
import { DEFAULT_MODEL_URL, ordreBackends, type Backend } from './loader';
import { DelaiDepasse, delaiPing, estDelaiDepasse } from '../delais';

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
  /** Délai maximal d'une analyse (quand l'appelant n'en donne pas). */
  timeoutMs?: number;
  /**
   * Délai maximal du démarrage (#498) : téléchargement du réseau compris, généreux. Au-delà (Worker tué pendant le
   * chargement), KataGo est indisponible au lieu d'attendre pour toujours.
   */
  delaiDemarrageMs?: number;
}

/** Démarrage : jusqu'à 3,8 Mo sur un réseau lent, TensorFlow.js, compilation des shaders. */
export const DELAI_DEMARRAGE_MS = 120_000;

/** Une demande au Worker en attente de sa réponse. */
interface Attente { resolve(r: KgResponse): void; reject(e: Error): void; minuterie?: ReturnType<typeof setTimeout> }

export class KataGoClient {
  info: KataGoInfo = { state: 'inactif' };
  private w: WorkerLike | null = null;
  private next = 1;
  private pending = new Map<number, Attente>();
  /** Change à chaque relance : une réponse ou un échec d'un Worker arrêté ne touche plus à l'état. */
  private generation = 0;
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
      const a = this.pending.get(r.id);
      if (!a) return; // réponse arrivée après le délai : ignorée
      this.pending.delete(r.id);
      clearTimeout(a.minuterie);
      a.resolve(r);
    };
    w.onerror = e => this.fail(`worker: ${String((e as ErrorEvent)?.message ?? e)}`);
    return (this.w = w);
  }

  /**
   * Envoie une demande. #498 : avec `delaiMs`, la demande est retirée de `pending` et rejetée (`DelaiDepasse`) à
   * l'échéance. Avant, une analyse abandonnée restait dans `pending` pour toujours (fuite à chaque analyse trop longue).
   */
  private send(m: KgRequest, delaiMs?: number): Promise<KgResponse> {
    const w = this.worker();
    return new Promise((resolve, reject) => {
      const a: Attente = { resolve, reject };
      if (delaiMs !== undefined && Number.isFinite(delaiMs)) {
        a.minuterie = setTimeout(() => {
          if (this.pending.get(m.id) !== a) return;
          this.pending.delete(m.id);
          reject(new DelaiDepasse(m.type === 'analyze' ? 'analyse trop longue' : m.type === 'init' ? 'délai de démarrage dépassé' : `délai dépassé (${m.type})`));
        }, delaiMs);
      }
      this.pending.set(m.id, a);
      w.postMessage(m);
    });
  }

  /** Demandes encore sans réponse (tests, diagnostic). */
  get enAttente(): number { return this.pending.size; }

  /** Termine toutes les demandes en attente : réponse d'erreur (`erreur` texte) ou rejet. */
  private vider(erreur: string | Error) {
    const enCours = [...this.pending];
    this.pending.clear();
    for (const [id, a] of enCours) {
      clearTimeout(a.minuterie);
      if (typeof erreur === 'string') a.resolve({ id, type: 'error', error: erreur });
      else a.reject(erreur);
    }
  }

  private fail(error: string) {
    this.maj({ state: 'indisponible', error });
    this.w?.terminate();
    this.w = null;
    this.vider(error);
  }

  /**
   * #498 : arrête le Worker (tué par iOS, gelé) et revient à l'état « inactif » : le prochain appel le redémarre,
   * réseau lu du cache. Les demandes en cours échouent avec `DelaiDepasse`. Sert aussi à « Réessayer » après un abandon.
   */
  relancer(): void {
    this.generation++;
    this.w?.terminate();
    this.w = null;
    this.ready = null;
    this.prechargeEnCours = null;
    this.vider(new DelaiDepasse('Worker KataGo relancé'));
    const { prechargement } = this.info;
    this.maj({ state: 'inactif', ...(prechargement ? { prechargement } : {}) });
  }

  /** #498 : KataGo ne répond plus, même relancé : indisponible (les appels suivants échouent vite). */
  abandonner(raison: string): void {
    this.generation++;
    this.ready = null;
    this.fail(raison);
  }

  /**
   * #498 : le Worker répond-il encore ? (retour au premier plan après une mise en veille.) Le « ping » passe devant la
   * file du Worker. Sans réponse dans le délai, le Worker est relancé. Vrai s'il n'y a pas de Worker en route.
   */
  async verifier(delaiMs = delaiPing()): Promise<boolean> {
    if (!this.w) return true;
    const gen = this.generation;
    try {
      const r = await this.send({ id: this.next++, type: 'ping' }, delaiMs);
      return r.type === 'pong';
    } catch (e) {
      if (estDelaiDepasse(e) && gen === this.generation) this.relancer();
      return false;
    }
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
        // #498 : délai maximal, sinon un Worker tué pendant le préchargement le laissait « en cours » pour toujours.
        const r = await this.send({ id: this.next++, type: 'precharger', ...this.source() }, this.o.delaiDemarrageMs ?? DELAI_DEMARRAGE_MS);
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
    const gen = this.generation;
    this.ready = (async () => {
      try { this.worker(); } catch (e) { this.fail(String(e)); throw e; }
      const memo = this.o.memo?.lire() ?? null;
      let r: KgResponse;
      try {
        r = await this.send({ id: this.next++, type: 'init', ...this.source(), ...(memo ? { backends: ordreBackends(memo) } : {}) }, this.o.delaiDemarrageMs ?? DELAI_DEMARRAGE_MS);
      } catch (e) {
        // Relancé pendant le démarrage : l'état est déjà remis à zéro. Sinon (délai dépassé), indisponible.
        if (gen === this.generation) this.fail(e instanceof Error ? e.message : String(e));
        throw e;
      }
      if (gen !== this.generation) throw new DelaiDepasse('Worker KataGo relancé');
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

  async analyze(pos: Position, opts: AnalyzeOptions = {}, delaiMs?: number): Promise<Analysis> {
    if (this.info.state === 'indisponible') throw new Error(`KataGo indisponible : ${this.info.error}`);
    const ready = this.start();
    await withTimeout(ready, this.o.initWaitMs ?? 15000, 'KataGo pas encore prêt');
    const r = await this.send({ id: this.next++, type: 'analyze', pos, opts }, delaiMs ?? this.o.timeoutMs ?? 20000);
    if (r.type !== 'analysis') throw new Error(r.type === 'error' ? r.error : 'réponse inattendue');
    return r.analysis;
  }

  dispose() {
    this.generation++;
    this.w?.terminate(); this.w = null; this.ready = null; this.prechargeEnCours = null;
    // #498 : les demandes en cours se terminent (avant : leurs promesses restaient en attente pour toujours).
    this.vider('KataGo arrêté');
    this.maj({ state: 'inactif' });
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
