// Partager l'app (#521) : le partage et son retour, communs au Profil et à l'invitation des moments forts (PartagerApp).
// Fichier à part (#669) : un fichier de composants n'exporte que des composants (rafraîchissement à chaud de Vite).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { partagerApp, type EtatPartageApp as Etat } from '../app/envoiApp';
import { langue } from '../content/i18n';
import { tp } from '../content/i18n/partage';
import { lienApp, type DepuisPartage } from '../app/partageApp';
import { fr } from './typo';

/** Partage et son état (« Lien copié » 2 s, ou lien à copier à la main) ; `retour` : la zone à poser sous le bouton. */
export function usePartage(depuis: DepuisPartage): { etat: Etat; lancer: () => Promise<void>; retour: ReactNode } {
  const [etat, setEtat] = useState<Etat>('');
  const encours = useRef(false);
  useEffect(() => {
    if (etat !== 'copie') return;
    const id = window.setTimeout(() => setEtat(''), 2000);
    return () => window.clearTimeout(id);
  }, [etat]);
  const lancer = async () => {
    if (encours.current) return;
    encours.current = true;
    try { setEtat(await partagerApp(depuis)); } finally { encours.current = false; }
  };
  // Zone lue par le lecteur d'écran (toujours présente : seul son texte change), et le lien si la copie a échoué.
  const retour = (
    <>
      <p className="sr-only" role="status" aria-live="polite">{etat === 'copie' ? fr(tp('app.copieAnnonce')) : ''}</p>
      {etat === 'manuel' && (
        <div className="partager-app-manuel" role="alert">
          <p>{fr(tp('app.copierManuel'))}</p>
          <input readOnly value={lienApp(langue())} aria-label={tp('app.lienAria')} onFocus={e => e.currentTarget.select()} />
        </div>
      )}
    </>
  );
  return { etat, lancer, retour };
}

/**
 * « Partager Mochi Go » du Profil (#521) : depuis #654, une entrée de la rubrique « Aide » du sommaire (A13). Une action
 * directe : feuille du téléphone, sinon « Lien copié » 2 s. `retour` : la zone lue par le lecteur d'écran (toujours
 * présente) et le lien à copier à la main si la copie a échoué ; à poser sous la liste.
 */
export function usePartageProfil(): { copie: boolean; lancer: () => void; retour: ReactNode } {
  const { etat, lancer, retour } = usePartage('profil');
  return { copie: etat === 'copie', lancer: () => void lancer(), retour };
}
