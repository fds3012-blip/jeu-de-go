// Compte obligatoire avec pseudo (#343, modèle chess.com). Deux écrans :
// - CreerCompte : l'essai sans compte est fini (ou l'action demande un compte). Une seule action : recevoir un code
//   par e-mail. Le texte dit exactement ce qui est gardé ; ce qui est sur l'appareil est repris par l'import existant
//   (leçons : syncProgress ; série : importer_serie_appareil ; le reste reste sur l'appareil, rien ne se perd).
// - PseudoObligatoire : juste après la première connexion, avant tout le reste. On ne peut que choisir son pseudo
//   ou se déconnecter. Disponibilité vérifiée pendant la saisie, règles toujours visibles.
import { useEffect, useId, useState, type FormEvent } from 'react';
import type { Db } from '../data/supabase';
import { pseudoDisponible, saveUsername } from '../data/account';
import { USERNAME_MAX, USERNAME_MIN, validateUsername } from '../data/username';
import { EVENTS, track } from '../data/analytics';
import { ConnexionCode } from './Connexion';
import type { Sens } from './connexionBascule';
import { moyenConnexion } from './entonnoir';
import type { Raison } from './essai';
import { Mochi } from '../ui/Mochi';
import { fr } from '../ui/typo';
import { t } from '../content/i18n';
import '../ui/compte.css';

function Coche() {
  return <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4.5 10.5 8.5 14.5 15.5 6" /></svg>;
}

