// Partie en direct contre un humain (issue #360) : trois vues, une seule action principale chacune.
// - Choix : taille, temps de jeu (10 min + 3 × 30 s par défaut), comptage → « Trouver un adversaire ».
// - Attente : Mochi cherche quelqu'un de ton niveau ; « Annuler ».
// - Partie : plateau, pendule tenue par le serveur, pseudo, grade et cote de l'adversaire ; à la fin, « +14 » (#417),
//   « Rejouer » et « Revoir la partie ».
// Logique pure : src/app/direct.ts et src/go/pendule.ts. Données : src/data/direct.ts. Chargé à la demande (#323).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Board } from '../ui/Board';
import { Mochi } from '../ui/Mochi';
import { Avatar, Bandeau, BarreActions, Coach, Icone, Interrupteur, ListeCoups } from '../ui/Partie';
import { BoutonAide } from '../ui/BoutonAide';
import { GainCote, VocabulaireGrade } from '../ui/Cote';
import { fromSgf, toSgf } from '../go/coords';
import { groupAt } from '../go/rules';
import { score } from '../go/score';
import { deadToString, recordFromOnlineGame, validateMove } from '../go/server';
import { CADENCE_DEFAUT, CADENCES, CADENCES_ORDRE, ATTENTE_MS, BATTEMENT_MS, RELECTURE_MS, ecartHorloge, penduleApresCoup, texteTemps, type Cadence, type Cadran, type EtatDirect } from '../go/pendule';
import { acceptScore, playMove, proposeDeadStones, resumeGame, type Game } from '../data/games';
import {
  abandonnerDirect, abonnerDirect, annulerAttente, avecEtat, chercherAdversaire, fusionnerEtatPartie, fusionnerPendule, lirePartieDirect, lirePendule,
  type Regles, type RefusDirect, type Taille
} from '../data/direct';
import { pseudoJoueur } from '../data/defi';
import { coteJoueur } from '../data/cote';
import type { Db } from '../data/supabase';
import { EVENTS, track } from '../data/analytics';
import { messageRefus } from '../data/defi';
import { useOnline } from './hooks';
import { issueMesure, phraseDirect, phraseFinDirect, texteCadence, vueDirect } from './direct';
import { depuisDefi } from './historique';
import { libelleCoup } from './partie';
import { Revue } from './Revue';
import { texteAdversaire } from '../content/i18n/cote';
import { td, type CleDirect } from '../content/i18n/direct';
import { nombre, t } from '../content/i18n/secondaires';
import { fr } from '../ui/typo';
import '../ui/defis.css';
import '../ui/direct.css';

const TAILLES: readonly Taille[] = [9, 13, 19];
const REGLES: readonly Regles[] = ['japanese', 'chinese'];
const ERREURS: Record<RefusDirect, CleDirect> = {
  compte: 'direct.erreur.compte', miseAJour: 'direct.erreur.miseAJour', introuvable: 'direct.erreur.introuvable', serveur: 'direct.erreur.serveur',
};

interface Params { taille: Taille; cadence: Cadence; regles: Regles }
type Vue = { vue: 'choix' } | { vue: 'attente'; depuis: number } | { vue: 'partie'; id: string; attenteS: number | null };

interface Props {
  db: Db;
  userId: string;
  /** Taille du plateau proposée d'abord (réglage de l'accueil). */
  tailleDefaut?: Taille;
  confirmTouch: boolean;
  reglages?: { modifier: (patch: { confirmTouch?: boolean }) => void };
  /** Réglage « Célébrations » (confettis au changement de grade). */
  celebrer?: boolean;
  onAccueil: () => void;
}

