// #591 : la ligne « Ouvertures » d'Apprendre, discrète (l'action en relief reste la prochaine leçon). Elle ouvre le
// répertoire d'ouvertures (src/app/Ouvertures.tsx), chargé à la demande.
// #602 : un lien à la fin du chapitre « L'ouverture », comme les liens de « Les bases » ; la phrase reste dans le nom accessible.
import { tentree } from '../content/i18n/ouverturesEntree';
import { fr } from './typo';

export function EntreeOuvertures({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="chapitre-suite">
      <button type="button" className="lien lien-chapitre" data-testid="entree-ouvertures" aria-label={fr(`${tentree('titre')}. ${tentree('texte')}`)}
        onClick={() => { window.scrollTo({ top: 0 }); onOpen(); }}>
        {tentree('titre')}
      </button>
    </div>
  );
}
