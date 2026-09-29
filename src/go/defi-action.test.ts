import { defiCoup, parseDefiCoupRequest, refusDepuisSql, type DefiCoupDeps, type JouerCoupDefiResult, type DbError } from './defi-action';
import type { GameRow } from './server';

const PARTIE = '11111111-2222-4333-8444-555555555555';
const NOIR = 'bbbbbbbb-0000-4000-8000-000000000002'; // l'invité, souvent en session anonyme
const BLANC = 'aaaaaaaa-0000-4000-8000-000000000001'; // la créatrice
const TIERS = 'cccccccc-0000-4000-8000-000000000003';

const partie = (extra: Partial<GameRow> = {}): GameRow => ({
  id: PARTIE, black_id: NOIR, white_id: BLANC, bot_id: null, size: 9, rules: 'japanese', komi: 6.5, handicap: 0,
  moves: '', status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, resumed_at: 0, ...extra
});

/** Base simulée : une partie, un défi, et la réponse de jouer_coup_defi. */
function base(opts: {
  game?: GameRow | null;
  estDefi?: boolean;
  rpc?: { data: JouerCoupDefiResult | null; error: DbError | null };
} = {}) {
  let game = opts.game === undefined ? partie() : opts.game;
  const appels: unknown[] = [];
  const deps: DefiCoupDeps = {
    lirePartie: async () => ({ game, estDefi: opts.estDefi ?? true }),
    jouerCoupDefi: async args => {
      appels.push(args);
      const r = opts.rpc ?? { data: { ok: true, coups: args.p_coups_avant + args.p_coup, date_limite: '2026-10-02T20:00:00Z' }, error: null };
      if (r.data?.ok && game) game = { ...game, moves: r.data.coups ?? game.moves, counting: args.p_comptage };
      return r;
    },
    relirePartie: async () => game
  };
  return { deps, appels };
}

const coup = (move: string) => ({ action: 'defi_coup' as const, gameId: PARTIE, move });

describe('parseDefiCoupRequest', () => {
  it('lit le contrat du client { action, game_id, move }', () => {
    expect(parseDefiCoupRequest({ action: 'defi_coup', game_id: PARTIE, move: 'ee' })).toEqual(coup('ee'));
    expect(parseDefiCoupRequest({ action: 'defi_coup', game_id: PARTIE, move: 'tt' })).toEqual(coup('tt'));
  });
  it('refuse une demande mal formée', () => {
    expect(parseDefiCoupRequest(null)).toBeNull();
    expect(parseDefiCoupRequest({ action: 'defi_coup', gameId: PARTIE, move: 'ee' })).toBeNull();
    expect(parseDefiCoupRequest({ action: 'defi_coup', game_id: 'pas-un-uuid', move: 'ee' })).toBeNull();
    expect(parseDefiCoupRequest({ action: 'defi_coup', game_id: PARTIE, move: 'eee' })).toBeNull();
    expect(parseDefiCoupRequest({ action: 'defi_coup', game_id: PARTIE, move: 4 })).toBeNull();
    expect(parseDefiCoupRequest({ action: 'move', game_id: PARTIE, move: 'ee' })).toBeNull();
  });
});