/** « Un humain, maintenant » : du choix de la partie jusqu'au bilan. */
export function Direct({ db, userId, tailleDefaut = 9, confirmTouch, reglages, celebrer, onAccueil }: Props) {
  const [params, setParams] = useState<Params>({ taille: tailleDefaut, cadence: CADENCE_DEFAUT, regles: 'japanese' });
  const [vue, setVue] = useState<Vue>({ vue: 'choix' });
  const [erreur, setErreur] = useState<string | null>(null);

  // Partie en direct déjà en cours (onglet rouvert, retour de l'accueil) : on la retrouve, sans entrer dans la file.
  useEffect(() => {
    let vivant = true;
    void annulerAttente(db).then(r => { if (vivant && r.ok && r.value) setVue({ vue: 'partie', id: r.value, attenteS: null }); });
    return () => { vivant = false; };
  }, [db]);

  const ouvrir = useCallback((id: string, attenteS: number | null) => {
    setVue({ vue: 'partie', id, attenteS });
    window.scrollTo?.({ top: 0 });
  }, []);

  if (vue.vue === 'partie') {
    return <DirectPartie key={vue.id} db={db} partieId={vue.id} userId={userId} attenteS={vue.attenteS} confirmTouch={confirmTouch}
      reglages={reglages} celebrer={celebrer} onAccueil={onAccueil}
      onRejouer={p => { if (p) setParams(p); setErreur(null); setVue({ vue: 'attente', depuis: Date.now() }); window.scrollTo?.({ top: 0 }); }} />;
  }
  if (vue.vue === 'attente') {
    return <Attente db={db} params={params} depuis={vue.depuis} onTrouve={ouvrir}
      onAnnule={message => { setErreur(message); setVue({ vue: 'choix' }); }} />;
  }
  return <Choix params={params} onParams={setParams} erreur={erreur} onAccueil={onAccueil}
    onChercher={() => { setErreur(null); setVue({ vue: 'attente', depuis: Date.now() }); }} />;
}

