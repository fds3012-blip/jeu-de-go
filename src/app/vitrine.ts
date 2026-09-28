// Profil vivant (issue #103) : statistiques et badges déduits des données locales. Logique pure, sans React.
import type { Bilan } from './bilan';
import type { Palier } from './paliers';
import { t } from '../content/i18n';

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

export interface Stat { id: 'problemes' | 'serie' | 'parties' | 'victoires'; valeur: number; legende: string }

export const victoires = (b: Bilan) => Object.values(b).reduce((s, x) => s + x.v, 0);

/** Quatre statistiques, toujours dans le même ordre. Les légendes s'accordent au nombre. */
export function statistiques(d: Donnees): Stat[] {
  const v = victoires(d.bilan);
  const record = d.record ?? 0;
  // Série finie (#212) : on montre le record, jamais un « 0 jour de série » en gros.
  const serie: Stat = d.serie === 0 && record > 0
    ? { id: 'serie', valeur: record, legende: t('profil.recordLegende', { n: record }) }
    : { id: 'serie', valeur: d.serie, legende: t('stats.serie', { n: d.serie }) };
  return [
    { id: 'problemes', valeur: d.reussis, legende: t('stats.problemes', { n: d.reussis }) },
    serie,
    { id: 'parties', valeur: d.parties, legende: t('stats.parties', { n: d.parties }) },
    { id: 'victoires', valeur: v, legende: t('stats.victoires', { n: v }) },
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
    'victoire-pomme': (d.bilan.pomme?.v ?? 0) > 0,
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
