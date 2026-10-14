// Export de mes données (#530) : ce qui part dans le fichier, ce qui n'y part jamais, et les refus du serveur.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assembler, donneesAppareil, lireRefus, lireServeur, nomFichier } from './exportDonnees';
import type { Db } from './supabase';

function stockage(valeurs: Record<string, string>): Pick<Storage, 'length' | 'key' | 'getItem'> {
  const cles = Object.keys(valeurs);
  return { length: cles.length, key: i => cles[i] ?? null, getItem: k => valeurs[k] ?? null };
}

/** Client simulé : session ou non, réponse de `exporter_mes_donnees`. */
function client(session: boolean, reponse: { data?: unknown; error?: { code?: string; hint?: string } | null } | Error) {
  const rpc = vi.fn(async (nom: string) => {
    expect(nom).toBe('exporter_mes_donnees');
    if (reponse instanceof Error) throw reponse;
    return { data: reponse.data ?? null, error: reponse.error ?? null };
  });
  const db = { auth: { getSession: async () => ({ data: { session: session ? { user: { id: 'u1' } } : null } }) }, rpc } as unknown as Db;
  return { db, rpc };
}

afterEach(() => vi.unstubAllGlobals());

describe('données de l’appareil', () => {
  it('prend chaque clé de l’app, relue en JSON si possible, dans l’ordre', () => {
    const r = donneesAppareil(stockage({
      'go.settings.v1': '{"theme":"dark"}', 'go.lecons.v1': '["l1"]', 'go.equipe.v1': '1', 'go.texte': 'pas du json',
    }));
    expect(Object.keys(r)).toEqual(['go.equipe.v1', 'go.lecons.v1', 'go.settings.v1', 'go.texte']);
    expect(r['go.settings.v1']).toEqual({ theme: 'dark' });
    expect(r['go.texte']).toBe('pas du json');
  });

  it('jamais la session de connexion, la mesure, le test, ni une clé qui parle de jeton', () => {
    const r = donneesAppareil(stockage({
      'sb-xjvsalkvpgcjrznznxoi-auth-token': '{"access_token":"secret"}', 'ph_phc_x_posthog': '{"distinct_id":"x"}',
      'e2e.supabase': 'https://e', 'go.rattachement.v1': 'code', 'go.retour-connexion.v1': '{"jeton":"j"}', 'go.defi.jeton': 'j',
      'go.xp.v1': '12',
    }));
    expect(r).toEqual({ 'go.xp.v1': 12 });
    expect(JSON.stringify(r)).not.toMatch(/secret|distinct_id|jeton/);
  });

  it('sans stockage, ou stockage illisible : rien, sans erreur', () => {
    expect(donneesAppareil(undefined)).toEqual({});
    expect(donneesAppareil({ length: 1, key: () => { throw new Error('bloqué'); }, getItem: () => null })).toEqual({});
  });
});

describe('fichier', () => {
  it('nom daté du jour local', () => {
    expect(nomFichier(new Date(2026, 9, 3, 23, 59))).toBe('mochi-go-mes-donnees-2026-10-03.json');
  });

  it('réunit le serveur et l’appareil, avec un texte « à lire »', () => {
    const f = assembler({ format: 'mochi-go.mes-donnees' }, { 'go.xp.v1': 3 }, 'Lis-moi', 'fr', new Date('2026-10-13T10:00:00Z'));
    expect(f).toEqual({ a_lire: 'Lis-moi', app: 'Mochi Go', langue: 'fr', genere_le: '2026-10-13T10:00:00.000Z',
      serveur: { format: 'mochi-go.mes-donnees' }, appareil: { stockage_local: { 'go.xp.v1': 3 } } });
    expect(assembler(undefined, {}, '', 'en').serveur).toBeNull();
  });
});

describe('lecture du serveur', () => {
  it('sans service de compte ou sans session : appareil seulement, aucun appel', async () => {
    expect(await lireServeur(null)).toEqual({ ok: true, compte: false, serveur: null });
    const { db, rpc } = client(false, { data: {} });
    expect(await lireServeur(db)).toEqual({ ok: true, compte: false, serveur: null });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('avec une session : les données du compte', async () => {
    const { db } = client(true, { data: { format: 'mochi-go.mes-donnees' } });
    expect(await lireServeur(db, true)).toEqual({ ok: true, compte: true, serveur: { format: 'mochi-go.mes-donnees' } });
  });

  it('plafond : minutes à attendre lues dans l’indice (1 à 60)', async () => {
    expect(await lireServeur(client(true, { error: { code: 'JGX01', hint: '17' } }).db, true)).toEqual({ ok: false, raison: 'limite', minutes: 17 });
    expect(lireRefus({ code: 'JGX01', hint: 'n’importe quoi' })).toEqual({ raison: 'limite', minutes: 60 });
    expect(lireRefus({ code: 'JGX01', hint: '600' })).toEqual({ raison: 'limite', minutes: 60 });
  });

  it('session expirée (JGC01) : appareil seulement ; autre erreur ou exception : serveur', async () => {
    expect(await lireServeur(client(true, { error: { code: 'JGC01' } }).db, true)).toEqual({ ok: true, compte: false, serveur: null });
    expect(await lireServeur(client(true, { error: { code: '500' } }).db, true)).toEqual({ ok: false, raison: 'serveur' });
    vi.stubGlobal('navigator', { onLine: true });
    expect(await lireServeur(client(true, new Error('réseau')).db, true)).toEqual({ ok: false, raison: 'serveur' });
  });

  it('hors ligne avec une session : refus clair, pas de fichier incomplet', async () => {
    const { db, rpc } = client(true, { data: {} });
    expect(await lireServeur(db, false)).toEqual({ ok: false, raison: 'horsLigne' });
    expect(rpc).not.toHaveBeenCalled();
  });
});
