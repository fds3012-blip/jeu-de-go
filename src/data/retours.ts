/**
 * Retours des joueurs en 3 questions (#537, prérequis P7 du plan d'acquisition).
 *
 * Envoi par la fonction `envoyer_retour` (migration 20261014150000_retours_joueurs.sql), comme les compteurs anonymes
 * (src/data/compteurs.ts) : `fetch` avec la seule clé publique, jamais le jeton du joueur, sans cookie ni adresse
 * d'origine. Le retour n'est donc lié à aucun compte, et l'envoi marche sans compte et sans charger supabase-js.
 * Le serveur plafonne (20 par minute, 500 par jour, pour tout le monde) : au-delà, il répond `false`.
 */
import { configSupabase, envDeTest } from './client';

export const CONSEILS = ['oui', 'peut_etre', 'non'] as const;
export type Conseil = (typeof CONSEILS)[number];
export const SOURCES = ['ami', 'reseau', 'club', 'recherche', 'autre'] as const;
export type Source = (typeof SOURCES)[number];
/** Longueur maximale de la réponse libre (même limite que le serveur). */
export const TEXTE_MAX = 1000;

/**
 * Adresse de contact affichée dans l'aide et après l'envoi. Celle d'où partent les e-mails de l'app (Resend,
 * docs/journal.md) : Florian doit vérifier qu'elle REÇOIT bien le courrier (redirection), ou la remplacer ici.
 */
export const ADRESSE_CONTACT = 'jeu@mochi-go.app';

export interface Retour {
  conseil: Conseil | null;
  ameliorer: string;
  source: Source | null;
  langue: 'fr' | 'en';
}

/** Corps envoyé à `envoyer_retour` (noms des arguments de la fonction SQL). */
export interface CorpsRetour { p_conseil: Conseil; p_ameliorer: string | null; p_source: Source | null; p_langue: 'fr' | 'en' }

export type Verification = { ok: true; corps: CorpsRetour } | { ok: false; erreur: 'conseil' };

/** Vérifie le formulaire et prépare l'envoi : texte rogné (vide : absent), coupé à TEXTE_MAX caractères. */
export function preparerRetour(r: Retour): Verification {
  if (!r.conseil || !(CONSEILS as readonly string[]).includes(r.conseil)) return { ok: false, erreur: 'conseil' };
  const texte = [...r.ameliorer.trim()].slice(0, TEXTE_MAX).join('').trim();
  return {
    ok: true,
    corps: {
      p_conseil: r.conseil,
      p_ameliorer: texte || null,
      p_source: r.source && (SOURCES as readonly string[]).includes(r.source) ? r.source : null,
      p_langue: r.langue === 'en' ? 'en' : 'fr',
    },
  };
}

export type ResultatEnvoi = { ok: true } | { ok: false; erreur: 'limite' | 'horsLigne' | 'serveur' | 'indisponible' };

/** Envoie un retour déjà vérifié. Ne lève jamais : l'erreur dit quoi afficher. */
export async function envoyerRetour(corps: CorpsRetour, f: typeof fetch = fetch): Promise<ResultatEnvoi> {
  const config = configSupabase(envDeTest(import.meta.env));
  if (!config) return { ok: false, erreur: 'indisponible' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, erreur: 'horsLigne' };
  try {
    const rep = await f(`${config.url.replace(/\/+$/, '')}/rest/v1/rpc/envoyer_retour`, {
      method: 'POST',
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
    if (!rep.ok) return { ok: false, erreur: 'serveur' };
    return (await rep.json()) === true ? { ok: true } : { ok: false, erreur: 'limite' };
  } catch {
    return { ok: false, erreur: typeof navigator !== 'undefined' && navigator.onLine === false ? 'horsLigne' : 'serveur' };
  }
}
