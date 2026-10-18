// Textes de « Compter une photo » (#655), FR et EN. Hors du catalogue principal (fr.ts, dans le JS initial) : ils
// n'arrivent qu'avec l'écran, chargé à la demande (budget du JS initial, scripts/budget-bundle.mjs).
// Règles : phrases courtes, tutoiement ; komi, seki et dame expliqués là où ils apparaissent.
import { langue, nombre, type Langue } from './index';

type Pluriel = { one: string; other: string };
type Texte = string | Pluriel;

const FR = {
  'ligne': 'Compter une photo',
  'titre': 'Compter une photo',
  'retour': 'Retour',

  'photo.intro': 'Prends ton goban en photo, d’assez haut, en entier. Je lis les pierres et je compte les points.',
  'photo.permission': 'Ton téléphone va te demander l’appareil photo. La photo reste sur ton téléphone : elle n’est ni envoyée ni gardée.',
  'photo.prendre': 'Prendre une photo',
  'photo.galerie': 'Choisir dans la galerie',
  'photo.chargement': 'J’ouvre la photo…',
  'photo.erreur': 'Cette image n’a pas pu être lue. Essaie une autre photo.',

  'coins.consigne': 'Pose les 4 coins sur les derniers croisements de la grille.',
  'coins.propose': 'J’ai placé les coins. Si la grille verte ne tombe pas sur les lignes, déplace-les.',
  'coins.taille': 'Taille du plateau',
  'coins.tailleN': '{n} × {n}',
  'coins.croises': 'Les coins se croisent : remets-les chacun dans son coin.',
  'coins.photoAria': 'Ta photo, avec la grille à caler sur le plateau',
  'coins.aide': 'Flèches pour déplacer le coin, Maj pour aller plus vite.',
  'coins.loupe': 'Loupe sur le coin',
  'coin.0': 'Coin en haut à gauche',
  'coin.1': 'Coin en haut à droite',
  'coin.2': 'Coin en bas à droite',
  'coin.3': 'Coin en bas à gauche',
  'coins.lire': 'Lire les pierres',
  'coins.autre': 'Changer de photo',
  'lecture': 'Je lis les pierres…',
  'lecture.erreur': 'Je n’ai pas pu lire la photo. Vérifie les coins et réessaie.',

  'pierres.consigne': 'Touche un point pour le corriger : vide, noire, blanche.',
  'pierres.incertaines': { one: '{n} point à vérifier, marqué en rouge.', other: '{n} points à vérifier, marqués en rouge.' },
  'pierres.aucune': 'Tout est lu. Vérifie d’un coup d’œil.',
  'pierres.valider': 'Les pierres sont justes',
  'pierres.coins': 'Revoir les coins',
  'pierres.plateauAria': 'Plateau lu sur la photo',

  'mortes.consigne': 'Touche un groupe mort pour le retirer : ses pierres deviennent des prisonniers.',
  'mortes.cherche': 'Mochi cherche les pierres mortes…',
  'mortes.propose': { one: 'Mochi pense qu’une pierre est morte (grisée). Vérifie : il peut se tromper.', other: 'Mochi pense que {n} pierres sont mortes (grisées). Vérifie : il peut se tromper.' },
  'mortes.rien': 'Mochi ne voit pas de pierre morte. S’il en reste, touche-les.',
  'mortes.valider': 'Choisir la règle',

  'regle.groupe': 'Règle de comptage',
  'regle.japanese': 'Japonaise',
  'regle.chinese': 'Chinoise',
  'regle.japanese.aide': 'Tu comptes ton territoire et tes prisonniers.',
  'regle.chinese.aide': 'Tu comptes ton territoire et tes pierres sur le plateau. Les prisonniers ne comptent pas.',
  'komi': 'Komi',
  'komi.aide': 'Le komi, ce sont des points donnés à Blanc, qui joue en second.',
  'komi.moins': 'Un demi-point de komi en moins',
  'komi.plus': 'Un demi-point de komi en plus',
  'prisonniers': 'Prisonniers',
  'prisonniers.aide': 'Les pierres prises pendant la partie, dans les couvercles. La photo ne les voit pas : compte-les.',
  'prisonniers.noir': 'Pris par Noir',
  'prisonniers.blanc': 'Pris par Blanc',
  'prisonniers.moins': '{camp} : un prisonnier en moins',
  'prisonniers.plus': '{camp} : un prisonnier en plus',
  'regle.compter': 'Voir le score',

  'score.noir': { one: 'Noir gagne de {v} point', other: 'Noir gagne de {v} points' },
  'score.blanc': { one: 'Blanc gagne de {v} point', other: 'Blanc gagne de {v} points' },
  'score.egalite': 'Égalité',
  'score.detail': 'Détail du score',
  'score.camp.noir': 'Noir',
  'score.camp.blanc': 'Blanc',
  'score.territoire': 'Territoire',
  'score.prisonniers': 'Prisonniers',
  'score.pierres': 'Pierres',
  'score.komi': 'Komi',
  'score.total': 'Total',
  'score.regle.japanese': 'Règle japonaise, komi {komi}.',
  'score.regle.chinese': 'Règle chinoise, komi {komi}.',
  'score.mortes': { one: 'Prisonniers : {n} pierre morte comprise.', other: 'Prisonniers : {n} pierres mortes comprises.' },
  'score.dame': { one: '{n} point neutre (dame) : il n’est à personne.', other: '{n} points neutres (dame) : ils ne sont à personne.' },
  'score.seki.japanese': 'Seki : des groupes vivent côte à côte sans pouvoir se prendre. En règle japonaise, leurs yeux ne comptent pas.',
  'score.seki.chinese': 'Seki : des groupes vivent côte à côte sans pouvoir se prendre. En règle chinoise, leurs pierres et leurs yeux comptent.',
  'score.autre': 'Compter une autre photo',
  'score.regle': 'Changer la règle',
} as const;

