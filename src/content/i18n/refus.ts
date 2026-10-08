// Refus de la fonction serveur `game-action` (#473), FR et EN. Le serveur répond un code (`error`) et un message
// français (`message`) : src/go/server.ts, src/go/defi-action.ts, supabase/functions/game-action/index.ts.
// En français, l'app garde le message du serveur tel quel ; dans une autre langue, elle affiche le texte du code.
// Ainsi, aucune fonction Edge à redéployer pour traduire. Un code inconnu : un message générique, jamais du français.
// FR recopie les messages du serveur (vérifié par src/content/i18n/refus.test.ts) : il sert de repli et de référence.
import { langue, type Langue } from './index';

const FR = {
  format: 'Coup invalide.',
  'hors-plateau': 'Ce coup est hors du plateau.',
  occupe: 'Cette intersection est déjà occupée.',
  suicide: 'Coup interdit : ta pierre n’aurait plus aucune liberté (suicide).',
  ko: 'Coup interdit par la règle du ko : joue ailleurs avant de reprendre.',
  superko: 'Coup interdit : cette position s’est déjà produite (superko).',
  tour: 'Ce n’est pas ton tour.',
  installation: 'Pierres de handicap invalides.',
  'partie-invalide': 'L’historique de la partie est invalide.',
  bot: 'Réservé aux parties entre humains.',
  terminee: 'La partie n’est pas en cours.',
  spectateur: 'Tu ne joues pas dans cette partie.',
  comptage: 'Comptage en cours : reprends la partie pour jouer.',
  'pas-de-comptage': 'Le comptage commence après deux passes de suite.',
  'pierres-mortes': 'Pierres mortes invalides : choisis des pierres présentes sur le plateau.',
  'pas-de-proposition': 'Aucune proposition de pierres mortes à accepter.',
  'proposition-propre': 'C’est à l’autre joueur d’accepter ta proposition.',
  conflit: 'La partie a changé entre-temps. Recharge-la.',
  introuvable: 'Partie introuvable.',
  lecture: 'Impossible de lire la partie.',
  ecriture: 'Impossible d’enregistrer.',
  temps: 'Temps écoulé : la partie est finie.',
  connexion: 'Connexion requise.',
  methode: 'Méthode non autorisée.',
  configuration: 'Serveur mal configuré.',
  autre: 'Le serveur a refusé cette action. Réessaie.',
};

export type CodeServeur = keyof typeof FR;

const EN: { readonly [K in CodeServeur]: string } = {
  format: 'Invalid move.',
  'hors-plateau': 'This move is off the board.',
  occupe: 'There’s already a stone on this point.',
  suicide: 'Illegal move: your stone would have no liberties left (suicide).',
  ko: 'Illegal move under the ko rule: play elsewhere before taking back.',
  superko: 'Illegal move: this position has already happened (superko).',
  tour: 'It’s not your turn.',
  installation: 'Invalid handicap stones.',
  'partie-invalide': 'The game record is invalid.',
  bot: 'Only for games between players.',
  terminee: 'This game isn’t in progress.',
  spectateur: 'You’re not playing in this game.',
  comptage: 'Counting in progress: resume the game to play.',
  'pas-de-comptage': 'Counting starts after two passes in a row.',
  'pierres-mortes': 'Invalid dead stones: pick stones that are on the board.',
  'pas-de-proposition': 'There are no dead stones to accept.',
  'proposition-propre': 'The other player must accept your proposal.',
  conflit: 'The game changed in the meantime. Reload it.',
  introuvable: 'Game not found.',
  lecture: 'Can’t read the game.',
  ecriture: 'Couldn’t save. Try again.',
  temps: 'Time’s up: the game is over.',
  connexion: 'Please sign in again.',
  methode: 'Request not allowed.',
  configuration: 'The server isn’t set up correctly.',
  autre: 'The server refused this action. Try again.',
};

export const CATALOGUE_REFUS: Record<Langue, { readonly [K in CodeServeur]: string }> = { fr: FR, en: EN };

const connu = (code: unknown): code is CodeServeur => typeof code === 'string' && code !== 'autre' && Object.hasOwn(FR, code);

/**
 * Message d'un refus du serveur dans une langue. Français : le message du serveur s'il y en a un, sinon le texte du
 * code. Autre langue : le texte du code, ou le message générique (jamais le français du serveur).
 */
export function messageServeur(code: unknown, message: unknown, l: Langue = langue()): string {
  if (l === 'fr' && typeof message === 'string' && message) return message;
  return CATALOGUE_REFUS[l][connu(code) ? code : 'autre'];
}
