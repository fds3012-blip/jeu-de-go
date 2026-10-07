// Titre de l'onglet du navigateur (#465, WCAG 2.4.2) : il suit l'écran affiché, pour qui navigue entre ses onglets ou
// utilise un lecteur d'écran (le titre est lu au changement de page). L'accueil garde le titre de l'app.
import { t } from '../content/i18n';
import type { Onglet } from '../ui/onglets';

/** Écran affiché, tel que App.tsx le décide. */
export type EcranTitre =
  | { quoi: 'accueil' }
  | { quoi: 'onglet'; onglet: Exclude<Onglet, 'jouer'> }
  | { quoi: 'lecon'; titre: string }
  | { quoi: 'partie'; contre: string | null; guidee?: boolean }
  | { quoi: 'direct' | 'lente' | 'enLigne' | 'defi' | 'partagee' | 'placement' | 'compte' | 'revisions' };

/** Nom de l'écran, sans le nom de l'app. */
function nom(e: Exclude<EcranTitre, { quoi: 'accueil' }>): string {
  switch (e.quoi) {
    case 'onglet': return t(`nav.${e.onglet}`);
    case 'lecon': return e.titre;
    case 'partie': return e.guidee ? t('titre.guidee') : e.contre ? t('titre.partie', { nom: e.contre }) : t('titre.partieDeux');
    case 'direct': return t('titre.direct');
    case 'lente': return t('titre.lente');
    case 'enLigne': return t('titre.enLigne');
    case 'defi': return t('defi.titre');
    case 'partagee': return t('titre.partagee');
    case 'placement': return t('titre.placement');
    case 'compte': return t('titre.compte');
    case 'revisions': return t('titre.revisions');
  }
}

/** « Problèmes · Mochi Go » ; l'accueil : « Mochi Go : apprendre et jouer au go ». */
export function titreEcran(e: EcranTitre): string {
  return e.quoi === 'accueil' ? t('titre.app') : t('titre.ecran', { ecran: nom(e) });
}
