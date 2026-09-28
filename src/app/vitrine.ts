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
    : { id: 'serie', valeur: d.serie, legende: d.serie > 1 ? 'jours de série' : 'jour de série' };
  return [
    { id: 'problemes', valeur: d.reussis, legende: d.reussis > 1 ? 'problèmes' : 'problème' },
    serie,
    { id: 'parties', valeur: d.parties, legende: d.parties > 1 ? 'parties' : 'partie' },
    { id: 'victoires', valeur: v, legende: v > 1 ? 'victoires' : 'victoire' },
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
  const tous: Badge[] = [
    { id: 'premiere-partie', nom: 'Première partie', condition: 'Joue une partie contre l’ordi.', obtenu: d.parties > 0 },
    { id: 'premier-probleme', nom: 'Premier problème', condition: 'Réussis un problème.', obtenu: d.reussis > 0 },
    { id: 'victoire-pomme', nom: 'Pomme battue', condition: 'Gagne une partie contre Pomme.', obtenu: (d.bilan.pomme?.v ?? 0) > 0 },
    { id: 'palier-debutant', nom: 'Palier Débutant', condition: 'Réussis tout le palier Débutant.', obtenu: complet(d, 'debutant') },
    { id: 'dix-problemes', nom: '10 problèmes', condition: 'Réussis 10 problèmes.', obtenu: d.reussis >= 10 },
    { id: 'palier-novice', nom: 'Palier Novice', condition: 'Réussis tout le palier Novice.', obtenu: complet(d, 'novice') },
    { id: 'serie-7', nom: '7 jours de série', condition: 'Fais le Go du jour 7 jours de suite.', obtenu: Math.max(d.serie, d.record ?? 0) >= 7 },
  ];
  for (const b of tous) if (gagnes.includes(b.id)) b.obtenu = true;
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
