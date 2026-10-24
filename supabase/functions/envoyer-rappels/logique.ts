// Logique de la fonction serveur `envoyer-rappels` (issue #36), sans dépendance : testée par Vitest
// (src/data/envoyerRappels.test.ts) avec une base et un service d'envoi simulés. index.ts la branche sur Supabase
// et sur la bibliothèque web-push.
//
// Deux familles d'envois, même fonction, mêmes garde-fous (#699) :
// - le rappel quotidien du Go du jour (`reclamer_rappels`) ;
// - « à toi de jouer » dans une partie lente classée (`reclamer_tours`).
// Règles :
// - la base choisit les rappels dus et les marque envoyés (`reclamer_rappels`) : un par jour au plus, jamais la nuit ;
// - un abonnement que le service de notification dit disparu (404 ou 410) est supprimé ;
// - textes calmes, sans fausse urgence ni culpabilité (public avec enfants) : ni « vite », ni « tu vas perdre ta série ».

export type Langue = 'fr' | 'en';

/** Ligne rendue par `reclamer_rappels`. `jour` : date locale du joueur (AAAA-MM-JJ). */
export interface Abonnement {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  langue: string;
  jour: string;
}

/** Contenu lu par le service worker (public/sw.js, événement `push`). */
export interface ChargeRappel {
  titre: string;
  texte: string;
  /** Adresse ouverte au toucher : le Go du jour, et l'événement `rappel_ouvert`. */
  url: string;
  /** Même étiquette chaque jour : un nouveau rappel remplace celui d'hier au lieu de s'empiler. */
  tag: string;
}

export const URL_RAPPEL = '/?rappel=1';
export const TAG_RAPPEL = 'rappel-du-jour';

/** Textes qui tournent d'un jour à l'autre (un même texte chaque jour s'use vite : Yancey et Settles, KDD 2020). */
export const TEXTES: Record<Langue, readonly { titre: string; texte: string }[]> = {
  fr: [
    { titre: 'Le Go du jour est prêt', texte: 'Un petit problème de go t’attend. Deux minutes suffisent.' },
    { titre: 'Nouveau Go du jour', texte: 'Mochi a préparé un problème pour toi.' },
    { titre: 'Ton moment go', texte: 'Le problème du jour est là. Joue-le à ton rythme.' },
    { titre: 'Un coup à trouver', texte: 'Le Go du jour t’attend, quand tu veux.' },
  ],
  en: [
    { titre: 'Today’s Go puzzle is ready', texte: 'A small Go puzzle is waiting. Two minutes is enough.' },
    { titre: 'New daily Go puzzle', texte: 'Mochi has a puzzle for you.' },
    { titre: 'Your Go moment', texte: 'Today’s puzzle is here. Play it at your own pace.' },
    { titre: 'One move to find', texte: 'Today’s Go puzzle is waiting, whenever you like.' },
  ],
};

const langueDe = (l: string): Langue => (l === 'en' ? 'en' : 'fr');

/** Numéro de jour (jours depuis 1970) d'une date AAAA-MM-JJ ; 0 si illisible. */
export function numeroJour(jour: string): number {
  const t = Date.parse(`${jour}T00:00:00Z`);
  return Number.isNaN(t) ? 0 : Math.floor(t / 86_400_000);
}

export function chargeDuJour(langue: string, jour: string): ChargeRappel {
  const liste = TEXTES[langueDe(langue)];
  const { titre, texte } = liste[numeroJour(jour) % liste.length];
  return { titre, texte, url: URL_RAPPEL, tag: TAG_RAPPEL };
}

/** Réponse du service de notification ; `statut` 0 : erreur réseau, -1 : adresse refusée (#578). */
export interface ResultatEnvoi { statut: number }

export interface Deps {
  /** `reclamer_rappels` : rappels dus maintenant, déjà marqués envoyés. */
  reclamer: () => Promise<Abonnement[]>;
  /** Envoie une notification chiffrée (web-push). Ne lève pas : rend le statut HTTP. `tag` : sujet du message (remplace un message en attente du même sujet). */
  envoyer: (a: Abonnement, charge: string, tag: string) => Promise<ResultatEnvoi>;
  /** Supprime des abonnements disparus. */
  supprimer: (ids: string[]) => Promise<void>;
}

export interface Bilan { dus: number; envoyes: number; supprimes: number; echecs: number }

/** Abonnement disparu côté navigateur (désinstallé, notifications retirées) : on l'oublie. */
export const estDisparu = (statut: number): boolean => statut === 404 || statut === 410;

/** Envois par lots, pour ne pas ouvrir des milliers de connexions d'un coup. */
export const TAILLE_LOT = 50;

/**
 * Services de notification des navigateurs (#578). L'adresse d'un abonnement vient du client : sans cette liste,
 * la fonction enverrait des requêtes POST vers l'hôte de son choix (SSRF aveugle). Même liste que la contrainte
 * `abonnements_rappel_service_connu` (migration 20261017090000_durcissement_578.sql).
 * Chrome, Opera, Samsung Internet : FCM ; Firefox : Mozilla ; Safari : Apple ; Edge : WNS.
 */
