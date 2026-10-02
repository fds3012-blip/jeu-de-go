// Notifications dans l'app (#367) : tout ce qui calcule « À faire », chargé à la demande, après le premier écran
// (budget du JS initial, scripts/budget-bundle.mjs). Le crochet léger qui l'appelle : src/app/useAFaire.ts.
import { mesDefis } from '../data/defi';
import type { Db } from '../data/supabase';
import type { DefiEnAttente } from './aFaire';
import { defisEnAttente } from './defisAJouer';

export { elementsAFaire, leconEnCours, ongletsAPastille } from './aFaire';

/**
 * Défis où c'est au joueur d'agir, lus sous la RLS (ses seuls défis et parties), avec le pseudo de l'adversaire
 * (profils publics). `pseudos` garde les pseudos déjà lus d'une lecture à l'autre. Erreur : liste vide.
 */
export async function chargerDefis(db: Db, userId: string, pseudos: Map<string, string | null>): Promise<DefiEnAttente[]> {
  const r = await mesDefis(db, userId);
  if (!r.ok) return [];
  const attente = defisEnAttente(r.value, userId);
  const inconnus = [...new Set(attente.flatMap(x => x.adversaireId && !pseudos.has(x.adversaireId) ? [x.adversaireId] : []))];
  if (inconnus.length) {
    const p = await db.from('profiles').select('id, username').in('id', inconnus);
    for (const id of inconnus) pseudos.set(id, (p.data ?? []).find(x => x.id === id)?.username ?? null);
  }
  return attente.map(({ adversaireId, ...x }) => ({ ...x, adversaire: adversaireId ? pseudos.get(adversaireId) ?? null : null }));
}
