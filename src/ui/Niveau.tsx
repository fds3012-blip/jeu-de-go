// Progression (issue #109) : célébration de niveau franchi. #613 : la barre de niveau, qui ne sert plus que dans le
// Profil, est dans src/ui/BarreNiveau.tsx (hors du JS initial).
import { useEffect, useRef } from 'react';
import { libelleRecompense, recompenseDuNiveau } from '../app/xp';
import { mouvementsReduits } from './defilement';
import { terminerFete, useFile } from './celebrations';
import { fr } from './typo';
import { t } from '../content/i18n';
import { hapticLevel } from './haptics';
import './niveau.css';

// #563 : la synthèse des sons (src/ui/sound.ts) n'est pas dans le JS initial ; elle est d'ordinaire déjà chargée
// (partie, leçon, problèmes) quand un niveau est atteint.
const jouerNiveau = () => { void import('./sound').then(m => m.playLevel()).catch(() => undefined); };

const DUREE_MS = 3200;

/**
 * Célébration d'un niveau franchi. Les gains n'arrivent qu'à la fin d'une action (problème réussi, leçon ou partie
 * terminée) : la célébration tombe donc sur ce moment de fin (règle peak-end), jamais au milieu d'un coup.
 * Sans célébrations ou avec les mouvements réduits : la même annonce, immobile.
 */
export function FeteNiveau({ celebrer, ecran }: { celebrer: boolean; ecran?: string }) {
  // Issue #236 (N2) : la carte passe par la file des célébrations. Elle attend la fin de l'exercice (problème, leçon,
  // partie) et vient après la pastille d'XP, jamais en même temps.
  const file = useFile();
  const niveau = file.actif?.genre === 'niveau' ? file.actif.niveau : null;
  // Changement d'écran pendant la fête (« Retour à Apprendre », autre onglet) : la carte se ferme, elle ne couvre pas
  // le titre du nouvel écran (recette du 28/09, R6). Le premier rendu ne compte pas.
  const ecranVu = useRef(ecran);
  useEffect(() => {
    if (ecranVu.current === ecran) return;
    ecranVu.current = ecran;
    terminerFete('niveau');
  }, [ecran]);
  const avecSon = useRef(celebrer);
  avecSon.current = celebrer;
  useEffect(() => {
    if (niveau === null) return;
    // #165 : lames de bois montantes, quand la carte arrive.
    const son = avecSon.current ? window.setTimeout(() => { jouerNiveau(); hapticLevel(); }, 120) : undefined;
    const fin = window.setTimeout(() => terminerFete('niveau'), DUREE_MS);
    return () => { window.clearTimeout(son); window.clearTimeout(fin); };
  }, [niveau]);
  if (niveau === null) return null;
  const anime = celebrer && !mouvementsReduits();
  const recompense = recompenseDuNiveau(niveau);
  return (
    <div className={`fete-niveau${anime ? ' anime' : ''}`} role="status" data-testid="fete-niveau">
      <button type="button" onClick={() => terminerFete('niveau')}aria-label={t('niveau.feteAria', { niveau })}>
        <span className="fete-pierre" aria-hidden="true"><b>{niveau}</b></span>
        <span className="fete-texte">
          <b>{fr(t('niveau.fete', { niveau }))}</b>
          <small>{fr(recompense ? t('niveau.debloque', { recompense: libelleRecompense(recompense) }) : t('niveau.bravo'))}</small>
        </span>
      </button>
    </div>
  );
}

/**
 * Le niveau a son moment à lui (#236, N2) : après la feuille « Bravo » de la série d'entraînement, un écran seul,
 * « Niveau 2 ! » en grand, sans consigne ni pastille autour. Une seule action : continuer vers le chemin.
 * Avec les mouvements réduits ou sans célébrations : le même écran, immobile et sans son.
 */
export function NiveauAtteint({ niveau, celebrer, action, onAction }: { niveau: number; celebrer: boolean; action: string; onAction: () => void }) {
  const bouton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    bouton.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
    if (!celebrer) return;
    const son = window.setTimeout(() => { jouerNiveau(); hapticLevel(); }, 120);
    return () => window.clearTimeout(son);
  }, [celebrer]);
  const anime = celebrer && !mouvementsReduits();
  const recompense = recompenseDuNiveau(niveau);
  return (
    <section className={`niveau-atteint${anime ? ' anime' : ''}`} data-testid="niveau-atteint" aria-labelledby="niveau-atteint-titre">
      <span className="niveau-atteint-pierre" aria-hidden="true"><b>{niveau}</b></span>
      <h2 id="niveau-atteint-titre">{fr(t('niveau.fete', { niveau }))}</h2>
      <p>{fr(recompense ? t('niveau.debloque', { recompense: libelleRecompense(recompense) }) : t('niveau.bravo'))}</p>
      <button ref={bouton} type="button" className="cta" onClick={onAction}>{action}</button>
    </section>
  );
}
