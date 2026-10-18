// Textes de l'analyse expliquée de la revue (#673), FR et EN. Hors du catalogue principal (fr.ts, dans le JS initial) :
// ils n'arrivent qu'avec la revue, chargée à la demande (budget du JS initial, scripts/budget-bundle.mjs).
// Règles : phrases courtes, tutoiement ; atari, sente, gote et couper expliqués à leur première apparition (glose entre
// parenthèses). Chaque phrase ne dit qu'un fait calculé par src/go/explication.ts : ne pas ajouter de raison ici.
import { langue, type Langue } from './index';

type Pluriel = { one: string; other: string };
type Texte = string | Pluriel;

const FR = {
  'pourquoi': 'Pourquoi ?',
  'pourquoi.aria': 'Pourquoi c’est une erreur, et pourquoi {bon} est meilleur',
  'fermer': 'Fermer',
  'titre.erreur': 'Pourquoi c’est une erreur',
  'titre.meilleur': 'Pourquoi {bon} est meilleur',
  'onglet.joue': 'Ton coup',
  'onglet.bon': 'Le bon coup',
  'onglets': 'Suite à voir',
  'suite.etape': 'Coup {i} sur {n} de la suite',
  'suite.precedent': 'Coup précédent de la suite',
  'suite.suivant': 'Coup suivant de la suite',
  'suite.legende.joue': { one: 'Ton coup, puis la réponse de KataGo.', other: 'Ton coup, puis la suite de KataGo.' },
  'suite.legende.bon': { one: 'Le bon coup.', other: 'Le bon coup, puis la suite de KataGo.' },

  'pts': { one: '{n} point', other: '{n} points' },
  'pierres': { one: '{n} pierre', other: '{n} pierres' },

  // Gloses : une seule fois par revue, à la première apparition du mot.
  'glose.atari.one': ' (il ne lui restait qu’une liberté)',
  'glose.atari.other': ' (il ne leur restait qu’une liberté)',
  'glose.atariApres': ' (une seule liberté)',
  'glose.sente': ' (un coup qui oblige l’adversaire à répondre)',
  'glose.gote': ' (un coup qui n’oblige pas l’adversaire à répondre)',
  'glose.couper': ' (couper, c’est séparer des pierres)',

  // Pourquoi c'est une erreur.
  'erreur.perdues.atari': { one: 'Ta pierre en {lieu} était en atari{glose} et tu n’as pas répondu : {adv} la prend en {point}.', other: 'Tes {n} pierres en {lieu} étaient en atari{glose} et tu n’as pas répondu : {adv} les prend en {point}.' },
  'erreur.perdues.autoAtari': { one: 'Ton coup met ta pierre en atari{glose} : {adv} la prend en {point}.', other: 'Ton coup met tes {n} pierres en atari{glose} : {adv} les prend en {point}.' },
  'erreur.perdues.suite': { one: 'Dans la suite de KataGo, {adv} prend ta pierre en {lieu} (coup {k}).', other: 'Dans la suite de KataGo, {adv} prend {n} de tes pierres en {lieu} (coup {k}).' },
  'erreur.manquee.atari': { one: 'Sa pierre en {lieu} était en atari{glose} : tu pouvais la prendre.', other: 'Ses {n} pierres en {lieu} étaient en atari{glose} : tu pouvais les prendre.' },
  'erreur.manquee.immediate': { one: 'Tu pouvais prendre sa pierre en {lieu} tout de suite.', other: 'Tu pouvais prendre ses {n} pierres en {lieu} tout de suite.' },
  'erreur.manquee.suite': { one: 'Tu laisses passer la prise de sa pierre en {lieu}.', other: 'Tu laisses passer la prise de ses {n} pierres en {lieu}.' },
  'erreur.groupe.mort': 'Après ton coup, ton groupe de {n} pierres en {lieu} meurt, selon KataGo.',
  'erreur.groupe.faible': 'Après ton coup, ton groupe de {n} pierres en {lieu} n’est plus sûr de vivre.',
  'erreur.groupeTue.vit': 'Après ton coup, son groupe de {n} pierres en {lieu} vit, selon KataGo.',
  'erreur.groupeTue.incertain': 'Après ton coup, son groupe de {n} pierres en {lieu} peut encore s’en sortir.',
  'erreur.coupe': '{adv} répond en {point} et coupe tes pierres{glose} : elles sont séparées.',
  'erreur.territoire': 'Tu perds environ {pts} {zone}.',
  'erreur.initiative': 'Ton coup est gote{glose} : {adv} joue tout de suite ailleurs, en {point}.',
  'erreur.positionnel': 'KataGo préfère {bon}, d’environ {pts} ; la raison est surtout positionnelle.',
  'erreur.positionnelCalme': 'KataGo préfère {bon}, d’environ {pts}. Rien n’est pris et aucun groupe ne change de sort : la raison est surtout positionnelle.',
  'erreur.inexplique': 'KataGo préfère {bon}, d’environ {pts}. Je ne trouve pas de raison simple et sûre : regarde les deux suites.',
  'erreur.riposte': '{adv} répond en {point}.',
  'erreur.pointCommun': '{adv} répond en {bon} : c’est justement le coup que KataGo préférait pour toi, d’environ {pts}.',

  // Pourquoi le bon coup est meilleur.
  'bon.perdues': { one: 'Avec {bon}, cette pierre n’est pas prise.', other: 'Avec {bon}, ces {n} pierres ne sont pas prises.' },
  'bon.manquee.immediate': { one: '{bon} prend une pierre tout de suite.', other: '{bon} prend {n} pierres tout de suite.' },
  'bon.manquee.suite': { one: 'Avec {bon}, tu prends sa pierre en {lieu} (coup {k} de la suite).', other: 'Avec {bon}, tu prends ses {n} pierres en {lieu} (coup {k} de la suite).' },
  'bon.groupe': 'Avec {bon}, ce groupe reste vivant, selon KataGo.',
  'bon.groupeTue': '{bon} tue son groupe de {n} pierres en {lieu}, selon KataGo.',
  'bon.coupe.occupe': '{bon} prend le point de coupe : tes pierres restent ensemble.',
  'bon.coupe.relie': '{bon} relie tes pierres : plus de coupe en {point}.',
  'bon.coupe.atari': 'Après {bon}, une pierre de {adv} en {point} serait en atari{glose} : la coupe ne marche plus.',
  'bon.territoire': 'Avec {bon}, tu gagnes environ {pts} {zone}.',
  'bon.initiative': '{bon} est sente{glose} : {adv} répond en {reponse}, puis tu joues ailleurs, en {ailleurs}.',
  'bon.general': 'KataGo préfère {bon} : environ {pts} de plus que ton coup.',
  'bon.pointCommun': '{bon} est un point clé pour les deux camps : {adv} l’a pris juste après ton coup.',

  // Zones.
  'zone.coinHautGauche': 'dans le coin en haut à gauche',
  'zone.coinHautDroite': 'dans le coin en haut à droite',
  'zone.coinBasGauche': 'dans le coin en bas à gauche',
  'zone.coinBasDroite': 'dans le coin en bas à droite',
  'zone.bordHaut': 'sur le bord du haut',
  'zone.bordBas': 'sur le bord du bas',
  'zone.bordGauche': 'sur le bord de gauche',
  'zone.bordDroite': 'sur le bord de droite',
  'zone.centre': 'au centre',
  'zone.hautGauche': 'en haut à gauche',
  'zone.hautDroite': 'en haut à droite',
  'zone.basGauche': 'en bas à gauche',
  'zone.basDroite': 'en bas à droite',
  'zone.haut': 'en haut',
  'zone.bas': 'en bas',
  'zone.gauche': 'à gauche',
  'zone.droite': 'à droite',
};

