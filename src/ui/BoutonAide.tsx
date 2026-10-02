// Bouton « ? » qui ouvre l'aide (issue #362) : rond, 44 px, discret. Sans action principale : il ne prend jamais l'or ni le jade.
// Posé dans le lecteur de leçon, le problème, le Profil et le bandeau du haut de la partie (fiche « compter » pendant le comptage).
import { ouvrirAide, type Ouverture } from '../app/ouvrirAide';
import { t } from '../content/i18n';
import './bouton-aide.css';

/** `libelle` : texte visible à côté du « ? » (Profil) ; sans lui, le bouton n'a que l'icône et son nom accessible. */
export function BoutonAide({ className, libelle, ...o }: Ouverture & { className?: string; libelle?: string }) {
  return (
    <button type="button" className={['bouton-aide', libelle && 'bouton-aide-texte', className].filter(Boolean).join(' ')}
      aria-label={libelle ? undefined : t('aide.ouvrir')} aria-haspopup="dialog"
      onClick={() => ouvrirAide(o)}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.2-2.6 3.9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="12" cy="17.1" r="1.15" fill="currentColor" />
      </svg>
      {libelle}
    </button>
  );
}
