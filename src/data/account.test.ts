import { describe, expect, it, vi } from 'vitest';
import type { Db } from './supabase';
import { confirmationValide, deleteMyAccount } from './account';

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
