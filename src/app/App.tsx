import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
// Écrans chargés à la demande (perf, #323) : seul l'accueil est dans le JS initial.
import { CreerCompte, DefiArrivee, DefiPartie, DefisEcran, Direct, Game, LearnHome, Lentes, LessonPlayer, PartiePartagee, Placement, Profil, PseudoObligatoire, Puzzles, SeriePratique, VeilleFile, apresPremierEcran } from './ecrans';
import { SeanceRevisions, prechargerRevisions } from './ecrans';
import { ERREURS_KEY, EVENEMENT_REVISIONS, REVISIONS_KEY, compterDus } from './revisionEspacee';
// #16 : l'accueil ne lit que l'index léger des leçons ; leur contenu arrive avec les écrans Apprendre et leçon.
import { CHAPITRES, LESSONS } from '../content/leconsResume';
import { LESSONS_KEY, readLocal, writeLocal, useGelsServeur, useLessonProgress, useOnline, useProfil, usePseudo, useSerie, useSession } from './hooks';
import { COMPTES, chargerSupabase, useSupabase } from '../data/client';
import { coachActif, useSettings, useStored } from './settings';
import { aideActive } from './partie';
import { Bubble } from '../ui/Mochi';
import { Sceau } from '../ui/Sceau';
import { CRAN_DEPART, cranDuNiveau, niveauGuide, OPPONENTS, type OpponentId } from '../engine';
import { ConsentModal } from './Confidentialite';
import type { VueProfil } from './Profil';
import type { Lesson } from '../content/lessons';
import { langue, t } from '../content/i18n';
import { jamaisJoue, proprietesArrivee } from './arriveePartage';
import { fenetreVisible, useConsentement } from './consentement';
import { accueil, adversaireOuvert, echelle, introBut, INTRO_KEY, OUVERTS_D_OFFICE, PARTIES_KEY, type Parties } from './home';
import { PLACEMENT_KEY, chapitreConseille, coteApresPlacement, leconDeLAccueil, lirePlacement, ouvertsApresPlacement, proposerPlacement, type Placement as ResultatPlacement } from './placement';
import { COTE_KEY } from './coteJoueur';
import { Accueil } from './Accueil';
import { modesAccueil, type Depuis, type Mode } from './modes';
import { abonnerPierre, accueilEpure, lireRepere, pierreDejaPosee } from './premierePierre';
import { ecrireFaconEnLigne, lireFaconEnLigne } from './enLigne';
import type { FaconEnLigne } from './BasculeEnLigne';
import { EVENTS, secondsSinceOpen, track, trackOnce } from '../data/analytics';
import { compterEtape } from '../data/compteurs';
import { estArriveeRappel, etatRappel } from './rappel';
import { PARAM, PARAM_COURT, SERIE_KEY, numeroDuJour, numeroDuLien, problemeDuJour, type Serie } from './goDuJour';
import { battu, BILAN_KEY, dejaAffronte, enregistrer, fin, finTropTot, komiDepuisUrl, lireBilan, type Bilan, type Issue, type StatsPartie } from './bilan';
import { fr } from '../ui/typo';
import { Glacon } from '../ui/Glacon';
import { Mochi } from '../ui/Mochi';
import { constaterPerteAppareil, lireRecordAppareil, lireReserveAppareil, noterRecordAppareil, reconcilierAppareil } from './gelAppareil';
import { annoncerPerte, messagePerte } from './serieRecord';
import { VISITE_KEY, etatFlamme, lireVisite, visiter } from './flamme';
import { serieAffichee } from './serieLocale';
import { messageGel } from './gel';
import { goDuJourFaitAppareil } from './defiAppareil';
import { BarreNav, type Onglet } from '../ui/IconesNav';
import { BarreNiveau, FeteNiveau } from '../ui/Niveau';
import { annonceKomi, comptageSurActif, equilibrage, KOMI_NORMAL, partiesOrdi, rendrePartieOrdi, type Equilibrage } from './equilibrage';
import { AnnonceXp } from '../ui/PastilleXp';
import { useExercice } from '../ui/celebrations';
import { ProposerInstallation, usePlateformeInstallation } from '../ui/ProposerInstallation';
import { doitProposer, estMomentRetour, etatInstallation, noterOuverture } from './installation';
import { ANNONCE_DU_JOUR_KEY, appelSecondaire, etatTuile, lireJourAnnonce } from './appelsAccueil';
import { TAILLE_SERIE, THEMES_DE_LECON, serieDeLecon } from '../content/themes';
import { estRedite } from '../content/redites';
import type { Puzzle } from '../data/puzzles';
import { compteDe, estAnonyme } from '../data/defi';
import { INVITEUR_AU_CHARGEMENT, JETON_AU_CHARGEMENT, ecouterJetonDefi } from './adresseDefi';
import { PARTIE_AU_CHARGEMENT, ecouterJetonPartie } from './adressePartie';
import { deposerCopieEtude } from './copieEtude';
import { ESSAI_KEY, decider, etatCompte, lireEssai, noterFinDePartie, partiesTerminees, type Acces, type EtatCompte, type Raison } from './essai';
import { compteVientDEtreCree, moyenConnexion, noterConnexionPar } from './entonnoir';
import { aRattacher, annoncer, definirRetour, prendreRetour } from './connexionGoogle';
import { incidentRetour } from './fournisseurs';
import { useAFaire } from './useAFaire';
import { useDemandesAmis } from './demandesAmis';
import type { ElementAFaire } from './aFaire';
import { LimiteErreur } from './LimiteErreur';
import { BandeauHorsLigne, InviteMiseAJour } from '../ui/Bandeaux';
import '../ui/defis.css';
import '../ui/robustesse.css';
import { ecouterAide, estRaccourciAide, ficheDeLecon, ouvrirAide, type Ouverture } from './ouvrirAide';
import { bilanAMontrer, etatSemaine } from './semaine';
import { noterReglage } from './reglagesDates';
import { titreEcran, type EcranTitre } from './titreEcran';

// Aide (#362) : feuille chargée au premier « ? » (partie, leçon, problème, Profil) ou à la touche « ? ».
const FeuilleAide = lazy(() => import('../ui/Aide'));
// #369 : bilan de la semaine passée, sur l'accueil, une fois par semaine ; chargé seulement ce jour-là.
const CarteBilanSemaine = lazy(() => import('../ui/BilanSemaine').then(m => ({ default: m.BilanSemaine })));

// #433 : problèmes complets chargés à la demande (placement, série de fin de leçon) ; l'accueil lit le Go du jour léger.
const problemesLocaux = () => import('../content/problemesLocaux').then(m => m.PROBLEMES_LOCAUX);
// Problèmes résolus et vus sur l'appareil : mêmes clés que SOLVED_KEY et VUS_KEY de Puzzles.tsx (vérifié par ecrans.test.ts),
// recopiée ici pour que l'accueil n'embarque pas l'écran des problèmes.
const SOLVED_KEY = 'go.problemes.v1';
const VUS_KEY = 'go.problemes.vus.v1';

/** Flamme de la série de jours, en or. Creuse ou pleine selon la classe du parent (#213). */
function Flamme() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" focusable="false">
      <path className="flamme-corps" d="M8.6 1.2c.4 2.3 3.9 3.9 3.9 7.9A4.5 4.5 0 0 1 8 13.8a4.5 4.5 0 0 1-4.5-4.6c0-2 1-3.2 2-4 0 1.4.6 2.4 1.5 2.7C6.6 5.6 7.4 3 8.6 1.2Z" fill="currentColor" />
    </svg>
  );
}

// Komi : 6,5 (à deux), ou celui de l'équilibrage contre l'ordi (#160 : 0,5 pour les 3 premières parties).
// Paramètre de test `?komi=` : il remplace le komi du comptage (l'ordi, lui, garde celui de l'équilibrage). Il ne sert
// qu'aux tests de bout en bout et n'est lu que dans un build de test (VITE_E2E, voir playwright.config.ts).
const KOMI_TEST = import.meta.env.VITE_E2E && typeof location !== 'undefined' ? komiDepuisUrl(location.search, NaN) : NaN;
const komiCompte = (k: number) => (Number.isNaN(KOMI_TEST) ? k : KOMI_TEST);

// #454 : leçons d'essai des grands plateaux (content/lessons.essai.js), hors du chemin. `?lecon-essai=13` ou `=19` les ouvre,
// seulement dans un build de test ou de développement : en production, ce code et le contenu d'essai disparaissent.
const LECON_ESSAI = (import.meta.env.VITE_E2E || import.meta.env.DEV) && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lecon-essai') : null;

type Tab = Onglet;

// Go du jour (issue #75) : un lien partagé `?go-du-jour=N` ouvre directement le défi, sans compte.
// Lu une fois au chargement ; le paramètre est ensuite retiré de l'adresse, pour qu'un rechargement ne compte pas
// une deuxième arrivée : `arrivee_par_partage` part donc une seule fois par session.
const LIEN_DU_JOUR = typeof location !== 'undefined' ? numeroDuLien(location.search) : null;
// #285 : l'ami arrivé par le lien n'a jamais joué sur cet appareil. Lu au chargement, avant que le problème n'écrive rien.
const NOUVEAU_PAR_LIEN = LIEN_DU_JOUR !== null
  && jamaisJoue([PARTIES_KEY, LESSONS_KEY, SOLVED_KEY, VUS_KEY, SERIE_KEY, PLACEMENT_KEY].map(k => readLocal<unknown>(k, null)));
let arriveeEnvoyee = false;
function noterArrivee() {
  if (LIEN_DU_JOUR === null || arriveeEnvoyee) return;
  arriveeEnvoyee = true;
  track(EVENTS.arriveeParPartage, proprietesArrivee(LIEN_DU_JOUR, numeroDuJour(new Date()), langue(), NOUVEAU_PAR_LIEN));
  try {
    const url = new URL(location.href);
    url.searchParams.delete(PARAM);
    url.searchParams.delete(PARAM_COURT);
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  } catch { /* adresse inchangée : sans conséquence */ }
}

