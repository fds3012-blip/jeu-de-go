// Profil vivant (issue #103) : statistiques et badges déduits des données locales. Logique pure, sans React.
import type { Bilan } from './bilan';
import type { Palier } from './paliers';
import { t } from '../content/i18n/secondaires';

// La liste gardée et l'écriture d'un badge gagné sur le moment vivent dans badgesGagnes.ts (module léger, #529).
export { BADGES_KEY, lireBadges } from './badgesGagnes';

export interface Donnees {
  /** Identifiants des problèmes réussis sur ce téléphone. */
  reussis: number;
  serie: number;
  /** Plus longue série connue (issue #212). Absent : la série en cours. */
  record?: number;
  parties: number;
  bilan: Bilan;
  /** Paliers de problèmes, pour savoir lesquels sont complets. */
  paliers: Pick<Palier<unknown>, 'id' | 'complet'>[];
  // #529 : de quoi donner les badges de la vitrine élargie. Absent : 0 ou rien (anciens appelants, tests).
  /** Leçons terminées. */
  lecons?: number;
  /** Identifiants des chapitres du chemin dont toutes les leçons sont terminées. */
  chapitres?: readonly string[];
  /** Meilleur score à la course aux problèmes. */
  course?: number;
  /** Tailles des parties terminées sur l'appareil (contre l'ordi, guidées, à deux ; pas les importées). */
  tailles?: readonly number[];
  /** Erreurs de partie maîtrisées (sorties de la révision espacée, #469). */
  maitrisees?: number;
  /** Meilleure suite de réussites d'affilée dans une série par thème (#471). */
  serieTheme?: number;
  /** Parties revues avec KataGo (#368). */
  revues?: number;
}

/** #214 : un compteur, avec son total quand il y en a un (« 3 / 7 leçons ») ; les problèmes n'ont pas de fin. */
export interface Stat { id: 'record' | 'lecons' | 'adversaires' | 'problemes'; valeur: number; total?: number; legende: string }

/** Ce que « Ton parcours » ajoute aux données locales (#214) : leçons terminées et taille de l'échelle des adversaires. */
export interface Parcours {
  lecons: { faites: number; total: number };
  /** Nombre d'adversaires de l'échelle (les battus se lisent dans le bilan). */
  adversaires: number;
}

/** Nombre de jours à partir duquel on parle de record (#237). */
export const RECORD_MIN = 2;

export const victoires = (b: Bilan) => Object.values(b).reduce((s, x) => s + x.v, 0);

/** Adversaires battus au moins une fois sur cet appareil. */
export const adversairesBattus = (b: Bilan) => Object.values(b).filter(x => x.v > 0).length;

/**
 * « Ton parcours » (#214), toujours dans le même ordre : record de série, leçons, adversaires battus, problèmes réussis.
 * Le record n'est jamais plus petit que la série en cours : jamais de « 0 jour de série » en gros (#212).
 */
export function statistiques(d: Donnees, p: Parcours): Stat[] {
  const record = Math.max(d.serie, d.record ?? 0);
  const battus = Math.min(adversairesBattus(d.bilan), p.adversaires);
  return [
    // #237 : « record » seulement à partir d'un vrai record (2 jours) ; avant, c'est une série comme une autre.
    { id: 'record', valeur: record, legende: t(record >= RECORD_MIN ? 'profil.recordLegende' : 'pb.serieLegende', { n: record }) },
    { id: 'lecons', valeur: p.lecons.faites, total: p.lecons.total, legende: t('stats.lecons', { n: p.lecons.faites }) },
    { id: 'adversaires', valeur: battus, total: p.adversaires, legende: t('stats.adversaires', { n: battus }) },
    { id: 'problemes', valeur: d.reussis, legende: t('stats.problemes', { n: d.reussis }) },
  ];
}

