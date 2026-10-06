// Réglages synchronisés entre les appareils d'un même compte (#448). Module chargé à la demande, avec un compte
// seulement (App.tsx) : l'accueil ne l'embarque pas.
// Serveur : table `reglages_compte` (lisible par son seul propriétaire) et fonction `enregistrer_reglages` (liste
// blanche de clés et de valeurs, « dernier changement gagne » clé par clé) :
// supabase/migrations/20261006123100_reglages_compte.sql.
//
// Principe :
// - l'appareil reste la source de l'écran : hors ligne, chaque réglage local reste valable ;
// - chaque changement du joueur est daté sur l'appareil (src/app/reglagesDates.ts) ;
// - au démarrage connecté, l'appareil envoie ses réglages datés ; le serveur garde le plus récent de chaque clé et
//   renvoie l'ensemble ; l'appareil applique ce qui est plus récent que chez lui (un seul échange) ;
// - un changement part 1 seconde après (plusieurs changements rapprochés partent ensemble), sans bloquer l'écran ;
//   un envoi raté repart au changement suivant, au retour du réseau ou au retour sur l'app ;
// - la langue reçue d'un autre appareil s'applique à la prochaine ouverture (changer de langue recharge la page).
import type { Json } from './database.types';
import type { Db } from './supabase';
import { couperMessages, messagesCoupes } from './securite';
import { aAppliquer, CLES_REGLAGES, entreesLocales, nettoyer, type Reglages } from '../app/reglagesCompte';
import { ecouterReglages, ecrireDatesReglages, lireDatesReglages } from '../app/reglagesDates';
import { DEFAULTS, appliquerSettings, choisirThemeGoban, settingsCourants, themeGobanGarde, type Settings } from '../app/settings';
import { ecrireFaconEnLigne, lireFaconEnLigne } from '../app/enLigne';
import { lireChoixLangue, memoriserChoixLangue } from '../content/i18n/detection';
import type { IdThemeGoban } from '../ui/boardArt';

/** Délai entre un changement et son envoi : les changements rapprochés partent ensemble. */
export const DELAI_ENVOI_MS = 1000;
/** Au retour sur l'app, relire le serveur si le dernier échange date de plus d'une minute. */
const RELIRE_APRES_MS = 60_000;

const CLES_SETTINGS = Object.keys(CLES_REGLAGES).filter((k): k is keyof Settings => k in DEFAULTS);
const DEFAUTS: Record<string, unknown> = { ...DEFAULTS, langue: null, enLigne: 'direct', messagesCoupes: false, themeGoban: 'kaya' };

/** Valeurs actuelles de l'appareil pour chaque clé synchronisée. */
export function valeursLocales(): Record<string, unknown> {
  const s = settingsCourants();
  const v: Record<string, unknown> = {};
  for (const k of CLES_SETTINGS) v[k] = s[k];
  v.langue = lireChoixLangue();
  v.enLigne = lireFaconEnLigne();
  v.messagesCoupes = messagesCoupes();
  v.themeGoban = themeGobanGarde();
  return v;
}

/** Réglages de l'appareil, datés. */
export const reglagesLocaux = (maintenant = Date.now()): Reglages => entreesLocales(valeursLocales(), lireDatesReglages(), DEFAUTS, maintenant);

/** Applique sur l'appareil des réglages reçus du serveur, avec leurs dates (sans les renvoyer). */
export function appliquer(r: Reglages): void {
  const cles = Object.keys(r);
  if (!cles.length) return;
  const patch: Partial<Record<keyof Settings, unknown>> = {};
  for (const [k, e] of Object.entries(r)) {
    if ((CLES_SETTINGS as string[]).includes(k)) patch[k as keyof Settings] = e.v;
    else if (k === 'langue') memoriserChoixLangue(e.v as 'fr' | 'en');
    else if (k === 'enLigne') ecrireFaconEnLigne(e.v as 'direct' | 'lente');
    else if (k === 'messagesCoupes') couperMessages(e.v === true);
    else if (k === 'themeGoban') choisirThemeGoban(e.v as IdThemeGoban, false);
  }
  appliquerSettings(patch as Partial<Settings>);
  const dates = lireDatesReglages();
  for (const [k, e] of Object.entries(r)) dates[k] = e.t;
  ecrireDatesReglages(dates);
}

/** Envoie les réglages datés et reçoit l'ensemble fusionné du serveur, ou null (hors ligne, erreur). */
export async function echanger(db: Db, local: Reglages): Promise<Reglages | null> {
  try {
    const { data, error } = await db.rpc('enregistrer_reglages', { p_reglages: local as unknown as Json });
    return error ? null : nettoyer(data);
  } catch { return null; }
}

/**
 * Démarre la synchronisation pour le compte connecté : un échange tout de suite, puis à chaque changement (groupé),
 * au retour du réseau et au retour sur l'app. Renvoie de quoi l'arrêter (déconnexion, autre compte).
 */
export function demarrerSynchroReglages(db: Db): () => void {
  let actif = true;
  let file: Promise<void> = Promise.resolve();
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  let dernier = 0;

  const synchroniser = () => {
    file = file.then(async () => {
      if (!actif) return;
      const serveur = await echanger(db, reglagesLocaux());
      if (!serveur || !actif) return;
      dernier = Date.now();
      // Relu après l'échange : un réglage changé pendant l'envoi garde sa valeur (sa date est plus récente).
      appliquer(aAppliquer(reglagesLocaux(), serveur));
    });
    return file;
  };
  const plusTard = () => {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => { void synchroniser(); }, DELAI_ENVOI_MS);
  };
  const auRetour = () => { if (document.visibilityState === 'visible' && Date.now() - dernier > RELIRE_APRES_MS) void synchroniser(); };
  const enLigne = () => { void synchroniser(); };

  const debrancher = ecouterReglages(plusTard);
  window.addEventListener('online', enLigne);
  document.addEventListener('visibilitychange', auRetour);
  void synchroniser();
  return () => {
    actif = false;
    clearTimeout(minuterie);
    debrancher();
    window.removeEventListener('online', enLigne);
    document.removeEventListener('visibilitychange', auRetour);
  };
}
