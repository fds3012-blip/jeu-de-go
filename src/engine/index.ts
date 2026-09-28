// API du moteur pour les écrans et les autres modules :
// - bestMove(position, niveau) : coup de l'adversaire (index y * N + x, -1 = passe) ;
// - analyze(position, options) : coups candidats, taux de victoire, avance, propriété ;
// - ownership(position) : carte de propriété de -1 (Blanc) à +1 (Noir) (KataGo, sinon simulations) ;
// - proposeDead(position) : pierres mortes proposées en fin de partie (deadStones en version synchrone).
// Pomme et Caillou utilisent le moteur simple (Monte-Carlo). Les 7 autres niveaux utilisent KataGo
// dans un Web Worker ; s'il ne démarre pas (pas de Worker, pas de backend, réseau introuvable),
// ils se replient sur le moteur simple, sans rien casser.
import { chooseMove, chooseMoveDetail, gainDuCoup, isLegalMove, OPPONENTS, opponent, raisonFrontiere, raisonPoints, reponseAccommodante, SEUIL_POINTS, type CoupExplique, type EngineOptions, type KataGoLevel, type Opponent, type OpponentId, type Raison, type Style } from './simple';
import { comptageAuto, deadStones, groupesIncertains, ownership as ownershipSimple, type ComptageAuto, type DeadOptions } from './dead';
import type { Position } from '../go/rules';
import type { Rules } from '../go/score';
import { avanceEstimee, mortesSelonPropriete } from '../go/estimation';
import { coupDeFermeture, frontieresOuvertes, partieAvancee } from '../go/frontieres';
import type { Demande, Reponse, Tache } from './simple.worker';
import { KataGoClient, type KataGoInfo } from './katago/client';
import { choisirCoup } from './katago/choose';
import { rng } from './sim';
import { CACHE_NAME, DEFAULT_MODEL_URL } from './katago/loader';
import type { Analysis, AnalyzeOptions, MoveInfo } from './katago/search';

export { OPPONENTS, opponent, chooseMove, chooseMoveDetail, deadStones, ownershipSimple };
// Réponse à la passe du joueur (#185) : seuil de points, gain d'un coup, raison affichable.
export { SEUIL_POINTS, gainDuCoup };
export type { CoupExplique, Raison };
// Fin de partie (#159) : points encore à fermer, coup qui en ferme un, avance comptée comme au comptage.
export { avanceEstimee, coupDeFermeture, frontieresOuvertes, mortesSelonPropriete, partieAvancee };
export type { ComptageAuto, Opponent, OpponentId, EngineOptions, DeadOptions, KataGoLevel, Style, Analysis, AnalyzeOptions, MoveInfo, KataGoInfo };

// ---------- Moteur simple dans son Worker ----------
// Deux Workers indépendants : l'un pour les coups et les pierres mortes, l'autre pour l'estimation d'avantage
// affichée pendant la partie, pour que l'estimation ne retarde jamais la réponse de l'adversaire.
let nextId = 1;
function canal() {
  let worker: Worker | null = null, broken = false;
  const pending = new Map<number, (r: Reponse) => void>();
  function getWorker(): Worker | null {
    if (broken || typeof Worker === 'undefined') return null;
    if (!worker) {
      try {
        worker = new Worker(new URL('./simple.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (e: MessageEvent<Reponse>) => { pending.get(e.data.id)?.(e.data); pending.delete(e.data.id); };
        worker.onerror = () => { broken = true; worker?.terminate(); worker = null; for (const [id, cb] of pending) cb({ id, move: Number.NaN, error: 'worker' }); pending.clear(); };
      } catch { broken = true; return null; }
    }
    return worker;
  }
  /** Envoie une demande au Worker ; `null` s'il est indisponible. */
  return (d: Tache): Promise<Reponse> | null => {
    const w = getWorker();
    if (!w) return null;
    const id = nextId++;
    return new Promise<Reponse>(resolve => { pending.set(id, resolve); w.postMessage({ ...d, id } satisfies Demande); });
  };
}
const ask = canal();
const askEstimation = canal();

function later<T>(f: () => T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(f()), 0));
}