/** Segment de choix (taille, comptage) : boutons à bascule, 44 px. */
function Segment<T extends string | number>({ titre, valeurs, valeur, libelle, onChoix, aide }: {
  titre: string; valeurs: readonly T[]; valeur: T; libelle: (v: T) => ReactNode; onChoix: (v: T) => void; aide?: ReactNode;
}) {
  const id = `direct-${String(titre).replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="direct-choix-groupe" role="group" aria-labelledby={id}>
      <h3 id={id}>{titre}</h3>
      <div className="seg">
        {valeurs.map(v => <button key={String(v)} type="button" aria-pressed={valeur === v} onClick={() => onChoix(v)}>{libelle(v)}</button>)}
      </div>
      {aide && <p className="muted small">{aide}</p>}
    </div>
  );
}

function Choix({ params, onParams, erreur, onAccueil, onChercher }: {
  params: Params; onParams: (p: Params) => void; erreur: string | null; onAccueil: () => void; onChercher: () => void;
}) {
  const online = useOnline();
  const c = CADENCES[params.cadence];
  return (
    <div className="direct direct-choix" data-testid="direct-choix">
      <div className="direct-tete">
        <button type="button" className="retour" onClick={onAccueil} aria-label={td('direct.retour')}>‹</button>
        <h2>{td('direct.titre')}</h2>
      </div>
      <p className="direct-intro">{fr(td('direct.intro'))}</p>
      <p className="muted small direct-classee">{fr(td('direct.classee'))}</p>
      <Segment titre={td('direct.taille')} valeurs={TAILLES} valeur={params.taille} libelle={n => `${n} × ${n}`}
        onChoix={taille => onParams({ ...params, taille })} />
      <Segment titre={td('direct.cadence')} valeurs={CADENCES_ORDRE} valeur={params.cadence}
        libelle={k => (
          <span className="direct-cadence"><b>{td(`direct.cadence.${k}`)}</b>
            {/* « 10 min » et « + 3 × 30 s » ne se coupent pas au milieu. */}
            <small>{texteCadence(k).split(' + ').map((m, i) => <span key={i}>{i ? ' + ' : ''}<span className="insecable">{m}</span></span>)}</small>
          </span>
        )}
        onChoix={cadence => onParams({ ...params, cadence })}
        aide={fr(td('direct.byoyomi', { s: c.periodeMs / 1000, n: c.periodes }))} />
      <Segment titre={td('direct.comptage')} valeurs={REGLES} valeur={params.regles} libelle={r => td(`direct.comptage.${r}`)}
        onChoix={regles => onParams({ ...params, regles })} aide={fr(td(`direct.comptage.aide.${params.regles}`))} />
      {!online && <p className="card small" role="status">{fr(td('direct.horsLigne'))}</p>}
      {erreur && <p className="small defi-erreur" role="alert">{fr(erreur)}</p>}
      <button type="button" className="btn primary defis-cta" onClick={onChercher} disabled={!online}>{td('direct.chercher')}</button>
    </div>
  );
}

/** Attente : Mochi cherche ; la file est rappelée toutes les 2,5 s (le serveur garde la place et son ancienneté). */
function Attente({ db, params, depuis, onTrouve, onAnnule }: {
  db: Db; params: Params; depuis: number; onTrouve: (id: string, attenteS: number) => void; onAnnule: (message: string | null) => void;
}) {
  const online = useOnline();
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const enAttente = useRef(true);

  useEffect(() => {
    const tic = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(tic);
  }, []);
  useEffect(() => {
    if (!online) return;
    let vivant = true, minuterie = 0;
    const chercher = async () => {
      const r = await chercherAdversaire(db, params.taille, params.cadence, params.regles);
      if (!vivant) return;
      if (!r.ok) { enAttente.current = false; onAnnule(td(ERREURS[r.error])); return; }
      if (r.value) {
        enAttente.current = false;
        const attenteS = Math.round((Date.now() - depuis) / 1000);
        track(EVENTS.partieEnLigneCommencee, { taille: params.taille, cadence: params.cadence, regles: params.regles, attente_s: attenteS });
        onTrouve(r.value, attenteS);
        return;
      }
      minuterie = window.setTimeout(() => { void chercher(); }, ATTENTE_MS);
    };
    void chercher();
    return () => { vivant = false; clearTimeout(minuterie); };
  }, [db, params, depuis, online, onTrouve, onAnnule]);
  // L'écran quitte l'attente sans partie (retour, autre onglet) : la place dans la file est rendue.
  useEffect(() => () => { if (enAttente.current) void annulerAttente(db); }, [db]);

  async function annuler() {
    enAttente.current = false;
    const r = await annulerAttente(db);
    // Trop tard : un adversaire a déjà créé la partie. Elle s'ouvre (une partie abandonnée compterait comme perdue).
    if (r.ok && r.value) { onTrouve(r.value, Math.round((Date.now() - depuis) / 1000)); return; }
    onAnnule(null);
  }

  const s = Math.max(0, Math.floor((maintenant - depuis) / 1000));
  return (
    <div className="direct direct-attente" data-testid="direct-attente">
      <div className="direct-recherche" aria-hidden="true">
        <span className="stone b" /><Mochi size={64} /><span className="stone w" />
      </div>
      <p className="direct-mochi" role="status">{fr(td('direct.attente.mochi'))}</p>
      <p className="muted small direct-depuis">
        {td('direct.attente.rappel', { taille: params.taille, cadence: texteCadence(params.cadence) })}
        {' · '}<span className="direct-chrono">{td('direct.attente.depuis', { s })}</span>
      </p>
      {s >= 30 && online && <p className="small">{fr(td('direct.attente.long'))}</p>}
      {!online && <p className="card small" role="status">{fr(td('direct.attente.horsLigne'))}</p>}
      <button type="button" className="btn defis-cta direct-annuler" onClick={annuler}>{td('direct.attente.annuler')}</button>
    </div>
  );
}

/** Pendule d'un joueur : temps principal, puis byo-yomi (temps de la période et périodes restantes). */
function Horloge({ c, nom }: { c: Cadran; nom: string | null }) {
  const temps = texteTemps(c.ms);
  const urgent = c.tourne && (c.byoyomi ? c.ms <= 10_000 : c.ms <= 30_000);
  return (
    <span className={`direct-pendule${c.tourne ? ' tourne' : ''}${c.byoyomi ? ' byoyomi' : ''}${urgent ? ' urgent' : ''}`} role="timer"
      data-testid="pendule" aria-label={nom === null
        ? td(c.byoyomi ? 'direct.pendule.ariaMoiByoyomi' : 'direct.pendule.ariaMoi', { temps, n: c.periodes })
        : td(c.byoyomi ? 'direct.pendule.ariaByoyomi' : 'direct.pendule.aria', { nom, temps, n: c.periodes })}>
      <span aria-hidden="true" className="direct-pendule-temps">{temps}</span>
      {c.byoyomi && <span aria-hidden="true" className="direct-pendule-periodes">×{c.periodes}</span>}
    </span>
  );
}

interface PartieProps {
  db: Db;
  partieId: string;
  userId: string;
  attenteS: number | null;
  confirmTouch: boolean;
  reglages?: { modifier: (patch: { confirmTouch?: boolean }) => void };
  celebrer?: boolean;
  onAccueil: () => void;
  /** « Rejouer » : nouvelle recherche, avec la taille, le temps et le comptage de cette partie. */
  onRejouer: (p: Params | null) => void;
}

function DirectPartie({ db, partieId, userId, confirmTouch, reglages, celebrer, onAccueil, onRejouer }: PartieProps) {
  const online = useOnline();
  const [partie, setPartie] = useState<Game | null>(null);
  const [etat, setEtat] = useState<EtatDirect | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ecart, setEcart] = useState(0);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [abandon, setAbandon] = useState(false);
  const [mortes, setMortes] = useState<Set<number> | null>(null);
  const [enRevue, setEnRevue] = useState(false);
  const [nomLui, setNomLui] = useState<string | null>(null);
  const [coteLui, setCoteLui] = useState<{ cote: number; provisoire: boolean } | null>(null);
  const lecture = useRef(0);

  const charger = useCallback(async () => {
    const n = ++lecture.current;
    const [g, p] = await Promise.all([partie ? Promise.resolve(null) : lirePartieDirect(db, partieId), lirePendule(db, partieId)]);
    // La ligne fixe (joueurs, taille) est gardée même d'une lecture dépassée : elle ne change pas pendant la partie.
    if (g && !g.ok) { if (n === lecture.current) setErreur(td(ERREURS[g.error])); return; }
    if (g?.ok) {
      setPartie(g.value);
      const lui = g.value.black_id === userId ? g.value.white_id : g.value.black_id;
      if (lui) {
        void pseudoJoueur(db, lui).then(setNomLui);
        void coteJoueur(db, lui).then(setCoteLui);
      }
    }
    if (n !== lecture.current) return; // une lecture plus récente, ou un événement temps réel, est passé entre-temps
    if (!p.ok) { if (!etat) setErreur(td(ERREURS[p.error])); return; }
    setErreur(null);
    setEcart(ecartHorloge(p.value.etat.maintenant, p.value.envoi, p.value.reception));
    setEtat(p.value.etat);
    setMaintenant(Date.now());
  }, [db, partieId, userId, partie, etat]);
  const chargerRef = useRef(charger);
  chargerRef.current = charger;
  const relire = useCallback(() => { void chargerRef.current(); }, []);

  useEffect(() => { relire(); }, [relire]);
  // Temps réel (#425) : la ligne reçue est appliquée tout de suite (coup de l'adversaire, pendule), sans relire. Une
  // lecture partie avant l'événement est ignorée (`lecture`). Réabonnement et relecture au retour au premier plan ou
  // du réseau : src/data/tempsReel.ts.
  const ecartRef = useRef(ecart);
  ecartRef.current = ecart;
  // Avant la première lecture, un événement n'a rien à mettre à jour : il ne doit pas faire ignorer cette lecture.
  const pret = useRef(false);
  pret.current = etat !== null;
  useEffect(() => abonnerDirect(db, partieId, {
    surPartie: ligne => {
      if (!pret.current) return;
      lecture.current++;
      setEtat(e => (e ? fusionnerEtatPartie(e, ligne, Date.now() + ecartRef.current) ?? e : e));
      setMaintenant(Date.now());
    },
    surPendule: ligne => {
      if (!pret.current) return;
      lecture.current++;
      setEtat(e => (e ? fusionnerPendule(e, ligne) : e));
    },
    rattraper: relire,
  }), [db, partieId, relire]);

  const base = partie && etat ? avecEtat(partie, etat) : null;
  const heureServeur = maintenant + ecart;
  const v = useMemo(() => (partie && etat ? vueDirect(partie, etat, userId, heureServeur) : null), [partie, etat, userId, heureServeur]);
  const enCours = v?.phase === 'jeu' || v?.phase === 'comptage';
  const aMoi = !!v?.aMoi;

  // Battement : signe de présence et relecture. Plus souvent quand c'est à l'adversaire (rattrape un message perdu).
  useEffect(() => {
    if (!enCours || !online) return;
    const id = window.setInterval(relire, aMoi ? BATTEMENT_MS : RELECTURE_MS);
    return () => clearInterval(id);
  }, [enCours, aMoi, online, relire]);
  // La pendule affichée avance à chaque quart de seconde.
  useEffect(() => {
    if (!enCours) return;
    const id = window.setInterval(() => setMaintenant(Date.now()), 250);
    return () => clearInterval(id);
  }, [enCours]);
  // Une pendule affichée tombe : le serveur constate (jamais le client).
  const tombee = v?.phase === 'jeu' && (v.cadrans[1].tombe || v.cadrans[2].tombe);
  const constatDemande = useRef('');
  useEffect(() => {
    if (!tombee || !etat) return;
    const cle = `${etat.coups}|${Math.floor(heureServeur / 2000)}`;
    if (constatDemande.current === cle) return;
    constatDemande.current = cle;
    relire();
  }, [tombee, etat, heureServeur, relire]);

  // Comptage : pierres mortes proposées, modifiables d'un toucher ; repartent de la proposition à chaque changement.
  const cleMortes = etat ? `${etat.coups}|${etat.mortes ?? ''}|${etat.comptage}` : '';
  useEffect(() => { setMortes(null); }, [cleMortes]);

  // Mesure de fin (une fois par partie).
  const finMesuree = useRef(false);
  useEffect(() => {
    if (!v || !partie || finMesuree.current) return;
    const issue = issueMesure(v);
    if (!issue) return;
    finMesuree.current = true;
    track(EVENTS.partieEnLigneTerminee, {
      taille: partie.size, cadence: etat?.cadence ?? null, issue,
      raison: v.phase === 'annulee' ? 'annulee' : v.issue?.raison ?? null, coups: (etat?.coups.length ?? 0) / 2,
    });
  }, [v, partie, etat]);

  const retour = <button type="button" className="retour" onClick={onAccueil} aria-label={td('direct.retour')}>‹</button>;
  if (!base || !v || !etat || !partie) {
    return (
      <div className="partie defi-partie defi-partie-charge">
        <div className="joueur">{retour}</div>
        {erreur
          ? <div className="defi-charge"><p className="card" role="alert">{fr(erreur)}</p><button type="button" className="btn primary defis-cta" onClick={relire}>{td('direct.reessayer')}</button></div>
          : <p className="muted defi-charge" aria-busy="true">{td('direct.chargement')}</p>}
      </div>
    );
  }

  const nom = nomLui ?? td('direct.adversaire');
  const revue = (v.phase === 'fini') ? depuisDefi(base, userId, etat.resultat, nomLui) : null;
  if (enRevue && revue) {
    return <Revue sgf={revue.sgf} joueur={revue.joueur} adversaire={nom} confirmTouch={confirmTouch}
      retour={td('direct.retour')} onRetour={() => { setEnRevue(false); window.scrollTo?.({ top: 0 }); }} />;
  }
  const moi: 1 | 2 = v.couleur ?? 1;
  const lui = (3 - moi) as 1 | 2;
  const enComptage = v.phase === 'comptage';
  const mortesVues = mortes ?? new Set(v.mortes);
  const rules = partie.rules === 'chinese' ? 'chinese' : 'japanese';
  const sc = enComptage || (v.phase === 'fini' && v.issue?.raison === 'points') ? score(v.pos, Number(partie.komi), rules, mortesVues) : null;
  const inchangee = mortes === null;

  async function envoyer(coup: string) {
    if (!base || !etat) return;
    const record = recordFromOnlineGame({ size: base.size, komi: Number(base.komi), rules, handicap: base.handicap, moves: base.moves });
    const local = record ? validateMove(record, coup) : null;
    if (local && !local.ok) { setRefus(messageRefus({ error: local.error, message: local.message })); return; }
    setEnvoi(true); setRefus(null);
    // #425 : le coup, déjà vérifié ici avec les mêmes règles que le serveur, s'affiche tout de suite, et la pendule de
    // l'adversaire part (estimation, remplacée par celle du serveur). Refusé par le serveur, il disparaît à la relecture.
    const avant = etat.coups;
    lecture.current++;
    setEtat(e => (e && e.coups === avant ? { ...penduleApresCoup(e, Date.now() + ecart), coups: avant + coup } : e));
    const r = await playMove(db, partieId, coup);
    setEnvoi(false);
    if (!r.ok) { setRefus(r.error); relire(); return; }
    // Coup accepté : la ligne renvoyée par le serveur (comptage après deux passes), sauf si l'affichage est déjà plus loin.
    if ('game' in r.value && typeof r.value.game.moves === 'string') {
      const g = r.value.game as Record<string, unknown>;
      lecture.current++;
      setEtat(e => (e ? fusionnerEtatPartie(e, g, Date.now() + ecart) ?? e : e));
    }
    // La pendule exacte arrive par le temps réel (ligne `parties_direct`) ; la relecture recale l'heure du serveur.
    relire();
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
    if (!v?.aMoi || envoi || !online) return;
    void envoyer(toSgf(p, partie!.size));
  }

  async function agirComptage(action: 'proposer' | 'accepter' | 'reprendre') {
    setEnvoi(true); setRefus(null);
    const r = action === 'proposer' ? await proposeDeadStones(db, partieId, deadToString([...mortesVues].sort((a, b) => a - b), partie!.size))
      : action === 'accepter' ? await acceptScore(db, partieId) : await resumeGame(db, partieId);
    setEnvoi(false);
    if (!r.ok) setRefus(r.error);
    relire();
  }

  async function abandonner() {
    if (!abandon) { setAbandon(true); return; }
    setAbandon(false); setEnvoi(true);
    const r = await abandonnerDirect(db, partieId);
    setEnvoi(false);
    if (!r.ok) setRefus(td(ERREURS[r.error]));
    relire();
  }

  const nomDe = (c: 1 | 2) => (c === moi ? td('direct.toi') : nom);
  const coups = (etat.coups.match(/../g) ?? []).map((m, i) => libelleCoup(i + 1, fromSgf(m, partie.size), partie.size));
  const couleurTexte = (c: 1 | 2) => (c === 1 ? td('direct.noir') : td('direct.blanc', { komi: nombre(Number(partie.komi)) }));
  // #417 : grade et cote de l'adversaire sous son nom ; sa couleur se voit à sa pierre.
  const sousTitre = (c: 1 | 2) => (c === lui && coteLui ? texteAdversaire(coteLui.cote, coteLui.provisoire) : couleurTexte(c));
  const bandeau = (c: 1 | 2, avant?: ReactNode) => (
    <Bandeau nom={nomDe(c)} sousTitre={sousTitre(c)} actif={v.phase === 'jeu' && v.trait === c} captures={v.pos.captures[c]}
      pierresPrises={c === 1 ? 'blanc' : 'noir'} portrait={<Avatar couleur={c} />} avant={avant}
      pendule={<Horloge c={v.cadrans[c]} nom={c === moi ? null : nom} />} />
  );
  const message = refus ?? (envoi ? td('direct.etat.envoi') : phraseDirect(v, nom, online));
  const fini = v.phase === 'fini' || v.phase === 'annulee';
  const cadence = etat.cadence;

  return (
    <div className={`partie defi-partie direct-partie phase-${v.phase}`} data-phase={v.phase} data-testid="direct-partie">
      {bandeau(lui, retour)}
      <ListeCoups coups={coups} apres={<BoutonAide depuis="partie" fiche={enComptage ? 'compter' : 'regles'} className="ruban-aide" />} />
      <div className="partie-plateau">
        <Board size={partie.size} board={v.pos.board} toPlay={v.pos.toPlay} confirmTouch={confirmTouch}
          interactive={(v.aMoi && !envoi && online) || (enComptage && !envoi && !v.proposeParMoi)} stonesTappable={enComptage}
          marks={{ last: v.pos.lastMove, owner: sc?.owner, dead: enComptage || v.phase === 'fini' ? mortesVues : undefined }}
          onPlay={toucher} noms={{ [lui]: nom }} />
      </div>
      {bandeau(moi)}
      <div className="partie-mochi">
        <Coach cle={message} attente={envoi}>{fr(message)}</Coach>
      </div>
      <div className="defi-bas">
        {sc && <p className="comptage">{fr(t('defi.comptage.score', { pn: nombre(sc.black), pb: nombre(sc.white) }))}</p>}
        {enComptage && (
          <div className="barre-comptage defi-comptage" role="group" aria-label={t('partie.comptageAria')}>
            <button type="button" className="btn" onClick={() => agirComptage('reprendre')} disabled={envoi || !online}>{t('defi.comptage.reprendre')}</button>
            {v.proposeParAutre && inchangee
              ? <button type="button" className="btn primary" onClick={() => agirComptage('accepter')} disabled={envoi || !online}>{t('defi.comptage.accepter')}</button>
              : <button type="button" className="btn primary" onClick={() => agirComptage('proposer')} disabled={envoi || !online || (v.proposeParMoi && inchangee)}>{t('defi.comptage.proposer')}</button>}
          </div>
        )}
        {fini && (
          <div className="defi-fin" data-testid="direct-fin">
            <p className="defi-fin-titre" role="status">{fr(phraseFinDirect(v, nom))}</p>
            {/* #417 : partie classée entre humains, « +14 » et le grade. Rien pour une partie annulée. */}
            {v.phase === 'fini' && partie.rated && <GainCote db={db} gameId={partie.id} userId={userId} celebrer={celebrer} />}
            <button type="button" className="btn primary defis-cta"
              onClick={() => onRejouer({ taille: partie.size as Taille, cadence, regles: rules })}>{td('direct.rejouer')}</button>
            {revue && <button type="button" className="lien" onClick={() => { setEnRevue(true); window.scrollTo?.({ top: 0 }); }}>{td('direct.revoir')}</button>}
            <button type="button" className="lien" onClick={onAccueil}>{td('direct.accueil')}</button>
            {v.phase === 'fini' && partie.rated && <VocabulaireGrade />}
          </div>
        )}
      </div>
      <div className="partie-souffle" aria-hidden="true" />
      {v.phase === 'jeu' && (
        <BarreActions label={t('partie.actions')} actions={[
          { label: t('partie.action.passer'), icone: <Icone nom="passer" />, onClick: () => { void envoyer('tt'); }, disabled: !v.aMoi || envoi || !online, groupe: 'decision', principale: true },
        ]} menu={{
          label: t('partie.action.plus'),
          actions: [
            { label: abandon ? fr(t('partie.action.confirmer')) : t('partie.action.abandonner'), action: 'abandonner', icone: <Icone nom="abandonner" />,
              onClick: abandonner, danger: abandon, disabled: envoi || !online, reste: true },
          ],
          reglages: reglages ? <Interrupteur label={t('profil.confirmer')} actif={confirmTouch} onChange={c => reglages.modifier({ confirmTouch: c })} /> : undefined,
        }} />
      )}
    </div>
  );
}
