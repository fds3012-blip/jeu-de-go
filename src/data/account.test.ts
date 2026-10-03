import { describe, expect, it, vi } from 'vitest';
import type { Db } from './supabase';
import { codeComplet, confirmationValide, connexionSociale, deleteMyAccount, envoyerCode, lierSociale, moyensDuCompte, nettoyerCode, pseudoDisponible, retirerMoyen, verifierCode } from './account';

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

describe('connexion sociale (#411)', () => {
  const ident = (provider: string, email?: string) => ({ id: provider, identity_id: `id-${provider}`, user_id: 'u', provider, identity_data: { email } });

  it('signInWithOAuth avec le fournisseur et l’adresse de retour ; erreur : phrase avec le nom', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { status: 500 } });
    const db = { auth: { signInWithOAuth } } as unknown as Db;
    expect(await connexionSociale(db, 'facebook', 'https://jeu/')).toEqual({ ok: true, value: null });
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'facebook', options: { redirectTo: 'https://jeu/' } });
    expect(await connexionSociale(db, 'apple', 'https://jeu/')).toEqual({ ok: false, error: 'Apple n’a pas répondu. Reçois plutôt un code par e-mail.' });
  });

  it('linkIdentity ; liaison manuelle fermée dans Supabase : raison `fermee` (repli prévu)', async () => {
    const linkIdentity = vi.fn().mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { code: 'manual_linking_disabled', status: 404 } })
      .mockResolvedValueOnce({ error: { code: 'unexpected_failure', status: 500 } });
    const db = { auth: { linkIdentity } } as unknown as Db;
    expect(await lierSociale(db, 'google', 'https://jeu/')).toEqual({ ok: true, value: null });
    expect(linkIdentity).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'https://jeu/' } });
    expect(await lierSociale(db, 'google', 'https://jeu/')).toMatchObject({ ok: false, raison: 'fermee' });
    const autre = await lierSociale(db, 'google', 'https://jeu/');
    expect(autre.ok).toBe(false);
    expect('raison' in autre && autre.raison).toBeFalsy();
  });

  it('moyens du compte : e-mail d’abord, puis Google, Apple, Facebook ; e-mail du fournisseur', async () => {
    const getUserIdentities = vi.fn().mockResolvedValue({ data: { identities: [ident('facebook', 'f@x'), ident('github'), ident('email', 'e@x'), ident('google', 'g@x')] }, error: null });
    const r = await moyensDuCompte({ auth: { getUserIdentities } } as unknown as Db);
    expect(r.ok && r.value.map(m => [m.moyen, m.email])).toEqual([['email', 'e@x'], ['google', 'g@x'], ['facebook', 'f@x'], ['autre', null]]);
  });

  it('retirer : refus du dernier moyen, conflit d’adresse, succès', async () => {
    const unlinkIdentity = vi.fn().mockResolvedValueOnce({ error: { code: 'single_identity_not_deletable' } })
      .mockResolvedValueOnce({ error: { code: 'email_conflict_identity_not_deletable' } }).mockResolvedValueOnce({ error: null });
    const db = { auth: { unlinkIdentity } } as unknown as Db;
    const i = ident('google') as never;
    expect(await retirerMoyen(db, i)).toEqual({ ok: false, error: 'Garde au moins un moyen pour te connecter.' });
    expect(await retirerMoyen(db, i)).toEqual({ ok: false, error: 'Impossible de le retirer : l’adresse de ton compte en dépend.' });
    expect(await retirerMoyen(db, i)).toEqual({ ok: true, value: null });
  });
});