const HOTES_PUSH = /^(?:fcm\.googleapis\.com|android\.googleapis\.com|(?:[a-z0-9-]+\.)*push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/;

/** Adresse d'abonnement acceptée : https, hôte de la liste, sans identifiants ni port, 1 024 caractères au plus. */
export function endpointAutorise(endpoint: string): boolean {
  if (endpoint.length > 1024) return false;
  let u: URL;
  try { u = new URL(endpoint); } catch { return false; }
  return u.protocol === 'https:' && !u.username && !u.password && !u.port && HOTES_PUSH.test(u.hostname);
}

/** Ce qu'il faut pour écrire à un appareil. */
type Cible = Pick<Abonnement, 'id' | 'endpoint' | 'p256dh' | 'auth'>;

/**
 * Envoie par lots à chaque appareil dû, supprime les abonnements disparus. `contenu` rend la charge de chaque envoi.
 * Adresse hors liste : rien n'est envoyé, compté en échec ; l'abonnement n'est pas supprimé (l'équipe le voit).
 */
async function diffuser<T extends Cible>(
  dus: T[], contenu: (x: T) => ChargeRappel, envoyer: (x: T, charge: string, tag: string) => Promise<ResultatEnvoi>,
  supprimer: (ids: string[]) => Promise<void>,
): Promise<Bilan> {
  const bilan: Bilan = { dus: dus.length, envoyes: 0, supprimes: 0, echecs: 0 };
  const disparus = new Set<string>();
  for (let i = 0; i < dus.length; i += TAILLE_LOT) {
    const lot = dus.slice(i, i + TAILLE_LOT);
    const resultats = await Promise.all(lot.map(x => {
      if (!endpointAutorise(x.endpoint)) return { statut: -1 };
      const c = contenu(x);
      return envoyer(x, JSON.stringify(c), c.tag).catch((): ResultatEnvoi => ({ statut: 0 }));
    }));
    resultats.forEach(({ statut }, j) => {
      if (statut >= 200 && statut < 300) bilan.envoyes++;
      else if (estDisparu(statut)) disparus.add(lot[j].id);
      else bilan.echecs++;
    });
  }
  if (disparus.size) {
    await supprimer([...disparus]);
    bilan.supprimes = disparus.size;
  }
  return bilan;
}

export async function envoyerRappels(deps: Deps): Promise<Bilan> {
  return diffuser(await deps.reclamer(), a => chargeDuJour(a.langue, a.jour), deps.envoyer, deps.supprimer);
}

// ---------- « À toi de jouer » (#699) ----------

/** Ligne rendue par `reclamer_tours` : un appareil à prévenir, pour une notification `tour` ou `comptage`. */
export interface Tour extends Cible {
  langue: string;
  type: string;
  partie_id: string;
}

export interface DepsTours {
  reclamer: () => Promise<Tour[]>;
  envoyer: (a: Tour, charge: string, tag: string) => Promise<ResultatEnvoi>;
  supprimer: (ids: string[]) => Promise<void>;
}

/**
 * Textes sobres : ni pseudo, ni adversaire, ni délai, ni compte à rebours, ni « vite » (public avec enfants). Le tour dit
 * que l'adversaire a joué ; le comptage dit que des pierres mortes sont proposées. Aucun ne promet du temps : la partie
 * lente a un délai par coup, qu'on ne contredit pas.
 */
export const TEXTES_TOUR: Record<Langue, Record<'tour' | 'comptage', { titre: string; texte: string }>> = {
  fr: {
    tour: { titre: 'À toi de jouer', texte: 'Ton adversaire a joué. La partie reprend à ton coup.' },
    comptage: { titre: 'On compte la partie', texte: 'Ton adversaire propose les pierres mortes. Regarde si tu es d’accord.' },
  },
  en: {
    tour: { titre: 'Your move', texte: 'Your opponent has played. The game is back to you.' },
    comptage: { titre: 'Let’s count the game', texte: 'Your opponent suggests the dead stones. See if you agree.' },
  },
};

export const TAG_TOUR = 'tour-';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Adresse ouverte au toucher : la partie (`/?tour=<identifiant>`), ou l'accueil si l'identifiant est illisible. */
export const urlTour = (partieId: string): string => (UUID.test(partieId) ? `/?tour=${partieId.toLowerCase()}` : '/');

/** Étiquette de la partie (32 caractères au plus pour le sujet web-push) : un nouveau message de la même partie remplace l'ancien. */
export const tagTour = (partieId: string): string => `${TAG_TOUR}${partieId.replace(/[^0-9a-f]/gi, '').slice(0, 12).toLowerCase()}`;

export function chargeTour(t: Pick<Tour, 'langue' | 'type' | 'partie_id'>): ChargeRappel {
  const { titre, texte } = TEXTES_TOUR[langueDe(t.langue)][t.type === 'comptage' ? 'comptage' : 'tour'];
  return { titre, texte, url: urlTour(t.partie_id), tag: tagTour(t.partie_id) };
}

export async function envoyerTours(deps: DepsTours): Promise<Bilan> {
  return diffuser(await deps.reclamer(), chargeTour, deps.envoyer, deps.supprimer);
}

/**
 * Seule la tâche planifiée appelle cette fonction : en-tête `Authorization: Bearer <RAPPELS_SECRET>`.
 * Comparaison en temps constant ; sans secret configuré, tout est refusé.
 */
export function autorise(entete: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !entete) return false;
  const recu = entete.replace(/^Bearer\s+/i, '');
  if (recu.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= recu.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}
