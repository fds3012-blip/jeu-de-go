// Logique de la fonction serveur `envoyer-rappels` (issue #36), sans dépendance : testée par Vitest
// (src/data/envoyerRappels.test.ts) avec une base et un service d'envoi simulés. index.ts la branche sur Supabase
// et sur la bibliothèque web-push.
//
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

/** Réponse du service de notification ; `statut` 0 : erreur réseau. */
export interface ResultatEnvoi { statut: number }

export interface Deps {
  /** `reclamer_rappels` : rappels dus maintenant, déjà marqués envoyés. */
  reclamer: () => Promise<Abonnement[]>;
  /** Envoie une notification chiffrée (web-push). Ne lève pas : rend le statut HTTP. */
  envoyer: (a: Abonnement, charge: string) => Promise<ResultatEnvoi>;
  /** Supprime des abonnements disparus. */
  supprimer: (ids: string[]) => Promise<void>;
}

export interface Bilan { dus: number; envoyes: number; supprimes: number; echecs: number }

/** Abonnement disparu côté navigateur (désinstallé, notifications retirées) : on l'oublie. */
export const estDisparu = (statut: number): boolean => statut === 404 || statut === 410;

/** Envois par lots, pour ne pas ouvrir des milliers de connexions d'un coup. */
export const TAILLE_LOT = 50;

export async function envoyerRappels(deps: Deps): Promise<Bilan> {
  const dus = await deps.reclamer();
  const bilan: Bilan = { dus: dus.length, envoyes: 0, supprimes: 0, echecs: 0 };
  const disparus: string[] = [];
  for (let i = 0; i < dus.length; i += TAILLE_LOT) {
    const lot = dus.slice(i, i + TAILLE_LOT);
    const resultats = await Promise.all(lot.map(a =>
      deps.envoyer(a, JSON.stringify(chargeDuJour(a.langue, a.jour))).catch((): ResultatEnvoi => ({ statut: 0 }))));
    resultats.forEach(({ statut }, j) => {
      if (statut >= 200 && statut < 300) bilan.envoyes++;
      else if (estDisparu(statut)) disparus.push(lot[j].id);
      else bilan.echecs++;
    });
  }
  if (disparus.length) {
    await deps.supprimer(disparus);
    bilan.supprimes = disparus.length;
  }
  return bilan;
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
