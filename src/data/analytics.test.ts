import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// SDK simulés : on vérifie qu'ils ne sont ni chargés ni appelés sans consentement ou sans clé.
const posthog = vi.hoisted(() => ({
  init: vi.fn(), set_config: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn(),
}));
const sentry = vi.hoisted(() => ({ init: vi.fn(), captureException: vi.fn(), setUser: vi.fn(), close: vi.fn() }));
vi.mock('posthog-js', () => ({ default: posthog }));
vi.mock('@sentry/react', () => sentry);

import * as A from './analytics';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

const flush = () => new Promise(r => setTimeout(r, 0));
const allMocks = () => [...Object.values(posthog), ...Object.values(sentry)];

function asBrowser() {
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', {});
  vi.stubGlobal('localStorage', new MemoryStorage());
}
function withKeys() {
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
  vi.stubEnv('VITE_SENTRY_DSN', 'https://cle@o1.ingest.de.sentry.io/1');
}

beforeEach(() => {
  A._resetForTests();
  allMocks().forEach(m => m.mockClear());
  vi.stubEnv('VITE_POSTHOG_KEY', '');
  vi.stubEnv('VITE_SENTRY_DSN', '');
  vi.stubEnv('VITE_APP_VERSION', '');
  vi.stubEnv('VITE_VERCEL_GIT_COMMIT_SHA', '');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('choix mémorisé sans stockage (issue #50)', () => {
  it('localStorage bloqué : le choix vaut pour la session, la fenêtre ne revient pas', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {});
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqué'); }, setItem: () => { throw new Error('bloqué'); } });
    const vu = vi.fn();
    A.subscribeConsent(vu);
    expect(A.getConsent()).toBeNull();
    A.setConsent('refuse');
    expect(A.getConsent()).toBe('refuse');
    expect(vu).toHaveBeenCalledTimes(1);
  });
});


describe('hors navigateur', () => {
  it('track, initAnalytics, setConsent et captureError sont sans effet', async () => {
    withKeys();
    expect(typeof window).toBe('undefined');
    A.initAnalytics();
    A.setConsent('accepte');
    A.track(A.EVENTS.appOuverte);
    A.trackOnce(A.EVENTS.premierePierre);
    A.captureError(new Error('x'));
    await flush();
    expect(A.getConsent()).toBeNull();
    expect(A.niveau()).toBe('aucun');
    expect(A.analyticsAvailable()).toBe(false);
    allMocks().forEach(m => expect(m).not.toHaveBeenCalled());
  });
});

describe('sans clé', () => {
  it("n'envoie rien et ne charge rien, même avec consentement", async () => {
    asBrowser();
    expect(A.analyticsAvailable()).toBe(false);
    A.setConsent('accepte');
    A.initAnalytics();
    A.track(A.EVENTS.appOuverte);
    A.captureError(new Error('x'));
    await flush();
    allMocks().forEach(m => expect(m).not.toHaveBeenCalled());
  });
});

