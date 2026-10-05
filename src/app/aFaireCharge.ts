// Notifications dans l'app (#367) : tout ce qui calcule « À faire », chargé à la demande, après le premier écran
// (budget du JS initial, scripts/budget-bundle.mjs). Le crochet léger qui l'appelle : src/app/useAFaire.ts.
import { mesDefis } from '../data/defi';
import { lirePseudos } from '../data/pseudos';
import { notificationsEnAttente, partiesNonVues } from '../data/notifications';
import type { Db } from '../data/supabase';
import type { DefiEnAttente } from './aFaire';
import { defisEnAttente } from './defisAJouer';
import { rappelGoDuJour } from '../data/notifications';
import { dateParis } from './goDuJour';

export { elementsAFaire, leconEnCours, ongletsAPastille } from './aFaire';
export { ecouterNotifications } from '../data/notifications';

/**
 * Défis où c'est au joueur d'agir, lus sous la RLS (ses seuls défis et parties), avec le pseudo de l'adversaire
 * (profils publics). `pseudos` garde les pseudos déjà lus d'une lecture à l'autre. Erreur : liste vide.
 * `nouveau` : une notification attend pour la partie (#367). Notifications illisibles (serveur plus ancien que
 * l'app, réseau) : `nouveau` reste absent et la pastille s'allume comme avant.
 */
export async function chargerDefis(db: Db, userId: string, pseudos: Map<string, string | null>): Promise<DefiEnAttente[]> {
  return (await chargerAFaire(db, userId, pseudos)).defis;
}

/**
 * Défis où c'est au joueur d'agir (`chargerDefis`) et, #369, rappel du Go du jour d'un ami en attente aujourd'hui,
 * lus en une fois (une seule lecture des notifications).
 */
export async function chargerAFaire(db: Db, userId: string, pseudos: Map<string, string | null>): Promise<{ defis: DefiEnAttente[]; rappelGoDuJour: boolean }> {
  const [r, n] = await Promise.all([mesDefis(db, userId), notificationsEnAttente(db, userId)]);
  const rappel = n.ok && rappelGoDuJour(n.value, dateParis(new Date()), iso => dateParis(new Date(iso)));
  if (!r.ok) return { defis: [], rappelGoDuJour: rappel };
  const nonVues = n.ok ? partiesNonVues(n.value) : null;
  const attente = defisEnAttente(r.value, userId);
  await lirePseudos(db, attente.map(x => x.adversaireId), pseudos);
  const defis = attente.map(({ adversaireId, ...x }) => ({
    ...x,
    adversaire: adversaireId ? pseudos.get(adversaireId) ?? null : null,
    ...(nonVues ? { nouveau: nonVues.has(x.partieId) } : {}),
  }));
  return { defis, rappelGoDuJour: rappel };
}
