// Boutons « Continuer avec Google / Apple / Facebook » (#354, #411), chacun selon la charte de sa marque :
// - Google : « G » en couleurs, fond blanc et bord gris en clair, fond #131314 en sombre (Google Identity, branding) ;
// - Apple : fond noir et logo blanc en clair, fond blanc et logo noir en sombre (Human Interface Guidelines) ;
// - Facebook : fond bleu #1877F2, logo « f » blanc (Meta, Brand Resource Center).
// Même taille pour tous (48 px de haut, pleine largeur) : Apple demande que son bouton ne soit jamais plus petit que
// les autres. Logos en SVG en ligne (≈ 2 Ko), chargés avec l'écran de compte, jamais à l'accueil.
// Composant d'affichage seul : l'écran décide lesquels montrer (src/app/fournisseurs.ts) et dans quel ordre.
import type { ReactElement } from 'react';
import { NOM_FOURNISSEUR, type Fournisseur } from '../app/fournisseurs';
import { t } from '../content/i18n/secondaires';

function LogoGoogle() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

function LogoApple() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M16.37 12.6c-.03-2.68 2.19-3.97 2.29-4.03-1.25-1.82-3.19-2.07-3.88-2.1-1.65-.17-3.22.97-4.06.97-.84 0-2.13-.95-3.5-.92-1.8.03-3.46 1.05-4.39 2.66-1.87 3.25-.48 8.05 1.34 10.69.89 1.29 1.95 2.73 3.34 2.68 1.34-.05 1.85-.87 3.47-.87 1.62 0 2.08.87 3.5.84 1.44-.03 2.36-1.31 3.24-2.6 1.02-1.49 1.44-2.94 1.47-3.01-.03-.01-2.81-1.08-2.84-4.29ZM13.7 4.73c.74-.9 1.24-2.14 1.1-3.38-1.07.04-2.36.71-3.12 1.6-.68.79-1.28 2.06-1.12 3.27 1.19.09 2.4-.6 3.14-1.49Z" />
    </svg>
  );
}

function LogoFacebook() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path fill="#FFFFFF" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.03 1.79-4.7 4.53-4.7 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07Z" />
    </svg>
  );
}

const LOGO: Record<Fournisseur, () => ReactElement> = { google: LogoGoogle, apple: LogoApple, facebook: LogoFacebook };

export function BoutonFournisseur({ fournisseur, onClick, busy, inactif, desactive = false }: {
  fournisseur: Fournisseur; onClick: () => void;
  /** Départ en cours vers ce fournisseur : « Connexion avec Google… ». */
  busy: boolean;
  /** Touchable mais pas prêt (case d'âge non cochée) : l'écran dit pourquoi au toucher. */
  inactif: boolean;
  /** Un autre départ est en cours. */
  desactive?: boolean;
}) {
  const Logo = LOGO[fournisseur];
  const nom = NOM_FOURNISSEUR[fournisseur];
  return (
    <button type="button" className={`btn btn-fournisseur btn-${fournisseur}${inactif ? ' inactif' : ''}`} data-testid={`bouton-${fournisseur}`}
      onClick={onClick} disabled={busy || desactive} aria-disabled={inactif} aria-busy={busy}>
      <Logo /><span>{t(busy ? 'connexion.avecAttente' : 'connexion.avec', { nom })}</span>
    </button>
  );
}

/** Les boutons, dans l'ordre reçu (toujours ORDRE_FOURNISSEURS), empilés. */
export function BoutonsFournisseurs({ fournisseurs, enCours, inactif, onChoisir }: {
  fournisseurs: readonly Fournisseur[]; enCours: Fournisseur | null; inactif: boolean; onChoisir: (f: Fournisseur) => void;
}) {
  return (
    <div className="fournisseurs" data-testid="fournisseurs">
      {fournisseurs.map(f => (
        <BoutonFournisseur key={f} fournisseur={f} busy={enCours === f} desactive={enCours !== null && enCours !== f} inactif={inactif} onClick={() => onChoisir(f)} />
      ))}
    </div>
  );
}
