import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// #325 : au niveau anonyme, PostHog n'est chargé qu'après le premier écran (src/premierEcran.ts).
const posthog = vi.hoisted(() => ({
  init: vi.fn(), set_config: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn(),
}));
vi.mock('posthog-js', () => ({ default: posthog }));
vi.mock('@sentry/react', () => ({ init: vi.fn(), captureException: vi.fn(), setUser: vi.fn(), close: vi.fn() }));

import * as A from './analytics';
import { _reinitialiserPremierEcran } from '../premierEcran';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
}

let charge: (() => void) | null = null;
/** Navigateur simulé dont la page n'a pas fini de charger : `charger()` déclenche `load`. */
function pageEnChargement() {
  charge = null;
  vi.stubGlobal('window', { addEventListener: (type: string, f: () => void) => { if (type === 'load') charge = f; } });
  vi.stubGlobal('document', { readyState: 'loading', fonts: { ready: Promise.resolve() } });
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
}
const charger = () => charge?.();
const attendre = (ms: number) => new Promise(r => setTimeout(r, ms));

beforeEach(() => {
  A._resetForTests();
  _reinitialiserPremierEcran();
  Object.values(posthog).forEach(m => m.mockClear());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('PostHog après le premier écran (#325)', () => {
  it("niveau anonyme : rien n'est chargé avant l'accueil, puis l'événement part avec son heure d'origine", async () => {
    pageEnChargement();
    const avant = Date.now();
    A.track(A.EVENTS.appOuverte);
    await attendre(300);
    expect(posthog.init).not.toHaveBeenCalled();
    charger();
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalled());
    const [nom, , options] = posthog.capture.mock.calls[0];
    expect(nom).toBe('app_ouverte');
    expect((options as { timestamp: Date }).timestamp.getTime()).toBeLessThanOrEqual(avant + 50);
  });

  it("opposition pendant l'attente : PostHog n'est jamais chargé", async () => {
    pageEnChargement();
    A.track(A.EVENTS.appOuverte);
    A.setOpposition(true);
    charger();
    await attendre(400);
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('avec accord (niveau complet) : chargement immédiat, comme avant', async () => {
    pageEnChargement();
    A.setConsent('accepte');
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
    // `load` n'a jamais été déclenché : le chargement n'a pas attendu l'accueil.
  });
});
