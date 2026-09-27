import { acceptScore, errorMessage, playMove, proposeDeadStones, resumeGame } from './games';
import type { Db } from './supabase';

const ID = '11111111-1111-4111-8111-111111111111';

function fakeDb(reply: { data: unknown; error: unknown }) {
  const calls: { name: string; body: unknown }[] = [];
  const db = {
    functions: {
      invoke: async (name: string, opts: { body: unknown }) => {
        calls.push({ name, body: opts.body });
        return reply;
      }
    }
  } as unknown as Db;
  return { db, calls };
}

describe('actions de partie en ligne', () => {
  it('envoie chaque action à la fonction serveur game-action', async () => {
    const { db, calls } = fakeDb({ data: { ok: true, game: { moves: 'ee' } }, error: null });
    expect(await playMove(db, ID, 'ee')).toEqual({ ok: true, value: { ok: true, game: { moves: 'ee' } } });
    await proposeDeadStones(db, ID, 'aabb');
    await acceptScore(db, ID);
    await resumeGame(db, ID);
    expect(calls).toEqual([
      { name: 'game-action', body: { action: 'move', gameId: ID, move: 'ee' } },
      { name: 'game-action', body: { action: 'propose_dead', gameId: ID, dead: 'aabb' } },
      { name: 'game-action', body: { action: 'accept', gameId: ID } },
      { name: 'game-action', body: { action: 'resume', gameId: ID } }
    ]);
  });

  it('remonte le message du serveur quand le coup est refusé', async () => {
    const context = new Response(JSON.stringify({ ok: false, error: 'ko', message: 'Coup interdit par la règle du ko.' }), { status: 422 });
    const { db } = fakeDb({ data: null, error: { context } });
    expect(await playMove(db, ID, 'bb')).toEqual({ ok: false, error: 'Coup interdit par la règle du ko.' });
  });

  it('donne un message générique si le serveur ne répond pas', async () => {
    expect(await errorMessage(new Error('réseau'))).toMatch(/connexion/);
    const { db } = fakeDb({ data: null, error: null });
    expect((await acceptScore(db, ID)).ok).toBe(false);
  });
});
