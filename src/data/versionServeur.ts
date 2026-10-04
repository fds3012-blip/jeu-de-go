// Version du serveur de jeu (issue #344). En production, le défi a été cassé parce que la fonction game-action
// n'avait pas été redéployée : chaque coup revenait « Ce coup n'a pas pu être lu ». Ce module compare la version du
// contrat de la fonction déployée (action `version`, src/go/contrat.ts) avec celle du client, et donne un message
// clair : « Mise à jour du serveur en cours ».
//
// Branchement prévu (src/data/defi.ts, périmètre frontend) : quand un coup est refusé avec le code `format` (ce que
// répond un serveur qui ne connaît pas l'action), appeler `messageSiServeurAncien(db, corps)` ; s'il renvoie un
// texte, l'afficher à la place du refus. Le contrôle n'est fait qu'après un refus, jamais avant chaque coup : un
// serveur à jour ne coûte aucun appel de plus.
import { t } from '../content/i18n/secondaires';
import { CONTRAT_GAME_ACTION } from '../go/contrat';
import type { Db } from './supabase';

export { CONTRAT_GAME_ACTION };

/** `a-jour` : le serveur connaît tout ce que le client utilise ; `ancien` : il faut le redéployer ; `injoignable` : réseau. */
export type EtatServeur = 'a-jour' | 'ancien' | 'injoignable';

/** Statut HTTP d'une erreur de `functions.invoke` (FunctionsHttpError porte la réponse dans `context`). */
function statutHttp(error: unknown): number | null {
  const ctx = (error as { context?: unknown } | null)?.context;
  const status = (ctx as { status?: unknown } | null | undefined)?.status;
  return typeof status === 'number' ? status : null;
}

/**
 * Version du contrat de la fonction déployée. 0 si elle ne connaît pas l'action `version` (400) ou n'existe pas (404) :
 * elle est plus ancienne que le contrat 3. null si le serveur ne répond pas (réseau, 5xx).
 */
export async function lireContratServeur(db: Db): Promise<number | null> {
  try {
    const { data, error } = await db.functions.invoke<{ ok?: unknown; contrat?: unknown }>('game-action', { body: { action: 'version' } });
    if (error) {
      const statut = statutHttp(error);
      return statut === 400 || statut === 404 ? 0 : null;
    }
    const contrat = data?.contrat;
    return typeof contrat === 'number' && Number.isInteger(contrat) && contrat >= 0 ? contrat : 0;
  } catch {
    return null;
  }
}

/** Compare la version du serveur à celle dont le client a besoin (par défaut, celle du client). */
export function etatServeur(contrat: number | null, besoin: number = CONTRAT_GAME_ACTION): EtatServeur {
  if (contrat === null) return 'injoignable';
  return contrat >= besoin ? 'a-jour' : 'ancien';
}

export async function verifierServeur(db: Db, besoin: number = CONTRAT_GAME_ACTION): Promise<EtatServeur> {
  return etatServeur(await lireContratServeur(db), besoin);
}

/** Refus qui peut venir d'un serveur trop ancien : `format` (action ou champ inconnu), ou pas de code du tout. */
export function refusPeutVenirDUnServeurAncien(corps: { error?: unknown } | null | undefined): boolean {
  const code = corps?.error;
  return code === undefined || code === null || code === 'format';
}

/**
 * Après un refus de game-action : « Mise à jour du serveur en cours » si le serveur est plus ancien que le client,
 * sinon null (le refus habituel reste le bon message).
 */
export async function messageSiServeurAncien(db: Db, corps: { error?: unknown } | null | undefined): Promise<string | null> {
  if (!refusPeutVenirDUnServeurAncien(corps)) return null;
  return (await verifierServeur(db)) === 'ancien' ? t('serveur.miseAJour') : null;
}
