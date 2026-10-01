// Connexion par code à 6 chiffres (#343). Le lien magique s'ouvre souvent dans un autre navigateur que celui du
// joueur (navigateur intégré de Messenger ou WhatsApp, app installée) : la session y est perdue. Le code se tape
// dans l'app, là où la session doit s'ouvrir. Le lien de l'e-mail reste un second moyen.
// `mode` dit la session en place :
// - `connexion` : pas de session. Création de compte (`signInWithOtp`, `shouldCreateUser: true`) ;
// - `liaison` : session sans compte d'un ancien défi (#81) qui ajoute son e-mail (`updateUser` puis
//   `verifyOtp({ type: 'email_change' })`) : même identifiant, la partie en cours est gardée.
// #353 : partout, un lien « J'ai déjà un compte » passe en connexion à un compte existant (`shouldCreateUser: false`),
// et une liaison refusée (adresse déjà prise) y bascule toute seule (voir connexionBascule.ts).
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { Db } from '../data/supabase';
import { LONGUEUR_CODE, codeComplet, envoyerCodeConnexion, nettoyerCode, sendMagicLink, verifierCode, type EchecEnvoi } from '../data/account';
import { garderMonCompte } from '../data/defi';
import { isEmail } from '../data/username';
import { EVENTS, track } from '../data/analytics';
import { noterConnexionParCode } from './entonnoir';
import { apresRefus, demandeAge, typeCode, voieEnvoi, type Sens, type Voie } from './connexionBascule';
import { fr } from '../ui/typo';
import { ConnexionSociale } from '../ui/ConnexionSociale';
import { t } from '../content/i18n';
import '../ui/compte.css';

/** Délai avant de pouvoir redemander un code (limite de Supabase : un e-mail par minute et par adresse). */
export const DELAI_RENVOI_S = 60;

interface Props {
  db: Db;
  mode?: 'connexion' | 'liaison';
  /** Libellé de l'action principale de l'étape e-mail. */
  envoyer?: string;
  /** Liaison seulement : où la liaison a été demandée (`defi_inscription`). */
  moment?: 'profil' | 'apres_coup' | 'arrivee';
  coups?: number | null;
  /** Code accepté : la session du compte est ouverte (tous les écrans la voient par onAuthStateChange). */
  onConnecte?: () => void;
  /** Ouvre les conditions et la politique (liens de la case d'âge) ; absent : les mots restent en gras. */
  onConditions?: () => void;
  /** Le joueur passe de « Crée ton compte » à « Connecte-toi » (ou l'inverse) : l'écran adapte son titre (#353). */
  onSens?: (sens: Sens) => void;
}

