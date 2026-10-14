// #544 : événement PostHog `badge_gagne`, une fois par badge et par appareil, avec l'identifiant du badge seulement.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.fn();
// Environnement Node : un localStorage en mémoire suffit.
const memoire = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => { memoire.set(k, v); }, clear: () => memoire.clear() });
vi.mock('../data/analytics', async orig => ({ ...(await orig<typeof import('../data/analytics')>()), track: (...a: unknown[]) => track(...a) }));

const { EVENTS } = await import('../data/analytics');
const { BADGES_KEY, gagnerBadge, noterBadges } = await import('./badgesGagnes');

const gardes = () => JSON.parse(localStorage.getItem(BADGES_KEY) ?? '[]');
const envois = () => track.mock.calls.filter(c => c[0] === 'badge_gagne');

describe('badge_gagne (#544)', () => {
  beforeEach(() => { localStorage.clear(); track.mockClear(); });

  it('existe dans le plan de marquage du code', () => {
    expect(EVENTS.badgeGagne).toBe('badge_gagne');
  });

  it('badge du moment : un envoi avec le seul identifiant, jamais deux', () => {
    expect(gagnerBadge('premiere-en-ligne')).toBe(true);
    expect(gagnerBadge('premiere-en-ligne')).toBe(false);
    expect(envois()).toEqual([['badge_gagne', { badge: 'premiere-en-ligne' }]]);
    expect(gardes()).toEqual(['premiere-en-ligne']);
  });

  it('badges constatés au Profil : un envoi par nouveau badge, rien pour ceux déjà gardés ni au second passage', () => {
    localStorage.setItem(BADGES_KEY, JSON.stringify(['premiere-partie']));
    expect(noterBadges(['premiere-partie', 'serie-7', 'goban-13', 'serie-7'])).toEqual(['serie-7', 'goban-13']);
    // Effet rejoué (mode strict de React) ou Profil rouvert : plus rien n'est envoyé.
    expect(noterBadges(['serie-7', 'goban-13'])).toEqual([]);
    expect(envois()).toEqual([['badge_gagne', { badge: 'serie-7' }], ['badge_gagne', { badge: 'goban-13' }]]);
    expect(gardes()).toEqual(['premiere-partie', 'serie-7', 'goban-13']);
  });

  it('liste abîmée sur l’appareil : tolérée, réécrite proprement', () => {
    localStorage.setItem(BADGES_KEY, JSON.stringify(['serie-7', 3, null]));
    expect(noterBadges(['serie-7', 'premiere-revue'])).toEqual(['premiere-revue']);
    expect(gardes()).toEqual(['serie-7', 'premiere-revue']);
  });
});
