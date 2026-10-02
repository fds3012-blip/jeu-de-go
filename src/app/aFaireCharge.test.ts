import { describe, expect, it } from 'vitest';
import { chargerDefis } from './aFaireCharge';
import type { Db } from '../data/supabase';

// #367 (serveur) : une partie où c'est ton tour est « nouvelle » tant que sa notification n'est pas lue.
const MOI = '00000000-0000-4000-8000-0000000000a1';
const LEA = '00000000-0000-4000-8000-0000000000b2';
const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';

const partie = (id: string) => ({ id, white_id: MOI, black_id: LEA, size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves: 'ee',
  status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0 });
const defi = (id: string) => ({ partie_id: id, createur_id: MOI, invite_id: LEA, date_limite: new Date(Date.now() + 864e5).toISOString(), cree_le: '' });

/** Client minimal : chaque table renvoie ses lignes, quelle que soit la chaîne de filtres. */
function db(notifications: { data: unknown; error: unknown }): Db {
  const tables: Record<string, { data: unknown; error: unknown }> = {
    defis: { data: [defi(P1), defi(P2)], error: null },
    games: { data: [partie(P1), partie(P2)], error: null },
    profiles: { data: [{ id: LEA, username: 'Léa' }], error: null },
    notifications,
  };
  const requete = (r: { data: unknown; error: unknown }) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'or', 'order', 'in', 'limit']) q[m] = () => q;
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(r).then(ok);
    return q;
  };
  return { from: (t: string) => requete(tables[t]) } as unknown as Db;
}

describe('chargerDefis', () => {
  it('nouveau : seulement la partie dont la notification attend', async () => {
    const l = await chargerDefis(db({ data: [{ id: 1, type: 'tour', partie_id: P2, creee_le: '' }], error: null }), MOI, new Map());
    expect(l.map(x => [x.partieId, x.adversaire, x.nouveau])).toEqual([[P1, 'Léa', false], [P2, 'Léa', true]]);
  });

  it('notifications illisibles (serveur sans la table) : `nouveau` absent, la pastille reste allumée', async () => {
    const l = await chargerDefis(db({ data: null, error: { message: 'relation does not exist' } }), MOI, new Map());
    expect(l).toHaveLength(2);
    for (const x of l) expect('nouveau' in x).toBe(false);
  });
});
