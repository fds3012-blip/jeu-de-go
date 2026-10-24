// #U8 : la victoire qui ouvre un nouvel adversaire le montre. Son portrait se dévoile (un voile grisé et un cadenas
// s'effacent), une phrase de son caractère, un seul bouton. Mouvements réduits ou célébrations coupées : l'état final,
// sans son. On n'anime que `opacity` et `transform`.
import { useEffect, useRef, useState } from 'react';
import { Portrait, type PortraitId } from './Portrait';
import { Sceau } from './Sceau';
import { mouvementsReduits } from './defilement';
import { hapticBadge } from './haptics';
import { fr } from './typo';
import { t } from '../content/i18n/secondaires';
import './adversaire-ouvert.css';

export interface Ouvre {
  id: PortraitId;
  nom: string;
  /** Libellé du bouton (« Défier Bambou »). */
  libelle: string;
  /** Lance la partie contre lui. */
  lancer: () => void;
}

const jouerBadge = () => { void import('./sound').then(m => m.playBadge()).catch(() => undefined); };

export function AdversaireOuvert({ ouvre, celebrer, onPlusTard }: { ouvre: Ouvre; celebrer: boolean; onPlusTard: () => void }) {
  const bouton = useRef<HTMLButtonElement>(null);
  // Figé au montage : l'animation se joue une fois.
  const [anime] = useState(() => celebrer && !mouvementsReduits());
  useEffect(() => {
    bouton.current?.focus({ preventScroll: true });
    if (!celebrer) return;
    const son = window.setTimeout(() => { jouerBadge(); hapticBadge(); }, 320);
    return () => window.clearTimeout(son);
  }, [celebrer]);
  return (
    <section className={`adversaire-ouvert${anime ? ' anime' : ''}`} role="dialog" aria-modal="true" aria-labelledby="adversaire-ouvert-titre" data-testid="adversaire-ouvert">
      <div className="ouvert-cadre">
        <Portrait id={ouvre.id} taille={160} decoratif />
        <span className="ouvert-voile" aria-hidden="true" />
        <span className="ouvert-cadenas" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="100%" height="100%" focusable="false">
            <path d="M5 7V5.2a3 3 0 0 1 6 0V7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <rect x="3.2" y="7" width="9.6" height="7" rx="1.8" fill="currentColor" />
          </svg>
        </span>
      </div>
      <h2 id="adversaire-ouvert-titre">{fr(t('fin.ouvert', { nom: ouvre.nom }))}</h2>
      <p>{fr(t(`adv.${ouvre.id}.phrase`))}</p>
      <button ref={bouton} type="button" className="cta" onClick={ouvre.lancer}><Sceau id={ouvre.id} taille={30} />{ouvre.libelle}</button>
      <button type="button" className="lien lien-discret" onClick={onPlusTard}>{t('fin.ouvertPlusTard')}</button>
    </section>
  );
}
