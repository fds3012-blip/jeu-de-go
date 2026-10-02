import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
// Écrans chargés à la demande (perf, #323) : seul l'accueil est dans le JS initial.
import { CreerCompte, DefiArrivee, DefiPartie, DefisEcran, Game, LearnHome, LessonPlayer, Placement, Profil, PseudoObligatoire, Puzzles, SeriePratique, apresPremierEcran } from './ecrans';
import { CHAPITRES, LESSONS } from '../content/lessons';
import { LESSONS_KEY, readLocal, writeLocal, useGelsServeur, useLessonProgress, useProfil, usePseudo, useSerie, useSession } from './hooks';
import { supabase } from '../data/supabase';
import { useSettings, useStored } from './settings';
import { aideActive } from './partie';
import { Bubble } from '../ui/Mochi';
import { Sceau } from '../ui/Sceau';
import { CRAN_DEPART, cranDuNiveau, niveauGuide, OPPONENTS, type OpponentId } from '../engine';
import { ConsentModal } from './Confidentialite';
import type { VueProfil } from './Profil';
import { langue, t } from '../content/i18n';
import { jamaisJoue, proprietesArrivee } from './arriveePartage';
import { fenetreVisible, useConsentement } from './consentement';
import { accueil, adversaireOuvert, echelle, introBut, INTRO_KEY, OUVERTS_D_OFFICE, PARTIES_KEY, type Parties } from './home';
import { PLACEMENT_KEY, chapitreConseille, coteApresPlacement, leconDeLAccueil, lirePlacement, ouvertsApresPlacement, proposerPlacement, type Placement as ResultatPlacement } from './placement';
import { COTE_KEY } from './coteJoueur';
import { Accueil } from './Accueil';
import { ALL_PUZZLES } from '../content/puzzles';
import { parsePuzzles } from '../data/puzzles';
import { EVENTS, secondsSinceOpen, track, trackOnce } from '../data/analytics';
import { estArriveeRappel, etatRappel } from './rappel';
import { PARAM, PARAM_COURT, SERIE_KEY, numeroDuJour, numeroDuLien, problemeDuNumero, type Serie } from './goDuJour';
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
import { annonceKomi, equilibrage, KOMI_NORMAL, partiesOrdi, rendrePartieOrdi, type Equilibrage } from './equilibrage';
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
import { ESSAI_KEY, decider, etatCompte, lireEssai, noterPartieTerminee, partiesTerminees, type Acces, type EtatCompte, type Raison } from './essai';
import { compteVientDEtreCree, moyenConnexion, noterConnexionParGoogle } from './entonnoir';
import { annoncerMessage, definirRetour, erreurRetour, messageRetour, prendreRetour } from './connexionGoogle';
import { useDefisAJouer } from './defisAJouer';
import '../ui/defis.css';

const PROBLEMES_LOCAUX = parsePuzzles(ALL_PUZZLES);
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

