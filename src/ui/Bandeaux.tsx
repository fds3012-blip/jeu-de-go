/**
 * Bandeaux discrets de la coquille (robustesse, #325) :
 * - « Tu es hors ligne » : le même, sur tous les écrans qui ont besoin du réseau (défi, en ligne, compte) ;
 *   ce qui marche hors ligne (partie contre l'ordi, leçons, problèmes du téléphone) reste jouable, sans bandeau.
 * - « Mise à jour prête, recharger » : quand une nouvelle version est arrivée pendant que l'app était ouverte
 *   (src/app/miseAJour.ts). Jamais au milieu d'une partie : l'écran décide quand le montrer (`visible`).
 * Styles : src/ui/robustesse.css.
 */
import { useState, useSyncExternalStore } from 'react';
import { t } from '../content/i18n';
import { abonnerNouvelleVersion, nouvelleVersionPrete, recharger } from '../app/miseAJour';

/** Petit pictogramme « sans réseau » : un arc de signal barré. */
function IconeHorsLigne() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M3 8.5a10 10 0 0 1 14 0M6 11.5a6 6 0 0 1 8 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="15" r="1.4" fill="currentColor" />
      <path d="M4 4l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function BandeauHorsLigne() {
  return (
    <p className="bandeau bandeau-hors-ligne" role="status" data-testid="bandeau-hors-ligne">
      <IconeHorsLigne />
      <span><b>{t('horsLigne.bandeau')}</b><span className="bandeau-detail"> {t('horsLigne.detail')}</span></span>
    </p>
  );
}

/** Vrai quand une nouvelle version attend un rechargement (relu à chaque changement). */
function useNouvelleVersion(): boolean {
  return useSyncExternalStore(abonnerNouvelleVersion, nouvelleVersionPrete, () => false);
}

/** Invite à recharger. `visible` : faux pendant une partie (le parent le décide) ; « Plus tard » la cache pour cette session. */
export function InviteMiseAJour({ visible }: { visible: boolean }) {
  const prete = useNouvelleVersion();
  const [ignoree, setIgnoree] = useState(false);
  if (!prete || !visible || ignoree) return null;
  return (
    <div className="bandeau bandeau-mise-a-jour" role="status" data-testid="invite-mise-a-jour">
      <span className="bandeau-texte">{t('miseAJour.prete')}</span>
      <button type="button" className="bandeau-action" onClick={recharger}>{t('miseAJour.recharger')}</button>
      <button type="button" className="bandeau-fermer" onClick={() => setIgnoree(true)} aria-label={t('miseAJour.plusTard')}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}
