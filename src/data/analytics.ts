// Mesure d'audience (PostHog) et suivi des erreurs (Sentry), soumis au consentement.
//
// Règles (issue #12, RGPD) :
// - rien n'est chargé ni envoyé tant que le joueur n'a pas accepté ;
// - rien n'est chargé ni envoyé sans variables d'environnement (VITE_POSTHOG_KEY, VITE_SENTRY_DSN) ;
// - hors navigateur (tests, rendu serveur), tout est sans effet ;
// - les SDK sont importés dynamiquement : ils ne pèsent pas sur le premier chargement.
//
// Avant le choix du joueur, les événements attendent en mémoire (jamais envoyés, jamais stockés) :
// s'il accepte pendant la session, ils partent avec leur heure d'origine ; s'il refuse, ils sont effacés.
// Cela permet de mesurer la première pierre, posée avant de répondre si le joueur a fermé la fenêtre de consentement.

/** Événements suivis. Noms stables : ils servent aux entonnoirs et à la rétention dans PostHog. */
export const EVENTS = {
  appOuverte: 'app_ouverte',
  premierePierre: 'premiere_pierre',
  partieTerminee: 'partie_terminee',
  leconTerminee: 'lecon_terminee',
  lienConnexionEnvoye: 'lien_connexion_envoye',
  inscription: 'inscription',
  // L'écran des problèmes n'existe pas encore : constante prête pour lui.
  problemeResolu: 'probleme_resolu',
} as const;
export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];
export type Props = Record<string, string | number | boolean | null | undefined>;

export type Consent = 'accepte' | 'refuse';
export const CONSENT_KEY = 'go.consentement.v1';
const ONCE_PREFIX = 'go.evenement.';
const QUEUE_MAX = 50;

interface PostHogLike {
  init: (key: string, config: Record<string, unknown>) => unknown;
  capture: (event: string, props?: Props, options?: { timestamp?: Date }) => unknown;
  identify: (id: string) => unknown;
  reset: () => unknown;
  opt_in_capturing: () => unknown;
  opt_out_capturing: () => unknown;
}
interface SentryLike {
  init: (options: Record<string, unknown>) => unknown;
  captureException: (e: unknown) => unknown;
  setUser: (u: { id: string } | null) => unknown;
  close: () => unknown;
}
interface Clients { posthog: PostHogLike | null; sentry: SentryLike | null }

let loading: Promise<Clients> | null = null;
let queue: { event: string; props?: Props; at: Date }[] = [];
let userId: string | null = null;
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

/** Vrai si au moins un service est configuré : sinon, rien n'est chargé ni envoyé, même avec l'accord du joueur. */
export function analyticsAvailable(): boolean {
  const c = analyticsConfig();
  return browser() && (!!c.posthogKey || !!c.sentryDsn);
}

export function getConsent(): Consent | null {
  if (!browser()) return null;
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'accepte' || v === 'refuse' ? v : memoryConsent;
  } catch { return memoryConsent; }
}

/** Abonnement aux changements de consentement (pour useSyncExternalStore). */
export function subscribeConsent(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function setConsent(c: Consent): void {
  if (!browser()) return;
  try { localStorage.setItem(CONSENT_KEY, c); } catch { /* stockage indisponible : choix valable pour la session */ }
  memoryConsent = c;
  listeners.forEach(fn => fn());
  if (c === 'accepte') {
    void load().then(({ posthog }) => {
      posthog?.opt_in_capturing();
      flush();
    });
  } else {
    queue = [];
    if (loading) void loading.then(({ posthog, sentry }) => { posthog?.opt_out_capturing(); posthog?.reset(); void sentry?.close(); });
    loading = null;
  }
}

// Repli si localStorage est indisponible (navigation privée stricte).
let memoryConsent: Consent | null = null;
function consent(): Consent | null { return getConsent() ?? memoryConsent; }

function load(): Promise<Clients> {
  if (loading) return loading;
  const c = analyticsConfig();
  const ph = c.posthogKey
    ? import('posthog-js').then(m => {
        const posthog = m.default as unknown as PostHogLike;
        posthog.init(c.posthogKey, {
          api_host: c.posthogHost,
          person_profiles: 'always', // la rétention J1 compte aussi les joueurs sans compte
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
          disable_session_recording: true,
          persistence: 'localStorage',
        });
        if (userId) posthog.identify(userId);
        return posthog;
      }).catch(() => null)
    : Promise.resolve(null);
  const se = c.sentryDsn
    ? import('@sentry/react').then(m => {
        const sentry = m as unknown as SentryLike;
        sentry.init({ dsn: c.sentryDsn, release: c.release, environment: c.environment, sendDefaultPii: false });
        if (userId) sentry.setUser({ id: userId });
        return sentry;
      }).catch(() => null)
    : Promise.resolve(null);
  loading = Promise.all([ph, se]).then(([posthog, sentry]) => ({ posthog, sentry }));
  return loading;
}

function flush() {
  const pending = queue;
  queue = [];
  for (const e of pending) send(e.event, e.props, e.at);
}

function send(event: string, props: Props | undefined, at: Date) {
  void load().then(({ posthog }) => {
    const c = analyticsConfig();
    posthog?.capture(event, { ...props, version: c.release, environnement: c.environment }, { timestamp: at });
  });
}

/** À appeler une fois au démarrage : charge les SDK si le joueur a déjà accepté. */
export function initAnalytics(): void {
  if (!analyticsAvailable() || consent() !== 'accepte') return;
  void load();
}

/** Envoie un événement si le joueur a accepté ; le garde en mémoire tant qu'il n'a pas choisi. */
export function track(event: AnalyticsEvent, props?: Props): void {
  if (!browser() || !analyticsConfig().posthogKey) return;
  const c = consent();
  if (c === 'refuse') return;
  if (c === null) {
    if (queue.length < QUEUE_MAX) queue.push({ event, props, at: new Date() });
    return;
  }
  send(event, props, new Date());
}

/** Comme `track`, mais une seule fois par appareil (ex. première pierre). */
export function trackOnce(event: AnalyticsEvent, props?: Props): void {
  if (!browser()) return;
  const key = ONCE_PREFIX + event;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
  } catch { /* stockage indisponible : on envoie quand même */ }
  track(event, props);
}

/** Relie les événements au compte (identifiant Supabase, jamais l'e-mail). `null` à la déconnexion. */
export function identify(id: string | null): void {
  if (!browser() || id === userId) return;
  const previous = userId;
  userId = id;
  if (consent() !== 'accepte' || !loading) return;
  void loading.then(({ posthog, sentry }) => {
    if (id) posthog?.identify(id); else if (previous) posthog?.reset();
    sentry?.setUser(id ? { id } : null);
  });
}

/** Signale une erreur à Sentry si le joueur a accepté. */
export function captureError(error: unknown): void {
  if (!browser() || !analyticsConfig().sentryDsn || consent() !== 'accepte') return;
  void load().then(({ sentry }) => { sentry?.captureException(error); });
}

/** Secondes écoulées depuis l'ouverture de la page (mesure « première pierre dans la minute »). */
export function secondsSinceOpen(): number {
  return typeof performance === 'undefined' ? 0 : Math.round(performance.now() / 1000);
}

/** Réservé aux tests. */
export function _resetForTests(): void {
  loading = null; queue = []; userId = null; memoryConsent = null; listeners.clear();
}
export function _queueLength(): number { return queue.length; }
