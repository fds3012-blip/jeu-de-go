// API du moteur pour les écrans et les autres modules :
// - bestMove(position, niveau) : coup de l'adversaire (index y * N + x, -1 = passe) ;
// - analyze(position, options) : coups candidats, taux de victoire, avance, propriété ;
// - ownership(position) : carte de propriété de -1 (Blanc) à +1 (Noir) (KataGo, sinon simulations) ;
// - proposeDead(position) : pierres mortes proposées en fin de partie (deadStones en version synchrone).
// Pomme et Caillou utilisent le moteur simple (Monte-Carlo). Les 7 autres niveaux utilisent KataGo
// dans un Web Worker ; s'il ne démarre pas (pas de Worker, pas de backend, réseau introuvable),
// ils se replient sur le moteur simple, sans rien casser.
import { chooseMove, chooseMoveDetail, gainDuCoup, isLegalMove, OPPONENTS, opponent, raisonFrontiere, raisonPoints, reponseAccommodante, SEUIL_POINTS, type CoupExplique, type EngineOptions, type KataGoLevel, type Opponent, type OpponentId, type Raison, type Style } from './simple';
import { comptageSur, PREUVE, trancherParPreuve, type Tranche } from './comptageSur';
import { delaiAnalyse, delaiPing, delaiTache, DelaiDepasse, echelleDelais, estDelaiDepasse, estMoteurBloque, MoteurBloque, reglerEchelleDelais, sousDelai } from './delais';
import { comptageAuto, deadStones, groupesIncertains, ownership as ownershipSimple, type ComptageAuto, type DeadOptions } from './dead';
import type { Position } from '../go/rules';
import type { Rules } from '../go/score';
import { avanceEstimee, mortesSelonPropriete } from '../go/estimation';
import { coupDeFermeture, frontieresOuvertes, partieAvancee } from '../go/frontieres';
import type { Demande, Reponse, Tache } from './simple.worker';
import { KataGoClient, type KataGoInfo } from './katago/client';
import { choisirCoup } from './katago/choose';
import { rng } from './sim';
import { CACHE_NAME, DEFAULT_MODEL_URL, LEGACY_MODEL_URL, MODEL_SHA256, MODEL_SHA256_DECOMPRESSE, type Backend } from './katago/loader';
import { DELAI_PRECHARGEMENT_MS, decisionPrechargement, ecrireMemo, lireMemo, MEMO_BACKEND_KEY, type DecisionPrechargement, type InfoConnexion } from './katago/prechargement';
import type { Analysis, AnalyzeOptions, MoveInfo } from './katago/search';

export { OPPONENTS, opponent, chooseMove, chooseMoveDetail, deadStones, ownershipSimple };
// Réponse à la passe du joueur (#185) : seuil de points, gain d'un coup, raison affichable.
export { SEUIL_POINTS, gainDuCoup };
export type { CoupExplique, Raison };
// Fin de partie (#159) : points encore à fermer, coup qui en ferme un, avance comptée comme au comptage.
export { avanceEstimee, coupDeFermeture, frontieresOuvertes, mortesSelonPropriete, partieAvancee };
// Délais maximaux des demandes au moteur (#498).
export { DelaiDepasse, MoteurBloque, estDelaiDepasse, estMoteurBloque, reglerEchelleDelais };
export type { ComptageAuto, Opponent, OpponentId, EngineOptions, DeadOptions, KataGoLevel, Style, Analysis, AnalyzeOptions, MoveInfo, KataGoInfo };

// ---------- Moteur simple dans son Worker ----------
// Deux Workers indépendants : l'un pour les coups et les pierres mortes, l'autre pour l'estimation d'avantage
// affichée pendant la partie, pour que l'estimation ne retarde jamais la réponse de l'adversaire.
// #498 : chaque demande a un délai maximal (src/engine/delais.ts). iOS peut tuer un Worker sans événement `error` :
// au-delà du délai, le Worker est relancé et la demande refaite une fois (`demander`) ; sinon `MoteurBloque`, et
// l'écran prend son filet (coup de secours, comptage manuel). Après deux relances de suite sans réponse, le Worker est
// abandonné pour la session : le calcul se fait sur le fil principal, comme sans Worker.
let nextId = 1;

/** Ce dont un canal a besoin d'un Worker (un faux suffit dans les tests). */
export interface WorkerSimple {
  postMessage(d: Demande): void;
  onmessage: ((e: MessageEvent<Reponse>) => void) | null;
  onerror: ((e: unknown) => void) | null;
  terminate(): void;
}

export interface Canal {
  /** Envoie une demande ; `null` si le Worker est indisponible. Au-delà de `delaiMs` : `DelaiDepasse`, et le Worker est relancé. */
  envoyer(d: Tache, delaiMs: number): Promise<Reponse> | null;
  /** Vrai si le Worker répond (ou s'il n'y en a pas encore) ; sinon il est relancé. */
  verifier(): Promise<boolean>;
  /** Demandes sans réponse (tests, diagnostic). */
  enAttente(): number;
}

/** Relances de suite sans aucune réponse au-delà desquelles le Worker est abandonné pour la session. */
export const RELANCES_AVANT_ABANDON = 2;