// « Continuer avec Google » (#354) : au retour de Google (même onglet), la note d'aller-retour dit où reprendre
// (écran « Crée ton compte » et son action, défi ouvert par lien, ou Profil). Lue puis effacée une seule fois.
// La session elle-même est lue dans l'adresse par Supabase (`detectSessionInUrl`).
const RETOUR_GOOGLE = typeof location !== 'undefined' ? prendreRetour() : null;
// Erreur dans l'adresse seulement si la page revient de Google : un lien magique expiré porte aussi `#error=…`.
const ERREUR_GOOGLE = RETOUR_GOOGLE && typeof location !== 'undefined' ? erreurRetour(location.hash, location.search) : null;
if (ERREUR_GOOGLE) {
  annoncerMessage(messageRetour(ERREUR_GOOGLE));
  try { history.replaceState(history.state, '', location.pathname); } catch { /* adresse inchangée */ }
} else if (RETOUR_GOOGLE) noterConnexionParGoogle();
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
  | { quoi: 'defis' } | { quoi: 'placement' } | { quoi: 'importer' } | { quoi: 'problemes' };

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
  // Série de 3 problèmes ouverte depuis la fin d'une leçon (#200), figée à l'ouverture.
  const [serie3, setSerie3] = useState<Puzzle[] | null>(null);
  const session = useSession(supabase);
  // Une session anonyme (ouverte pour un défi, #81) compte comme « pas de compte » : ni synchronisation, ni cote, ni série serveur.
  const compteId = compteDe(session);
  const [defi, setDefi] = useState<VueDefi | null>(LIEN_DEFI !== null ? { vue: 'arrivee', jeton: LIEN_DEFI, inviteur: INVITEUR_AU_CHARGEMENT }
    : DEFI_AU_RETOUR ? { vue: 'arrivee', ...DEFI_AU_RETOUR } : null);
  const { progress, state: syncState, record } = useLessonProgress(supabase, compteId);
  // Lien de défi ouvert alors que l'app est déjà ouverte (même onglet) : on part vers l'arrivée.
  useEffect(() => ecouterJetonDefi((jeton, inviteur) => {
    setTab('jouer'); setPlaying(false); setLessonId(null); setEcranCompte(null); setDefi({ vue: 'arrivee', jeton, inviteur }); window.scrollTo({ top: 0 });
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
  // Lien « Défier un ami » de l'accueil : parties où c'est à toi de jouer (session de compte ou anonyme).
  const defisAJouer = useDefisAJouer(supabase, session?.user.id, tab === 'jouer' && !playing && !enPlacement && defi === null);
  const ouverts = ouvertsApresPlacement(OPPONENTS, placement, OUVERTS_D_OFFICE);
  const adv = adversaireOuvert(OPPONENTS, bilan, adversaire, ouverts);
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
  const duJour = problemeDuNumero(PROBLEMES_LOCAUX, numeroJour);
  const duJourFait = goDuJourFaitAppareil(numeroJour);
  // #309 : « Rejouer » seulement après une partie finie contre cet adversaire.
  // Accueil v3 : un bilan contre l'ordi (appareil d'avant le compteur de parties, ou compteur abîmé) suffit à dire
  // qu'il a déjà joué : pas d'accueil « premier lancement » pour lui.
  const home = accueil({ ...parties, n: Math.max(parties.n, Object.keys(bilan).length > 0 ? 1 : 0) }, done, { ...adv, fini: dejaAffronte(bilan, adv.id) }, settings.size, { numero: numeroJour, absence, duJourFait, titreDuJour: duJour?.title });
  const flamme = etatFlamme(serie, duJourFait);
  // #308 : après le placement, la carte « Leçon » suit le chapitre conseillé.
  const leconConseillee = leconDeLAccueil(LESSONS, CHAPITRES, progress, placement);
  // Profil (issue #50) : sous-vue ouverte, et fenêtre de consentement fermée avec Échap pendant cette session.
  const [vueProfil, setVueProfil] = useState<VueProfil>(PAGE_CONFIDENTIALITE ? 'conditions'
    : RETOUR_GOOGLE?.profil && !ECRAN_COMPTE_AU_RETOUR && !DEFI_AU_RETOUR ? 'compte' : 'menu');
  // En quittant la page publique de la politique, l'adresse redevient celle de l'app.
  useEffect(() => {
    if (vueProfil !== 'conditions' && /^\/confidentialite\/?$/.test(location.pathname)) {
      try { history.replaceState(history.state, '', '/' + location.search); } catch { /* adresse inchangée */ }
    }
  }, [vueProfil]);
  // Installation (#214) : proposée sur l'accueil à partir du 2e retour (jour d'ouverture distinct), une seule fois.
  const [ouverture] = useState(() => noterOuverture(numeroDuJour(new Date())));
  // #236 (N4) : un seul appel secondaire sur l'accueil (annonce de Mochi, carte d'installation ou « À faire »).
  const plateforme = usePlateformeInstallation();
  const [etatInstall] = useState(etatInstallation);
  const annonceAccueil = annonceGel !== null || retourSerie !== null;
  useEffect(() => { if (annonceAccueil) writeLocal(ANNONCE_DU_JOUR_KEY, numeroJour); }, [annonceAccueil, numeroJour]);
  const [jourAnnonce] = useState(() => lireJourAnnonce(readLocal<unknown>(ANNONCE_DU_JOUR_KEY, null)));
  const appel = appelSecondaire({
    jour: numeroJour, parties: parties.n, duJourFait, annonce: annonceAccueil, jourAnnonce,
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
    const d = decider(a, etat, terminees, !!supabase);
    if (d.ok) return true;
    if (!supabase) return false;
    track(EVENTS.essaiLimiteAtteinte, { raison: d.raison, parties: terminees });
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

  function lancer(mode: 'ordi' | 'deux', contre: OpponentId = adv.id) {
    if (!garde({ quoi: 'partie' }, mode === 'ordi' ? { quoi: 'ordi', contre } : { quoi: 'deux' })) return;
    // Première partie contre l'ordi : Mochi explique le but, une seule fois.
    const montrer = mode === 'ordi' && !introVue;
    setIntro(montrer);
    if (montrer) setIntroVue(true);
    if (mode === 'ordi') setAdversaire(contre);
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
    // Essai sans compte (#343) : chaque partie menée à son terme compte, sauf sur un plateau presque vide (#251).
    if (!finTropTot(stats)) setEssai(noterPartieTerminee(essai));
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
      onAccueil: () => { setPlaying(false); setResultat(null); setIntro(false); window.scrollTo({ top: 0 }); },
    };
  }

  // Toucher l'onglet Problèmes déjà actif ramène à sa liste, comme Apprendre ramène au chemin (recette du 28/09, R4).
  const [racineProblemes, setRacineProblemes] = useState(0);
  const go = (t: Tab) => {
    if (t === 'problemes' && tab === 'problemes') setRacineProblemes(n => n + 1);
    setDefi(null); setEcranCompte(null); setAnnonceGel(null); setRetourSerie(null); setEnPlacement(false); setTab(t); setPlaying(false); setLessonId(null); setSerie3(null); setVueProfil('menu'); window.scrollTo({ top: 0 });
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
    else setTab('problemes');
  };
  const etatAvant = useRef<EtatCompte | null>(null);
  useEffect(() => {
    if (compteVientDEtreCree(etatAvant.current, etat)) {
      track(EVENTS.compteCree, { moyen: moyenConnexion(), origine: ecranCompte?.raison ?? (defi?.vue === 'arrivee' ? 'defi_arrivee' : 'profil') });
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

  const enDefi = tab === 'jouer' && !playing && defi !== null;
  const enPartie = (tab === 'jouer' && !!playing) || (enDefi && defi.vue === 'partie');
  const ouvrirDefiPartie = useCallback((id: string) => { setDefi({ vue: 'partie', id }); window.scrollTo({ top: 0 }); }, []);
  const quitterDefi = () => { setDefi(null); window.scrollTo({ top: 0 }); };
  // #343 : pseudo obligatoire juste après la première connexion, avant tout le reste ; puis « Crée ton compte ».
  const pseudoAChoisir = !!supabase && etat === 'sans_pseudo' && !!compteId;
  const ecranPlein = pseudoAChoisir || ecranCompte !== null;
  let screen;
  if (pseudoAChoisir && supabase && compteId) {
    screen = <PseudoObligatoire db={supabase} userId={compteId}
      onChoisi={p => { setPseudoChoisi({ id: compteId, pseudo: p }); setClePseudo(n => n + 1); }}
      onDeconnecter={() => { void supabase?.auth.signOut(); }} />;
  } else if (ecranCompte && supabase) {
    screen = <CreerCompte db={supabase} raison={ecranCompte.raison} anonyme={etat === 'anonyme'} onRetour={() => { setEcranCompte(null); window.scrollTo({ top: 0 }); }}
      onConditions={() => { go('profil'); setVueProfil('conditions'); }} />;
  } else if (enDefi && defi.vue === 'partie' && supabase) {
    screen = <DefiPartie key={defi.id} db={supabase} partieId={defi.id} userId={session?.user.id} anonyme={estAnonyme(session)} pseudo={pseudo ?? null} confirmTouch={settings.confirmTouch}
      onRetour={quitterDefi} onAutre={() => { setDefi({ vue: 'liste' }); window.scrollTo({ top: 0 }); }} />;
  } else if (enDefi && defi.vue === 'arrivee') {
    screen = <DefiArrivee key={defi.jeton} db={supabase} jeton={defi.jeton} inviteur={defi.inviteur} compte={supabase ? etat : 'aucun'} onPartie={ouvrirDefiPartie} onAccueil={quitterDefi} />;
  } else if (enDefi) {
    screen = <DefisEcran db={supabase} userId={session === undefined ? undefined : session?.user.id ?? null} pseudo={pseudo ?? null} onPartie={ouvrirDefiPartie} />;
  } else if (enPartie) {
    screen = (
      <>
        <Game key={`${playing === 'ordi' ? adv.id : playing}-${partie}`} size={settings.size} komi={komiCompte(reglage.komi)} aiKomi={reglage.komi} avantage={reglage.avantage} accommodant={reglage.accommodant} confirmTouch={settings.confirmTouch}
          opponent={playing === 'ordi' ? adv : playing === 'guidee' ? mochiGuide : undefined}
          guidee={playing === 'guidee' ? { depart: departGuide, onCran: setCranGuide } : undefined}
          intro={playing === 'guidee' ? <Bubble>{t('guidee.bulle')}</Bubble> : playing === 'ordi' && (intro || reglage.annonce) ? <Bubble>{intro ? introBut(adv.nom) : t('partie.bulle', { nom: adv.nom })}{reglage.annonce && <><br /><span className="annonce-komi">{reglage.annonce}</span></>}</Bubble> : undefined}
          onExit={() => { setIntro(false); setPlaying(false); setResultat(null); }}
          onImporter={() => { if (!garde({ quoi: 'import' }, { quoi: 'importer' })) return; setPlaying(false); setResultat(null); setTab('profil'); setVueProfil('importer'); window.scrollTo({ top: 0 }); }}
          onResult={onResult} fin={finEcran} celebrer={settings.celebrations} aide={aideActive(settings.aide, adv.id)} portrait={playing === 'ordi' ? <Sceau id={adv.id} taille={44} /> : undefined}
          reglages={{ son: settings.sound, modifier: set }} />
      </>
    );
  } else if (tab === 'jouer' && enPlacement) {
    screen = <Placement problemes={PROBLEMES_LOCAUX} adversaires={OPPONENTS} confirmTouch={settings.confirmTouch}
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
          const s = serieDeLecon(lesson.id, PROBLEMES_LOCAUX, new Set(Object.keys(readLocal<Record<string, true>>(SOLVED_KEY, {}))),
            // #237 : pas le même exercice que l'étape de leçon qui vient d'être jouée.
            TAILLE_SERIE, p => estRedite(p, lesson));
          if (s.length) { setSerie3(s); setLessonId(null); window.scrollTo({ top: 0 }); }
        },
      } : undefined}
      jouer={{ nom: premier.nom, lancer: () => { setLessonId(null); setTab('jouer'); lancer('ordi', premier.id); } }} />;
  } else if (tab === 'apprendre') {
    screen = <LearnHome progress={progress} onOpen={ouvrirLecon} sync={syncState} />;
  } else if (tab === 'problemes') {
    screen = <Puzzles db={supabase} userId={compteId} sessionLoading={session === undefined} confirmTouch={settings.confirmTouch} onCompte={() => go('profil')}
      essai={decider({ quoi: 'probleme' }, etat, terminees, !!supabase).ok ? undefined : () => { garde({ quoi: 'probleme' }, { quoi: 'problemes' }); }}
      lien={LIEN_DU_JOUR} depuisRappel={ARRIVEE_RAPPEL} onDuJour={setDuJourOuvert} celebrer={settings.celebrations} racine={racineProblemes}
      onApprendre={versLecon1 && LESSONS[0] ? () => { setVersLecon1(false); go('apprendre'); setLessonId(LESSONS[0].id); } : undefined} />;
  } else if (tab === 'profil') {
    screen = <Profil vue={vueProfil} onVue={v => { if (v === 'importer' && !garde({ quoi: 'import' }, { quoi: 'importer' })) return; setVueProfil(v); }} settings={settings} set={set} profil={profil} serie={serie} record={recordSerie}
      parcours={{ lecons: { faites: done, total: LESSONS.length }, adversaires: OPPONENTS.length }}
      placement={placement} onPlacement={ouvrirPlacement} />;
  } else {
    const numero = numeroJour;
    const daily = duJour;
    const rangLecon = leconConseillee ? LESSONS.indexOf(leconConseillee) + 1 : 0;
    screen = (
      <Accueil adv={adv} battu={battu(bilan, adv.id)} textes={home} taille={settings.size} cartes={cartes}
        reglages={reglages} setReglages={setReglages} onTaille={n => set({ size: n })} onChoisir={setAdversaire}
        onJouer={() => lancer('ordi')} onDeux={() => lancer('deux')} onGuidee={lancerGuidee}
        probleme={daily && { numero, titre: daily.title, rows: daily.rows, reussi: duJourFait, etat: etatTuile(appel, duJourFait) }}
        onProbleme={() => go('problemes')}
        lecon={leconConseillee && { rang: rangLecon, total: LESSONS.length, titre: leconConseillee.title }}
        onLecon={() => { if (leconConseillee) { const id = leconConseillee.id; go('apprendre'); ouvrirLecon(id); } else go('apprendre'); }}
        // Un seul appel à la fois (#236, N4) : pas de carte d'installation le jour où Mochi fait une annonce ;
        // quand elle se montre, la pastille « À faire » s'efface.
        installation={appel === 'installation' ? <ProposerInstallation moment="retour" /> : null}
        // Accueil v3 : un défi d'un ami où c'est ton tour passe en premier dans « Aujourd'hui ».
        defis={supabase ? { n: defisAJouer, ouvrir: () => { if (!garde({ quoi: 'defi' }, { quoi: 'defis' })) return; setDefi({ vue: 'liste' }); window.scrollTo({ top: 0 }); } } : undefined}
        onPlacement={proposerPlacement(parties.n, placement, ouverture.retours) ? ouvrirPlacement : undefined} />
    );
  }

  const accueilVisible = tab === 'jouer' && !playing && !enPlacement && !enDefi && !ecranPlein;
  // Accueil v3 : `premier_ecran_vu`, une fois, quand l'accueil est affiché et utilisable (page chargée, polices prêtes).
  // `nouveau` : tout premier lancement sur l'appareil (aucune partie, aucun retour). Dénominateur des 60 premières secondes.
  const ecranVu = useRef(false);
  useEffect(() => {
    if (!accueilVisible || ecranVu.current) return;
    ecranVu.current = true;
    const nouveau = parties.n === 0 && ouverture.retours === 0;
    apresPremierEcran(() => trackOnce(EVENTS.premierEcranVu, { secondes: secondsSinceOpen(), nouveau, appel: appel ?? 'aucun', variante: 'v3' }));
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
          <h1>Go</h1>
          {accueilVisible
            ? (
              <span className="entete-droite">
                {/* « Défier un ami » (#81) : action secondaire, dans l'en-tête ; elle ne prend rien à la hauteur du goban. */}
                {supabase && (
                  <button type="button" className={`entete-defi${defisAJouer ? ' a-jouer' : ''}`} data-testid="lien-defi"
                    aria-label={defisAJouer ? t('defi.accueil.aJouer', { n: defisAJouer }) : t('defi.accueil.lien')}
                    onClick={() => { if (!garde({ quoi: 'defi' }, { quoi: 'defis' })) return; setDefi({ vue: 'liste' }); window.scrollTo({ top: 0 }); }}>
                    <span className="entete-defi-pierres" aria-hidden="true"><span className="stone b" /><span className="stone w" /></span>
                    <span className="entete-defi-texte" aria-hidden="true">{t('defi.accueil.lien')}</span>
                    {defisAJouer > 0 && <span className="entete-defi-point" aria-hidden="true" />}
                  </button>
                )}
                {(flamme !== null || gels > 0) && (
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
        {annonceGel !== null && !enPartie && !ecranPlein && (tab === 'jouer' || tab === 'problemes') && (
          <p className="gel-annonce" role="status"><Mochi size={30} />{fr(messageGel(annonceGel))}</p>
        )}
        {retourSerie !== null && annonceGel === null && !enPartie && !ecranPlein && (tab === 'jouer' || tab === 'problemes') && (
          <p className="gel-annonce retour-serie" role="status" data-testid="retour-serie"><Mochi size={30} />{fr(retourSerie)}</p>
        )}
        {/* Accueil v3 : pas de « Niveau 1 · 0 / 100 XP » avant le premier gain ; le Profil, lui, la montre toujours. */}
        {accueilVisible && <BarreNiveau sansXpMasquee />}
        <Suspense fallback={null}>{screen}</Suspense>
      </main>
      <FeteNiveau celebrer={settings.celebrations} ecran={`${tab}|${playing}|${lessonId ?? ''}|${serie3 ? 'serie' : ''}|${vueProfil}`} />
      <AnnonceXp celebrer={settings.celebrations} />
      {/* Pendant une partie, comme chez chess.com : pas de barre de navigation, « ‹ » ramène à l'accueil. */}
      {!enPartie && !ecranPlein && <BarreNav actif={tab} onChoisir={go} />}
      <ConsentModal visible={fenetreVisible({ consent, ignoree: accordIgnore, enPartie: enPartie || (tab === 'problemes' && duJourOuvert), surConditions: tab === 'profil' && vueProfil === 'conditions' })}
        onConditions={() => { go('profil'); setVueProfil('conditions'); }} onIgnorer={() => setAccordIgnore(true)} />

    </>
  );
}