async function simpleMoveDetail(pos: Position, lvl: Opponent, opts: EngineOptions): Promise<CoupExplique> {
  // Repli d'un niveau KataGo : le moteur simple à pleine force. Son `hasard` règle le tirage selon la politique
  // du réseau (#179), pas le moteur simple, qui est déjà bien plus faible.
  const sync = () => later(() => chooseMoveDetail(pos, lvl.katago ? { ...lvl, hasard: 0 } : lvl, opts));
  // Le Worker simple ne connaît que les identifiants : on lui passe les réglages du niveau en options.
  const niveau: OpponentId = lvl.katago ? 'caillou' : lvl.id;
  const q = ask({ kind: 'move', pos, niveau, opts: { timeMs: lvl.timeMs, playouts: lvl.playouts, ...opts } });
  if (!q) return sync();
  const r = await q;
  return Number.isNaN(r.move) ? sync() : { move: r.move, raison: r.raison ?? null };
}

async function simpleMove(pos: Position, lvl: Opponent, opts: EngineOptions): Promise<number> {
  return (await simpleMoveDetail(pos, lvl, opts)).move;
}

/** Pierres mortes proposées à l'entrée du comptage, calculées sans bloquer l'interface. */
export async function proposeDead(pos: Position): Promise<number[]> {
  const q = ask({ kind: 'dead', pos });
  const r = q && (await q);
  return r?.dead ?? later(() => deadStones(pos));
}

/**
 * Comptage automatique (#117) : pierres mortes et groupes incertains. Simulations dans le Worker, plus l'avis
 * de KataGo s'il est déjà chargé (on ne télécharge rien pour ça) : un désaccord rend le groupe incertain.
 */
export async function proposeComptage(pos: Position, komi: number): Promise<ComptageAuto> {
  const q = ask({ kind: 'dead', pos });
  const r = q && (await q);
  const base: ComptageAuto = r?.dead && r.incertains ? { dead: r.dead, incertains: r.incertains } : await later(() => comptageAuto(pos));
  const k = katago ?? null;
  if (!k || k.info.state !== 'pret' || !pos.board.some(v => v)) return base;
  try {
    const a = await k.analyze(pos, { komi, visits: 16, timeMs: 800 });
    const incertains = new Set([...base.incertains, ...groupesIncertains(pos, base.dead, [a.ownership])]);
    return { dead: base.dead, incertains: [...incertains].sort((x, y) => x - y) };
  } catch { return base; }
}

// ---------- KataGo ----------
/** Ce qu'il faut pour analyser avec KataGo ; remplaçable dans les tests. */
export interface KataGoBackend { analyze(pos: Position, opts: AnalyzeOptions): Promise<Analysis>; info: KataGoInfo; start?(): Promise<void> }

let katago: KataGoBackend | null | undefined;
let warned = false;

function modelUrl(): string {
  // Écrit en toutes lettres pour que Vite remplace la variable au build.
  return (import.meta.env.VITE_KATAGO_MODEL_URL as string | undefined) || DEFAULT_MODEL_URL;
}

