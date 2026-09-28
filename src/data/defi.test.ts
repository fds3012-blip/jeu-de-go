import { describe, expect, it, vi } from 'vitest';
import type { Db } from './supabase';
import {
  assurerSession, creerDefi, garderMonCompte, jetonDepuisLien, jouerCoupDefi, lienDefi, lireDefi, ouvrirDefi, tempsRestant
} from './defi';

const JETON = 'Ab3_-x'.padEnd(32, 'Z');
const PARTIE = '11111111-1111-4111-8111-111111111111';

interface Options {
  session?: { user: { id: string; is_anonymous?: boolean } } | null;
  anonyme?: { data: { user: { id: string } | null }; error: unknown };
  rpc?: Record<string, { data: unknown; error: unknown }>;
  lignes?: Record<string, { data: unknown; error: unknown }>;
}

/** Client Supabase simulé : auth, rpc, from().select().eq().maybeSingle(), functions.invoke. */
function client(o: Options = {}) {
  const getSession = vi.fn().mockResolvedValue({ data: { session: o.session ?? null } });
  const signInAnonymously = vi.fn().mockResolvedValue(o.anonyme ?? { data: { user: { id: 'anon-1' } }, error: null });
  const updateUser = vi.fn().mockResolvedValue({ data: {}, error: null });
  const rpc = vi.fn(async (nom: string) => o.rpc?.[nom] ?? { data: null, error: null });
  const from = vi.fn((table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => o.lignes?.[table] ?? { data: null, error: null } }) })
  }));
  const invoke = vi.fn().mockResolvedValue({ data: { ok: true, game: { moves: 'ee' } }, error: null });
  const db = { auth: { getSession, signInAnonymously, updateUser }, rpc, from, functions: { invoke } } as unknown as Db;
  return { db, getSession, signInAnonymously, updateUser, rpc, from, invoke };
}

describe('lien du défi', () => {
  it('met le jeton dans le fragment, et le relit', () => {
    const lien = lienDefi(JETON, 'https://go.exemple/');
    expect(lien).toBe(`https://go.exemple/defi#${JETON}`);
    expect(jetonDepuisLien(lien)).toBe(JETON);
    expect(jetonDepuisLien(JETON)).toBe(JETON);
  });

  it('refuse un jeton mal formé', () => {
    expect(jetonDepuisLien('https://go.exemple/defi#court')).toBeNull();
    expect(jetonDepuisLien(`https://go.exemple/defi#${JETON}<script>`)).toBeNull();
    expect(jetonDepuisLien('')).toBeNull();
  });
});

describe('assurerSession', () => {
  it('garde la session existante', async () => {
    const c = client({ session: { user: { id: 'u1', is_anonymous: false } } });
    expect(await assurerSession(c.db)).toEqual({ ok: true, value: { userId: 'u1', anonyme: false } });
    expect(c.signInAnonymously).not.toHaveBeenCalled();
  });

  it('ouvre une session anonyme sinon', async () => {
    const c = client();
    expect(await assurerSession(c.db)).toEqual({ ok: true, value: { userId: 'anon-1', anonyme: true } });
  });

  it('échoue proprement si la session anonyme est refusée', async () => {
    const c = client({ anonyme: { data: { user: null }, error: { message: 'Anonymous sign-ins are disabled' } } });
    expect((await assurerSession(c.db)).ok).toBe(false);
  });
});

describe('creerDefi', () => {
  it('appelle creer_defi et renvoie partie et jeton', async () => {
    const c = client({ rpc: { creer_defi: { data: [{ partie_id: PARTIE, jeton: JETON }], error: null } } });
    expect(await creerDefi(c.db)).toEqual({ ok: true, value: { partieId: PARTIE, jeton: JETON } });
    expect(c.rpc).toHaveBeenCalledWith('creer_defi');
    expect(c.signInAnonymously.mock.invocationCallOrder[0]).toBeLessThan(c.rpc.mock.invocationCallOrder[0]);
  });

  it('remonte le refus du serveur', async () => {
    const c = client({ rpc: { creer_defi: { data: null, error: { message: 'Tu as déjà 20 défis en attente' } } } });
    expect(await creerDefi(c.db)).toEqual({ ok: false, error: 'Tu as déjà 20 défis en attente' });
  });
});

