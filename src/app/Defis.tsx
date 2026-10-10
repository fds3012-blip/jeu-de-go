// Défi par lien (issue #81) : trois écrans.
// - DefisEcran : « Défier un ami ». Action principale : « Envoyer un lien » (crée le défi, puis Web Share API ou copie).
//   Dessous, les parties en cours contre des amis.
// - DefiArrivee : l'ami ouvre le lien (`#defi=JETON&de=Pseudo`) ; il voit le plateau et qui l'invite, crée son compte
//   (code par e-mail, puis pseudo obligatoire) AVANT son premier coup, puis rejoint la partie (#343 : plus d'anonymes).
// - DefiPartie : partie en différé, 3 jours par coup, résultat au temps ; suivie en temps réel.
// Logique pure : defiAmi.ts. Données : src/data/defi.ts.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Board } from '../ui/Board';
import { MiniGoban } from '../ui/MiniGoban';
import { Avatar, Bandeau, BarreActions, Coach, Icone, Interrupteur, ListeCoups } from '../ui/Partie';
import { BoutonAide } from '../ui/BoutonAide';
import { BoutonRetour, EnteteEcran } from '../ui/BoutonRetour';
import { fromSgf, toSgf } from '../go/coords';
import { groupAt } from '../go/rules';
import { score } from '../go/score';
import { deadToString, recordFromOnlineGame, validateMove } from '../go/server';
import { acceptScore, proposeDeadStones, resumeGame } from '../data/games';
import { fusionnerPartie } from '../data/tempsReel';
import {
  abandonnerDefi, abonnerDefi, creerDefi, FORMAT_JETON, jouerCoupDefi, lienDefi, lireDefi, mesDefis, messageRefus, ouvrirDefi, pseudoJoueur, type EtatDefi
} from '../data/defi';
import type { Db } from '../data/supabase';
import { EVENTS, track } from '../data/analytics';
import { useOnline } from './hooks';
import { usePreferences } from './settings';
import { phraseEtat, phraseIssue, resumeDefi, vueDefi } from './defiAmi';
import { depuisDefi } from './historique';
import { adversaireDe, lirePseudos, type Pseudos } from '../data/pseudos';
import { libelleCoup } from './partie';
import { Revue } from './Revue';
import { LierEmail } from './Account';
import { GainCote, VocabulaireGrade } from '../ui/Cote';
import { texteAdversaire } from '../content/i18n/cote';
import { coteJoueur } from '../data/cote';
import { ConnexionCode } from './Connexion';
import type { Sens } from './connexionBascule';
import type { EtatCompte } from './essai';
import '../ui/compte.css';
import { fr } from '../ui/typo';
import { langue, nombre, t } from '../content/i18n/secondaires';
// #364 : lien court (`mochi-go.app/defi#…`), avec sa page d'aperçu.
import { originePartage } from './partage';
import '../ui/defis.css';
import { joursDuDelai } from '../data/lente';
import { tl } from '../content/i18n/lente';
import { useEchanges } from './echanges';

type Partage = 'partage' | 'copie' | 'manuel' | 'annule';

/** Partage du lien : feuille de partage du téléphone, sinon copie dans le presse-papiers, sinon lien à copier à la main. */
async function partager(lien: string): Promise<Partage> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: t('defi.partage.titre'), text: t('defi.partage.texte'), url: lien });
      return 'partage';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'annule';
    }
  }
  try {
    await navigator.clipboard.writeText(lien);
    return 'copie';
  } catch {
    return 'manuel';
  }
}

/** Carte du lien créé : texte d'état, lien lisible, et « Copier le lien » si le partage n'a pas eu lieu. */
function CarteLien({ lien, partage }: { lien: string; partage: Partage }) {
  const [copie, setCopie] = useState(partage === 'copie');
  const copier = async () => {
    try { await navigator.clipboard.writeText(lien); setCopie(true); } catch { setCopie(false); }
  };
  return (
    <div className="card defi-lien" data-testid="defi-lien">
      <p className="small" role="status" style={{ margin: 0 }}>{fr(t(copie ? 'defi.copie' : partage === 'manuel' ? 'defi.copierManuel' : 'defi.lienPret'))}</p>
      <input className="defi-lien-texte" readOnly value={lien} aria-label={t('defi.copier')} onFocus={e => e.currentTarget.select()} />
      {!copie && <button type="button" className="btn" onClick={copier}>{t('defi.copier')}</button>}
    </div>
  );
}

/** Date courte d'une partie (« 29 sept. »). */
const dateCourte = (iso: string) => {
  try { return new Date(iso).toLocaleDateString(document.documentElement.lang || undefined, { day: 'numeric', month: 'short' }); } catch { return iso.slice(0, 10); }
};

