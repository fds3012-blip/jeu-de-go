// Langage commun des lecteurs de leçon et de problème (issue #40, phase 6) :
// barre du haut (retour, progression), feuille de verdict en bas (jade : juste, hanko : à revoir), coche qui se dessine.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../content/i18n';
import { etatsPoints } from '../app/lecon';
import { mouvementsReduits } from './defilement';
import { PortraitMochi, type HumeurMochi } from './Portrait';
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

/**
 * Points d'étapes (recette du 30/09, R2) : un point par étape, jade quand elle est faite, cerclé pour celle en cours.
 * Aucun chiffre à l'écran ; le lecteur d'écran, lui, entend « 2 étapes faites sur 6 ».
 */
export function Etapes({ total, faites, label }: { total: number; faites: number; label?: string }) {
  return (
    <div className="etapes" role="progressbar" aria-label={label ?? t('lecteur.progression')} aria-valuemin={0} aria-valuemax={total} aria-valuenow={faites}
      aria-valuetext={t('lecteur.etapes', { n: faites, total })}>
      {etatsPoints(total, faites).map((e, i) => <span key={i} className={e === 'avenir' ? undefined : e} />)}
    </div>
  );
}

/**
 * Mochi parle sous le plateau (audit du 02/10, n° 1) : même grammaire que le lecteur de leçon (#377). Le plateau en haut,
 * la consigne juste dessous, près du pouce ; la zone prend la hauteur libre, et la feuille de verdict arrive à sa place.
 * La classe `bubble` reste sur la bulle : c'est elle que les parcours et le lecteur d'écran connaissent.
 */
export function ParoleMochi({ humeur = 'neutre', children }: { humeur?: HumeurMochi; children: ReactNode }) {
  return (
    <div className="lecteur-mochi">
      <PortraitMochi humeur={humeur} taille={72} decoratif className="lecteur-mochi-portrait" />
      <div className="bubble lecteur-bulle"><p>{children}</p></div>
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
  const reponse = `${ton}|${cle ?? ''}`;
  // #290 : écran bas et longue explication. La feuille se replie (deux lignes et « Lire l'explication ») quand le
  // plateau ne tient pas au-dessus d'elle. Mesurée avant l'affichage, à chaque nouvelle réponse.
  const [mesure, setMesure] = useState<{ reponse: string; compact: boolean } | null>(null);
  const [deplie, setDeplie] = useState(false);
  useLayoutEffect(() => {
    setDeplie(false);
    setMesure({ reponse, compact: aReplier(ref.current) });
  }, [reponse]);
  const mesuree = mesure?.reponse === reponse;
  const compact = mesuree && mesure.compact;
  useEffect(() => { if (mesuree) devoilerPlateau(ref.current); }, [mesuree, reponse, compact]);
  // #268 : hauteur de la feuille pour le scroll-padding-bottom de la page (apprendre.css), suivie si elle change.
  useEffect(() => {
    const el = ref.current, racine = document.documentElement;
    if (!el) return;
    const poser = () => racine.style.setProperty('--verdict-h-page', `${el.offsetHeight + 8}px`);
    poser();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(poser);
    ro?.observe(el);
    return () => { ro?.disconnect(); racine.style.removeProperty('--verdict-h-page'); };
  }, []);
  return (
    <div ref={ref} className={`verdict verdict-${ton}`} data-compact={compact && !deplie ? '' : undefined}>
      <div className="verdict-texte" role="status" aria-live="polite">
        {ton !== 'neutre' && <Marque key={cle} juste={ton === 'juste'} />}
        <div>
          {children}
          {compact && (
            // Le texte entier reste dans la zone annoncée : le repli n'est que visuel.
            <button type="button" className="lien verdict-deplier" aria-expanded={deplie}
              onClick={() => { setDeplie(!deplie); if (deplie) window.requestAnimationFrame(() => devoilerPlateau(ref.current)); }}>
              {t(deplie ? 'lecteur.replierExplication' : 'lecteur.lireExplication')}
            </button>
          )}
        </div>
      </div>
      {actions && <div className="verdict-actions">{actions}</div>}
    </div>
  );
}

/** Marge gardée entre le plateau et le haut de l'écran, et entre le plateau et la feuille. */
const MARGE = 8;

/** Haut de la feuille une fois posée (l'animation d'entrée la décale encore de quelques pixels). */
function hautDeLaFeuille(verdict: HTMLDivElement): number {
  return window.innerHeight - (parseFloat(getComputedStyle(verdict).bottom) || 0) - verdict.offsetHeight;
}

/**
 * #290 : faut-il replier l'explication ? Oui quand le plateau entier ne tient pas entre le haut de l'écran et la
 * feuille, et que le texte fait plus de trois lignes (un verdict court n'a rien à replier).
 */
function aReplier(verdict: HTMLDivElement | null): boolean {
  const plateau = verdict?.closest<HTMLElement>('.lecteur')?.querySelector<HTMLElement>('.board-wrap');
  const texte = verdict?.querySelector<HTMLElement>('.verdict-texte > div > p');
  if (!verdict || !plateau || !texte) return false;
  const ligne = parseFloat(getComputedStyle(texte).lineHeight) || 22;
  if (texte.offsetHeight <= ligne * 3.5) return false;
  return plateau.offsetHeight + 2 * MARGE > hautDeLaFeuille(verdict);
}

/**
 * Petits écrans (#250, M5) : la feuille de verdict monte sur le bas du plateau et cachait le coup joué, au moment
 * de la récompense. La page réserve la hauteur de la feuille et défile juste assez pour poser le bas du plateau
 * au-dessus d'elle, sans faire sortir le haut du plateau. Rien ne bouge quand le plateau est déjà visible (390 × 844).
 *
 * #290 : ce défilement s'arrête au haut du plateau. Quand la feuille est trop haute pour laisser voir le plateau entier
 * (320 × 640, explication de 7 lignes : 167 px de place pour 288 px de plateau), le bas restait caché, et avec lui le
 * coup gagnant. La feuille se replie d'abord (aReplier) ; si le plateau entier ne tient toujours pas, on cadre la zone
 * des pierres (plus une demi-ligne) : le haut vide du plateau peut sortir de l'écran, pas le coup joué ni les yeux.
 */
function devoilerPlateau(verdict: HTMLDivElement | null) {
  const lecteur = verdict?.closest<HTMLElement>('.lecteur');
  const plateau = lecteur?.querySelector<HTMLElement>('.board-wrap');
  if (!verdict || !lecteur || !plateau) return;
  lecteur.style.setProperty('--verdict-h', `${verdict.offsetHeight + 16}px`);
  const haut = hautDeLaFeuille(verdict);
  const p = plateau.getBoundingClientRect();
  let zone = { top: p.top, bottom: p.bottom };
  if (p.height + 2 * MARGE > haut) {
    const pierres = [...plateau.querySelectorAll('g[data-pierre]')].map(g => g.getBoundingClientRect()).filter(r => r.height > 0);
    if (pierres.length) {
      const demiLigne = pierres[0].height / 2;
      zone = {
        top: Math.max(p.top, Math.min(...pierres.map(r => r.top)) - demiLigne),
        bottom: Math.min(p.bottom, Math.max(...pierres.map(r => r.bottom)) + demiLigne),
      };
    }
  }
  const manque = zone.bottom - haut + MARGE;
  if (manque <= 0) return;
  const pas = Math.min(manque, Math.max(0, zone.top - MARGE));
  if (pas > 0) window.scrollBy({ top: pas, behavior: mouvementsReduits() ? 'instant' : 'smooth' });
}
