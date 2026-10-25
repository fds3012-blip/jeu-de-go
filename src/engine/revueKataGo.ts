// Analyses de la revue (explication d'une erreur, #673) et de l'étude (#372), sorties de src/engine/index.ts (C8, #732)
// pour rester hors du JS initial. Elles choisissent le réseau : le petit (g170 b6c96, toujours disponible) ou, si le
// joueur a téléchargé et activé « Analyse approfondie » (src/engine/approfondie.ts), le b10c128. Les autres usages de
// KataGo (adversaires, preuves, notation de chaque coup de la revue, conseil de Mochi) restent sur le petit réseau.
import type { Position } from '../go/rules';
import type { Rules } from '../go/score';
import { analyserGarde, getKataGo, kataGoRevue, reseauEnCache, type KataGoBackend } from './index';
import type { AnalyzeOptions } from './katago/search';

/**
 * Réseau approfondi branché par src/engine/approfondie.ts (chargé avec les écrans qui s'en servent). Sans lui, ou
 * désactivé, ou en échec : le petit réseau, sans rien dire de plus que `raisonRepli`.
 */
export interface Approfondi {
  /** Le réseau approfondi prêt, ou `null` (désactivé, absent du cache, trop lent, démarrage en échec). */
  fournir(): Promise<KataGoBackend | null>;
  /** Une analyse approfondie a échoué en route. */
  echec(): void;
  /** Pourquoi la dernière demande a pris le petit réseau. */
  raisonRepli(): 'trop-lent' | 'indisponible' | null;
  /** Options d'une recherche approfondie (même nombre de visites, plus de temps). */
  options(o: AnalyzeOptions): AnalyzeOptions;
}
let approfondi: Approfondi | null = null;
export function brancherApprofondi(a: Approfondi | null) { approfondi = a; }

/** Raison pour laquelle la dernière analyse n'a pas pu utiliser l'analyse approfondie (activée mais repliée). */
export const raisonRepliApprofondi = () => approfondi?.raisonRepli() ?? null;

/** KataGo du petit réseau pour la revue ou l'étude : en mémoire, ou démarré depuis le cache (aucun téléchargement). */
async function petitReseau(): Promise<KataGoBackend | null> {
  let k = kataGoRevue() ?? null;
  if ((!k || k.info.state !== 'pret') && (await reseauEnCache())) {
    k = getKataGo();
    try { await k?.start?.(); } catch { /* KataGo indisponible */ }
  }
  return k && k.info.state === 'pret' ? k : null;
}

/**
 * Essaie le réseau approfondi : le résultat de `calcul`, ou `null` pour que l'appelant prenne le petit réseau
 * (désactivé, indisponible, échec en route). Un échec n'est jamais montré à l'écran.
 */
async function essaiApprofondi<T>(calcul: (k: KataGoBackend, options: (o: AnalyzeOptions) => AnalyzeOptions) => Promise<T | null>): Promise<T | null> {
  const a = approfondi;
  if (!a) return null;
  try {
    const k = await a.fournir();
    if (!k) return null;
    const r = await calcul(k, a.options);
    if (r === null) a.echec();
    return r;
  } catch { a.echec(); return null; }
}

/**
 * #673 : analyse d'une erreur de la revue, pour la montrer et l'expliquer (src/go/explication.ts). Deux recherches de
 * `VISITES_ERREUR` visites, KataGo seulement (jamais le moteur simple ; chargé s'il l'est déjà ou si son réseau est en
 * cache, comme `meilleurCoup`) :
 * - `avant` (position avant l'erreur) : le meilleur coup, son avance pour le joueur au trait, ses visites, sa variante
 *   principale et la propriété après lui ;
 * - `apres` (position après l'erreur) : la réponse de l'adversaire (variante principale, visites) et la propriété.
 * La propriété va de -1 (Blanc) à +1 (Noir). Les mêmes réglages servent aux analyses figées des tests
 * (outils/explicationsKataGo.ts), toujours avec le petit réseau.
 * C8 (#732) : avec « Analyse approfondie », `approfondie: true` et `leadJoue` (avance du joueur après son coup, vue par le
 * même réseau : les deux avances ne se mélangent jamais entre deux réseaux).
 */
