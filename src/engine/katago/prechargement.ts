// Préchargement de KataGo et backend mémorisé (#475). Logique pure, testée dans prechargement.test.ts.
//
// Règle des données mobiles : le réseau KataGo (3,8 Mo) n'est jamais téléchargé sans une action du joueur
// (revue, « Étudier une position », adversaire de l'échelle qui joue avec KataGo) ou ce contexte précis :
// - une partie vient de se terminer (la revue est la suite la plus probable) ;
// - ce n'est pas la toute première partie sur l'appareil (au premier lancement, rien en plus) ;
// - le navigateur ne signale ni l'économie de données (`saveData`), ni une connexion mobile (`type: 'cellular'`),
//   ni une connexion très lente (`effectiveType` 2g) ; s'il ne dit rien (Safari, Firefox), le préchargement est permis ;
// - la page est visible, le réseau n'est pas déjà en cache et KataGo n'est pas déjà en route.
// Une seule fois par session. Le préchargement ne démarre pas KataGo : il met le fichier en cache et le code de
// TensorFlow.js dans le cache du service worker, sans toucher au GPU.
import { BACKEND_ORDER, type Backend } from './loader';
import type { KataGoState } from './client';

/** Ce que `navigator.connection` peut dire (Chrome et Android ; absent sur Safari et Firefox). */
export interface InfoConnexion { saveData?: boolean; type?: string; effectiveType?: string }

export interface ContextePrechargement {
  /** Parties lancées sur l'appareil, celle qui vient de finir comprise. */
  partiesLancees: number;
  connexion?: InfoConnexion | null;
  /** Le réseau est déjà dans le cache du navigateur. */
  enCache: boolean;
  etat: KataGoState;
  visible: boolean;
}

export type RaisonSansPrechargement = 'premier-lancement' | 'economie-donnees' | 'reseau-mobile' | 'connexion-lente' | 'deja-en-cache' | 'deja-en-route' | 'arriere-plan';
export type DecisionPrechargement = { ok: true } | { ok: false; raison: RaisonSansPrechargement };

/** À partir de la 2e partie : la première partie ne télécharge rien de plus que l'app. */
export const PARTIES_MIN_PRECHARGEMENT = 2;
/** Délai après la fin de la partie : laisser passer le récit du score et la fête avant de télécharger. */
export const DELAI_PRECHARGEMENT_MS = 3000;

export function decisionPrechargement(c: ContextePrechargement): DecisionPrechargement {
  if (c.etat !== 'inactif') return { ok: false, raison: 'deja-en-route' };
  if (c.enCache) return { ok: false, raison: 'deja-en-cache' };
  if (c.partiesLancees < PARTIES_MIN_PRECHARGEMENT) return { ok: false, raison: 'premier-lancement' };
  const n = c.connexion;
  if (n?.saveData) return { ok: false, raison: 'economie-donnees' };
  if (n?.type === 'cellular') return { ok: false, raison: 'reseau-mobile' };
  if (n?.effectiveType === '2g' || n?.effectiveType === 'slow-2g') return { ok: false, raison: 'connexion-lente' };
  if (!c.visible) return { ok: false, raison: 'arriere-plan' };
  return { ok: true };
}

// ---------- Backend mémorisé ----------
/** Clé de stockage du backend qui a marché (appareil seulement, jamais envoyé). */
export const MEMO_BACKEND_KEY = 'go.katago.backend.v1';
/** Au-delà, on réessaie l'ordre complet : un pilote ou un navigateur a pu changer. */
export const MEMO_DUREE_MS = 30 * 24 * 3600 * 1000;

export interface MemoStocke { backend: Backend; ua: string; date: number }

/** Backend mémorisé s'il est encore valable : même navigateur (user agent) et moins de 30 jours. */
export function lireMemo(brut: string | null, ua: string, maintenant: number): Backend | null {
  if (!brut) return null;
  try {
    const m = JSON.parse(brut) as Partial<MemoStocke>;
    if (!m || !BACKEND_ORDER.includes(m.backend as Backend) || m.ua !== ua || typeof m.date !== 'number') return null;
    if (maintenant - m.date > MEMO_DUREE_MS || m.date > maintenant + 60_000) return null;
    return m.backend as Backend;
  } catch { return null; }
}

export function ecrireMemo(b: Backend, ua: string, maintenant: number): string {
  return JSON.stringify({ backend: b, ua, date: maintenant } satisfies MemoStocke);
}

// ---------- Progression ----------
/** Octets en mégaoctets, une décimale : « 2,1 » (fr) ou « 2.1 » (en). */
export function formatMo(octets: number, langue: 'fr' | 'en' = 'fr'): string {
  const s = (Math.max(0, octets) / 1e6).toFixed(1);
  return langue === 'fr' ? s.replace('.', ',') : s;
}
