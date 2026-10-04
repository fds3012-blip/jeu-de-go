import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Db } from '../data/supabase';
import { chargerSupabase, useSupabase } from '../data/client';
import { motSuppression, confirmationValide, connexionSociale, deleteMyAccount, fetchProfile, lierSociale, moyensDuCompte, retirerMoyen, saveUsername, type MoyenCompte, type Profile } from '../data/account';
import { USERNAME_MAX, USERNAME_MIN, validateUsername } from '../data/username';
import { EVENTS, identify, track } from '../data/analytics';
import { compteDe, estAnonyme } from '../data/defi';
import { ConnexionCode } from './Connexion';
import type { Sens } from './connexionBascule';
import { moyenConnexion } from './entonnoir';
import { garderRetour, lireAnnonce, oublierAnnonce } from './connexionGoogle';
import { NOM_FOURNISSEUR, fournisseursActifs, fournisseursVisibles, messageIncident, type Fournisseur } from './fournisseurs';
import { contexteActuel } from './navigateurIntegre';
import { BoutonsFournisseurs } from '../ui/BoutonFournisseur';
import { fr } from '../ui/typo';
import { t } from '../content/i18n';
import '../ui/compte.css';

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
export function Account({ db: dbFourni }: { db?: Db | null }) {
  const charge = useSupabase(); // client chargé à la demande (#401)
  const db = dbFourni === undefined ? charge : dbFourni;
  useEffect(() => { if (db === undefined) void chargerSupabase(); }, [db]);
  // Tests de bout en bout seulement (build VITE_E2E) : `?compte-simule` monte la suppression
  // avec un client simulé, sans aucun appel réseau.
  if (import.meta.env.VITE_E2E && typeof location !== 'undefined' && new URLSearchParams(location.search).has('compte-simule')) {
    return <div className="card"><b>joueur-test</b><SupprimerCompte db={clientSimule} /></div>;
  }
  if (db === undefined) return null; // un instant, le temps de charger le client
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

  // Session anonyme (défi par lien, #81) : « pas de compte ». Ni identification, ni profil, ni pseudo, ni suppression :
  // seulement la liaison d'un e-mail, qui garde les parties en cours.
  const anonyme = estAnonyme(session);
  const userId = compteDe(session);
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
  if (anonyme) return <LierEmail db={db} />;

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
    <>
      <div className="card">
        <b style={{ fontSize: '1.2rem' }}>{profile.username}</b>
        {/* Recette du 02/10 au soir : « Mon compte » n'affiche pas de cote ; l'e-mail suffit sous le pseudo.
            La cote de jeu (#417, parties classées entre humains) se lit dans le Profil, ligne « Ta cote ». */}
        <p className="muted small" style={{ margin: '4px 0 0' }}>{session.user.email}</p>
        {/* Audit du 02/10 : deux boutons empilés, pleine largeur (« Changer de pseudo » ne passe plus sur deux lignes). */}
        <div className="compte-boutons">
          <button className="btn" onClick={() => setEditing(true)}>{t('compte.changerPseudo')}</button>
          <button className="btn" onClick={signOut}>{t('compte.deconnecter')}</button>
        </div>
        <SupprimerCompte db={db} />
      </div>
      <MoyensConnexion db={db} userId={session.user.id} />
      {/* Audit du 02/10 (n° 2) : l'écran était aux deux tiers vide. Il redit ce que le compte garde (la même promesse
          qu'à la création, #214), sans action de plus. */}
      <section className="creer-garde compte-connecte-garde" aria-labelledby="compte-garde-titre">
        <p id="compte-garde-titre" className="creer-garde-titre">{fr(t('compte.gardeTitre'))}</p>
        <ul>
          {(['progression', 'serie', 'badges', 'parties'] as const).map(k => <li key={k}><Coche />{fr(t(`creer.garde.${k}`))}</li>)}
        </ul>
        <p className="muted small creer-appareils">{fr(t('creer.garde.appareils'))}</p>
      </section>
    </>
  );
}

/**
 * Mon compte → « Tes moyens de connexion » (#411) : le code par e-mail et les fournisseurs reliés, « Retirer » s'il en
 * reste un autre (Supabase refuse de retirer le dernier), puis les boutons des fournisseurs pas encore reliés
 * (`linkIdentity`, même ordre que partout). Un fournisseur non réglé (drapeau absent) n'apparaît jamais.
 */
