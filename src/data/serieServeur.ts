// Série de l'appareil envoyée au serveur à la connexion (issue #176, suite de #161).
// Le client ne peut pas écrire les colonnes de série : il passe par la fonction serveur `importer_serie_appareil`,
// qui borne les valeurs (dernier jour = aujourd'hui ou hier à Paris, pas plus de jours que depuis le lancement)
// et ne fait jamais baisser la série du serveur. L'appel est idempotent : on peut le refaire à chaque connexion.
import type { Db } from './supabase';
import type { Result } from './account';

/** Série du Go du jour telle que l'appareil la garde : dernier numéro réussi et jours de suite. */
export interface SerieLocale { dernier: number; jours: number }

/** Ce que reçoit le serveur. `dernierJour` : date à Paris, AAAA-MM-JJ. */
export interface EnvoiSerie { jours: number; dernierJour: string }

const JOUR = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Date (AAAA-MM-JJ) du Go du jour n° `numero`, sachant que le n° 1 tombe le jour `lancement`. */
export function dateDuNumero(numero: number, lancement: string): string {
  const [y, m, d] = lancement.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + (numero - 1) * JOUR).toISOString().slice(0, 10);
}

/**
 * Série à envoyer, ou null s'il n'y a rien d'utile : pas de série, série morte (dernier réussi avant hier),
 * valeurs illisibles. Les jours sont bornés au numéro du dernier jour, comme le serveur le fait.
 */
export function serieAEnvoyer(serie: unknown, numeroDuJour: number, lancement: string): EnvoiSerie | null {
  if (typeof serie !== 'object' || serie === null) return null;
  const { dernier, jours } = serie as Partial<SerieLocale>;
  if (!Number.isInteger(dernier) || !Number.isInteger(jours) || !Number.isInteger(numeroDuJour)) return null;
  const d = dernier as number, j = jours as number;
  if (d < 1 || j < 1) return null;
  if (d !== numeroDuJour && d !== numeroDuJour - 1) return null;
  return { jours: Math.min(j, d), dernierJour: dateDuNumero(d, lancement) };
}

/**
 * Envoie la série de l'appareil. Rend la série du serveur après import (jamais plus basse qu'avant),
 * ou null si rien n'a été envoyé.
 */
export async function importerSerieAppareil(db: Pick<Db, 'rpc'>, envoi: EnvoiSerie | null): Promise<Result<number | null>> {
  if (!envoi || !Number.isInteger(envoi.jours) || envoi.jours < 1 || !ISO.test(envoi.dernierJour)) return { ok: true, value: null };
  try {
    const { data, error } = await db.rpc('importer_serie_appareil', { p_jours: envoi.jours, p_dernier_jour: envoi.dernierJour });
    if (error) return { ok: false, error: 'Impossible d’enregistrer ta série.' };
    return { ok: true, value: typeof data === 'number' ? data : null };
  } catch {
    return { ok: false, error: 'Impossible d’enregistrer ta série.' };
  }
}
