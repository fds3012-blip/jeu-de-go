import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.fn();
// Environnement Node : un localStorage en mémoire suffit.
const memoire = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => { memoire.set(k, v); }, clear: () => memoire.clear() });
vi.mock('../data/analytics', async orig => ({ ...(await orig<typeof import('../data/analytics')>()), track: (...a: unknown[]) => track(...a) }));

const xp = await import('./xp');
const { GAINS, appliquer, cout, seuil, niveauDe, prochaineRecompense, recompenseDuNiveau, gagnerXp, lireXp, envoyerAgregat, abonnerXp, XP_KEY, PLAFOND } = xp;

describe('courbe des niveaux', () => {
  it('le niveau 2 arrive à 100 XP, puis environ +25 % par niveau', () => {
    expect(cout(1)).toBe(100);
    expect(cout(2)).toBe(125);
    expect(cout(3)).toBe(155);
    for (let n = 2; n < 11; n++) {
      expect(cout(n) / cout(n - 1)).toBeGreaterThan(1.2);
      expect(cout(n) / cout(n - 1)).toBeLessThan(1.3);
    }
    expect(seuil(1)).toBe(0);
    expect(seuil(2)).toBe(100);
    expect(seuil(3)).toBe(225);
    expect(seuil(5)).toBe(575);
  });

  it('le coût d’un niveau est plafonné : pas de progression sans fin', () => {
    expect(cout(40)).toBe(PLAFOND);
    expect(Math.max(...Array.from({ length: 100 }, (_, i) => cout(i + 1)))).toBe(PLAFOND);
  });

  it('niveauDe découpe l’XP en niveau et progression dans le niveau', () => {
    expect(niveauDe(0)).toEqual({ niveau: 1, dans: 0, besoin: 100 });
    expect(niveauDe(99)).toEqual({ niveau: 1, dans: 99, besoin: 100 });
    expect(niveauDe(100)).toEqual({ niveau: 2, dans: 0, besoin: 125 });
    expect(niveauDe(365)).toEqual({ niveau: 3, dans: 140, besoin: 155 });
    for (let n = 1; n < 30; n++) expect(niveauDe(seuil(n)).niveau).toBe(n);
  });

  it('une valeur invalide ou négative compte comme 0', () => {
    expect(niveauDe(-50).niveau).toBe(1);
    expect(appliquer(Number.NaN, 'probleme').avant).toBe(0);
  });
});

describe('gains', () => {
  it('barème : problème 10, Go du jour 20, leçon 30, partie 15, victoire 15 + 25', () => {
    expect(GAINS).toEqual({ probleme: 10, goDuJour: 20, lecon: 30, partie: 15, victoire: 40 });
  });

  it('un gain ne fait jamais baisser l’XP et signale le niveau franchi', () => {
    const g = appliquer(90, 'probleme');
    expect(g).toMatchObject({ points: 10, avant: 90, apres: 100, niveauAvant: 1, niveauApres: 2 });
    for (const s of Object.keys(GAINS) as (keyof typeof GAINS)[]) expect(appliquer(500, s).apres).toBeGreaterThan(500);
  });

  it('récompenses cosmétiques aux niveaux 3, 5 et 8', () => {
    expect(recompenseDuNiveau(3)?.nom).toBe('Kaya clair');
    expect(recompenseDuNiveau(5)?.nom).toBe('Ardoise');
    expect(recompenseDuNiveau(8)?.nom).toBe('Coquillage doré');
    expect(prochaineRecompense(1)?.niveau).toBe(3);
    expect(prochaineRecompense(8)).toBeUndefined();
  });
});

describe('gagnerXp (appareil)', () => {
  beforeEach(() => { localStorage.clear(); track.mockClear(); vi.useFakeTimers(); });
  afterEach(() => { envoyerAgregat(); vi.useRealTimers(); });

  it('crédite l’appareil, prévient les écouteurs et envoie niveau_atteint au passage', () => {
    localStorage.setItem(XP_KEY, '95');
    const vus: number[] = [];
    const fin = abonnerXp(g => vus.push(g.apres));
    gagnerXp('lecon');
    fin();
    expect(lireXp()).toBe(125);
    expect(vus).toEqual([125]);
    expect(track).toHaveBeenCalledWith('niveau_atteint', expect.objectContaining({ niveau: 2, xp_total: 125, source: 'lecon' }));
  });

  it('xp_gagne est agrégé : plusieurs gains rapprochés, un seul événement', () => {
    gagnerXp('probleme');
    gagnerXp('goDuJour');
    expect(track).not.toHaveBeenCalledWith('xp_gagne', expect.anything());
    vi.advanceTimersByTime(5000);
    const envois = track.mock.calls.filter(c => c[0] === 'xp_gagne');
    expect(envois).toHaveLength(1);
    expect(envois[0][1]).toMatchObject({ points: 30, gains: 2, sources: 'goDuJour,probleme', xp_total: 30, niveau: 1 });
  });
});
