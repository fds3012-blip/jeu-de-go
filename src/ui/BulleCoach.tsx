// Bulle du coach Mochi en partie contre l'IA (#470) : même place et même hauteur que la bulle habituelle de Mochi
// (sous le plateau, jamais dessus), la phrase annoncée, et un bouton de 44 px pour couper le coach sans quitter la partie.
import { PortraitMochi } from './Portrait';
import { t } from '../content/i18n/secondaires';
import { fr } from './typo';
import './conseil.css';

/** Bulle barrée : « Mochi se tait ». */
function IconeCouper() {
  return (
    <svg className="icone-trait" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M5 6.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-8l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 16V8A1.5 1.5 0 0 1 5 6.5Z"
        fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M4 22 22 4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

export function BulleCoach({ phrase, cle, onCouper }: { phrase: string; cle: string | number; onCouper: () => void }) {
  return (
    <div className="coach coach-conseil" data-coach-bulle="">
      <PortraitMochi humeur="content" taille={44} decoratif className="coach-portrait" />
      <p key={cle} aria-live="polite">{fr(phrase)}</p>
      <button type="button" className="conseil-note-btn" aria-label={t('coach.couper')} title={t('coach.couper')} onClick={onCouper}><IconeCouper /></button>
    </div>
  );
}
