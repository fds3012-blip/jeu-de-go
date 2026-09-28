import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Db } from '../data/supabase';
import { motSuppression, confirmationValide, deleteMyAccount, fetchProfile, saveUsername, sendMagicLink, type Profile } from '../data/account';
import { USERNAME_MAX, USERNAME_MIN, isEmail, validateUsername } from '../data/username';
import { EVENTS, identify, track } from '../data/analytics';
import { fr } from '../ui/typo';
import { t } from '../content/i18n';

const field: CSSProperties = {
  width: '100%', minHeight: 46, padding: '0 14px', borderRadius: 12, border: '1.5px solid var(--line)',
  background: 'var(--bg)', color: 'var(--text)', font: 'inherit', boxSizing: 'border-box'
};
const full: CSSProperties = { width: '100%', marginTop: 10 };

/** Client Supabase simulé pour les tests de bout en bout (`?compte-simule`) : rien ne sort du navigateur. */
const clientSimule = {
  rpc: () => new Promise(r => setTimeout(() => r({ data: null, error: null }), 150)),
  auth: { signOut: () => Promise.resolve({ error: null }) },
} as unknown as Db;

/** Carte « Ton compte » de l'onglet Profil : connexion par lien e-mail, pseudo, déconnexion. */
export function Account({ db = supabase }: { db?: Db | null }) {
  // Tests de bout en bout seulement (build VITE_E2E) : `?compte-simule` monte la suppression
  // avec un client simulé, sans aucun appel réseau.
  if (import.meta.env.VITE_E2E && typeof location !== 'undefined' && new URLSearchParams(location.search).has('compte-simule')) {
    return <div className="card"><b>joueur-test</b><SupprimerCompte db={clientSimule} /></div>;
  }
  if (!db) {
    return (
      <div className="card">
        <b>{t('compte.titre')}</b>
        <p className="muted small" style={{ margin: '4px 0 0' }}>{fr(t('compte.indisponible'))}</p>
      </div>
    );
  }
  return <Connected db={db} />;
}

function Connected({ db }: { db: Db }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let alive = true;
    db.auth.getSession().then(({ data }) => { if (alive) setSession(data.session); });
    const { data } = db.auth.onAuthStateChange((_event, s) => { if (alive) setSession(s); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, [db]);

  const userId = session?.user.id;
  useEffect(() => { if (session !== undefined) identify(userId ?? null); }, [session, userId]);
  useEffect(() => {
    if (!userId) { setProfile(null); return; }
    let alive = true;
    fetchProfile(db, userId).then(r => {
      if (!alive) return;
      if (r.ok) setProfile(r.value); else setError(r.error);
    });
    return () => { alive = false; };
  }, [db, userId]);

  if (session === undefined) return <div className="card muted small" aria-busy="true">{t('compte.chargement')}</div>;
  if (!session) return <SignIn db={db} />;

  const signOut = async () => { await db.auth.signOut(); setEditing(false); };

  if (!profile) {
    return (
      <div className="card">
        <p className="muted small" style={{ margin: 0 }} role={error ? 'alert' : undefined}>{error || t('compte.chargementProfil')}</p>
        <button className="btn" style={full} onClick={signOut}>{t('compte.deconnecter')}</button>
      </div>
    );
  }

  if (!profile.username || editing) {
    return (
      <UsernameForm db={db} profile={profile} canCancel={!!profile.username}
        onDone={p => { setProfile(p); setEditing(false); }} onCancel={() => setEditing(false)} onSignOut={signOut} />
    );
  }

  return (
    <div className="card">
      <b style={{ fontSize: '1.2rem' }}>{profile.username}</b>
      <p className="muted small" style={{ margin: '4px 0 0' }}>{t('compte.cotes', { cote: profile.rating, pb: profile.puzzle_rating })}</p>
      <p className="muted small" style={{ margin: '2px 0 0' }}>{session.user.email}</p>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => setEditing(true)}>{t('compte.changerPseudo')}</button>
        <button className="btn" onClick={signOut}>{t('compte.deconnecter')}</button>
      </div>
      <SupprimerCompte db={db} />
    </div>
  );
}

/**
 * « Supprimer mon compte » (#114), en deux temps : un lien discret ouvre l'explication,
 * puis le bouton final ne s'active qu'une fois « SUPPRIMER » tapé. Après succès : retour à l'accueil.
 */