// Rappel quotidien (issue #36) : la notification touchée ouvre `/?rappel=1` (public/sw.js). Lu une fois au chargement :
// `rappel_ouvert` part, le paramètre est retiré, le Go du jour d'aujourd'hui s'ouvre.
const ARRIVEE_RAPPEL = typeof location !== 'undefined' && estArriveeRappel(location.search);
let rappelNote = false;
function noterRappelOuvert() {
  if (!ARRIVEE_RAPPEL || rappelNote) return;
  rappelNote = true;
  const e = etatRappel();
  track(EVENTS.rappelOuvert, { moment_jour: e.actif ? e.moment : null });
  try {
    const url = new URL(location.href);
    url.searchParams.delete('rappel');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  } catch { /* adresse inchangée : sans conséquence */ }
}

// Défi par lien (issue #81) : `#defi=JETON` ouvre la partie proposée par un ami, sans compte. Le jeton est lu et retiré
// de l'adresse par src/app/adresseDefi.ts, avant la mesure et tout événement (constat E14).
const LIEN_DEFI = JETON_AU_CHARGEMENT;

// Partie partagée (#364) : `#partie=JETON` ouvre la revue en lecture seule, sans compte. Le jeton est lu et retiré de
// l'adresse par src/app/adressePartie.ts. L'ami qui n'a jamais joué sur cet appareil (lu au chargement) a une seule
// action : « Joue ta première partie ».
const NOUVEAU_PAR_PARTIE = PARTIE_AU_CHARGEMENT !== null
  && jamaisJoue([PARTIES_KEY, LESSONS_KEY, SOLVED_KEY, VUS_KEY, SERIE_KEY, PLACEMENT_KEY].map(k => readLocal<unknown>(k, null)));

// « Continuer avec Google / Apple / Facebook » (#354, #411) : au retour (même onglet), la note d'aller-retour dit où
// reprendre (écran « Crée ton compte » et son action, défi ouvert par lien, ou Profil) et ce qui était tenté. Lue puis
// effacée une seule fois. La session elle-même est lue dans l'adresse par Supabase (`detectSessionInUrl`).
const RETOUR_GOOGLE = typeof location !== 'undefined' ? prendreRetour() : null;
// Erreur dans l'adresse seulement si la page revient d'un fournisseur : un lien magique expiré porte aussi `#error=…`.
const ERREUR_GOOGLE = RETOUR_GOOGLE && typeof location !== 'undefined' ? incidentRetour(location.hash, location.search) : null;
if (RETOUR_GOOGLE) {
  const fournisseur = RETOUR_GOOGLE.fournisseur ?? 'google';
  const action = RETOUR_GOOGLE.action ?? 'connexion';
  // Échec : l'écran de compte (ou Mon compte, pour un ajout) le dit. Ajout réussi : Mon compte le confirme.
  if (ERREUR_GOOGLE || action === 'ajout') annoncer({ incident: ERREUR_GOOGLE, fournisseur, action });
  if (ERREUR_GOOGLE) {
    try { history.replaceState(history.state, '', location.pathname); } catch { /* adresse inchangée */ }
  } else if (action !== 'ajout') noterConnexionPar(fournisseur);
}
const RAISONS: readonly Raison[] = ['parties', 'lecons', 'problemes', 'placement', 'import', 'defi', 'en_ligne'];
const ECRAN_COMPTE_AU_RETOUR = RETOUR_GOOGLE?.raison && (RAISONS as readonly string[]).includes(RETOUR_GOOGLE.raison)
  ? { raison: RETOUR_GOOGLE.raison as Raison, reprise: RETOUR_GOOGLE.reprise as Reprise | null } : null;
const DEFI_AU_RETOUR = LIEN_DEFI === null && RETOUR_GOOGLE?.defi ? RETOUR_GOOGLE.defi : null;

// Politique de confidentialité publique (#354) : `/confidentialite` ouvre la page « Conditions et confidentialité »
// (Google la demande pour son écran de consentement). Réécriture vers l'app : vercel.json.
const PAGE_CONFIDENTIALITE = typeof location !== 'undefined' && /^\/confidentialite\/?$/.test(location.pathname);

/** Écran du défi par lien : liste et création, arrivée par le lien (avec le pseudo de qui invite), ou partie. */
type VueDefi = { vue: 'liste' } | { vue: 'arrivee'; jeton: string; inviteur: string | null } | { vue: 'partie'; id: string };

/** Ce que le joueur voulait faire quand l'écran « Crée ton compte » s'est ouvert : repris dès que son compte est complet. */
type Reprise = { quoi: 'ordi'; contre: OpponentId } | { quoi: 'deux' } | { quoi: 'guidee' } | { quoi: 'lecon'; id: string }
  | { quoi: 'defis' } | { quoi: 'placement' } | { quoi: 'importer' } | { quoi: 'problemes' } | { quoi: 'amis' } | { quoi: 'direct' };

/** Réglages de la file d'attente du direct (#360, #436). */
interface DemandeDirect { taille: 9 | 13 | 19; cadence: 'rapide' | 'normale' | 'lente'; regles: 'japanese' | 'chinese' }
/**
 * #436 : partie contre l'IA en attendant un humain. Le joueur reste dans la file (`veille`) ; l'IA garde son nom.
 * `contre` : l'IA de l'échelle la plus proche de sa cote ; `depuis` : début de l'attente.
 */
interface Repli { contre: OpponentId; demande: DemandeDirect; depuis: number; veille: boolean }

