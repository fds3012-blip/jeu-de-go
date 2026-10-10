// Bouton « retour » unique de l'app (#509, lot L2, constats 6 et 7) : un rond de 44 px, un chevron de 24 px, encre
// pleine. Le style vit dans `app.css` (`.retour`), une seule fois ; le libellé dit où le bouton mène.
// La barre « ‹ titre » des écrans de tâche (`EnteteEcran`) remplace le logo de l'app : `app.css` le masque à l'écran
// (le h1 « Mochi Go » reste pour les lecteurs d'écran) dès qu'une barre `.ecran-tete` est affichée.
import type { ReactNode } from 'react';

/** Rond de 44 px avec un chevron, en haut à gauche. `label` : nom accessible (« Retour », « Retour au chemin »). */
export function BoutonRetour({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="retour" aria-label={label} onClick={onClick}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/**
 * Barre d'un écran de tâche : retour, titre de l'écran (h2), puis, à droite, un élément facultatif (compteur, aide).
 * Même grammaire que la leçon et la revue. Un titre long passe à la ligne (zoom, anglais) plutôt que d'être coupé.
 */
export function EnteteEcran({ titre, id, retour, onRetour, children }: {
  titre: ReactNode; id?: string; retour: string; onRetour: () => void; children?: ReactNode;
}) {
  return (
    <div className="ecran-tete">
      <BoutonRetour label={retour} onClick={onRetour} />
      <h2 id={id} className="ecran-titre">{titre}</h2>
      {children}
    </div>
  );
}