export function ConnexionCode({ db, mode = 'connexion', envoyer, moment = 'profil', coups = null, onConnecte, onConditions, onSens }: Props) {
  const id = useId();
  const anonyme = mode === 'liaison';
  const [etape, setEtape] = useState<'email' | 'code'>('email');
  const [sens, setSensLocal] = useState<Sens>('creer');
  /** Voie du dernier code envoyé : le renvoi et la vérification suivent la même. */
  const [voie, setVoie] = useState<Voie>(voieEnvoi('creer', anonyme));
  /** Vrai si l'adresse avait déjà un compte et que l'écran est passé tout seul en connexion. */
  const [bascule, setBascule] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [attente, setAttente] = useState(0);
  const [age, setAge] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  // Compte à rebours du renvoi, une seconde à la fois.
  useEffect(() => {
    if (attente <= 0) return;
    const tic = setTimeout(() => setAttente(s => s - 1), 1000);
    return () => clearTimeout(tic);
  }, [attente]);
  useEffect(() => { if (etape === 'code') codeRef.current?.focus(); }, [etape]);

  function changerSens(s: Sens) {
    setSensLocal(s); setError(''); setBascule(false);
    onSens?.(s);
  }

  const envoyerPar = (v: Voie) => v === 'liaison' ? garderMonCompte(db, email, window.location.origin)
    : v === 'connexion' ? envoyerCodeConnexion(db, email) : sendMagicLink(db, email);

  async function demander(v: Voie): Promise<boolean> {
    setBusy(true); setError('');
    let voieFaite = v;
    let r = await envoyerPar(v);
    // #353 : l'adresse a déjà un compte. Plus de blocage : on envoie tout de suite un code de connexion à ce compte.
    // La session anonyme reste en place jusqu'au bon code (si l'envoi échoue, rien n'est perdu).
    if (!r.ok && apresRefus(v, (r as EchecEnvoi).raison).faire === 'basculer') {
      voieFaite = 'connexion';
      r = await envoyerCodeConnexion(db, email);
      if (r.ok) { setBascule(true); setSensLocal('connecter'); onSens?.('connecter'); }
    }
    setBusy(false);
    if (!r.ok) { setError(r.error); return false; }
    setVoie(voieFaite);
    if (voieFaite === 'liaison') track(EVENTS.defiInscription, { moment, coups });
    else track(EVENTS.lienConnexionEnvoye, { moyen: 'code' });
    setAttente(DELAI_RENVOI_S);
    return true;
  }

  const envoyerEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!isEmail(email)) { setError(t('compte.emailInvalide')); return; }
    if (demandeAge(sens) && !age) { setError(t('compte.age.aide')); return; }
    setBascule(false);
    if (await demander(voieEnvoi(sens, anonyme))) { setCode(''); setInfo(''); setEtape('code'); }
  };

  async function verifier(valeur: string) {
    if (busy) return;
    if (!codeComplet(valeur)) { setError(t('connexion.code.incomplet', { n: LONGUEUR_CODE })); return; }
    setBusy(true); setError('');
    const r = await verifierCode(db, email, valeur, typeCode(voie));
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    noterConnexionParCode();
    onConnecte?.();
  }

  if (etape === 'code') {
    return (
      <form className="connexion" onSubmit={e => { e.preventDefault(); void verifier(code); }} noValidate aria-labelledby={`${id}-titre`}>
        <b id={`${id}-titre`} className="connexion-titre">{t('connexion.code.titre')}</b>
        {bascule && <p className="small connexion-bascule" data-testid="connexion-bascule">{fr(t('connexion.bascule'))}</p>}
        <p className="muted small connexion-texte" role="status">{fr(t('connexion.code.texte', { n: LONGUEUR_CODE, email: email.trim() }))}</p>
        {anonyme && voie === 'connexion' && <p className="muted small connexion-partie">{fr(t('connexion.partieSansCompte'))}</p>}
        <label className="small" htmlFor={`${id}-code`}>{t('connexion.code.label', { n: LONGUEUR_CODE })}</label>
        <input ref={codeRef} id={`${id}-code`} className="champ champ-code" name="code" inputMode="numeric" pattern="[0-9]*"
          autoComplete="one-time-code" maxLength={LONGUEUR_CODE + 4} value={code} aria-invalid={!!error} aria-describedby={`${id}-erreur ${id}-aide`}
          onChange={e => {
            const v = nettoyerCode(e.target.value);
            setCode(v); setError('');
            // Code collé ou rempli par le clavier du téléphone : validé tout de suite, sans toucher le bouton.
            if (codeComplet(v)) void verifier(v);
          }} />
        <p id={`${id}-erreur`} className="small connexion-erreur" role="alert">{error}</p>
        <button className="btn primary connexion-cta" type="submit" disabled={busy} aria-busy={busy}>{t(busy ? 'connexion.code.verification' : 'connexion.code.valider')}</button>
        <div className="connexion-liens">
          <button type="button" className="lien" disabled={busy || attente > 0}
            onClick={async () => { if (await demander(voie)) { setInfo(t('connexion.code.renvoye')); setCode(''); } }}>
            {attente > 0 ? t('connexion.code.renvoyerDans', { s: attente }) : t('connexion.code.renvoyer')}
          </button>
          <button type="button" className="lien" onClick={() => { setEtape('email'); setError(''); setInfo(''); }}>{t('compte.changerAdresse')}</button>
        </div>
        {info && <p className="small connexion-info" role="status">{info}</p>}
        <p id={`${id}-aide`} className="muted small connexion-aide">{fr(t('connexion.code.aide'))}</p>
      </form>
    );
  }

  const pret = !demandeAge(sens) || age;
  return (
    <form className="connexion" onSubmit={envoyerEmail} noValidate data-sens={sens}>
      {/* Masqués tant que FOURNISSEURS_ACTIFS est vide (src/ui/ConnexionSociale.tsx). */}
      <ConnexionSociale db={db} />
      <label className="small" htmlFor={`${id}-email`}>{t('compte.email')}</label>
      <input id={`${id}-email`} className="champ" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required
        value={email} onChange={e => { setEmail(e.target.value); setError(''); }} aria-invalid={!!error} aria-describedby={`${id}-erreur`} />
      {demandeAge(sens)
        ? <CaseAge id={id} coche={age} onChange={v => { setAge(v); setError(''); }} onConditions={onConditions} />
        : anonyme && <p className="muted small connexion-partie">{fr(t('connexion.partieSansCompte'))}</p>}
      <p id={`${id}-erreur`} className="small connexion-erreur" role="alert">{error}</p>
      {/* Inactif tant que la case n'est pas cochée, mais touchable : l'aide dit alors pourquoi (juridique #343, section 3). */}
      <button className={`btn primary connexion-cta${pret ? '' : ' inactif'}`} type="submit" disabled={busy} aria-disabled={!pret} aria-busy={busy}>
        {busy ? t('compte.envoi') : sens === 'creer' && envoyer ? envoyer : t('connexion.envoyer')}
      </button>
      {/* #353 : l'autre chemin, toujours visible, jamais en bouton principal. */}
      <button type="button" className="lien connexion-sens" data-testid="connexion-sens" onClick={() => changerSens(sens === 'creer' ? 'connecter' : 'creer')}>
        {t(sens === 'creer' ? 'connexion.dejaCompte' : 'connexion.pasDeCompte')}
      </button>
    </form>
  );
}

