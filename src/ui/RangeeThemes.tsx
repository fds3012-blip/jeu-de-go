// #590 : « Par thème », sous la carte de la prochaine leçon d'Apprendre. Une rangée de puces qui défile de côté :
// secondaire (« Reprendre » reste la seule action en relief), rangée dans l'ordre où le chemin fait découvrir les thèmes.
// Toucher une puce ouvre la page du thème (src/app/ThemeLecons.tsx, chargée à la demande).
// #602 (E7) : plus de compteur « 0/3 » sur chaque puce ; l'avancée est dans le nom accessible et sur la page du thème.
import type { Theme } from '../content/themesLecons';
import type { ThemeApprendre } from '../app/themesApprendre';
import { t } from '../content/i18n/secondaires';

export function RangeeThemes({ themes, onTheme }: { themes: readonly ThemeApprendre[]; onTheme: (theme: Theme) => void }) {
  if (!themes.length) return null;
  return (
    <section className="par-theme" aria-labelledby="par-theme-titre" data-testid="par-theme">
      <h3 id="par-theme-titre">{t('apprendre.themes.titre')}</h3>
      <ul>
        {themes.map(x => {
          const nom = t(`theme.${x.theme}`), fini = x.faites === x.lecons.length;
          return (
            <li key={x.theme}>
              <button type="button" className="puce-theme" data-fini={fini || undefined} onClick={() => onTheme(x.theme)}
                aria-label={t('apprendre.themes.aria', { theme: nom, n: x.faites, total: x.lecons.length })}>
                {nom}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
