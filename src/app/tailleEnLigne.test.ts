import { afterEach, describe, expect, it, vi } from 'vitest';
import { ecrireTailleEnLigne, lireTailleEnLigne, TAILLE_EN_LIGNE_KEY } from './tailleEnLigne';

function stockage(depart: Record<string, string> = {}) {
  const m = new Map(Object.entries(depart));
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } });
  return m;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('taille d’une partie en ligne (#613)', () => {
  it('jamais choisie : rien (la file par défaut décide)', () => {
    stockage();
    expect(lireTailleEnLigne()).toBeNull();
  });

  it('le dernier choix revient', () => {
    const m = stockage();
    ecrireTailleEnLigne(13);
    expect(m.get(TAILLE_EN_LIGNE_KEY)).toBe('13');
    expect(lireTailleEnLigne()).toBe(13);
  });

  it('une valeur inconnue ou un stockage bloqué ne cassent rien', () => {
    stockage({ [TAILLE_EN_LIGNE_KEY]: '15' });
    expect(lireTailleEnLigne()).toBeNull();
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqué'); }, setItem: () => { throw new Error('bloqué'); } });
    expect(lireTailleEnLigne()).toBeNull();
    expect(() => ecrireTailleEnLigne(19)).not.toThrow();
  });
});
