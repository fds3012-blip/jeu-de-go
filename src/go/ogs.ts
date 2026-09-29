// Lien de partie OGS (issue #286) : `online-go.com/game/N` → SGF, par l'API publique de téléchargement d'OGS
// (`/api/v1/games/N/sgf`). L'appel part du navigateur du joueur, vers OGS seulement : rien ne passe par nos serveurs.
// Si OGS refuse l'appel (réseau, CORS, partie privée ou introuvable), l'écran propose le fichier à la place.
// `fetch` est injecté pour les tests (importSgf.test.ts).
import { MAX_OCTETS } from './importSgf';

/** Délai d'attente de la réponse d'OGS : au-delà, on propose le fichier. */
export const DELAI_OGS_MS = 10_000;

export type RefusOgs = 'ogs-introuvable' | 'ogs-privee' | 'ogs-injoignable' | 'trop-gros';
export type ReponseOgs = { ok: true; texte: string; octets: number } | { ok: false; raison: RefusOgs };

/**
 * Numéro de partie d'un lien OGS collé (`https://online-go.com/game/67000001`, `online-go.com/game/view/67000001`,
 * avec ou sans `www.`, `beta.`, `/`, `?…` ou `#…`), sinon `null`. Un SGF qui cite un lien OGS dans PC[] n'est pas un lien.
 */
export function idPartieOgs(texte: string): number | null {
  const t = texte.trim();
  if (!t || t.includes('(;') || /\s/.test(t)) return null;
  const m = /^(?:https?:\/\/)?(?:(?:www|beta)\.)?online-go\.com\/game\/(?:view\/)?(\d{1,10})(?:[/?#].*)?$/i.exec(t);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Adresse de l'API publique de téléchargement SGF d'OGS. */
export function urlSgfOgs(id: number): string {
  return `https://online-go.com/api/v1/games/${id}/sgf`;
}

type Fetch = (url: string, init?: { signal?: AbortSignal; credentials?: 'omit'; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

/** Télécharge le SGF d'une partie OGS. Aucun cookie n'est envoyé (credentials: 'omit'). */
export async function chargerSgfOgs(id: number, f: Fetch = (u, i) => fetch(u, i), delai = DELAI_OGS_MS): Promise<ReponseOgs> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const minuteur = ctrl ? setTimeout(() => ctrl.abort(), delai) : null;
  try {
    const r = await f(urlSgfOgs(id), { signal: ctrl?.signal, credentials: 'omit', headers: { Accept: 'application/x-go-sgf, text/plain' } });
    if (r.status === 404) return { ok: false, raison: 'ogs-introuvable' };
    if (r.status === 401 || r.status === 403) return { ok: false, raison: 'ogs-privee' };
    if (!r.ok) return { ok: false, raison: 'ogs-injoignable' };
    const texte = await r.text();
    const octets = new TextEncoder().encode(texte).length;
    if (octets > MAX_OCTETS) return { ok: false, raison: 'trop-gros' };
    return { ok: true, texte, octets };
  } catch {
    // Réseau coupé, délai dépassé ou appel refusé par le navigateur (CORS) : le navigateur ne dit pas lequel.
    return { ok: false, raison: 'ogs-injoignable' };
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
}
