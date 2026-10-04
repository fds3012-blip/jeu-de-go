// Profil vivant (issue #103) : statistiques et badges déduits des données locales. Logique pure, sans React.
import type { Bilan } from './bilan';
import type { Palier } from './paliers';
import { t } from '../content/i18n/secondaires';

/** Badges déjà gagnés sur cet appareil (issue #212) : un badge gagné n'est jamais retiré, même si sa condition ne tient plus. */
export const BADGES_KEY = 'go.badges.v1';

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

export type BadgeId = 'premiere-partie' | 'victoire-pomme' | 'premier-probleme' | 'dix-problemes' | 'serie-7' | 'palier-debutant' | 'palier-novice';

export interface Badge { id: BadgeId; nom: string; condition: string; obtenu: boolean }

const complet = (d: Donnees, id: string) => d.paliers.some(p => p.id === id && p.complet);

/**
 * Badges de la vitrine : obtenus d'abord, dans l'ordre du parcours ; les autres ensuite, grisés avec leur condition.
 * `gagnes` : badges déjà gagnés (stockage de l'appareil). Ils restent obtenus pour toujours (#212).
 */
export function badges(d: Donnees, gagnes: readonly string[] = []): Badge[] {
  const obtenus: Record<BadgeId, boolean> = {
    'premiere-partie': d.parties > 0,
    'premier-probleme': d.reussis > 0,
    // #233 : Pomme ou n'importe quel adversaire de l'échelle (tous plus forts qu'elle). Un joueur placé par « Je sais déjà
    // jouer » (#283) commence plus haut et ne joue jamais Pomme : sans cela, ce badge lui restait grisé pour toujours.
    'victoire-pomme': victoires(d.bilan) > 0,
    'palier-debutant': complet(d, 'debutant'),
    'dix-problemes': d.reussis >= 10,
    'palier-novice': complet(d, 'novice'),
    'serie-7': Math.max(d.serie, d.record ?? 0) >= 7,
  };
  // Textes dans la langue de l'interface (#167) : src/content/i18n, clés badge.<id>.nom et badge.<id>.condition.
  const tous: Badge[] = (Object.keys(obtenus) as BadgeId[])
    .map(id => ({ id, nom: t(`badge.${id}.nom`), condition: t(`badge.${id}.condition`), obtenu: obtenus[id] || gagnes.includes(id) }));
  return [...tous.filter(b => b.obtenu), ...tous.filter(b => !b.obtenu)];
}

/** Relit la liste des badges gagnés, en tolérant les valeurs abîmées. */
export function lireBadges(brut: unknown): string[] {
  return Array.isArray(brut) ? brut.filter((x): x is string => typeof x === 'string') : [];
}

/** Ajoute aux badges gagnés ceux obtenus maintenant. Rend la même liste si rien n'a changé (pas d'écriture inutile). */
export function memoriser(gagnes: readonly string[], liste: readonly Badge[]): string[] {
  const nouveaux = liste.filter(b => b.obtenu && !gagnes.includes(b.id)).map(b => b.id);
  return nouveaux.length ? [...gagnes, ...nouveaux] : (gagnes as string[]);
}
