// Série sur la feuille de réussite du Go du jour (issue #214).
// Chaque jour : « 3 jours de série · À demain », une ligne sous l'XP. Aux jalons 3, 7 et 30 : une vraie petite fête,
// dans la feuille (jamais sur la consigne, #236) : la flamme s'allume, un carillon, et des confettis à 7 et 30.
// Mouvements réduits : l'état final directement, sans animation ni confettis. Réglage « Célébrations » coupé : pareil,
// et sans carillon.
import { useEffect, useRef, useState } from 'react';
import { t } from '../content/i18n';
import type { Jalon } from '../app/jalonsSerie';
import { Confettis } from './Confettis';
import { mouvementsReduits } from './defilement';
import { playBadge } from './sound';
import { hapticBadge } from './haptics';
import { fr } from './typo';
import './serie-du-jour.css';

/** Flamme de série, en or (même dessin que la flamme de l'accueil et de l'onglet Problèmes). */
export function FlammeSerie({ taille = 18 }: { taille?: number }) {
  return (
    <svg className="flamme-serie" viewBox="0 0 16 16" width={taille} height={taille} aria-hidden="true" focusable="false">
      <path d="M8.6 1.2c.4 2.3 3.9 3.9 3.9 7.9A4.5 4.5 0 0 1 8 13.8a4.5 4.5 0 0 1-4.5-4.6c0-2 1-3.2 2-4 0 1.4.6 2.4 1.5 2.7C6.6 5.6 7.4 3 8.6 1.2Z" fill="currentColor" />
    </svg>
  );
}

/** Délai du carillon : il suit les deux notes de la réussite au lieu de les couvrir. */
const CARILLON_MS = 450;

export function SerieDuJour({ jours, jalon, celebrer }: { jours: number; jalon: Jalon | null; celebrer: boolean }) {
  // Figé au montage : la fête se joue une fois, même si la feuille se re-rend.
  const [anime] = useState(() => jalon !== null && celebrer && !mouvementsReduits());
  const [gerbe, setGerbe] = useState<{ x: number; y: number } | null>(null);
  const flamme = useRef<HTMLSpanElement>(null);
  const joue = useRef(false);

  useEffect(() => {
    if (jalon === null || !celebrer || joue.current) return;
    joue.current = true;
    const id = window.setTimeout(() => { playBadge(); hapticBadge(); }, CARILLON_MS);
    // Confettis pour la semaine et le mois ; le jalon 3 garde une fête plus sobre.
    if (anime && jalon >= 7 && flamme.current) {
      const b = flamme.current.getBoundingClientRect();
      setGerbe({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
    }
    return () => window.clearTimeout(id);
  }, [jalon, celebrer, anime]);

  if (jours < 1) return null;

  if (jalon === null) {
    return (
      <p className="serie-du-jour" data-testid="serie-du-jour">
        <FlammeSerie />
        <b>{t('serie.duJour.jours', { n: jours })}</b>
        <span className="serie-du-jour-demain">{t('serie.duJour.aDemain')}</span>
      </p>
    );
  }

  return (
    <div className={`jalon${anime ? ' anime' : ''}`} data-testid="serie-du-jour" data-jalon={jalon}>
      <span className="jalon-flamme" ref={flamme} aria-hidden="true">
        <FlammeSerie taille={52} />
        <b>{jalon}</b>
      </span>
      <span className="jalon-texte">
        <b className="jalon-titre">{fr(t('serie.jalon.titre', { n: jalon }))}</b>
        <span>{fr(t(`serie.jalon.${jalon}`))}</span>
      </span>
      {gerbe && <Confettis origine={gerbe} duree={1300} onFin={() => setGerbe(null)} />}
    </div>
  );
}
