// Textes de l'écran « Profil de {pseudo} » (issue #560), FR et EN. Hors du catalogue principal (fr.ts, dans le JS
// initial) : ils n'arrivent qu'avec l'écran, chargé à la demande (budget du JS initial, scripts/budget-bundle.mjs).
// Règles du catalogue : phrases courtes, tutoiement ; « défier » seulement sous `defi.` ; la cote s'écrit par
// src/content/i18n/cote.ts (grade, « 1620 ? »).
import { langue, type Langue } from './index';

type Pluriel = { one: string; other: string };
type Texte = string | Pluriel;

const FR = {
  'joueur.titre': 'Profil de {pseudo}',
  'joueur.ouvrir': 'Voir le profil de {pseudo}',
  'joueur.classees': { one: '{n} partie classée', other: '{n} parties classées' },
  'joueur.aucuneClassee': 'Pas encore de partie classée',
  'joueur.dernieres': 'Dernières parties classées',
  'joueur.victoire': 'Victoire',
  'joueur.defaite': 'Défaite',
  'joueur.nul': 'Partie nulle',
  'joueur.contreMot': 'contre',
  'joueur.contreToi': 'contre toi',
  'joueur.contreUnJoueur': 'contre un joueur',
  'joueur.couleur.noir': 'avec les noires',
  'joueur.couleur.blanc': 'avec les blanches',
  'joueur.demander': 'Demander en ami',
  'joueur.envoi': 'Envoi…',
  'joueur.envoyee': 'Demande envoyée. Vous serez amis dès son accord.',
  'joueur.annuler': 'Annuler la demande',
  'joueur.recue': '{pseudo} veut devenir ton ami.',
  'joueur.accepter': 'Accepter',
  'joueur.refuser': 'Refuser',
  'joueur.amis': 'Vous êtes amis.',
  'joueur.devenusAmis': '{pseudo} et toi, vous êtes amis.',
  'defi.joueur.defier': 'Défier {pseudo}',
  'defi.joueur.creation': 'Partie…',
  'defi.joueur.regle': 'Partie 9 × 9 : ton ami joue le premier, 3 jours par coup.',
  'joueur.moi': 'C’est toi ! Ta cote et tes parties sont dans Ta cote.',
  'joueur.signaler': 'Signaler ou bloquer {pseudo}',
  'joueur.chargement': 'Je cherche ce joueur…',
  'joueur.indisponible': 'Ce joueur n’est pas disponible.',
  'joueur.indisponibleAide': 'Vérifie le pseudo, ou reviens plus tard.',
  'joueur.erreur': 'Le profil n’a pas pu être lu.',
  'joueur.reessayer': 'Réessayer',
  'joueur.horsLigne': 'Hors ligne. Reconnecte-toi pour voir ce joueur.',
  'joueur.erreur.tropVite': 'Tu as consulté beaucoup de profils. Réessaie dans {n} min.',
  'joueur.erreur.compte': 'Crée ton compte et ton pseudo pour voir les autres joueurs.',
} as const;

export type CleJoueur = keyof typeof FR;

const EN: { readonly [K in CleJoueur]: Texte } = {
  'joueur.titre': '{pseudo}’s profile',
  'joueur.ouvrir': 'See {pseudo}’s profile',
  'joueur.classees': { one: '{n} rated game', other: '{n} rated games' },
  'joueur.aucuneClassee': 'No rated game yet',
  'joueur.dernieres': 'Latest rated games',
  'joueur.victoire': 'Win',
  'joueur.defaite': 'Loss',
  'joueur.nul': 'Draw',
  'joueur.contreMot': 'against',
  'joueur.contreToi': 'against you',
  'joueur.contreUnJoueur': 'against a player',
  'joueur.couleur.noir': 'with black',
  'joueur.couleur.blanc': 'with white',
  'joueur.demander': 'Send friend request',
  'joueur.envoi': 'Sending…',
  'joueur.envoyee': 'Request sent. You’ll be friends once they accept.',
  'joueur.annuler': 'Cancel request',
  'joueur.recue': '{pseudo} wants to be your friend.',
  'joueur.accepter': 'Accept',
  'joueur.refuser': 'Decline',
  'joueur.amis': 'You are friends.',
  'joueur.devenusAmis': '{pseudo} and you are now friends.',
  'defi.joueur.defier': 'Challenge {pseudo}',
  'defi.joueur.creation': 'Game…',
  'defi.joueur.regle': '9 × 9 game: your friend plays first, 3 days per move.',
  'joueur.moi': 'That’s you! Your rating and games are under Your rating.',
  'joueur.signaler': 'Report or block {pseudo}',
  'joueur.chargement': 'Looking for this player…',
  'joueur.indisponible': 'This player isn’t available.',
  'joueur.indisponibleAide': 'Check the nickname, or come back later.',
  'joueur.erreur': 'The profile couldn’t be loaded.',
  'joueur.reessayer': 'Try again',
  'joueur.horsLigne': 'Offline. Reconnect to see this player.',
  'joueur.erreur.tropVite': 'You’ve looked at many profiles. Try again in {n} min.',
  'joueur.erreur.compte': 'Create your account and nickname to see other players.',
};

export const CATALOGUE_JOUEUR: Record<Langue, { readonly [K in CleJoueur]: Texte }> = { fr: FR, en: EN };

const regles = new Map<Langue, Intl.PluralRules>();
function forme(texte: Texte, l: Langue, n: unknown): string {
  if (typeof texte === 'string') return texte;
  if (typeof n !== 'number') return texte.other;
  let r = regles.get(l);
  if (!r) regles.set(l, (r = new Intl.PluralRules(l)));
  return (texte as Record<string, string>)[r.select(n)] ?? texte.other;
}

/** Texte dans une langue donnée, variables `{nom}` remplacées, pluriel par `n`. */
export function traduireJoueur(l: Langue, cle: CleJoueur, vars: Record<string, string | number> = {}): string {
  const brut = forme(CATALOGUE_JOUEUR[l][cle] || FR[cle], l, vars.n);
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

/** Texte dans la langue de l'interface. */
export const tp = (cle: CleJoueur, vars?: Record<string, string | number>): string => traduireJoueur(langue(), cle, vars);
