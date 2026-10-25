// #732 (C8) : « Analyse approfondie », un réseau KataGo plus fort (g170e b10c128) téléchargé seulement sur demande.
// Étude et mesures : docs/produit/analyse-forte-2026-10.md (#728). Module chargé avec les écrans qui s'en servent
// (Réglages, revue, étude) : jamais dans le JS initial. Il se branche sur le moteur par `brancherApprofondi`.
//
// Règles :
// - jamais téléchargé sans le geste du joueur (`activer`) ; jamais par défaut ;
// - servi par le dépôt KataGo (hébergement d'origine, MIT) ; l'empreinte SHA-256 est vérifiée à chaque téléchargement ;
// - utilisé par la revue (analyse expliquée) et l'étude seulement : ni l'IA de jeu, ni les preuves, ni la notation de
//   chaque coup de la revue ; les instantanés d'explication restent ceux du petit réseau b6c96 ;
// - repli silencieux sur le petit réseau si le réseau manque, si le téléchargement ou le démarrage échoue, ou si
//   l'appareil est trop lent (temps par visite mesuré à l'exécution).
import { KataGoClient, type KataGoInfo } from './katago/client';
import { CACHE_NAME } from './katago/loader';
import type { Analysis, AnalyzeOptions, KataGoBackend } from './index';
import { brancherApprofondi } from './revueKataGo';

export const APPROFONDI_NOM = 'g170e-b10c128-s1141046784-d204142634';
/** Hébergement d'origine (licence MIT du dépôt KataGo) : déjà dans la CSP, CORS ouvert. */
export const APPROFONDI_URL = `https://raw.githubusercontent.com/lightvector/KataGo/master/cpp/tests/models/${APPROFONDI_NOM}.bin.gz`;
/** Empreinte du fichier `.bin.gz` et de sa forme décompressée en route par un serveur. */
export const APPROFONDI_SHA256 = '1a8e05a4ea3fca20dab79410cbb566c760767fcdd2fa0b701cfe259a84cc8b04';
export const APPROFONDI_SHA256_DECOMPRESSE = '49b75eacdfd8587fe153e6889070d509504750a45fda16105e67bf8c456148d4';
/** Taille du fichier (octets), annoncée avant le téléchargement. */
export const APPROFONDI_OCTETS = 11_138_361;

/** Temps par visite au-delà duquel l'appareil est jugé trop lent (64 visites : plus de 7,7 s par recherche). */
export const SEUIL_MS_PAR_VISITE = 120;
/** En dessous, une recherche est trop courte pour juger la vitesse. */
export const VISITES_MIN_MESURE = 32;
/** Multiple du délai de recherche du petit réseau (40 ms par visite) accordé au réseau approfondi. */
export const FACTEUR_TEMPS = 3;
/** Le jugement « trop lent » est oublié au bout de 30 jours (autre téléphone, mise à jour, appareil libéré). */
export const TROP_LENT_DUREE_MS = 30 * 24 * 3600 * 1000;
/** Attente maximale du démarrage depuis le cache (le téléchargement, lui, n'est jamais lancé ici). */
export const DELAI_DEMARRAGE_MS = 30_000;

export const CLE_REGLAGE = 'go.katago.approfondie.v1';