function getKataGo(): KataGoBackend | null {
  if (katago !== undefined) return katago;
  if (typeof Worker === 'undefined') return (katago = null);
  katago = new KataGoClient({
    url: new URL(modelUrl(), typeof location !== 'undefined' ? location.href : 'http://localhost/').href,
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

/** Démarre le chargement de KataGo en avance (téléchargement du réseau, choix du backend). */
export function preloadKataGo(): void { getKataGo()?.start?.().catch(() => {}); }

/** Analyse de secours sans réseau : coup du moteur simple et propriété tirée des simulations. */
async function simpleAnalysis(pos: Position, o: AnalyzeOptions): Promise<Analysis> {
  const t0 = Date.now(), komi = o.komi ?? 6.5;
  const move = await simpleMove(pos, opponent('caillou'), { komi, timeMs: Math.min(o.timeMs ?? 600, 600) });
  const own = await later(() => ownershipSimple(pos, { timeMs: 150 }));
  let black = -komi;
  for (const v of own) black += v;
  const lead = pos.toPlay === 1 ? black : -black, winrate = lead > 0 ? 0.6 : 0.4;
  return { moves: [{ move, visits: 1, prior: 1, winrate, lead, scoreLoss: 0 }], winrate, lead, ownership: own, visits: 1, ms: Date.now() - t0, engine: 'simple' };
}

/** Analyse la position avec KataGo (repli : estimation du moteur simple, `engine: 'simple'`). */
export async function analyze(pos: Position, options: AnalyzeOptions = {}): Promise<Analysis> {
  const k = getKataGo();
  if (k) {
    try { return await k.analyze(pos, { visits: 64, ...options }); } catch { /* repli ci-dessous */ }
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
  const lvl = typeof niveau === 'string' ? opponent(niveau) : niveau;
  let coup: CoupExplique | null = null;
  const k = lvl.katago ? getKataGo() : null;
  if (lvl.katago && k) {
    try {
      // Plafond de 1,8 s par coup : l'objectif est une réponse en moins de 2 s.
      const a = await k.analyze(pos, { komi: opts.komi ?? 6.5, visits: lvl.katago.visits, timeMs: opts.timeMs ?? 1800 });
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
      const a = await k.analyze(pos, { komi, visits: 16, timeMs: 600, regles: opts.rules ?? 'japanese' });
      return { own: a.ownership, engine: 'katago' };
    } catch { /* repli ci-dessous */ }
  }
  const q = askEstimation({ kind: 'own', pos, timeMs: pos.size <= 9 ? 150 : 400 });
  const r = q && (await q);
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
export interface AnalyseRevue { lead: number; engine: 'katago' | 'simple'; coups?: { move: number; visits: number; lead: number }[] }
export async function analyseRevue(pos: Position, komi: number, opts: { visits?: number; kataGo?: boolean } = {}): Promise<AnalyseRevue | null> {
  const k = opts.kataGo === false ? null : kataGoRevue() ?? null;
  if (k && k.info.state === 'pret') {
    try {
      const visits = opts.visits ?? 32;
      const a = await k.analyze(pos, { komi, visits, timeMs: visits * 40, maxMoves: 6 });
      return { lead: pos.toPlay === 1 ? a.lead : -a.lead, engine: 'katago', coups: a.moves.map(m => ({ move: m.move, visits: m.visits, lead: m.lead })) };
    } catch { return null; }
  }
  const r = await estimateLead(pos, komi, { kataGo: false });
  return r && { lead: r.lead, engine: 'simple' };
}

/** Prépare KataGo pour la revue s'il est déjà chargé ou si son réseau est en cache (aucun téléchargement). */
export async function preparerKataGo(): Promise<boolean> {
  let k = kataGoRevue() ?? null;
  if ((!k || k.info.state !== 'pret') && (await reseauEnCache())) {
    k = getKataGo();
    try { await k?.start?.(); } catch { /* KataGo indisponible */ }
  }
  return !!k && k.info.state === 'pret';
}

/** Vrai si le réseau KataGo est déjà dans le cache du navigateur (Cache API) : le charger ne télécharge rien. */
export async function reseauEnCache(): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false;
    const url = new URL(modelUrl(), typeof location !== 'undefined' ? location.href : 'http://localhost/').href;
    return !!(await (await caches.open(CACHE_NAME)).match(url));
  } catch { return false; }
}

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
    const a = await k.analyze(pos, { komi, visits: 48, timeMs: 1200 });
    const b = a.moves[0];
    return b ? { katago: true, move: b.move, lead: b.lead } : { katago: true, move: null, lead: a.lead };
  } catch { return { katago: false }; }
}
