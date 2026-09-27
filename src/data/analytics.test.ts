import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// SDK simulés : on vérifie qu'ils ne sont ni chargés ni appelés sans consentement ou sans clé.
const posthog = vi.hoisted(() => ({
  init: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn(), opt_in_capturing: vi.fn(), opt_out_capturing: vi.fn(),
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
    expect(A.analyticsAvailable()).toBe(false);
    expect(A._queueLength()).toBe(0);
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
    expect(A._queueLength()).toBe(0);
    allMocks().forEach(m => expect(m).not.toHaveBeenCalled());
  });
});

describe('sans consentement', () => {
  it("n'envoie rien avant le choix : les événements attendent en mémoire", async () => {
    asBrowser(); withKeys();
    expect(A.analyticsAvailable()).toBe(true);
    A.initAnalytics();
    A.track(A.EVENTS.appOuverte);
    A.captureError(new Error('x'));
    await flush();
    expect(A._queueLength()).toBe(1);
    allMocks().forEach(m => expect(m).not.toHaveBeenCalled());
    expect(localStorage.getItem(A.CONSENT_KEY)).toBeNull();
  });

  it("n'envoie rien après un refus, et efface la file d'attente", async () => {
    asBrowser(); withKeys();
    A.track(A.EVENTS.appOuverte);
    A.setConsent('refuse');
    A.track(A.EVENTS.partieTerminee, { taille: 9 });
    A.initAnalytics();
    A.captureError(new Error('x'));
    await flush();
    expect(A.getConsent()).toBe('refuse');
    expect(A._queueLength()).toBe(0);
    allMocks().forEach(m => expect(m).not.toHaveBeenCalled());
  });
});

describe('avec consentement', () => {
  it('envoie les événements en attente puis les suivants, avec la version', async () => {
    asBrowser(); withKeys();
    vi.stubEnv('VITE_VERCEL_GIT_COMMIT_SHA', 'abc123');
    A.track(A.EVENTS.appOuverte);
    A.setConsent('accepte');
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledTimes(1));
    A.track(A.EVENTS.leconTerminee, { lecon: 'capture' });
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledTimes(2));
    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.init.mock.calls[0][0]).toBe('phc_test');
    expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({ release: 'abc123', sendDefaultPii: false }));
    expect(posthog.capture.mock.calls.map(c => c[0])).toEqual(['app_ouverte', 'lecon_terminee']);
    expect(posthog.capture.mock.calls[1][1]).toMatchObject({ lecon: 'capture', version: 'abc123' });
    expect(A._queueLength()).toBe(0);
  });

  it("trackOnce n'envoie qu'une fois par appareil", async () => {
    asBrowser(); withKeys();
    A.setConsent('accepte');
    A.trackOnce(A.EVENTS.premierePierre, { secondes: 12 });
    A.trackOnce(A.EVENTS.premierePierre, { secondes: 40 });
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalled());
    await flush();
    expect(posthog.capture.mock.calls.filter(c => c[0] === 'premiere_pierre')).toHaveLength(1);
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
