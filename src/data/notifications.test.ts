import { describe, expect, it, vi } from 'vitest';
import { ecouterNotifications, marquerLues, MAX_LUES, notificationsEnAttente, partiesNonVues } from './notifications';
import { lireDefi } from './defi';
import type { Db } from './supabase';

const MOI = '00000000-0000-4000-8000-0000000000a1';
const PARTIE = '11111111-1111-4111-8111-111111111111';

/** Client simulé : enregistre la chaîne de lecture de `notifications`, les RPC et le canal temps réel. */
function client(o: { lignes?: unknown[]; erreur?: string; rpc?: Record<string, { data: unknown; error: unknown }> } = {}) {
  const chaine: [string, ...unknown[]][] = [];
  const requete: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is', 'order']) requete[m] = (...a: unknown[]) => { chaine.push([m, ...a]); return requete; };
  requete.limit = async (n: number) => {
    chaine.push(['limit', n]);
    return o.erreur ? { data: null, error: { message: o.erreur } } : { data: o.lignes ?? [], error: null };
  };
  requete.maybeSingle = async () => ({ data: { id: PARTIE, result: null }, error: null });
  const from = vi.fn(() => requete);
  const rpc = vi.fn(async (nom: string, _args?: unknown) => o.rpc?.[nom] ?? { data: null, error: null });
  const canal: { on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> } = { on: vi.fn(() => canal), subscribe: vi.fn(() => canal) };
  const channel = vi.fn(() => canal);
  const removeChannel = vi.fn();
  const db = { from, rpc, channel, removeChannel } as unknown as Db;
  return { db, from, rpc, chaine, channel, on: canal.on, subscribe: canal.subscribe, removeChannel };
}

describe('notificationsEnAttente', () => {
  it('lit les seules notifications non lues du joueur, les plus récentes d’abord, en nombre borné', async () => {
    const c = client({ lignes: [
      { id: 2, type: 'tour', partie_id: PARTIE, creee_le: '2026-10-02T10:00:00Z' },
      { id: 1, type: 'ami', partie_id: null, creee_le: '2026-10-01T10:00:00Z' },
    ] });
    expect(await notificationsEnAttente(c.db, MOI)).toEqual({ ok: true, value: [
      { id: 2, type: 'tour', partieId: PARTIE, creeeLe: '2026-10-02T10:00:00Z' },
      { id: 1, type: 'ami', partieId: null, creeeLe: '2026-10-01T10:00:00Z' },
    ] });
    expect(c.from).toHaveBeenCalledWith('notifications');
    expect(c.chaine).toEqual([
      ['select', 'id, type, partie_id, creee_le'],
      ['eq', 'destinataire_id', MOI],
      ['is', 'lue_le', null],
      ['order', 'creee_le', { ascending: false }],
      ['limit', MAX_LUES],
    ]);
  });

  it('ignore un type inconnu (serveur plus récent que l’app)', async () => {
    const c = client({ lignes: [{ id: 3, type: 'tournoi', partie_id: null, creee_le: '2026-10-02T10:00:00Z' }] });
    expect(await notificationsEnAttente(c.db, MOI)).toEqual({ ok: true, value: [] });
  });

  it('renvoie l’erreur (table absente, réseau)', async () => {
    const c = client({ erreur: 'relation "public.notifications" does not exist' });
    expect(await notificationsEnAttente(c.db, MOI)).toEqual({ ok: false, error: 'relation "public.notifications" does not exist' });
  });
});

describe('partiesNonVues', () => {
  it('garde les parties où le joueur doit agir (tour, comptage), pas la fin ni les amis', () => {
    const n = (id: number, type: 'tour' | 'comptage' | 'fin' | 'ami', partieId: string | null) => ({ id, type, partieId, creeeLe: '' });
    expect([...partiesNonVues([n(1, 'tour', 'p1'), n(2, 'comptage', 'p2'), n(3, 'fin', 'p3'), n(4, 'ami', null)])]).toEqual(['p1', 'p2']);
    expect(partiesNonVues([]).size).toBe(0);
  });
});

describe('marquerLues', () => {
  it('marque celles d’une partie', async () => {
    const c = client({ rpc: { marquer_notifications_lues: { data: 1, error: null } } });
    expect(await marquerLues(c.db, { partieId: PARTIE })).toEqual({ ok: true, value: 1 });
    expect(c.rpc).toHaveBeenCalledWith('marquer_notifications_lues', { p_partie: PARTIE, p_type: undefined });
  });

  it('marque un type, ou toutes : les arguments absents prennent la valeur du serveur (null)', async () => {
    const c = client({ rpc: { marquer_notifications_lues: { data: 2, error: null } } });
    await marquerLues(c.db, { type: 'ami' });
    expect(JSON.stringify(c.rpc.mock.calls[0][1])).toBe('{"p_type":"ami"}');
    await marquerLues(c.db);
    expect(JSON.stringify(c.rpc.mock.calls[1][1])).toBe('{}');
  });

  it('renvoie l’erreur du serveur', async () => {
    const c = client({ rpc: { marquer_notifications_lues: { data: null, error: { message: 'Connexion requise' } } } });
    expect(await marquerLues(c.db)).toEqual({ ok: false, error: 'Connexion requise' });
  });
});

describe('ecouterNotifications', () => {
  it('écoute la seule file du joueur (filtre destinataire), tous les événements, puis s’arrête', () => {
    const c = client();
    const onChange = vi.fn();
    const arreter = ecouterNotifications(c.db, MOI, onChange);
    expect(c.channel).toHaveBeenCalledWith(`notifications-${MOI}`);
    expect(c.on).toHaveBeenCalledTimes(1);
    expect(c.on).toHaveBeenCalledWith('postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `destinataire_id=eq.${MOI}` }, onChange);
    expect(c.subscribe).toHaveBeenCalledTimes(1);
    arreter();
    expect(c.removeChannel).toHaveBeenCalledTimes(1);
  });
});

describe('lireDefi marque la partie lue (#367)', () => {
  it('ouvrir la partie appelle marquer_notifications_lues pour cette partie', async () => {
    const c = client();
    const r = await lireDefi(c.db, PARTIE);
    expect(r.ok).toBe(true);
    expect(c.rpc).toHaveBeenCalledWith('marquer_notifications_lues', { p_partie: PARTIE, p_type: undefined });
  });

  it('un échec du marquage ne gêne pas la lecture', async () => {
    const c = client({ rpc: { marquer_notifications_lues: { data: null, error: { message: 'réseau' } } } });
    expect((await lireDefi(c.db, PARTIE)).ok).toBe(true);
  });
});