function workerSimpleParDefaut(): WorkerSimple | null {
  if (typeof Worker === 'undefined') return null;
  surveillerVeille();
  return new Worker(new URL('./simple.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerSimple;
}

export function creerCanal(fabrique: () => WorkerSimple | null = workerSimpleParDefaut): Canal {
  let worker: WorkerSimple | null = null, broken = false, relances = 0;
  type Attente = { resolve: (r: Reponse) => void; reject: (e: Error) => void; minuterie: ReturnType<typeof setTimeout> };
  const pending = new Map<number, Attente>();
  function relancer(raison: string) {
    worker?.terminate();
    worker = null;
    for (const a of pending.values()) { clearTimeout(a.minuterie); a.reject(new DelaiDepasse(raison)); }
    pending.clear();
    if (++relances >= RELANCES_AVANT_ABANDON) broken = true;
  }
  function getWorker(): WorkerSimple | null {
    if (broken) return null;
    if (!worker) {
      try {
        const w = fabrique();
        if (!w) { broken = true; return null; }
        w.onmessage = (e: MessageEvent<Reponse>) => {
          const a = pending.get(e.data.id);
          if (!a) return; // réponse arrivée après le délai : ignorée
          pending.delete(e.data.id); clearTimeout(a.minuterie); relances = 0;
          a.resolve(e.data);
        };
        w.onerror = () => {
          broken = true; w.terminate(); if (worker === w) worker = null;
          for (const [id, a] of pending) { clearTimeout(a.minuterie); a.resolve({ id, move: Number.NaN, error: 'worker' }); }
          pending.clear();
        };
        worker = w;
      } catch { broken = true; return null; }
    }
    return worker;
  }
  function envoyer(d: Tache, delaiMs: number): Promise<Reponse> | null {
    const w = getWorker();
    if (!w) return null;
    const id = nextId++;
    return new Promise<Reponse>((resolve, reject) => {
      const minuterie = setTimeout(() => {
        const a = pending.get(id);
        if (!a) return;
        pending.delete(id);
        a.reject(new DelaiDepasse(`moteur simple : pas de réponse en ${delaiMs} ms (${d.kind})`));
        relancer('Worker relancé');
      }, delaiMs);
      pending.set(id, { resolve, reject, minuterie });
      try { w.postMessage({ ...d, id } satisfies Demande); } catch (e) { pending.delete(id); clearTimeout(minuterie); reject(e instanceof Error ? e : new Error(String(e))); }
    });
  }
  async function verifier(): Promise<boolean> {
    if (!worker) return true;
    const q = envoyer({ kind: 'ping' }, delaiPing());
    if (!q) return true;
    try { await q; return true; } catch { return false; }
  }
  return { envoyer, verifier, enAttente: () => pending.size };
}

// Build de test (VITE_E2E) seulement : délais raccourcis (`window.__echelleDelaisMoteur`, e2e/moteur-bloque.spec.ts).
// En production, la condition disparaît au build.
if (import.meta.env.VITE_E2E && typeof window !== 'undefined') {
  const e = (window as unknown as { __echelleDelaisMoteur?: unknown }).__echelleDelaisMoteur;
  if (typeof e === 'number') reglerEchelleDelais(e);
}

let ask = creerCanal();
let askEstimation = creerCanal();

/** Tests seulement : remplace les Workers du moteur simple (coups et comptage, estimation). */
export function _remplacerWorkersSimples(fabrique?: () => WorkerSimple | null) {
  ask = creerCanal(fabrique);
  askEstimation = creerCanal(fabrique);
}

/**
 * Demande au Worker, avec un délai maximal. Délai dépassé : le Worker est relancé et la demande refaite une fois ;
 * encore sans réponse : `MoteurBloque`. `null` si le Worker est indisponible (l'appelant calcule alors lui-même).
 */
async function demander(c: Canal, d: Tache, delaiMs: number): Promise<Reponse | null> {
  for (let essai = 0; ; essai++) {
    const q = c.envoyer(d, delaiMs);
    if (!q) return null;
    try { return await q; } catch (e) {
      if (!estDelaiDepasse(e)) throw e;
      if (essai > 0) throw new MoteurBloque(`moteur simple bloqué (${d.kind})`);
    }
  }
}

// Retour au premier plan après une mise en veille (#498) : les Workers répondent-ils encore ? Sinon, relancés.
let veilleSurveillee = false;
function surveillerVeille() {
  if (veilleSurveillee || typeof document === 'undefined') return;
  veilleSurveillee = true;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void verifierMoteurs(); });
}

/** Vérifie que les Workers du moteur (simple et KataGo) répondent ; ceux qui ne répondent plus sont relancés. */
export async function verifierMoteurs(): Promise<{ coups: boolean; estimation: boolean; katago: boolean }> {
  const k = katago;
  const [coups, estimation, kg] = await Promise.all([
    ask.verifier(), askEstimation.verifier(), k?.verifier ? k.verifier().catch(() => false) : Promise.resolve(true),
  ]);
  return { coups, estimation, katago: kg };
}

// #474 : une exception de `f` rejette la promesse. Avant, elle sortait du minuteur (erreur non attrapée) et la promesse
// restait en attente pour toujours : l'ordi « réfléchissait » sans fin, le comptage restait sur « Je cherche… ».
function later<T>(f: () => T): Promise<T> {
  return new Promise((resolve, reject) => setTimeout(() => { try { resolve(f()); } catch (e) { reject(e); } }, 0));
}

