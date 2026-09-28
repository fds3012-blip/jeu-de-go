// Progression (issue #109) : barre de niveau de l'accueil et célébration de niveau franchi.
import { useEffect, useRef, useState } from 'react';
import { abonnerXp, libelleRecompense, lireXp, niveauDe, prochaineRecompense, recompenseDuNiveau } from '../app/xp';
import { mouvementsReduits } from './defilement';
import { fr } from './typo';
import { t } from '../content/i18n';
import { playLevel } from './sound';
import { hapticLevel } from './haptics';
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
        <b>{t('niveau.barre', { niveau })}</b>
        <span>{t('niveau.xp', { dans, besoin })}</span>
      </p>
      <div className="niveau-piste" role="progressbar" aria-label={t('niveau.aria', { niveau })} aria-valuemin={0} aria-valuemax={besoin} aria-valuenow={dans}
        aria-valuetext={t('niveau.valeur', { dans, besoin, suivant: niveau + 1 })}>
        <span className="niveau-plein" style={{ width: `${part}%` }} />
        <span className="niveau-pierre" style={{ left: `${part}%` }} />
      </div>
      {suivante && <p className="niveau-suite">{fr(t('niveau.suite', { niveau: suivante.niveau, recompense: libelleRecompense(suivante) }))}</p>}
    </div>
  );
}

const DUREE_MS = 3200;

/**
 * Célébration d'un niveau franchi. Les gains n'arrivent qu'à la fin d'une action (problème réussi, leçon ou partie
 * terminée) : la célébration tombe donc sur ce moment de fin (règle peak-end), jamais au milieu d'un coup.
 * Sans célébrations ou avec les mouvements réduits : la même annonce, immobile.
 */
export function FeteNiveau({ celebrer, ecran }: { celebrer: boolean; ecran?: string }) {
  const [niveau, setNiveau] = useState<number | null>(null);
  const minuterie = useRef<number | undefined>(undefined);
  // Changement d'écran (« Retour au chemin », autre onglet) : la carte se ferme, elle ne couvre pas le titre du nouvel
  // écran (recette du 28/09, R6). Le premier rendu ne compte pas.
  const ecranVu = useRef(ecran);
  useEffect(() => {
    if (ecranVu.current === ecran) return;
    ecranVu.current = ecran;
    window.clearTimeout(minuterie.current);
    setNiveau(null);
  }, [ecran]);
  const avecSon = useRef(celebrer);
  avecSon.current = celebrer;
  useEffect(() => abonnerXp(g => {
    if (g.niveauApres <= g.niveauAvant) return;
    setNiveau(g.niveauApres);
    // #165 : lames de bois montantes, après le son de la réussite qui a fait gagner l'XP (pas par-dessus).
    if (avecSon.current) window.setTimeout(() => { playLevel(); hapticLevel(); }, 350);
    window.clearTimeout(minuterie.current);
    minuterie.current = window.setTimeout(() => setNiveau(null), DUREE_MS);
  }), []);
  useEffect(() => () => window.clearTimeout(minuterie.current), []);
  if (niveau === null) return null;
  const anime = celebrer && !mouvementsReduits();
  const recompense = recompenseDuNiveau(niveau);
  return (
    <div className={`fete-niveau${anime ? ' anime' : ''}`} role="status" data-testid="fete-niveau">
      <button type="button" onClick={() => setNiveau(null)} aria-label={t('niveau.feteAria', { niveau })}>
        <span className="fete-pierre" aria-hidden="true"><b>{niveau}</b></span>
        <span className="fete-texte">
          <b>{fr(t('niveau.fete', { niveau }))}</b>
          <small>{fr(recompense ? t('niveau.debloque', { recompense: libelleRecompense(recompense) }) : t('niveau.bravo'))}</small>
        </span>
      </button>
    </div>
  );
}
