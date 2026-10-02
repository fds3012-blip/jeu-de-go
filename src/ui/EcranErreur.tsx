/**
 * Écran d'erreur (robustesse, #325 point 4) : montré à la place d'un écran blanc quand un écran ne se charge pas ou
 * qu'un bogue casse le rendu. Mochi rassure, une phrase explique sans jargon, une seule action principale
 * (« Réessayer ») et un lien de retour à l'accueil. FR/EN, clair/sombre (src/ui/robustesse.css).
 */
import { t } from '../content/i18n';
import { cleExplication, type CategorieErreur } from '../app/robustesse';
import { Mochi } from './Mochi';

export interface PropsEcranErreur {
  categorie: CategorieErreur;
  horsLigne: boolean;
  onReessayer: () => void;
  onAccueil?: () => void;
}

export function EcranErreur({ categorie, horsLigne, onReessayer, onAccueil }: PropsEcranErreur) {
  return (
    <section className="ecran-erreur" role="alert" aria-label={t('erreur.aria')} data-testid="ecran-erreur" data-categorie={categorie}>
      <div className="ecran-erreur-mochi" aria-hidden="true"><Mochi size={72} /></div>
      <h2 className="ecran-erreur-titre">{t('erreur.titre')}</h2>
      <p className="ecran-erreur-texte">{t(cleExplication(categorie, horsLigne))}</p>
      <p className="ecran-erreur-mot muted">{t('erreur.mochi')}</p>
      <div className="ecran-erreur-actions">
        <button type="button" className="btn primary" onClick={onReessayer}>{t('erreur.reessayer')}</button>
        {onAccueil && <button type="button" className="lien" onClick={onAccueil}>{t('erreur.accueil')}</button>}
      </div>
    </section>
  );
}