async function simpleMoveDetail(pos: Position, lvl: Opponent, opts: EngineOptions): Promise<CoupExplique> {
  // Repli d'un niveau KataGo : le moteur simple à pleine force. Son `hasard` règle le tirage selon la politique
  // du réseau (#179), pas le moteur simple, qui est déjà bien plus faible.
  const sync = () => later(() => chooseMoveDetail(pos, lvl.katago ? { ...lvl, hasard: 0 } : lvl, opts));
  // Le Worker simple ne connaît que les identifiants : on lui passe les réglages du niveau en options.
  const niveau: OpponentId = lvl.katago ? 'caillou' : lvl.id;
  // Mochi (#79) : ses crans plus doux que Pomme changent seulement `hasard`, qu'on transmet aussi.
  const hasard = !lvl.katago && lvl.hasard !== opponent(lvl.id).hasard ? lvl.hasard : undefined;
  const budget = opts.timeMs ?? lvl.timeMs;
  const r = await demander(ask, { kind: 'move', pos, niveau, opts: { timeMs: lvl.timeMs, playouts: lvl.playouts, ...opts }, ...(hasard === undefined ? {} : { hasard }) }, delaiTache(budget, pos.size));
  return !r || Number.isNaN(r.move) ? sync() : { move: r.move, raison: r.raison ?? null };
}

async function simpleMove(pos: Position, lvl: Opponent, opts: EngineOptions): Promise<number> {
  return (await simpleMoveDetail(pos, lvl, opts)).move;
}

/** Pierres mortes proposées à l'entrée du comptage, calculées sans bloquer l'interface. */
export async function proposeDead(pos: Position): Promise<number[]> {
  const r = await demander(ask, { kind: 'dead', pos }, delaiComptage(pos.size));
  return r?.dead ?? later(() => deadStones(pos));
}

/**
 * Comptage automatique (#117) : pierres mortes et groupes incertains. Simulations dans le Worker, plus l'avis
 * de KataGo s'il est déjà chargé (on ne télécharge rien pour ça) : un désaccord rend le groupe incertain.
 * `opts.sur` (#486, 3 premières parties) : les groupes discutables à petit enclos passent par une preuve exacte et
 * bornée (voir comptageSur.ts), qui l'emporte ; les incertains qu'elle ne tranche pas ne sont plus proposés morts. Jamais plus de
 * DELAI_PREUVE_MS d'attente : au-delà, le doute reste.
 */
export async function proposeComptage(pos: Position, komi: number, opts: { sur?: boolean } = {}): Promise<ComptageAuto & { prouves?: number }> {
  const r = await demander(ask, { kind: 'dead', pos }, delaiComptage(pos.size));
  const base: ComptageAuto = r?.dead && r.incertains ? { dead: r.dead, incertains: r.incertains } : await later(() => comptageAuto(pos));
  const avis = await avisKataGo(pos, komi, base);
  return opts.sur ? comptageSur(pos, avis, await trancher(pos, avis)) : avis;
}

/** Délai de la recherche des pierres mortes : le comptage automatique tient en 0,2 à 0,7 s, plusieurs passes. */
const delaiComptage = (size: number) => delaiTache(2000, size);

/** Incertains de `base`, plus les désaccords de KataGo s'il est déjà chargé. */
async function avisKataGo(pos: Position, komi: number, base: ComptageAuto): Promise<ComptageAuto> {
  const k = katago ?? null;
  if (!k || k.info.state !== 'pret' || !pos.board.some(v => v)) return base;
  try {
    const a = await analyserGarde(k, pos, { komi, visits: 16, timeMs: 800 });
    const incertains = new Set([...base.incertains, ...groupesIncertains(pos, base.dead, [a.ownership])]);
    return { dead: base.dead, incertains: [...incertains].sort((x, y) => x - y) };
  } catch { return base; }
}

/** Attente maximale de la preuve des groupes incertains (#486). La preuve elle-même est bornée (PREUVE.timeMs). */
export const DELAI_PREUVE_MS = 2000;

/** Preuve des groupes discutables, dans le Worker (sinon différée sur le fil principal) ; rien de tranché en cas d'échec. */
async function trancher(pos: Position, c: ComptageAuto): Promise<Tranche> {
  const rien: Tranche = { morts: [], vivants: [] };
  if (!pos.board.some(v => v)) return rien;
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<Tranche>(resolve => { minuterie = setTimeout(() => resolve(rien), DELAI_PREUVE_MS); });
  // Délai propre (#498) : sans lui, une demande à un Worker mort restait en attente pour toujours.
  const q = ask.envoyer({ kind: 'trancher', pos, comptage: c }, delaiTache(PREUVE.timeMs, pos.size));
  const calcul = q ? q.then(r => r.tranche ?? rien) : later(() => trancherParPreuve(pos, c));
  try { return await Promise.race([calcul.catch(() => rien), delai]); } finally { clearTimeout(minuterie); }
}

// ---------- KataGo ----------
/** Ce qu'il faut pour analyser avec KataGo ; remplaçable dans les tests. */
export interface KataGoBackend {
  /** `delaiMs` (#498) : délai maximal de l'analyse, au-delà duquel elle échoue avec `DelaiDepasse`. */
  analyze(pos: Position, opts: AnalyzeOptions, delaiMs?: number): Promise<Analysis>; info: KataGoInfo; start?(): Promise<void>;
  /** #498 : arrête le Worker (tué, gelé) ; le prochain appel le redémarre. */
  relancer?(): void;
  /** #498 : KataGo ne répond plus, même relancé : indisponible pour la session (sauf `relancer`). */
  abandonner?(raison: string): void;
  /** #498 : vrai si le Worker répond ; sinon il est relancé. */
  verifier?(): Promise<boolean>;
  /** Préchargement discret (#475) : réseau en cache, sans démarrer KataGo. */
  precharger?(): Promise<boolean>;
  /** Suit les changements d'état et la progression du téléchargement. */
  ecouter?(f: (i: KataGoInfo) => void): () => void;
}

let katago: KataGoBackend | null | undefined;
let warned = false;