/**
 * Les badges (#103, élargis à 21 par #529), dans l'ordre où un joueur type les rencontre : la vitrine montre d'abord les
 * gagnés, puis les suivants à gagner dans cet ordre (le « prochain badge » est donc toujours le plus proche).
 * Cinq familles : premiers pas, régularité, maîtrise, découverte, avec les autres (dessins : src/ui/Vitrine.tsx).
 * Règles communes : aucun badge ne se perd, aucun ne demande d'acheter ni de revenir à heure fixe, aucun ne dit un total
 * de problèmes (#137 : « 50 problèmes » est un cap, pas un « 50 sur 183 »).
 */
export const BADGES = [
  'premiere-partie', 'premier-probleme', 'premiere-lecon', 'victoire-pomme', 'premiere-course',
  'dix-problemes', 'serie-7', 'goban-13', 'premiere-revue', 'chapitre-bases',
  'palier-debutant', 'objectif-semaine', 'serie-theme', 'trois-adversaires', 'premiere-en-ligne',
  'erreur-maitrisee', 'cinquante-problemes', 'palier-novice', 'goban-19', 'victoire-classee', 'serie-30',
] as const;
export type BadgeId = typeof BADGES[number];

export type FamilleBadge = 'premiers-pas' | 'regularite' | 'maitrise' | 'decouverte' | 'social';
export const FAMILLE: Record<BadgeId, FamilleBadge> = {
  'premiere-partie': 'premiers-pas', 'premier-probleme': 'premiers-pas', 'premiere-lecon': 'premiers-pas',
  'victoire-pomme': 'premiers-pas', 'premiere-course': 'premiers-pas',
  'serie-7': 'regularite', 'serie-30': 'regularite', 'objectif-semaine': 'regularite',
  'dix-problemes': 'maitrise', 'cinquante-problemes': 'maitrise', 'palier-debutant': 'maitrise', 'palier-novice': 'maitrise',
  'chapitre-bases': 'maitrise', 'serie-theme': 'maitrise', 'erreur-maitrisee': 'maitrise', 'trois-adversaires': 'maitrise',
  'goban-13': 'decouverte', 'goban-19': 'decouverte', 'premiere-revue': 'decouverte',
  'premiere-en-ligne': 'social', 'victoire-classee': 'social',
};

/** Seuils des badges (#529), chacun visé par un indicateur de docs/game-design/economie.md, section 5. */
export const SEUILS_BADGES = {
  /** Problèmes réussis pour « 50 problèmes » : 3 à 4 semaines à 10 minutes par jour (simulation). */
  problemes: 50,
  /** Jours de série pour « 30 jours » : le badge du deuxième mois (J30). */
  serieLongue: 30,
  /** Adversaires différents battus : l'échelle se monte, Pomme seule ne suffit pas. */
  adversaires: 3,
  /** Réussites du premier coup d'affilée dans une série par thème (#471). */
  serieTheme: 5,
} as const;

/** Badges qui ne se déduisent pas des données de l'appareil : ils s'écrivent au moment où ils sont gagnés (badgesGagnes.ts). */
export const DU_MOMENT: ReadonlySet<BadgeId> = new Set<BadgeId>(['objectif-semaine', 'premiere-en-ligne', 'victoire-classee']);

/** Badges de la série : cachés avec elle quand « Montrer la série » est coupé (#365). */
export const BADGES_SERIE: ReadonlySet<BadgeId> = new Set<BadgeId>(['serie-7', 'serie-30']);

export interface Badge { id: BadgeId; nom: string; condition: string; obtenu: boolean }

const complet = (d: Donnees, id: string) => d.paliers.some(p => p.id === id && p.complet);

