// Mesure d'audience (PostHog) et suivi des erreurs (Sentry). Issues #12 (RGPD) et #64 (mesure exemptée).
//
// Trois niveaux (analyse et sources : docs/juridique/consentement.md) :
// - « anonyme » (par défaut, sans consentement) : mesure d'audience réglée pour entrer dans l'exemption
//   de la CNIL (lignes directrices du 17 septembre 2020, art. 5) : rien n'est écrit sur l'appareil
//   (`persistence: 'memory'`), aucun profil (`person_profiles: 'never'`), jamais d'identifiant de compte,
//   IP non conservée, pas d'enregistrement de session. Le joueur peut s'y opposer (page Conditions).
// - « complet » (seulement après « Oui ») : identifiant persistant (rétention J1, lien avec le compte)
//   et rapports d'erreur Sentry. Rien de cela ne part avant l'accord.
// - « aucun » : le joueur s'est opposé à la mesure anonyme ; rien n'est chargé ni envoyé.
// Sans variables d'environnement (VITE_POSTHOG_KEY, VITE_SENTRY_DSN) ou hors navigateur, tout est sans effet.
// Les SDK sont importés dynamiquement : ils ne pèsent pas sur le premier chargement.

/** Événements suivis. Noms stables : ils servent aux entonnoirs et à la rétention dans PostHog. */
export const EVENTS = {
  appOuverte: 'app_ouverte',
  premierePierre: 'premiere_pierre',
  partieTerminee: 'partie_terminee',
  // Première partie contre l'ordi menée jusqu'au score ou à l'abandon (une fois par appareil, via trackOnce ; #35).
  premierePartieTerminee: 'premiere_partie_terminee',
  leconTerminee: 'lecon_terminee',
  lienConnexionEnvoye: 'lien_connexion_envoye',
  inscription: 'inscription',
  // L'écran des problèmes n'existe pas encore : constante prête pour lui.
  problemeResolu: 'probleme_resolu',
  // Écran de revue d'une partie terminée (issue #34).
  revueOuverte: 'revue_ouverte',
  // Go du jour (issue #75) : défi quotidien commun. Réussite, partage, et arrivée par un lien partagé (une fois par session).
  goDuJourResolu: 'go_du_jour_resolu',
  goDuJourPartage: 'go_du_jour_partage',
  arriveeParPartage: 'arrivee_par_partage',
  // Série protégée (issue #76) : gel gagné tous les 7 jours de série, gel consommé par un jour manqué.
  gelGagne: 'gel_gagne',
  gelUtilise: 'gel_utilise',
} as const;
export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];
export type Props = Record<string, string | number | boolean | null | undefined>;

export type Consent = 'accepte' | 'refuse';
export type Niveau = 'aucun' | 'anonyme' | 'complet';
export const CONSENT_KEY = 'go.consentement.v1';
/** Opposition à la mesure anonyme (exemptée). Mémoriser ce choix est lui-même exempté. */
export const OPPOSITION_KEY = 'go.mesure.opposition.v1';
const ONCE_PREFIX = 'go.evenement.';

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
  return {
    posthogKey: env('VITE_POSTHOG_KEY'),
    posthogHost: env('VITE_POSTHOG_HOST') || 'https://eu.i.posthog.com',
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

/** Réglages PostHog de la mesure exemptée : rien sur l'appareil, aucun profil, rien de superflu. */
export const POSTHOG_ANONYME: Readonly<Record<string, unknown>> = {
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
  ecrire(CONSENT_KEY, c);
  memoryConsent = c;
  if (c === 'accepte') { ecrire(OPPOSITION_KEY, null); memoryOpposition = false; }
  listeners.forEach(fn => fn());
  appliquer();
}

/** Droit d'opposition à la mesure anonyme. S'opposer retire aussi l'accord donné dans la fenêtre. */
export function setOpposition(oppose: boolean): void {
  if (!browser()) return;
  ecrire(OPPOSITION_KEY, oppose ? '1' : null);
  memoryOpposition = oppose;
  if (oppose && getConsent() === 'accepte') { ecrire(CONSENT_KEY, 'refuse'); memoryConsent = 'refuse'; }
  listeners.forEach(fn => fn());
  appliquer();
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
      ph.reset(); // oublie l'identifiant persistant et le lien avec le compte
      ph.set_config({ ...POSTHOG_ANONYME });
      niveauPostHog = 'anonyme';
    });
  } else if (phLoading) {
    void phLoading.then(ph => {
      if (!ph || niveauPostHog === 'aucun') return;
      ph.reset();
      ph.set_config({ ...POSTHOG_ANONYME });
      niveauPostHog = 'aucun';
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

function loadSentry(): Promise<SentryLike | null> {
  if (seLoading) return seLoading;
  const c = analyticsConfig();
  if (!c.sentryDsn) return Promise.resolve(null);
  seLoading = import('@sentry/react').then(m => {
    const sentry = m as unknown as SentryLike;
    sentry.init({ dsn: c.sentryDsn, release: c.release, environment: c.environment, sendDefaultPii: false });
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
    ph.capture(event, { ...props, version: c.release, environnement: c.environment }, { timestamp: at });
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
