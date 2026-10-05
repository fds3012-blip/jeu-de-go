// Mesure d'audience (PostHog) et suivi des erreurs (Sentry). Issues #12 (RGPD) et #64 (mesure exemptée).
//
// Trois niveaux (analyse et sources : docs/juridique/consentement.md) :
// - « anonyme » (par défaut, sans consentement) : mesure d'audience réglée pour entrer dans l'exemption
//   de la CNIL (lignes directrices du 17 septembre 2020, art. 5) : rien n'est écrit sur l'appareil
//   (`persistence: 'memory'`), aucun profil (`person_profiles: 'never'`), jamais d'identifiant de compte,
//   IP non conservée, pas de localisation déduite de l'IP (`$geoip_disable`, #223), pas d'enregistrement de session. Le joueur peut s'y opposer (page Conditions).
// - « complet » (seulement après « Oui ») : identifiant persistant (rétention J1, lien avec le compte)
//   et rapports d'erreur Sentry. Rien de cela ne part avant l'accord.
// - « aucun » : le joueur s'est opposé à la mesure anonyme ; rien n'est chargé ni envoyé.
// Sans variables d'environnement (VITE_POSTHOG_KEY, VITE_SENTRY_DSN) ou hors navigateur, tout est sans effet.
// Les SDK sont importés dynamiquement : ils ne pèsent pas sur le premier chargement.
// Aux deux niveaux, les adresses envoyées sont nettoyées (fragment `#`, jetons, codes : src/data/urlSensible.ts, E14).
import { premierEcran } from '../premierEcran';
import {
  PARAMS_SENSIBLES, posthogSansUrlSensible, sentryBreadcrumbSansUrlSensible, sentrySansUrlSensible,
} from './urlSensible';