function MoyensConnexion({ db, userId }: { db: Db; userId: string }) {
  const [annonce] = useState(() => { const a = lireAnnonce(); return a?.action === 'ajout' ? a : null; });
  useEffect(() => { if (annonce) oublierAnnonce(); }, [annonce]);
  const [moyens, setMoyens] = useState<MoyenCompte[] | null>(null);
  const [cle, setCle] = useState(0);
  const [erreur, setErreur] = useState(() => annonce?.incident && annonce.incident !== 'deja_lie' ? messageIncident(annonce.incident, annonce.fournisseur) : '');
  const [info, setInfo] = useState(() => annonce && !annonce.incident ? t('compte.moyens.ajoute', { nom: NOM_FOURNISSEUR[annonce.fournisseur] }) : '');
  const [dejaLie, setDejaLie] = useState<Fournisseur | null>(annonce?.incident === 'deja_lie' ? annonce.fournisseur : null);
  const [vers, setVers] = useState<Fournisseur | null>(null);
  const [retrait, setRetrait] = useState<string | null>(null);
  const [contexte] = useState(contexteActuel);
  const [actifs] = useState(() => fournisseursActifs());
  // L'encadré « déjà relié » s'ouvre au retour du fournisseur, parfois sous la ligne de flottaison : on l'amène au centre.
  const versEncadre = useCallback((el: HTMLDivElement | null) => {
    el?.scrollIntoView?.({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, []);

  useEffect(() => {
    let vivant = true;
    moyensDuCompte(db).then(r => {
      if (!vivant) return;
      if (r.ok) setMoyens(r.value); else setErreur(r.error);
    });
    return () => { vivant = false; };
  }, [db, userId, cle]);

  if (moyens === null && !erreur) return null;
  const relies = new Set((moyens ?? []).map(m => m.moyen));
  const aAjouter = fournisseursVisibles(contexte, actifs).filter(f => !relies.has(f));
  const nomDe = (m: MoyenCompte) => m.moyen === 'email' ? t('compte.moyens.email') : m.moyen === 'autre' ? m.identite.provider : NOM_FOURNISSEUR[m.moyen];

  async function ajouter(f: Fournisseur) {
    if (vers) return;
    setVers(f); setErreur(''); setInfo('');
    track(EVENTS.compteMethode, { methode: f, navigateur_integre: contexte.integre });
    garderRetour(undefined, undefined, { fournisseur: f, action: 'ajout' });
    const r = await lierSociale(db, f, `${window.location.origin}/`);
    if (!r.ok) { setVers(null); setErreur(r.error); }
  }
  /** L'identité est déjà à un autre compte du jeu : on s'y connecte (la session de ce compte-ci est remplacée). */
  async function seConnecterA(f: Fournisseur) {
    if (vers) return;
    setVers(f); setErreur('');
    garderRetour(undefined, undefined, { fournisseur: f, action: 'connexion' });
    const r = await connexionSociale(db, f, `${window.location.origin}/`);
    if (!r.ok) { setVers(null); setErreur(r.error); }
  }
  async function retirer(m: MoyenCompte) {
    if (retrait) return;
    setRetrait(m.identite.identity_id); setErreur(''); setInfo('');
    const r = await retirerMoyen(db, m.identite);
    setRetrait(null);
    if (!r.ok) { setErreur(r.error); return; }
    setInfo(t('compte.moyens.retire', { nom: nomDe(m) }));
    setCle(c => c + 1);
  }

  return (
    <section className="card moyens-carte" aria-labelledby="moyens-titre" data-testid="moyens-connexion">
      <b id="moyens-titre">{t('compte.moyens.titre')}</b>
      {moyens && (
        <ul className="moyens">
          {moyens.map(m => (
            <li key={m.identite.identity_id} data-moyen={m.moyen}>
              <span className="moyen-nom">{nomDe(m)}{m.email && <small>{m.email}</small>}</span>
              {moyens.length > 1 && (
                <button type="button" className="lien" aria-label={t('compte.moyens.retirerNom', { nom: nomDe(m) })}
                  disabled={retrait !== null} aria-busy={retrait === m.identite.identity_id} onClick={() => { void retirer(m); }}>
                  {t('compte.moyens.retirer')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {info && <p className="small connexion-info" role="status">{info}</p>}
      {dejaLie ? (
        <div ref={versEncadre} className="connexion-incident" role="alert" data-testid="deja-lie" style={{ marginTop: 10 }}>
          <p className="small"><b>{fr(t('connexion.sociale.dejaLie', { nom: NOM_FOURNISSEUR[dejaLie] }))}</b></p>
          <p className="small attention">{fr(t('connexion.sociale.dejaLieAutre'))}</p>
          <button type="button" className="btn primary" disabled={vers !== null} aria-busy={vers === dejaLie} onClick={() => { void seConnecterA(dejaLie); }}>
            {vers === dejaLie ? t('connexion.avecAttente', { nom: NOM_FOURNISSEUR[dejaLie] }) : t('connexion.sociale.seConnecter')}
          </button>
          <button type="button" className="lien" onClick={() => setDejaLie(null)}>{t('compte.annuler')}</button>
        </div>
      ) : aAjouter.length > 0 && (
        <>
          <p className="muted small moyens-info">{fr(t('compte.moyens.ajouter'))}</p>
          <BoutonsFournisseurs fournisseurs={aAjouter} enCours={vers} inactif={false} onChoisir={f => { void ajouter(f); }} />
        </>
      )}
      <p className="small connexion-erreur moyens-info" role="alert">{erreur}</p>
    </section>
  );
}

function Coche() {
  return <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4.5 10.5 8.5 14.5 15.5 6" /></svg>;
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

/** Connexion ou création de compte : code à 6 chiffres par e-mail (#343), le lien de l'e-mail en second moyen. */
function SignIn({ db }: { db: Db }) {
  const [sens, setSens] = useState<Sens>('creer');
  return (
    <div className="card">
      <b>{t(sens === 'creer' ? 'compte.creer' : 'connexion.titre')}</b>
      {/* #214 : promesse exacte. Seules la série et les leçons montent sur le serveur (importer_serie_appareil, syncProgress).
          Deux lignes à icône : ce qui te suit, ce qui reste sur ce téléphone. */}
      <ul className="compte-garde">
        <li className="compte-garde-oui">
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4.5 10.5 8.5 14.5 15.5 6" /></svg>
          {fr(t('compte.promesse'))}
        </li>
        <li className="compte-garde-ici">
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false"><rect x="5.5" y="2.5" width="9" height="15" rx="2" /><path d="M9 14.5h2" /></svg>
          {fr(t('compte.resteIci'))}
        </li>
      </ul>
      <p className="muted small" style={{ margin: '4px 0 10px' }}>{fr(t('connexion.sansMotDePasse'))}</p>
      <ConnexionCode db={db} onSens={setSens} />
    </div>
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
    if (r.ok) { if (!canCancel) track(EVENTS.pseudoChoisi, { moyen: moyenConnexion() }); onDone(r.value); } else setError(r.error);
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

/**
 * Session sans compte (ouverte par un ancien défi, #81) : ajouter un e-mail relie la session à un compte, sans changer
 * d'identifiant, donc sans perdre les parties en cours. Depuis #343, un code à 6 chiffres confirme l'e-mail dans l'app
 * (le lien de l'e-mail marche aussi). Le pseudo est ensuite demandé par l'écran de pseudo obligatoire.
 */
export function LierEmail({ db, moment = 'profil', coups = null, titre = t('compte.anonyme.titre'), texte = t('compte.anonyme.texte') }: {
  db: Db; moment?: 'profil' | 'apres_coup' | 'arrivee'; coups?: number | null; titre?: string; texte?: string;
}) {
  // #353 : « J'ai déjà un compte », ou une adresse déjà prise, passe en connexion à ce compte.
  const [sens, setSens] = useState<Sens>('creer');
  return (
    <div className="card" aria-labelledby={`lier-${moment}`} role="group" data-testid="lier-email">
      <b id={`lier-${moment}`}>{sens === 'creer' ? titre : t('connexion.titre')}</b>
      {sens === 'creer' && <p className="muted small" style={{ margin: '4px 0 10px' }}>{fr(texte)}</p>}
      <ConnexionCode db={db} mode="liaison" moment={moment} coups={coups} envoyer={t('defi.inscription.envoyer')} onSens={setSens} />
    </div>
  );
}
