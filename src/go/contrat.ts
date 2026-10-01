// Version du contrat de la fonction serveur game-action (issue #344), partagée par le client et le serveur.
// Ce fichier est copié dans supabase/functions/game-action/go par scripts/sync-functions.mjs : le serveur déployé
// renvoie la valeur qu'il avait au moment du déploiement, le client compare avec la sienne.
//
// Augmente CONTRAT_GAME_ACTION à chaque changement que le client ne peut pas utiliser sur un serveur plus ancien
// (nouvelle action, nouveau champ obligatoire, nouveau code de refus). Historique :
//   1 : parties en ligne (move, propose_dead, accept, resume), 27/09.
//   2 : défi par lien, action `defi_coup` (#81), 29/09.
//   3 : action `version` (#344), 30/09. Un serveur qui ne la connaît pas répond 400 `format` : il est plus ancien.

export const CONTRAT_GAME_ACTION = 3;

/** Demande de version : POST { action: 'version' }. Sans connexion, sans lecture de la base. */
export function estDemandeVersion(body: unknown): boolean {
  return !!body && typeof body === 'object' && (body as { action?: unknown }).action === 'version';
}

export interface ReponseVersion {
  ok: true;
  contrat: number;
}

export function reponseVersion(): ReponseVersion {
  return { ok: true, contrat: CONTRAT_GAME_ACTION };
}