function BoutonRetour({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="compte-retour" aria-label={t('creer.retour')} onClick={onClick}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** « Crée ton compte » : dit pourquoi, ce qui est gardé, puis une seule action. `anonyme` : session d'un ancien défi. */
export function CreerCompte({ db, raison, anonyme = false, onRetour, onConditions }: { db: Db; raison: Raison; anonyme?: boolean; onRetour: () => void; onConditions?: () => void }) {
  // #353 : « J'ai déjà un compte » (ou une adresse déjà prise) fait passer l'écran en « Connecte-toi ».
  const [sens, setSens] = useState<Sens>('creer');
  return (
    <div className="creer-compte" data-testid="creer-compte" data-raison={raison}>
      <BoutonRetour onClick={onRetour} />
      <div className="creer-tete">
        <Mochi size={64} />
        <h2 className="creer-titre">{t(sens === 'creer' ? 'creer.titre' : 'connexion.titre')}</h2>
        <p className="creer-raison">{fr(sens === 'creer' ? t(`creer.raison.${raison}`) : t('connexion.raison'))}</p>
      </div>
      {/* Audit du 02/10 : « ce qui est gardé » parle à qui crée un compte ; à la connexion, il poussait le champ pour rien.
          Écran bas (320 × 568) : la carte passe sous le formulaire (compte.css), l'action reste au-dessus de la ligne de flottaison. */}
      {sens === 'creer' && (
        <section className="creer-garde" aria-labelledby="creer-garde-titre">
          <p id="creer-garde-titre" className="creer-garde-titre">{fr(t('creer.garde.titre'))}</p>
          <ul>
            {(['progression', 'serie', 'badges', 'parties'] as const).map(k => <li key={k}><Coche />{fr(t(`creer.garde.${k}`))}</li>)}
          </ul>
          <p className="muted small creer-appareils">{fr(t('creer.garde.appareils'))}</p>
        </section>
      )}
      <ConnexionCode db={db} mode={anonyme ? 'liaison' : 'connexion'} moment="profil" onConditions={onConditions} onSens={setSens} />
      <p className="muted small creer-gratuit">{fr(t('creer.gratuit'))}</p>
      <button type="button" className="lien creer-plus-tard" onClick={onRetour}>{t('creer.plusTard')}</button>
    </div>
  );
}

type Dispo = { etat: 'vide' } | { etat: 'invalide'; message: string } | { etat: 'verification' } | { etat: 'libre'; pseudo: string } | { etat: 'pris' } | { etat: 'inconnu' };

/** Délai après la dernière frappe avant de demander au serveur si le pseudo est libre. */
export const ATTENTE_VERIFICATION_MS = 400;

/** Pseudo obligatoire, juste après la première connexion (#343). */
export function PseudoObligatoire({ db, userId, onChoisi, onDeconnecter }: { db: Db; userId: string; onChoisi: (pseudo: string) => void; onDeconnecter: () => void }) {
  const id = useId();
  const [nom, setNom] = useState('');
  const [dispo, setDispo] = useState<Dispo>({ etat: 'vide' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const brut = nom.trim();
    if (!brut) { setDispo({ etat: 'vide' }); return; }
    const check = validateUsername(brut);
    // Trop court pendant la frappe : rien à dire tant que les règles sont affichées juste dessous.
    if (!check.ok) { setDispo(brut.length < USERNAME_MIN ? { etat: 'vide' } : { etat: 'invalide', message: check.error }); return; }
    setDispo({ etat: 'verification' });
    let vivant = true;
    const minuteur = setTimeout(() => {
      pseudoDisponible(db, check.value, userId).then(r => {
        if (!vivant) return;
        setDispo(!r.ok ? { etat: 'inconnu' } : r.value ? { etat: 'libre', pseudo: check.value } : { etat: 'pris' });
      }, () => { if (vivant) setDispo({ etat: 'inconnu' }); });
    }, ATTENTE_VERIFICATION_MS);
    return () => { vivant = false; clearTimeout(minuteur); };
  }, [db, userId, nom]);

  const valider = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const check = validateUsername(nom);
    if (!check.ok) { setError(check.error); return; }
    if (dispo.etat === 'pris') { setError(t('pseudo.pris')); return; }
    setBusy(true); setError('');
    const r = await saveUsername(db, userId, check.value);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    track(EVENTS.pseudoChoisi, { moyen: moyenConnexion() });
    onChoisi(check.value);
  };

  const statut = error || (dispo.etat === 'invalide' ? dispo.message : dispo.etat === 'pris' ? t('pseudo.pris') : '');
  return (
    <div className="creer-compte pseudo-obligatoire" data-testid="pseudo-obligatoire">
      <div className="creer-tete">
        <Mochi size={64} />
        <p className="pseudo-bienvenue">{fr(t('pseudo.bienvenue'))}</p>
        <h2 className="creer-titre" id={`${id}-titre`}>{t('pseudo.titre')}</h2>
        <p className="creer-raison">{fr(t('pseudo.texte'))}</p>
      </div>
      <form className="connexion" onSubmit={valider} noValidate aria-labelledby={`${id}-titre`}>
        <label className="small" htmlFor={`${id}-pseudo`}>{t('compte.pseudo')}</label>
        <input id={`${id}-pseudo`} className="champ" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          maxLength={USERNAME_MAX} value={nom} aria-invalid={!!statut} aria-describedby={`${id}-regles ${id}-statut`}
          onChange={e => { setNom(e.target.value); setError(''); }} />
        <p id={`${id}-regles`} className="muted small pseudo-regles">{fr(t('pseudo.regles', { min: USERNAME_MIN, max: USERNAME_MAX }))} {fr(t('compte.pseudo.conseil'))}</p>
        <p id={`${id}-statut`} className={`small pseudo-statut${statut ? ' erreur' : dispo.etat === 'libre' ? ' libre' : ''}`} role="status" aria-live="polite">
          {statut || (dispo.etat === 'verification' ? t('pseudo.verification') : dispo.etat === 'libre' ? <><Coche />{t('pseudo.libre', { pseudo: dispo.pseudo })}</> : '')}
        </p>
        <button className="btn primary connexion-cta" type="submit" disabled={busy || dispo.etat === 'pris' || dispo.etat === 'invalide'} aria-busy={busy}>
          {t(busy ? 'compte.enregistrement' : 'pseudo.valider')}
        </button>
      </form>
      <button type="button" className="lien creer-plus-tard" onClick={onDeconnecter}>{t('compte.deconnecter')}</button>
    </div>
  );
}
