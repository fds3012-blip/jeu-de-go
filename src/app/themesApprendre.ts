// #590 : « Par thème » dans Apprendre. Logique pure, sans React : les thèmes qui ont au moins une leçon publiée,
// dans l'ordre où le chemin les fait découvrir, et l'avancement de chacun. Les thèmes viennent de THEMES_DE_LECON
// (src/content/themesLecons.ts, déjà dans le JS initial) : aucun nouveau contenu de go.
import { THEMES_DE_LECON, type Theme } from '../content/themesLecons';

interface LeconCourte { id: string; steps: readonly unknown[] }

export interface ThemeApprendre {
  theme: Theme;
  /** Leçons du thème, dans l'ordre du chemin. */
  lecons: string[];
  /** Leçons du thème terminées. */
  faites: number;
  /**
   * #614 : leçon dont la vignette illustre le thème sur sa carte. La première leçon du thème dont la vignette n'illustre
   * pas déjà un thème placé avant lui : la leçon 3 sert trois thèmes, la leçon 6 deux ; sans cette règle, plusieurs
   * cartes voisines auraient le même dessin. Aucune position nouvelle : ce sont les vignettes du chemin (src/ui/vignettes.ts).
   */
  vignette: string;
}

const finie = (l: LeconCourte, progression: Readonly<Record<string, number>>) => (progression[l.id] ?? 0) >= l.steps.length;

/**
 * Thèmes qui ont au moins une leçon dans `lecons` (le chemin publié), dans l'ordre de leur première leçon :
 * un débutant voit d'abord « Capture » et « Atari », pas « Seki ».
 */
export function themesAvecLecons(lecons: readonly LeconCourte[], progression: Readonly<Record<string, number>>): ThemeApprendre[] {
  const parTheme = new Map<Theme, ThemeApprendre>();
  for (const l of lecons) {
    for (const theme of THEMES_DE_LECON[l.id] ?? []) {
      const e = parTheme.get(theme) ?? { theme, lecons: [], faites: 0, vignette: l.id };
      e.lecons.push(l.id);
      if (finie(l, progression)) e.faites++;
      parTheme.set(theme, e);
    }
  }
  const themes = [...parTheme.values()], prises = new Set<string>();
  for (const x of themes) {
    x.vignette = x.lecons.find(id => !prises.has(id)) ?? x.lecons[0];
    prises.add(x.vignette);
  }
  return themes;
}

/** Leçons d'un thème, dans l'ordre du chemin. */
export function leconsDuTheme<L extends LeconCourte>(theme: Theme, lecons: readonly L[]): L[] {
  return lecons.filter(l => (THEMES_DE_LECON[l.id] ?? []).includes(theme));
}