describe('mesure anonyme exemptée, sans consentement (issue #64)', () => {
  it('avant tout choix : PostHog en mémoire, sans profil, sans IP ; Sentry jamais chargé', async () => {
    asBrowser(); withKeys();
    expect(A.niveau()).toBe('anonyme');
    A.initAnalytics();
    A.track(A.EVENTS.appOuverte);
    A.captureError(new Error('x'));
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledTimes(1));
    const config = posthog.init.mock.calls[0][1];
    expect(config).toMatchObject({
      persistence: 'memory', person_profiles: 'never', ip: false, autocapture: false,
      disable_session_recording: true, advanced_disable_feature_flags: true,
    });
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(localStorage.getItem(A.CONSENT_KEY)).toBeNull();
  });

  it("n'écrit rien sur l'appareil, pas même le repère de trackOnce, et ne relie jamais le compte", async () => {
    asBrowser(); withKeys();
    A.identify('compte-1');
    A.trackOnce(A.EVENTS.premierePierre, { secondes: 12 });
    A.trackOnce(A.EVENTS.premierePierre, { secondes: 40 });
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalled());
    await flush();
    expect(posthog.capture.mock.calls.filter(c => c[0] === 'premiere_pierre')).toHaveLength(1);
    expect(localStorage.getItem('go.evenement.premiere_pierre')).toBeNull();
    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it('« Non merci » garde la mesure anonyme mais coupe Sentry', async () => {
    asBrowser(); withKeys();
    A.setConsent('refuse');
    A.track(A.EVENTS.partieTerminee, { taille: 9 });
    A.captureError(new Error('x'));
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledTimes(1));
    expect(A.niveau()).toBe('anonyme');
    expect(posthog.init.mock.calls[0][1]).toMatchObject({ persistence: 'memory' });
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it("opposition : plus rien n'est chargé ni envoyé", async () => {
    asBrowser(); withKeys();
    A.setOpposition(true);
    A.initAnalytics();
    A.track(A.EVENTS.appOuverte);
    A.trackOnce(A.EVENTS.premierePierre);
    A.captureError(new Error('x'));
    await flush();
    expect(A.niveau()).toBe('aucun');
    expect(localStorage.getItem(A.OPPOSITION_KEY)).toBe('1');
    allMocks().forEach(m => expect(m).not.toHaveBeenCalled());
  });

  it("s'opposer retire aussi l'accord ; accepter lève l'opposition", () => {
    asBrowser();
    A.setConsent('accepte');
    A.setOpposition(true);
    expect(A.getConsent()).toBe('refuse');
    expect(A.niveau()).toBe('aucun');
    A.setConsent('accepte');
    expect(A.getOpposition()).toBe(false);
    expect(A.niveau()).toBe('complet');
  });
});

describe('avec consentement', () => {
  it('passe PostHog en mode complet, charge Sentry, avec la version', async () => {
    asBrowser(); withKeys();
    vi.stubEnv('VITE_VERCEL_GIT_COMMIT_SHA', 'abc123');
    A.track(A.EVENTS.appOuverte);
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledTimes(1));
    A.setConsent('accepte');
    await vi.waitFor(() => expect(posthog.set_config).toHaveBeenCalledWith(expect.objectContaining({ persistence: 'localStorage', person_profiles: 'always' })));
    A.track(A.EVENTS.leconTerminee, { lecon: 'capture' });
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledTimes(2));
    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.init.mock.calls[0][0]).toBe('phc_test');
    await vi.waitFor(() => expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({ release: 'abc123', sendDefaultPii: false })));
    expect(posthog.capture.mock.calls.map(c => c[0])).toEqual(['app_ouverte', 'lecon_terminee']);
    expect(posthog.capture.mock.calls[1][1]).toMatchObject({ lecon: 'capture', version: 'abc123' });
  });

  it('déjà accepté au lancement : init directe en mode complet, compte relié', async () => {
    asBrowser(); withKeys();
    localStorage.setItem(A.CONSENT_KEY, 'accepte');
    A.identify('compte-1');
    A.initAnalytics();
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
    expect(posthog.init.mock.calls[0][1]).toMatchObject({ persistence: 'localStorage', person_profiles: 'always' });
    expect(posthog.identify).toHaveBeenCalledWith('compte-1');
  });

  it('retirer son accord oublie l’identifiant et revient au mode anonyme', async () => {
    asBrowser(); withKeys();
    A.setConsent('accepte');
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
    await vi.waitFor(() => expect(sentry.init).toHaveBeenCalled());
    A.setConsent('refuse');
    await vi.waitFor(() => expect(posthog.set_config).toHaveBeenCalledWith(expect.objectContaining({ persistence: 'memory' })));
    expect(posthog.reset).toHaveBeenCalled();
    await vi.waitFor(() => expect(sentry.close).toHaveBeenCalled());
  });

  it("trackOnce n'envoie qu'une fois par appareil", async () => {
    asBrowser(); withKeys();
    A.setConsent('accepte');
    A.trackOnce(A.EVENTS.premierePierre, { secondes: 12 });
    A.trackOnce(A.EVENTS.premierePierre, { secondes: 40 });
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalled());
    await flush();
    expect(posthog.capture.mock.calls.filter(c => c[0] === 'premiere_pierre')).toHaveLength(1);
    expect(localStorage.getItem('go.evenement.premiere_pierre')).toBe('1');
  });

  it('version de repli : dev', () => {
    expect(A.analyticsConfig().release).toBe('dev');
    vi.stubEnv('VITE_APP_VERSION', '1.2.0');
    expect(A.analyticsConfig().release).toBe('1.2.0');
  });
});

it('prépare la constante probleme_resolu', () => {
  expect(A.EVENTS.problemeResolu).toBe('probleme_resolu');
});