export type ClePhoto = keyof typeof FR;

const EN: { readonly [K in ClePhoto]: Texte } = {
  'ligne': 'Count a photo',
  'titre': 'Count a photo',
  'retour': 'Back',

  'photo.intro': 'Take a photo of your board, from high enough, all of it. I read the stones and count the points.',
  'photo.permission': 'Your phone will ask for the camera. The photo stays on your phone: it is never sent or kept.',
  'photo.prendre': 'Take a photo',
  'photo.galerie': 'Choose from the gallery',
  'photo.chargement': 'Opening the photo…',
  'photo.erreur': 'This image could not be read. Try another photo.',

  'coins.consigne': 'Put the 4 corners on the last crossings of the grid.',
  'coins.propose': 'I placed the corners. If the green grid misses the lines, move them.',
  'coins.taille': 'Board size',
  'coins.tailleN': '{n} × {n}',
  'coins.croises': 'The corners cross: put each one back in its corner.',
  'coins.photoAria': 'Your photo, with the grid to fit on the board',
  'coins.aide': 'Arrow keys move the corner, Shift moves faster.',
  'coins.loupe': 'Magnifier on the corner',
  'coin.0': 'Top left corner',
  'coin.1': 'Top right corner',
  'coin.2': 'Bottom right corner',
  'coin.3': 'Bottom left corner',
  'coins.lire': 'Read the stones',
  'coins.autre': 'Change photo',
  'lecture': 'Reading the stones…',
  'lecture.erreur': 'I could not read the photo. Check the corners and try again.',

  'pierres.consigne': 'Tap a point to fix it: empty, black, white.',
  'pierres.incertaines': { one: '{n} point to check, marked in red.', other: '{n} points to check, marked in red.' },
  'pierres.aucune': 'Everything is read. Give it a quick look.',
  'pierres.valider': 'The stones are right',
  'pierres.coins': 'Check the corners again',
  'pierres.plateauAria': 'Board read from the photo',

  'mortes.consigne': 'Tap a dead group to remove it: its stones become prisoners.',
  'mortes.cherche': 'Mochi is looking for dead stones…',
  'mortes.propose': { one: 'Mochi thinks one stone is dead (greyed). Check it: he can be wrong.', other: 'Mochi thinks {n} stones are dead (greyed). Check them: he can be wrong.' },
  'mortes.rien': 'Mochi sees no dead stone. If some are left, tap them.',
  'mortes.valider': 'Choose the rules',

  'regle.groupe': 'Counting rules',
  'regle.japanese': 'Japanese',
  'regle.chinese': 'Chinese',
  'regle.japanese.aide': 'You count your territory and your prisoners.',
  'regle.chinese.aide': 'You count your territory and your stones on the board. Prisoners do not count.',
  'komi': 'Komi',
  'komi.aide': 'Komi is the points given to White, who plays second.',
  'komi.moins': 'Half a point less komi',
  'komi.plus': 'Half a point more komi',
  'prisonniers': 'Prisoners',
  'prisonniers.aide': 'The stones captured during the game, in the bowl lids. The photo cannot see them: count them.',
  'prisonniers.noir': 'Taken by Black',
  'prisonniers.blanc': 'Taken by White',
  'prisonniers.moins': '{camp}: one prisoner less',
  'prisonniers.plus': '{camp}: one prisoner more',
  'regle.compter': 'See the score',

  'score.noir': { one: 'Black wins by {v} point', other: 'Black wins by {v} points' },
  'score.blanc': { one: 'White wins by {v} point', other: 'White wins by {v} points' },
  'score.egalite': 'Draw',
  'score.detail': 'Score details',
  'score.camp.noir': 'Black',
  'score.camp.blanc': 'White',
  'score.territoire': 'Territory',
  'score.prisonniers': 'Prisoners',
  'score.pierres': 'Stones',
  'score.komi': 'Komi',
  'score.total': 'Score',
  'score.regle.japanese': 'Japanese rules, komi {komi}.',
  'score.regle.chinese': 'Chinese rules, komi {komi}.',
  'score.mortes': { one: 'Prisoners: {n} dead stone included.', other: 'Prisoners: {n} dead stones included.' },
  'score.dame': { one: '{n} neutral point (dame): it belongs to nobody.', other: '{n} neutral points (dame): they belong to nobody.' },
  'score.seki.japanese': 'Seki: groups live side by side and cannot capture each other. Under Japanese rules, their eyes do not count.',
  'score.seki.chinese': 'Seki: groups live side by side and cannot capture each other. Under Chinese rules, their stones and eyes count.',
  'score.autre': 'Count another photo',
  'score.regle': 'Change the rules',
};

