// « Titre du mois dernier » au Profil (#561) : le sceau du titre, son nom et le mois. Seulement avec un titre le mois
// dernier : sous le garde-fou des 200 joueurs actifs, le serveur n'écrit rien, donc rien ne s'affiche.
// #654 : le Profil est un sommaire (A13) ; le titre devient le visuel et l'état de l'entrée « Ta cote », qu'il ouvre.
// Un joueur voit SON titre ; aucun classement nominatif.
import { POURCENT, type TitreDuMois } from '../app/titres';
import { nomMois, nomTitre, ttitre } from '../content/i18n/titres';
import { SceauTitre } from './SceauTitre';
import { fr } from './typo';
import './titres.css';

/** Le sceau du titre, à la place de l'icône de « Ta cote ». */
export const VisuelTitre = ({ titre }: { titre: TitreDuMois }) => <SceauTitre titre={titre.titre} taille={32} />;

/** État court de l'entrée (le nom du titre) et sa lecture complète (« Titre du mois dernier : … , septembre, … »). */
export function etatTitre(titre: TitreDuMois): { texte: string; aria: string } {
  const nom = nomTitre(titre.titre), mois = nomMois(titre.mois);
  return { texte: nom, aria: fr(`${ttitre('titres.ligne')} ${nom}, ${mois}. ${ttitre('titres.detail', { pourcent: POURCENT[titre.titre] })}`) };
}
