import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from './supabase';
import { compteurGarde, FRAICHEUR_COMPTEUR_MS, joueursEnLigne, lireJoueursEnLigne, nombreDeJoueurs, oublierCompteur } from './joueursEnLigne';

const fauxDb = (rpc: () => Promise<{ data: unknown; error: unknown }>) => ({ rpc: vi.fn(rpc) }) as unknown as Db & { rpc: ReturnType<typeof vi.fn> };

describe('joueurs en ligne (#695)', () => {
  beforeEach(() => { oublierCompteur(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it('un entier positif ou nul est un compteur ; tout le reste est inconnu', () => {
    expect(nombreDeJoueurs(0)).toBe(0);
    expect(nombreDeJoueurs(7)).toBe(7);
    for (const x of [null, undefined, '4', -1, 2.5, NaN, Infinity, {}, [4]]) expect(nombreDeJoueurs(x)).toBeNull();
  });

  it('lit la fonction serveur, sans aucun paramètre', async () => {
    const db = fauxDb(async () => ({ data: 5, error: null }));
    expect(await lireJoueursEnLigne(db)).toBe(5);
    expect(db.rpc).toHaveBeenCalledWith('joueurs_en_ligne');
  });

  it('erreur du serveur, fonction pas encore déployée ou réponse absurde : inconnu', async () => {
    expect(await lireJoueursEnLigne(fauxDb(async () => ({ data: null, error: { code: 'PGRST202' } })))).toBeNull();
    expect(await lireJoueursEnLigne(fauxDb(async () => ({ data: 'beaucoup', error: null })))).toBeNull();
    expect(await lireJoueursEnLigne(fauxDb(async () => { throw new Error('réseau'); }))).toBeNull();
  });

  it('sans réponse dans le délai : inconnu, sans attendre davantage', async () => {
    const db = fauxDb(() => new Promise(() => undefined));
    const p = lireJoueursEnLigne(db, 4000);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await p).toBeNull();
  });

  it('la lecture réussie est gardée une minute ; un échec n’est jamais gardé', async () => {
    const db = fauxDb(async () => ({ data: 6, error: null }));
    expect(await joueursEnLigne(db, 1000)).toBe(6);
    expect(await joueursEnLigne(db, 1000 + FRAICHEUR_COMPTEUR_MS - 1)).toBe(6);
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(compteurGarde(1000 + FRAICHEUR_COMPTEUR_MS)).toBeNull();
    expect(await joueursEnLigne(db, 1000 + FRAICHEUR_COMPTEUR_MS)).toBe(6);
    expect(db.rpc).toHaveBeenCalledTimes(2);
    oublierCompteur();
    const ko = fauxDb(async () => ({ data: null, error: { code: '500' } }));
    expect(await joueursEnLigne(ko, 5)).toBeNull();
    expect(compteurGarde(6)).toBeNull();
  });
});