export interface Reglage { actif: boolean; tropLentLe: number | null }
export interface Stockage { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

/** Réglage lu du stockage de l'appareil : désactivé par défaut, « trop lent » périmé après 30 jours. */
export function lireReglage(brut: string | null, maintenant: number): Reglage {
  try {
    const r = brut ? (JSON.parse(brut) as Partial<Reglage>) : null;
    const t = typeof r?.tropLentLe === 'number' && maintenant - r.tropLentLe < TROP_LENT_DUREE_MS && r.tropLentLe <= maintenant + 60_000 ? r.tropLentLe : null;
    return { actif: r?.actif === true, tropLentLe: t };
  } catch { return { actif: false, tropLentLe: null }; }
}

/** Verdict de vitesse d'une recherche : `null` quand elle est trop courte pour juger. */
export function tropLent(a: Pick<Analysis, 'ms' | 'visits'>, visitesDemandees: number | undefined): boolean | null {
  if ((visitesDemandees ?? 0) < VISITES_MIN_MESURE) return null;
  return a.ms / Math.max(1, a.visits) > SEUIL_MS_PAR_VISITE;
}

/** Les options d'une recherche approfondie : même nombre de visites, plus de temps (le réseau est plus lent). */
export function optionsApprofondies(o: AnalyzeOptions): AnalyzeOptions {
  return o.timeMs ? { ...o, timeMs: o.timeMs * FACTEUR_TEMPS } : o;
}

export type EtatApprofondi = 'desactivee' | 'telechargement' | 'active' | 'en-cache' | 'trop-lent';
export type ResultatActivation = 'ok' | 'echec' | 'annule';
/** Pourquoi la dernière analyse a utilisé le petit réseau. */
export type RaisonRepli = 'trop-lent' | 'indisponible';

/** Ce dont le gestionnaire a besoin du client KataGo du réseau approfondi (un faux suffit dans les tests). */
export interface ClientApprofondi {
  info: KataGoInfo;
  precharger(): Promise<boolean>;
  start(): Promise<void>;
  analyze(pos: Parameters<KataGoBackend['analyze']>[0], opts: AnalyzeOptions, delaiMs?: number): Promise<Analysis>;
  relancer(): void;
  abandonner(raison: string): void;
  dispose(): void;
  ecouter(f: (i: KataGoInfo) => void): () => void;
}

export interface DepsApprofondi {
  /** Reçoit le drapeau « téléchargement permis » (lu à chaque démarrage du client). */
  client: (telechargementPermis: () => boolean) => ClientApprofondi;
  stockage: Stockage | null;
  /** Le réseau est-il dans le cache du navigateur ? */
  enCache: () => Promise<boolean>;
  /** Efface le réseau du cache. */
  vider: () => Promise<boolean>;
  maintenant: () => number;
}

export function creerApprofondi(d: DepsApprofondi) {
  let permis = false;
  let annule = false;
  let c: ClientApprofondi | null = null;
  let repli: RaisonRepli | null = null;
  let enTelechargement = false;
  const abonnes = new Set<() => void>();
  const prevenir = () => { for (const f of abonnes) { try { f(); } catch { /* un abonné cassé ne bloque pas les autres */ } } };
  const client = () => (c ??= d.client(() => permis));

  const lire = (): Reglage => { try { return lireReglage(d.stockage?.getItem(CLE_REGLAGE) ?? null, d.maintenant()); } catch { return { actif: false, tropLentLe: null }; } };
  const ecrire = (r: Reglage) => {
    try { if (r.actif || r.tropLentLe) d.stockage?.setItem(CLE_REGLAGE, JSON.stringify(r)); else d.stockage?.removeItem(CLE_REGLAGE); } catch { /* stockage indisponible */ }
    prevenir();
  };
  const noterRepli = (r: RaisonRepli) => { repli = r; prevenir(); };

  /** Une analyse a-t-elle été faite avec le petit réseau à la place (depuis la dernière demande) ? */
  const backend: KataGoBackend = {
    get info() { return client().info; },
    start: () => client().start(),
    relancer: () => client().relancer(),
    abandonner: r => client().abandonner(r),
    async analyze(pos, opts, delaiMs) {
      const a = await client().analyze(pos, opts, delaiMs);
      // Vitesse mesurée à l'exécution : trop lent, cette réponse reste valable, mais le prochain appel (`fournir`)
      // se replie sur le petit réseau et libère le GPU.
      if (tropLent(a, opts.visits)) {
        ecrire({ ...lire(), tropLentLe: d.maintenant() });
        noterRepli('trop-lent');
      }
      return a;
    },
  };

  return {
    /** État pour l'écran des Réglages. */
    async etat(): Promise<EtatApprofondi> {
      if (enTelechargement) return 'telechargement';
      const r = lire();
      if (r.actif && r.tropLentLe) return 'trop-lent';
      if (!(await d.enCache())) return 'desactivee';
      return r.actif ? 'active' : 'en-cache';
    },
    /** Le geste du joueur : télécharge le réseau (empreinte vérifiée), puis active. Jamais appelé ailleurs. */
    async activer(): Promise<ResultatActivation> {
      if (enTelechargement) return 'echec';
      enTelechargement = true; annule = false; permis = true; repli = null; prevenir();
      try {
        const ok = (await d.enCache()) || (await client().precharger()) && (await d.enCache());
        if (annule) return 'annule';
        if (!ok) return 'echec';
        ecrire({ actif: true, tropLentLe: null });
        return 'ok';
      } catch { return annule ? 'annule' : 'echec'; } finally {
        permis = false; enTelechargement = false;
        // Le client du téléchargement ne garde rien : le prochain démarrage lit le cache.
        c?.relancer(); prevenir();
      }
    },
    /** « Annuler » pendant le téléchargement : le Worker est arrêté, la requête avec lui. */
    annuler() { if (!enTelechargement) return; annule = true; c?.relancer(); },
    /** « Désactiver » : le réseau reste sur l'appareil. */
    desactiver() { repli = null; ecrire({ actif: false, tropLentLe: null }); c?.dispose(); c = null; },
    /** « Réactiver » (réseau déjà en cache) ou « Réessayer » après « trop lent ». */
    reactiver() { repli = null; ecrire({ actif: true, tropLentLe: null }); },
    /** « Libérer la place » : efface le réseau du cache et désactive. */
    async liberer(): Promise<boolean> {
      c?.dispose(); c = null; repli = null;
      ecrire({ actif: false, tropLentLe: null });
      return d.vider();
    },
    /**
     * Pour le moteur : le réseau approfondi prêt à analyser, ou `null` (désactivé, absent du cache, trop lent, démarrage
     * en échec) : l'appelant garde alors le petit réseau. Ne télécharge jamais.
     */
    async fournir(): Promise<KataGoBackend | null> {
      const r = lire();
      if (!r.actif) return null;
      if (r.tropLentLe) { c?.dispose(); c = null; noterRepli('trop-lent'); return null; }
      if (!(await d.enCache())) { ecrire({ actif: false, tropLentLe: null }); noterRepli('indisponible'); return null; }
      try {
        if (client().info.state !== 'pret') {
          let delai: ReturnType<typeof setTimeout> | undefined;
          await Promise.race([client().start(), new Promise((_, non) => { delai = setTimeout(() => non(new Error('délai')), DELAI_DEMARRAGE_MS); })]).finally(() => clearTimeout(delai));
        }
        repli = null;
        return backend;
      } catch { c?.dispose(); c = null; noterRepli('indisponible'); return null; }
    },
    /** Une analyse approfondie a échoué en route : le moteur reprend avec le petit réseau. */
    echec() { c?.dispose(); c = null; noterRepli('indisponible'); },
    /** Pourquoi la dernière demande a pris le petit réseau (`null` : elle a pris l'approfondi, ou n'a rien demandé). */
    raisonRepli(): RaisonRepli | null { return repli; },
    reglage: lire,
    ecouterEtat(f: () => void) { abonnes.add(f); return () => { abonnes.delete(f); }; },
    ecouterProgression(f: (i: KataGoInfo) => void) { return client().ecouter(f); },
  };
}

export type Approfondie = ReturnType<typeof creerApprofondi>;

let instance: Approfondie | null = null;

/** Le gestionnaire de l'appareil (branché sur le moteur au premier appel). */
export function approfondie(): Approfondie {
  if (instance) return instance;
  instance = creerApprofondi({
    client: telechargementPermis => new KataGoClient({
      urls: [APPROFONDI_URL],
      sha256: [APPROFONDI_SHA256, APPROFONDI_SHA256_DECOMPRESSE],
      telechargement: telechargementPermis,
      makeWorker: () => new Worker(new URL('./katago/worker.ts', import.meta.url), { type: 'module' }) as never,
      initWaitMs: DELAI_DEMARRAGE_MS,
    }),
    stockage: (() => { try { return localStorage; } catch { return null; } })(),
    enCache: async () => {
      try { return typeof caches !== 'undefined' && !!(await (await caches.open(CACHE_NAME)).match(APPROFONDI_URL)); } catch { return false; }
    },
    vider: async () => {
      try {
        if (typeof caches === 'undefined') return false;
        await (await caches.open(CACHE_NAME)).delete(APPROFONDI_URL);
        return true;
      } catch { return false; }
    },
    maintenant: () => Date.now(),
  });
  brancherApprofondi({ fournir: () => instance!.fournir(), echec: () => instance!.echec(), raisonRepli: () => instance!.raisonRepli(), options: optionsApprofondies });
  return instance;
}
