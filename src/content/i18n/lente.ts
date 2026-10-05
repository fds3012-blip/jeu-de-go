// Textes des parties lentes (issue #440), FR et EN. Hors du catalogue principal (fr.ts, dans le JS initial) : ils
// n'arrivent qu'avec l'écran des parties lentes et celui de la partie (chargés à la demande). Les quelques textes de
// l'accueil (« À toi de jouer (N) », recherche en cours) sont dans fr.ts / en.ts.
// Règles du catalogue : phrases courtes, tutoiement, « partie lente » expliquée là où on la choisit.
import { langue, type Langue } from './index';

const FR = {
  'lente.titre': 'Partie lente',
  'lente.bascule': 'Façon de jouer',
  'lente.bascule.direct': 'En direct',
  'lente.bascule.lente': 'Partie lente',
  'lente.intro': 'Joue quand tu veux, sans être connecté en même temps que l’autre. Tu peux mener plusieurs parties à la fois.',
  'lente.classee': 'Partie classée : ta cote bouge à la fin.',
  'lente.taille': 'Taille du plateau',
  'lente.delai': 'Temps par coup',
  'lente.delai.jours': '{n} j',
  'lente.delai.aide': 'Tu as {delai} pour jouer chaque coup. Passé ce délai, tu perds au temps.',
  'lente.chercher': 'Trouver un adversaire',
  'lente.recherche.titre': 'Je te cherche un adversaire de ton niveau.',
  'lente.recherche.texte': 'Ça peut prendre du temps. Tu verras la partie sur l’accueil dès qu’elle commence.',
  'lente.recherche.rappel': '{taille} × {taille} · {delai} par coup',
  'lente.recherche.annuler': 'Annuler la recherche',
  'lente.trouve.titre': 'Adversaire trouvé !',
  'lente.trouve.ouvrir': 'Ouvrir la partie',
  'lente.limite': 'Tu as déjà 10 parties lentes en cours. Finis-en une pour en commencer une autre.',
  'lente.horsLigne': 'Tu es hors ligne. Reconnecte-toi pour chercher un adversaire.',
  'lente.erreur.compte': 'Crée ton compte et choisis ton pseudo d’abord.',
  'lente.erreur.miseAJour': 'Le serveur se met à jour. Réessaie dans un moment.',
  'lente.erreur.serveur': 'Le serveur ne répond pas. Réessaie.',
  'lente.tesParties': 'Tes parties lentes',
  'lente.vide': 'Aucune partie lente pour l’instant.',
  'lente.chargement': 'Chargement…',
  'lente.ligne.aToi': 'À toi · {delai}',
  'lente.ligne.aLui': 'Au tour de {nom} · {delai}',
  'lente.ligne.comptage': 'Comptage en cours',
  'lente.ligne.finie': 'Terminée',
  'lente.ligne.aria': 'Partie contre {nom}, {etat}',
  'lente.retour': 'Retour',
  'lente.adversaire': 'Ton adversaire',
  // Écran de la partie (src/app/Defis.tsx, partie classée).
  'lente.partie.rappel': 'Chacun a {delai} pour jouer son coup. Sinon, il perd au temps.',
  'lente.partie.bienvenue': 'Partie classée contre {nom}. À toi de commencer !',
  'lente.fin.annulee': 'Partie annulée : personne n’a vraiment joué. Ta cote ne bouge pas.',
  'lente.fin.gagne.temps': 'Tu as gagné au temps : {nom} n’a pas joué à temps.',
  'lente.fin.perdu.temps': 'Perdu au temps : ton délai est passé sans ton coup.',
  'lente.autre': 'Nouvelle partie lente',
  'lente.retourParties': 'Mes parties lentes',
} as const;

export type CleLente = keyof typeof FR;

const EN: { readonly [K in CleLente]: string } = {
  'lente.titre': 'Correspondence game',
  'lente.bascule': 'How to play',
  'lente.bascule.direct': 'Live',
  'lente.bascule.lente': 'Correspondence',
  'lente.intro': 'Play whenever you like, without being online at the same time. You can run several games at once.',
  'lente.classee': 'Rated game: your rating moves at the end.',
  'lente.taille': 'Board size',
  'lente.delai': 'Time per move',
  'lente.delai.jours': '{n} d',
  'lente.delai.aide': 'You have {delai} to play each move. After that, you lose on time.',
  'lente.chercher': 'Find an opponent',
  'lente.recherche.titre': 'I’m looking for an opponent at your level.',
  'lente.recherche.texte': 'It can take a while. The game shows up on the home screen as soon as it starts.',
  'lente.recherche.rappel': '{taille} × {taille} · {delai} per move',
  'lente.recherche.annuler': 'Cancel the search',
  'lente.trouve.titre': 'Opponent found!',
  'lente.trouve.ouvrir': 'Open the game',
  'lente.limite': 'You already have 10 correspondence games. Finish one to start another.',
  'lente.horsLigne': 'You’re offline. Reconnect to find an opponent.',
  'lente.erreur.compte': 'Create your account and pick a username first.',
  'lente.erreur.miseAJour': 'The server is updating. Try again in a moment.',
  'lente.erreur.serveur': 'The server isn’t answering. Try again.',
  'lente.tesParties': 'Your correspondence games',
  'lente.vide': 'No correspondence game yet.',
  'lente.chargement': 'Loading…',
  'lente.ligne.aToi': 'Your move · {delai}',
  'lente.ligne.aLui': '{nom}’s move · {delai}',
  'lente.ligne.comptage': 'Counting',
  'lente.ligne.finie': 'Over',
  'lente.ligne.aria': 'Game against {nom}, {etat}',
  'lente.retour': 'Back',
  'lente.adversaire': 'Your opponent',
  'lente.partie.rappel': 'Each player has {delai} to play a move, or loses on time.',
  'lente.partie.bienvenue': 'Rated game against {nom}. You start!',
  'lente.fin.annulee': 'Game cancelled: nobody really played. Your rating doesn’t move.',
  'lente.fin.gagne.temps': 'You won on time: {nom} didn’t play in time.',
  'lente.fin.perdu.temps': 'Lost on time: your time ran out without a move.',
  'lente.autre': 'New correspondence game',
  'lente.retourParties': 'My correspondence games',
};

export const CATALOGUE_LENTE: Record<Langue, { readonly [K in CleLente]: string }> = { fr: FR, en: EN };

/** Texte des parties lentes dans une langue donnée, variables `{nom}` remplacées. */
export function traduireLente(l: Langue, cle: CleLente, vars: Record<string, string | number> = {}): string {
  const brut = CATALOGUE_LENTE[l][cle] || FR[cle];
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

/** Texte des parties lentes dans la langue de l'interface. */
export const tl = (cle: CleLente, vars?: Record<string, string | number>): string => traduireLente(langue(), cle, vars);
