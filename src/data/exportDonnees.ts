// Export de mes données (issue #530, art. 15 et 20 RGPD) : ce que le serveur garde sur le compte (fonction
// `exporter_mes_donnees`, supabase/migrations/20261013210200_export_donnees.sql) et ce que l'appareil garde (stockage
// local de l'app), réunis dans un fichier JSON lisible, téléchargé sur l'appareil. Rien d'autre ne part : le fichier
// est fait dans le navigateur.
//
// Jamais dans le fichier : la session de connexion (`sb-…`), l'identifiant de mesure (`ph_…`), le stockage de session
// (code de rattachement, jeton d'un défi en attente de connexion) ni toute clé dont le nom parle de jeton.
import type { Db } from './supabase';
import { CODE_COMPTE_REQUIS } from './compteRequis';

/** Préfixe des clés de l'app dans le stockage local (voir la section 3.1 de la politique de confidentialité). */
const PREFIXE_APP = /^go\./;
/** Clés exclues par prudence, même sous le préfixe de l'app. */
const SECRETES = /jeton|token|rattachement|retour-connexion/i;

/** Ce que l'appareil garde : chaque clé de l'app, sa valeur relue en JSON si possible. */
export function donneesAppareil(stockage: Pick<Storage, 'length' | 'key' | 'getItem'> | undefined): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (!stockage) return r;
  try {
    const cles: string[] = [];
    for (let i = 0; i < stockage.length; i++) {
      const k = stockage.key(i);
      if (k && PREFIXE_APP.test(k) && !SECRETES.test(k)) cles.push(k);
    }
    for (const k of cles.sort()) {
      const brut = stockage.getItem(k);
      if (brut === null) continue;
      try { r[k] = JSON.parse(brut); } catch { r[k] = brut; }
    }
  } catch { /* stockage illisible : rien de l'appareil */ }
  return r;
}

/** Nom du fichier : `mochi-go-mes-donnees-2026-10-13.json` (jour local). */
export function nomFichier(maintenant = new Date()): string {
  const d = (n: number) => String(n).padStart(2, '0');
  return `mochi-go-mes-donnees-${maintenant.getFullYear()}-${d(maintenant.getMonth() + 1)}-${d(maintenant.getDate())}.json`;
}

export interface FichierExport {
  a_lire: string;
  app: 'Mochi Go';
  langue: string;
  genere_le: string;
  /** Ce que notre serveur garde sur le compte ; null sans compte. */
  serveur: unknown;
  appareil: { stockage_local: Record<string, unknown> };
}

export function assembler(serveur: unknown, appareil: Record<string, unknown>, aLire: string, langue: string, maintenant = new Date()): FichierExport {
  return { a_lire: aLire, app: 'Mochi Go', langue, genere_le: maintenant.toISOString(), serveur: serveur ?? null, appareil: { stockage_local: appareil } };
}

export type Refus = { raison: 'limite'; minutes: number } | { raison: 'serveur' } | { raison: 'horsLigne' };
export type ResultatServeur = { ok: true; compte: boolean; serveur: unknown } | ({ ok: false } & Refus);

/** Lit le refus du serveur : plafond (JGX01, minutes à attendre en indice), sinon serveur indisponible. */
export function lireRefus(erreur: { code?: string; hint?: string | null } | null | undefined): Refus {
  if (erreur?.code === 'JGX01') {
    const n = Number.parseInt(erreur.hint ?? '', 10);
    return { raison: 'limite', minutes: Number.isFinite(n) && n > 0 ? Math.min(n, 60) : 60 };
  }
  return { raison: 'serveur' };
}

/**
 * Données du serveur pour la session ouverte. Sans service de compte ou sans session : `compte` faux, rien à lire.
 * Hors ligne avec une session : refus (le fichier serait incomplet sans le dire).
 */
export async function lireServeur(db: Db | null | undefined, enLigne = typeof navigator === 'undefined' || navigator.onLine !== false): Promise<ResultatServeur> {
  if (!db) return { ok: true, compte: false, serveur: null };
  const session = await db.auth.getSession().then(({ data }) => !!data.session, () => false);
  if (!session) return { ok: true, compte: false, serveur: null };
  if (!enLigne) return { ok: false, raison: 'horsLigne' };
  try {
    const { data, error } = await db.rpc('exporter_mes_donnees');
    // Session expirée ou compte disparu : on garde l'appareil, sans prétendre avoir lu le compte.
    if (error?.code === CODE_COMPTE_REQUIS) return { ok: true, compte: false, serveur: null };
    if (error) return { ok: false, ...lireRefus(error) };
    return { ok: true, compte: true, serveur: data };
  } catch {
    return { ok: false, raison: navigator.onLine === false ? 'horsLigne' : 'serveur' };
  }
}

/** Fait télécharger `contenu` en JSON lisible (indenté). Renvoie faux si le navigateur ne le permet pas. */
export function telechargerJson(contenu: unknown, nom: string): boolean {
  try {
    const blob = new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return true;
  } catch {
    return false;
  }
}