export type CleAnalyse = keyof typeof FR;

const EN: { readonly [K in CleAnalyse]: Texte } = {
  'pourquoi': 'Why?',
  'pourquoi.aria': 'Why this is a mistake, and why {bon} is better',
  'fermer': 'Close',
  'titre.erreur': 'Why it’s a mistake',
  'titre.meilleur': 'Why {bon} is better',
  'onglet.joue': 'Your move',
  'onglet.bon': 'Best move',
  'onglets': 'Line to show',
  'suite.etape': 'Move {i} of {n} in the line',
  'suite.precedent': 'Previous move in the line',
  'suite.suivant': 'Next move in the line',
  'suite.legende.joue': { one: 'Your move, then KataGo’s answer.', other: 'Your move, then KataGo’s line.' },
  'suite.legende.bon': { one: 'The best move.', other: 'The best move, then KataGo’s line.' },

  'pts': { one: '{n} point', other: '{n} points' },
  'pierres': { one: '{n} stone', other: '{n} stones' },

  'glose.atari.one': ' (it had only one liberty left)',
  'glose.atari.other': ' (they had only one liberty left)',
  'glose.atariApres': ' (a single liberty)',
  'glose.sente': ' (a move your opponent must answer)',
  'glose.gote': ' (a move your opponent doesn’t have to answer)',
  'glose.couper': ' (cutting means separating stones)',

  'erreur.perdues.atari': { one: 'Your stone at {lieu} was in atari{glose} and you didn’t answer: {adv} captures it at {point}.', other: 'Your {n} stones at {lieu} were in atari{glose} and you didn’t answer: {adv} captures them at {point}.' },
  'erreur.perdues.autoAtari': { one: 'Your move puts your stone in atari{glose}: {adv} captures it at {point}.', other: 'Your move puts your {n} stones in atari{glose}: {adv} captures them at {point}.' },
  'erreur.perdues.suite': { one: 'In KataGo’s line, {adv} captures your stone at {lieu} (move {k}).', other: 'In KataGo’s line, {adv} captures {n} of your stones at {lieu} (move {k}).' },
  'erreur.manquee.atari': { one: 'Their stone at {lieu} was in atari{glose}: you could capture it.', other: 'Their {n} stones at {lieu} were in atari{glose}: you could capture them.' },
  'erreur.manquee.immediate': { one: 'You could capture their stone at {lieu} right away.', other: 'You could capture their {n} stones at {lieu} right away.' },
  'erreur.manquee.suite': { one: 'You miss the capture of their stone at {lieu}.', other: 'You miss the capture of their {n} stones at {lieu}.' },
  'erreur.groupe.mort': 'After your move, your group of {n} stones at {lieu} dies, according to KataGo.',
  'erreur.groupe.faible': 'After your move, your group of {n} stones at {lieu} is no longer sure to live.',
  'erreur.groupeTue.vit': 'After your move, their group of {n} stones at {lieu} lives, according to KataGo.',
  'erreur.groupeTue.incertain': 'After your move, their group of {n} stones at {lieu} can still get away.',
  'erreur.coupe': '{adv} answers at {point} and cuts your stones{glose}: they are separated.',
  'erreur.territoire': 'You lose about {pts} {zone}.',
  'erreur.initiative': 'Your move is gote{glose}: {adv} plays elsewhere right away, at {point}.',
  'erreur.positionnel': 'KataGo prefers {bon}, by about {pts}; the reason is mostly positional.',
  'erreur.positionnelCalme': 'KataGo prefers {bon}, by about {pts}. Nothing is captured and no group changes fate: the reason is mostly positional.',
  'erreur.inexplique': 'KataGo prefers {bon}, by about {pts}. I can’t find a simple, safe reason: look at both lines.',
  'erreur.riposte': '{adv} answers at {point}.',
  'erreur.pointCommun': '{adv} answers at {bon}: exactly the move KataGo preferred for you, by about {pts}.',

  'bon.perdues': { one: 'With {bon}, this stone isn’t captured.', other: 'With {bon}, these {n} stones aren’t captured.' },
  'bon.manquee.immediate': { one: '{bon} captures a stone right away.', other: '{bon} captures {n} stones right away.' },
  'bon.manquee.suite': { one: 'With {bon}, you capture their stone at {lieu} (move {k} of the line).', other: 'With {bon}, you capture their {n} stones at {lieu} (move {k} of the line).' },
  'bon.groupe': 'With {bon}, this group stays alive, according to KataGo.',
  'bon.groupeTue': '{bon} kills their group of {n} stones at {lieu}, according to KataGo.',
  'bon.coupe.occupe': '{bon} takes the cutting point: your stones stay together.',
  'bon.coupe.relie': '{bon} connects your stones: no more cut at {point}.',
  'bon.coupe.atari': 'After {bon}, a {adv} stone at {point} would be in atari{glose}: the cut no longer works.',
  'bon.territoire': 'With {bon}, you gain about {pts} {zone}.',
  'bon.initiative': '{bon} is sente{glose}: {adv} answers at {reponse}, then you play elsewhere, at {ailleurs}.',
  'bon.general': 'KataGo prefers {bon}: about {pts} more than your move.',
  'bon.pointCommun': '{bon} is a key point for both sides: {adv} took it right after your move.',

  'zone.coinHautGauche': 'in the top left corner',
  'zone.coinHautDroite': 'in the top right corner',
  'zone.coinBasGauche': 'in the bottom left corner',
  'zone.coinBasDroite': 'in the bottom right corner',
  'zone.bordHaut': 'on the top side',
  'zone.bordBas': 'on the bottom side',
  'zone.bordGauche': 'on the left side',
  'zone.bordDroite': 'on the right side',
  'zone.centre': 'in the center',
  'zone.hautGauche': 'in the top left',
  'zone.hautDroite': 'in the top right',
  'zone.basGauche': 'in the bottom left',
  'zone.basDroite': 'in the bottom right',
  'zone.haut': 'at the top',
  'zone.bas': 'at the bottom',
  'zone.gauche': 'on the left',
  'zone.droite': 'on the right',
};

export const CATALOGUE_ANALYSE: Record<Langue, { readonly [K in CleAnalyse]: Texte }> = { fr: FR, en: EN };

const regles = new Map<Langue, Intl.PluralRules>();
function forme(texte: Texte, l: Langue, n: unknown): string {
  if (typeof texte === 'string') return texte;
  if (typeof n !== 'number') return texte.other;
  let r = regles.get(l);
  if (!r) regles.set(l, (r = new Intl.PluralRules(l)));
  return (texte as Record<string, string>)[r.select(n)] ?? texte.other;
}

/** Texte dans une langue donnée, variables `{nom}` remplacées, pluriel par `n`. */
export function traduireAnalyse(l: Langue, cle: CleAnalyse, vars: Record<string, string | number> = {}): string {
  const brut = forme(CATALOGUE_ANALYSE[l][cle] || FR[cle], l, vars.n);
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

/** Texte dans la langue de l'interface. */
export const ta = (cle: CleAnalyse, vars?: Record<string, string | number>): string => traduireAnalyse(langue(), cle, vars);