/** Événements suivis. Noms stables : ils servent aux entonnoirs et à la rétention dans PostHog. */
export const EVENTS = {
  appOuverte: 'app_ouverte',
  // Accueil affiché et utilisable (page chargée, polices prêtes), une fois (trackOnce). `nouveau` : premier lancement
  // sur l'appareil (aucune partie, aucun retour) : dénominateur de l'entonnoir des 60 premières secondes, même sans accord.
  premierEcranVu: 'premier_ecran_vu',
  premierePierre: 'premiere_pierre',
  partieTerminee: 'partie_terminee',
  // Première partie contre l'ordi menée jusqu'au score ou à l'abandon (une fois par appareil, via trackOnce ; #35).
  premierePartieTerminee: 'premiere_partie_terminee',
  // Leçon ouverte (#198) : dénominateur de l'entonnoir des leçons (`lecon_terminee` / `lecon_commencee`).
  leconCommencee: 'lecon_commencee',
  leconTerminee: 'lecon_terminee',
  // E-mail de connexion envoyé (code à 6 chiffres et lien, #343 ; `moyen` : `code`).
  lienConnexionEnvoye: 'lien_connexion_envoye',
  // Entonnoir essai → compte (#343). `essai_limite_atteinte` : écran « Crée ton compte » ouvert (`raison`, `parties`).
  // `compte_cree` : connecté sans pseudo, donc nouveau compte (`moyen` : `code`, `lien`, `google`, `apple` ou `facebook` ; `origine`).
  // `pseudo_choisi` : premier pseudo enregistré (remplace `inscription`) ; le compte est complet.
  // `compte_methode` (#354, #411) : moyen touché (`methode` : `google`, `apple`, `facebook` ou `code`, `navigateur_integre`).
  compteMethode: 'compte_methode',
  essaiLimiteAtteinte: 'essai_limite_atteinte',
  compteCree: 'compte_cree',
  pseudoChoisi: 'pseudo_choisi',
  // L'écran des problèmes n'existe pas encore : constante prête pour lui.
  problemeResolu: 'probleme_resolu',
  // « Continuer » à ta mesure (#284) : premier essai d'un problème noté (hors Go du jour, lien partagé, déjà réussi ou vu).
  // `cote_joueur` (avant l'essai, jamais affichée), `cote_probleme`, `premier_essai_reussi` : réussite par tranche de cote.
  problemeTermine: 'probleme_termine',
  // Écran de revue d'une partie terminée (issue #34).
  revueOuverte: 'revue_ouverte',
  // « Rejouer d'ici » depuis la revue (issue #186) : cible, 30 % des revues ; `cle` dit si c'est depuis le moment clé.
  revueRejouer: 'revue_rejouer',
  // Go du jour (issue #75) : défi quotidien commun. Réussite, partage, et arrivée par un lien partagé (une fois par session).
  goDuJourResolu: 'go_du_jour_resolu',
  goDuJourPartage: 'go_du_jour_partage',
  arriveeParPartage: 'arrivee_par_partage',
  // « Rejoue tes erreurs » (issue #77) : une erreur de la revue rejouée comme problème (premier essai).
  // `source` : `revue` (« Rejoue cette erreur ») ou `problemes` (révision espacée, « Tes erreurs à rejouer »).
  erreurRejouee: 'erreur_rejouee',
  // « Rejouer mes erreurs » du bilan (#428) : une erreur de la séance terminée, trouvée ou non. `trouvee`, `essais` (1 à 3 ;
  // 0 si « Montre-moi le coup » avant tout essai), `note` (`grosse`, `erreur`, `manque`). Jamais le coup ni la partie.
  revueErreurRejouee: 'revue_erreur_rejouee',
  // Erreur maîtrisée (issue #77) : deuxième réussite en révision, elle ne revient plus.
  erreurMaitrisee: 'erreur_maitrisee',
  // Série protégée (issue #76) : gel gagné tous les 7 jours de série, gel consommé par un jour manqué.
  gelGagne: 'gel_gagne',
  gelUtilise: 'gel_utilise',
  // Rien de gagné ne se perd (issue #212) : série perdue constatée à l'ouverture, une fois par série. Dénominateur du retour à J+7.
  seriePerdue: 'serie_perdue',
  // Progression (issue #109) : XP gagnés (agrégés sur quelques secondes) et niveau franchi.
  xpGagne: 'xp_gagne',
  niveauAtteint: 'niveau_atteint',
  // Plan de marquage (issue #166). Chaque partie commencée (premier coup joué) : dénominateur du taux de parties finies.
  partieCommencee: 'partie_commencee',
  // Deux passes, puis comptage manuel (pierres mortes à corriger à la main) : part des fins de partie qui perdent le joueur (#159).
  comptageManuel: 'comptage_manuel',
  // Proposer d'installer l'app (#178) : carte montrée (une fois, après une première victoire ou à l'accueil du 2e retour depuis #214 ; `profil` : ligne du Profil), puis installation acceptée.
  installationProposee: 'installation_proposee',
  installationAcceptee: 'installation_acceptee',
  // Rappel quotidien (#36) : proposition montrée en fin de partie (une fois, avec un compte), acceptée (`moment_jour` :
  // matin, midi, soir ; `source` : fin_partie ou profil), refusée (`raison` : non, navigateur), notification touchée.
  // Taux d'acceptation : `rappel_accepte` / `rappel_propose` ; efficacité : `rappel_ouvert`, puis `go_du_jour_resolu`.
  rappelPropose: 'rappel_propose',
  rappelAccepte: 'rappel_accepte',
  rappelRefuse: 'rappel_refuse',
  rappelOuvert: 'rappel_ouvert',
  // Aide graduée des problèmes (#197) : la réponse a été montrée après un échec (le problème devient « Vu », pas « Réussi »).
  solutionVue: 'solution_vue',
  // Révision du jour (#199) : les exercices du jour (problèmes déjà réussis, repris à J+1, J+3, J+7) sont tous faits.
  revisionFaite: 'revision_faite',
  // Course aux problèmes (#287) : fin d'une course (score, erreurs, durée, raison) et partage du score.
  courseTerminee: 'course_terminee',
  coursePartagee: 'course_partagee',
  // « Je sais déjà jouer » (#283) : placement commencé, terminé (`kyu`, null si tout raté), passé (`etape` : 0 à 3).
  placementCommence: 'placement_commence',
  placementTermine: 'placement_termine',
  placementSaute: 'placement_saute',
  // Import d'une partie SGF (#286). `source` : `fichier`, `texte` ou `ogs` (lien de partie OGS).
  // Commencé (bouton « Lire la partie » ou fichier choisi), réussi (`octets`, `coups`, `taille`, `handicap`), refusé (`raison`, `coup`).
  importSgfCommence: 'import_sgf_commence',
  importSgfReussi: 'import_sgf_reussi',
  importSgfErreur: 'import_sgf_erreur',
  // Défi par lien (#81) : lien créé (`sans_compte`), lien ouvert par l'ami (`sans_compte`), e-mail lié à une session
  // sans compte (`moment` : `apres_coup` sur l'écran de partie, `profil`). Coefficient viral : `defi_ouvert` / `defi_cree`.
  defiCree: 'defi_cree',
  defiOuvert: 'defi_ouvert',
  defiInscription: 'defi_inscription',
  // Amis (#359) : deux joueurs deviennent amis (`comment` : `acceptation` d'une demande reçue, `croisee` quand ta demande
  // rejoint la sienne), puis défi lancé depuis « Mes amis », sans lien. Jamais le pseudo ni la partie.
  amiAjoute: 'ami_ajoute',
  defiDepuisProfil: 'defi_depuis_profil',
  // Conseil de Mochi (#80) : phrase demandée (`modele`, `aucun` si rien de sûr), puis retour « utile / pas utile » (`utile`).
  conseilDemande: 'conseil_demande',
  conseilNote: 'conseil_note',
  // Notifications dans l'app (#367) : un élément « À faire » touché. `type` : defi, serie, goDuJour, lecon, ami ;
  // `source` : accueil (tuile d'« Aujourd'hui »), onglet (onglet à pastille) ; `attente_h` (défi) :
  // heures depuis le coup de l'adversaire, pour le délai médian de réponse.
  notificationOuverte: 'notification_ouverte',
  // Aide du joueur (#362) : `fiche` (`regles`, `compter`, `mots`, `questions`), `mot` (mot du glossaire ouvert d'emblée, sinon vide),
  // `depuis` (`profil`, `lecon`, `probleme`, `partie`, `clavier`). Aucun texte cherché n'est envoyé.
  aideOuverte: 'aide_ouverte',
  // Partie en direct contre un humain (#360) : adversaire trouvé (`taille`, `cadence`, `regles`, `attente_s` : délai
  // d'appariement), puis partie finie (`taille`, `cadence`, `issue` : victoire, defaite, egalite, annulee ;
  // `raison` : points, abandon, temps, annulee ; `coups`). Jamais la partie ni l'adversaire.
  partieEnLigneCommencee: 'partie_en_ligne_commencee',
  partieEnLigneTerminee: 'partie_en_ligne_terminee',
  // File vide (#436) : au bout de 25 s d'attente, Mochi propose une partie contre l'IA en restant dans la file.
  // `accepte` : vrai si le joueur joue contre l'IA, faux s'il préfère attendre ou annule. Jamais l'adversaire IA choisi.
  fileRepliIa: 'file_repli_ia',
  // Parties lentes classées (#440) : adversaire trouvé (`taille`, `delai_jours` : 1 à 3, `attente_h` : heures de
  // recherche, 0 si l'adversaire attendait), puis partie finie vue par le joueur (`taille`, `delai_jours`, `issue` :
  // victoire, defaite, egalite, annulee ; `raison` : points, abandon, temps, annulee ; `coups`). Jamais la partie ni
  // l'adversaire.
  partieLenteCommencee: 'partie_lente_commencee',
  partieLenteTerminee: 'partie_lente_terminee',
  // Modes de l'accueil (#429) : `mode` (en_ligne, ordi, ami, deux, guidee), `depuis` (bouton, plateau, tuile, plus,
  // feuille : bouton de « Changer »), `principal` (le mode était l'action principale de l'accueil).
  modeChoisi: 'mode_choisi',
  // Partager une partie (#364) : feuille « Partager » du bilan ouverte (`mode` : ordi, deux, import ; `compte` : lien et
  // défi possibles), partage fait (`objet` : lien, image, sgf, defi ; `moyen` : web_share, copie, manuel, telechargement),
  // échec (`objet`, `raison` : compte, pseudo, jour, plein, illisible, reseau, canvas), lien retiré (`mode`). L'arrivée de
  // l'ami : `arrivee_par_partage` avec `source` = `partie`. Jamais le lien, le jeton, la partie ni un pseudo.
  partageOuvert: 'partage_ouvert',
  partageEnvoye: 'partage_envoye',
  partageEchoue: 'partage_echoue',
  partageRetire: 'partage_retire',
} as const;
export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];
export type Props = Record<string, string | number | boolean | null | undefined>;

