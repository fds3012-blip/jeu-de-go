// Textes de l'émulation entre amis (issue #369), FR et EN : « Tes amis aujourd'hui » (Go du jour), « Ta semaine »
// (objectifs et bilan, Profil et accueil du lundi) et records de cote. Hors du catalogue principal (fr.ts, dans le JS
// initial) : ils n'arrivent qu'avec ces écrans, chargés à la demande (budget du JS initial).
// Règles du catalogue : phrases courtes, tutoiement ; jamais « Continuer » (réservé aux leçons) ni « défi » ; pas de
// rang numérique entre amis (#137) ; la cote ne s'affiche jamais dans les problèmes (src/app/sansCote.test.ts).
import { langue, type Langue } from './index';

type Pluriel = { one: string; other: string };
type Texte = string | Pluriel;

const FR = {
  // Go du jour entre amis (feuille de réussite)
  'jour.titre': 'Tes amis aujourd’hui',
  'jour.resume': '{reussis} sur {n}',
  'jour.resumeAria': { one: '{reussis} ami sur {n} a fait le Go du jour', other: '{reussis} amis sur {n} ont fait le Go du jour' },
  'jour.toi': 'Toi',
  'jour.reussi': { one: 'Réussi en 1 essai', other: 'Réussi en {n} essais' },
  'jour.vu': 'Fait',
  'jour.pasEncore': 'Pas encore',
  'jour.rappeler': 'Rappelle-lui',
  'jour.rappelerAria': 'Rappeler le Go du jour à {pseudo}',
  'jour.rappele': 'Rappel envoyé',
  'jour.envoi': 'Envoi…',
  'jour.chargement': 'Je regarde où en sont tes amis…',
  'jour.erreur': 'Tes amis n’ont pas pu être lus.',
  'jour.reessayer': 'Réessayer',
  'jour.horsLigne': 'Hors ligne : tes amis apparaîtront avec le réseau.',
  'jour.erreur.limiteRappels': 'Tu as envoyé 20 rappels aujourd’hui. Reviens demain.',
  'jour.erreur.dejaFait': '{pseudo} vient de le faire !',
  'jour.erreur.autre': 'Le rappel n’est pas parti. Réessaie.',
  // Ta semaine (Profil)
  'semaine.titre': 'Ta semaine',
  'semaine.ligne': 'Ta semaine',
  'semaine.ligneValeur': '{n} / 3 objectifs',
  'semaine.objectifs': 'Tes objectifs',
  'semaine.objectifsAide': 'Chaque objectif atteint rapporte +{xp} XP. Nouveaux objectifs chaque lundi.',
  'semaine.obj.parties': { one: 'Termine {n} partie', other: 'Termine {n} parties' },
  'semaine.obj.problemes': { one: 'Réussis {n} problème', other: 'Réussis {n} problèmes' },
  'semaine.obj.erreurs': { one: 'Rejoue {n} erreur', other: 'Rejoue {n} erreurs' },
  'semaine.obj.aide.erreurs': 'Une erreur rejouée : un coup de ta partie que tu retentes après la revue.',
  'semaine.obj.progression': '{fait} / {cible}',
  'semaine.obj.aria': '{objectif} : {fait} sur {cible}.',
  'semaine.obj.atteint': 'Atteint',
  'semaine.obj.atteintAria': '{objectif} : atteint, +{xp} XP.',
  'semaine.action.parties': 'Jouer une partie',
  'semaine.action.problemes': 'Faire un problème',
  'semaine.action.erreurs': 'Revoir mes parties',
  'semaine.toutFait': 'Tous tes objectifs sont atteints. Bravo, à lundi !',
  'semaine.depuisLundi': 'Depuis lundi',
  'semaine.stat.parties': { one: 'partie', other: 'parties' },
  'semaine.stat.problemes': { one: 'problème', other: 'problèmes' },
  'semaine.stat.goDuJour': { one: 'Go du jour', other: 'Go du jour' },
  'semaine.stat.lecons': { one: 'leçon', other: 'leçons' },
  'semaine.amis.battu': { one: 'Tu as battu {pseudo} 1 fois.', other: 'Tu as battu {pseudo} {n} fois.' },
  'semaine.amis.joue': { one: 'Tu as joué 1 partie contre {pseudo}.', other: 'Tu as joué {n} parties contre {pseudo}.' },
  'semaine.cote': 'Ta cote : {ecart} cette semaine.',
  'semaine.serveur.chargement': 'Je cherche tes parties en ligne…',
  'semaine.serveur.erreur': 'Tes parties en ligne n’ont pas pu être lues.',
  'semaine.serveur.horsLigne': 'Hors ligne : tes parties en ligne reviendront avec le réseau.',
  'semaine.serveur.sansCompte': 'Avec un compte, tu verras aussi tes parties contre tes amis.',
  // Bilan de la semaine passée (accueil, une fois)
  'bilan.titre': 'Ta semaine passée',
  'bilan.mochi': 'Belle semaine ! Voilà ce que tu as fait.',
  'bilan.fermer': 'Fermer',
  'bilan.fermerAria': 'Fermer le bilan de la semaine',
  'bilan.objectifs': { one: '1 objectif atteint sur 3', other: '{n} objectifs atteints sur 3' },
  // Records de cote (Profil, Ta cote)
  'records.titre': 'Tes records',
  'records.cote': 'Meilleure cote',
  'records.coteLe': 'le {date}',
  'records.serie': 'Plus longue série de victoires',
  'records.serieValeur': { one: '{n} victoire', other: '{n} victoires' },
  'records.enCours': { one: 'En cours : {n} victoire', other: 'En cours : {n} victoires' },
  'records.vide': 'Tes records apparaissent après ta première partie classée.',
  'records.chargement': 'Je cherche tes records…',
  'records.erreur': 'Tes records n’ont pas pu être lus.',
} as const satisfies Record<string, Texte>;

