// Issue #162 : l'XP gagnée se voit. Une pastille or « +N XP » à chaque fin (problème réussi, leçon terminée,
// fin de partie), avec la part du bonus « première fois ».
import { useEffect, useState } from 'react';
import { DUREE_XP_MS, SORTIE_XP_MS, texteXp } from './gainXp';
import { marquerXpVue, terminerFete, useFile } from './celebrations';
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
  // Issue #236 (N2) : la pastille passe par la file des célébrations. Pendant un exercice, elle ne se pose jamais sur
  // la consigne : l'XP se lit dans la feuille de réussite (`XpEnLigne`). Ici, seulement après (fin de leçon, de partie).
  const file = useFile();
  const affiche = file.actif?.genre === 'xp' ? file.actif : null;
  const [sortie, setSortie] = useState(false);
  const points = affiche?.points;
  useEffect(() => {
    if (points === undefined) return;
    setSortie(false);
    const reduit = !celebrer || mouvementsReduits();
    let fin: number | undefined;
    const lecture = window.setTimeout(() => {
      if (reduit) { terminerFete('xp'); return; }
      setSortie(true);
      fin = window.setTimeout(() => { setSortie(false); terminerFete('xp'); }, SORTIE_XP_MS);
    }, DUREE_XP_MS);
    return () => { window.clearTimeout(lecture); window.clearTimeout(fin); };
  }, [points, celebrer]);
  return (
    <div className={`annonce-xp${sortie ? ' sortie' : ''}`} role="status" aria-live="polite">
      {affiche && (
        <PastilleXp key={affiche.points} points={affiche.points} bonus={affiche.bonus} anime={celebrer} />
      )}
    </div>
  );
}

/**
 * XP de l'exercice, dans la feuille de réussite (#236, N2) : lue à sa place, sous le « Bravo », sans rien couvrir.
 * Montrée, elle n'est pas répétée à la fin de l'exercice.
 */
export function XpEnLigne({ anime = false }: { anime?: boolean }) {
  const x = useFile().enLigne;
  useEffect(() => { if (x && !x.vue) marquerXpVue(); }, [x]);
  if (!x) return null;
  return <p className="xp-en-ligne"><PastilleXp points={x.points} bonus={x.bonus} anime={anime} /></p>;
}