interface EcranProps {
  db: Db | null;
  /** Identifiant de la session (compte ou anonyme) ; undefined pendant le chargement, null sans session. */
  userId: string | null | undefined;
  /** Pseudo du joueur : il est mis dans le lien, pour que l'ami sache qui le défie (#343). */
  pseudo?: string | null;
  onPartie: (id: string) => void;
  /** #509 (L2) : barre « ‹ Défier un ami », retour à l'accueil. */
  onRetour?: () => void;
}

/** « Défier un ami » : créer un lien, puis retrouver ses parties contre des amis. */
export function DefisEcran({ db, userId, pseudo = null, onPartie, onRetour }: EcranProps) {
  const online = useOnline();
  const [creation, setCreation] = useState<{ etat: 'repos' } | { etat: 'cours' } | { etat: 'erreur'; message: string } | { etat: 'pret'; lien: string; partage: Partage }>({ etat: 'repos' });
  const [liste, setListe] = useState<{ etat: 'chargement' } | { etat: 'erreur' } | { etat: 'pret'; defis: EtatDefi[]; pseudos: Pseudos }>({ etat: 'chargement' });
  const [essai, setEssai] = useState(0);
  // #400 : pseudos des amis, gardés d'une lecture à l'autre (un nouveau défi ne relit que le nouvel ami).
  const pseudos = useRef<Pseudos>(new Map());

  useEffect(() => {
    if (!db || !userId || !online) { setListe({ etat: 'pret', defis: [], pseudos: pseudos.current }); return; }
    let vivant = true;
    setListe({ etat: 'chargement' });
    mesDefis(db, userId).then(async r0 => {
      // #440 : les parties lentes (défis classés) ont leur propre écran ; ici, les seuls défis entre amis.
      const r = r0.ok ? { ...r0, value: r0.value.filter(d => !d.partie.rated) } : r0;
      // Une seule lecture des profils pour toute la liste, avant d'afficher : le nom arrive avec la ligne.
      if (r.ok) await lirePseudos(db, r.value.map(d => adversaireDe(d.partie, userId)), pseudos.current);
      if (vivant) setListe(r.ok ? { etat: 'pret', defis: r.value, pseudos: pseudos.current } : { etat: 'erreur' });
    });
    return () => { vivant = false; };
  }, [db, userId, online, essai]);

  const tete = onRetour ? <EnteteEcran titre={t('defi.titre')} retour={t('defi.retour')} onRetour={onRetour} /> : null;
  if (!db) {
    return <div className="defis">{tete}<p className="card muted">{fr(t('defi.indisponible'))}</p></div>;
  }

  async function creer() {
    if (!db || creation.etat === 'cours') return;
    setCreation({ etat: 'cours' });
    const r = await creerDefi(db);
    if (!r.ok) { setCreation({ etat: 'erreur', message: r.error }); return; }
    const lien = lienDefi(r.value.jeton, originePartage(), pseudo, langue());
    const partage = await partager(lien);
    // Jamais le lien, le jeton ni la partie dans l'événement (constat E14).
    track(EVENTS.defiCree, { partage: partage === 'partage' ? 'web_share' : partage === 'copie' ? 'copie' : partage, anonyme: r.value.anonyme });
    setCreation({ etat: 'pret', lien, partage });
    setEssai(n => n + 1);
  }

  const vues = liste.etat === 'pret' ? liste.defis.map(d => ({ d, v: vueDefi(d.partie, d.defi, userId ?? undefined) })) : [];
  return (
    <div className="defis">
      {tete}
      <div className="defis-tete">
        <DeuxPierres />
        <p className="defis-intro">{fr(t('defi.intro'))}</p>
        <p className="muted small">{fr(t('defi.regle'))}</p>
      </div>
      {!online && <p className="card small" role="status">{fr(t('defi.horsLigne'))}</p>}
      {/* Lien créé : l'action principale renvoie le même lien (pas un nouveau défi à chaque toucher). */}
      {creation.etat === 'pret'
        ? <button type="button" className="btn primary defis-cta" onClick={async () => { const p = await partager(creation.lien); if (p !== 'annule') setCreation({ ...creation, partage: p }); }}>{t('defi.renvoyer')}</button>
        : <button type="button" className="btn primary defis-cta" onClick={creer} disabled={creation.etat === 'cours' || !online} aria-busy={creation.etat === 'cours'}>
          {t(creation.etat === 'cours' ? 'defi.creation' : 'defi.creer')}
        </button>}
      {creation.etat === 'erreur' && <p className="small defi-erreur" role="alert">{fr(creation.message)}</p>}
      {creation.etat === 'pret' && <CarteLien key={creation.partage} lien={creation.lien} partage={creation.partage} />}

      {liste.etat === 'chargement' && <p className="muted small" aria-busy="true">{t('defi.chargement')}</p>}
      {liste.etat === 'erreur' && (
        <p className="card small" role="alert">{t('defi.erreur.chargement')} <button type="button" className="lien" onClick={() => setEssai(n => n + 1)}>{t('defi.reessayer')}</button></p>
      )}
      {/* Audit du 02/10 (n° 2) : sans partie, l'écran disait seulement « Envoyer un lien ». L'état vide montre où les
          parties arriveront et comment on sait que c'est son tour ; il n'ajoute aucune action. */}
      {liste.etat === 'pret' && vues.length === 0 && online && (
        <section className="defis-liste defis-vide" aria-labelledby="defis-liste-titre">
          <h2 id="defis-liste-titre">{t('defi.tesParties')}</h2>
          <div className="defis-vide-tuile">
            <MiniGoban rows={PARTIE_EXEMPLE} className="defis-vide-goban" />
            <p className="small">{fr(t('defi.vide'))}</p>
          </div>
        </section>
      )}
      {vues.length > 0 && (
        <section className="defis-liste" aria-labelledby="defis-liste-titre">
          <h2 id="defis-liste-titre">{t('defi.tesParties')}</h2>
          <ul>
            {vues.map(({ d, v }) => {
              // #400 : le pseudo de l'ami (« Ton ami » s'il n'en a pas) ; « Partie du… » tant que le lien n'est pas ouvert.
              const ami = userId ? adversaireDe(d.partie, userId) : null;
              const pseudo = ami && liste.etat === 'pret' ? liste.pseudos.get(ami) ?? null : null;
              const nom = ami ? pseudo || t('defi.adversaire') : null;
              const r = resumeDefi(v, pseudo);
              const date = dateCourte(d.defi.cree_le);
              return (
                <li key={d.defi.partie_id}>
                  <button type="button" className={`defi-ligne${r.aMoi ? ' a-moi' : ''}`} onClick={() => onPartie(d.defi.partie_id)}>
                    <span className="defi-ligne-texte">
                      {nom
                        ? <span className="defi-ligne-haut"><b className="defi-ligne-nom">{nom}</b><span className="defi-ligne-date">{date}</span></span>
                        : <b>{t('defi.liste.contre', { date })}</b>}
                      <small>{r.etat}</small>
                    </span>
                    {r.aMoi && <span className="defi-point" aria-hidden="true" />}
                    <span className="defi-chevron" aria-hidden="true">›</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Début de partie 9 × 9 pour l'état vide : quatre pierres posées, la partie qui attend son ami. */
const PARTIE_EXEMPLE = ['.........', '.........', '......O..', '.........', '....X....', '.........', '..X...O..', '.........', '.........'];

/** Deux pierres qui se font face : l'illustration de l'écran (décorative). */
function DeuxPierres() {
  return (
    <span className="defis-pierres" aria-hidden="true">
      <span className="stone b" /><span className="stone w" />
    </span>
  );
}

/** Plateau 9 × 9 vide, pour l'aperçu du défi : c'est à l'ami de poser la première pierre. */
const PLATEAU_VIDE = new Int8Array(81);

/**
 * L'ami ouvre le lien (#343) : il voit le plateau et qui l'invite. Sans compte, il crée son compte (code par e-mail,
 * puis pseudo, demandé par l'app avant tout le reste) ; une ancienne session anonyme lie son e-mail. Avec un compte
 * complet, il rejoint la partie et joue son premier coup.
 */
export function DefiArrivee({ db, jeton, inviteur = null, compte, onPartie, onAccueil }: {
  db: Db | null; jeton: string; inviteur?: string | null; compte: EtatCompte; onPartie: (id: string) => void; onAccueil: () => void;
}) {
  const online = useOnline();
  const [erreur, setErreur] = useState<string | null>(null);
  const [essai, setEssai] = useState(0);
  const [sens, setSens] = useState<Sens>('creer');
  const fait = useRef(false);
  useEffect(() => {
    if (!db || !online || fait.current || compte !== 'complet') return;
    let vivant = true;
    setErreur(null);
    ouvrirDefi(db, jeton).then(r => {
      if (!vivant) return;
      if (!r.ok) { setErreur(r.error); return; }
      fait.current = true;
      // Jamais le jeton ni l'identifiant de la partie dans l'événement (constat E14).
      track(EVENTS.defiOuvert, { anonyme: false, deja_joueur: r.value.createur });
      onPartie(r.value.partieId);
    });
    return () => { vivant = false; };
  }, [db, jeton, online, essai, onPartie, compte]);

  // Lien abîmé : on le dit tout de suite, sans faire créer un compte pour rien.
  const invalide = !FORMAT_JETON.test(jeton);
  const message = invalide ? t('defi.erreur.introuvable') : !db ? t('defi.indisponible') : !online ? t('defi.horsLigne') : erreur;
  if (db && !message && (compte === 'aucun' || compte === 'anonyme')) {
    return (
      <div className="defis defi-arrivee defi-apercu" data-testid="defi-apercu">
        <div className="creer-tete">
          <h2 className="creer-titre">{inviteur ? t('defi.arrivee.titre', { pseudo: inviteur }) : t('defi.arrivee.titreSansNom')}</h2>
          <p className="creer-raison">{fr(t('defi.arrivee.texte'))}</p>
        </div>
        <div className="defi-apercu-plateau" role="img" aria-label={t('defi.arrivee.plateau')}>
          <Board size={9} board={PLATEAU_VIDE} toPlay={1} interactive={false} />
        </div>
        <div className="card">
          <p className="small" style={{ margin: '0 0 8px' }}><b>{fr(t(sens === 'creer' ? 'defi.arrivee.compte' : 'defi.arrivee.connexion'))}</b></p>
          {/* #353 : une fois connecté (compte existant), le jeton est gardé : l'effet ci-dessus rejoint ce défi. */}
          <ConnexionCode db={db} mode={compte === 'anonyme' ? 'liaison' : 'connexion'} moment="arrivee" onSens={setSens} />
        </div>
        <button type="button" className="lien creer-plus-tard" onClick={onAccueil}>{t('defi.retourAccueil')}</button>
      </div>
    );
  }
  return (
    <div className="defis defi-arrivee">
      <div className="defis-tete">
        <DeuxPierres />
        {!message && <p className="defis-intro" role="status" aria-busy="true">{t('defi.arrivee')}</p>}
      </div>
      {message && (
        <>
          <p className="card" role="alert">{fr(message)}</p>
          {db && online && !invalide && <button type="button" className="btn" onClick={() => setEssai(n => n + 1)}>{t('defi.reessayer')}</button>}
          <button type="button" className="btn primary defis-cta" onClick={onAccueil}>{t('defi.retourAccueil')}</button>
        </>
      )}
    </div>
  );
}

interface PartieProps {
  db: Db;
  partieId: string;
  userId: string | undefined;
  /** Ancienne session anonyme (#81) : elle lie son e-mail avant de jouer le coup suivant (#343). */
  anonyme: boolean;
  /** #417 : réglage « Célébrations » (confettis au changement de grade après une partie classée). */
  celebrer?: boolean;
  /** Pseudo du joueur, mis dans le lien renvoyé. */
  pseudo?: string | null;
  confirmTouch: boolean;
  /** Réglage du menu « Plus » (comme l'écran de partie v3) : confirmation au doigt, sans quitter la partie. */
  reglages?: { modifier: (patch: { confirmTouch?: boolean }) => void };
  onRetour: () => void;
  onAutre: () => void;
  /** #440 : fin d'une partie lente, « Nouvelle partie lente » (sans elle : `onAutre`). */
  onAutreLente?: () => void;
}

/**
 * Partie en différé contre un ami. #393 : même grammaire que l'écran de partie v3 (#384) : le pseudo de l'ami sur son
 * bandeau, le ruban des coups avec le « ? » de l'aide (#390), Mochi sous ton bandeau, « Passer » en bouton plein et
 * « Abandonner » rangé dans le menu « Plus ».
 */
export function DefiPartie({ db, partieId, userId, anonyme, pseudo = null, confirmTouch, reglages, celebrer, onRetour, onAutre, onAutreLente }: PartieProps) {
  const prefs = usePreferences(); // #365 : coordonnées et dernier coup
  const online = useOnline();
  const [etat, setEtat] = useState<{ etat: 'chargement' } | { etat: 'erreur'; message: string } | { etat: 'pret'; d: EtatDefi }>({ etat: 'chargement' });
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [abandon, setAbandon] = useState(false);
  const [lienCopie, setLienCopie] = useState<Partage | null>(null);
  const [mortes, setMortes] = useState<Set<number> | null>(null);
  // #358 : défi terminé, revue de la partie (écran de revue existant), du point de vue du joueur.
  const [enRevue, setEnRevue] = useState(false);
  // Pseudo de l'ami (#393), lu une fois dans son profil ; null : inconnu, l'écran dit « Ton ami ».
  const [nomAmi, setNomAmi] = useState<string | null>(null);
  const pseudosLus = useRef(new Map<string, string | null>());
  // #417 : partie classée, cote et grade de l'adversaire sous son nom (lus une fois).
  const [coteAmi, setCoteAmi] = useState<{ cote: number; provisoire: boolean } | null>(null);

  // #425 : numéro de la dernière lecture lancée, ou du dernier événement temps réel appliqué. Une lecture partie
  // avant un événement plus récent est ignorée : elle n'efface pas un coup déjà affiché.
  const version = useRef(0);
  const charger = useCallback(async () => {
    const n = ++version.current;
    const r = await lireDefi(db, partieId);
    // L'ami est lu avant d'afficher la partie : son nom arrive en même temps que le plateau, sans « Ton ami » qui clignote.
    const ami = r.ok && userId ? (r.value.partie.black_id === userId ? r.value.partie.white_id : r.value.partie.black_id) : null;
    if (ami && !pseudosLus.current.has(ami)) pseudosLus.current.set(ami, await pseudoJoueur(db, ami));
    if (ami) setNomAmi(pseudosLus.current.get(ami) ?? null);
    if (ami && r.ok && r.value.partie.rated) void coteJoueur(db, ami).then(setCoteAmi);
    if (n !== version.current) return;
    setMaintenant(Date.now());
    setEtat(prev => (r.ok ? { etat: 'pret', d: r.value } : prev.etat === 'pret' ? prev : { etat: 'erreur', message: r.error }));
  }, [db, partieId, userId]);
  const chargerRef = useRef(charger);
  chargerRef.current = charger;
  // Après un événement : relecture complète en arrière-plan (notifications lues, victoire au temps), une seule pour
  // les deux événements d'un même coup (`games` puis `defis`). Le coup, lui, est déjà affiché.
  const relecture = useRef<ReturnType<typeof setTimeout>>(undefined);
  const relireBientot = useCallback(() => {
    clearTimeout(relecture.current);
    relecture.current = setTimeout(() => { void chargerRef.current(); }, 400);
  }, []);
  useEffect(() => () => clearTimeout(relecture.current), []);

  useEffect(() => { void charger(); }, [charger]);
  // Avant la première lecture, un événement n'a rien à mettre à jour : il ne doit pas faire ignorer cette lecture.
  const pret = useRef(false);
  pret.current = etat.etat === 'pret';
  // Temps réel (#425) : le coup de l'ami est affiché dès l'événement, avec la ligne reçue (sans relire la base).
  // Réabonnement et relecture au retour au premier plan ou du réseau : src/data/tempsReel.ts.
  useEffect(() => abonnerDefi(db, partieId, {
    surPartie: ligne => {
      if (!pret.current) return;
      version.current++;
      setMaintenant(Date.now());
      setEtat(prev => {
        if (prev.etat !== 'pret') return prev;
        const partie = fusionnerPartie(prev.d.partie, ligne);
        if (!partie) return prev;
        const resultat = typeof ligne.result === 'string' ? ligne.result : prev.d.resultat;
        return { etat: 'pret', d: { ...prev.d, partie, resultat } };
      });
      relireBientot();
    },
    surDefi: ligne => {
      if (!pret.current) return;
      version.current++;
      setEtat(prev => (prev.etat === 'pret' && ('date_limite' in ligne) && (ligne.date_limite === null || typeof ligne.date_limite === 'string')
        ? { etat: 'pret', d: { ...prev.d, defi: { ...prev.d.defi, date_limite: ligne.date_limite } } } : prev));
      relireBientot();
    },
    rattraper: () => { void chargerRef.current(); }
  }), [db, partieId, relireBientot]);
  useEffect(() => {
    const tic = setInterval(() => setMaintenant(Date.now()), 60_000);
    return () => clearInterval(tic);
  }, []);

  const d = etat.etat === 'pret' ? etat.d : null;
  const v = useMemo(() => (d ? vueDefi(d.partie, d.defi, userId, maintenant, d.resultat) : null), [d, userId, maintenant]);
  // #440 : partie lente (défi classé) finie sous les yeux du joueur : mesurée une fois (jamais la partie ni l'adversaire).
  const phaseVue = useRef<string | null>(null);
  useEffect(() => {
    if (!d || !v) return;
    const avant = phaseVue.current;
    phaseVue.current = v.phase;
    if (!d.partie.rated || v.phase !== 'fini' || avant === null || avant === 'fini') return;
    const annulee = d.partie.status === 'aborted';
    track(EVENTS.partieLenteTerminee, {
      taille: d.partie.size, delai_jours: joursDuDelai(d.defi.delai_coup),
      issue: annulee ? 'annulee' : !v.issue || v.issue.gagne === null ? 'egalite' : v.issue.gagne ? 'victoire' : 'defaite',
      raison: annulee ? 'annulee' : v.issue?.raison === 'egalite' ? 'points' : v.issue?.raison ?? 'points',
      coups: Math.floor(d.partie.moves.length / 2),
    });
  }, [d, v]);
  // Comptage : les pierres mortes proposées, modifiables d'un toucher ; repartent de la proposition à chaque changement.
  const cleMortes = d ? `${d.partie.moves}|${d.partie.dead_stones ?? ''}|${d.partie.counting}` : '';
  useEffect(() => { setMortes(null); }, [cleMortes]);

  // #373 et #363 : « Dire » (messages prédéfinis, émotes), bulles près des noms, « Signaler ce joueur ». Pas pour une
  // ancienne session anonyme, ni avant l'arrivée de l'ami.
  const avecAmi = !!d && !!d.partie.black_id && !!d.partie.white_id;
  const echanges = useEchanges({ db, partieId, userId, nom: nomAmi ?? t('defi.adversaire'), actif: avecAmi && !anonyme, online, mode: 'defi' });

  const retour = <BoutonRetour label={t('defi.retour')} onClick={onRetour} />;

  if (!d || !v) {
    return (
      <div className="partie defi-partie defi-partie-charge">
        <div className="joueur">{retour}</div>
        {etat.etat === 'erreur'
          ? <div className="defi-charge"><p className="card" role="alert">{fr(etat.message)}</p><button type="button" className="btn primary defis-cta" onClick={() => { setEtat({ etat: 'chargement' }); void charger(); }}>{t('defi.reessayer')}</button></div>
          : <p className="muted defi-charge" aria-busy="true">{t('defi.chargement')}</p>}
      </div>
    );
  }

  const partie = d.partie;
  const moi: 1 | 2 = v.couleur ?? 1;
  const revue = v.phase === 'fini' && userId ? depuisDefi(partie, userId, d.resultat) : null;
  if (enRevue && revue) {
    return <Revue sgf={revue.sgf} joueur={revue.joueur} adversaire={nomAmi ?? t('defi.adversaire')} confirmTouch={confirmTouch}
      retour={t('defi.revueRetour')} onRetour={() => { setEnRevue(false); window.scrollTo?.({ top: 0 }); }} />;
  }
  const lui = (3 - moi) as 1 | 2;
  const enComptage = v.phase === 'comptage';
  const mortesVues = mortes ?? new Set(v.mortes);
  const sc = enComptage || (v.phase === 'fini' && v.issue?.raison === 'points') ? score(v.pos, Number(partie.komi), partie.rules === 'chinese' ? 'chinese' : 'japanese', mortesVues) : null;
  const inchangee = mortes === null;

  async function envoyer(coup: string) {
    if (!d) return;
    const record = recordFromOnlineGame({ size: partie.size, komi: Number(partie.komi), rules: partie.rules === 'chinese' ? 'chinese' : 'japanese', handicap: partie.handicap, moves: partie.moves });
    const local = record ? validateMove(record, coup) : null;
    if (local && !local.ok) { setRefus(messageRefus({ error: local.error, message: local.message })); return; }
    setEnvoi(true); setRefus(null);
    // #425 : le coup, déjà vérifié ici avec les mêmes règles que le serveur, s'affiche tout de suite (sans attendre la
    // fonction serveur). Refusé par le serveur, il disparaît à la relecture.
    const avant = partie.moves;
    version.current++;
    setEtat(prev => (prev.etat === 'pret' && prev.d.partie.moves === avant
      ? { etat: 'pret', d: { ...prev.d, partie: { ...prev.d.partie, moves: avant + coup } } } : prev));
    const r = await jouerCoupDefi(db, partieId, coup);
    setEnvoi(false);
    if (!r.ok) { setRefus(r.error); void charger(); return; }
    // Coup accepté : la ligne renvoyée par le serveur (comptage après deux passes), sauf si l'affichage est déjà plus loin.
    if (r.value) {
      const ligne = r.value as Record<string, unknown>;
      version.current++;
      setEtat(prev => {
        if (prev.etat !== 'pret') return prev;
        const p = fusionnerPartie(prev.d.partie, ligne);
        return p ? { etat: 'pret', d: { ...prev.d, partie: p } } : prev;
      });
    }
    relireBientot();
  }

  function toucher(p: number) {
    if (enComptage) {
      if (!v || !v.pos.board[p]) return;
      const suivant = new Set(mortesVues);
      const groupe = groupAt(v.pos.board, v.pos.size, p).stones;
      const mort = suivant.has(p);
      for (const s of groupe) { if (mort) suivant.delete(s); else suivant.add(s); }
      setMortes(suivant);
      return;
    }
    if (!v?.aMoi || envoi || !online || anonyme) return;
    void envoyer(toSgf(p, partie.size));
  }

  async function agirComptage(action: 'proposer' | 'accepter' | 'reprendre') {
    setEnvoi(true); setRefus(null);
    const r = action === 'proposer' ? await proposeDeadStones(db, partieId, deadToString([...mortesVues].sort((a, b) => a - b), partie.size))
      : action === 'accepter' ? await acceptScore(db, partieId) : await resumeGame(db, partieId);
    setEnvoi(false);
    if (!r.ok) setRefus(r.error);
    void charger();
  }

  async function abandonner() {
    if (!abandon) { setAbandon(true); return; }
    setAbandon(false); setEnvoi(true);
    const r = await abandonnerDefi(db, partieId);
    setEnvoi(false);
    if (!r.ok) setRefus(r.error);
    void charger();
  }

  async function renvoyer() {
    setLienCopie(await partager(lienDefi(d!.defi.jeton, originePartage(), pseudo, langue())));
  }

  const nomLui = nomAmi ?? (partie.rated ? tl('lente.adversaire') : t('defi.adversaire'));
  const nom = (c: 1 | 2) => (c === moi ? t('defi.toi') : nomLui);
  const coups = (partie.moves.match(/../g) ?? []).map((m, i) => libelleCoup(i + 1, fromSgf(m, partie.size), partie.size));
  const sousTitreCouleur = (c: 1 | 2) => (c === 1 ? t('defi.noir') : t('defi.blanc', { komi: nombre(Number(partie.komi)) }));
  // #417 : partie classée, le grade et la cote de l'adversaire à la place de sa couleur (sa pierre la montre déjà).
  const sousTitre = (c: 1 | 2) => (c === lui && partie.rated && coteAmi ? texteAdversaire(coteAmi.cote, coteAmi.provisoire) : sousTitreCouleur(c));
  const bandeau = (c: 1 | 2, avant?: ReactNode) => (
    <Bandeau nom={nom(c)} sousTitre={sousTitre(c)} actif={v.phase === 'jeu' && v.trait === c} captures={v.pos.captures[c]}
      pierresPrises={c === 1 ? 'blanc' : 'noir'} portrait={<Avatar couleur={c} />} avant={avant} bulle={c === lui ? echanges.bulleLui : echanges.bulleMoi} />
  );

  const bienvenue = v.phase === 'jeu' && v.couleur === 1 && v.mesCoups === 0 && v.aMoi;
  // #440 : partie lente (défi classé) : son délai (1 à 3 jours), son accueil, et l'annulation quand personne n'a joué.
  const lente = partie.rated;
  const joursCoup = joursDuDelai(d.defi.delai_coup) ?? 3;
  const finTexte = lente && partie.status === 'aborted' ? tl('lente.fin.annulee')
    : lente && v.issue?.raison === 'temps' ? (v.issue.gagne ? tl('lente.fin.gagne.temps', { nom: nomLui }) : tl('lente.fin.perdu.temps'))
      : phraseIssue(v.issue, nomAmi);
  const message = refus ?? (envoi ? t('defi.envoi') : !online ? t('defi.horsLigne')
    : bienvenue ? (lente ? tl('lente.partie.bienvenue', { nom: nomLui }) : nomAmi ? t('defi.bienvenueNom', { nom: nomAmi }) : t('defi.bienvenue'))
      : v.phase === 'fini' ? finTexte : phraseEtat(v, nomAmi));
  // #343 : une ancienne session anonyme lie son e-mail avant de continuer (le serveur refuse désormais les anonymes).
  const proposerInscription = anonyme && v.phase !== 'fini';

  return (
    <div className={`partie defi-partie phase-${v.phase}`} data-phase={v.phase}>
      {bandeau(lui, retour)}
      {/* #390 : « ? » au bout du ruban des coups, sans quitter la partie ; pendant le comptage, il ouvre « Compter ». */}
      <ListeCoups coups={coups} apres={<BoutonAide depuis="partie" fiche={enComptage ? 'compter' : 'regles'} className="ruban-aide" />} />
      <div className="partie-plateau">
        <Board lieu="en_ligne" size={partie.size} board={v.pos.board} toPlay={v.pos.toPlay} confirmTouch={confirmTouch}
          interactive={!anonyme && ((v.aMoi && !envoi && online) || (enComptage && !envoi && !v.proposeParMoi))} stonesTappable={enComptage}
          coordonnees={prefs.coordonnees} marks={{ last: prefs.dernierCoup ? v.pos.lastMove : null, owner: sc?.owner, dead: enComptage || v.phase === 'fini' ? mortesVues : undefined }}
          onPlay={toucher} noms={{ [lui]: nomLui }} />
      </div>
      {bandeau(moi)}
      {/* v3 : Mochi juste sous ton bandeau, dans une zone de hauteur stable (partie.css). */}
      <div className="partie-mochi">
        <Coach cle={message} attente={envoi}>{fr(message)}</Coach>
      </div>
      <div className="defi-bas">
        {/* La règle des 3 jours, dite avant ton premier coup ; ensuite, Mochi dit le temps qui reste (écrans bas : Mochi seul). */}
        {v.phase === 'jeu' && v.mesCoups === 0 && <p className="muted small defi-rappel">{fr(lente ? tl('lente.partie.rappel', { delai: t('defi.delai.jours', { n: joursCoup }) }) : t('defi.rappelDelai'))}</p>}
        {sc && <p className="comptage">{fr(t('defi.comptage.score', { pn: nombre(sc.black), pb: nombre(sc.white) }))}</p>}

        {v.phase === 'attente' && (
          <>
            <button type="button" className="btn primary defis-cta" onClick={renvoyer}>{t('defi.renvoyer')}</button>
            {lienCopie && lienCopie !== 'partage' && lienCopie !== 'annule' && <CarteLien lien={lienDefi(d.defi.jeton, originePartage(), pseudo, langue())} partage={lienCopie} />}
          </>
        )}
        {enComptage && (
          <div className="barre-comptage defi-comptage" role="group" aria-label={t('partie.comptageAria')}>
            <button type="button" className="btn" onClick={() => agirComptage('reprendre')} disabled={envoi}>{t('defi.comptage.reprendre')}</button>
            {v.proposeParAutre && inchangee
              ? <button type="button" className="btn primary" onClick={() => agirComptage('accepter')} disabled={envoi}>{t('defi.comptage.accepter')}</button>
              : <button type="button" className="btn primary" onClick={() => agirComptage('proposer')} disabled={envoi || (v.proposeParMoi && inchangee)}>{t('defi.comptage.proposer')}</button>}
          </div>
        )}
        {v.phase === 'fini' && (
          <div className="defi-fin">
            <p className="defi-fin-titre" role="status">{fr(finTexte)}</p>
            {/* #417 : partie classée entre humains, « +14 » et le grade ; jamais pour une partie non classée. */}
            {partie.rated && userId && !anonyme && <GainCote db={db} gameId={partie.id} userId={userId} celebrer={celebrer} />}
            <button type="button" className="btn primary defis-cta" onClick={lente ? onAutreLente ?? onAutre : onAutre}>{lente ? tl('lente.autre') : t('defi.autre')}</button>
            {revue && <button type="button" className="lien" onClick={() => { setEnRevue(true); window.scrollTo?.({ top: 0 }); }}>{t('fin.revoir')}</button>}
            <button type="button" className="lien" onClick={onRetour}>{t('defi.retourAccueil')}</button>
            {echanges.liensFin}
            {partie.rated && userId && !anonyme && <VocabulaireGrade />}
          </div>
        )}
        {proposerInscription && (
          <div className="defi-inscription">
            <LierEmail db={db} moment="apres_coup" coups={v.mesCoups} titre={t('defi.inscription.titre')} texte={t('defi.inscription.texte')} />
          </div>
        )}
      </div>
      <div className="partie-souffle" aria-hidden="true" />
      {v.phase === 'jeu' && (
        // v3 (#384) : pas d'aide de jeu contre un ami (#373 : seulement « Dire ») ; « Passer » en bouton plein, « Abandonner » et le réglage dans « Plus ».
        <BarreActions label={t('partie.actions')} actions={[
          ...(echanges.action ? [echanges.action] : []),
          { label: t('partie.action.passer'), icone: <Icone nom="passer" />, onClick: () => { void envoyer('tt'); }, disabled: !v.aMoi || envoi || !online || anonyme, groupe: 'decision', principale: true },
        ]} menu={{
          label: t('partie.action.plus'),
          actions: [
            { label: abandon ? fr(t('partie.action.confirmer')) : t('partie.action.abandonner'), action: 'abandonner', icone: <Icone nom="abandonner" />,
              onClick: abandonner, danger: abandon, disabled: envoi || !online || anonyme, reste: true },
            ...echanges.menu,
          ],
          reglages: <>
            {reglages && <Interrupteur label={t('profil.confirmer')} actif={confirmTouch} onChange={c => reglages.modifier({ confirmTouch: c })} />}
            {echanges.reglage}
          </>,
        }} />
      )}
      {echanges.feuilles}
    </div>
  );
}

// useDefisEnAttente (accueil, pastilles, « À faire » #367) est dans defisAJouer.ts (#323) : l’app s’en sert sans charger cet écran.
