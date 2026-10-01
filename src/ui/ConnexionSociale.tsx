// Emplacement des boutons « Connexion avec Google / Apple » (#353, préparation). Masqués tant que
// FOURNISSEURS_ACTIFS est vide : le benchmark (autre agent) dira lesquels activer. Pour activer un fournisseur :
// 1. le configurer dans Supabase (Authentication → Providers) avec l'URL de retour du site ;
// 2. l'ajouter ici. Apple est obligatoire sur l'App Store dès qu'un autre fournisseur social est proposé.
// Jamais en bouton principal : l'action principale reste « Recevoir mon code ».
import { useState } from 'react';
import type { Db } from '../data/supabase';
import { t } from '../content/i18n';

export type Fournisseur = 'google' | 'apple';

/** Fournisseurs affichés. Vide : rien n'est rendu. */
export const FOURNISSEURS_ACTIFS: readonly Fournisseur[] = [];

function Logo({ f }: { f: Fournisseur }) {
  if (f === 'apple') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="currentColor">
        <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.75.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.33-3.5ZM14.2 6.13c.6-.74 1.01-1.75.9-2.77-.87.04-1.94.59-2.56 1.32-.56.64-1.05 1.68-.92 2.67.98.08 1.97-.49 2.58-1.22Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

/** Boutons secondaires « Connexion avec … », suivis d'un séparateur « ou ». Rien si aucun fournisseur n'est actif. */
export function ConnexionSociale({ db, fournisseurs = FOURNISSEURS_ACTIFS }: { db: Db; fournisseurs?: readonly Fournisseur[] }) {
  const [busy, setBusy] = useState<Fournisseur | null>(null);
  const [erreur, setErreur] = useState('');
  if (fournisseurs.length === 0) return null;

  async function continuer(f: Fournisseur) {
    setBusy(f); setErreur('');
    const { error } = await db.auth.signInWithOAuth({ provider: f, options: { redirectTo: window.location.origin } });
    // En cas de succès, le navigateur part chez le fournisseur : rien d'autre à faire ici.
    if (error) { setBusy(null); setErreur(t('connexion.social.erreur')); }
  }

  return (
    <div className="connexion-sociale" data-testid="connexion-sociale">
      {fournisseurs.map(f => (
        <button key={f} type="button" className="btn connexion-sociale-btn" disabled={busy !== null} aria-busy={busy === f} onClick={() => { void continuer(f); }}>
          <Logo f={f} />{t(f === 'google' ? 'connexion.social.google' : 'connexion.social.apple')}
        </button>
      ))}
      {erreur && <p className="small connexion-erreur" role="alert">{erreur}</p>}
      <p className="connexion-ou muted small" aria-hidden="true"><span>{t('connexion.social.ou')}</span></p>
    </div>
  );
}
