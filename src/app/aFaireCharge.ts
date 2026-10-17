// Notifications dans l'app (#367) : tout ce qui calcule « À faire », chargé à la demande, après le premier écran
// (budget du JS initial, scripts/budget-bundle.mjs). Le crochet léger qui l'appelle : src/app/useAFaire.ts.
import { mesDefis } from '../data/defi';
import { lireRecherche, type RechercheLente } from '../data/lente';
import { lirePseudos } from '../data/pseudos';
import { notificationsEnAttente, partiesNonVues, rappelGoDuJour } from '../data/notifications';
import type { Db } from '../data/supabase';
import type { DefiEnAttente } from './aFaire';
import { defisEnAttente } from './defisAJouer';
import { dateParis } from './goDuJour';
import { mesAmis } from '../data/amis';
import { versionAFaire } from '../data/fraicheurAFaire';

export { elementsAFaire, leconEnCours, ongletsAPastille } from './aFaire';
export { ecouterNotifications } from '../data/notifications';

/**
 * #584 : « À faire » était relu à chaque changement d'onglet (défis, notifications, recherche lente, demandes d'ami :
 * 4 requêtes). Une lecture est maintenant gardée FRAICHEUR_A_FAIRE_MS au plus, par compte, et relue avant si « À faire »
 * a changé (`versionAFaire` : défi créé, rejoint, joué ou abandonné, notifications lues, demande d'ami, recherche
 * lente, notification reçue en temps réel), si l'appelant la force (retour sur l'app, minuterie, retour d'une partie)
 * ou si elle a échoué. Les changements d'écran rapprochés (src/app/useAFaire.ts) reçoivent la même promesse.
 */
export const FRAICHEUR_A_FAIRE_MS = 60_000;

interface Gardee<T> { compte: string; t: number; version: number; p: Promise<T> }

/** Faut-il relire ? Oui si forcé, jamais lu, autre compte, version changée ou lecture trop ancienne. */
export function aRelire(g: Omit<Gardee<unknown>, 'p'> | null, compte: string, maintenant: number, force = false): boolean {
  return force || !g || g.compte !== compte || g.version !== versionAFaire() || maintenant - g.t >= FRAICHEUR_A_FAIRE_MS;
}

/** Garde la lecture `lire` sous `cle` ; `ok` dit si elle a réussi (sinon, la suivante relit). */
function garder<T>(gardees: Map<string, Gardee<T>>, cle: string, compte: string, force: boolean, lire: () => Promise<T>, ok: (v: T) => boolean, maintenant = Date.now()): Promise<T> {
  const g = gardees.get(cle) ?? null;
  if (g && !aRelire(g, compte, maintenant, force)) return g.p;
  const e: Gardee<T> = { compte, t: maintenant, version: versionAFaire(), p: lire() };
  gardees.set(cle, e);
  const oublier = () => { if (gardees.get(cle) === e) gardees.delete(cle); };
  e.p.then(v => { if (!ok(v)) oublier(); }, oublier);
  return e.p;
}

type AFaireLu = { defis: DefiEnAttente[]; rappelGoDuJour: boolean; recherche: RechercheLente | null; demandesAmis: number; ok?: false };
const lectures = new Map<string, Gardee<AFaireLu>>();

/**
 * « À faire » du compte, lu au plus une fois par minute (#584) : défis, rappel du Go du jour, recherche lente et, avec
 * `amis` (compte complet, #359), demandes d'ami reçues (pastille du Profil). Avant, chacun relisait à chaque écran.
 */
export function chargerAFaireFrais(db: Db, userId: string, pseudos: Map<string, string | null>, amis: boolean, force: boolean): Promise<AFaireLu> {
  return garder(lectures, `${userId}|${amis}`, userId, force, async () => {
    const [l, recherche, a] = await Promise.all([chargerAFaire(db, userId, pseudos), chargerRecherche(db, userId).catch(() => null),
      amis ? mesAmis(db).catch(() => null) : null]);
    const demandesAmis = a?.ok ? a.value.filter(x => x.etat === 'recue').length : 0;
    return { ...l, recherche, demandesAmis, ...(amis && !a?.ok ? { ok: false as const } : {}) };
  }, v => v.ok !== false);
}

/** Tests seulement. */
export function _oublierAFaire() { lectures.clear(); }

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
 * lus en une fois (une seule lecture des notifications). `ok` : faux si les défis n'ont pas pu être lus (#584 : la
 * lecture n'est alors pas gardée en cache).
 */
export async function chargerAFaire(db: Db, userId: string, pseudos: Map<string, string | null>): Promise<{ defis: DefiEnAttente[]; rappelGoDuJour: boolean; ok?: false }> {
  const [r, n] = await Promise.all([mesDefis(db, userId), notificationsEnAttente(db, userId)]);
  const rappel = n.ok && rappelGoDuJour(n.value, dateParis(new Date()), iso => dateParis(new Date(iso)));
  if (!r.ok) return { defis: [], rappelGoDuJour: rappel, ok: false };
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

/** #440 : la recherche de partie lente en cours (ou l'adversaire trouvé pendant l'absence), null sinon ou en erreur. */
export async function chargerRecherche(db: Db, userId: string): Promise<RechercheLente | null> {
  const r = await lireRecherche(db, userId);
  return r.ok ? r.value : null;
}
