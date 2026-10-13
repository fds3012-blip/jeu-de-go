// Textes de « Mes données » et des mentions légales (issue #530), FR et EN. Hors du catalogue principal (fr.ts, dans le
// JS initial) : ils n'arrivent qu'avec le Profil, chargé à la demande. Le type d'EN impose la parité des clés.
// Règles du catalogue : phrases courtes, tutoiement.
import { langue, type Langue } from './index';

const FR = {
  'donnees.ligne': 'Mes données',
  'donnees.ligneDetail': 'Télécharger une copie',
  'donnees.titre': 'Mes données',
  'donnees.intro': 'Télécharge une copie de tout ce que Mochi Go garde sur toi, dans un fichier que tu peux ouvrir et garder.',
  'donnees.contenuCompte': 'Avec ton compte : ton profil, tes parties (au format SGF), ta cote, ta progression, tes réglages, tes amis, tes défis, tes révisions, tes signalements et ton accord aux conditions.',
  'donnees.contenuAppareil': 'Et ce que ton appareil garde : réglages, progression, parties récentes, tes choix sur la mesure.',
  'donnees.sansCompte': 'Sans compte, tout est sur ton appareil : le fichier contient ce qu’il garde.',
  'donnees.action': 'Télécharger mes données',
  'donnees.enCours': 'Préparation du fichier…',
  'donnees.fait': 'C’est fait : {fichier} est dans tes téléchargements.',
  'donnees.limite': 'Tu as déjà téléchargé tes données 3 fois en une heure. Réessaie dans {n} min.',
  'donnees.serveur': 'Le serveur ne répond pas. Réessaie dans un instant.',
  'donnees.horsLigne': 'Hors ligne : reconnecte-toi pour avoir aussi les données de ton compte.',
  'donnees.secrets': 'Pour ta sécurité, le fichier ne contient ni ta session de connexion, ni le lien secret de tes défis.',
  'donnees.supprimer': 'Pour tout effacer : Mon compte, « Supprimer mon compte ».',
  'donnees.mentions': 'Mentions légales',
  'donnees.fichierALire': 'Copie de tes données Mochi Go. « serveur » : ce que notre serveur garde sur ton compte. « appareil » : ce que cet appareil garde. Les parties sont au format SGF, lisible par tous les logiciels de go.',
  'mentions.retourConditions': 'Conditions et confidentialité',
  'mentions.retourApp': 'Retour à l’app',
};

export type CleDonnees = keyof typeof FR;

const EN: { readonly [K in CleDonnees]: string } = {
  'donnees.ligne': 'My data',
  'donnees.ligneDetail': 'Download a copy',
  'donnees.titre': 'My data',
  'donnees.intro': 'Download a copy of everything Mochi Go keeps about you, in a file you can open and keep.',
  'donnees.contenuCompte': 'With your account: your profile, your games (in SGF format), your rating, your progress, your settings, your friends, your challenges, your reviews, your reports and your consent to the terms.',
  'donnees.contenuAppareil': 'And what your device keeps: settings, progress, recent games, your choices about measurement.',
  'donnees.sansCompte': 'Without an account, everything is on your device: the file holds what it keeps.',
  'donnees.action': 'Download my data',
  'donnees.enCours': 'Preparing the file…',
  'donnees.fait': 'Done: {fichier} is in your downloads.',
  'donnees.limite': 'You’ve already downloaded your data 3 times in an hour. Try again in {n} min.',
  'donnees.serveur': 'The server isn’t answering. Try again in a moment.',
  'donnees.horsLigne': 'Offline: reconnect to also get your account’s data.',
  'donnees.secrets': 'For your safety, the file contains neither your sign-in session nor the secret link of your challenges.',
  'donnees.supprimer': 'To erase everything: My account, “Delete my account”.',
  'donnees.mentions': 'Legal notice',
  'donnees.fichierALire': 'Copy of your Mochi Go data. “serveur”: what our server keeps about your account. “appareil”: what this device keeps. Games are in SGF format, readable by every Go program.',
  'mentions.retourConditions': 'Terms and privacy',
  'mentions.retourApp': 'Back to the app',
};

export const CATALOGUE_DONNEES: Record<Langue, { readonly [K in CleDonnees]: string }> = { fr: FR, en: EN };

/** Texte dans une langue donnée, variables `{n}` remplacées. */
export function traduireDonnees(l: Langue, cle: CleDonnees, vars: Record<string, string | number> = {}): string {
  const brut = CATALOGUE_DONNEES[l][cle] || FR[cle];
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

/** Adresse de la page statique des mentions légales, dans une langue (#530 ; servie sans réécriture : finie par « / »). */
export const ADRESSE_MENTIONS: Record<Langue, string> = { fr: '/mentions-legales/', en: '/en/legal-notice/' };

/** Texte dans la langue de l'interface. */
export const tdon = (cle: CleDonnees, vars?: Record<string, string | number>): string => traduireDonnees(langue(), cle, vars);