export const VISITES_ERREUR = 64;
export type AnalyseErreur =
  | { katago: false }
  | {
    katago: true; move: number | null; lead: number; visites: number; pv?: number[]; ownBon?: Float32Array;
    riposte?: { pv?: number[]; visites: number }; ownJoue?: Float32Array;
    approfondie?: true; leadJoue?: number;
  };

async function deuxRecherches(k: KataGoBackend, avant: Position, apres: Position, opts: AnalyzeOptions, approfond: boolean): Promise<AnalyseErreur> {
  const a = await analyserGarde(k, avant, opts);
  const b = a.moves[0];
  if (!b) return { katago: true, move: null, lead: a.lead, visites: 0 };
  // Sans la seconde recherche, le bon coup reste montré ; l'explication se contente de ce qui est sûr.
  const r = await analyserGarde(k, apres, opts).catch(() => null);
  const top = r?.moves[0];
  return {
    katago: true, move: b.move, lead: b.lead, visites: b.visits,
    ...(b.pv ? { pv: b.pv } : {}), ...(a.ownershipApres ? { ownBon: a.ownershipApres } : {}),
    ...(top ? { riposte: { visites: top.visits, ...(top.pv ? { pv: top.pv } : {}) } } : {}),
    ...(r?.ownership ? { ownJoue: r.ownership } : {}),
    ...(approfond ? { approfondie: true as const, ...(top ? { leadJoue: -top.lead } : {}) } : {}),
  };
}

export async function analyseErreur(avant: Position, apres: Position, komi: number, regles?: Rules): Promise<AnalyseErreur> {
  const base: AnalyzeOptions = { komi, visits: VISITES_ERREUR, timeMs: VISITES_ERREUR * 40, maxMoves: 6, ...(regles ? { regles } : {}) };
  // Approfondi d'abord. Sans la seconde recherche (`leadJoue`), il ne sert pas : l'explication mélangerait deux réseaux.
  const ap = await essaiApprofondi(async (k, options) => {
    const r = await deuxRecherches(k, avant, apres, options(base), true);
    return r.katago && r.move !== null && r.leadJoue !== undefined ? r : null;
  });
  if (ap) return ap;
  const k = await petitReseau();
  if (!k) return { katago: false };
  try { return await deuxRecherches(k, avant, apres, base, false); } catch { return { katago: false }; }
}

/**
 * Analyse d'une position posée à la main (#372, « Étudier une position »). KataGo seulement, jamais le moteur simple :
 * ses conseils sont trop peu sûrs. KataGo est démarré s'il est en mémoire ou si son réseau est en cache ; sinon
 * `katago: false`, et l'écran propose le téléchargement (`preparerKataGo`). Une seule recherche par appel (batterie).
 * `lead` : avance de Noir, komi compris ; `coups` : les meilleurs coups pour le joueur au trait, du meilleur au moins
 * bon, avec ses chances de gain (0 à 1) et son avance en points.
 * #562 : `komi` est le komi compté (compensation du handicap comprise en chinois, `reglagesAnalyse` de src/go/etude.ts)
 * et `regles` la règle de comptage choisie dans l'étude, donnée à KataGo (sans elle, sa règle historique).
 * C8 (#732) : `approfondie: true` quand l'analyse vient du réseau approfondi.
 */
export type AnalyseEtude =
  | { katago: false }
  | { katago: true; lead: number; coups: { move: number; winrate: number | null; lead: number }[]; approfondie?: true };

export async function analyseEtude(pos: Position, komi: number, visites = 96, regles?: Rules): Promise<AnalyseEtude> {
  const base: AnalyzeOptions = { komi, visits: visites, timeMs: visites * 30, maxMoves: 6, ...(regles ? { regles } : {}) };
  const resultat = async (k: KataGoBackend, opts: AnalyzeOptions, approfond: boolean): Promise<AnalyseEtude> => {
    const a = await analyserGarde(k, pos, opts);
    return {
      katago: true,
      lead: pos.toPlay === 1 ? a.lead : -a.lead,
      coups: a.moves.map(m => ({ move: m.move, winrate: typeof m.winrate === 'number' ? m.winrate : null, lead: m.lead })),
      ...(approfond ? { approfondie: true as const } : {}),
    };
  };
  const ap = await essaiApprofondi((k, options) => resultat(k, options(base), true));
  if (ap) return ap;
  const k = await petitReseau();
  if (!k) return { katago: false };
  return resultat(k, base, false);
}
