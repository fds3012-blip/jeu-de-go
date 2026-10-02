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
import { Avatar, Bandeau, BarreActions, Coach, Icone } from '../ui/Partie';
import { toSgf } from '../go/coords';
import { groupAt } from '../go/rules';
import { score } from '../go/score';
import { deadToString, recordFromOnlineGame, validateMove } from '../go/server';
import { acceptScore, proposeDeadStones, resumeGame, type Game } from '../data/games';
import {
  abandonnerDefi, abonnerDefi, creerDefi, FORMAT_JETON, jouerCoupDefi, lienDefi, lireDefi, mesDefis, messageRefus, ouvrirDefi, type EtatDefi
} from '../data/defi';
import type { Db } from '../data/supabase';
import { EVENTS, track } from '../data/analytics';
import { useOnline } from './hooks';
import { phraseEtat, phraseIssue, resumeDefi, vueDefi } from './defiAmi';
import { depuisDefi } from './historique';
import { Revue } from './Revue';
import { LierEmail } from './Account';
import { ConnexionCode } from './Connexion';
import type { Sens } from './connexionBascule';
import type { EtatCompte } from './essai';
import '../ui/compte.css';
import { fr } from '../ui/typo';
import { nombre, t } from '../content/i18n';
import '../ui/defis.css';

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
}