export type Consent = 'accepte' | 'refuse';
export type Niveau = 'aucun' | 'anonyme' | 'complet';
export const CONSENT_KEY = 'go.consentement.v1';
/** Opposition à la mesure anonyme (exemptée). Mémoriser ce choix est lui-même exempté. */
export const OPPOSITION_KEY = 'go.mesure.opposition.v1';
const ONCE_PREFIX = 'go.evenement.';
// Hors de l'espace `go.*` : l'app ne l'écrit jamais, seul le test e2e le pose (rien à citer dans la politique).
const E2E_POSTHOG_KEY = 'e2e.posthog.hote';

interface PostHogLike {
  init: (key: string, config: Record<string, unknown>) => unknown;
  set_config: (config: Record<string, unknown>) => unknown;
  capture: (event: string, props?: Props, options?: { timestamp?: Date }) => unknown;
  identify: (id: string) => unknown;
  reset: () => unknown;
}
interface SentryLike {
  init: (options: Record<string, unknown>) => unknown;
  captureException: (e: unknown, hint?: { tags?: Record<string, string> }) => unknown;
  setUser: (u: { id: string } | null) => unknown;
  close: () => unknown;
}

let phLoading: Promise<PostHogLike | null> | null = null;
let seLoading: Promise<SentryLike | null> | null = null;
let niveauPostHog: Niveau = 'aucun';
let userId: string | null = null;
const onceMemoire = new Set<string>();
const listeners = new Set<() => void>();

