// Textes de la cote de jeu (issue #417), FR et EN. Hors du catalogue principal (fr.ts, dans le JS initial) : ils
// n'arrivent qu'avec le Profil et l'écran de partie, chargés à la demande (budget du JS initial).
// Règles du catalogue : phrases courtes, tutoiement, kyu et dan expliqués la première fois.
// Les problèmes et les leçons n'affichent jamais ces textes (décision #137 : src/app/sansCote.test.ts).
import { langue, type Langue } from './index';
import { gradeDe, texteGrade } from '../../go/cote';

const FR = {
  'cote.ligne': 'Ta cote',
  'cote.ligneDepart': 'Choisis ton départ',
  'cote.lignePlacement': 'Placement',
  'cote.titre': 'Ta cote',
  'cote.aria': 'Ta cote : {cote}, {grade}.',
  'cote.ariaProvisoire': 'Ta cote provisoire : {cote}, {grade}.',
  'cote.provisoire': 'Le « ? » : ta cote est provisoire. Elle se précise en une dizaine de parties classées.',
  'cote.vocabulaire': 'Le kyu, c’est ton grade. Tu pars du 30ᵉ kyu et tu montes vers le 1ᵉʳ. Ensuite viennent les dan, du 1ᵉʳ au 9ᵉ.',
  'cote.regle': 'Seules tes parties classées contre d’autres joueurs comptent. Les parties contre les IA, non.',
  'cote.courbe.titre': 'Tes 30 derniers jours',
  'cote.courbe.aria': 'Ta cote sur 30 jours : de {debut} à {fin}.',
  'cote.courbe.vide': 'Ta courbe apparaît après ta première partie classée.',
  'cote.depart.titre': 'D’où pars-tu ?',
  'cote.depart.texte': 'Choisis une fois. Tu peux changer jusqu’à ta première partie classée.',
  'cote.depart.decouvre': 'Je découvre',
  'cote.depart.regles': 'Je connais les règles',
  'cote.depart.club': 'Je joue en club',
  'cote.depart.detail': 'Départ au {grade}',
  'cote.depart.grade': 'Ton grade en club',
  'cote.depart.valider': 'Partir du {grade}',
  'cote.depart.envoi': 'Envoi…',
  'cote.depart.choisi': 'C’est noté : tu pars du {grade}.',
  'cote.depart.fige': 'Ton départ est fixé depuis ta première partie classée.',
  'cote.erreur.dejaLancee': 'Ta cote est déjà lancée : le départ ne change plus.',
  'cote.erreur.invalide': 'Ce choix n’existe pas. Choisis-en un autre.',
  'cote.erreur.partieEnCours': 'Termine d’abord ta partie classée.',
  'cote.erreur.compte': 'Crée ton compte et choisis ton pseudo d’abord.',
  'cote.erreur.serveur': 'Le serveur ne répond pas. Réessaie.',
  'cote.chargement': 'Chargement de ta cote…',
  'cote.erreurChargement': 'Ta cote n’a pas pu être lue.',
  'cote.reessayer': 'Réessayer',
  'cote.gain.aria': 'Ta cote : {ecart} points. Elle passe à {cote}.',
  'cote.gain.attente': 'Ta cote se met à jour…',
  'cote.gain.nouvelle': 'Ta cote : {cote}',
  'cote.monte': 'Tu passes {grade} !',
  'cote.descend': 'Tu repasses {grade}. Ça remonte vite.',
  'cote.adversaire': '{grade} · {cote}',
} as const;

export type CleCote = keyof typeof FR;

const EN: { readonly [K in CleCote]: string } = {
  'cote.ligne': 'Your rating',
  'cote.ligneDepart': 'Pick your start',
  'cote.lignePlacement': 'Placement',
  'cote.titre': 'Your rating',
  'cote.aria': 'Your rating: {cote}, {grade}.',
  'cote.ariaProvisoire': 'Your provisional rating: {cote}, {grade}.',
  'cote.provisoire': 'The “?”: your rating is provisional. It settles after about ten rated games.',
  'cote.vocabulaire': 'Kyu is your rank. You start at 30 kyu and climb towards 1 kyu. Then come the dan ranks, from 1 to 9.',
  'cote.regle': 'Only your rated games against other players count. Games against the AIs don’t.',
  'cote.courbe.titre': 'Your last 30 days',
  'cote.courbe.aria': 'Your rating over 30 days: from {debut} to {fin}.',
  'cote.courbe.vide': 'Your curve shows up after your first rated game.',
  'cote.depart.titre': 'Where do you start?',
  'cote.depart.texte': 'Pick once. You can change it until your first rated game.',
  'cote.depart.decouvre': 'I’m new to go',
  'cote.depart.regles': 'I know the rules',
  'cote.depart.club': 'I play in a club',
  'cote.depart.detail': 'Start at {grade}',
  'cote.depart.grade': 'Your club rank',
  'cote.depart.valider': 'Start at {grade}',
  'cote.depart.envoi': 'Sending…',
  'cote.depart.choisi': 'Done: you start at {grade}.',
  'cote.depart.fige': 'Your start is set since your first rated game.',
  'cote.erreur.dejaLancee': 'Your rating has started: the start can’t change now.',
  'cote.erreur.invalide': 'This choice doesn’t exist. Pick another one.',
  'cote.erreur.partieEnCours': 'Finish your rated game first.',
  'cote.erreur.compte': 'Create your account and pick your username first.',
  'cote.erreur.serveur': 'The server isn’t answering. Try again.',
  'cote.chargement': 'Loading your rating…',
  'cote.erreurChargement': 'Your rating couldn’t be loaded.',
  'cote.reessayer': 'Try again',
  'cote.gain.aria': 'Your rating: {ecart} points. It is now {cote}.',
  'cote.gain.attente': 'Updating your rating…',
  'cote.gain.nouvelle': 'Your rating: {cote}',
  'cote.monte': 'You reach {grade}!',
  'cote.descend': 'You’re back to {grade}. You’ll climb back fast.',
  'cote.adversaire': '{grade} · {cote}',
};

export const CATALOGUE_COTE: Record<Langue, { readonly [K in CleCote]: string }> = { fr: FR, en: EN };

/** Texte de la cote dans une langue donnée, variables `{nom}` remplacées. */
export function traduireCote(l: Langue, cle: CleCote, vars: Record<string, string | number> = {}): string {
  const brut = CATALOGUE_COTE[l][cle] || FR[cle];
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

/** Texte de la cote dans la langue de l'interface. */
export const tc = (cle: CleCote, vars?: Record<string, string | number>): string => traduireCote(langue(), cle, vars);

/** Grade d'une cote, écrit dans la langue de l'interface : « 15ᵉ kyu », « 15 kyu ». */
export const grade = (cote: number, l: Langue = langue()): string => texteGrade(gradeDe(cote), l);

/** Cote affichée : « 1200 », ou « 1200 ? » tant qu'elle est provisoire. */
export const texteCote = (cote: number, provisoire: boolean, l: Langue = langue()): string =>
  provisoire ? `${Math.round(cote)}${l === 'fr' ? '\u00a0' : ''}?` : String(Math.round(cote));

/** Écart signé : « +14 », « −8 » (vrai signe moins), « 0 ». */
export const texteEcart = (ecart: number): string => (ecart > 0 ? `+${ecart}` : ecart < 0 ? `−${-ecart}` : '0');

/** Cote et grade de l'adversaire, sous son nom : « 14ᵉ kyu · 1620 ». */
export const texteAdversaire = (cote: number, provisoire: boolean): string =>
  tc('cote.adversaire', { grade: grade(cote), cote: texteCote(cote, provisoire) });