/** Marge du filet extérieur quand KataGo démarre encore : le client attend son chargement jusqu'à 15 s. */
const MARGE_DEMARRAGE_MS = 20_000;

/**
 * Analyse KataGo avec un délai maximal (#498), adapté aux visites, au temps et à la taille du plateau. Délai dépassé :
 * Worker relancé, nouvel essai une fois ; encore rien : KataGo est abandonné pour la session et `MoteurBloque` est levé.
 * Le filet extérieur (`sousDelai`) couvre aussi un remplaçant qui ignorerait `delaiMs` (tests).
 */
async function analyserGarde(k: KataGoBackend, pos: Position, opts: AnalyzeOptions): Promise<Analysis> {
  const delai = delaiAnalyse(opts, pos.size);
  for (let essai = 0; ; essai++) {
    const filet = delai + Math.round(echelleDelais() * (1000 + (k.info.state === 'pret' ? 0 : MARGE_DEMARRAGE_MS)));
    try {
      return await sousDelai(k.analyze(pos, opts, delai), filet, 'analyse trop longue');
    } catch (e) {
      if (!estDelaiDepasse(e)) throw e;
      if (essai > 0) {
        const raison = 'analyse trop longue : KataGo ne répond plus, même relancé';
        k.abandonner?.(raison);
        throw new MoteurBloque(raison);
      }
      k.relancer?.();
    }
  }
}

function modelUrl(): string {
  // Écrit en toutes lettres pour que Vite remplace la variable au build.
  return (import.meta.env.VITE_KATAGO_MODEL_URL as string | undefined) || DEFAULT_MODEL_URL;
}

/**
 * Adresses du réseau, dans l'ordre (#475) : notre copie (mochi-go.app/reseaux/…, ou `VITE_KATAGO_MODEL_URL`),
 * puis la copie du dépôt KataGo si la nôtre ne répond pas. Absolues : le Worker et le cache les comparent telles quelles.
 */
export function modelUrls(): string[] {
  const base = typeof location !== 'undefined' ? location.href : 'http://localhost/';
  return [...new Set([modelUrl(), LEGACY_MODEL_URL].map(u => new URL(u, base).href))];
}

/** Backend mémorisé dans le stockage de l'appareil (#475) ; sans stockage, rien n'est retenu. */
const memoBackend = {
  lire(): Backend | null {
    try { return lireMemo(localStorage.getItem(MEMO_BACKEND_KEY), navigator.userAgent, Date.now()); } catch { return null; }
  },
  ecrire(b: Backend | null) {
    try {
      if (b) localStorage.setItem(MEMO_BACKEND_KEY, ecrireMemo(b, navigator.userAgent, Date.now()));
      else localStorage.removeItem(MEMO_BACKEND_KEY);
    } catch { /* stockage indisponible */ }
  },
};

function getKataGo(): KataGoBackend | null {
  if (katago !== undefined) return katago;
  if (typeof Worker === 'undefined') return (katago = null);
  surveillerVeille();
  katago = new KataGoClient({
    urls: modelUrls(),
    // Empreinte vérifiée seulement pour notre réseau : une autre adresse (`VITE_KATAGO_MODEL_URL`) peut servir un autre fichier.
    ...(import.meta.env.VITE_KATAGO_MODEL_URL ? {} : { sha256: [MODEL_SHA256, MODEL_SHA256_DECOMPRESSE] }),
    telechargement: telechargementPermis,
    memo: memoBackend,
    makeWorker: () => new Worker(new URL('./katago/worker.ts', import.meta.url), { type: 'module' }) as never,
  });
  return katago;
}

/** Remplace le moteur KataGo (tests) ; `null` = KataGo absent, `undefined` = réglage par défaut. */
export function setKataGo(k: KataGoBackend | null | undefined) { katago = k; }

/**
 * KataGo de la revue. Dans un build de test (VITE_E2E) seulement, `window.__kataGoFactice` le remplace :
 * les tests de bout en bout (e2e/rejoue-erreur.spec.ts) écrivent ainsi une analyse connue d'avance.
 * Le jeu contre l'ordi n'est pas touché. En production, la condition disparaît au build.
 */
function kataGoRevue(): KataGoBackend | null | undefined {
  if (import.meta.env.VITE_E2E && typeof window !== 'undefined') {
    const f = (window as unknown as { __kataGoFactice?: KataGoBackend }).__kataGoFactice;
    if (f) return f;
  }
  return katago;
}

/** État de KataGo (chargement, backend choisi, erreur). */
export function kataGoInfo(): KataGoInfo { return getKataGo()?.info ?? { state: 'indisponible', error: 'Web Workers indisponibles' }; }

/**
 * « Réessayer » après un KataGo bloqué (#498) : arrête son Worker et le rend à nouveau utilisable ; le prochain
 * `preparerKataGo` le redémarre (réseau lu du cache).
 */
export function relancerKataGo(): void {
  const k = kataGoRevue() ?? getKataGo();
  k?.relancer?.();
}

/** Démarre le chargement de KataGo en avance (téléchargement du réseau, choix du backend). */
export function preloadKataGo(): void { getKataGo()?.start?.().catch(() => {}); }

/** Analyse de secours sans réseau : coup du moteur simple et propriété tirée des simulations. */
async function simpleAnalysis(pos: Position, o: AnalyzeOptions): Promise<Analysis> {
  const t0 = Date.now(), komi = o.komi ?? 6.5;
  const move = await simpleMove(pos, opponent('caillou'), { komi, timeMs: Math.min(o.timeMs ?? 600, 600) });
  const own = await later(() => ownershipSimple(pos, { timeMs: 150, estimation: true }));
  let black = -komi;
  for (const v of own) black += v;
  const lead = pos.toPlay === 1 ? black : -black, winrate = lead > 0 ? 0.6 : 0.4;
  return { moves: [{ move, visits: 1, prior: 1, winrate, lead, scoreLoss: 0 }], winrate, lead, ownership: own, visits: 1, ms: Date.now() - t0, engine: 'simple' };
}

