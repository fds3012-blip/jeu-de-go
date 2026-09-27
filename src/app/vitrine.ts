// Profil vivant (issue #103) : statistiques et badges déduits des données locales. Logique pure, sans React.
import type { Bilan } from './bilan';
import type { Palier } from './paliers';

export interface Donnees {
  /** Identifiants des problèmes réussis sur ce téléphone. */
  reussis: number;
  serie: number;
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
  return [
    { id: 'problemes', valeur: d.reussis, legende: d.reussis > 1 ? 'problèmes' : 'problème' },
    { id: 'serie', valeur: d.serie, legende: d.serie > 1 ? 'jours de série' : 'jour de série' },
    { id: 'parties', valeur: d.parties, legende: d.parties > 1 ? 'parties' : 'partie' },
    { id: 'victoires', valeur: v, legende: v > 1 ? 'victoires' : 'victoire' },
  ];
}

export type BadgeId = 'premiere-partie' | 'victoire-pomme' | 'premier-probleme' | 'dix-problemes' | 'serie-7' | 'palier-debutant' | 'palier-novice';

export interface Badge { id: BadgeId; nom: string; condition: string; obtenu: boolean }

const complet = (d: Donnees, id: string) => d.paliers.some(p => p.id === id && p.complet);

/** Badges de la vitrine : obtenus d'abord, dans l'ordre du parcours ; les autres ensuite, grisés avec leur condition. */
export function badges(d: Donnees): Badge[] {
  const tous: Badge[] = [
    { id: 'premiere-partie', nom: 'Première partie', condition: 'Joue une partie contre l’ordi.', obtenu: d.parties > 0 },
    { id: 'premier-probleme', nom: 'Premier problème', condition: 'Réussis un problème.', obtenu: d.reussis > 0 },
    { id: 'victoire-pomme', nom: 'Pomme battue', condition: 'Gagne une partie contre Pomme.', obtenu: (d.bilan.pomme?.v ?? 0) > 0 },
    { id: 'palier-debutant', nom: 'Palier Débutant', condition: 'Réussis tout le palier Débutant.', obtenu: complet(d, 'debutant') },
    { id: 'dix-problemes', nom: '10 problèmes', condition: 'Réussis 10 problèmes.', obtenu: d.reussis >= 10 },
    { id: 'palier-novice', nom: 'Palier Novice', condition: 'Réussis tout le palier Novice.', obtenu: complet(d, 'novice') },
    { id: 'serie-7', nom: '7 jours de série', condition: 'Fais le Go du jour 7 jours de suite.', obtenu: d.serie >= 7 },
  ];
  return [...tous.filter(b => b.obtenu), ...tous.filter(b => !b.obtenu)];
}
