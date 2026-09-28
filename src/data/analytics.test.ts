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
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
}

const flush = () => new Promise(r => setTimeout(r, 0));
const allMocks = () => [...Object.values(posthog), ...Object.values(sentry)];

function asBrowser() {
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', {});
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('sessionStorage', new MemoryStorage());
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

describe('sans localisation déduite de l’IP (#223, E2)', () => {
  it('les deux niveaux ajoutent $geoip_disable à chaque événement via before_send', async () => {
    asBrowser(); withKeys();
    A.track(A.EVENTS.appOuverte);
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
    expect(posthog.init.mock.calls[0][1].before_send).toBe(A.sansLocalisation);
    expect(A.POSTHOG_COMPLET.before_send).toBe(A.sansLocalisation);
    A.setConsent('accepte');
    await vi.waitFor(() => expect(posthog.set_config).toHaveBeenCalledWith(expect.objectContaining({ before_send: A.sansLocalisation })));
  });

  it('sansLocalisation garde les propriétés et laisse passer un événement déjà rejeté', () => {
    expect(A.sansLocalisation({ event: 'x', properties: { a: 1 } })).toEqual({ event: 'x', properties: { a: 1, $geoip_disable: true } });
    expect(A.sansLocalisation({ event: '$identify' })).toEqual({ event: '$identify', properties: { $geoip_disable: true } });
    expect(A.sansLocalisation(null)).toBeNull();
  });
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

  it("retirer son accord efface l'identifiant PostHog et les repères go.evenement.*, pas la progression (#223, E5)", async () => {
    asBrowser(); withKeys();
    A.setConsent('accepte');
    A.trackOnce(A.EVENTS.premierePierre);
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalled());
    // Ce que posthog-js écrit en mode complet, plus des données du joueur qui doivent rester.
    localStorage.setItem('ph_phc_test_posthog', '{"distinct_id":"abc"}');
    localStorage.setItem('__ph_opt_in_out_phc_test', '1');
    sessionStorage.setItem('ph_phc_test_window_id', 'w1');
    localStorage.setItem('go.progression.v1', '{"xp":120}');
    localStorage.setItem('go.serie.v1', '{"jours":4}');
    expect(localStorage.getItem('go.evenement.premiere_pierre')).toBe('1');

    A.setConsent('refuse');
    expect(localStorage.getItem('ph_phc_test_posthog')).toBeNull();
    expect(localStorage.getItem('__ph_opt_in_out_phc_test')).toBeNull();
    expect(sessionStorage.getItem('ph_phc_test_window_id')).toBeNull();
    expect(localStorage.getItem('go.evenement.premiere_pierre')).toBeNull();
    // reset() peut réécrire un identifiant : effacé à nouveau après le passage en mémoire.
    localStorage.setItem('ph_phc_test_posthog', '{"distinct_id":"nouveau"}');
    await vi.waitFor(() => expect(posthog.reset).toHaveBeenCalled());
    await flush();
    expect(localStorage.getItem('ph_phc_test_posthog')).toBeNull();
    // Rien d'autre n'est touché.
    expect(localStorage.getItem('go.progression.v1')).toBe('{"xp":120}');
    expect(localStorage.getItem('go.serie.v1')).toBe('{"jours":4}');
    expect(localStorage.getItem(A.CONSENT_KEY)).toBe('refuse');
  });

  it("s'opposer après avoir accepté efface aussi les traces (#223, E5)", () => {
    asBrowser();
    A.setConsent('accepte');
    localStorage.setItem('ph_x_posthog', 'id');
    localStorage.setItem('go.evenement.inscription', '1');
    A.setOpposition(true);
    expect(localStorage.getItem('ph_x_posthog')).toBeNull();
    expect(localStorage.getItem('go.evenement.inscription')).toBeNull();
    expect(localStorage.getItem(A.OPPOSITION_KEY)).toBe('1');
  });

  it("sans retrait d'accord, rien n'est effacé", () => {
    asBrowser();
    localStorage.setItem('go.evenement.inscription', '1');
    A.setConsent('refuse');
    A.setConsent('accepte');
    expect(localStorage.getItem('go.evenement.inscription')).toBe('1');
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

describe('plan de marquage (issue #166)', () => {
  it('chaque événement porte le niveau de mesure : « anonyme » sans accord, « complet » avec', async () => {
    asBrowser(); withKeys();
    A.track(A.EVENTS.comptageManuel, { mode: 'ordi', mortes: 2, incertains: 1 });
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledTimes(1));
    expect(posthog.capture.mock.calls[0][0]).toBe('comptage_manuel');
    expect(posthog.capture.mock.calls[0][1]).toMatchObject({ mode: 'ordi', mortes: 2, incertains: 1, mesure: 'anonyme' });
    A.setConsent('accepte');
    A.track(A.EVENTS.partieCommencee, { mode: 'deux', taille: 9 });
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledTimes(2));
    expect(posthog.capture.mock.calls[1][0]).toBe('partie_commencee');
    expect(posthog.capture.mock.calls[1][1]).toMatchObject({ mode: 'deux', taille: 9, mesure: 'complet' });
  });

  it('après opposition, les nouveaux événements ne partent pas', async () => {
    asBrowser(); withKeys();
    A.setOpposition(true);
    A.track(A.EVENTS.comptageManuel);
    A.track(A.EVENTS.partieCommencee);
    await flush();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('noms stables : minuscules et tirets bas, sans doublon', () => {
    const noms = Object.values(A.EVENTS);
    expect(new Set(noms).size).toBe(noms.length);
    for (const n of noms) expect(n).toMatch(/^[a-z]+(_[a-z0-9]+)*$/);
  });

  it('aucun événement sans ligne dans docs/data/plan-de-marquage.md', async () => {
    const { readFileSync } = await import('node:fs');
    const plan = readFileSync(new URL('../../docs/data/plan-de-marquage.md', import.meta.url), 'utf8');
    expect(Object.values(A.EVENTS).filter(n => !plan.includes('`' + n + '`'))).toEqual([]);
  });
});
