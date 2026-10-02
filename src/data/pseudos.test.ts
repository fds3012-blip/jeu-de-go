import { describe, expect, it, vi } from 'vitest';
import type { Db } from './supabase';
import { adversaireDe, lirePseudos } from './pseudos';

/** Client simulé : from('profiles').select('id, username').in('id', ids). Note chaque lecture. */
function client(profils: { id: string; username: string | null }[], erreur: unknown = null) {
  const lectures: { table: string; colonnes: string; ids: string[] }[] = [];
  const from = vi.fn((table: string) => ({
    select: (colonnes: string) => ({
      in: async (_col: string, ids: string[]) => {
        lectures.push({ table, colonnes, ids });
        return erreur ? { data: null, error: erreur } : { data: profils.filter(p => ids.includes(p.id)), error: null };
      },
    }),
  }));
  return { db: { from } as unknown as Db, lectures };
}

describe('pseudos des adversaires (#400)', () => {
  it('une seule lecture pour toute la liste, sans doublon ni place vide', async () => {
    const { db, lectures } = client([{ id: 'lea', username: 'Lea_du_go' }, { id: 'tom', username: null }]);
    const p = await lirePseudos(db, ['lea', 'tom', 'lea', null, undefined, 'inconnu']);
    expect(lectures).toEqual([{ table: 'profiles', colonnes: 'id, username', ids: ['lea', 'tom', 'inconnu'] }]);
    expect(p.get('lea')).toBe('Lea_du_go');
    // Sans pseudo, ou profil invisible : null (l'écran dit « Ton ami »).
    expect(p.get('tom')).toBeNull();
    expect(p.get('inconnu')).toBeNull();
  });

  it('ne relit pas les pseudos déjà connus, et ne lit rien quand tout est connu', async () => {
    const { db, lectures } = client([{ id: 'lea', username: 'Lea_du_go' }, { id: 'sam', username: 'Sam' }]);
    const cache = new Map<string, string | null>([['lea', 'Lea_du_go']]);
    await lirePseudos(db, ['lea', 'sam'], cache);
    expect(lectures.map(l => l.ids)).toEqual([['sam']]);
    await lirePseudos(db, ['lea', 'sam'], cache);
    expect(lectures).toHaveLength(1);
    expect(cache.get('sam')).toBe('Sam');
  });

  it('un échec de lecture n’est pas gardé : la prochaine lecture réessaie', async () => {
    const { db, lectures } = client([], { message: 'réseau' });
    const cache = await lirePseudos(db, ['lea']);
    expect(cache.has('lea')).toBe(false);
    await lirePseudos(db, ['lea'], cache);
    expect(lectures).toHaveLength(2);
  });

  it('une exception réseau ne fait pas échouer la lecture', async () => {
    const db = { from: () => ({ select: () => ({ in: () => Promise.reject(new TypeError('Failed to fetch')) }) }) } as unknown as Db;
    const cache = await lirePseudos(db, ['lea']);
    expect(cache.size).toBe(0);
  });

  it('l’adversaire : l’autre camp, ou personne', () => {
    expect(adversaireDe({ black_id: 'moi', white_id: 'lea' }, 'moi')).toBe('lea');
    expect(adversaireDe({ black_id: 'lea', white_id: 'moi' }, 'moi')).toBe('lea');
    expect(adversaireDe({ black_id: null, white_id: 'moi' }, 'moi')).toBeNull();
    expect(adversaireDe({ black_id: 'a', white_id: 'b' }, 'moi')).toBeNull();
  });
});
