// Maîtrise par thème (issue #549) : une barre par série (Capturer, Sauver, Vie et mort…), et « Thème suivant » quand
// une série est maîtrisée. Logique pure, sans React ni stockage : la maîtrise se lit dans les problèmes réussis (sans
// avoir vu la réponse, #197), déjà gardés sur l'appareil et, avec un compte, sur le serveur. Rien de nouveau n'est stocké.
//
// Réglage : MAITRISE_CIBLE problèmes différents réussis dans la série. Ce n'est pas le total de la série (décision #137 :
// jamais de total visible) : c'est un objectif fixe, le même pour toutes les séries, plus petit qu'elles (une série
// n'est affichée qu'avec MIN_PAR_SERIE problèmes au moins). Indicateur visé : la part des joueurs qui ouvrent un 2e thème
// (`theme_suivant` / `theme_maitrise`) et la réussite au premier essai dans le thème suivant (`probleme_termine.theme`).
import { SERIES_THEMES, problemesDe, type SerieTheme } from './seriesThemes';

/**
 * Problèmes différents à réussir pour maîtriser un thème. 6 : assez pour avoir vu le geste dans des positions variées
 * (au moins deux niveaux de difficulté dans chaque série), assez peu pour être atteint en deux ou trois séances.
 */
export const MAITRISE_CIBLE = 6;

interface ProblemeTheme { id: string; difficulty: number; rows: readonly string[]; toPlay: 1 | 2 }

export interface Maitrise {
  /** Problèmes différents réussis dans la série, plafonnés à la cible. */
  reussis: number;
  /** Objectif de la série : MAITRISE_CIBLE, ou moins si la série est plus courte (jamais vu en pratique). */
  cible: number;
  maitrise: boolean;
}

/** Maîtrise d'une série, d'après les problèmes réussis. `exclure` : le Go du jour, qui n'est pas dans les séries. */
export function maitriseDe(liste: readonly ProblemeTheme[], serie: SerieTheme, reussis: ReadonlySet<string>, exclure?: string): Maitrise {
  const pool = problemesDe(liste, serie, exclure);
  const cible = Math.max(1, Math.min(MAITRISE_CIBLE, pool.length));
  const n = Math.min(cible, pool.filter(p => reussis.has(p.id)).length);
  return { reussis: n, cible, maitrise: n >= cible };
}

/** Maîtrise de chaque série affichée. */
export function maitrises(liste: readonly ProblemeTheme[], series: readonly SerieTheme[], reussis: ReadonlySet<string>, exclure?: string) {
  const out: Partial<Record<SerieTheme, Maitrise>> = {};
  for (const s of series) out[s] = maitriseDe(liste, s, reussis, exclure);
  return out;
}

/**
 * Thème à proposer après `serie` : la série suivante pas encore maîtrisée, dans l'ordre des séries (du geste le plus
 * simple aux combinaisons), en revenant au début s'il le faut. `null` quand tout est maîtrisé.
 */
export function themeSuivant(serie: SerieTheme, series: readonly SerieTheme[], m: Partial<Record<SerieTheme, Maitrise>>): SerieTheme | null {
  const ordre = SERIES_THEMES.filter(s => series.includes(s));
  const i = ordre.indexOf(serie);
  for (let d = 1; d < ordre.length; d++) {
    const s = ordre[(i + d) % ordre.length];
    if (!m[s]?.maitrise) return s;
  }
  return null;
}

/** La réussite de `id` vient-elle de faire passer la série à « maîtrisé » ? */
export function vientDeMaitriser(liste: readonly ProblemeTheme[], serie: SerieTheme, avant: ReadonlySet<string>, id: string, exclure?: string): boolean {
  if (avant.has(id)) return false;
  const apres = new Set(avant); apres.add(id);
  return !maitriseDe(liste, serie, avant, exclure).maitrise && maitriseDe(liste, serie, apres, exclure).maitrise;
}