export function App() {
  const [tab, setTab] = useState<Tab>(PAGE_CONFIDENTIALITE || (RETOUR_GOOGLE?.profil && !ECRAN_COMPTE_AU_RETOUR && !DEFI_AU_RETOUR) ? 'profil'
    : LIEN_DU_JOUR !== null || ARRIVEE_RAPPEL ? 'problemes' : 'jouer');
  const [duJourOuvert, setDuJourOuvert] = useState(false);
  // #285 : après le Go du jour ouvert par le lien, une seule action pour qui n'a jamais joué : la leçon 1.
  const [versLecon1, setVersLecon1] = useState(NOUVEAU_PAR_LIEN);
  useEffect(noterArrivee, []);
  useEffect(noterRappelOuvert, []);
  const [settings, set] = useSettings();
  const [playing, setPlaying] = useState<false | 'ordi' | 'deux' | 'guidee'>(false);
  const [adversaire, setAdversaire] = useStored<OpponentId>('go.adversaire.v1', 'pomme');
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [leconEssai, setLeconEssai] = useState<Lesson | null>(null);
  useEffect(() => {
    if (!(import.meta.env.VITE_E2E || import.meta.env.DEV) || !LECON_ESSAI) return;
    void import('../../content/lessons.essai.js').then(m => {
      const l = (m.LECONS_ESSAI as unknown as Lesson[]).find(x => x.id === `essai-${LECON_ESSAI}`);
      if (l) { setLeconEssai(l); setTab('apprendre'); }
    });
  }, []);
  // Aide ouverte (#362) : la feuille se pose par-dessus l'écran, qui reste monté (partie et leçon intactes).
  const [aide, setAide] = useState<(Ouverture & { n: number }) | null>(null);
  useEffect(() => ecouterAide(o => {
    setAide(a => ({ ...o, n: (a?.n ?? 0) + 1 }));
    track(EVENTS.aideOuverte, { fiche: o.fiche, mot: o.mot ?? null, depuis: o.depuis });
  }), []);
  // Raccourci « ? » (clavier, lecteur d'écran) : l'aide depuis n'importe quel écran, partie comprise ; dans une leçon, sur son mot.
  const aideOuverte = aide !== null;
  useEffect(() => {
    if (aideOuverte) return;
    const f = (e: KeyboardEvent) => {
      if (!estRaccourciAide(e)) return;
      e.preventDefault();
      ouvrirAide({ ...(lessonId ? ficheDeLecon(lessonId) : { fiche: 'regles' }), depuis: 'clavier' });
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [aideOuverte, lessonId]);
  // Série de 3 problèmes ouverte depuis la fin d'une leçon (#200), figée à l'ouverture.
  const [serie3, setSerie3] = useState<Puzzle[] | null>(null);
  // Client Supabase chargé à la demande (#401) : undefined pendant le chargement, null sans comptes.
  // `COMPTES` dit, sans attendre le client, si les comptes existent (lien « Défier un ami », essai sans compte).
  const client = useSupabase();
  const supabase = client ?? null;
  const session = useSession(client);
  // Une session anonyme (ouverte pour un défi, #81) compte comme « pas de compte » : ni synchronisation, ni cote, ni série serveur.
  const compteId = compteDe(session);
  // #355, #411 : une session sans compte est passée à un compte existant (code, Google, Apple, Facebook) avec un code de
  // rattachement tiré avant de partir : ses parties et défis passent à ce compte. Module chargé seulement dans ce cas.
  useEffect(() => {
    if (!compteId || !client || !aRattacher()) return;
    // #474 : code gardé jusqu'au succès ; module introuvable (hors ligne) : on réessaiera au prochain chargement.
    void import('../data/rattachement').then(m => m.rattacherCodeGarde(client)).catch(() => null);
  }, [compteId, client]);
  const [defi, setDefi] = useState<VueDefi | null>(LIEN_DEFI !== null ? { vue: 'arrivee', jeton: LIEN_DEFI, inviteur: INVITEUR_AU_CHARGEMENT }
    : DEFI_AU_RETOUR ? { vue: 'arrivee', ...DEFI_AU_RETOUR } : null);
  // #364 : partie partagée ouverte par un lien (jeton), au-dessus de l'accueil ; `null` sinon.
  const [partagee, setPartagee] = useState<string | null>(PARTIE_AU_CHARGEMENT);
  const [nouveauPartagee, setNouveauPartagee] = useState(NOUVEAU_PAR_PARTIE);
  // #449 : copie d'une étude partagée ouverte ; la fenêtre de consentement attend la sortie de l'écran d'étude.
  const [etudeRecue, setEtudeRecue] = useState(false);
  // « Un humain, maintenant » (#360) : partie en direct, du choix au bilan (écran src/app/Direct.tsx).
  const [direct, setDirect] = useState(false);
  // #465 : le direct passe en plein écran seulement pour la partie elle-même (et son bilan) ; le choix et l'attente
  // gardent l'en-tête et la barre du bas, comme les parties lentes. Écrit par l'écran du direct (`onPlein`).
  const [directPlein, setDirectPlein] = useState(false);
  // #436 : partie en direct rejointe depuis la partie contre l'IA (ouverte tout de suite par l'écran du direct).
  const [directRejoint, setDirectRejoint] = useState<{ id: string; demande: DemandeDirect } | null>(null);
  const [repli, setRepli] = useState<Repli | null>(null);
  // #440 : parties lentes classées (écran src/app/Lentes.tsx ; la partie se joue dans l'écran du défi).
  const [lente, setLente] = useState(false);
  const { progress, state: syncState, record } = useLessonProgress(supabase, compteId);
  // Lien de défi ouvert alors que l'app est déjà ouverte (même onglet) : on part vers l'arrivée.
  useEffect(() => ecouterJetonDefi((jeton, inviteur) => {
    setTab('jouer'); setPlaying(false); setLessonId(null); setEcranCompte(null); setDirect(false); setLente(false); setPartagee(null); setDefi({ vue: 'arrivee', jeton, inviteur }); window.scrollTo({ top: 0 });
  }), []);
  // Lien de partie partagée ouvert alors que l'app est déjà ouverte (#364).
  useEffect(() => ecouterJetonPartie(jeton => {
    setTab('jouer'); setPlaying(false); setLessonId(null); setEcranCompte(null); setDirect(false); setLente(false); setDefi(null); setNouveauPartagee(false); setPartagee(jeton); window.scrollTo({ top: 0 });
  }), []);
  const done = LESSONS.filter(l => (progress[l.id] ?? 0) >= l.steps.length).length;
  const lesson = LESSONS.find(l => l.id === lessonId);
  const [parties, setParties] = useStored<Parties>(PARTIES_KEY, { n: 0 });
  const [introVue, setIntroVue] = useStored<boolean>(INTRO_KEY, false);
  // Partie guidée (#79) : cran de force où Mochi s'est arrêté ; `null` avant la première partie guidée.
  const [cranGuide, setCranGuide] = useStored<number | null>('go.guidee.v1', null);
  const [departGuide, setDepartGuide] = useState(CRAN_DEPART);
  // Objet stable : l'écran de partie relance le tour de l'ordi quand son adversaire change.
  const mochiGuide = useMemo(() => niveauGuide(departGuide), [departGuide]);
  const [intro, setIntro] = useState(false); // bulle « but du jeu » au-dessus du plateau
  // Équilibrage de la partie contre l'ordi en cours (#160) et son annonce du komi par Mochi.
  const [reglage, setReglage] = useState<Equilibrage & { annonce: string | null }>({ komi: KOMI_NORMAL, avantage: true, annonce: null });
  const [reglages, setReglages] = useState(false);
  const [bilanBrut, setBilan] = useStored<Bilan>(BILAN_KEY, {});
  const bilan = lireBilan(bilanBrut);
  // Un adversaire verrouillé (choisi avant l'arrivée des verrous) laisse place à celui qu'il faut battre d'abord.
  // « Je sais déjà jouer » (#283) : résultat du placement ; il ouvre l'échelle jusqu'à l'adversaire conseillé.
  const [placementBrut, setPlacementBrut] = useStored<unknown>(PLACEMENT_KEY, null);
  const placement = lirePlacement(placementBrut);
  const [enPlacement, setEnPlacement] = useState(false);
  // #469 : séance « Révisions du jour » ouverte, et éléments dus (recomptés après chaque essai et à chaque écran).
  const [seanceRevisions, setSeanceRevisions] = useState(false);
  const [cleRevisions, setCleRevisions] = useState(0);
  useEffect(() => {
    const f = () => setCleRevisions(n => n + 1);
    window.addEventListener(EVENEMENT_REVISIONS, f);
    return () => window.removeEventListener(EVENEMENT_REVISIONS, f);
  }, []);
  const revisionsDues = useMemo(() => compterDus(readLocal<unknown>(ERREURS_KEY, []), readLocal<unknown>(REVISIONS_KEY, null), new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- relecture voulue après un essai (événement) et à chaque écran
    [cleRevisions, tab, seanceRevisions]);
  const ouverts = ouvertsApresPlacement(OPPONENTS, placement, OUVERTS_D_OFFICE);
  // #436 : pendant le repli, l'IA proposée par Mochi (la plus proche de la cote), même si l'échelle ne l'a pas encore ouverte.
  const advRepli = repli ? OPPONENTS.find(o => o.id === repli.contre) : undefined;
  const adv = advRepli ?? adversaireOuvert(OPPONENTS, bilan, adversaire, ouverts);
  const cartes = echelle(OPPONENTS, bilan, ouverts).map(e => ({ id: e.adv.id, nom: e.adv.nom, rang: e.adv.rang, battu: e.battu, ouvert: e.ouvert, requis: e.requis?.nom }));
  const serieServeur = useSerie(supabase, compteId);
  // Série protégée (issue #76) : les jours manqués consomment un gel dès l'ouverture, avant que Problèmes lise la série.
  const [annonceGel, setAnnonceGel] = useState(() => reconcilierAppareil(new Date()));
  // Rien de gagné ne se perd (issue #212) : série perdue constatée juste après les gels, annoncée une fois par Mochi.
  // Retour après une absence (#213) : mesuré au premier passage du jour, gardé toute la journée.
  const [absence] = useState(() => {
    const v = visiter(lireVisite(readLocal<unknown>(VISITE_KEY, null)), numeroDuJour(new Date()));
    writeLocal(VISITE_KEY, v);
    return v.absence;
  });
  const [retourSerie, setRetourSerie] = useState(() => { const p = constaterPerteAppareil(new Date()); return annoncerPerte(p) ? messagePerte(p) : null; });
  // Joueur connecté : les gels du serveur ; sinon ceux de l'appareil (issue #76).
  const gelsServeur = useGelsServeur(supabase, compteId);
  const gels = gelsServeur ?? lireReserveAppareil().gels;
  // Série dès le jour 1, avec ou sans compte (issue #161) : l'appareil sans compte, la plus longue des deux sinon.
  const serie = serieAffichee(compteId ? serieServeur : null, readLocal<Serie | null>(SERIE_KEY, null), numeroDuJour(new Date()));
  // Record : celui de l'appareil, ou la série affichée (celle du serveur si connecté) si elle le dépasse (#212).
  const recordSerie = Math.max(lireRecordAppareil().record, serie);
  useEffect(() => { noterRecordAppareil(serie); }, [serie]);
  const [resultat, setResultat] = useState<null | { issue: Issue; stats: StatsPartie }>(null); // fin de la partie en cours contre l'ordi
  const [partie, setPartie] = useState(0); // change à chaque partie pour repartir d'un plateau vide
  // #236 (N2) : une partie en cours est un exercice ; l'XP et la fête de niveau attendent l'écran de fin.
  const [partieFinie, setPartieFinie] = useState(false);
  useExercice(tab === 'jouer' && !!playing && !partieFinie);
  const numeroJour = numeroDuJour(new Date());
  const duJour = problemeDuJour(numeroJour);
  const duJourFait = goDuJourFaitAppareil(numeroJour);
  // #309 : « Rejouer » seulement après une partie finie contre cet adversaire.
  // Accueil v3 : un bilan contre l'ordi (appareil d'avant le compteur de parties, ou compteur abîmé) suffit à dire
  // qu'il a déjà joué : pas d'accueil « premier lancement » pour lui.
  const home = accueil({ ...parties, n: Math.max(parties.n, Object.keys(bilan).length > 0 ? 1 : 0) }, done, { ...adv, fini: dejaAffronte(bilan, adv.id) }, settings.size, { numero: numeroJour, absence, duJourFait, titreDuJour: duJour?.title });
  // #487 : tout premier lancement et aucune pierre posée (partie, leçon, problème, placement) : accueil épuré.
  const reperePierre = useSyncExternalStore(abonnerPierre, lireRepere, () => false);
  const epure = accueilEpure({ nouveau: home.nouveau,
    pierre: !home.nouveau || pierreDejaPosee(reperePierre, [LESSONS_KEY, SOLVED_KEY, VUS_KEY, SERIE_KEY, PLACEMENT_KEY].map(k => readLocal<unknown>(k, null))) });
  const flamme = etatFlamme(serie, duJourFait);
  // #308 : après le placement, la carte « Leçon » suit le chapitre conseillé.
  const leconConseillee = leconDeLAccueil(LESSONS, CHAPITRES, progress, placement);
  // Notifications dans l'app (#367) : ce qui t'attend (défis où c'est ton tour, série, Go du jour, leçon en cours).
  // Calcul chargé après le premier écran (useAFaire.ts). Défis relus à chaque changement d'écran ; pas pendant une
  // partie (l'écran du défi suit déjà la sienne en temps réel). Rien au tout premier lancement, sauf un ami qui attend.
  // Profil (issue #50) : sous-vue ouverte, et fenêtre de consentement fermée avec Échap pendant cette session.
  const [vueProfil, setVueProfil] = useState<VueProfil>(PAGE_CONFIDENTIALITE ? 'conditions'
    : RETOUR_GOOGLE?.profil && !ECRAN_COMPTE_AU_RETOUR && !DEFI_AU_RETOUR ? 'compte' : 'menu');
  // #359 : demandes d'ami reçues (`mes_amis()`), relues à chaque changement d'écran : pastille du Profil et « À faire ».
  const demandesAmis = useDemandesAmis(supabase, !!compteId && !playing, `${tab}|${vueProfil}`);
  const { defis: aJouerEnLigne, elements: aFaire, pastilles, rappelGoDuJour, recherche: rechercheLente, relire: relireAFaire } = useAFaire(supabase, session?.user.id,
    `${tab}|${defi?.vue ?? ''}|${enPlacement}|${lessonId ?? ''}|${lente}`, !playing && defi?.vue !== 'partie', {
      // #365 : série masquée, pas de « Garde ta série » (le Go du jour reste proposé, calmement).
      premier: home.nouveau, serie: settings.serieVisible ? serie : 0, duJourFait, goDuJour: duJour ? { numero: numeroJour, titre: duJour.title } : null,
      lecons: LESSONS, progres: progress, demandesAmis,
    });
  // #440 : défis d'amis d'un côté (tuile « Un ami »), parties lentes de l'autre (« À toi de jouer (N) », point d'or).
  const defisEnAttente = aJouerEnLigne.filter(x => !x.lente);
  const lentesEnAttente = aJouerEnLigne.filter(x => x.lente);
  const defisAJouer = defisEnAttente.length;
  /**
   * #440 : sort de la file lente (annulation, ou « adversaire trouvé » vu). Si une partie attendait, elle est rendue,
   * et `partie_lente_commencee` est mesurée (une fois : la ligne n'existe plus ensuite).
   */
  const quitterRecherche = useCallback(async (db: NonNullable<typeof supabase>): Promise<string | null> => {
    const r = rechercheLente;
    const q = await import('../data/lente').then(m => m.quitterFileLente(db));
    relireAFaire();
    if (!q.ok || !q.value) return null;
    if (r) track(EVENTS.partieLenteCommencee, { taille: r.taille, delai_jours: r.delai, attente_h: Math.max(0, Math.round((Date.now() - Date.parse(r.depuis)) / 360_000) / 10) });
    return q.value;
  }, [rechercheLente, relireAFaire]);
  // En quittant la page publique de la politique, l'adresse redevient celle de l'app.
  useEffect(() => {
    if (vueProfil !== 'conditions' && /^\/confidentialite\/?$/.test(location.pathname)) {
      try { history.replaceState(history.state, '', '/' + location.search); } catch { /* adresse inchangée */ }
    }
  }, [vueProfil]);
  // Installation (#214) : proposée sur l'accueil à partir du 2e retour (jour d'ouverture distinct), une seule fois.
  const [ouverture] = useState(() => noterOuverture(numeroDuJour(new Date())));
  // #437 : compteur anonyme du premier écran (quel que soit l'écran : accueil, lien de défi…), au tout premier lancement.
  // Lu au montage : une partie jouée ensuite ne change pas la réponse. L'envoi attend le premier écran.
  const [nouvelAppareil] = useState(() => parties.n === 0 && ouverture.retours === 0);
  useEffect(() => { compterEtape('premier_ecran', { nouveau: nouvelAppareil }); }, [nouvelAppareil]);
  // #236 (N4) : un seul appel secondaire sur l'accueil (annonce de Mochi, carte d'installation ou « À faire »).
  const plateforme = usePlateformeInstallation();
  const [etatInstall] = useState(etatInstallation);
  // #365 : « Montrer la série » éteint, la flamme, les gels et les annonces de série disparaissent ; le calcul continue.
  const serieVisible = settings.serieVisible;
  const annonceAccueil = serieVisible && (annonceGel !== null || retourSerie !== null);
  useEffect(() => { if (annonceAccueil) writeLocal(ANNONCE_DU_JOUR_KEY, numeroJour); }, [annonceAccueil, numeroJour]);
  const [jourAnnonce] = useState(() => lireJourAnnonce(readLocal<unknown>(ANNONCE_DU_JOUR_KEY, null)));
  // #369 : bilan de la semaine passée, lu une fois à l'ouverture (la carte le marque vu dès qu'elle s'affiche).
  const [bilanPasse, setBilanPasse] = useState(() => bilanAMontrer(etatSemaine()));
  const appel = appelSecondaire({
    jour: numeroJour, parties: parties.n, duJourFait, annonce: annonceAccueil, jourAnnonce, semaine: bilanPasse !== null,
    installation: estMomentRetour(ouverture) && doitProposer({ plateforme, etat: etatInstall, moment: 'retour', enPartie: false }),
  });
  const [accordIgnore, setAccordIgnore] = useState(false);
  const consent = useConsentement();
  // #343 : compte obligatoire avec pseudo. `clePseudo` relit le profil après le choix du pseudo.
  const [clePseudo, setClePseudo] = useState(0);
  const [pseudoChoisi, setPseudoChoisi] = useState<{ id: string; pseudo: string } | null>(null);
  const profil = useProfil(supabase, clePseudo);
  const pseudoLu = usePseudo(supabase, compteId, clePseudo);
  const pseudo = pseudoChoisi && pseudoChoisi.id === compteId ? pseudoChoisi.pseudo : pseudoLu;
  const etat: EtatCompte = etatCompte(session === undefined ? undefined : session ? { anonyme: estAnonyme(session) } : null, pseudo);
  // Essai sans compte : parties terminées sur l'appareil (bilan d'avant #343 compris).
  const [essaiBrut, setEssai] = useStored<unknown>(ESSAI_KEY, { terminees: 0 });
  const essai = lireEssai(essaiBrut);
  const terminees = partiesTerminees(essai, bilan);
  const [ecranCompte, setEcranCompte] = useState<{ raison: Raison; reprise: Reprise | null } | null>(ECRAN_COMPTE_AU_RETOUR);

  /**
   * Garde de l'essai (#343) : vrai si le joueur peut faire `a`. Sinon, l'écran « Crée ton compte » s'ouvre, et
   * `reprise` sera faite dès que le compte est complet (e-mail vérifié et pseudo choisi).
   */
  function garde(a: Acces, reprise: Reprise | null = null): boolean {
    const d = decider(a, etat, terminees, COMPTES);
    if (d.ok) return true;
    if (!COMPTES) return false;
    void chargerSupabase();
    track(EVENTS.essaiLimiteAtteinte, { raison: d.raison, parties: terminees });
    compterEtape('limite_essai');
    setEcranCompte({ raison: d.raison, reprise });
    window.scrollTo({ top: 0 });
    return false;
  }

  /** Ouvre une leçon, si l'essai le permet (leçons 1 à 3 sans compte). */
  function ouvrirLecon(id: string) {
    const rang = LESSONS.findIndex(l => l.id === id);
    if (!garde({ quoi: 'lecon', rang: rang < 0 ? 0 : rang }, { quoi: 'lecon', id })) return;
    setTab('apprendre'); setLessonId(id); window.scrollTo({ top: 0 });
  }

  function ouvrirPlacement() {
    if (!garde({ quoi: 'placement' }, { quoi: 'placement' })) return;
    track(EVENTS.placementCommence, { refait: placement !== null });
    setEnPlacement(true); setTab('jouer'); setPlaying(false); setLessonId(null); setSerie3(null);
    window.scrollTo({ top: 0 });
  }

  /** Leçons conseillées après le placement : la première leçon pas encore faite du chapitre ; la leçon 1 si tout est raté. */
  function ouvrirLeconsConseillees(kyu: number | null) {
    const chapitre = CHAPITRES[chapitreConseille(kyu, CHAPITRES.length)];
    const l = kyu === null ? LESSONS[0] : chapitre?.lecons.find(x => (progress[x.id] ?? 0) < x.steps.length) ?? chapitre?.lecons[0];
    setEnPlacement(false); setTab('apprendre');
    if (l) ouvrirLecon(l.id);
    window.scrollTo({ top: 0 });
  }

  function lancer(mode: 'ordi' | 'deux', contre: OpponentId = adv.id, enAttente: Repli | null = null) {
    if (!garde({ quoi: 'partie' }, mode === 'ordi' ? { quoi: 'ordi', contre } : { quoi: 'deux' })) return;
    // #436 : une autre partie que celle du repli met fin à l'attente (la bande rend la place dans la file).
    setRepli(enAttente);
    // Première partie contre l'ordi : Mochi explique le but, une seule fois.
    const montrer = mode === 'ordi' && !introVue;
    setIntro(montrer);
    if (montrer) setIntroVue(true);
    // Le repli ne change pas l'adversaire choisi sur l'échelle.
    if (mode === 'ordi' && !enAttente) setAdversaire(contre);
    const rang = partiesOrdi(parties);
    const e = mode === 'ordi' ? equilibrage(rang) : { komi: KOMI_NORMAL, avantage: true };
    setReglage({ ...e, annonce: mode === 'ordi' ? annonceKomi(rang, komiCompte(e.komi)) : null });
    setParties({ n: parties.n + 1, dernier: mode === 'ordi' ? contre : parties.dernier, ordi: rang + (mode === 'ordi' ? 1 : 0) });
    setReglages(false);
    setResultat(null);
    setPartieFinie(false);
    setPartie(partie + 1);
    setPlaying(mode);
    window.scrollTo({ top: 0 });
  }

  /**
   * Partie guidée contre Mochi (#79) : hors de l'échelle, sans effet sur le bilan ni sur les parties à komi réduit.
   * Mochi repart du cran de la partie guidée précédente ; la première fois, de la force de l'adversaire choisi.
   */
  function lancerGuidee() {
    if (!garde({ quoi: 'partie' }, { quoi: 'guidee' })) return;
    const oppIndex = OPPONENTS.findIndex(o => o.id === adv.id);
    setDepartGuide(typeof cranGuide === 'number' && Number.isFinite(cranGuide) ? cranGuide : cranDuNiveau(Math.max(0, oppIndex)));
    setIntro(false);
    setReglage({ komi: KOMI_NORMAL, avantage: true, accommodant: true, annonce: null });
    setParties({ ...parties, n: parties.n + 1 });
    setReglages(false);
    setResultat(null);
    setPartieFinie(false);
    setPartie(partie + 1);
    setPlaying('guidee');
    window.scrollTo({ top: 0 });
  }

  function onResult(winner: 0 | 1 | 2, stats: StatsPartie) {
    setPartieFinie(true);
    // #358 : la partie (gardée pour la revue par l'écran de partie) rejoint « Mes parties ». Chargé à la demande :
    // l'accueil n'embarque pas la logique de l'historique (#323).
    const mode = playing === 'guidee' ? 'guidee' : playing === 'deux' ? 'deux' : 'ordi';
    // Avec un compte, elle part aussi sur le compte (#358, suite).
    void import('./historique').then(h => { h.garderDerniere(mode); synchroniserParties(); }, () => { /* hors ligne sans le module : rattrapé à la lecture */ });
    // Essai sans compte (#343) : chaque partie menée à son terme compte, sauf sur un plateau presque vide (#251).
    // Recette du 02/10 au soir : la partie trop courte est notée (le compteur fait foi) sans être comptée.
    setEssai(noterFinDePartie(essai, bilan, !finTropTot(stats)));
    if (playing !== 'ordi') return;
    const issue: Issue = winner === 0 ? 'egalite' : winner === 1 ? 'victoire' : 'defaite';
    if (issue !== 'egalite') setBilan(enregistrer(bilan, adv.id, issue === 'victoire'));
    // #251 : une partie finie sur un plateau presque vide ne consomme pas une partie à komi réduit.
    if (finTropTot(stats)) setParties(rendrePartieOrdi(parties));
    setResultat({ issue, stats });
  }

  let finEcran;
  if (playing === 'guidee') {
    finEcran = {
      bilan: <>{t('guidee.fin')}</>,
      mochi: null,
      action: <button type="button" className="cta" onClick={lancerGuidee}>{t('guidee.rejouer')}</button>,
      onAccueil: () => { setPlaying(false); window.scrollTo({ top: 0 }); },
    };
  }
  if (playing === 'ordi' && resultat) {
    const f = fin(adv, resultat.issue, resultat.stats, bilan, OPPONENTS);
    const coupure = f.bilan.texte.indexOf('. ');
    const lecon = f.lecon ? LESSONS.find(l => l.id === f.lecon) : undefined;
    finEcran = {
      // Deux phrases, deux lignes : les statistiques, puis le bilan contre cet adversaire (issue #57).
      bilan: <>{fr(f.bilan.texte.slice(0, coupure + 1))}{coupure > 0 && <br />}{fr(f.bilan.texte.slice(coupure + 1))}<b className={resultat.issue === 'victoire' ? 'or' : undefined}>{f.bilan.gras}</b>.</>,
      mochi: (
        <>
          <p>{fr(f.mochi)}</p>
          {lecon && <button type="button" className="lien" onClick={() => { setPlaying(false); setResultat(null); setTab('apprendre'); ouvrirLecon(lecon.id); }}>{t('fin.ouvrirLecon')}</button>}
        </>
      ),
      action: (
        <button type="button" className="cta" onClick={() => lancer('ordi', f.cible as OpponentId)}>
          <Sceau id={f.cible as OpponentId} taille={30} />{f.cta}
        </button>
      ),
      onAccueil: () => { setPlaying(false); setResultat(null); setIntro(false); setRepli(null); window.scrollTo({ top: 0 }); },
    };
  }

  // Toucher l'onglet Problèmes déjà actif ramène à sa liste, comme Apprendre ramène au chemin (recette du 28/09, R4).
  const [racineProblemes, setRacineProblemes] = useState(0);
  // Recette du 02/10 au soir : la tuile « Go du jour · À faire » de l'accueil ouvre le problème lui-même, comme un lien
  // partagé ou un rappel, au lieu de la liste (un toucher de moins). Fait, elle mène à l'onglet Problèmes.
  const [duJourDirect, setDuJourDirect] = useState(false);
  const go = (t: Tab) => {
    setDuJourDirect(false);
    if (t === 'problemes' && tab === 'problemes') setRacineProblemes(n => n + 1);
    setDefi(null); setDirect(false); setLente(false); setRepli(null); setEcranCompte(null); setAnnonceGel(null); setRetourSerie(null); setEnPlacement(false); setTab(t); setPlaying(false); setLessonId(null); setSerie3(null); setVueProfil('menu'); setPartagee(null); window.scrollTo({ top: 0 });
    setSeanceRevisions(false); // #469
  };

  // Reprise de l'action demandée, dès que le compte est complet ; `compte_cree` quand un compte sans pseudo apparaît.
  const executer = useRef<(r: Reprise) => void>(() => {});
  executer.current = r => {
    if (r.quoi === 'ordi') lancer('ordi', r.contre);
    else if (r.quoi === 'deux') lancer('deux');
    else if (r.quoi === 'guidee') lancerGuidee();
    else if (r.quoi === 'lecon') ouvrirLecon(r.id);
    else if (r.quoi === 'defis') { setTab('jouer'); setDefi({ vue: 'liste' }); }
    else if (r.quoi === 'placement') ouvrirPlacement();
    else if (r.quoi === 'importer') { setTab('profil'); setVueProfil('importer'); }
    else if (r.quoi === 'amis') { setTab('profil'); setVueProfil('amis'); }
    else if (r.quoi === 'direct') ouvrirEnLigne();
    else setTab('problemes');
  };
  const etatAvant = useRef<EtatCompte | null>(null);
  useEffect(() => {
    if (compteVientDEtreCree(etatAvant.current, etat)) {
      track(EVENTS.compteCree, { moyen: moyenConnexion(), origine: ecranCompte?.raison ?? (defi?.vue === 'arrivee' ? 'defi_arrivee' : 'profil') });
      compterEtape('compte_cree');
    }
    etatAvant.current = etat;
    if (etat === 'complet' && ecranCompte) {
      const r = ecranCompte.reprise;
      setEcranCompte(null);
      if (r) executer.current(r);
    }
  }, [etat, ecranCompte, defi]);

  // #354 : où revenir si le joueur part chez Google depuis l'écran affiché.
  useEffect(() => {
    definirRetour({
      raison: ecranCompte?.raison ?? null,
      reprise: ecranCompte?.reprise ?? null,
      defi: defi?.vue === 'arrivee' ? { jeton: defi.jeton, inviteur: defi.inviteur } : null,
      profil: tab === 'profil',
    });
  }, [ecranCompte, defi, tab]);

  /** « Jouer en ligne » (#440) : la façon de jouer mémorisée, « En direct » ou « Partie lente ». */
  function ouvrirEnLigne(f: FaconEnLigne = lireFaconEnLigne()) {
    setTab('jouer'); setPlaying(false); setDefi(null); setDirect(f === 'direct'); setDirectPlein(false); setLente(f === 'lente'); window.scrollTo({ top: 0 });
  }
  /** Bascule « En direct » / « Partie lente » : mémorisée pour la prochaine fois. */
  const changerFacon = (f: FaconEnLigne) => { if (f !== lireFaconEnLigne()) noterReglage('enLigne'); ecrireFaconEnLigne(f); setDirectRejoint(null); ouvrirEnLigne(f); };
  // #440 : la partie trouvée pendant l'absence est ouverte par un autre chemin (« À toi de jouer », la liste) :
  // « Adversaire trouvé » est effacé de l'accueil, et le début de partie mesuré.
  useEffect(() => {
    const db = supabase;
    if (db && rechercheLente?.partieId && defi?.vue === 'partie' && defi.id === rechercheLente.partieId) void quitterRecherche(db);
  }, [supabase, defi, rechercheLente, quitterRecherche]);
  const enDefi = tab === 'jouer' && !playing && defi !== null;
  // #364 : partie partagée, sur l'onglet Jouer, hors partie et hors défi.
  const enPartagee = tab === 'jouer' && !playing && defi === null && !direct && !lente && partagee !== null;
  // #360 : partie en direct (choix, attente, partie). #465 : seule la partie est en plein écran, sans barre de navigation ;
  // le choix et l'attente gardent l'en-tête et la barre du bas (règle : docs/ux/navigation.md).
  const enDirect = tab === 'jouer' && !playing && defi === null && direct;
  // #440 : parties lentes (liste, recherche) ; la partie elle-même passe par l'écran du défi.
  const enLente = tab === 'jouer' && !playing && defi === null && !direct && lente;
  // Défi, direct ou « Crée ton compte » ouvert avant que le client Supabase soit là (#401) : on le charge sans attendre.
  useEffect(() => { if (enDefi || enDirect || enLente || enPartagee || ecranCompte) void chargerSupabase(); }, [enDefi, enDirect, enLente, enPartagee, ecranCompte]);
  const enPartie = (tab === 'jouer' && !!playing) || (enDefi && defi.vue === 'partie') || (enDirect && directPlein);
  // Robustesse (#325) : écran d'erreur à la place d'un écran blanc ; « Retour à l'accueil » change d'onglet sans recharger.
  const versAccueil = useCallback(() => {
    setDefi(null); setDirect(false); setLente(false); setRepli(null); setEcranCompte(null); setEnPlacement(false); setTab('jouer'); setPlaying(false); setLessonId(null); setSerie3(null); setVueProfil('menu'); setPartagee(null);
    setSeanceRevisions(false); // #469
    window.scrollTo({ top: 0 });
  }, []);
  const online = useOnline();
  // #469 : avec un compte, la file de révision espacée se synchronise entre ses appareils (le plus récent gagne, élément
  // par élément). Module chargé à la demande, après le premier écran ; arrêté à la déconnexion. Sans compte : l'appareil.
  useEffect(() => {
    const db = supabase;
    if (!db || !compteId) return;
    let fini = false;
    let arreter: (() => void) | undefined;
    const id = window.setTimeout(() => {
      void import('../data/revisions').then(m => { if (!fini) arreter = m.demarrerSynchroRevisions(db); }).catch(() => undefined);
    }, 1200);
    return () => { fini = true; window.clearTimeout(id); arreter?.(); };
  }, [supabase, compteId]);
  // #358 : avec un compte complet (pseudo choisi), les parties de l'appareil partent sur le compte, en arrière-plan :
  // à l'ouverture, à la connexion, à la création du compte (parties jouées pendant l'essai), au retour du réseau et
  // après chaque partie. Un envoi raté est refait la fois suivante. Module chargé à la demande (#323).
  const synchroniserParties = useCallback(() => {
    const db = supabase;
    if (!db || !compteId || !pseudo) return;
    void import('../data/partiesPerso').then(m => m.synchroniser(db, compteId)).catch(() => undefined);
  }, [supabase, compteId, pseudo]);
  // #448 : avec un compte, les réglages se synchronisent entre ses appareils (dernier changement gagne, clé par clé).
  // Module chargé à la demande, après le premier écran ; arrêté à la déconnexion.
  useEffect(() => {
    const db = supabase;
    if (!db || !compteId) return;
    let fini = false;
    let arreter: (() => void) | undefined;
    const id = window.setTimeout(() => {
      void import('../data/reglages').then(m => { if (!fini) arreter = m.demarrerSynchroReglages(db); }).catch(() => undefined);
    }, 1000);
    return () => { fini = true; window.clearTimeout(id); arreter?.(); };
  }, [supabase, compteId]);
  useEffect(() => {
    if (!online) return;
    const id = window.setTimeout(synchroniserParties, 1500); // après le premier écran
    return () => window.clearTimeout(id);
  }, [online, synchroniserParties]);
  /** Ouvre l'écran d'un élément « À faire » (#367), en un toucher, et le mesure. */
  function ouvrirAFaire(e: ElementAFaire, source: 'accueil' | 'onglet') {
    track(EVENTS.notificationOuverte, { type: e.genre, source, attente_h: e.attenteH ?? null });
    if (source === 'onglet') return; // l'onglet s'ouvre de lui-même
    const c = e.cible;
    if (c.ecran === 'defi') {
      go('jouer');
      setDefi({ vue: 'partie', id: c.partieId });
    } else if (c.ecran === 'goDuJour') go('problemes');
    else if (c.ecran === 'lecon') { go('apprendre'); ouvrirLecon(c.id); }
    // #359 : demandes d'ami reçues : l'écran « Mes amis » du Profil.
    else { go('profil'); if (etat === 'complet') setVueProfil('amis'); }
  }
  /** Tuile de l'accueil touchée : mesurée si elle porte un élément « À faire » (#367). */
  function mesurerAccueil(...genres: ElementAFaire['genre'][]) {
    const e = aFaire.find(x => genres.includes(x.genre));
    if (e) track(EVENTS.notificationOuverte, { type: e.genre, source: 'accueil', attente_h: null });
  }
  const ouvrirDefiPartie = useCallback((id: string) => { setDefi({ vue: 'partie', id }); window.scrollTo({ top: 0 }); }, []);
  const quitterDefi = () => { setDefi(null); window.scrollTo({ top: 0 }); };
  // #343 : pseudo obligatoire juste après la première connexion, avant tout le reste ; puis « Crée ton compte ».
  const pseudoAChoisir = !!supabase && etat === 'sans_pseudo' && !!compteId;
  const ecranPlein = pseudoAChoisir || ecranCompte !== null;
  // Bandeau « Tu es hors ligne » : seulement là où le réseau sert (défi par lien, en ligne, compte et profil).
  const ecranReseau = enDefi || enDirect || enLente || enPartagee || tab === 'profil' || ecranPlein;
  let screen;
  if (pseudoAChoisir && supabase && compteId) {
    screen = <PseudoObligatoire db={supabase} userId={compteId}
      onChoisi={p => { setPseudoChoisi({ id: compteId, pseudo: p }); setClePseudo(n => n + 1); }}
      onDeconnecter={() => { void supabase?.auth.signOut(); }} />;
  } else if ((ecranCompte || enDefi || enDirect || enLente || enPartagee) && client === undefined) {
    // Client Supabase pas encore là (#401, chargé dès l'ouverture d'un lien de défi) : comme un écran à la demande.
    screen = null;
  } else if (ecranCompte && supabase) {
    screen = <CreerCompte db={supabase} raison={ecranCompte.raison} anonyme={etat === 'anonyme'} onRetour={() => { setEcranCompte(null); window.scrollTo({ top: 0 }); }}
      onConditions={() => { go('profil'); setVueProfil('conditions'); }} />;
  } else if (enDirect) {
    screen = supabase && compteId
      ? <Direct db={supabase} userId={compteId} confirmTouch={settings.confirmTouch} reglages={{ modifier: set }}
        cote={profil?.cote ?? null} partieInitiale={directRejoint}
        // #436 : au bout de 25 s, partie contre l'IA en attendant ; la file est gardée par la bande VeilleFile.
        onRepli={(contre, demande, depuis) => { setDirect(false); setDirectRejoint(null); lancer('ordi', contre, { contre, demande, depuis, veille: true }); }}
        // #442 : attente après des parties quittées : l'IA la plus proche de la cote, sans rester dans la file.
        onOrdi={(contre, demande) => { setDirect(false); setDirectRejoint(null); lancer('ordi', contre, { contre, demande, depuis: Date.now(), veille: false }); }}
        celebrer={settings.celebrations} onAccueil={() => { setDirect(false); setDirectRejoint(null); window.scrollTo({ top: 0 }); }}
        onFacon={changerFacon} onPlein={setDirectPlein} />
      : null;
  } else if (enLente) {
    screen = supabase && compteId
      ? <Lentes db={supabase} userId={compteId} onFacon={changerFacon} onPartie={ouvrirDefiPartie}
        onAccueil={() => { setLente(false); window.scrollTo({ top: 0 }); }} />
      : null;
  } else if (enPartagee && partagee !== null) {
    screen = <PartiePartagee key={partagee} db={supabase} jeton={partagee} nouveau={nouveauPartagee} confirmTouch={settings.confirmTouch}
      onJouer={() => { setPartagee(null); lancer('ordi'); }} onAccueil={() => { setPartagee(null); window.scrollTo({ top: 0 }); }}
      // #449 : étude partagée, « Étudie-la avec Mochi » ouvre sa copie dans l'écran d'étude.
      onEtudier={copie => { deposerCopieEtude(copie); go('profil'); setVueProfil('etude'); setEtudeRecue(true); }} />;
  } else if (enDefi && defi.vue === 'partie' && supabase) {
    screen = <DefiPartie key={defi.id} db={supabase} partieId={defi.id} userId={session?.user.id} anonyme={estAnonyme(session)} pseudo={pseudo ?? null} confirmTouch={settings.confirmTouch} reglages={{ modifier: set }} celebrer={settings.celebrations}
      onRetour={quitterDefi} onAutre={() => { setDefi({ vue: 'liste' }); window.scrollTo({ top: 0 }); }}
      onAutreLente={() => { setDefi(null); setDirect(false); setLente(true); window.scrollTo({ top: 0 }); }} />;
  } else if (enDefi && defi.vue === 'arrivee') {
    screen = <DefiArrivee key={defi.jeton} db={supabase} jeton={defi.jeton} inviteur={defi.inviteur} compte={COMPTES ? etat : 'aucun'} onPartie={ouvrirDefiPartie} onAccueil={quitterDefi} />;
  } else if (enDefi) {
    screen = <DefisEcran db={supabase} userId={session === undefined ? undefined : session?.user.id ?? null} pseudo={pseudo ?? null} onPartie={ouvrirDefiPartie} />;
  } else if (enPartie) {
    const enRepli = playing === 'ordi' && repli !== null;
    screen = (
      <>
        {/* #436 : la recherche d'un humain continue pendant la partie contre l'IA (non classée). */}
        {enRepli && repli.veille && supabase && (
          <VeilleFile db={supabase} demande={repli.demande} depuis={repli.depuis}
            onRejoindre={id => {
              setDirectRejoint({ id, demande: repli.demande });
              setRepli(null); setIntro(false); setPlaying(false); setResultat(null); setDefi(null); setDirect(true); setDirectPlein(true);
              window.scrollTo({ top: 0 });
            }}
            onArret={() => setRepli(r => (r ? { ...r, veille: false } : r))} />
        )}
        <Game key={`${playing === 'ordi' ? adv.id : playing}-${partie}`} size={enRepli ? repli.demande.taille : settings.size} komi={komiCompte(reglage.komi)} aiKomi={reglage.komi} avantage={reglage.avantage} accommodant={reglage.accommodant} confirmTouch={settings.confirmTouch}
          opponent={playing === 'ordi' ? adv : playing === 'guidee' ? mochiGuide : undefined}
          guidee={playing === 'guidee' ? { depart: departGuide, onCran: setCranGuide } : undefined}
          intro={playing === 'guidee' ? <Bubble>{t('guidee.bulle')}</Bubble> : playing === 'ordi' && (intro || reglage.annonce) ? <Bubble>{intro ? introBut(adv.nom) : t('partie.bulle', { nom: adv.nom })}{reglage.annonce && <><br /><span className="annonce-komi">{reglage.annonce}</span></>}</Bubble> : undefined}
          onExit={() => { setIntro(false); setPlaying(false); setResultat(null); setRepli(null); }}
          onImporter={() => { if (!garde({ quoi: 'import' }, { quoi: 'importer' })) return; setPlaying(false); setResultat(null); setTab('profil'); setVueProfil('importer'); window.scrollTo({ top: 0 }); }}
          onResult={onResult} fin={finEcran} celebrer={settings.celebrations} aide={aideActive(settings.aide, adv.id)} portrait={playing === 'ordi' ? <Sceau id={adv.id} taille={44} /> : undefined}
          reglages={{ son: settings.sound, modifier: set }}
          // Coach Mochi (#470) : contre l'IA de l'échelle seulement, 10 premières parties par défaut.
          coach={playing === 'ordi' ? coachActif(settings.coach, parties.n) : undefined}
          // #486 : comptage sûr pendant les 3 premières parties terminées sur l'appareil.
          comptageSur={comptageSurActif(terminees)} />
      </>
    );
  } else if (tab === 'jouer' && seanceRevisions) {
    // #469 : séance « Révisions du jour » (5 éléments au plus), ouverte depuis la carte de l'accueil.
    screen = <SeanceRevisions confirmTouch={settings.confirmTouch} celebrer={settings.celebrations} compte={!!compteId}
      onFin={() => { setSeanceRevisions(false); window.scrollTo({ top: 0 }); }} />;
  } else if (tab === 'jouer' && enPlacement) {
    screen = <Placement adversaires={OPPONENTS} confirmTouch={settings.confirmTouch}
      chapitre={kyu => CHAPITRES[chapitreConseille(kyu, CHAPITRES.length)]?.titre ?? ''}
      onTermine={({ bilan: b, adversaire: a }) => {
        const r: ResultatPlacement = { fait: true, kyu: b.kyu, cote: b.cote, adversaire: a.id, date: new Date().toISOString().slice(0, 10) };
        setPlacementBrut(r);
        // La cote de « Continuer à ta mesure » (#284) part du placement : les problèmes démarrent à ce palier.
        writeLocal(COTE_KEY, coteApresPlacement(readLocal<unknown>(COTE_KEY, null), b.cote));
        setAdversaire(a.id);
        track(EVENTS.placementTermine, { kyu: b.kyu });
      }}
      onPasser={etape => {
        // Passé : le lien de l'accueil ne revient plus ; un placement déjà fait reste tel quel.
        if (!placement) setPlacementBrut({ fait: false, saute: true, date: new Date().toISOString().slice(0, 10) } satisfies ResultatPlacement);
        track(EVENTS.placementSaute, { etape });
        setEnPlacement(false); window.scrollTo({ top: 0 });
      }}
      onJouer={id => { setEnPlacement(false); lancer('ordi', id); }}
      onLecons={ouvrirLeconsConseillees} />;
  } else if (tab === 'apprendre' && leconEssai) {
    screen = <LessonPlayer key={leconEssai.id} lesson={leconEssai} lecon={leconEssai} start={0} confirmTouch={settings.confirmTouch} celebrer={false}
      onProgress={() => {}} onExit={() => { setLeconEssai(null); window.scrollTo({ top: 0 }); }} />;
  } else if (tab === 'apprendre' && serie3) {
    screen = <SeriePratique problemes={serie3} confirmTouch={settings.confirmTouch} celebrer={settings.celebrations} onFin={() => { setSerie3(null); window.scrollTo({ top: 0 }); }} />;
  } else if (tab === 'apprendre' && lesson) {
    const leconSuivante = LESSONS[LESSONS.indexOf(lesson) + 1];
    // Fin de leçon (#200) : 3 problèmes du thème, et en fin de chapitre une partie contre le premier adversaire.
    const themes = THEMES_DE_LECON[lesson.id] ?? [];
    const premier = OPPONENTS[0];
    screen = <LessonPlayer key={lesson.id} lesson={lesson} start={(progress[lesson.id] ?? 0) % lesson.steps.length} confirmTouch={settings.confirmTouch}
      progress={progress} celebrer={(settings as Partial<{ celebrations: boolean }>).celebrations !== false}
      onProgress={n => record(lesson.id, n)} onExit={() => { setLessonId(null); window.scrollTo({ top: 0 }); }}
      onNext={leconSuivante && (() => ouvrirLecon(leconSuivante.id))}
      pratique={themes.length ? {
        themes: themes.map(th => t(`theme.${th}`)),
        ouvrir: () => {
          if (!garde({ quoi: 'probleme' })) return;
          // #16 : la leçon complète (ses positions) vient du contenu des leçons, déjà chargé avec l'écran de la leçon.
          void Promise.all([problemesLocaux(), import('../content/lessons')]).then(([problemes, { LESSONS: completes }]) => {
            const complete = completes.find(l => l.id === lesson.id)!;
            const s = serieDeLecon(lesson.id, problemes, new Set(Object.keys(readLocal<Record<string, true>>(SOLVED_KEY, {}))),
              // #237 : pas le même exercice que l'étape de leçon qui vient d'être jouée.
              TAILLE_SERIE, p => estRedite(p, complete));
            if (s.length) { setSerie3(s); setLessonId(null); window.scrollTo({ top: 0 }); }
          }).catch(() => { /* morceau introuvable (hors ligne sans cache) : on reste sur la fin de leçon */ });
        },
      } : undefined}
      jouer={{ nom: premier.nom, lancer: () => { setLessonId(null); setTab('jouer'); lancer('ordi', premier.id); } }} />;
  } else if (tab === 'apprendre') {
    screen = <LearnHome progress={progress} onOpen={ouvrirLecon} sync={syncState}
      compteRequis={rang => !decider({ quoi: 'lecon', rang }, etat, terminees, COMPTES).ok} />;
  } else if (tab === 'problemes') {
    screen = <Puzzles db={supabase} userId={compteId} sessionLoading={session === undefined} confirmTouch={settings.confirmTouch} onCompte={() => go('profil')}
      essai={decider({ quoi: 'probleme' }, etat, terminees, COMPTES).ok ? undefined : () => { garde({ quoi: 'probleme' }, { quoi: 'problemes' }); }}
      lien={LIEN_DU_JOUR} depuisRappel={ARRIVEE_RAPPEL || duJourDirect} onDuJour={setDuJourOuvert} celebrer={settings.celebrations} racine={racineProblemes} rappelAmi={rappelGoDuJour}
      onApprendre={versLecon1 && LESSONS[0] ? () => { setVersLecon1(false); go('apprendre'); setLessonId(LESSONS[0].id); } : undefined} />;
  } else if (tab === 'profil') {
    screen = <Profil vue={vueProfil} onVue={v => { if (v === 'importer' && !garde({ quoi: 'import' }, { quoi: 'importer' })) return; setVueProfil(v); }} settings={settings} set={set} profil={profil} serie={serie} record={recordSerie}
      parcours={{ lecons: { faites: done, total: LESSONS.length }, adversaires: OPPONENTS.length }}
      placement={placement} onPlacement={ouvrirPlacement}
      onJouer={() => { go('jouer'); lancer('ordi'); }} db={supabase} userId={session?.user.id} onProfilChange={() => setClePseudo(c => c + 1)}
      onProblemes={() => go('problemes')}
      // #359 : « Mes amis ». Sans compte complet, l'écran de compte s'ouvre puis revient ici ; « Défier » ouvre la partie.
      amis={supabase ? {
        db: supabase, compte: etat === 'complet', demandes: demandesAmis,
        onCompte: () => { garde({ quoi: 'en_ligne' }, { quoi: 'amis' }); },
        onDefi: id => { setVueProfil('menu'); setTab('jouer'); setPlaying(false); setDefi({ vue: 'partie', id }); window.scrollTo({ top: 0 }); },
      } : undefined} />;
  } else {
    const numero = numeroJour;
    const daily = duJour;
    const rangLecon = leconConseillee ? LESSONS.indexOf(leconConseillee) + 1 : 0;
    // #429 : tous les modes en 1 toucher (ou 2 par « Plus ») ; #432 : la partie en ligne classée en action principale dès le début.
    const modes = modesAccueil({ comptes: COMPTES, enLigne: online, premierLancement: home.nouveau });
    const choisirMode = (m: Mode, depuis: Depuis) => {
      track(EVENTS.modeChoisi, { mode: m, depuis, principal: m === modes.principal });
      if (m === 'ordi') lancer('ordi');
      else if (m === 'deux') lancer('deux');
      else if (m === 'guidee') lancerGuidee();
      // « Un humain, maintenant » (#360), avec un compte et un pseudo (sinon « Crée ton compte », puis reprise).
      // #440 : « En direct » ou « Partie lente », selon le dernier choix (mémorisé).
      else if (m === 'en_ligne') { if (!garde({ quoi: 'en_ligne' }, { quoi: 'direct' })) return; ouvrirEnLigne(); }
      // Défier un ami (#81) : la liste des défis et la création du lien.
      else { if (!garde({ quoi: 'defi' }, { quoi: 'defis' })) return; setDefi({ vue: 'liste' }); window.scrollTo({ top: 0 }); }
    };
    screen = (
      <Accueil adv={adv} battu={battu(bilan, adv.id)} textes={home} taille={settings.size} cartes={cartes} epure={epure}
        reglages={reglages} setReglages={setReglages} onTaille={n => set({ size: n })} onChoisir={setAdversaire}
        modes={modes} onMode={choisirMode} compte={etat === 'complet'} defisAJouer={defisAJouer}
        cote={etat === 'complet' && profil ? { cote: profil.cote, provisoire: profil.provisoire } : null}
        probleme={daily && { numero, titre: daily.title, rows: daily.rows, reussi: duJourFait, etat: etatTuile(appel, duJourFait) }}
        // #367 : « Aujourd'hui » est la liste « À faire » ; un toucher sur un élément en attente est mesuré.
        // Recette du 02/10 (S7) : Go du jour à faire → ouvert directement.
        onProbleme={() => { mesurerAccueil('serie', 'goDuJour'); go('problemes'); if (!duJourFait) setDuJourDirect(true); }}
        lecon={leconConseillee && { rang: rangLecon, total: LESSONS.length, titre: leconConseillee.title }}
        onLecon={() => { mesurerAccueil('lecon'); if (leconConseillee) { const id = leconConseillee.id; go('apprendre'); ouvrirLecon(id); } else go('apprendre'); }}
        // Un seul appel à la fois (#236, N4) : pas de carte d'installation le jour où Mochi fait une annonce ;
        // quand elle se montre, la pastille « À faire » s'efface.
        installation={appel === 'installation' ? <ProposerInstallation moment="retour" /> : null}
        semaine={appel === 'semaine' && bilanPasse ? (
          <Suspense fallback={null}>
            <CarteBilanSemaine semaine={bilanPasse} db={etat === 'complet' ? supabase : null} onFermer={() => setBilanPasse(null)} />
          </Suspense>
        ) : null}
        // Accueil v3 : un défi d'un ami où c'est ton tour passe en premier dans « Aujourd'hui ».
        // #367 : un seul défi où c'est ton tour ? La tuile ouvre directement la partie, en un toucher.
        defis={COMPTES ? { n: defisAJouer, adversaire: defisAJouer === 1 ? defisEnAttente[0].adversaire : null, ouvrir: () => {
          const seul = defisAJouer === 1 ? aFaire.find(e => e.cible.ecran === 'defi' && e.cible.partieId === defisEnAttente[0].partieId) : undefined;
          if (seul) { ouvrirAFaire(seul, 'accueil'); return; }
          if (!garde({ quoi: 'defi' }, { quoi: 'defis' })) return;
          setDefi({ vue: 'liste' }); window.scrollTo({ top: 0 });
        } } : undefined}
        onPlacement={proposerPlacement(parties.n, placement, ouverture.retours) ? ouvrirPlacement : undefined}
        // #469 : « Révisions du jour (N) », carte secondaire dans « Aujourd'hui » (jamais au premier lancement).
        revisions={revisionsDues > 0 && !home.nouveau ? { n: revisionsDues, ouvrir: () => { setSeanceRevisions(true); window.scrollTo({ top: 0 }); } } : undefined}
        // #440 : parties lentes où c'est à toi (« À toi de jouer (N) », point d'or) et recherche en cours.
        lentes={COMPTES && etat === 'complet' ? {
          aJouer: lentesEnAttente.length,
          // Partie trouvée où c'est déjà à toi : « À toi de jouer » suffit (une seule tuile pour la même partie).
          recherche: rechercheLente && !lentesEnAttente.some(x => x.partieId === rechercheLente.partieId)
            ? { trouvee: !!rechercheLente.partieId } : null,
          ouvrir: () => {
            const seul = lentesEnAttente.length === 1 ? aFaire.find(e => e.cible.ecran === 'defi' && e.cible.partieId === lentesEnAttente[0].partieId) : undefined;
            if (seul) { ouvrirAFaire(seul, 'accueil'); return; }
            ouvrirEnLigne('lente');
          },
          quitter: () => {
            const db = supabase;
            if (!db) return;
            void quitterRecherche(db).then(id => { if (id) { go('jouer'); setDefi({ vue: 'partie', id }); } });
          },
        } : undefined} />
    );
  }

  const accueilVisible = tab === 'jouer' && !playing && !enPlacement && !enDefi && !enDirect && !enLente && !enPartagee && !ecranPlein && !seanceRevisions;
  // #465 (WCAG 2.4.2) : le titre de l'onglet du navigateur suit l'écran affiché.
  const leconOuverte = leconEssai ?? lesson;
  const ecranTitre: EcranTitre = ecranPlein ? { quoi: 'compte' }
    : enDirect ? { quoi: 'direct' } : enLente ? { quoi: 'lente' } : enPartagee ? { quoi: 'partagee' }
      : enDefi ? { quoi: defi.vue === 'partie' ? 'enLigne' : 'defi' }
        : tab === 'jouer' && playing ? { quoi: 'partie', contre: playing === 'deux' ? null : playing === 'guidee' ? mochiGuide.nom : adv.nom, guidee: playing === 'guidee' }
          : tab === 'jouer' ? (enPlacement ? { quoi: 'placement' } : seanceRevisions ? { quoi: 'revisions' } : { quoi: 'accueil' })
            : tab === 'apprendre' && leconOuverte && !serie3 ? { quoi: 'lecon', titre: leconOuverte.title }
              : { quoi: 'onglet', onglet: tab };
  const titreDocument = titreEcran(ecranTitre);
  // #469 : carte « Révisions du jour » montrée : mesurée une fois par ouverture ; la séance se précharge.
  const revisionVue = useRef(false);
  useEffect(() => {
    if (!accueilVisible || home.nouveau || revisionsDues === 0) return;
    prechargerRevisions();
    if (revisionVue.current) return;
    revisionVue.current = true;
    track(EVENTS.revisionCarteVue, { n: revisionsDues });
  }, [accueilVisible, revisionsDues, home.nouveau]);
  useEffect(() => { document.title = titreDocument; }, [titreDocument]);
  // Accueil v3 : `premier_ecran_vu`, une fois, quand l'accueil est affiché et utilisable (page chargée, polices prêtes).
  // `nouveau` : tout premier lancement sur l'appareil (aucune partie, aucun retour). Dénominateur des 60 premières secondes.
  const ecranVu = useRef(false);
  useEffect(() => {
    if (!accueilVisible || ecranVu.current) return;
    ecranVu.current = true;
    const nouveau = parties.n === 0 && ouverture.retours === 0;
    apresPremierEcran(() => trackOnce(EVENTS.premierEcranVu, { secondes: secondsSinceOpen(), nouveau, appel: appel ?? 'aucun', variante: 'v4' }));
  }, [accueilVisible, parties.n, ouverture.retours, appel]);
  // #213 : la flamme vue creuse s'allume au retour sur l'accueil, une fois, quand le Go du jour vient d'être fait.
  const flammeVue = useRef<typeof flamme>(null);
  const [allumage, setAllumage] = useState(false);
  // Avant la peinture : la flamme ne se montre pas pleine une image avant de s'allumer.
  useLayoutEffect(() => {
    if (!accueilVisible) return;
    if (flammeVue.current === 'creuse' && flamme === 'pleine') setAllumage(true);
    flammeVue.current = flamme;
  }, [accueilVisible, flamme]);
  useEffect(() => {
    if (!allumage) return;
    const id = setTimeout(() => setAllumage(false), 900);
    return () => clearTimeout(id);
  }, [allumage]);
  return (
    <>
      <main className={`app${accueilVisible ? ' app-home' : ''}${enPartie ? ' app-partie' : ''}`}>
        {!enPartie && !ecranPlein && <header className="top">
          {/* Marque (#416) : « Mochi » posé sur « Go », pour garder l'emprise de l'ancien titre ; la flamme et le gel tiennent à 320 px. */}
          <h1 className="marque"><span className="marque-mochi">Mochi</span>{' '}<span className="marque-go">Go</span></h1>
          {accueilVisible
            ? (
              <span className="entete-droite">
                {/* #429 : « Défier un ami » a quitté l'en-tête pour la tuile « Un ami », sous le bouton principal. */}
                {serieVisible && (flamme !== null || gels > 0) && (
                  <span className="serie-groupe">
                    {flamme !== null && <p className={`serie ${flamme}${allumage ? ' allumage' : ''}`} role="img" data-testid="flamme" data-etat={flamme}
                      aria-label={t(flamme === 'pleine' ? 'entete.flammeFaite' : 'entete.flammeAFaire', { jours: t('profil.jours', { n: serie }) })}><Flamme />{serie}</p>}
                    <Glacon gels={gels} />
                  </span>
                )}
              </span>
            )
            : <p>{enDefi ? t('defi.titre') : tab === 'jouer' ? t('nav.jouer') : tab === 'apprendre' ? t('entete.apprendre') : tab === 'problemes' ? t('nav.problemes') : t('nav.profil')}</p>}
        </header>}
        {/* #461 : sans en-tête (partie, fin de partie, écrans de compte), le titre de l'app reste pour les lecteurs d'écran. */}
        {(enPartie || ecranPlein) && <h1 className="sr-only">Mochi Go</h1>}
        {serieVisible && annonceGel !== null && !enPartie && !ecranPlein && (tab === 'jouer' || tab === 'problemes') && (
          <p className="gel-annonce" role="status"><Mochi size={30} />{fr(messageGel(annonceGel))}</p>
        )}
        {serieVisible && retourSerie !== null && annonceGel === null && !enPartie && !ecranPlein && (tab === 'jouer' || tab === 'problemes') && (
          <p className="gel-annonce retour-serie" role="status" data-testid="retour-serie"><Mochi size={30} />{fr(retourSerie)}</p>
        )}
        {/* Accueil v3 : pas de « Niveau 1 · 0 / 100 XP » avant le premier gain ; le Profil, lui, la montre toujours. */}
        {accueilVisible && <BarreNiveau sansXpMasquee />}
        {/* Nouvelle version prête : jamais pendant une partie (ordi, à deux, guidée, défi). */}
        <InviteMiseAJour visible={!enPartie} />
        {!online && ecranReseau && <BandeauHorsLigne />}
        <LimiteErreur origine="ecran" onAccueil={versAccueil}>
          <Suspense fallback={null}>{screen}</Suspense>
        </LimiteErreur>
      </main>
      <FeteNiveau celebrer={settings.celebrations} ecran={`${tab}|${playing}|${lessonId ?? ''}|${serie3 ? 'serie' : ''}|${vueProfil}`} />
      <AnnonceXp celebrer={settings.celebrations} />
      {/* Pendant une partie, comme chez chess.com : pas de barre de navigation, « ‹ » ramène à l'accueil. */}
      {!enPartie && !ecranPlein && <BarreNav actif={tab} pastilles={pastilles}
        onChoisir={o => { const e = aFaire.find(x => x.pastille && x.onglet === o); if (e) ouvrirAFaire(e, 'onglet'); go(o); }} />}
      {aide && (
        <Suspense fallback={null}>
          {/* Depuis une partie, pas de lien vers une leçon : on ne quitte pas la partie depuis l'aide. */}
          <FeuilleAide key={aide.n} ouverture={aide} onFermer={() => setAide(null)} leconCourante={lessonId}
            onLecon={playing || enPlacement || defi !== null || direct ? undefined : id => { setAide(null); ouvrirLecon(id); }} />
        </Suspense>
      )}
      <ConsentModal visible={fenetreVisible({ consent, ignoree: accordIgnore, enPartie: enPartie || enPartagee || (tab === 'problemes' && duJourOuvert) || (etudeRecue && tab === 'profil' && vueProfil === 'etude'), surConditions: tab === 'profil' && vueProfil === 'conditions' })}
        onConditions={() => { go('profil'); setVueProfil('conditions'); }} onIgnorer={() => setAccordIgnore(true)} />

    </>
  );
}