/** Analyse la position avec KataGo (repli : estimation du moteur simple, `engine: 'simple'`). */
export async function analyze(pos: Position, options: AnalyzeOptions = {}): Promise<Analysis> {
  const k = getKataGo();
  if (k) {
    try { return await analyserGarde(k, pos, { visits: 64, ...options }); } catch { /* repli ci-dessous */ }
  }
  return simpleAnalysis(pos, options);
}

/** Propriété de chaque intersection, de -1 (Blanc) à +1 (Noir). */
export async function ownership(pos: Position, options: AnalyzeOptions = {}): Promise<Float32Array> {
  return (await analyze(pos, { visits: 1, ...options })).ownership;
}

/** Coup de l'adversaire `niveau` pour le joueur au trait. Ne renvoie jamais un coup illégal (sinon passe). */
export async function bestMove(pos: Position, niveau: OpponentId | Opponent, opts: EngineOptions = {}): Promise<number> {
  return (await bestMoveExplique(pos, niveau, opts)).move;
}

/**
 * Comme `bestMove`, avec la raison (#185) quand l'ordi joue au lieu de passer juste après la passe du joueur :
 * `raison.texte` (« il reste une frontière à fermer en E4 », « il reste 3 points à prendre en E4 ») peut être affiché
 * par l'écran. `opts.accommodant` (3 premières parties) : l'ordi passe dès que les frontières sont fermées.
 */
export async function bestMoveExplique(pos: Position, niveau: OpponentId | Opponent, opts: EngineOptions = {}): Promise<CoupExplique> {
  // Tests de bout en bout seulement (build VITE_E2E ; la condition disparaît en production) : coups de l'ordi écrits
  // d'avance dans `window.__coupsOrdi` (index y * N + x), joués dans l'ordre tant qu'ils sont légaux (e2e/coach-mochi.spec.ts).
  if (import.meta.env.VITE_E2E && typeof window !== 'undefined') {
    const prevus = (window as unknown as { __coupsOrdi?: number[] }).__coupsOrdi;
    const m = prevus?.shift();
    if (m !== undefined && isLegalMove(pos, m)) return { move: m, raison: null };
  }
  const lvl = typeof niveau === 'string' ? opponent(niveau) : niveau;
  let coup: CoupExplique | null = null;
  const k = lvl.katago ? getKataGo() : null;
  if (lvl.katago && k) {
    try {
      // Plafond de 1,8 s par coup : l'objectif est une réponse en moins de 2 s.
      const a = await analyserGarde(k, pos, { komi: opts.komi ?? 6.5, visits: lvl.katago.visits, timeMs: opts.timeMs ?? 1800 });
      // Graine fixée (tests) : tirage reproductible. Sinon, vrai hasard.
      // La graine est mélangée : xorshift démarre mal sur les petites graines (premiers tirages proches de 0).
      const rand = opts.seed !== undefined ? rng(Math.imul(opts.seed ^ 0x9e3779b9, 0x85ebca6b)) : Math.random;
      coup = apresAnalyse(pos, lvl, opts, a, choisirCoup(a, pos, { hasard: lvl.hasard, katago: lvl.katago }, rand));
    } catch (e) {
      coup = null;
      if (!warned) { warned = true; console.warn('KataGo indisponible, repli sur le moteur simple :', e instanceof Error ? e.message : e); }
    }
  }
  if (coup === null) coup = await simpleMoveDetail(pos, lvl, opts);
  // Garde-fou : un coup illégal devient une passe.
  return isLegalMove(pos, coup.move) ? coup : { move: -1, raison: null };
}

/** Politique de passe appliquée au coup choisi par KataGo (#159, #185). Mêmes règles que `chooseMoveDetail`. */
function apresAnalyse(pos: Position, lvl: Opponent, opts: EngineOptions, a: Analysis, move: number): CoupExplique {
  const avancee = partieAvancee(pos.board), PASSE: CoupExplique = { move: -1, raison: null };
  const fermer = () => (lvl.fermeFrontieres && avancee ? coupDeFermeture(pos, mortesSelonPropriete(pos, a.ownership), [move, ...a.moves.map(m => m.move)]) : -1);
  if (pos.lastMove !== -1) {
    // Pas de passe tant qu'une frontière reste ouverte (#159) : on la ferme, de préférence avec un coup de KataGo.
    const f = move === -1 ? fermer() : -1;
    return f >= 0 ? { move: f, raison: raisonFrontiere(f, pos.size) } : { move, raison: null };
  }
  // Le joueur vient de passer (#185). Parties accommodantes (#235) : seulement un trou dans sa frontière, puis la passe.
  if (opts.accommodant) return reponseAccommodante(pos, lvl, opts, () => mortesSelonPropriete(pos, a.ownership), [move, ...a.moves.map(m => m.move)]);
  if (!avancee) return { move, raison: null };
  const f = fermer();
  if (f >= 0) return { move: f, raison: raisonFrontiere(f, pos.size) };
  if (opts.accommodant || move === -1) return PASSE;
  // Frontières fermées : KataGo compare lui-même le coup et la passe ; sans la passe dans ses candidats, on compte.
  const lead = (m: number) => a.moves.find(x => x.move === m)?.lead;
  const lp = lead(-1), lm = lead(move);
  const gain = lp !== undefined && lm !== undefined ? lm - lp : gainDuCoup(pos, move);
  return gain >= SEUIL_POINTS ? { move, raison: raisonPoints(move, gain, pos.size) } : PASSE;
}

