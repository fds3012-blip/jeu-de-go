// #519 : étapes de l'entonnoir branchées sur le plateau (première pierre où qu'elle soit, premier toucher) et sur le
// premier geste réel de la page. Compteurs et PostHog simulés : on vérifie ce qui est appelé, et avec quelles propriétés.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const compterEtape = vi.fn();
const trackOnce = vi.fn();
vi.mock('../data/compteurs', () => ({ compterEtape: (...a: unknown[]) => compterEtape(...a) }));
vi.mock('../data/analytics', () => ({
  EVENTS: { premierePierre: 'premiere_pierre', premierGeste: 'premier_geste', premierToucherPlateau: 'premier_toucher_plateau' },
  secondsSinceOpen: () => 7,
  trackOnce: (...a: unknown[]) => trackOnce(...a),
}));

const { pierrePosee, toucherPlateau, oublierRepere, PREMIERE_PIERRE_KEY } = await import('./premierePierre');
const { ecouterPremierGeste } = await import('./premierGeste');

beforeEach(() => {
  compterEtape.mockClear(); trackOnce.mockClear();
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } });
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
});
afterEach(() => { oublierRepere(); vi.unstubAllGlobals(); });

describe('première pierre, quel que soit le lieu', () => {
  for (const lieu of ['lecon', 'probleme', 'placement', 'en_ligne', 'autre'] as const) {
    it(`${lieu} : compteur premiere_pierre et événement PostHog avec lieu`, () => {
      pierrePosee(lieu);
      expect(compterEtape).toHaveBeenCalledWith('premiere_pierre');
      expect(trackOnce).toHaveBeenCalledWith('premiere_pierre', { secondes: 7, lieu });
      expect(localStorage.getItem(PREMIERE_PIERRE_KEY)).toBe('true');
    });
  }

  it('partie : le compteur part, l’événement PostHog reste celui de la partie (plus riche)', () => {
    pierrePosee('partie');
    expect(compterEtape).toHaveBeenCalledWith('premiere_pierre');
    expect(trackOnce).not.toHaveBeenCalled();
  });

  it('aucune donnée du coup ni du joueur : le lieu et les secondes, rien d’autre', () => {
    pierrePosee('lecon');
    toucherPlateau('lecon');
    for (const [, props] of trackOnce.mock.calls) expect(Object.keys(props as object).sort()).toEqual(['lieu', 'secondes']);
    for (const args of compterEtape.mock.calls) expect(args).toHaveLength(1);
  });
});

describe('premier toucher du plateau', () => {
  it('compteur et événement, avec le lieu', () => {
    toucherPlateau('partie');
    expect(compterEtape).toHaveBeenCalledWith('premier_toucher_plateau');
    expect(trackOnce).toHaveBeenCalledWith('premier_toucher_plateau', { secondes: 7, lieu: 'partie' });
  });
});

describe('premier geste réel', () => {
  function cible() {
    const ecouteurs = new Map<string, (e: Event) => void>();
    return {
      addEventListener: vi.fn((t: string, f: (e: Event) => void) => { ecouteurs.set(t, f); }),
      removeEventListener: vi.fn((t: string) => { ecouteurs.delete(t); }),
      emettre: (t: string, isTrusted: boolean) => ecouteurs.get(t)?.({ type: t, isTrusted } as Event),
      ecouteurs,
    };
  }

  it('écoute pointerdown et keydown, compte au premier geste réel puis cesse d’écouter', () => {
    const c = cible();
    ecouterPremierGeste(true, c);
    expect([...c.ecouteurs.keys()].sort()).toEqual(['keydown', 'pointerdown']);
    c.emettre('pointerdown', true);
    expect(compterEtape).toHaveBeenCalledWith('premier_geste');
    expect(trackOnce).toHaveBeenCalledWith('premier_geste', { secondes: 7, nouveau: true });
    expect(c.ecouteurs.size).toBe(0);
  });

  it('un événement fabriqué par un script (isTrusted faux) ne compte pas', () => {
    const c = cible();
    ecouterPremierGeste(false, c);
    c.emettre('keydown', false);
    expect(compterEtape).not.toHaveBeenCalled();
    c.emettre('keydown', true);
    expect(trackOnce).toHaveBeenCalledWith('premier_geste', { secondes: 7, nouveau: false });
  });

  it('démontage : l’écoute est retirée ; hors navigateur : sans effet', () => {
    const c = cible();
    ecouterPremierGeste(true, c)();
    expect(c.ecouteurs.size).toBe(0);
    expect(() => ecouterPremierGeste(true, null)()).not.toThrow();
  });
});
