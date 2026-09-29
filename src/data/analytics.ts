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
import {
  PARAMS_SENSIBLES, posthogSansUrlSensible, sentryBreadcrumbSansUrlSensible, sentrySansUrlSensible,
} from './urlSensible';

/** Événements suivis. Noms stables : ils servent aux entonnoirs et à la rétention dans PostHog. */
export const EVENTS = {
  appOuverte: 'app_ouverte',
  premierePierre: 'premiere_pierre',
  partieTerminee: 'partie_terminee',
  // Première partie contre l'ordi menée jusqu'au score ou à l'abandon (une fois par appareil, via trackOnce ; #35).
  premierePartieTerminee: 'premiere_partie_terminee',
  // Leçon ouverte (#198) : dénominateur de l'entonnoir des leçons (`lecon_terminee` / `lecon_commencee`).
  leconCommencee: 'lecon_commencee',
  leconTerminee: 'lecon_terminee',
  lienConnexionEnvoye: 'lien_connexion_envoye',
  inscription: 'inscription',
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
  // Conseil de Mochi (#80) : phrase demandée (`modele`, `aucun` si rien de sûr), puis retour « utile / pas utile » (`utile`).
  conseilDemande: 'conseil_demande',
  conseilNote: 'conseil_note',
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
  captureException: (e: unknown) => unknown;
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
  if (!c.posthogKey) return Promise.resolve(null);
  phLoading = import('posthog-js').then(m => {
    const posthog = m.default as unknown as PostHogLike;
    // Niveau relu au moment du chargement : le joueur a pu répondre pendant l'import.
    const complet = niveau() === 'complet';
    posthog.init(c.posthogKey, { api_host: c.posthogHost, ...(complet ? POSTHOG_COMPLET : POSTHOG_ANONYME) });
    niveauPostHog = complet ? 'complet' : 'anonyme';
    if (complet && userId) posthog.identify(userId);
    return posthog;
  }).catch(() => null);
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
  if (!browser() || !analyticsConfig().posthogKey || niveau() === 'aucun') return;
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

/** Signale une erreur à Sentry, seulement si le joueur a accepté. */
export function captureError(error: unknown): void {
  if (!browser() || !analyticsConfig().sentryDsn || niveau() !== 'complet') return;
  void loadSentry().then(s => { s?.captureException(error); });
}

/** Secondes écoulées depuis l'ouverture de la page (mesure « première pierre dans la minute »). */
export function secondsSinceOpen(): number {
  return typeof performance === 'undefined' ? 0 : Math.round(performance.now() / 1000);
}

/** Réservé aux tests. */
export function _resetForTests(): void {
  phLoading = null; seLoading = null; niveauPostHog = 'aucun'; userId = null;
  memoryConsent = null; memoryOpposition = false; onceMemoire.clear(); listeners.clear();
}