function browser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function env(name: string): string {
  const v = (import.meta.env as Record<string, string | undefined>)[name];
  return typeof v === 'string' ? v.trim() : '';
}

/** Configuration publique lue au moment de l'appel (modifiable dans les tests). */
export function analyticsConfig() {
  // Builds e2e seulement (VITE_E2E, retiré des builds de production) : e2e/url-sensible.spec.ts pointe PostHog
  // vers un hôte intercepté par Playwright, pour lire ce qui serait envoyé. Sans ce repère, rien ne change.
  const hoteE2e = import.meta.env.VITE_E2E && browser() ? lire(E2E_POSTHOG_KEY) : null;
  return {
    posthogKey: hoteE2e ? 'phc_e2e' : env('VITE_POSTHOG_KEY'),
    posthogHost: hoteE2e || env('VITE_POSTHOG_HOST') || 'https://eu.i.posthog.com',
    sentryDsn: env('VITE_SENTRY_DSN'),
    release: env('VITE_APP_VERSION') || env('VITE_VERCEL_GIT_COMMIT_SHA') || 'dev',
    environment: env('VITE_VERCEL_ENV') || (import.meta.env.PROD ? 'production' : 'development'),
  };
}

/** Vrai si au moins un service est configuré : sinon, rien n'est chargé ni envoyé. */
export function analyticsAvailable(): boolean {
  const c = analyticsConfig();
  return browser() && (!!c.posthogKey || !!c.sentryDsn);
}

/**
 * Localisation (#223, écart E2 de la politique de confidentialité) : PostHog déduit pays, région et coordonnées
 * approchées de l'IP, sauf si l'événement porte `$geoip_disable: true`. posthog-js n'a pas d'option d'init pour
 * cela : `before_send` l'ajoute à chaque envoi (nos événements comme ceux du SDK, `$identify` compris), aux deux
 * niveaux. Contrairement à `register()`, ce réglage survit à `reset()`.
 */
