import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Db } from '../data/supabase';
import { fetchProfile, saveUsername, sendMagicLink, type Profile } from '../data/account';
import { USERNAME_MAX, USERNAME_MIN, isEmail, validateUsername } from '../data/username';
import { EVENTS, identify, track } from '../data/analytics';
import { FINE } from '../ui/typo';

const field: CSSProperties = {
  width: '100%', minHeight: 46, padding: '0 14px', borderRadius: 12, border: '1.5px solid var(--line)',
  background: 'var(--bg)', color: 'var(--text)', font: 'inherit', boxSizing: 'border-box'
};
const full: CSSProperties = { width: '100%', marginTop: 10 };

/** Carte « Ton compte » de l'onglet Profil : connexion par lien e-mail, pseudo, déconnexion. */
export function Account({ db = supabase }: { db?: Db | null }) {
  if (!db) {
    return (
      <div className="card">
        <b>Ton compte</b>
        <p className="muted small" style={{ margin: '4px 0 0' }}>La connexion n’est pas disponible pour le moment. Tu peux jouer et apprendre sans compte{FINE}: ta progression reste sur ce téléphone.</p>
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

  if (session === undefined) return <div className="card muted small" aria-busy="true">Chargement de ton compte…</div>;
  if (!session) return <SignIn db={db} />;

  const signOut = async () => { await db.auth.signOut(); setEditing(false); };

  if (!profile) {
    return (
      <div className="card">
        <p className="muted small" style={{ margin: 0 }} role={error ? 'alert' : undefined}>{error || 'Chargement de ton profil…'}</p>
        <button className="btn" style={full} onClick={signOut}>Me déconnecter</button>
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
      <p className="muted small" style={{ margin: '4px 0 0' }}>Cote {profile.rating} · Problèmes {profile.puzzle_rating}</p>
      <p className="muted small" style={{ margin: '2px 0 0' }}>{session.user.email}</p>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => setEditing(true)}>Changer de pseudo</button>
        <button className="btn" onClick={signOut}>Me déconnecter</button>
      </div>
    </div>
  );
}

function SignIn({ db }: { db: Db }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) { setError('Entre une adresse e-mail valide.'); return; }
    setBusy(true); setError('');
    const r = await sendMagicLink(db, email);
    setBusy(false);
    if (r.ok) { setSent(true); track(EVENTS.lienConnexionEnvoye); } else setError(r.error);
  };

  if (sent) {
    return (
      <div className="card" role="status">
        <b>Regarde tes e-mails</b>
        <p className="muted small" style={{ margin: '4px 0 0' }}>On t’a envoyé un lien à {email.trim()}. Ouvre-le sur ce téléphone pour te connecter.</p>
        <button className="btn" style={full} onClick={() => setSent(false)}>Changer d’adresse</button>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <b>Crée ton compte</b>
      <p className="muted small" style={{ margin: '4px 0 10px' }}>Garde ta cote et joue en ligne. Pas de mot de passe{FINE}: on t’envoie un lien par e-mail.</p>
      <label className="small" htmlFor="account-email">Ton adresse e-mail</label>
      <input id="account-email" type="email" inputMode="email" autoComplete="email" required style={{ ...field, marginTop: 4 }}
        value={email} onChange={e => { setEmail(e.target.value); setError(''); }} aria-invalid={!!error} aria-describedby="account-email-error" />
      <p id="account-email-error" className="small" role="alert" style={{ color: 'var(--vermillon)', margin: error ? '6px 0 0' : 0 }}>{error}</p>
      <button className="btn primary" style={full} type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Recevoir mon lien'}</button>
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
      <b>{canCancel ? 'Ton nouveau pseudo' : 'Choisis ton pseudo'}</b>
      <p className="muted small" style={{ margin: '4px 0 10px' }}>C’est le nom que verront les autres joueurs. De {USERNAME_MIN} à {USERNAME_MAX} caractères{FINE}: lettres, chiffres, _ et -.</p>
      <label className="small" htmlFor="account-username">Pseudo</label>
      <input id="account-username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={USERNAME_MAX} style={{ ...field, marginTop: 4 }}
        value={name} onChange={e => { setName(e.target.value); setError(''); }} aria-invalid={!!error} aria-describedby="account-username-error" />
      <p id="account-username-error" className="small" role="alert" style={{ color: 'var(--vermillon)', margin: error ? '6px 0 0' : 0 }}>{error}</p>
      <button className="btn primary" style={full} type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Valider'}</button>
      {canCancel
        ? <button className="btn" style={full} type="button" onClick={onCancel}>Annuler</button>
        : <button className="btn" style={full} type="button" onClick={onSignOut}>Me déconnecter</button>}
    </form>
  );
}
