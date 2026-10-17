// #590, #614 : « Par thème » d'Apprendre, sous la carte « Reprendre ». La même grille que dans Problèmes (GrilleThemes) :
// la vignette de la leçon qui illustre le thème, son nom, ce qu'on y apprend, puis « Maîtrisé » quand toutes ses leçons
// sont faites, sinon une barre (leçons faites sur le total). Les six premiers thèmes, dans l'ordre du chemin ; les autres
// derrière « Tous les thèmes », pour que la grille n'écrase pas « Reprendre », qui reste la seule action en relief.
// Toucher une carte ouvre la page du thème (src/app/ThemeLecons.tsx, chargée à la demande).
import type { Theme } from '../content/themesLecons';
import type { ThemeApprendre } from '../app/themesApprendre';
import { t } from '../content/i18n/secondaires';
import { GrilleThemes, type CarteTheme } from './GrilleThemes';
import { VignetteLecon } from './VignetteLecon';

/** Thèmes montrés avant « Tous les thèmes » : les premiers que le chemin fait découvrir. */
export const THEMES_VISIBLES = 6;

export function ThemesApprendre({ themes, onTheme }: { themes: readonly ThemeApprendre[]; onTheme: (theme: Theme) => void }) {
  const cartes = themes.map((x): CarteTheme => ({
    cle: x.theme, nom: t(`theme.${x.theme}`), description: t(`themes.desc.${x.theme}`),
    motif: <VignetteLecon id={x.vignette} taille={44} />,
    maitrise: x.faites === x.lecons.length, part: x.faites / x.lecons.length,
    partAria: t('apprendre.themes.barre', { n: x.faites, total: x.lecons.length }),
  }));
  return (
    <GrilleThemes titre={t('apprendre.themes.titre')} cartes={cartes} motMaitrise={t('themes.maitrise')} onOuvrir={cle => onTheme(cle as Theme)}
      pli={{ visibles: THEMES_VISIBLES, libelle: t('apprendre.themes.tous') }} className="par-theme" testId="par-theme" />
  );
}