export function sansLocalisation<E extends { event?: string; properties?: Record<string, unknown> } | null>(ev: E): E {
  if (ev) ev.properties = { ...ev.properties, $geoip_disable: true };
  return ev;
}

/**
 * Filtres appliqués à chaque envoi PostHog, dans l'ordre : adresses nettoyées (E14), puis sans localisation (E2).
 * `disable_capture_url_hashes` retire déjà le fragment côté SDK ; le filtre couvre aussi la requête (`?code=`…)
 * et les propriétés que l'option ne connaît pas.
 */
export const POSTHOG_AVANT_ENVOI = [posthogSansUrlSensible, sansLocalisation] as const;

/** Réglages PostHog de la mesure exemptée : rien sur l'appareil, aucun profil, rien de superflu. */
export const POSTHOG_ANONYME: Readonly<Record<string, unknown>> = {
  before_send: [...POSTHOG_AVANT_ENVOI],
  disable_capture_url_hashes: true,
  persistence: 'memory',
  person_profiles: 'never',
  ip: false,
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_dead_clicks: false,
  capture_exceptions: false,
  disable_session_recording: true,
  disable_surveys: true,
  advanced_disable_feature_flags: true,
  disable_external_dependency_loading: true,
  save_referrer: false,
  mask_personal_data_properties: true,
  // Double sécurité si un envoi échappait à before_send : ces paramètres sont masqués (`<MASKED>`) par le SDK.
  custom_personal_data_properties: [...PARAMS_SENSIBLES],
};
/** Après accord seulement : identifiant persistant (rétention J1) et lien avec le compte. */
export const POSTHOG_COMPLET: Readonly<Record<string, unknown>> = {
  ...POSTHOG_ANONYME,
  persistence: 'localStorage',
  person_profiles: 'always',
};

// Replis si localStorage est indisponible (navigation privée stricte) : choix valables pour la session.
let memoryConsent: Consent | null = null;
let memoryOpposition = false;

function lire(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function ecrire(k: string, v: string | null) {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* repli mémoire */ }
}

export function getConsent(): Consent | null {
  if (!browser()) return null;
  const v = lire(CONSENT_KEY);
  return v === 'accepte' || v === 'refuse' ? v : memoryConsent;
}

/** Vrai si le joueur s'est opposé à la mesure anonyme (page Conditions). */
export function getOpposition(): boolean {
  if (!browser()) return false;
  return lire(OPPOSITION_KEY) === '1' || memoryOpposition;
}

/** Niveau de suivi en vigueur, d'après les deux choix du joueur. */
export function niveau(): Niveau {
  if (!browser()) return 'aucun';
  if (getConsent() === 'accepte') return 'complet';
  return getOpposition() ? 'aucun' : 'anonyme';
}

/** Abonnement aux changements de choix (pour useSyncExternalStore). */
export function subscribeConsent(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Réponse à la fenêtre : « Oui » active les rapports d'erreur et la mesure détaillée ; « Non merci » les coupe. */
export function setConsent(c: Consent): void {
  if (!browser()) return;
  const avant = niveau();
  ecrire(CONSENT_KEY, c);
  memoryConsent = c;
  if (c === 'accepte') { ecrire(OPPOSITION_KEY, null); memoryOpposition = false; }
  if (avant === 'complet' && niveau() !== 'complet') effacerTraces();
  listeners.forEach(fn => fn());
  appliquer();
}

/** Droit d'opposition à la mesure anonyme. S'opposer retire aussi l'accord donné dans la fenêtre. */
export function setOpposition(oppose: boolean): void {
  if (!browser()) return;
  const avant = niveau();
  ecrire(OPPOSITION_KEY, oppose ? '1' : null);
  memoryOpposition = oppose;
  if (oppose && getConsent() === 'accepte') { ecrire(CONSENT_KEY, 'refuse'); memoryConsent = 'refuse'; }
  // #437 : s'opposer efface aussi les repères des compteurs anonymes (src/data/compteurs.ts).
  if (oppose) effacerReperesEntonnoir();
  if (avant === 'complet' && niveau() !== 'complet') effacerTraces();
  listeners.forEach(fn => fn());
  appliquer();
}

/**
 * Retrait de l'accord (#223, écart E5) : efface de l'appareil l'identifiant PostHog persistant (clés `ph_*`,
 * dont `ph_<clé>_posthog`, et l'état d'opt-out `__ph_opt_in_out_*`) et les repères `go.evenement.*` de trackOnce.
 * Ne touche à rien d'autre : réglages, choix de consentement et progression du joueur restent.
 */
export function effacerTraces(): void {
  if (!browser()) return;
  const aEffacer = (k: string) => k.startsWith('ph_') || k.startsWith('__ph_opt_in_out_') || k.startsWith(ONCE_PREFIX);
  for (const store of [() => localStorage, () => sessionStorage]) {
    try {
      const s = store();
      const cles: string[] = [];
      for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k !== null && aEffacer(k)) cles.push(k); }
      cles.forEach(k => s.removeItem(k));
    } catch { /* stockage indisponible : rien à effacer */ }
  }
}

