// Textes du formulaire de retours en 3 questions (#537), FR et EN. Hors du catalogue principal (fr.ts, dans le JS
// initial) : ils n'arrivent qu'avec l'aide (chargée à la demande) et le formulaire lui-même.
// Règles du catalogue : phrases courtes, tutoiement.
import { langue, type Langue } from './index';

const FR = {
  // Entrée, dans l'aide (fiche « Questions »)
  'entree.titre': 'Ton avis compte',
  'entree.texte': '3 questions, une minute. Sans compte.',
  'entree.action': 'Donner mon avis',
  'contact.texte': 'Une question, un souci ? Écris-nous à {adresse}.',
  // Formulaire
  'titre': 'Ton avis sur Mochi Go',
  'intro': 'Trois questions. Seule la première est obligatoire.',
  'conseil.question': '1. Tu conseillerais Mochi Go à un ami ?',
  'conseil.oui': 'Oui',
  'conseil.peut_etre': 'Peut-être',
  'conseil.non': 'Non',
  'ameliorer.question': '2. Qu’est-ce qu’on devrait améliorer en premier ?',
  'ameliorer.aide': 'Facultatif. N’écris ni ton nom ni ton e-mail.',
  'ameliorer.compteur': '{n} / 1000',
  'source.question': '3. Comment as-tu connu Mochi Go ?',
  'source.ami': 'Par un ami',
  'source.reseau': 'Réseau social ou forum',
  'source.club': 'Club de go',
  'source.recherche': 'Moteur de recherche',
  'source.autre': 'Autrement',
  'envoyer': 'Envoyer',
  'envoi': 'Envoi…',
  'mention': 'Ton avis n’est lié à aucun compte. Il est gardé 12 mois.',
  'retour': 'Retour',
  // Résultat
  'merci': 'Merci ! On lit chaque avis.',
  'merciDetail': 'Pour une réponse, écris-nous à {adresse}.',
  'fermer': 'Fermer',
  // Erreurs
  'erreur.conseil': 'Choisis une réponse à la question 1.',
  'erreur.limite': 'Beaucoup d’avis arrivent en ce moment. Réessaie dans une minute.',
  'erreur.horsLigne': 'Hors ligne. Reconnecte-toi pour envoyer.',
  'erreur.serveur': 'Le serveur ne répond pas. Réessaie dans un moment.',
  'erreur.indisponible': 'L’envoi n’est pas possible ici. Écris-nous à {adresse}.',
};

export type CleRetours = keyof typeof FR;

const EN: { readonly [K in CleRetours]: string } = {
  'entree.titre': 'Your feedback counts',
  'entree.texte': '3 questions, one minute. No account needed.',
  'entree.action': 'Give feedback',
  'contact.texte': 'A question or a problem? Write to us at {adresse}.',
  'titre': 'Your feedback on Mochi Go',
  'intro': 'Three questions. Only the first one is required.',
  'conseil.question': '1. Would you recommend Mochi Go to a friend?',
  'conseil.oui': 'Yes',
  'conseil.peut_etre': 'Maybe',
  'conseil.non': 'No',
  'ameliorer.question': '2. What should we improve first?',
  'ameliorer.aide': 'Optional. Don’t write your name or email.',
  'ameliorer.compteur': '{n} / 1,000',
  'source.question': '3. How did you hear about Mochi Go?',
  'source.ami': 'From a friend',
  'source.reseau': 'Social media or forum',
  'source.club': 'Go club',
  'source.recherche': 'Search engine',
  'source.autre': 'Some other way',
  'envoyer': 'Send',
  'envoi': 'Sending…',
  'mention': 'Your feedback isn’t linked to any account. It’s kept for 12 months.',
  'retour': 'Back',
  'merci': 'Thank you! We read every reply.',
  'merciDetail': 'For an answer, write to us at {adresse}.',
  'fermer': 'Close',
  'erreur.conseil': 'Pick an answer to question 1.',
  'erreur.limite': 'Lots of feedback is coming in right now. Try again in a minute.',
  'erreur.horsLigne': 'Offline. Reconnect to send.',
  'erreur.serveur': 'The server isn’t answering. Try again in a moment.',
  'erreur.indisponible': 'Sending isn’t possible here. Write to us at {adresse}.',
};

export const CATALOGUE_RETOURS: Record<Langue, { readonly [K in CleRetours]: string }> = { fr: FR, en: EN };

/** Texte dans une langue donnée, variables `{nom}` remplacées. */
export function traduireRetours(l: Langue, cle: CleRetours, vars: Record<string, string | number> = {}): string {
  const brut = CATALOGUE_RETOURS[l][cle] || FR[cle];
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

/** Texte dans la langue de l'interface. */
export const tret = (cle: CleRetours, vars?: Record<string, string | number>): string => traduireRetours(langue(), cle, vars);