/**
 * Options de l'estimation d'avantage. `rules` : règle de comptage de la partie (japonais par défaut, comme l'écran
 * de partie). `fin` : compter comme si la partie s'arrêtait là (frontières ouvertes neutres) ; par défaut, dès
 * qu'un joueur vient de passer, puisque la passe suivante déclenche le comptage.
 */
export interface OptionsEstimation { kataGo?: boolean; rules?: Rules; fin?: boolean }

/** Propriété de chaque intersection pour l'estimation : KataGo s'il est prêt (et libre), sinon le Worker simple. */
async function proprieteEstimee(pos: Position, komi: number, opts: OptionsEstimation): Promise<{ own: Float32Array; engine: 'katago' | 'simple' } | null> {
  // `kataGo: false` : KataGo est occupé à chercher le coup de l'adversaire, on ne le ralentit pas.
  const k = opts.kataGo === false ? null : kataGoRevue() ?? null;
  if (k && k.info.state === 'pret') {
    try {
      const a = await analyserGarde(k, pos, { komi, visits: 16, timeMs: 600, regles: opts.rules ?? 'japanese' });
      return { own: a.ownership, engine: 'katago' };
    } catch { /* repli ci-dessous */ }
  }
  const timeMs = pos.size <= 9 ? 150 : 400;
  const r = await demander(askEstimation, { kind: 'own', pos, timeMs }, delaiTache(timeMs, pos.size));
  return r?.own ? { own: Float32Array.from(r.own), engine: 'simple' } : null;
}

/** Avance de Noir comptée avec la règle de la partie (voir `avanceEstimee`, #159). */
function avance(pos: Position, own: Float32Array, komi: number, opts: OptionsEstimation): number {
  return avanceEstimee(pos, own, komi, { rules: opts.rules ?? 'japanese', fin: opts.fin ?? pos.lastMove === -1 });
}

/**
 * Avance estimée de Noir, en points (komi compris), pour la barre d'avantage de l'écran de partie.
 * KataGo s'il est déjà chargé (on ne télécharge pas le réseau pour ça), sinon la propriété du moteur simple,
 * calculée dans un Worker dédié. `null` si aucune estimation n'est possible sans bloquer l'interface.
 * Le compte suit la règle du comptage final (#159) : sur une position finie, c'est le score réel.
 */
export async function estimateLead(pos: Position, komi: number, opts: OptionsEstimation = {}): Promise<{ lead: number; engine: 'katago' | 'simple' } | null> {
  const e = await proprieteEstimee(pos, komi, opts);
  return e && { lead: avance(pos, e.own, komi, opts), engine: e.engine };
}

/**
 * Territoires estimés pour « Qui mène ? » (#94) : avance de Noir (komi compris) et propriété de chaque
 * intersection, de -1 (Blanc) à +1 (Noir). KataGo s'il est déjà prêt, sinon le moteur simple dans son Worker.
 * `null` si aucune estimation n'est possible sans bloquer l'interface. Même compte que `estimateLead`.
 */
export async function estimateTerritoire(pos: Position, komi: number, opts: OptionsEstimation = {}): Promise<{ lead: number; own: Float32Array; engine: 'katago' | 'simple' } | null> {
  const e = await proprieteEstimee(pos, komi, opts);
  return e && { lead: avance(pos, e.own, komi, opts), own: e.own, engine: e.engine };
}

/**
 * Analyse d'une position pour la note des coups (issue #71). `lead` : avance de Noir, komi compris.
 * Avec KataGo : ses candidats (avance pour le joueur au trait), du meilleur au moins bon. Sinon, l'estimation
 * du moteur simple, sans candidats (on ne connaît pas le meilleur coup). `null` si aucune estimation possible.
 */
export interface AnalyseRevue {
  lead: number; engine: 'katago' | 'simple';
  /** Candidats de KataGo ; `pv` : variante principale qui commence par ce coup (#497), absente si le coup n'a pas été visité. */
  coups?: { move: number; visits: number; lead: number; pv?: number[] }[];
  /** #497 : propriété estimée par KataGo dans cette position, de -1 (Blanc) à +1 (Noir). */
  own?: Float32Array;
  /** #497 : propriété estimée par KataGo après son premier choix (`coups[0]`), de -1 (Blanc) à +1 (Noir). */
  ownApres?: Float32Array;
}
export async function analyseRevue(pos: Position, komi: number, opts: { visits?: number; kataGo?: boolean } = {}): Promise<AnalyseRevue | null> {
  const k = opts.kataGo === false ? null : kataGoRevue() ?? null;
  if (k && k.info.state === 'pret') {
    try {
      const visits = opts.visits ?? 32;
      const a = await analyserGarde(k, pos, { komi, visits, timeMs: visits * 40, maxMoves: 6 });
      return {
        lead: pos.toPlay === 1 ? a.lead : -a.lead, engine: 'katago',
        coups: a.moves.map(m => ({ move: m.move, visits: m.visits, lead: m.lead, ...(m.pv ? { pv: m.pv } : {}) })),
        ...(a.ownership ? { own: a.ownership } : {}), ...(a.ownershipApres ? { ownApres: a.ownershipApres } : {}),
      };
    } catch (e) {
      // #498 : KataGo ne répond plus : l'écran le dit et propose de réessayer, au lieu d'attendre position après position.
      if (estMoteurBloque(e)) throw e;
      return null;
    }
  }
  const r = await estimateLead(pos, komi, { kataGo: false });
  return r && { lead: r.lead, engine: 'simple' };
}