/** Met les SDK en accord avec le niveau courant : chargement, passage anonyme ↔ complet, arrêt. */
function appliquer() {
  if (!analyticsAvailable()) return;
  const n = niveau();
  if (n === 'complet') {
    void loadSentry();
    void loadPostHog().then(ph => {
      if (!ph || niveauPostHog === 'complet') return;
      ph.set_config({ ...POSTHOG_COMPLET });
      niveauPostHog = 'complet';
      if (userId) ph.identify(userId);
    });
    return;
  }
  // Sentry n'est jamais actif sans accord.
  if (seLoading) { void seLoading.then(s => { void s?.close(); }); seLoading = null; }
  if (n === 'anonyme') {
    void loadPostHog().then(ph => {
      if (!ph || niveauPostHog === 'anonyme') return;
      const quitteComplet = niveauPostHog === 'complet';
      ph.reset(); // oublie l'identifiant persistant et le lien avec le compte
      ph.set_config({ ...POSTHOG_ANONYME });
      niveauPostHog = 'anonyme';
      // reset() a pu réécrire un nouvel identifiant dans le stockage avant le passage en mémoire.
      if (quitteComplet && niveau() !== 'complet') effacerTraces();
    });
  } else if (phLoading) {
    void phLoading.then(ph => {
      if (!ph || niveauPostHog === 'aucun') return;
      const quitteComplet = niveauPostHog === 'complet';
      ph.reset();
      ph.set_config({ ...POSTHOG_ANONYME });
      niveauPostHog = 'aucun';
      if (quitteComplet && niveau() !== 'complet') effacerTraces();
    });
  }
}

function loadPostHog(): Promise<PostHogLike | null> {
  if (phLoading) return phLoading;
  const c = analyticsConfig();
  if (!c.posthogKey || estEquipe()) return Promise.resolve(null);
  // Niveau anonyme (#325) : PostHog (≈ 100 Ko gzip) attend que l'accueil soit affiché, pour ne pas ralentir l'ouverture
  // sur un téléphone lent. Les événements gardent leur heure (`timestamp`) : rien n'est décalé. Avec accord : tout de suite.
  const attente = niveau() === 'complet' ? Promise.resolve() : premierEcran();
  const chargement: Promise<PostHogLike | null> = attente.then(() => {
    // Opposition exprimée pendant l'attente : PostHog n'est pas chargé (un accord ultérieur le chargera).
    if (niveau() === 'aucun') {
      if (phLoading === chargement) phLoading = null;
      return null;
    }
    return import('posthog-js').then(m => {
      const posthog = m.default as unknown as PostHogLike;
      // Niveau relu au moment du chargement : le joueur a pu répondre pendant l'attente ou l'import.
      const complet = niveau() === 'complet';
      posthog.init(c.posthogKey, { api_host: c.posthogHost, ...(complet ? POSTHOG_COMPLET : POSTHOG_ANONYME) });
      niveauPostHog = complet ? 'complet' : 'anonyme';
      if (complet && userId) posthog.identify(userId);
      return posthog;
    });
  }).catch(() => null);
  phLoading = chargement;
  return phLoading;
}

