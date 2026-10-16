// « Titre du mois dernier » au Profil (#561) : le sceau du titre, son nom et le mois. Seulement avec un titre le mois
// dernier : sous le garde-fou des 200 joueurs actifs, le serveur n'écrit rien, donc la ligne n'existe pas.
// Le Profil tient sans défiler en 390 × 844 : le titre est une demi-ligne, qui partage la ligne de « Ta cote » (à la place
// de « Placement » : un joueur titré a au moins 10 parties classées, l'estimation du placement n'a plus d'objet). Le
// toucher ouvre « Ta cote ». Un joueur voit SON titre ; aucun classement nominatif.
import { POURCENT, type TitreDuMois } from '../app/titres';
import { nomMois, nomTitre, ttitre } from '../content/i18n/titres';
import { SceauTitre } from './SceauTitre';
import { fr } from './typo';
import './titres.css';

export function DemiLigneTitre({ titre, onClick }: { titre: TitreDuMois; onClick: () => void }) {
  const nom = nomTitre(titre.titre), mois = nomMois(titre.mois);
  return (
    <button type="button" className="ligne-demi ligne-titre" data-testid="ligne-titre" data-titre={titre.titre} onClick={onClick}>
      <SceauTitre titre={titre.titre} taille={28} />
      {/* Libellé et valeur courts (le nom du titre, le mois) : la demi-ligne garde ses 48 px. « Titre du mois dernier »
          ouvre le nom accessible ; la part des joueurs actifs le termine. */}
      <span className="ligne-demi-texte">
        <span className="sr-only">{`${fr(ttitre('titres.ligne'))} `}</span>
        <span className="ligne-libelle">{nom}</span>
        <span className="ligne-demi-valeur">{mois.charAt(0).toUpperCase() + mois.slice(1)}</span>
        <span className="sr-only">{fr(` ${ttitre('titres.detail', { pourcent: POURCENT[titre.titre] })}`)}</span>
      </span>
    </button>
  );
}
