// Badges élargis (#529) : ce que la vitrine lit sur l'appareil en plus des problèmes, parties et bilan du Profil.
// Tout est déjà gardé par ailleurs (aucune nouvelle clé) : leçons, course, Mes parties, révisions, séries par thème, revues.
import { CHAPITRES } from '../content/lessons';
import { LESSONS_KEY, readLocal } from './hooks';
import { MEILLEUR_COURSE_KEY } from './course';
import { HISTORIQUE_KEY, lireEntree } from './historique';
import { REVISIONS_KEY, lireRevisions } from './revisionEspacee';
import { SERIES_THEMES_KEY, nettoyerSeries } from './seriesThemes';
import { revuesAppareil } from './statsJoueur';
import type { Donnees } from './vitrine';

type Progression = Record<string, number>;

/** Chapitres du chemin dont toutes les leçons sont terminées (une leçon est finie quand toutes ses étapes le sont). */
export function chapitresFaits(progression: Progression): string[] {
  return CHAPITRES.filter(c => c.lecons.length > 0 && c.lecons.every(l => (progression[l.id] ?? 0) >= l.steps.length)).map(c => c.id);
}

/** Données des badges de #529, lues sur l'appareil. Une clé abîmée ou absente compte pour rien (jamais d'erreur). */
export function donneesBadgesAppareil(): Required<Pick<Donnees, 'chapitres' | 'course' | 'tailles' | 'maitrisees' | 'serieTheme' | 'revues'>> {
  const progression = readLocal<unknown>(LESSONS_KEY, {});
  const prog: Progression = progression && typeof progression === 'object' && !Array.isArray(progression) ? progression as Progression : {};
  const course = Number(readLocal<unknown>(MEILLEUR_COURSE_KEY, 0));
  const historique = readLocal<unknown>(HISTORIQUE_KEY, []);
  const tailles = new Set<number>();
  for (const x of Array.isArray(historique) ? historique : []) {
    const p = lireEntree(x);
    if (p && p.mode !== 'import') tailles.add(p.taille);
  }
  const series = nettoyerSeries(readLocal<unknown>(SERIES_THEMES_KEY, {}));
  return {
    chapitres: chapitresFaits(prog),
    course: Number.isFinite(course) && course > 0 ? Math.floor(course) : 0,
    tailles: [...tailles],
    maitrisees: Object.keys(lireRevisions(readLocal<unknown>(REVISIONS_KEY, null)).acquises).length,
    serieTheme: Math.max(0, ...Object.values(series).map(e => e?.record ?? 0)),
    revues: revuesAppareil().length,
  };
}