/** Pourquoi la revue se fait sans KataGo (#424), pour le dire en une phrase. */
export type RaisonSansKataGo = 'reseau' | 'appareil' | 'delai';
export type PreparationKataGo = { pret: true } | { pret: false; raison: RaisonSansKataGo };

/** Attente maximale du chargement de KataGo pour une revue : téléchargement (3,8 Mo, une seule fois) et démarrage. */
export const DELAI_KATAGO_REVUE = 45_000;

/**
 * Build de test (VITE_E2E) seulement : la revue ne télécharge le réseau que si le test le demande
 * (`window.__kataGoTelechargement`), pour que les autres parcours restent rapides et sans réseau.
 */
function telechargementPermis(): boolean {
  if (import.meta.env.VITE_E2E && typeof window !== 'undefined') return !!(window as unknown as { __kataGoTelechargement?: boolean }).__kataGoTelechargement;
  return true;
}

/** Classe l'erreur du chargement de KataGo : réseau (téléchargement), délai, ou appareil (Worker, backend, mémoire). */
export function raisonSansKataGo(erreur: string | undefined): RaisonSansKataGo {
  const e = (erreur ?? '').toLowerCase();
  if (/délai|pas encore prêt|trop longue|timeout/.test(e)) return 'delai';
  if (/téléchargement|fetch|network|load failed|réseau trop petit|failed to fetch|networkerror/.test(e)) return 'reseau';
  return 'appareil';
}

/**
 * Prépare KataGo pour la revue d'une partie. Issue #424 : avant, la revue ne prenait KataGo que s'il était déjà en
 * mémoire ou en cache. Une partie entre amis (ou contre Pomme et Caillou, qui jouent sans KataGo) ne l'avait jamais
 * chargé : la revue passait en silence au moteur simple, sur iPhone comme ailleurs. Désormais la revue télécharge
 * le réseau s'il manque (3,8 Mo, une seule fois, puis cache), dans la limite de `delaiMs`. Sinon, la raison.
 */
export async function preparerKataGo(delaiMs = DELAI_KATAGO_REVUE): Promise<PreparationKataGo> {
  let k = kataGoRevue() ?? null;
  if (k && k.info.state === 'pret') return { pret: true };
  if (!telechargementPermis() && !(await reseauEnCache())) return { pret: false, raison: 'reseau' };
  k = k?.start ? k : getKataGo();
  if (!k) return { pret: false, raison: 'appareil' };
  // #498 : abandonné après un délai dépassé (Worker tué, gelé) : passager, on le relance pour cette nouvelle demande.
  if (k.info.state === 'indisponible' && raisonSansKataGo(k.info.error) === 'delai') k.relancer?.();
  if (k.info.state === 'indisponible') return { pret: false, raison: raisonSansKataGo(k.info.error) };
  let delai: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      k.start?.(),
      new Promise((_, rejeter) => { delai = setTimeout(() => rejeter(new Error('délai dépassé')), delaiMs); }),
    ]);
  } catch (e) {
    // L'état a pu changer pendant l'attente (le chargement a échoué) : relu tel quel, sans le rétrécissement de TypeScript.
    const info: KataGoInfo = k.info;
    const erreur = info.state === 'indisponible' ? info.error : e instanceof Error ? e.message : String(e);
    if (!warned) { warned = true; console.warn('KataGo indisponible pour la revue :', erreur); }
    return { pret: false, raison: raisonSansKataGo(erreur) };
  } finally { clearTimeout(delai); }
  const info: KataGoInfo = k.info;
  return info.state === 'pret' ? { pret: true } : { pret: false, raison: raisonSansKataGo(info.error) };
}

/** Vrai si le réseau KataGo est déjà dans le cache du navigateur (Cache API) : le charger ne télécharge rien. */
export async function reseauEnCache(): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false;
    const cache = await caches.open(CACHE_NAME);
    // Notre copie ou l'ancienne (raw.githubusercontent.com, avant #475) : l'une ou l'autre suffit.
    for (const url of modelUrls()) if (await cache.match(url)) return true;
    return false;
  } catch { return false; }
}

/**
 * Suit l'état de KataGo pour un écran (#475) : progression du téléchargement (« 2,1 / 3,8 Mo »), puis prêt ou non.
 * Appelle `f` tout de suite avec l'état actuel. Renvoie de quoi se désabonner.
 */
export function ecouterKataGo(f: (i: KataGoInfo) => void): () => void {
  const k = kataGoRevue() ?? getKataGo();
  f(k?.info ?? kataGoInfo());
  return k?.ecouter?.(f) ?? (() => {});
}

let prechargementTente = false;

/** Ce que le navigateur dit de la connexion (Chrome, Android) ; `null` s'il ne dit rien (Safari, Firefox). */
function connexion(): InfoConnexion | null {
  try {
    const c = (navigator as unknown as { connection?: InfoConnexion }).connection;
    return c ? { saveData: c.saveData, type: c.type, effectiveType: c.effectiveType } : null;
  } catch { return null; }
}

/**
 * Préchargement discret après la fin d'une partie (#475) : règles dans src/engine/katago/prechargement.ts
 * (pas à la première partie, pas en données mobiles ni en économie de données si le navigateur le dit).
 * Attend `DELAI_PRECHARGEMENT_MS` (le récit du score passe d'abord), puis décide. Une seule tentative par session.
 */
