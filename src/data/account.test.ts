import { describe, expect, it, vi } from 'vitest';
import type { Db } from './supabase';
import { codeComplet, confirmationValide, deleteMyAccount, envoyerCode, nettoyerCode, pseudoDisponible, verifierCode } from './account';

function clientSimule(rpcError: { message: string } | null) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: rpcError });
  const signOut = vi.fn().mockResolvedValue({ error: null });
  return { db: { rpc, auth: { signOut } } as unknown as Db, rpc, signOut };
}

describe('deleteMyAccount (#114)', () => {
  it('appelle la fonction serveur sans argument, puis ferme la session locale', async () => {
    const { db, rpc, signOut } = clientSimule(null);
    expect(await deleteMyAccount(db)).toEqual({ ok: true, value: null });
    expect(rpc).toHaveBeenCalledWith('delete_my_account');
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(signOut.mock.invocationCallOrder[0]);
  });

  it('en cas d’erreur serveur, garde la session et renvoie un message clair', async () => {
    const { db, signOut } = clientSimule({ message: 'permission denied' });
    const r = await deleteMyAccount(db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/intact/);
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe('confirmationValide', () => {
  it('n’accepte que le mot SUPPRIMER', () => {
    expect(confirmationValide('SUPPRIMER')).toBe(true);
    expect(confirmationValide(' supprimer ')).toBe(true);
    expect(confirmationValide('SUPPRIME')).toBe(false);
    expect(confirmationValide('')).toBe(false);
    expect(confirmationValide('oui')).toBe(false);
  });
});

describe('connexion par code (#343)', () => {
  it('garde les chiffres collés ou tapés, au plus 6', () => {
    expect(nettoyerCode('123 456')).toBe('123456');
    expect(nettoyerCode('Code : 987-654-321')).toBe('987654');
    expect(codeComplet('123456')).toBe(true);
    expect(codeComplet('12345')).toBe(false);
    expect(codeComplet('12a456')).toBe(false);
  });

  function auth(error: { status?: number } | null = null) {
    const verifyOtp = vi.fn().mockResolvedValue({ data: {}, error });
    const signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    const refreshSession = vi.fn().mockResolvedValue({ data: {}, error: null });
    return { db: { auth: { verifyOtp, signInWithOtp, refreshSession } } as unknown as Db, verifyOtp, signInWithOtp, refreshSession };
  }

  it('vérifie le code de type `email` (connexion) ou `email_change` (ancienne session anonyme)', async () => {
    const c = auth();
    expect(await verifierCode(c.db, ' ami@exemple.test ', '123 456')).toEqual({ ok: true, value: null });
    expect(c.verifyOtp).toHaveBeenCalledWith({ email: 'ami@exemple.test', token: '123456', type: 'email' });
    expect(c.refreshSession).not.toHaveBeenCalled();
    await verifierCode(c.db, 'ami@exemple.test', '654321', 'email_change');
    expect(c.verifyOtp).toHaveBeenLastCalledWith({ email: 'ami@exemple.test', token: '654321', type: 'email_change' });
    // Jeton renouvelé : il ne dit plus « anonyme ».
    expect(c.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('code incomplet : pas d’appel ; code faux ou expiré : message clair', async () => {
    const c = auth();
    expect((await verifierCode(c.db, 'a@b.fr', '123')).ok).toBe(false);
    expect(c.verifyOtp).not.toHaveBeenCalled();
    const faux = await verifierCode(auth({ status: 403 }).db, 'a@b.fr', '123456');
    expect(faux).toEqual({ ok: false, error: 'Ce code ne marche pas. Vérifie-le, ou demande un nouveau code.' });
    const trop = await verifierCode(auth({ status: 429 }).db, 'a@b.fr', '123456');
    expect(trop.ok).toBe(false);
  });

  it('l’e-mail garde le lien comme second moyen (redirection) et crée le compte au besoin', async () => {
    const c = auth();
    vi.stubGlobal('window', { location: { origin: 'https://go.exemple' } });
    await envoyerCode(c.db, ' ami@exemple.test ');
    vi.unstubAllGlobals();
    expect(c.signInWithOtp).toHaveBeenCalledWith({ email: 'ami@exemple.test', options: { emailRedirectTo: 'https://go.exemple', shouldCreateUser: true } });
  });
});

describe('pseudoDisponible (#343)', () => {
  function profils(lignes: unknown[], error: unknown = null) {
    const appels: unknown[][] = [];
    const chaine = {
      select: (...a: unknown[]) => { appels.push(['select', ...a]); return chaine; },
      ilike: (...a: unknown[]) => { appels.push(['ilike', ...a]); return chaine; },
      neq: (...a: unknown[]) => { appels.push(['neq', ...a]); return chaine; },
      limit: async (...a: unknown[]) => { appels.push(['limit', ...a]); return { data: lignes, error }; },
    };
    return { db: { from: () => chaine } as unknown as Db, appels };
  }

  it('libre si aucun autre profil ne l’a, sans tenir compte des majuscules ; `_` n’est pas un joker', async () => {
    const c = profils([]);
    expect(await pseudoDisponible(c.db, 'Flo_rian', 'moi')).toEqual({ ok: true, value: true });
    expect(c.appels).toContainEqual(['ilike', 'username', 'Flo\\_rian']);
    expect(c.appels).toContainEqual(['neq', 'id', 'moi']);
  });

  it('pris si un profil l’a déjà', async () => {
    expect(await pseudoDisponible(profils([{ id: 'x' }]).db, 'Florian')).toEqual({ ok: true, value: false });
  });

  it('format invalide : pas d’appel', async () => {
    const c = profils([]);
    expect((await pseudoDisponible(c.db, 'é')).ok).toBe(false);
    expect(c.appels).toEqual([]);
  });
});
