import { describe, expect, it, vi } from 'vitest';
import type { EtatDirect } from '../go/pendule';
import type { Db } from './supabase';
import { abonnerDirect, fusionnerEtatPartie, fusionnerPendule } from './direct';

// #425 : la partie en direct applique la ligne reçue par le temps réel, sans relire la pendule à chaque événement.

const PARTIE = '33333333-3333-4333-8333-000000000001';
const T0 = Date.parse('2026-10-04T12:00:00Z');
const etat: EtatDirect = {
  statut: 'active', resultat: null, coups: 'ee', comptage: false, mortes: null, mortesPar: null, cadence: 'normale', periodeMs: 30_000,
  noir: { ms: 595_000, periodes: 3, vuLe: T0 }, blanc: { ms: 600_000, periodes: 3, vuLe: T0 }, traitDepuis: T0, maintenant: T0,
};

describe('abonnerDirect', () => {
  it('suit la partie et la pendule ; chaque ligne reçue va à l’écran, sans relecture', () => {
    const on = vi.fn(() => canal);
    const canal = { on, subscribe: vi.fn(() => canal) };
    const removeChannel = vi.fn(async () => 'ok');
    const db = { channel: vi.fn(() => canal), removeChannel, realtime: { isConnected: () => true, connect: vi.fn(), disconnect: vi.fn() } } as unknown as Db;
    const suivi = { surPartie: vi.fn(), surPendule: vi.fn(), rattraper: vi.fn() };
    const arreter = abonnerDirect(db, PARTIE, suivi);
    expect(on).toHaveBeenCalledWith('postgres_changes', expect.objectContaining({ table: 'games', filter: `id=eq.${PARTIE}` }), expect.any(Function));
    expect(on).toHaveBeenCalledWith('postgres_changes', expect.objectContaining({ table: 'parties_direct', filter: `partie_id=eq.${PARTIE}` }), expect.any(Function));
    const rappel = (table: string) => (on.mock.calls as unknown as [string, { table: string }, (p: unknown) => void][]).find(a => a[1].table === table)![2];
    rappel('parties_direct')({ new: { partie_id: PARTIE, noir_vu_le: '2026-10-04T12:00:05Z' } });
    expect(suivi.surPendule).toHaveBeenCalledTimes(1);
    expect(suivi.rattraper).not.toHaveBeenCalled();
    arreter();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });
});

describe('fusionnerPendule', () => {
  it('reprend les temps, les périodes, le début du coup et la présence', () => {
    const e = fusionnerPendule(etat, {
      partie_id: PARTIE, noir_ms: 590_000, blanc_ms: 600_000, noir_periodes: 3, blanc_periodes: 3, periode_ms: 30_000,
      trait_depuis: '2026-10-04T12:00:10.123456+00:00', noir_vu_le: '2026-10-04T12:00:10+00:00', blanc_vu_le: null,
    });
    expect(e.noir).toEqual({ ms: 590_000, periodes: 3, vuLe: T0 + 10_000 });
    expect(e.blanc).toEqual({ ms: 600_000, periodes: 3, vuLe: null });
    expect(e.traitDepuis).toBe(T0 + 10_123);
    expect(e.maintenant).toBe(T0);
  });
  it('signe de présence seul : la pendule ne bouge pas', () => {
    const e = fusionnerPendule(etat, { partie_id: PARTIE, blanc_vu_le: '2026-10-04T12:00:03Z' });
    expect({ ...e, blanc: etat.blanc }).toEqual(etat);
    expect(e.blanc.vuLe).toBe(T0 + 3_000);
  });
  it('pendule arrêtée (comptage, fin) : `trait_depuis` à null', () => {
    expect(fusionnerPendule(etat, { trait_depuis: null }).traitDepuis).toBeNull();
  });
});

describe('fusionnerEtatPartie', () => {
  it('le coup de l’adversaire : coups à jour, et sa pendule à lui s’arrête, la mienne part', () => {
    const e = fusionnerEtatPartie(etat, { id: PARTIE, moves: 'eecc', status: 'active', counting: false, result: null }, T0 + 4_000)!;
    expect(e.coups).toBe('eecc');
    expect(e.blanc.ms).toBe(596_000);
    expect(e.traitDepuis).toBe(T0 + 4_000);
  });
  it('comptage, puis fin : statut, résultat, pierres mortes', () => {
    const e = fusionnerEtatPartie({ ...etat, coups: 'eecctt' }, { moves: 'eecctttt', counting: true, dead_stones: null, dead_proposed_by: null }, T0)!;
    expect(e).toMatchObject({ coups: 'eecctttt', comptage: true });
    expect(fusionnerEtatPartie(e, { moves: 'eecctttt', status: 'finished', result: 'B+73.5', counting: false }, T0))
      .toMatchObject({ statut: 'finished', resultat: 'B+73.5', comptage: false });
  });
  it('ignore une ligne qui a moins de coups que l’affichage', () => {
    expect(fusionnerEtatPartie({ ...etat, coups: 'eecc' }, { moves: 'ee' }, T0)).toBeNull();
  });
});
