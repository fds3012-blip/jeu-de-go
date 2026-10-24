// #U5 : la série de jours, dessinée et dite d'une seule façon sur Jouer, Problèmes et le Profil. Flamme pleine : la
// série est gardée aujourd'hui (Go du jour, leçon, révision ou partie) ; creuse : elle est en jeu. Style : accueil.css (.serie).
import { t } from '../content/i18n';

export function PastilleSerie({ jours, gardee, testId, allumage }: { jours: number; gardee: boolean; testId: string; allumage?: boolean }) {
  return (
    <span className={`serie ${gardee ? 'pleine' : 'creuse'}${allumage ? ' allumage' : ''}`} role="img" data-testid={testId} data-etat={gardee ? 'pleine' : 'creuse'}
      aria-label={t(gardee ? 'entete.flammeFaite' : 'entete.flammeAFaire', { jours: t('profil.jours', { n: jours }) })}>
      <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" focusable="false">
        <path className="flamme-corps" d="M8.6 1.2c.4 2.3 3.9 3.9 3.9 7.9A4.5 4.5 0 0 1 8 13.8a4.5 4.5 0 0 1-4.5-4.6c0-2 1-3.2 2-4 0 1.4.6 2.4 1.5 2.7C6.6 5.6 7.4 3 8.6 1.2Z" fill="currentColor" />
      </svg>{jours}
    </span>
  );
}
