// #591 : la ligne « Ouvertures » d'Apprendre, discrète (l'action en relief reste la prochaine leçon). Elle ouvre le
// répertoire d'ouvertures (src/app/Ouvertures.tsx), chargé à la demande.
import { tentree } from '../content/i18n/ouverturesEntree';
import { fr } from './typo';
import './entree-ouvertures.css';

export function EntreeOuvertures({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="entree-ouvertures" data-testid="entree-ouvertures" onClick={() => { window.scrollTo({ top: 0 }); onOpen(); }}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <path d="M4 4h16v16H4zM4 12h16M12 4v16" className="eo-lignes" />
        <circle cx="8" cy="16" r="2.6" className="eo-noire" /><circle cx="16" cy="8" r="2.6" className="eo-blanche" />
      </svg>
      <span><b>{tentree('titre')}</b><small>{fr(tentree('texte'))}</small></span>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" className="eo-chevron"><path d="m9 5 7 7-7 7" /></svg>
    </button>
  );
}