describe('ouvrirDefi', () => {
  it('rejoint avec le jeton, après une session anonyme', async () => {
    const c = client({ rpc: { rejoindre_defi: { data: PARTIE, error: null } } });
    expect(await ouvrirDefi(c.db, JETON)).toEqual({ ok: true, value: PARTIE });
    expect(c.rpc).toHaveBeenCalledWith('rejoindre_defi', { p_jeton: JETON });
  });

  it('ne contacte pas le serveur pour un jeton invalide', async () => {
    const c = client();
    expect((await ouvrirDefi(c.db, 'abc')).ok).toBe(false);
    expect(c.rpc).not.toHaveBeenCalled();
    expect(c.signInAnonymously).not.toHaveBeenCalled();
  });

  it('remonte « déjà un adversaire »', async () => {
    const c = client({ rpc: { rejoindre_defi: { data: null, error: { message: 'Ce défi a déjà un adversaire' } } } });
    expect(await ouvrirDefi(c.db, JETON)).toEqual({ ok: false, error: 'Ce défi a déjà un adversaire' });
  });
});

describe('jouerCoupDefi', () => {
  it('passe par la fonction serveur game-action', async () => {
    const c = client();
    expect((await jouerCoupDefi(c.db, PARTIE, 'ee')).ok).toBe(true);
    expect(c.invoke).toHaveBeenCalledWith('game-action', { body: { action: 'move', gameId: PARTIE, move: 'ee' } });
  });
});

describe('lireDefi', () => {
  const partie = { id: PARTIE, moves: 'ee', status: 'finished', result: 'W+T' };
  const defi = { partie_id: PARTIE, date_limite: '2026-10-01T10:00:00Z' };

  it('constate le temps avant de lire la partie et le défi', async () => {
    const c = client({
      rpc: { victoire_au_temps: { data: 'W+T', error: null } },
      lignes: { games: { data: partie, error: null }, defis: { data: defi, error: null } }
    });
    expect(await lireDefi(c.db, PARTIE)).toEqual({ ok: true, value: { partie, defi, resultat: 'W+T' } });
    expect(c.rpc).toHaveBeenCalledWith('victoire_au_temps', { p_partie: PARTIE });
    expect(c.rpc.mock.invocationCallOrder[0]).toBeLessThan(c.from.mock.invocationCallOrder[0]);
  });

  it('refuse un tiers (le serveur ne trouve pas le défi)', async () => {
    const c = client({ rpc: { victoire_au_temps: { data: null, error: { message: 'Défi introuvable' } } } });
    expect(await lireDefi(c.db, PARTIE)).toEqual({ ok: false, error: 'Défi introuvable' });
    expect(c.from).not.toHaveBeenCalled();
  });
});

describe('tempsRestant', () => {
  it('compte à rebours jusqu’à la date limite', () => {
    const t0 = Date.parse('2026-10-01T10:00:00Z');
    expect(tempsRestant('2026-10-01T11:00:00Z', t0)).toBe(3_600_000);
    expect(tempsRestant('2026-10-01T09:00:00Z', t0)).toBe(0);
    expect(tempsRestant(null, t0)).toBeNull();
  });
});

describe('garderMonCompte', () => {
  it('relie l’e-mail à la session anonyme', async () => {
    const c = client();
    expect(await garderMonCompte(c.db, ' ami@exemple.test ', 'https://go.exemple')).toEqual({ ok: true, value: null });
    expect(c.updateUser).toHaveBeenCalledWith({ email: 'ami@exemple.test' }, { emailRedirectTo: 'https://go.exemple' });
  });
});
