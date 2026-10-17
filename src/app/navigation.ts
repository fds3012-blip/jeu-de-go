// Modèle de navigation (#605, lot N0 de docs/ux/architecture-pages-2026-10.md). Logique pure, sans React ni DOM.
//
// - `Ecran` : tous les écrans de l'inventaire (§ 3 du document d'architecture), feuilles et écrans de compte compris.
//   Les identifiants sont stables : ils servent aussi de valeur à la propriété `ecran` des événements de suivi.
// - Une pile par onglet (règle A8 de DESIGN.md) : la racine de l'onglet en bas, l'écran affiché en haut.
// - `ouvrir` pose un écran sur la pile de l'onglet courant, sans changer d'onglet (A3) ; un profil remplace un profil
//   (A4) ; une feuille remplace une feuille (A12).
// - `retour` fait ce que fait « ‹ » et le retour du système (A7) : dépiler ; à la racine d'Apprendre, de Problèmes ou du
//   Profil, revenir à Jouer ; à la racine de Jouer, laisser le système sortir.
// - `changerOnglet` garde la pile de l'onglet quitté ; toucher l'onglet déjà actif ramène à sa racine (A8).
//
// Ce module ne remplace encore aucun état d'App.tsx : il les lit en parallèle (N1), puis les remplacera (N3).
import type { Onglet } from '../ui/onglets';

export type { Onglet };

/** Racines des quatre onglets. */
export type Racine = 'jouer' | 'apprendre' | 'problemes' | 'profil';

/** Écrans de l'onglet Jouer (maison : Jouer). */
export type EcranJouer =
  | 'question_go' // « Tu connais le go ? », à la place de l'accueil au tout premier lancement
  | 'feuille_changer' | 'feuille_plus'
  | 'en_ligne_direct' | 'en_ligne_lente' // choix, recherche, attente, liste
  | 'partie_ordi' | 'partie_deux' | 'partie_direct' | 'partie_defi' // partie d'un défi ou partie lente
  | 'revue' | 'rejouer_erreurs'
  | 'placement' | 'defis' | 'defi_arrivee' | 'partie_partagee' | 'seance_revisions';

/** Écrans de l'onglet Apprendre. */
export type EcranApprendre =
  | 'intro_regles' | 'partie_decouverte' | 'partie_guidee'
  | 'lecon' | 'serie_lecon' | 'theme' | 'ouvertures' | 'ouverture';

/** Écrans de l'onglet Problèmes. */
export type EcranProblemes = 'probleme' | 'course' | 'series_theme' | 'serie_theme' | 'tous_problemes';

/** Écrans de l'onglet Profil. */
export type EcranProfil =
  | 'mes_parties' | 'importer' | 'etude' | 'amis' | 'joueur' | 'cote' | 'semaine' | 'stats'
  | 'rappel' | 'installer' | 'reglages' | 'compte' | 'donnees' | 'mentions' | 'conditions';

/** Par-dessus tout : écrans de compte et feuilles communes, posés sur l'onglet courant. */
export type EcranDessus =
  | 'creer_compte' | 'pseudo' | 'accord_conditions'
  | 'aide' | 'feuille_partager' | 'feuille_ecrire' | 'feuille_partage_partie' | 'repli_hors_ligne' | 'consentement';

export type Ecran = Racine | EcranJouer | EcranApprendre | EcranProblemes | EcranProfil | EcranDessus;

/** Un écran de la pile ; `id` : la leçon, le problème, le thème, la partie ou le joueur regardé. */
export interface Entree { readonly ecran: Ecran; readonly id?: string }

export interface Navigation {
  readonly onglet: Onglet;
  /** Une pile par onglet, jamais vide : sa racine en bas. */
  readonly piles: Readonly<Record<Onglet, readonly Entree[]>>;
}

/** Ce que `retour` a fait : dépiler, revenir à Jouer, laisser le système sortir, ou rien (écran bloquant). */
export type EffetRetour = 'depile' | 'vers_jouer' | 'sortir' | 'bloque';

export const ONGLETS_ORDRE: readonly Onglet[] = ['jouer', 'apprendre', 'problemes', 'profil'];

const RACINES: ReadonlySet<Ecran> = new Set<Ecran>(ONGLETS_ORDRE);

/** Feuilles (`<dialog class="feuille">`) : posées par-dessus, elles se ferment d'abord au retour. */
export const FEUILLES: ReadonlySet<Ecran> = new Set<Ecran>([
  'feuille_changer', 'feuille_plus', 'aide', 'feuille_partager', 'feuille_ecrire', 'feuille_partage_partie', 'repli_hors_ligne', 'consentement',
]);

/** Activités (A5) : plein écran, une seule sortie en haut à gauche, avec confirmation si l'on perd quelque chose. */
export const ACTIVITES: ReadonlySet<Ecran> = new Set<Ecran>([
  'partie_ordi', 'partie_deux', 'partie_direct', 'partie_defi', 'partie_guidee', 'partie_decouverte', 'revue', 'rejouer_erreurs',
  'placement', 'seance_revisions', 'intro_regles', 'lecon', 'serie_lecon', 'probleme', 'course', 'serie_theme',
]);

/** Écrans bloquants : une seule action, pas de retour (« Choisis ton pseudo », accord aux conditions). */
export const BLOQUANTS: ReadonlySet<Ecran> = new Set<Ecran>(['pseudo', 'accord_conditions']);

