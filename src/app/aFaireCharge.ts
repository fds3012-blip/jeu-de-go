// Notifications dans l'app (#367) : tout ce qui calcule « À faire », chargé à la demande, après le premier écran
// (budget du JS initial, scripts/budget-bundle.mjs). Le crochet léger qui l'appelle : src/app/useAFaire.ts.
import { mesDefis } from '../data/defi';
import { lireRecherche, type RechercheLente } from '../data/lente';
import { lirePseudos } from '../data/pseudos';
import { notificationsEnAttente, partiesNonVues } from '../data/notifications';
import type { Db } from '../data/supabase';
import type { DefiEnAttente } from './aFaire';
import { defisEnAttente } from './defisAJouer';

export { elementsAFaire, leconEnCours, ongletsAPastille } from './aFaire';
export { ecouterNotifications } from '../data/notifications';

/**
 * Défis où c'est au joueur d'agir, lus sous la RLS (ses seuls défis et parties), avec le pseudo de l'adversaire
 * (profils publics). `pseudos` garde les pseudos déjà lus d'une lecture à l'autre. Erreur : liste vide.
 * `nouveau` : une notification attend pour la partie (#367). Notifications illisibles (serveur plus ancien que
 * l'app, réseau) : `nouveau` reste absent et la pastille s'allume comme avant.
 */
export async function chargerDefis(db: Db, userId: string, pseudos: Map<string, string | null>): Promise<DefiEnAttente[]> {
  const [r, n] = await Promise.all([mesDefis(db, userId), notificationsEnAttente(db, userId)]);
  if (!r.ok) return [];
  const nonVues = n.ok ? partiesNonVues(n.value) : null;
  const attente = defisEnAttente(r.value, userId);
  await lirePseudos(db, attente.map(x => x.adversaireId), pseudos);
  return attente.map(({ adversaireId, ...x }) => ({
    ...x,
    adversaire: adversaireId ? pseudos.get(adversaireId) ?? null : null,
    ...(nonVues ? { nouveau: nonVues.has(x.partieId) } : {}),
  }));
}

/** #440 : la recherche de partie lente en cours (ou l'adversaire trouvé pendant l'absence), null sinon ou en erreur. */
export async function chargerRecherche(db: Db, userId: string): Promise<RechercheLente | null> {
  const r = await lireRecherche(db, userId);
  return r.ok ? r.value : null;
}
