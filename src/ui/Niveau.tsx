// Progression (issue #109) : barre de niveau de l'accueil et célébration de niveau franchi.
import { useEffect, useRef, useState } from 'react';
import { abonnerXp, libelleRecompense, lireXp, niveauDe, prochaineRecompense, recompenseDuNiveau } from '../app/xp';
import { mouvementsReduits } from './defilement';
import { fr } from './typo';
import './niveau.css';

/** XP de l'appareil, mis à jour à chaque gain. */
function useXp(): number {
  const [xp, setXp] = useState(lireXp);
  useEffect(() => abonnerXp(g => setXp(g.apres)), []);
  return xp;
}

/** Barre compacte : « Niveau 3 · 140 / 155 XP », une pierre qui avance sur une ligne du goban. */
export function BarreNiveau() {
  const xp = useXp();
  const { niveau, dans, besoin } = niveauDe(xp);
  const part = Math.min(100, (dans / besoin) * 100);
  const suivante = prochaineRecompense(niveau);
  return (
    <div className="niveau" data-testid="barre-niveau">
      <p className="niveau-texte">
        <b>{`Niveau\u00A0${niveau}`}</b>
        <span>{`${dans}\u00A0/\u00A0${besoin}\u00A0XP`}</span>
      </p>
      <div className="niveau-piste" role="progressbar" aria-label={`Niveau ${niveau}`} aria-valuemin={0} aria-valuemax={besoin} aria-valuenow={dans}
        aria-valuetext={`${dans} XP sur ${besoin} avant le niveau ${niveau + 1}`}>
        <span className="niveau-plein" style={{ width: `${part}%` }} />
        <span className="niveau-pierre" style={{ left: `${part}%` }} />
      </div>
      {suivante && <p className="niveau-suite">{fr(`Niveau ${suivante.niveau} : ${libelleRecompense(suivante)}`)}</p>}
    </div>
  );
}

const DUREE_MS = 3200;

/**
 * Célébration d'un niveau franchi. Les gains n'arrivent qu'à la fin d'une action (problème réussi, leçon ou partie
 * terminée) : la célébration tombe donc sur ce moment de fin (règle peak-end), jamais au milieu d'un coup.
 * Sans célébrations ou avec les mouvements réduits : la même annonce, immobile.
 */
export function FeteNiveau({ celebrer }: { celebrer: boolean }) {
  const [niveau, setNiveau] = useState<number | null>(null);
  const minuterie = useRef<number | undefined>(undefined);
  useEffect(() => abonnerXp(g => {
    if (g.niveauApres <= g.niveauAvant) return;
    setNiveau(g.niveauApres);
    window.clearTimeout(minuterie.current);
    minuterie.current = window.setTimeout(() => setNiveau(null), DUREE_MS);
  }), []);
  useEffect(() => () => window.clearTimeout(minuterie.current), []);
  if (niveau === null) return null;
  const anime = celebrer && !mouvementsReduits();
  const recompense = recompenseDuNiveau(niveau);
  return (
    <div className={`fete-niveau${anime ? ' anime' : ''}`} role="status" data-testid="fete-niveau">
      <button type="button" onClick={() => setNiveau(null)} aria-label={`Niveau ${niveau} atteint. Fermer`}>
        <span className="fete-pierre" aria-hidden="true"><b>{niveau}</b></span>
        <span className="fete-texte">
          <b>{fr(`Niveau ${niveau} !`)}</b>
          <small>{fr(recompense ? `Tu débloques ${libelleRecompense(recompense)}.` : 'Bravo, tu progresses.')}</small>
        </span>
      </button>
    </div>
  );
}