const MAISONS: Readonly<Record<Exclude<Onglet, 'jouer'>, readonly Ecran[]>> = {
  apprendre: ['intro_regles', 'partie_decouverte', 'partie_guidee', 'lecon', 'serie_lecon', 'theme', 'ouvertures', 'ouverture'],
  problemes: ['probleme', 'course', 'series_theme', 'serie_theme', 'tous_problemes'],
  profil: ['mes_parties', 'importer', 'etude', 'amis', 'joueur', 'cote', 'semaine', 'stats', 'rappel', 'installer', 'reglages', 'compte', 'donnees', 'mentions', 'conditions'],
};

/** Par-dessus tout : sans maison, posés sur l'onglet courant. */
const DESSUS: ReadonlySet<Ecran> = new Set<Ecran>(['creer_compte', 'pseudo', 'accord_conditions', 'aide', 'feuille_partager', 'feuille_ecrire',
  'feuille_partage_partie', 'repli_hors_ligne', 'consentement']);

export const estRacine = (e: Ecran): e is Racine => RACINES.has(e);
export const estFeuille = (e: Ecran): boolean => FEUILLES.has(e);
export const estActivite = (e: Ecran): boolean => ACTIVITES.has(e);

/**
 * Maison d'un écran (A2) : l'onglet dont le rôle le décrit. `null` : par-dessus tout (compte, feuilles communes),
 * l'écran se pose sur l'onglet courant. « Changer » et « Plus » sont des feuilles de Jouer.
 */
export function ongletDe(e: Ecran): Onglet | null {
  if (estRacine(e)) return e;
  if (DESSUS.has(e)) return null;
  for (const o of ['apprendre', 'problemes', 'profil'] as const) if (MAISONS[o].includes(e)) return o;
  return 'jouer';
}

/** La racine d'un onglet, seule dans sa pile. */
export const racine = (o: Onglet): Entree => ({ ecran: o });

/** Au lancement : chaque onglet sur sa racine, `onglet` affiché (Jouer, ou l'onglet d'un lien). */
export function navigationInitiale(onglet: Onglet = 'jouer'): Navigation {
  return { onglet, piles: { jouer: [racine('jouer')], apprendre: [racine('apprendre')], problemes: [racine('problemes')], profil: [racine('profil')] } };
}

/** L'écran affiché : le haut de la pile de l'onglet courant. */
export function courant(nav: Navigation): Entree {
  const pile = nav.piles[nav.onglet];
  return pile[pile.length - 1];
}

const memeEntree = (a: Entree, b: Entree) => a.ecran === b.ecran && a.id === b.id;

const avecPile = (nav: Navigation, o: Onglet, pile: readonly Entree[]): Navigation => ({ ...nav, piles: { ...nav.piles, [o]: pile } });

/** Retire les feuilles du haut d'une pile : une feuille ne survit pas à un changement d'onglet. */
const sansFeuilles = (pile: readonly Entree[]): readonly Entree[] => {
  let n = pile.length;
  while (n > 1 && estFeuille(pile[n - 1].ecran)) n--;
  return n === pile.length ? pile : pile.slice(0, n);
};

/**
 * Change d'onglet (barre du bas). L'onglet quitté garde sa pile, sans ses feuilles (A8). Toucher l'onglet déjà actif
 * ramène à sa racine.
 */
export function changerOnglet(nav: Navigation, o: Onglet): Navigation {
  if (o === nav.onglet) {
    const pile = nav.piles[o];
    return pile.length === 1 ? nav : avecPile(nav, o, [pile[0]]);
  }
  const quitte = sansFeuilles(nav.piles[nav.onglet]);
  return { onglet: o, piles: { ...nav.piles, [nav.onglet]: quitte } };
}

/**
 * Ouvre un écran par-dessus l'écran courant, dans l'onglet courant (un raccourci ne change pas d'onglet, A3).
 * - Une racine : c'est un changement d'onglet.
 * - Le même écran déjà en haut : rien (un double toucher n'empile pas deux fois).
 * - Un profil sur un profil, une feuille sur une feuille : le nouveau remplace l'ancien (A4, A12).
 */
export function ouvrir(nav: Navigation, entree: Entree): Navigation {
  if (estRacine(entree.ecran)) return changerOnglet(nav, entree.ecran);
  const pile = nav.piles[nav.onglet];
  const haut = pile[pile.length - 1];
  if (memeEntree(haut, entree)) return nav;
  const remplace = pile.length > 1 && ((haut.ecran === 'joueur' && entree.ecran === 'joueur') || (estFeuille(haut.ecran) && estFeuille(entree.ecran)));
  return avecPile(nav, nav.onglet, [...(remplace ? pile.slice(0, -1) : pile), entree]);
}

/**
 * Retour (« ‹ », retour du système, Échap) : dépile l'écran du haut. À la racine d'Apprendre, de Problèmes ou du Profil,
 * revient à Jouer (sa pile est gardée) ; à la racine de Jouer, laisse le système faire (`sortir`, rien ne change).
 * Un écran bloquant ne se quitte pas (`bloque`).
 */
export function retour(nav: Navigation): { nav: Navigation; effet: EffetRetour } {
  const pile = nav.piles[nav.onglet];
  if (BLOQUANTS.has(pile[pile.length - 1].ecran)) return { nav, effet: 'bloque' };
  if (pile.length > 1) return { nav: avecPile(nav, nav.onglet, pile.slice(0, -1)), effet: 'depile' };
  if (nav.onglet !== 'jouer') return { nav: { ...nav, onglet: 'jouer' }, effet: 'vers_jouer' };
  return { nav, effet: 'sortir' };
}

/**
 * Nombre de retours avant que le système ne sorte : les écrans au-dessus de la racine, plus un hors de Jouer. C'est le
 * nombre d'entrées d'historique que le retour du système doit trouver (N1).
 */
export function profondeur(nav: Navigation): number {
  return nav.piles[nav.onglet].length - 1 + (nav.onglet === 'jouer' ? 0 : 1);
}