/** Réglages Sentry communs : pas de données personnelles, adresses nettoyées (request.url, breadcrumbs ; E14). */
export const SENTRY_OPTIONS: Readonly<Record<string, unknown>> = {
  sendDefaultPii: false,
  beforeSend: sentrySansUrlSensible,
  beforeBreadcrumb: sentryBreadcrumbSansUrlSensible,
};

function loadSentry(): Promise<SentryLike | null> {
  if (seLoading) return seLoading;
  const c = analyticsConfig();
  if (!c.sentryDsn) return Promise.resolve(null);
  seLoading = import('@sentry/react').then(m => {
    const sentry = m as unknown as SentryLike;
    sentry.init({ ...SENTRY_OPTIONS, dsn: c.sentryDsn, release: c.release, environment: c.environment });
    if (userId) sentry.setUser({ id: userId });
    // Sentry écoute maintenant lui-même les erreurs non attrapées : le filet du démarrage s'arrête (pas de doublon).
    arreterFilet?.();
    return sentry;
  }).catch(() => null);
  return seLoading;
}

/** À appeler une fois au démarrage : charge ce que les choix du joueur permettent. */
export function initAnalytics(): void {
  if (niveau() === 'aucun') return;
  appliquer();
}

/** Envoie un événement, sauf opposition. Sans accord, il part sans identifiant persistant ni compte. */
export function track(event: AnalyticsEvent, props?: Props): void {
  if (!browser() || !analyticsConfig().posthogKey || niveau() === 'aucun' || estEquipe()) return;
  const at = new Date();
  void loadPostHog().then(ph => {
    if (!ph || niveau() === 'aucun') return;
    const c = analyticsConfig();
    // `mesure` : niveau au moment de l'envoi. Les indicateurs par appareil (rétention, nouveaux joueurs) se lisent sur « complet ».
    ph.capture(event, { ...props, version: c.release, environnement: c.environment, mesure: niveau() }, { timestamp: at });
  });
}

/**
 * Comme `track`, mais une seule fois. Avec accord : une fois par appareil (repère en localStorage).
 * Sans accord : une fois par session, sans rien écrire sur l'appareil.
 */
export function trackOnce(event: AnalyticsEvent, props?: Props): void {
  if (!browser() || niveau() === 'aucun') return;
  const key = ONCE_PREFIX + event;
  if (onceMemoire.has(key) || lire(key)) return;
  onceMemoire.add(key);
  if (niveau() === 'complet') ecrire(key, '1');
  track(event, props);
}

/** Relie les événements au compte (identifiant Supabase, jamais l'e-mail), seulement avec accord. `null` à la déconnexion. */
export function identify(id: string | null): void {
  if (!browser() || id === userId) return;
  const previous = userId;
  userId = id;
  if (niveau() !== 'complet') return;
  if (phLoading) void phLoading.then(ph => { if (id) ph?.identify(id); else if (previous) ph?.reset(); });
  if (seLoading) void seLoading.then(s => { s?.setUser(id ? { id } : null); });
}

/**
 * Catégorie d'une erreur signalée (robustesse, #325) : étiquette Sentry `categorie`, pour trier les écrans qui n'arrivent
 * pas (`chargement`) et le réseau (`reseau`) des bogues de l'app (`rendu`). `origine` : d'où elle vient (`ecran`, `global`, `prechargement`).
 */
export interface ContexteErreur {
  categorie: 'chargement' | 'reseau' | 'rendu';
  origine?: string;
}

/**
 * Signale une erreur à Sentry, seulement si le joueur a accepté. Jamais de donnée personnelle : `sendDefaultPii` est
 * désactivé et `beforeSend` nettoie adresses et messages (src/data/urlSensible.ts) ; les étiquettes sont des mots fixes.
 */
export function captureError(error: unknown, contexte?: ContexteErreur): void {
  if (!browser() || !analyticsConfig().sentryDsn || niveau() !== 'complet') return;
  void loadSentry().then(s => {
    if (!s) return;
    if (!contexte) { s.captureException(error); return; }
    const tags: Record<string, string> = { categorie: contexte.categorie };
    if (contexte.origine) tags.origine = contexte.origine;
    s.captureException(error, { tags });
  });
}