/** « Défier un ami » : créer un lien, puis retrouver ses parties contre des amis. */
export function DefisEcran({ db, userId, pseudo = null, onPartie }: EcranProps) {
  const online = useOnline();
  const [creation, setCreation] = useState<{ etat: 'repos' } | { etat: 'cours' } | { etat: 'erreur'; message: string } | { etat: 'pret'; lien: string; partage: Partage }>({ etat: 'repos' });
  const [liste, setListe] = useState<{ etat: 'chargement' } | { etat: 'erreur' } | { etat: 'pret'; defis: EtatDefi[] }>({ etat: 'chargement' });
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    if (!db || !userId || !online) { setListe({ etat: 'pret', defis: [] }); return; }
    let vivant = true;
    setListe({ etat: 'chargement' });
    mesDefis(db, userId).then(r => { if (vivant) setListe(r.ok ? { etat: 'pret', defis: r.value } : { etat: 'erreur' }); });
    return () => { vivant = false; };
  }, [db, userId, online, essai]);

  if (!db) {
    return <div className="defis"><p className="card muted">{fr(t('defi.indisponible'))}</p></div>;
  }

  async function creer() {
    if (!db || creation.etat === 'cours') return;
    setCreation({ etat: 'cours' });
    const r = await creerDefi(db);
    if (!r.ok) { setCreation({ etat: 'erreur', message: r.error }); return; }
    const lien = lienDefi(r.value.jeton, location.origin, pseudo);
    const partage = await partager(lien);
    // Jamais le lien, le jeton ni la partie dans l'événement (constat E14).
    track(EVENTS.defiCree, { partage: partage === 'partage' ? 'web_share' : partage === 'copie' ? 'copie' : partage, anonyme: r.value.anonyme });
    setCreation({ etat: 'pret', lien, partage });
    setEssai(n => n + 1);
  }

  const vues = liste.etat === 'pret' ? liste.defis.map(d => ({ d, v: vueDefi(d.partie, d.defi, userId ?? undefined) })) : [];
  return (
    <div className="defis">
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
              const r = resumeDefi(v);
              return (
                <li key={d.defi.partie_id}>
                  <button type="button" className={`defi-ligne${r.aMoi ? ' a-moi' : ''}`} onClick={() => onPartie(d.defi.partie_id)}>
                    <span className="defi-ligne-texte">
                      <b>{t('defi.liste.contre', { date: dateCourte(d.defi.cree_le) })}</b>
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
  /** Pseudo du joueur, mis dans le lien renvoyé. */
  pseudo?: string | null;
  confirmTouch: boolean;
  onRetour: () => void;
  onAutre: () => void;
}

/** Partie en différé contre un ami. */
export function DefiPartie({ db, partieId, userId, anonyme, pseudo = null, confirmTouch, onRetour, onAutre }: PartieProps) {
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

  const charger = useCallback(async () => {
    const r = await lireDefi(db, partieId);
    setMaintenant(Date.now());
    setEtat(prev => (r.ok ? { etat: 'pret', d: r.value } : prev.etat === 'pret' ? prev : { etat: 'erreur', message: r.error }));
  }, [db, partieId]);

  useEffect(() => { void charger(); }, [charger]);
  // Temps réel : chaque coup de l'ami, ou nouvelle date limite, relit la partie. Au retour du réseau ou de l'onglet aussi.
  useEffect(() => abonnerDefi(db, partieId, () => { void charger(); }), [db, partieId, charger]);
  useEffect(() => {
    const relire = () => { if (document.visibilityState === 'visible') void charger(); };
    window.addEventListener('online', relire);
    document.addEventListener('visibilitychange', relire);
    const tic = setInterval(() => setMaintenant(Date.now()), 60_000);
    return () => { window.removeEventListener('online', relire); document.removeEventListener('visibilitychange', relire); clearInterval(tic); };
  }, [charger]);

  const d = etat.etat === 'pret' ? etat.d : null;
  const v = useMemo(() => (d ? vueDefi(d.partie, d.defi, userId, maintenant, d.resultat) : null), [d, userId, maintenant]);
  // Comptage : les pierres mortes proposées, modifiables d'un toucher ; repartent de la proposition à chaque changement.
  const cleMortes = d ? `${d.partie.moves}|${d.partie.dead_stones ?? ''}|${d.partie.counting}` : '';
  useEffect(() => { setMortes(null); }, [cleMortes]);

  const retour = <button type="button" className="retour" onClick={onRetour} aria-label={t('defi.retour')}>‹</button>;

  if (!d || !v) {
    return (
      <div className="partie defi-partie">
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
    return <Revue sgf={revue.sgf} joueur={revue.joueur} adversaire={t('defi.adversaire')} confirmTouch={confirmTouch}
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
    const r = await jouerCoupDefi(db, partieId, coup);
    setEnvoi(false);
    if (!r.ok) { setRefus(r.error); void charger(); return; }
    // Coup accepté : on l'affiche tout de suite, puis on relit la partie (date limite, comptage).
    setEtat({ etat: 'pret', d: { ...d, partie: { ...d.partie, moves: d.partie.moves + coup, ...(r.value ?? {}) } as Game } });
    void charger();
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
    setLienCopie(await partager(lienDefi(d!.defi.jeton, location.origin, pseudo)));
  }

  const nom = (c: 1 | 2) => (c === moi ? t('defi.toi') : t('defi.adversaire'));
  const sousTitre = (c: 1 | 2) => (c === 1 ? t('defi.noir') : t('defi.blanc', { komi: nombre(Number(partie.komi)) }));
  const bandeau = (c: 1 | 2, avant?: ReactNode) => (
    <Bandeau nom={nom(c)} sousTitre={sousTitre(c)} actif={v.phase === 'jeu' && v.trait === c} captures={v.pos.captures[c]}
      pierresPrises={c === 1 ? 'blanc' : 'noir'} portrait={<Avatar couleur={c} />} avant={avant} />
  );

  const bienvenue = v.phase === 'jeu' && v.couleur === 1 && v.mesCoups === 0 && v.aMoi;
  const message = refus ?? (envoi ? t('defi.envoi') : !online ? t('defi.horsLigne') : bienvenue ? t('defi.bienvenue') : phraseEtat(v));
  // #343 : une ancienne session anonyme lie son e-mail avant de continuer (le serveur refuse désormais les anonymes).
  const proposerInscription = anonyme && v.phase !== 'fini';

  return (
    <div className={`partie defi-partie phase-${v.phase}`} data-phase={v.phase}>
      {bandeau(lui, retour)}
      <div className="partie-plateau">
        <Board size={partie.size} board={v.pos.board} toPlay={v.pos.toPlay} confirmTouch={confirmTouch}
          interactive={!anonyme && ((v.aMoi && !envoi && online) || (enComptage && !envoi && !v.proposeParMoi))} stonesTappable={enComptage}
          marks={{ last: v.pos.lastMove, owner: sc?.owner, dead: enComptage || v.phase === 'fini' ? mortesVues : undefined }}
          onPlay={toucher} noms={{ [lui]: t('defi.adversaire') }} />
      </div>
      {bandeau(moi)}
      <div className="partie-souffle" aria-hidden="true" />
      <div className="defi-bas">
        <Coach cle={message} attente={envoi}>{fr(message)}</Coach>
        {v.phase === 'jeu' && <p className="muted small defi-rappel">{fr(t('defi.rappelDelai'))}</p>}
        {sc && <p className="comptage">{fr(t('defi.comptage.score', { pn: nombre(sc.black), pb: nombre(sc.white) }))}</p>}

        {v.phase === 'attente' && (
          <>
            <button type="button" className="btn primary defis-cta" onClick={renvoyer}>{t('defi.renvoyer')}</button>
            {lienCopie && lienCopie !== 'partage' && lienCopie !== 'annule' && <CarteLien lien={lienDefi(d.defi.jeton, location.origin, pseudo)} partage={lienCopie} />}
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
            <p className="defi-fin-titre" role="status">{fr(phraseIssue(v.issue))}</p>
            <button type="button" className="btn primary defis-cta" onClick={onAutre}>{t('defi.autre')}</button>
            {revue && <button type="button" className="lien" onClick={() => { setEnRevue(true); window.scrollTo?.({ top: 0 }); }}>{t('fin.revoir')}</button>}
            <button type="button" className="lien" onClick={onRetour}>{t('defi.retourAccueil')}</button>
          </div>
        )}
        {proposerInscription && (
          <div className="defi-inscription">
            <LierEmail db={db} moment="apres_coup" coups={v.mesCoups} titre={t('defi.inscription.titre')} texte={t('defi.inscription.texte')} />
          </div>
        )}
      </div>
      {v.phase === 'jeu' && (
        <BarreActions label={t('partie.actions')} actions={[
          { label: abandon ? fr(t('partie.action.confirmer')) : t('partie.action.abandonner'), icone: <Icone nom="abandonner" />, onClick: abandonner, danger: abandon, disabled: envoi || !online || anonyme, groupe: 'decision' },
          { label: t('partie.action.passer'), icone: <Icone nom="passer" />, onClick: () => { void envoyer('tt'); }, disabled: !v.aMoi || envoi || !online || anonyme, groupe: 'decision', principale: true },
        ]} />
      )}
    </div>
  );
}

// useDefisEnAttente (accueil, pastilles, « À faire » #367) est dans defisAJouer.ts (#323) : l’app s’en sert sans charger cet écran.
