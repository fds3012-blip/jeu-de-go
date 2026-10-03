// Textes de l'écran « Mes amis » (issue #359), FR et EN. Hors du catalogue principal (fr.ts, dans le JS initial) :
// ils n'arrivent qu'avec l'écran, chargé à la demande (budget du JS initial, scripts/budget-bundle.mjs).
// Les textes de la ligne du Profil et de la pastille restent dans fr.ts / en.ts (`amis.titre`, `amis.profil.*`).
// Mêmes règles que le catalogue : phrases courtes, tutoiement ; « défier » seulement sous `defi.`.
import { langue, type Langue } from './index';

const FR = {
  'amis.vide.titre': 'Joue avec tes amis',
  'defi.amis.videTexte': 'Ajoute un ami avec son pseudo. Ensuite, défie-le d’un seul toucher : plus besoin d’envoyer un lien.',
  'amis.ajouter.titre': 'Ajouter un ami',
  'amis.ajouter.label': 'Pseudo de ton ami',
  'amis.ajouter.placeholder': 'Son pseudo exact',
  'amis.ajouter.bouton': 'Ajouter',
  'amis.ajouter.envoi': 'Envoi…',
  'amis.ajouter.aide': 'Écris son pseudo en entier. Il recevra ta demande dans son profil.',
  'amis.envoyee': 'Demande envoyée à {pseudo}. Vous serez amis dès son accord.',
  'amis.devenusAmis': '{pseudo} et toi, vous êtes amis.',
  'amis.recues.titre': 'Demandes reçues',
  'amis.liste.titre': 'Tes amis',
  'amis.envoyees.titre': 'En attente de réponse',
  'amis.accepter': 'Accepter',
  'amis.accepterAria': 'Accepter la demande de {pseudo}',
  'amis.refuser': 'Refuser',
  'amis.refuserAria': 'Refuser la demande de {pseudo}',
  'amis.annuler': 'Annuler',
  'amis.annulerAria': 'Annuler ta demande à {pseudo}',
  'amis.retirer': 'Retirer',
  'amis.retirerAria': 'Retirer {pseudo} de tes amis',
  'amis.retirerConfirmer': 'Retirer ?',
  'amis.retirerConfirmerAria': 'Confirmer : retirer {pseudo} de tes amis',
  'amis.attente': 'Demande envoyée',
  'defi.amis.defier': 'Défier',
  'defi.amis.defierAria': 'Défier {pseudo} : partie 9 × 9, 3 jours par coup',
  'defi.amis.creation': 'Partie…',
  'defi.amis.regle': 'Défier lance une partie 9 × 9 : ton ami joue le premier, 3 jours par coup.',
  'amis.chargement': 'Chargement de tes amis…',
  'amis.erreur.chargement': 'Impossible de charger tes amis.',
  'amis.horsLigne': 'Hors ligne. Reconnecte-toi pour voir tes amis.',
  'amis.erreur.introuvable': 'Aucun joueur avec ce pseudo. Vérifie l’orthographe.',
  'amis.erreur.toiMeme': 'C’est ton pseudo ! Écris celui de ton ami.',
  'amis.erreur.dejaAmis': 'Vous êtes déjà amis.',
  'amis.erreur.dejaEnvoyee': 'Demande déjà envoyée. Attends sa réponse.',
  'amis.erreur.limiteJour': 'Tu as envoyé 20 demandes aujourd’hui. Reviens demain.',
  'amis.erreur.recente': 'Tu as déjà invité ce joueur cette semaine. Réessaie plus tard.',
  'amis.erreur.aucuneDemande': 'Cette demande n’existe plus.',
  'amis.erreur.pasAmi': 'Ce joueur n’est plus dans tes amis.',
  'amis.erreur.tropDeParties': 'Vous avez déjà 3 parties en cours. Finis-en une d’abord.',
  'amis.erreur.compte': 'Crée ton compte et ton pseudo pour ajouter des amis.',
} as const;

const EN: { readonly [K in CleAmis]: string } = {
  'amis.vide.titre': 'Play with your friends',
  'defi.amis.videTexte': 'Add a friend with their nickname. Then challenge them in one tap: no link to send.',
  'amis.ajouter.titre': 'Add a friend',
  'amis.ajouter.label': 'Your friend’s nickname',
  'amis.ajouter.placeholder': 'Their exact nickname',
  'amis.ajouter.bouton': 'Add',
  'amis.ajouter.envoi': 'Sending…',
  'amis.ajouter.aide': 'Type the full nickname. They’ll get your request in their profile.',
  'amis.envoyee': 'Request sent to {pseudo}. You’ll be friends once they accept.',
  'amis.devenusAmis': 'You and {pseudo} are now friends.',
  'amis.recues.titre': 'Friend requests',
  'amis.liste.titre': 'Your friends',
  'amis.envoyees.titre': 'Waiting for an answer',
  'amis.accepter': 'Accept',
  'amis.accepterAria': 'Accept {pseudo}’s request',
  'amis.refuser': 'Decline',
  'amis.refuserAria': 'Decline {pseudo}’s request',
  'amis.annuler': 'Cancel',
  'amis.annulerAria': 'Cancel your request to {pseudo}',
  'amis.retirer': 'Remove',
  'amis.retirerAria': 'Remove {pseudo} from your friends',
  'amis.retirerConfirmer': 'Remove?',
  'amis.retirerConfirmerAria': 'Confirm: remove {pseudo} from your friends',
  'amis.attente': 'Request sent',
  'defi.amis.defier': 'Challenge',
  'defi.amis.defierAria': 'Challenge {pseudo}: 9 × 9 game, 3 days per move',
  'defi.amis.creation': 'Game…',
  'defi.amis.regle': 'Challenge starts a 9 × 9 game: your friend plays first, 3 days per move.',
  'amis.chargement': 'Loading your friends…',
  'amis.erreur.chargement': 'Can’t load your friends.',
  'amis.horsLigne': 'You’re offline. Reconnect to see your friends.',
  'amis.erreur.introuvable': 'No player with this nickname. Check the spelling.',
  'amis.erreur.toiMeme': 'That’s your nickname! Type your friend’s.',
  'amis.erreur.dejaAmis': 'You’re already friends.',
  'amis.erreur.dejaEnvoyee': 'Request already sent. Wait for their answer.',
  'amis.erreur.limiteJour': 'You sent 20 requests today. Come back tomorrow.',
  'amis.erreur.recente': 'You already invited this player this week. Try again later.',
  'amis.erreur.aucuneDemande': 'This request no longer exists.',
  'amis.erreur.pasAmi': 'This player is no longer your friend.',
  'amis.erreur.tropDeParties': 'You already have 3 games going. Finish one first.',
  'amis.erreur.compte': 'Create your account and nickname to add friends.',
};

export type CleAmis = keyof typeof FR;
export const CATALOGUE_AMIS: Record<Langue, { readonly [K in CleAmis]: string }> = { fr: FR, en: EN };

/** Texte de l'écran « Mes amis » dans une langue donnée, variables `{nom}` remplacées. */
export function traduireAmis(l: Langue, cle: CleAmis, vars: Record<string, string | number> = {}): string {
  const brut = CATALOGUE_AMIS[l][cle] || FR[cle];
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

/** Texte de l'écran « Mes amis » dans la langue de l'interface. */
export const ta = (cle: CleAmis, vars?: Record<string, string | number>): string => traduireAmis(langue(), cle, vars);
