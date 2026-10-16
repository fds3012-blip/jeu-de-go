// Ligne « Titre du mois dernier » du Profil (#561) : le sceau du titre, son nom et le mois. Seulement avec un titre
// le mois dernier : sous le garde-fou des 200 joueurs actifs, le serveur n'écrit rien, donc la ligne n'existe pas.
// Pas d'action : un joueur voit SON titre ; aucun classement nominatif.
import { useEffect, useState } from 'react';
import { titreDuMoisDernier, POURCENT, type TitreDuMois } from '../app/titres';
import { chargerMesTitres } from '../data/titres';
import type { Db } from '../data/supabase';
import { nomMois, nomTitre, ttitre } from '../content/i18n/titres';
import { SceauTitre } from './SceauTitre';
import { fr } from './typo';
import './titres.css';

export function LigneTitre({ db, userId }: { db: Db; userId: string }) {
  const [titre, setTitre] = useState<TitreDuMois | null>(null);
  useEffect(() => {
    let vivant = true;
    void chargerMesTitres(db, userId).then(t => { if (vivant) setTitre(titreDuMoisDernier(t)); });
    return () => { vivant = false; };
  }, [db, userId]);
  if (!titre) return null;
  const nom = nomTitre(titre.titre), mois = nomMois(titre.mois);
  return (
    <div className="ligne ligne-titre" data-testid="ligne-titre" data-titre={titre.titre} role="group"
      aria-label={fr(ttitre('titres.aria', { titre: nom, mois, pourcent: POURCENT[titre.titre] }))}>
      <SceauTitre titre={titre.titre} />
      <span className="ligne-texte" aria-hidden="true">
        <span className="ligne-libelle">{ttitre('titres.ligne')}</span>
        <span className="ligne-titre-valeur">{ttitre('titres.valeur', { titre: nom, mois })}</span>
      </span>
    </div>
  );
}