/** Badges obtenus d'après les données (sans la liste des badges déjà gagnés). */
export function obtenusDe(d: Donnees): Record<BadgeId, boolean> {
  const record = Math.max(d.serie, d.record ?? 0);
  return {
    'premiere-partie': d.parties > 0,
    'premier-probleme': d.reussis > 0,
    'premiere-lecon': (d.lecons ?? 0) > 0,
    // #233 : Pomme ou n'importe quel adversaire de l'échelle (tous plus forts qu'elle). Un joueur placé par « Je sais déjà
    // jouer » (#283) commence plus haut et ne joue jamais Pomme : sans cela, ce badge lui restait grisé pour toujours.
    'victoire-pomme': victoires(d.bilan) > 0,
    'premiere-course': (d.course ?? 0) > 0,
    'dix-problemes': d.reussis >= 10,
    'serie-7': record >= 7,
    'goban-13': (d.tailles ?? []).includes(13),
    'premiere-revue': (d.revues ?? 0) > 0,
    'chapitre-bases': (d.chapitres ?? []).includes('c1'),
    'palier-debutant': complet(d, 'debutant'),
    'objectif-semaine': false,
    'serie-theme': (d.serieTheme ?? 0) >= SEUILS_BADGES.serieTheme,
    'trois-adversaires': adversairesBattus(d.bilan) >= SEUILS_BADGES.adversaires,
    'premiere-en-ligne': false,
    'erreur-maitrisee': (d.maitrisees ?? 0) > 0,
    'cinquante-problemes': d.reussis >= SEUILS_BADGES.problemes,
    'palier-novice': complet(d, 'novice'),
    'goban-19': (d.tailles ?? []).includes(19),
    'victoire-classee': false,
    'serie-30': record >= SEUILS_BADGES.serieLongue,
  };
}

/**
 * Badges de la vitrine : obtenus d'abord, dans l'ordre du parcours ; les autres ensuite, grisés avec leur condition.
 * `gagnes` : badges déjà gagnés (stockage de l'appareil). Ils restent obtenus pour toujours (#212).
 */
export function badges(d: Donnees, gagnes: readonly string[] = []): Badge[] {
  const obtenus = obtenusDe(d);
  // Textes dans la langue de l'interface (#167) : src/content/i18n, clés badge.<id>.nom et badge.<id>.condition.
  const tous: Badge[] = BADGES
    .map(id => ({ id, nom: t(`badge.${id}.nom`), condition: t(`badge.${id}.condition`), obtenu: obtenus[id] || gagnes.includes(id) }));
  return [...tous.filter(b => b.obtenu), ...tous.filter(b => !b.obtenu)];
}

/**
 * Vitrine repliée (#529) : une seule rangée, comme la vitrine de 7 d'avant. Le Profil tient sans défiler (#50) et une
 * rangée de 390 px porte 7 ronds de 44 px : 6 sceaux et le rond « +N » qui ouvre les 21.
 */
export const PLACES_REPLIEE = 6;
/** Toujours au moins 2 badges à gagner en vue : le but suivant reste visible (effet de gradient). */
export const A_GAGNER_MIN = 2;

/**
 * Sceaux de la vitrine repliée, dans l'ordre du parcours : les prochains à gagner (au moins `A_GAGNER_MIN`), et parmi
 * les gagnés, ceux gagnés depuis la dernière visite d'abord (ils s'impriment), puis les plus avancés du parcours.
 */
export function vitrineRepliee(liste: readonly Badge[], nouveaux: readonly string[] = [], places = PLACES_REPLIEE): Badge[] {
  const obtenus = liste.filter(b => b.obtenu), aGagner = liste.filter(b => !b.obtenu);
  const nG = Math.min(aGagner.length, Math.max(A_GAGNER_MIN, places - obtenus.length));
  const nO = Math.min(obtenus.length, places - nG);
  const ordre = [...obtenus.filter(b => nouveaux.includes(b.id)), ...[...obtenus].reverse().filter(b => !nouveaux.includes(b.id))];
  const gardes = new Set(ordre.slice(0, nO).map(b => b.id));
  return [...obtenus.filter(b => gardes.has(b.id)), ...aGagner.slice(0, nG)];
}

/** Ajoute aux badges gagnés ceux obtenus maintenant. Rend la même liste si rien n'a changé (pas d'écriture inutile). */
export function memoriser(gagnes: readonly string[], liste: readonly Badge[]): string[] {
  const nouveaux = liste.filter(b => b.obtenu && !gagnes.includes(b.id)).map(b => b.id);
  return nouveaux.length ? [...gagnes, ...nouveaux] : (gagnes as string[]);
}
