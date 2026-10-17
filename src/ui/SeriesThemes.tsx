// Problèmes par thème (#471) : les vignettes des séries dans l'écran Problèmes, et le compteur « d'affilée » du lecteur.
// Actions secondaires, à plat : l'action en relief reste le Go du jour, ou « Problème suivant » une fois le Go du jour fait.
// Aucune cote n'est affichée (décision #137) : seulement les réussites d'affilée et le record de chaque série.
import { MiniGoban } from './MiniGoban';
import { GrilleThemes, type CarteTheme } from './GrilleThemes';
import { fr } from './typo';
import { t } from '../content/i18n/secondaires';
import type { EtatSeriesThemes, SerieTheme } from '../app/seriesThemes';
import { MAITRISE_CIBLE, type Maitrise } from '../app/maitriseThemes';
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

/** #614 : ce qu'on apprend dans chaque série, une ligne sous son nom (mêmes textes que les thèmes des leçons). */
const DESCRIPTION = {
  capturer: 'themes.desc.capture', sauver: 'themes.desc.sauver', 'vie-mort': 'themes.desc.vie-mort',
  'relier-couper': 'themes.desc.relier-couper', 'fin-de-partie': 'themes.desc.fin-de-partie', tesuji: 'themes.desc.tesuji',
} as const satisfies Record<SerieTheme, string>;

export function VignettesThemes({ series, etat, onOuvrir, maitrise }: {
  series: readonly SerieTheme[]; etat: EtatSeriesThemes; onOuvrir: (s: SerieTheme) => void;
  /** #549 : maîtrise de chaque série (barre fine sous le nom, « Maîtrisé » une fois l'objectif atteint). */
  maitrise?: Partial<Record<SerieTheme, Maitrise>>;
}) {
  // #614 : la grille est partagée avec Apprendre (GrilleThemes). Le tesuji s'explique sur sa carte (CLAUDE.md, règle 5).
  const cartes = series.map((s): CarteTheme => {
    const record = etat[s]?.record ?? 0;
    // #549 : la barre vise un objectif fixe (MAITRISE_CIBLE), jamais le total de la série (#137).
    const m = maitrise?.[s] ?? { reussis: 0, cible: MAITRISE_CIBLE, maitrise: false };
    return {
      cle: s, nom: t(`themes.nom.${s}`), description: t(DESCRIPTION[s]),
      motif: <MiniGoban rows={MOTIFS[s]} />,
      maitrise: m.maitrise, part: m.reussis / m.cible, partAria: t('themes.maitriseAria', { n: m.reussis, cible: m.cible }),
      record: record > 0 ? t('themes.record', { n: record }) : undefined,
    };
  });
  return <GrilleThemes titre={t('themes.titre')} cartes={cartes} motMaitrise={t('themes.maitrise')} onOuvrir={cle => onOuvrir(cle as SerieTheme)} />;
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
