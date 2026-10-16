import { useEffect, useRef } from 'react';
import { setConsent } from '../data/analytics';
import { fr } from '../ui/typo';
import { t } from '../content/i18n';

/**
 * Consentement (issue #50, forme revue en #485) : bandeau bas compact, non modal, au premier lancement.
 * L'accueil reste visible et utilisable dessous (« jouer » n'est jamais caché) ; sans réponse, rien de non essentiel
 * n'est chargé (src/data/analytics.ts). Le focus va au titre à l'ouverture, sans être piégé : Tab ressort vers la page.
 * Échap (focus dans le bandeau) ferme sans choix (`onIgnorer`) : il reviendra au prochain lancement.
 * #563 : la page « Conditions et confidentialité » (« Détails ») est dans src/app/Conditions.tsx, chargée avec le Profil.
 */
export function ConsentModal({ visible, onConditions, onIgnorer }: { visible: boolean; onConditions: () => void; onIgnorer: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (visible && !d.open) {
      d.show?.();
      // Focus sur le titre : lu en premier par les lecteurs d'écran, sans mettre en avant un des deux choix.
      d.querySelector<HTMLElement>('#accord-titre')?.focus({ preventScroll: true });
    }
    if (!visible && d.open) d.close();
  }, [visible]);

  // Hauteur du bandeau en variable CSS : la page garde de quoi défiler au-dessus (profil.css, `--accord-h`).
  useEffect(() => {
    const d = ref.current;
    if (!d || !visible || typeof ResizeObserver === 'undefined') return;
    const racine = document.documentElement;
    const ro = new ResizeObserver(() => racine.style.setProperty('--accord-h', `${Math.ceil(d.offsetHeight)}px`));
    ro.observe(d);
    return () => { ro.disconnect(); racine.style.removeProperty('--accord-h'); };
  }, [visible]);

  return (
    <dialog ref={ref} className="accord" aria-labelledby="accord-titre" aria-describedby="accord-texte"
      // Non modal : le navigateur ne gère pas Échap, on le fait ici. Une fermeture que l'app n'a pas demandée vaut « pas de choix ».
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onIgnorer(); } }} onClose={() => { if (visible) onIgnorer(); }}>
      {/* Contenu toujours rendu : la sortie en fondu garde le texte visible jusqu'au bout. */}
      <div className="accord-corps">
        {/* Titre et texte sur une même ligne de lecture : le bandeau tient en quatre lignes à 320 px. */}
        <div className="accord-message">
          <h2 id="accord-titre" tabIndex={-1}>{fr(t('accord.titre'))}</h2>{' '}
          <p id="accord-texte">{t('accord.texte')} {t('accord.note')}</p>
        </div>
        {/* Deux choix de même taille et de même poids : aucun n'est mis en avant (issue #64, CNIL). */}
        <div className="accord-actions">
          <button type="button" className="lien accord-conditions" onClick={onConditions}>{t('accord.lire')}</button>
          <button type="button" className="btn accord-choix" onClick={() => setConsent('accepte')}>{t('accord.oui')}</button>
          <button type="button" className="btn accord-choix" onClick={() => setConsent('refuse')}>{t('accord.non')}</button>
        </div>
      </div>
    </dialog>
  );
}