export const CATALOGUE_PHOTO: Record<Langue, { readonly [K in ClePhoto]: Texte }> = { fr: FR, en: EN };

const regles = new Map<Langue, Intl.PluralRules>();
function forme(texte: Texte, l: Langue, n: unknown): string {
  if (typeof texte === 'string') return texte;
  if (typeof n !== 'number') return texte.other;
  let r = regles.get(l);
  if (!r) regles.set(l, (r = new Intl.PluralRules(l)));
  return (texte as Record<string, string>)[r.select(n)] ?? texte.other;
}

/** Texte dans une langue donnée, variables `{nom}` remplacées, pluriel par `n`. */
export function traduirePhoto(l: Langue, cle: ClePhoto, vars: Record<string, string | number> = {}): string {
  const brut = forme(CATALOGUE_PHOTO[l][cle] || FR[cle], l, vars.n);
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

/** Texte dans la langue de l'interface. */
export const tph = (cle: ClePhoto, vars?: Record<string, string | number>): string => traduirePhoto(langue(), cle, vars);

/** Résultat en une phrase : « Noir gagne de 3,5 points », « Égalité ». */
export function phraseResultat(gagnant: 0 | 1 | 2, marge: number, l: Langue = langue()): string {
  if (!gagnant) return traduirePhoto(l, 'score.egalite');
  return traduirePhoto(l, gagnant === 1 ? 'score.noir' : 'score.blanc', { n: marge, v: nombre(marge, l) });
}
