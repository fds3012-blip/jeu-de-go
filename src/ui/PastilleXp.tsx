// Issue #162 : l'XP gagnée se voit. Une pastille or « +N XP » à chaque fin (problème réussi, leçon terminée,
// fin de partie), avec la part du bonus « première fois ».
import { useEffect, useRef, useState } from 'react';
import { abonnerXp } from '../app/xp';
import { cumuler, DUREE_XP_MS, SORTIE_XP_MS, texteXp, type Affiche } from './gainXp';
import { mouvementsReduits } from './defilement';
import { t } from '../content/i18n';
import './pastille-xp.css';

/**
 * Pastille or réutilisable (écran de fin, liste…). Purement visuelle : l'annonce vocale est portée par le parent
 * (`role="status"` d'`AnnonceXp`) ou par le texte lui-même si on la pose dans un écran.
 * `anime` : entrée courte (glisse de 6 px et fondu). Jamais d'animation avec les mouvements réduits.
 */
export function PastilleXp({ points, bonus = 0, anime = false }: { points: number; bonus?: number; anime?: boolean }) {
  return (
    <span className={`pastille-xp${anime && !mouvementsReduits() ? ' anime' : ''}`} data-testid="pastille-xp">
      <b>{texteXp(points)}</b>
      {bonus > 0 && <small>{t('xp.bonus', { bonus })}</small>}
    </span>
  );
}

/**
 * Annonce globale des gains, montée une seule fois dans l'application : chaque appel à `gagnerXp` (fin de problème,
 * de leçon, de partie) l'affiche en haut de l'écran, sans toucher aux écrans. Elle ne capte aucun toucher
 * (`pointer-events: none`) : l'action principale de fin reste libre. Si un niveau est franchi, elle se place sous
 * la carte de célébration (`FeteNiveau`).
 */
export function AnnonceXp({ celebrer }: { celebrer: boolean }) {
  const [affiche, setAffiche] = useState<Affiche | null>(null);
  const [sortie, setSortie] = useState(false);
  const minuterie = useRef<number | undefined>(undefined);
  useEffect(() => abonnerXp(g => {
    setAffiche(a => cumuler(a, g));
    setSortie(false);
    window.clearTimeout(minuterie.current);
    const reduit = !celebrer || mouvementsReduits();
    minuterie.current = window.setTimeout(() => {
      if (reduit) { setAffiche(null); return; }
      setSortie(true);
      minuterie.current = window.setTimeout(() => { setAffiche(null); setSortie(false); }, SORTIE_XP_MS);
    }, DUREE_XP_MS);
  }), [celebrer]);
  useEffect(() => () => window.clearTimeout(minuterie.current), []);
  return (
    <div className={`annonce-xp${affiche?.niveauFranchi ? ' sous-fete' : ''}${sortie ? ' sortie' : ''}`} role="status" aria-live="polite">
      {affiche && (
        <PastilleXp key={affiche.points} points={affiche.points} bonus={affiche.bonus} anime={celebrer} />
      )}
    </div>
  );
}