describe('defiCoup (fonction serveur game-action, #81)', () => {
  it('coup valide : appelle jouer_coup_defi et renvoie la partie', async () => {
    const { deps, appels } = base();
    const r = await defiCoup(deps, NOIR, coup('ee'));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, game: { id: PARTIE, moves: 'ee' } });
    expect(appels).toEqual([{ p_partie: PARTIE, p_joueur: NOIR, p_coups_avant: '', p_coup: 'ee', p_comptage: false }]);
  });

  it('passe : la deuxième passe de suite ouvre le comptage', async () => {
    const { deps, appels } = base({ game: partie({ moves: 'eett' }) });
    const r = await defiCoup(deps, NOIR, coup('tt'));
    expect(r.status).toBe(200);
    expect(appels).toEqual([{ p_partie: PARTIE, p_joueur: NOIR, p_coups_avant: 'eett', p_coup: 'tt', p_comptage: true }]);
  });

  it('hors tour : 409, sans écrire', async () => {
    const { deps, appels } = base({ game: partie({ moves: 'ee' }) });
    const r = await defiCoup(deps, NOIR, coup('cc'));
    expect(r).toMatchObject({ status: 409, body: { ok: false, error: 'tour' } });
    expect(appels).toEqual([]);
  });

  it('tiers : 403, même sur une partie finie, sans écrire', async () => {
    const { deps, appels } = base();
    expect(await defiCoup(deps, TIERS, coup('ee'))).toMatchObject({ status: 403, body: { error: 'spectateur' } });
    const finie = base({ game: partie({ status: 'finished' }) });
    expect(await defiCoup(finie.deps, TIERS, coup('ee'))).toMatchObject({ status: 403, body: { error: 'spectateur' } });
    expect([...appels, ...finie.appels]).toEqual([]);
  });

  it('coups illégaux : occupé, suicide, ko, hors plateau, format → 422, sans écrire', async () => {
    const cas: [string, string, string, string][] = [
      ['ee', BLANC, 'ee', 'occupe'],
      ['baiiab', BLANC, 'aa', 'suicide'],
      // Noir prend le ko en cb, Blanc ne peut pas reprendre tout de suite en bb.
      ['ba' + 'ca' + 'ab' + 'bb' + 'bc' + 'db' + 'ii' + 'cc' + 'cb', BLANC, 'bb', 'ko'],
      ['', NOIR, 'jj', 'hors-plateau'],
      ['', NOIR, 'EE', 'format']
    ];
    for (const [moves, joueur, move, erreur] of cas) {
      const { deps, appels } = base({ game: partie({ moves }) });
      expect(await defiCoup(deps, joueur, coup(move))).toMatchObject({ status: 422, body: { ok: false, error: erreur } });
      expect(appels).toEqual([]);
    }
  });

  it('partie finie ou pas encore commencée : 409', async () => {
    for (const status of ['finished', 'waiting']) {
      const { deps, appels } = base({ game: partie({ status }) });
      expect(await defiCoup(deps, NOIR, coup('ee'))).toMatchObject({ status: 409, body: { error: 'terminee' } });
      expect(appels).toEqual([]);
    }
  });

  it('comptage en cours : 409', async () => {
    const { deps } = base({ game: partie({ moves: 'eetttt', counting: true }) });
    expect(await defiCoup(deps, BLANC, coup('cc'))).toMatchObject({ status: 409, body: { error: 'comptage' } });
  });

  it('délai dépassé : jouer_coup_defi enregistre la victoire au temps, 409 temps', async () => {
    const { deps } = base({ rpc: { data: { ok: false, erreur: 'temps', resultat: 'W+T' }, error: null } });
    expect(await defiCoup(deps, NOIR, coup('ee'))).toMatchObject({
      status: 409, body: { ok: false, error: 'temps', resultat: 'W+T' }
    });
  });

  it('partie inconnue ou qui n’est pas un défi : 404', async () => {
    expect(await defiCoup(base({ game: null }).deps, NOIR, coup('ee'))).toMatchObject({ status: 404, body: { error: 'introuvable' } });
    expect(await defiCoup(base({ estDefi: false }).deps, NOIR, coup('ee'))).toMatchObject({ status: 404, body: { error: 'introuvable' } });
  });

  it('lecture en échec : 500', async () => {
    const { deps } = base();
    deps.lirePartie = async () => ({ game: null, estDefi: false, error: true });
    expect(await defiCoup(deps, NOIR, coup('ee'))).toMatchObject({ status: 500, body: { error: 'lecture' } });
  });

  it('refus de jouer_coup_defi sous verrou : partie changée entre-temps → 409 conflit', async () => {
    const { deps } = base({ rpc: { data: null, error: { code: '40001', message: 'La partie a changé, recharge-la' } } });
    expect(await defiCoup(deps, NOIR, coup('ee'))).toMatchObject({ status: 409, body: { error: 'conflit' } });
  });
});

describe('refusDepuisSql', () => {
  it('traduit les codes de jouer_coup_defi', () => {
    expect(refusDepuisSql({ code: '42501', message: 'Ce n\'est pas ton tour' })).toMatchObject({ status: 409, body: { error: 'tour' } });
    expect(refusDepuisSql({ code: '42501', message: 'Tu ne joues pas dans cette partie' })).toMatchObject({ status: 403 });
    expect(refusDepuisSql({ code: '55000', message: 'Comptage en cours' })).toMatchObject({ status: 409, body: { error: 'comptage' } });
    expect(refusDepuisSql({ code: '55000', message: 'La partie n\'est pas en cours' })).toMatchObject({ status: 409, body: { error: 'terminee' } });
    expect(refusDepuisSql({ code: '22023', message: 'Coup invalide' })).toMatchObject({ status: 422 });
    expect(refusDepuisSql({ code: 'P0002', message: 'Partie introuvable' })).toMatchObject({ status: 404 });
    expect(refusDepuisSql({ code: 'XX000', message: 'boum' })).toMatchObject({ status: 500 });
  });
  it('ne renvoie jamais le message SQL brut au client', () => {
    const r = refusDepuisSql({ code: 'XX000', message: 'détail interne' });
    expect(JSON.stringify(r.body)).not.toContain('détail interne');
  });
});
