// Textes de « Inviter un ami » (#729), FR et EN. Hors du catalogue principal (JS initial) : ils arrivent avec l'écran,
// chargé à la demande depuis « Mes amis ». Mêmes règles : phrases courtes, tutoiement.
import { langue, type Langue } from './index';

const FR = {
  'inv.entree': 'Inviter un ami',
  'inv.entreeAide': 'Un cadeau pour vous deux.',
  'inv.titre': 'Invite un ami',
  'inv.texte': 'Quand ton ami a joué sa première partie, vous recevez tous les deux le goban Cerisier. C’est un cadeau : rien à payer.',
  'inv.bouton': 'Partager mon lien',
  'inv.copie': 'Lien copié',
  'inv.copieAnnonce': 'Lien copié. Colle-le dans un message.',
  'inv.copierManuel': 'Copie ce lien et colle-le dans un message :',
  'inv.lienAria': 'Ton lien d’invitation',
  'inv.progres0': 'Aucun ami n’est encore arrivé.',
  'inv.progres1': '1 ami sur {max} est arrivé.',
  'inv.progresN': '{n} amis sur {max} sont arrivés.',
  'inv.jade': 'Au 3e ami, tu reçois aussi les pierres Jade.',
  'inv.complet': 'Merci ! Ton lien a déjà servi {max} fois.',
  'inv.cadeaux': 'Tes cadeaux',
  'inv.cadeauAide': 'À choisir dans Profil › Réglages.',
  'inv.chargement': 'Chargement…',
  'inv.erreur': 'Ton lien n’a pas pu être chargé. Vérifie ta connexion.',
  'inv.reessayer': 'Réessayer',
  'inv.horsLigne': 'Hors ligne. Reconnecte-toi pour partager ton lien.',
  'inv.titreLien': 'Viens jouer au go avec moi',
  'inv.texteLien': 'Viens jouer au go avec moi sur Mochi Go. Quand tu as joué ta première partie, on reçoit tous les deux un cadeau :',
};

const EN: { readonly [K in keyof typeof FR]: string } = {
  'inv.entree': 'Invite a friend',
  'inv.entreeAide': 'A gift for you both.',
  'inv.titre': 'Invite a friend',
  'inv.texte': 'When your friend has played their first game, you both get the Cherry wood board. It’s a gift: nothing to pay.',
  'inv.bouton': 'Share my link',
  'inv.copie': 'Link copied',
  'inv.copieAnnonce': 'Link copied. Paste it in a message.',
  'inv.copierManuel': 'Copy this link and paste it in a message:',
  'inv.lienAria': 'Your invitation link',
  'inv.progres0': 'No friend has arrived yet.',
  'inv.progres1': '1 friend out of {max} has arrived.',
  'inv.progresN': '{n} friends out of {max} have arrived.',
  'inv.jade': 'With your 3rd friend, you also get the Jade stones.',
  'inv.complet': 'Thank you! Your link has already been used {max} times.',
  'inv.cadeaux': 'Your gifts',
  'inv.cadeauAide': 'Pick them in Profile › Settings.',
  'inv.chargement': 'Loading…',
  'inv.erreur': 'Your link could not be loaded. Check your connection.',
  'inv.reessayer': 'Try again',
  'inv.horsLigne': 'Offline. Reconnect to share your link.',
  'inv.titreLien': 'Come and play Go with me',
  'inv.texteLien': 'Come and play Go with me on Mochi Go. When you’ve played your first game, we both get a gift:',
};

export type CleInvitation = keyof typeof FR;
export const CATALOGUE_INVITATION: Record<Langue, { readonly [K in CleInvitation]: string }> = { fr: FR, en: EN };

/** Texte d'« Inviter un ami » dans une langue donnée, variables `{nom}` remplacées. */
export function traduireInvitation(l: Langue, cle: CleInvitation, vars: Record<string, string | number> = {}): string {
  const brut = CATALOGUE_INVITATION[l][cle] || FR[cle];
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

export const ti = (cle: CleInvitation, vars?: Record<string, string | number>): string => traduireInvitation(langue(), cle, vars);
