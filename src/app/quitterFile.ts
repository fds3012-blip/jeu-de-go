// #498 : quitter la file des parties lentes (annuler la recherche, ou ouvrir la partie trouvée) sans jamais laisser
// de rejet non géré. Hors ligne, ni le module chargé à la demande (src/data/lente.ts) ni le serveur ne répondent :
// avant, `import()` rejetait sans `catch` (erreur non gérée, rien à l'écran). Désormais : un message, et un nouvel
// essai automatique au retour en ligne.
import type { Result } from '../data/lente';

export type IssueQuitter = { etat: 'fait'; partieId: string | null } | { etat: 'hors-ligne' } | { etat: 'erreur' };

/** Quitte la file. Ne rejette jamais : hors ligne (`enLigne()` faux), on réessaiera au retour ; sinon, erreur. */
export async function tenterQuitter(quitter: () => Promise<Result<string | null>>, enLigne: () => boolean): Promise<IssueQuitter> {
  try {
    const q = await quitter();
    if (q.ok) return { etat: 'fait', partieId: q.value };
  } catch { /* module introuvable ou réseau coupé */ }
  return enLigne() ? { etat: 'erreur' } : { etat: 'hors-ligne' };
}

type Cible = Pick<Window, 'addEventListener' | 'removeEventListener'>;

/** Appelle `f` une fois, au retour en ligne. Renvoie de quoi annuler. */
export function auRetourEnLigne(f: () => void, cible: Cible = window): () => void {
  const surRetour = () => { cible.removeEventListener('online', surRetour); f(); };
  cible.addEventListener('online', surRetour);
  return () => cible.removeEventListener('online', surRetour);
}
