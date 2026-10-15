// Problèmes par thème (#471) : les vignettes des séries dans l'écran Problèmes, et le compteur « d'affilée » du lecteur.
// Actions secondaires, à plat : l'action en relief reste le Go du jour, ou « Problème suivant » une fois le Go du jour fait.
// Aucune cote n'est affichée (décision #137) : seulement les réussites d'affilée et le record de chaque série.
import type { CSSProperties } from 'react';
import { MiniGoban } from './MiniGoban';
import { fr } from './typo';
import { t } from '../content/i18n/secondaires';
import type { EtatSeriesThemes, SerieTheme } from '../app/seriesThemes';
import type { Maitrise } from '../app/maitriseThemes';
import './themes.css';

/**
 * Motif de chaque série : quelques pierres sur un bout de goban, le geste en une image (aucun problème à résoudre).
 * X noir, O blanc ; T et S, pierre marquée (blanche, noire).
 */
const MOTIFS: Record<SerieTheme, string[]> = {
  // La pierre blanche marquée n'a plus qu'une liberté.
  capturer: ['.....', '..X..', '.XTX.', '.....', '.....'],
  // Ta pierre marquée est en atari : elle s'allonge.
  sauver: ['.....', '..O..', '.OSO.', '.....', '.....'],
  // Un groupe noir au bord et ses deux yeux.
  'vie-mort': ['.....', '.....', '.....', 'XXXXX', 'X.X.X'],
  // La coupe en croix.
  'relier-couper': ['.....', '.XO..', '.OX..', '.....', '.....'],
  // Deux frontières qui se ferment.
  'fin-de-partie': ['.....', '.XXOO', '.XXOO', '.XXOO', '.....'],
  // Le filet : la pierre marquée ne sort plus.
  tesuji: ['.....', '.X...', '..TX.', '.X...', '.....'],
};

export function VignettesThemes({ series, etat, onOuvrir, maitrise }: {
  series: readonly SerieTheme[]; etat: EtatSeriesThemes; onOuvrir: (s: SerieTheme) => void;
  /** #549 : maîtrise de chaque série (barre fine sous le nom, « Maîtrisé » une fois l'objectif atteint). */
  maitrise?: Partial<Record<SerieTheme, Maitrise>>;
}) {
  if (!series.length) return null;
  return (
    <section className="themes" aria-labelledby="themes-titre">
      <h3 id="themes-titre">{t('themes.titre')}</h3>
      {/* Le mot « tesuji » est expliqué ici, une fois (CLAUDE.md, règle 5) : les vignettes restent sur une ligne. */}
      {series.includes('tesuji') && <p className="themes-aide">{fr(t('themes.aide'))}</p>}
      <ul className="themes-grille">
        {series.map(s => {
          const record = etat[s]?.record ?? 0;
          const m = maitrise?.[s];
          return (
            <li key={s}>
              {/* #268 (WCAG 2.5.3) : le nom accessible est le texte visible, le nom de la série d'abord. */}
              <button type="button" className="theme-carte" data-theme={s} onClick={() => onOuvrir(s)}>
                <span className="theme-motif" aria-hidden="true"><MiniGoban rows={MOTIFS[s]} /></span>
                <span className="theme-nom">
                  <b>{t(`themes.nom.${s}`)}</b>
                  {m?.maitrise
                    ? <span className="theme-maitrise-mot" data-maitrise="">{t('themes.maitrise')}</span>
                    : record > 0 && <span className="theme-record">{fr(t('themes.record', { n: record }))}</span>}
                  {/* #549 : la barre vise un objectif fixe (MAITRISE_CIBLE), jamais le total de la série (#137). */}
                  {m && !m.maitrise && (
                    <span className="theme-maitrise" role="img" aria-label={fr(t('themes.maitriseAria', { n: m.reussis, cible: m.cible }))}
                      style={{ '--part': `${Math.round((m.reussis / m.cible) * 100)}%` } as CSSProperties}><i /></span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Surtitre du lecteur dans une série : le nom de la série et les réussites d'affilée. Un nouveau record se lit en or
 * (« Record ! ») ; la pastille se pose d'un léger rebond, sauf avec les mouvements réduits (themes.css).
 */
export function SurtitreTheme({ serie, affilee, record }: { serie: SerieTheme; affilee: number; record: boolean }) {
  return (
    <span className="theme-surtitre">
      {t(`themes.nom.${serie}`)}
      <span key={record ? `r${affilee}` : 'n'} className={`theme-affilee${record ? ' record' : ''}`} data-affilee={affilee} role="status">
        {fr(t('themes.affilee', { n: affilee }))}
        {record && <b className="theme-nouveau-record">{fr(t('themes.nouveauRecord'))}</b>}
      </span>
    </span>
  );
}