export type CleEmulation = keyof typeof FR;

const EN: { readonly [K in CleEmulation]: Texte } = {
  'jour.titre': 'Your friends today',
  'jour.resume': '{reussis} of {n}',
  'jour.resumeAria': { one: '{reussis} friend of {n} did the Daily Go', other: '{reussis} friends of {n} did the Daily Go' },
  'jour.toi': 'You',
  'jour.reussi': { one: 'Solved in 1 try', other: 'Solved in {n} tries' },
  'jour.vu': 'Done',
  'jour.pasEncore': 'Not yet',
  'jour.rappeler': 'Remind them',
  'jour.rappelerAria': 'Remind {pseudo} about the Daily Go',
  'jour.rappele': 'Reminder sent',
  'jour.envoi': 'Sending…',
  'jour.chargement': 'Checking on your friends…',
  'jour.erreur': 'Your friends couldn’t be loaded.',
  'jour.reessayer': 'Try again',
  'jour.horsLigne': 'You’re offline: your friends will show up when you’re back.',
  'jour.erreur.limiteRappels': 'You sent 20 reminders today. Come back tomorrow.',
  'jour.erreur.dejaFait': '{pseudo} just did it!',
  'jour.erreur.autre': 'The reminder didn’t go out. Try again.',
  'semaine.titre': 'Your week',
  'semaine.ligne': 'Your week',
  'semaine.ligneValeur': '{n} / 3 goals',
  'semaine.objectifs': 'Your goals',
  'semaine.objectifsAide': 'Each goal you reach earns +{xp} XP. New goals every Monday.',
  'semaine.obj.parties': { one: 'Finish {n} game', other: 'Finish {n} games' },
  'semaine.obj.problemes': { one: 'Solve {n} problem', other: 'Solve {n} problems' },
  'semaine.obj.erreurs': { one: 'Replay {n} mistake', other: 'Replay {n} mistakes' },
  'semaine.obj.aide.erreurs': 'A replayed mistake: a move from your game you try again after the review.',
  'semaine.obj.progression': '{fait} / {cible}',
  'semaine.obj.aria': '{objectif}: {fait} of {cible}.',
  'semaine.obj.atteint': 'Done',
  'semaine.obj.atteintAria': '{objectif}: done, +{xp} XP.',
  'semaine.action.parties': 'Play a game',
  'semaine.action.problemes': 'Solve a problem',
  'semaine.action.erreurs': 'Review my games',
  'semaine.toutFait': 'All your goals are done. Well played, see you Monday!',
  'semaine.depuisLundi': 'Since Monday',
  'semaine.stat.parties': { one: 'game', other: 'games' },
  'semaine.stat.problemes': { one: 'problem', other: 'problems' },
  'semaine.stat.goDuJour': { one: 'Daily Go', other: 'Daily Go' },
  'semaine.stat.lecons': { one: 'lesson', other: 'lessons' },
  'semaine.amis.battu': { one: 'You beat {pseudo} once.', other: 'You beat {pseudo} {n} times.' },
  'semaine.amis.joue': { one: 'You played 1 game against {pseudo}.', other: 'You played {n} games against {pseudo}.' },
  'semaine.cote': 'Your rating: {ecart} this week.',
  'semaine.serveur.chargement': 'Looking for your online games…',
  'semaine.serveur.erreur': 'Your online games couldn’t be loaded.',
  'semaine.serveur.horsLigne': 'You’re offline: your online games will come back with the network.',
  'semaine.serveur.sansCompte': 'With an account, you’ll also see your games against friends.',
  'bilan.titre': 'Your last week',
  'bilan.mochi': 'Great week! Here’s what you did.',
  'bilan.fermer': 'Close',
  'bilan.fermerAria': 'Close the weekly summary',
  'bilan.objectifs': { one: '1 goal of 3 reached', other: '{n} goals of 3 reached' },
  'records.titre': 'Your records',
  'records.cote': 'Best rating',
  'records.coteLe': 'on {date}',
  'records.serie': 'Longest winning streak',
  'records.serieValeur': { one: '{n} win', other: '{n} wins' },
  'records.enCours': { one: 'Current: {n} win', other: 'Current: {n} wins' },
  'records.vide': 'Your records show up after your first rated game.',
  'records.chargement': 'Looking for your records…',
  'records.erreur': 'Your records couldn’t be loaded.',
};

export const CATALOGUE_EMULATION: Record<Langue, { readonly [K in CleEmulation]: Texte }> = { fr: FR, en: EN };

const regles = new Map<Langue, Intl.PluralRules>();
function forme(texte: Texte, l: Langue, n: unknown): string {
  if (typeof texte === 'string') return texte;
  if (typeof n !== 'number') return texte.other;
  let r = regles.get(l);
  if (!r) regles.set(l, (r = new Intl.PluralRules(l)));
  return r.select(n) === 'one' ? texte.one : texte.other;
}

/** Texte de l'émulation dans une langue donnée ; un pluriel suit `n` ; variables `{nom}` remplacées. */
export function traduireEmulation(l: Langue, cle: CleEmulation, vars: Record<string, string | number> = {}): string {
  const brut = forme(CATALOGUE_EMULATION[l][cle] || FR[cle], l, vars.n);
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

/** Texte de l'émulation dans la langue de l'interface. */
export const te = (cle: CleEmulation, vars?: Record<string, string | number>): string => traduireEmulation(langue(), cle, vars);