/**
 * Case d'âge et d'acceptation des conditions (#343), jamais cochée d'avance. Texte de l'agent juridique
 * (docs/juridique/compte-obligatoire.md, section 3, option A) : une seule case, déclarative, sans date de naissance.
 */
function CaseAge({ id, coche, onChange, onConditions }: { id: string; coche: boolean; onChange: (v: boolean) => void; onConditions?: () => void }) {
  const [moins15, setMoins15] = useState(false);
  // Repères du texte traduit, remplacés par les deux liens (caractères à usage privé, jamais dans un texte).
  const [avant, entre, apres] = t('compte.age.case', { conditions: '', confidentialite: '' }).split(/[]/);
  const lien = (cle: 'compte.age.conditions' | 'compte.age.confidentialite') => onConditions
    ? <button type="button" className="lien-texte" onClick={onConditions}>{t(cle)}</button>
    : <b>{t(cle)}</b>;
  return (
    <div className="case-age">
      <div className="case-age-ligne">
        <input id={`${id}-age`} type="checkbox" checked={coche} onChange={e => onChange(e.target.checked)} />
        <label htmlFor={`${id}-age`} className="small">{fr(avant)}{lien('compte.age.conditions')}{fr(entre)}{lien('compte.age.confidentialite')}{fr(apres)}</label>
      </div>
      <button type="button" className="lien case-age-moins15" aria-expanded={moins15} onClick={() => setMoins15(v => !v)}>{t('compte.age.moins15')}</button>
      {moins15 && <p className="muted small case-age-detail">{fr(t('compte.age.moins15Detail'))}</p>}
    </div>
  );
}