export function SupprimerCompte({ db, onSupprime = () => window.location.assign('/') }: { db: Db; onSupprime?: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!ouvert) {
    return (
      <button type="button" className="btn-supprimer" onClick={() => setOuvert(true)}>{t('compte.supprimer')}</button>
    );
  }

  const confirmer = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirmationValide(saisie) || busy) return;
    setBusy(true); setError('');
    const r = await deleteMyAccount(db);
    setBusy(false);
    if (r.ok) onSupprime(); else setError(r.error);
  };

  return (
    <form className="suppression" onSubmit={confirmer} noValidate aria-labelledby="suppression-titre">
      <b id="suppression-titre">{fr(t('compte.supprimer.titre'))}</b>
      <p className="small" style={{ margin: '6px 0 0' }}>{t('compte.supprimer.texte')}</p>
      <p className="small" style={{ margin: '6px 0 0' }}>{fr(t('compte.supprimer.parties'))}</p>
      <label className="small" htmlFor="suppression-mot" style={{ display: 'block', marginTop: 10 }}>{t('compte.supprimer.tape', { mot: motSuppression() })}</label>
      <input id="suppression-mot" autoComplete="off" autoCapitalize="characters" spellCheck={false} style={{ ...field, marginTop: 4 }}
        value={saisie} onChange={e => { setSaisie(e.target.value); setError(''); }} aria-describedby="suppression-erreur" />
      <p id="suppression-erreur" className="small" role="alert" style={{ color: 'var(--vermillon)', margin: error ? '6px 0 0' : 0 }}>{error}</p>
      <button type="submit" className="btn btn-danger" style={full} disabled={!confirmationValide(saisie) || busy}>
        {t(busy ? 'compte.supprimer.enCours' : 'compte.supprimer.definitif')}
      </button>
      <button type="button" className="btn" style={full} onClick={() => { setOuvert(false); setSaisie(''); setError(''); }}>{t('compte.annuler')}</button>
    </form>
  );
}

function SignIn({ db }: { db: Db }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) { setError(t('compte.emailInvalide')); return; }
    setBusy(true); setError('');
    const r = await sendMagicLink(db, email);
    setBusy(false);
    if (r.ok) { setSent(true); track(EVENTS.lienConnexionEnvoye); } else setError(r.error);
  };

  if (sent) {
    return (
      <div className="card" role="status">
        <b>{t('compte.regardeEmails')}</b>
        <p className="muted small" style={{ margin: '4px 0 0' }}>{t('compte.lienEnvoye', { email: email.trim() })}</p>
        <button className="btn" style={full} onClick={() => setSent(false)}>{t('compte.changerAdresse')}</button>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <b>{t('compte.creer')}</b>
      {/* #214 : promesse exacte. Seules la série et les leçons montent sur le serveur (importer_serie_appareil, syncProgress). */}
      <p className="muted small" style={{ margin: '4px 0 0' }}>{fr(t('compte.promesse'))}</p>
      <p className="muted small" style={{ margin: '4px 0 0' }}>{fr(t('compte.resteIci'))}</p>
      <p className="muted small" style={{ margin: '4px 0 10px' }}>{fr(t('compte.sansMotDePasse'))}</p>
      <label className="small" htmlFor="account-email">{t('compte.email')}</label>
      <input id="account-email" type="email" inputMode="email" autoComplete="email" required style={{ ...field, marginTop: 4 }}
        value={email} onChange={e => { setEmail(e.target.value); setError(''); }} aria-invalid={!!error} aria-describedby="account-email-error" />
      <p id="account-email-error" className="small" role="alert" style={{ color: 'var(--vermillon)', margin: error ? '6px 0 0' : 0 }}>{error}</p>
      <button className="btn primary" style={full} type="submit" disabled={busy}>{t(busy ? 'compte.envoi' : 'compte.recevoirLien')}</button>
    </form>
  );
}

function UsernameForm({ db, profile, canCancel, onDone, onCancel, onSignOut }: {
  db: Db; profile: Profile; canCancel: boolean;
  onDone: (p: Profile) => void; onCancel: () => void; onSignOut: () => void;
}) {
  const [name, setName] = useState(profile.username ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const check = validateUsername(name);
    if (!check.ok) { setError(check.error); return; }
    setBusy(true); setError('');
    const r = await saveUsername(db, profile.id, check.value);
    setBusy(false);
    if (r.ok) { if (!canCancel) track(EVENTS.inscription); onDone(r.value); } else setError(r.error);
  };

  return (
    <form className="card" onSubmit={submit} noValidate>
      <b>{t(canCancel ? 'compte.nouveauPseudo' : 'compte.choisisPseudo')}</b>
      <p className="muted small" style={{ margin: '4px 0 10px' }}>{fr(t('compte.pseudoAide', { min: USERNAME_MIN, max: USERNAME_MAX }))}</p>
      <label className="small" htmlFor="account-username">{t('compte.pseudo')}</label>
      <input id="account-username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={USERNAME_MAX} style={{ ...field, marginTop: 4 }}
        value={name} onChange={e => { setName(e.target.value); setError(''); }} aria-invalid={!!error} aria-describedby="account-username-error" />
      <p id="account-username-error" className="small" role="alert" style={{ color: 'var(--vermillon)', margin: error ? '6px 0 0' : 0 }}>{error}</p>
      <button className="btn primary" style={full} type="submit" disabled={busy}>{t(busy ? 'compte.enregistrement' : 'compte.valider')}</button>
      {canCancel
        ? <button className="btn" style={full} type="button" onClick={onCancel}>{t('compte.annuler')}</button>
        : <button className="btn" style={full} type="button" onClick={onSignOut}>{t('compte.deconnecter')}</button>}
    </form>
  );
}
