// Sécurité entre joueurs (#363, #373) : feuilles « Signaler » / « Nous écrire », feuille « Dire » (messages prédéfinis
// et émotes de Mochi), bulle d'un message en partie. Feuilles en bas d'écran (boîte de dialogue native, comme
// « Changer » de l'accueil) : une seule action principale chacune. Données : src/data/securite.ts. Styles : securite.css.
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { PortraitMochi, type HumeurMochi } from './Portrait';
import { fr } from './typo';
import { EMOTES, MESSAGES, MOTIFS_JOUEUR, MOTIFS_PROBLEME, TEXTE_MAX, bloquer, estEmote, signaler, type CodeMessage, type Demande, type MotifJoueur, type MotifProbleme } from '../data/securite';
import type { Db } from '../data/supabase';
import { EVENTS, analyticsConfig, track } from '../data/analytics';
import { tsec } from '../content/i18n/securite';
import './securite.css';

/** Ouvre ou ferme une boîte de dialogue modale native selon `ouvert`. */
function useDialogue(ref: RefObject<HTMLDialogElement | null>, ouvert: boolean) {
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal?.();
    if (!ouvert && d.open) d.close?.();
  }, [ref, ouvert]);
}

/** Feuille en bas d'écran : titre, « Fermer », contenu. Un toucher sur le voile ou Échap la ferme. */
function Feuille({ ouvert, onFermer, titre, testId, children }: { ouvert: boolean; onFermer: () => void; titre: string; testId: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useDialogue(ref, ouvert);
  return (
    <dialog ref={ref} className="feuille feuille-securite" aria-labelledby={id} data-testid={testId} onClose={onFermer}
      onClick={e => { if (e.target === ref.current) onFermer(); }}>
      {ouvert && (
        <div className="feuille-corps">
          <div className="feuille-tete">
            <h2 id={id}>{titre}</h2>
            <button type="button" className="lien" onClick={onFermer}>{tsec('signaler.fermer')}</button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

const HUMEURS: Record<(typeof EMOTES)[number], HumeurMochi> = {
  mochi_salut: 'neutre', mochi_content: 'content', mochi_fier: 'fier', mochi_pensif: 'pensif',
};

/** Texte d'un message, dans la langue de l'interface (les codes sont traduits à l'affichage). */
const texteMessage = (code: CodeMessage): string => tsec(`msg.${code}`);

/**
 * Bulle d'un message en partie, posée près du nom (même place que la réplique de Pomme). Une émote montre Mochi.
 * `qui` : le pseudo de l'adversaire, ou null pour « Tu dis ».
 */
export function BulleEchange({ code, qui }: { code: CodeMessage; qui: string | null }) {
  const texte = texteMessage(code);
  const aria = qui === null ? tsec('dire.moiAria', { message: texte }) : tsec('dire.bulleAria', { nom: qui, message: texte });
  return (
    <span className={`replique bulle-echange${estEmote(code) ? ' bulle-emote' : ''}`} role="status" aria-label={aria} data-testid={qui === null ? 'bulle-moi' : 'bulle-lui'} data-code={code}>
      {estEmote(code) ? <PortraitMochi humeur={HUMEURS[code]} taille={26} decoratif /> : <span aria-hidden="true">{fr(texte)}</span>}
    </span>
  );
}

/** Icône « Dire » de la barre d'actions : une bulle au trait, même famille que les chevrons (26 × 26). */
export function IconeDire() {
  return (
    <svg className="icone-trait" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M5 6.5h16a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 21 18h-9l-4.5 3.5V18H5a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 5 6.5Z" />
      <path d="M9 12.3h.01M13 12.3h.01M17 12.3h.01" />
    </svg>
  );
}

/** Interrupteur « Messages de l'adversaire » (44 px), pour la feuille « Dire » et les réglages. */
export function InterrupteurMessages({ coupes, onChange, className = 'menu-ligne menu-reglage' }: { coupes: boolean; onChange: (coupes: boolean) => void; className?: string }) {
  return (
    <button type="button" role="switch" aria-checked={!coupes} className={className} onClick={() => onChange(!coupes)} data-testid="reglage-messages">
      <span className="menu-libelle">{tsec('dire.reglage')}</span>
      <span className="menu-reglage-piste" aria-hidden="true"><i /></span>
    </button>
  );
}

interface DireProps {
  ouvert: boolean;
  onFermer: () => void;
  /** Envoie le message ; renvoie l'erreur à afficher, ou null. */
  onDire: (code: CodeMessage) => Promise<string | null>;
  nom: string;
  restants: number;
  envoi: boolean;
  coupes: boolean;
  onCouper: (coupes: boolean) => void;
  onSignaler: () => void;
}

/** Feuille « Dire » (#373) : 6 messages, 4 émotes de Mochi, le réglage pour couper, « Signaler » à côté. */
export function FeuilleDire({ ouvert, onFermer, onDire, nom, restants, envoi, coupes, onCouper, onSignaler }: DireProps) {
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => { if (ouvert) setErreur(null); }, [ouvert]);
  async function dire(code: CodeMessage) {
    const e = await onDire(code);
    if (e) setErreur(e); else onFermer();
  }
  const bloque = envoi || restants <= 0;
  return (
    <Feuille ouvert={ouvert} onFermer={onFermer} titre={tsec('dire.titre')} testId="feuille-dire">
      <p className="muted small">{fr(tsec('dire.texte'))}</p>
      <div className="dire-messages" role="group" aria-label={tsec('dire.messages')}>
        {MESSAGES.map(c => <button key={c} type="button" className="dire-message" disabled={bloque} onClick={() => dire(c)}>{fr(texteMessage(c))}</button>)}
      </div>
      <div className="dire-emotes" role="group" aria-label={tsec('dire.emotes')}>
        {EMOTES.map(c => (
          <button key={c} type="button" className="dire-emote" disabled={bloque} aria-label={texteMessage(c)} onClick={() => dire(c)}>
            <PortraitMochi humeur={HUMEURS[c]} taille={40} decoratif />
          </button>
        ))}
      </div>
      <p className={`small dire-etat${erreur ? ' erreur' : ''}`} role={erreur ? 'alert' : 'status'}>
        {erreur ? fr(erreur) : restants < 10 ? fr(tsec('dire.restants', { n: Math.max(0, restants) })) : ''}
      </p>
      <div className="dire-reglage">
        <InterrupteurMessages coupes={coupes} onChange={onCouper} />
        <p className="muted small">{fr(tsec('dire.reglageAide'))}</p>
      </div>
      <button type="button" className="lien lien-signaler" onClick={onSignaler}>{tsec('signaler.joueur', { nom })}</button>
    </Feuille>
  );
}

/** Ce qu'on signale depuis l'écran : un joueur (sa partie ou son pseudo), un problème, ou « Nous écrire ». */
export type Cible =
  | { type: 'joueur'; nom: string; partie?: string; pseudo?: string; depuis: 'partie' | 'amis' }
  | { type: 'probleme'; probleme: string }
  | { type: 'ecrire' };

interface SignalerProps {
  db: Db | null;
  ouvert: boolean;
  onFermer: () => void;
  cible: Cible;
  /** Compte avec pseudo : sans lui, le serveur refuse ; la feuille propose de le créer. */
  compte: boolean;
  onCompte?: () => void;
  /** Joueur bloqué (pour retirer la ligne de l'écran, sortir de la partie…). */
  onBloque?: () => void;
  online?: boolean;
}

const ECRAN: Record<Cible['type'], string> = { joueur: 'partie', probleme: 'probleme', ecrire: 'profil' };

/**
 * Feuille « Signaler » (#363) : motif (joueur, problème) ou sujet (« Nous écrire »), texte court (500 caractères),
 * « Bloquer aussi » pour un joueur. Une action principale, « Envoyer » ; puis Mochi : « Merci, on regarde. ».
 */
export function FeuilleSignaler({ db, ouvert, onFermer, cible, compte, onCompte, onBloque, online = true }: SignalerProps) {
  const [motif, setMotif] = useState<string | null>(null);
  const [sujet, setSujet] = useState<'bug' | 'idee' | 'autre'>('bug');
  const [texte, setTexte] = useState('');
  const [bloquerAussi, setBloquerAussi] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // #460 : l'erreur s'affiche à côté du champ à corriger (motif ou message), qui reçoit le focus ; les autres en bas.
  const [champ, setChamp] = useState<'motif' | 'texte' | null>(null);
  const [fait, setFait] = useState<{ signale: boolean; bloque: boolean } | null>(null);
  const idTexte = useId();
  const idAide = useId();
  const idMotif = useId();
  const idErreurTexte = useId();
  const refMotifs = useRef<HTMLFieldSetElement>(null);
  const refTexte = useRef<HTMLTextAreaElement>(null);

  // Chaque ouverture repart d'une feuille vierge.
  useEffect(() => {
    if (!ouvert) return;
    setMotif(null); setSujet('bug'); setTexte(''); setBloquerAussi(false); setErreur(null); setChamp(null); setFait(null); setEnvoi(false);
  }, [ouvert]);

  const titre = cible.type === 'joueur' ? tsec('signaler.joueurTitre', { nom: cible.nom })
    : cible.type === 'probleme' ? tsec('signaler.problemeTitre') : tsec('signaler.ecrireTitre');
  const depuis = cible.type === 'joueur' ? cible.depuis : cible.type === 'probleme' ? 'probleme' : 'profil';

  if (!compte || !db) {
    return (
      <Feuille ouvert={ouvert} onFermer={onFermer} titre={titre} testId="feuille-signaler">
        <p>{fr(tsec('signaler.compte'))}</p>
        {onCompte && <button type="button" className="btn primary" onClick={() => { onFermer(); onCompte(); }}>{tsec('signaler.compteAction')}</button>}
      </Feuille>
    );
  }

  const joueur = cible.type === 'joueur' ? cible : null;
  const cibleBlocage = joueur ? (joueur.partie ? { partie: joueur.partie } : { pseudo: joueur.pseudo ?? joueur.nom }) : null;

  async function bloquerSeul() {
    if (!db || !cibleBlocage || envoi) return;
    setEnvoi(true); setErreur(null); setChamp(null);
    const r = await bloquer(db, cibleBlocage);
    setEnvoi(false);
    if (!r.ok) { setErreur(r.error); return; }
    track(EVENTS.joueurBloque, { depuis });
    setFait({ signale: false, bloque: true });
    onBloque?.();
  }

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (!db || envoi) return;
    if (cible.type !== 'ecrire' && !motif) {
      setErreur(tsec('signaler.choisirMotif')); setChamp('motif');
      refMotifs.current?.querySelector('input')?.focus();
      return;
    }
    if (cible.type === 'ecrire' && !texte.trim()) {
      setErreur(tsec('signaler.ecrisMessage')); setChamp('texte');
      refTexte.current?.focus();
      return;
    }
    const demande: Demande = cible.type === 'joueur'
      ? { type: 'joueur', motif: motif as MotifJoueur, texte, partie: cible.partie, pseudo: cible.partie ? undefined : cible.pseudo ?? cible.nom }
      : cible.type === 'probleme' ? { type: 'probleme', motif: motif as MotifProbleme, texte, probleme: cible.probleme }
        : { type: sujet, texte };
    setEnvoi(true); setErreur(null); setChamp(null);
    const r = await signaler(db, demande, { version: analyticsConfig().release, ecran: ECRAN[cible.type] });
    if (!r.ok) { setEnvoi(false); setErreur(r.error); return; }
    let bloque = false;
    if (bloquerAussi && cibleBlocage) {
      const b = await bloquer(db, cibleBlocage);
      bloque = b.ok;
      if (b.ok) { track(EVENTS.joueurBloque, { depuis }); onBloque?.(); }
    }
    setEnvoi(false);
    // Jamais le texte, le pseudo ni la partie : le type, le motif et d'où.
    track(EVENTS.signalementEnvoye, { type: demande.type, motif: 'motif' in demande ? demande.motif : null, depuis, bloque });
    setFait({ signale: true, bloque });
  }

  if (fait) {
    return (
      <Feuille ouvert={ouvert} onFermer={onFermer} titre={titre} testId="feuille-signaler">
        <div className="signaler-merci" role="status">
          <PortraitMochi humeur="content" taille={56} decoratif />
          <div>
            {fait.signale && <p className="signaler-merci-titre">{tsec('signaler.merci')}</p>}
            {fait.signale && <p className="muted small">{fr(tsec('signaler.merciDetail'))}</p>}
            {fait.bloque && joueur && <p className={fait.signale ? 'small' : 'signaler-merci-titre'}>{fr(tsec('bloquer.fait', { nom: joueur.nom }))}</p>}
          </div>
        </div>
        <button type="button" className="btn primary" onClick={onFermer}>{tsec('signaler.fermer')}</button>
      </Feuille>
    );
  }

  const motifs: readonly string[] = cible.type === 'joueur' ? MOTIFS_JOUEUR : cible.type === 'probleme' ? MOTIFS_PROBLEME : [];
  const intro = cible.type === 'joueur' ? tsec('signaler.joueurTexte', { nom: cible.nom })
    : cible.type === 'probleme' ? tsec('signaler.problemeTexte') : tsec('signaler.ecrireTexte');
  const libelleTexte = cible.type === 'ecrire' ? tsec('signaler.message') : tsec('signaler.messageFacultatif');
  return (
    <Feuille ouvert={ouvert} onFermer={onFermer} titre={titre} testId="feuille-signaler">
      <form className="signaler-form" onSubmit={envoyer} noValidate>
        <p className="muted small">{fr(intro)}</p>
        {cible.type === 'ecrire' ? (
          <fieldset className="signaler-choix">
            <legend>{tsec('signaler.type')}</legend>
            <div className="seg">
              {(['bug', 'idee', 'autre'] as const).map(s => (
                <button key={s} type="button" aria-pressed={sujet === s} onClick={() => setSujet(s)}>{tsec(`signaler.type.${s}`)}</button>
              ))}
            </div>
          </fieldset>
        ) : (
          <fieldset ref={refMotifs} className="signaler-choix" aria-describedby={champ === 'motif' ? idMotif : undefined}>
            <legend>{tsec('signaler.motif')}</legend>
            {champ === 'motif' && erreur && <p id={idMotif} className="small signaler-erreur" role="alert">{fr(erreur)}</p>}
            {motifs.map(m => (
              <label key={m} className="signaler-motif">
                <input type="radio" name="motif" value={m} checked={motif === m} aria-invalid={champ === 'motif' || undefined}
                  onChange={() => { setMotif(m); setErreur(null); setChamp(null); }} />
                <span>{fr(tsec(`signaler.motif.${m}` as Parameters<typeof tsec>[0]))}</span>
              </label>
            ))}
          </fieldset>
        )}
        <label className="signaler-label" htmlFor={idTexte}>{libelleTexte}</label>
        <textarea ref={refTexte} id={idTexte} className="signaler-texte" rows={cible.type === 'ecrire' ? 4 : 2} maxLength={TEXTE_MAX} value={texte}
          aria-describedby={champ === 'texte' ? `${idErreurTexte} ${idAide}` : idAide} aria-invalid={champ === 'texte' || undefined}
          required={cible.type === 'ecrire'} onChange={e => { setTexte(e.target.value); if (erreur) { setErreur(null); setChamp(null); } }} />
        {champ === 'texte' && erreur && <p id={idErreurTexte} className="small signaler-erreur" role="alert">{fr(erreur)}</p>}
        <p id={idAide} className="muted small signaler-aide">
          <span>{fr(tsec('signaler.aideTexte'))}</span>
          <span className="signaler-compteur" aria-hidden="true">{tsec('signaler.compteur', { n: texte.length })}</span>
        </p>
        {joueur && (
          <label className="signaler-bloquer">
            <input type="checkbox" checked={bloquerAussi} onChange={e => setBloquerAussi(e.target.checked)} />
            <span><b>{tsec('bloquer.aussi', { nom: joueur.nom })}</b><small>{fr(tsec('bloquer.aussiAide'))}</small></span>
          </label>
        )}
        {!champ && (erreur || !online) && <p className="small signaler-erreur" role="alert">{erreur ? fr(erreur) : fr(tsec('erreur.horsLigne'))}</p>}
        <button type="submit" className="btn primary" disabled={envoi || !online} aria-busy={envoi}>{tsec(envoi ? 'signaler.envoi' : 'signaler.envoyer')}</button>
        {joueur && (
          <p className="signaler-seul">
            <span className="muted small">{tsec('bloquer.seul')}</span>{' '}
            <button type="button" className="lien" disabled={envoi || !online} onClick={bloquerSeul}>{tsec('bloquer.action', { nom: joueur.nom })}</button>
          </p>
        )}
      </form>
    </Feuille>
  );
}

/** « Cette réponse me semble fausse » sous le verdict d'un problème (#363), avec sa feuille. */
export function LienSignalerProbleme({ db, probleme, compte = true, onCompte }: { db: Db; probleme: string; compte?: boolean; onCompte?: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="signaler-probleme">
      <button type="button" className="lien lien-discret" onClick={() => setOuvert(true)}>{tsec('signaler.probleme')}</button>
      <FeuilleSignaler db={db} ouvert={ouvert} onFermer={() => setOuvert(false)} cible={{ type: 'probleme', probleme }} compte={compte} onCompte={onCompte} />
    </div>
  );
}

/** Icône « Signaler » du menu « Plus » : un petit drapeau au trait. */
export function IconeSignaler() {
  return (
    <svg className="icone-trait" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M7 22V5M7 5.5c3-1.6 5.6 1.6 8.6 0S20 4.8 20 4.8v8.4s-1.4 1-4.4 2.2S10 13.4 7 15" />
    </svg>
  );
}