export function prechargerApresPartie(partiesLancees: number, delaiMs = DELAI_PRECHARGEMENT_MS): Promise<DecisionPrechargement> {
  if (prechargementTente) return Promise.resolve({ ok: false, raison: 'deja-en-route' });
  prechargementTente = true;
  return new Promise(resolve => {
    setTimeout(async () => {
      const k = getKataGo();
      if (!k?.precharger) { resolve({ ok: false, raison: 'deja-en-route' }); return; }
      const d = decisionPrechargement({
        partiesLancees, connexion: connexion(), enCache: await reseauEnCache(), etat: k.info.state,
        visible: typeof document === 'undefined' || document.visibilityState !== 'hidden',
      });
      // Build de test : jamais de téléchargement que le test n'a pas demandé.
      if (d.ok && telechargementPermis()) void k.precharger();
      resolve(d);
    }, delaiMs);
  });
}

/** Tests seulement : permet une nouvelle tentative de préchargement. */
export function _reinitialiserPrechargement() { prechargementTente = false; }

/**
 * Conseil de KataGo pour la revue d'une partie (issue #34). Jamais le moteur simple : ses conseils sont trop peu sûrs
 * pour un débutant. KataGo est chargé seulement s'il l'est déjà ou si son réseau est en cache (aucun téléchargement).
 * `katago: false` : pas de conseil possible. Sinon `move` (-1 : passer, `null` : aucun) et `lead`, l'avance
 * en points pour le joueur au trait après ce coup.
 */
export type Conseil = { katago: false } | { katago: true; move: number | null; lead: number };
export async function meilleurCoup(pos: Position, komi: number): Promise<Conseil> {
  let k = kataGoRevue() ?? null;
  if ((!k || k.info.state !== 'pret') && (await reseauEnCache())) {
    k = getKataGo();
    try { await k?.start?.(); } catch { /* KataGo indisponible */ }
  }
  if (!k || k.info.state !== 'pret') return { katago: false };
  try {
    const a = await analyserGarde(k, pos, { komi, visits: 48, timeMs: 1200 });
    const b = a.moves[0];
    return b ? { katago: true, move: b.move, lead: b.lead } : { katago: true, move: null, lead: a.lead };
  } catch { return { katago: false }; }
}

/**
 * Analyse d'une position posée à la main (#372, « Étudier une position »). KataGo seulement, jamais le moteur simple :
 * ses conseils sont trop peu sûrs. KataGo est démarré s'il est en mémoire ou si son réseau est en cache ; sinon
 * `katago: false`, et l'écran propose le téléchargement (`preparerKataGo`). Une seule recherche par appel (batterie).
 * `lead` : avance de Noir, komi compris ; `coups` : les meilleurs coups pour le joueur au trait, du meilleur au moins
 * bon, avec ses chances de gain (0 à 1) et son avance en points.
 */
export type AnalyseEtude =
  | { katago: false }
  | { katago: true; lead: number; coups: { move: number; winrate: number | null; lead: number }[] };
export async function analyseEtude(pos: Position, komi: number, visites = 96): Promise<AnalyseEtude> {
  let k = kataGoRevue() ?? null;
  if ((!k || k.info.state !== 'pret') && (await reseauEnCache())) {
    k = getKataGo();
    try { await k?.start?.(); } catch { /* KataGo indisponible */ }
  }
  if (!k || k.info.state !== 'pret') return { katago: false };
  const a = await analyserGarde(k, pos, { komi, visits: visites, timeMs: visites * 30, maxMoves: 6 });
  return {
    katago: true,
    lead: pos.toPlay === 1 ? a.lead : -a.lead,
    coups: a.moves.map(m => ({ move: m.move, winrate: typeof m.winrate === 'number' ? m.winrate : null, lead: m.lead })),
  };
}

/**
 * Analyse pour le Conseil de Mochi (#80) : ce que `conseil()` (src/engine/conseil.ts) attend de KataGo.
 * Deux recherches courtes (moins de 2 s en tout sur 9 × 9) : la position telle quelle (propriété, meilleurs coups)
 * et la même position avec l'adversaire au trait (propriété s'il jouait maintenant, sa menace).
 * KataGo seulement s'il est déjà prêt : jamais de téléchargement pour un conseil. `null` sans KataGo :
 * l'écran se contente alors des modèles qui ne demandent que les règles.
 */
export interface AnalyseConseil { propriete: Float32Array; coups: number[]; proprieteSiTuPasses: Float32Array; menace: number }
export async function analyseConseil(pos: Position, komi: number): Promise<AnalyseConseil | null> {
  const k = kataGoRevue() ?? null;
  if (!k || k.info.state !== 'pret') return null;
  try {
    const opts = { komi, visits: 24, timeMs: 800, maxMoves: 5 };
    const a = await analyserGarde(k, pos, opts);
    const eux: Position = { ...pos, toPlay: (3 - pos.toPlay) as 1 | 2, ko: -1, lastMove: -1 };
    const b = await analyserGarde(k, eux, opts);
    return { propriete: a.ownership, coups: a.moves.map(m => m.move), proprieteSiTuPasses: b.ownership, menace: b.moves[0]?.move ?? -1 };
  } catch { return null; }
}

// Partie guidée (#79) : réglage de la force de Mochi tous les 10 coups, selon l'écart estimé.
export { CRAN_DEPART, cranDuNiveau, cranSuivant, forceInitiale, momentDeReglage, niveauGuide, PERIODE_GUIDEE, reglerForce } from './guidee';
export type { AnnonceGuidee, ForceGuidee } from './guidee';
