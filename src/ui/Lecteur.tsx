// Langage commun des lecteurs de leçon et de problème (issue #40, phase 6) :
// barre du haut (retour, progression), feuille de verdict en bas (jade : juste, hanko : à revoir), coche qui se dessine.
import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '../content/i18n';
import { mouvementsReduits } from './defilement';
import './apprendre.css';

/** Bouton retour, rond, en haut à gauche. Le libellé dit où il mène. */
export function Retour({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="retour" aria-label={label} onClick={onClick}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** Barre de progression des étapes : un segment par étape, rempli quand l'étape est faite. */
export function Etapes({ total, faites }: { total: number; faites: number }) {
  return (
    <div className="etapes" role="progressbar" aria-label={t('lecteur.progression')} aria-valuemin={0} aria-valuemax={total} aria-valuenow={faites}
      aria-valuetext={t('lecteur.etapes', { n: faites, total })}>
      {Array.from({ length: total }, (_, i) => <span key={i} className={i < faites ? 'faite' : undefined} />)}
    </div>
  );
}

/** Pastille ronde avec une coche (juste) ou une croix (à revoir) qui se dessine. */
export function Marque({ juste, taille = 32 }: { juste: boolean; taille?: number }) {
  return (
    <svg className={`marque ${juste ? 'marque-juste' : 'marque-revoir'}`} viewBox="0 0 32 32" width={taille} height={taille} aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="16" />
      {juste
        ? <path className="trait" pathLength={1} d="M9.5 16.6 14 21l8.5-9.5" />
        : <path className="trait" pathLength={1} d="M11 11l10 10M21 11 11 21" />}
    </svg>
  );
}

/**
 * Feuille de verdict, posée en bas de l'écran au-dessus de la navigation. `ton` : juste (jade), revoir (hanko) ou neutre.
 * `cle` relance l'animation de la marque à chaque nouvelle réponse.
 */
export function Verdict({ ton, children, actions, cle }: { ton: 'juste' | 'revoir' | 'neutre'; children: ReactNode; actions?: ReactNode; cle?: string | number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => devoilerPlateau(ref.current), [ton, cle]);
  return (
    <div ref={ref} className={`verdict verdict-${ton}`}>
      <div className="verdict-texte" role="status" aria-live="polite">
        {ton !== 'neutre' && <Marque key={cle} juste={ton === 'juste'} />}
        <div>{children}</div>
      </div>
      {actions && <div className="verdict-actions">{actions}</div>}
    </div>
  );
}

/**
 * Petits écrans (#250, M5) : la feuille de verdict monte sur le bas du plateau et cachait le coup joué, au moment
 * de la récompense. La page réserve la hauteur de la feuille et défile juste assez pour poser le bas du plateau
 * au-dessus d'elle, sans faire sortir le haut du plateau. Rien ne bouge quand le plateau est déjà visible (390 × 844).
 */
function devoilerPlateau(verdict: HTMLDivElement | null) {
  const lecteur = verdict?.closest<HTMLElement>('.lecteur');
  const plateau = lecteur?.querySelector<HTMLElement>('.board-wrap');
  if (!verdict || !lecteur || !plateau) return;
  const hauteur = verdict.offsetHeight;
  lecteur.style.setProperty('--verdict-h', `${hauteur + 16}px`);
  // Haut de la feuille une fois posée (l'animation d'entrée la décale encore de quelques pixels).
  const haut = window.innerHeight - (parseFloat(getComputedStyle(verdict).bottom) || 0) - hauteur;
  const p = plateau.getBoundingClientRect();
  const manque = p.bottom - haut + 8;
  if (manque <= 0) return;
  const pas = Math.min(manque, Math.max(0, p.top - 8));
  if (pas > 0) window.scrollBy({ top: pas, behavior: mouvementsReduits() ? 'instant' : 'smooth' });
}