let arreterFilet: (() => void) | null = null;

/**
 * Filet du démarrage (#401) : une erreur non attrapée (ou une promesse rejetée) qui arrive avant que Sentry soit chargé
 * n'est pas perdue. Elle passe par `captureError`, qui attend Sentry : elle part dès son arrivée. Comme toute erreur,
 * seulement avec l'accord du joueur. Le filet s'arrête quand Sentry est prêt (il prend alors le relais).
 */
export function ecouterErreursAvantSentry(cible: Pick<Window, 'addEventListener' | 'removeEventListener'> | undefined =
  typeof window === 'undefined' ? undefined : window): void {
  if (!cible || arreterFilet) return;
  const contexte: ContexteErreur = { categorie: 'rendu', origine: 'demarrage' };
  // `error` sans objet d'erreur : script d'une autre origine (« Script error. »), rien d'utile à signaler.
  const surErreur = (e: Event) => { const err = (e as ErrorEvent).error; if (err !== undefined && err !== null) captureError(err, contexte); };
  const surRejet = (e: Event) => { captureError((e as PromiseRejectionEvent).reason, contexte); };
  cible.addEventListener('error', surErreur);
  cible.addEventListener('unhandledrejection', surRejet);
  arreterFilet = () => {
    cible.removeEventListener('error', surErreur);
    cible.removeEventListener('unhandledrejection', surRejet);
    arreterFilet = null;
  };
}

/** Secondes écoulées depuis l'ouverture de la page (mesure « première pierre dans la minute »). */
export function secondsSinceOpen(): number {
  return typeof performance === 'undefined' ? 0 : Math.round(performance.now() / 1000);
}

/**
 * Appareils de l'équipe (#437) : un drapeau local (`go.equipe.v1`, sans identifiant) coupe PostHog et les compteurs
 * anonymes de l'entonnoir, pour ne pas compter nos propres essais. Posé par `?equipe=1` (retiré par `?equipe=0`) ou
 * par 7 touchers sur la version, dans Profil > Réglages. Sentry n'est pas concerné (il suit toujours l'accord).
 */
export const EQUIPE_KEY = 'go.equipe.v1';
let memoryEquipe = false;

export function estEquipe(): boolean {
  if (!browser()) return false;
  return lire(EQUIPE_KEY) === '1' || memoryEquipe;
}

export function setEquipe(oui: boolean): void {
  if (!browser()) return;
  ecrire(EQUIPE_KEY, oui ? '1' : null);
  memoryEquipe = oui;
  listeners.forEach(fn => fn());
}

/** `?equipe=1` ou `?equipe=0` dans l'adresse : pose ou retire le drapeau, puis retire le paramètre de l'adresse. */
export function lireEquipeDansAdresse(): void {
  if (!browser()) return;
  try {
    const url = new URL(location.href);
    const v = url.searchParams.get('equipe');
    if (v !== '1' && v !== '0') return;
    setEquipe(v === '1');
    url.searchParams.delete('equipe');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  } catch { /* adresse illisible : rien */ }
}

/** Préfixe des repères « étape déjà comptée » des compteurs anonymes (#437, src/data/compteurs.ts). */
export const ENTONNOIR_PREFIX = 'go.entonnoir.';

/** Efface les repères des compteurs anonymes (opposition à la mesure). */
export function effacerReperesEntonnoir(): void {
  if (!browser()) return;
  try {
    const cles: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(ENTONNOIR_PREFIX)) cles.push(k); }
    cles.forEach(k => localStorage.removeItem(k));
  } catch { /* stockage indisponible : rien à effacer */ }
}

/** Réservé aux tests. */
export function _resetForTests(): void {
  memoryEquipe = false;
  phLoading = null; seLoading = null; niveauPostHog = 'aucun'; userId = null; arreterFilet?.();
  memoryConsent = null; memoryOpposition = false; onceMemoire.clear(); listeners.clear();
}
