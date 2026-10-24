// #590, #614 : « Par thème » d'Apprendre, sous la carte « Reprendre ». La même grille que dans Problèmes (GrilleThemes) :
// la vignette de la leçon qui illustre le thème, son nom, ce qu'on y apprend, puis « Maîtrisé » quand toutes ses leçons
// sont faites, sinon une barre (leçons faites sur le total). #652 : tous les thèmes, sans pli, dans l'ordre où les leçons les
// font découvrir. La grille est la seule liste longue d'Apprendre, rangée en dernier (P5) ; une colonne d'entrées toutes
// semblables (visuel, nom, une ligne) se parcourt du regard. Le pli cachait 9 thèmes sur 15, donc la moitié des leçons.
// Toucher une carte ouvre la page du thème (src/app/ThemeLecons.tsx, chargée à la demande).
import type { Theme } from '../content/themesLecons';
import type { ThemeApprendre } from '../app/themesApprendre';
import { t } from '../content/i18n/secondaires';
import { GrilleThemes, type CarteTheme } from './GrilleThemes';
import { VignetteLecon } from './VignetteLecon';

export function ThemesApprendre({ themes, onTheme }: { themes: readonly ThemeApprendre[]; onTheme: (theme: Theme) => void }) {
  const cartes = themes.map((x): CarteTheme => ({
    cle: x.theme, nom: t(`theme.${x.theme}`), description: t(`themes.desc.${x.theme}`),
    motif: <VignetteLecon id={x.vignette} taille={40} />,
    maitrise: x.faites === x.lecons.length, part: x.faites / x.lecons.length,
    partAria: t('apprendre.themes.barre', { n: x.faites, total: x.lecons.length }),
  }));
  return (
    <GrilleThemes titre={t('apprendre.themes.titre')} cartes={cartes} motMaitrise={t('themes.maitrise')} onOuvrir={cle => onTheme(cle as Theme)} className="par-theme" testId="par-theme" epure />
  );
}
