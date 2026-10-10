// Première pierre posée sur l'appareil (#487, P9 du rapport docs/ux/premieres-minutes-2026-10.md).
//
// Au tout premier lancement, l'accueil ne montre que la promesse de Mochi, le goban, l'adversaire et une seule action
// (« Joue ta première partie »), plus le lien discret « Je sais déjà jouer ». Les tuiles de modes (dont la partie en
// ligne classée), le Go du jour, la leçon et les cartes secondaires attendent la première pierre posée, où que ce soit :
// partie, leçon, problème, placement. Le plateau (src/ui/Board.tsx) la note au premier coup joué sur un point vide.
//
// Un appareil d'avant ce repère (parties, leçons, problèmes, série ou placement déjà gardés) compte comme « pierre
// posée » : un joueur qui revient ne perd jamais ses tuiles.
//
// Mesure (#519) : le plateau signale aussi chaque pierre posée et chaque premier toucher avec son lieu (`pierrePosee`,
// `toucherPlateau`). Le compteur anonyme `premiere_pierre` (src/data/compteurs.ts) part donc où que la pierre soit posée,
// et l'événement PostHog `premiere_pierre` porte `lieu`. La partie (src/app/Game.tsx) garde son propre envoi PostHog,
// plus riche (mode, adversaire, taille), avec `lieu: 'partie'`.
import { jamaisJoue } from './arriveePartage';
import { compterEtape } from '../data/compteurs';
import { EVENTS, secondsSinceOpen, trackOnce } from '../data/analytics';

/** Où le plateau est posé. `autre` : étude, revue, et tout plateau qui ne le dit pas. Jamais plus précis que ça. */
export type LieuPierre = 'partie' | 'en_ligne' | 'lecon' | 'probleme' | 'placement' | 'autre';

/** `true` dès la première pierre posée sur cet appareil. Aucune autre donnée. */
export const PREMIERE_PIERRE_KEY = 'go.premiere-pierre.v1';
/** Événement de fenêtre envoyé à la première pierre : l'accueil, déjà monté sous la partie, se complète. */
export const EVENEMENT_PREMIERE_PIERRE = 'go:premiere-pierre';

/** Une pierre a-t-elle déjà été posée ? Le repère, ou toute activité gardée sur l'appareil (parties, leçons…). */
export function pierreDejaPosee(repere: unknown, activite: readonly unknown[]): boolean {
  return repere === true || !jamaisJoue(activite);
}

/**
 * Accueil épuré : tout premier lancement (`nouveau` : ni partie, ni leçon, ni bilan, voir home.ts) et aucune pierre
 * posée. Une partie lancée compte déjà comme une partie (`nouveau` faux) : la décision #432 (« Jouer en ligne » en
 * action principale après la première partie) reste entière.
 */
export function accueilEpure(o: { nouveau: boolean; pierre: boolean }): boolean {
  return o.nouveau && !o.pierre;
}

type Stockage = Pick<Storage, 'getItem' | 'setItem'>;
const stockageParDefaut = (): Stockage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

let deja = false;

/** Repère lu sur l'appareil. Une fois vrai, gardé en mémoire ; tant qu'il est faux, relu (un autre onglet a pu l'écrire). */
export function lireRepere(stockage: Stockage | null = stockageParDefaut()): boolean {
  if (deja) return true;
  try { deja = stockage?.getItem(PREMIERE_PIERRE_KEY) === 'true'; } catch { /* stockage indisponible : faux */ }
  return deja;
}

/**
 * Note la pierre posée : écrit le repère une fois, puis prévient l'accueil. Les coups suivants ne coûtent rien.
 * Stockage indisponible (navigation privée stricte) : le repère vaut pour la session, l'accueil se complète quand même.
 */
export function noterPierrePosee(stockage: Stockage | null = stockageParDefaut()): void {
  if (lireRepere(stockage)) return;
  deja = true;
  try { stockage?.setItem(PREMIERE_PIERRE_KEY, 'true'); } catch { /* repère gardé en mémoire seulement */ }
  try { window.dispatchEvent(new Event(EVENEMENT_PREMIERE_PIERRE)); } catch { /* hors navigateur */ }
}

/**
 * Pierre posée par le joueur sur un point vide (appelé par le plateau à chaque pose ; seul le premier appel compte) :
 * compteur anonyme `premiere_pierre` (une fois par appareil neuf), événement PostHog `premiere_pierre` avec `lieu` (une fois
 * par session sans accord ; la partie l'envoie elle-même), puis le repère de l'accueil.
 */
export function pierrePosee(lieu: LieuPierre): void {
  compterEtape('premiere_pierre');
  if (lieu !== 'partie') trackOnce(EVENTS.premierePierre, { secondes: secondsSinceOpen(), lieu });
  noterPierrePosee();
}

/**
 * Premier toucher d'un point vide d'un plateau jouable (pierre fantôme montrée, ou pierre posée d'un coup) : compteur
 * anonyme `premier_toucher_plateau` et événement PostHog du même nom (`secondes`, `lieu`). Sépare « n'a jamais touché le
 * plateau » de « a vu la pierre fantôme sans la confirmer » (#466).
 */
export function toucherPlateau(lieu: LieuPierre): void {
  compterEtape('premier_toucher_plateau');
  trackOnce(EVENTS.premierToucherPlateau, { secondes: secondsSinceOpen(), lieu });
}

/** Abonnement pour `useSyncExternalStore` : relit le repère à la première pierre. */
export function abonnerPierre(rappel: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  // `storage` : une pierre posée dans un autre onglet complète aussi cet accueil.
  const autreOnglet = (e: StorageEvent) => { if (e.key === PREMIERE_PIERRE_KEY) rappel(); };
  window.addEventListener(EVENEMENT_PREMIERE_PIERRE, rappel);
  window.addEventListener('storage', autreOnglet);
  return () => { window.removeEventListener(EVENEMENT_PREMIERE_PIERRE, rappel); window.removeEventListener('storage', autreOnglet); };
}

/** Tests seulement : oublie le repère gardé en mémoire. */
export function oublierRepere(): void { deja = false; }
