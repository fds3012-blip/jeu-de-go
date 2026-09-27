import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GO_FILES, OUT_DIR, SRC_DIR, toDeno } from '../../scripts/sync-functions.mjs';
import { handicapPoints } from './rules';
import {
  countingStarts, finalScore, formatResult, normalizeDead, parseActionRequest, parseDead, parseMove, planAction,
  recordFromOnlineGame, validateMove, type ActionRequest, type GameRow, type OnlineGame
} from './server';
import type { GameRecord } from './sgf';

const game = (moves: string, extra: Partial<OnlineGame> = {}): GameRecord =>
  recordFromOnlineGame({ size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves, ...extra })!;

// Forme de ko (x, y depuis le haut) : Noir prend en cb, Blanc ne peut pas reprendre tout de suite en bb.
const KO = 'ba' + 'ca' + 'ab' + 'bb' + 'bc' + 'db' + 'ii' + 'cc' + 'cb';

describe('recordFromOnlineGame', () => {
  it('alterne les couleurs à partir de Noir', () => {
    const r = game('eett');
    expect(r.moves).toEqual([{ color: 1, p: 40 }, { color: 2, p: -1 }]);
  });
  it('place le handicap et fait commencer Blanc', () => {
    const r = recordFromOnlineGame({ size: 9, komi: 0.5, rules: 'japanese', handicap: 2, moves: 'ee' })!;
    expect(r.setupBlack).toEqual(handicapPoints(9, 2));
    expect(r.moves[0].color).toBe(2);
  });
  it('refuse un historique mal formé', () => {
    expect(recordFromOnlineGame({ size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves: 'eez' })).toBeNull();
    expect(recordFromOnlineGame({ size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves: 'zz' })).toBeNull();
  });
});

describe('validateMove', () => {
  it('accepte un coup légal et une passe', () => {
    const v = validateMove(game(''), 'ee');
    expect(v.ok && v.color).toBe(1);
    const p = validateMove(game('ee'), 'tt');
    expect(p.ok && p.passes).toBe(1);
  });
  it('refuse une intersection occupée', () => {
    expect(validateMove(game('ee'), 'ee')).toMatchObject({ ok: false, error: 'occupe' });
  });
  it('refuse le suicide', () => {
    expect(validateMove(game('baiiab'), 'aa')).toMatchObject({ ok: false, error: 'suicide' });
  });
  it('capture et refuse la reprise immédiate du ko', () => {
    const v = validateMove(game(KO.slice(0, -2)), 'cb');
    expect(v.ok && v.pos.captures[1]).toBe(1);
    expect(validateMove(game(KO), 'bb')).toMatchObject({ ok: false, error: 'ko' });
    // Après un échange ailleurs, la reprise devient légale.
    expect(validateMove(game(KO + 'hhgg'), 'bb').ok).toBe(true);
  });
  it('refuse le hors-plateau et les formats invalides', () => {
    expect(validateMove(game(''), 'jj')).toMatchObject({ ok: false, error: 'hors-plateau' });
    expect(validateMove(game(''), 'e')).toMatchObject({ ok: false, error: 'format' });
    expect(validateMove(game(''), 'EE')).toMatchObject({ ok: false, error: 'format' });
    expect(validateMove(game(''), 42 as unknown as string)).toMatchObject({ ok: false, error: 'format' });
  });
  it('refuse de continuer une partie dont l’historique est illégal', () => {
    expect(validateMove(game('eeee'), 'aa')).toMatchObject({ ok: false, error: 'partie-invalide' });
  });
  it('applique le superko en règles chinoises', () => {
    const r = game(KO, { rules: 'chinese' });
    expect(validateMove(r, 'bb')).toMatchObject({ ok: false, error: 'ko' });
  });
});

describe('outils de comptage', () => {
  it('ouvre le comptage après deux passes depuis la reprise', () => {
    expect(countingStarts(2, 10, 0)).toBe(true);
    expect(countingStarts(1, 10, 0)).toBe(false);
    expect(countingStarts(3, 10, 9)).toBe(false);
    expect(countingStarts(3, 10, 8)).toBe(true);
  });
  it('lit et normalise les pierres mortes par groupe entier', () => {
    expect(parseMove('tt', 9)).toBe(-1);
    expect(parseDead('eeef', 9)).toEqual([40, 49]);
    expect(parseDead('tt', 9)).toBeNull();
    expect(parseDead('e', 9)).toBeNull();
    const pos = validateMove(game('eeaaef'), 'tt');
    if (!pos.ok) throw new Error('coup refusé');
    expect(normalizeDead(pos.pos, [40])).toEqual([40, 49]);
    expect(normalizeDead(pos.pos, [1])).toBeNull();
    expect(normalizeDead(pos.pos, [999])).toBeNull();
  });
  it('formate le résultat', () => {
    expect(formatResult(1, 3.5)).toBe('B+3.5');
    expect(formatResult(2, 12)).toBe('W+12');
    expect(formatResult(0, 0)).toBe('0');
  });
});

describe('finalScore', () => {
  it('plateau vide : le komi décide', () => {
    expect(finalScore(game('tttt'), [], 6.5, 'japanese')).toMatchObject({ ok: true, result: 'W+6.5' });
    expect(finalScore(game('tttt'), [], 7, 'chinese')).toMatchObject({ ok: true, result: 'W+7' });
    expect(finalScore(game('tttt'), [], 0, 'japanese')).toMatchObject({ ok: true, result: '0', winner: 0 });
  });
  it('compte le territoire et retire les pierres mortes', () => {
    const r = game('eetttt');
    expect(finalScore(r, [], 6.5, 'japanese')).toMatchObject({ ok: true, result: 'B+73.5' });
    expect(finalScore(r, [40], 6.5, 'japanese')).toMatchObject({ ok: true, result: 'W+7.5', dead: [40] });
    expect(finalScore(r, [40], 7, 'chinese')).toMatchObject({ ok: true, result: 'W+7' });
  });
  it('refuse des pierres mortes invalides ou un historique illégal', () => {
    expect(finalScore(game('eetttt'), [0], 6.5, 'japanese')).toEqual({ ok: false, error: 'pierres-mortes' });
    expect(finalScore(game('eeee'), [], 6.5, 'japanese')).toEqual({ ok: false, error: 'partie-invalide' });
  });
});

describe('planAction (fonction serveur)', () => {
  const B = '00000000-0000-4000-8000-00000000000b', W = '00000000-0000-4000-8000-00000000000a', X = '00000000-0000-4000-8000-00000000000c';
  const ID = '11111111-1111-4111-8111-111111111111';
  const row = (extra: Partial<GameRow> = {}): GameRow => ({
    id: ID, black_id: B, white_id: W, bot_id: null, size: 9, rules: 'japanese', komi: '6.5', handicap: 0, moves: '',
    status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, resumed_at: 0, ...extra
  });
  const move = (m: string): ActionRequest => ({ action: 'move', gameId: ID, move: m });
  const act = (action: 'accept' | 'resume'): ActionRequest => ({ action, gameId: ID });
  const dead = (d: string): ActionRequest => ({ action: 'propose_dead', gameId: ID, dead: d });

  it('lit la demande du client', () => {
    expect(parseActionRequest({ action: 'move', gameId: ID, move: 'ee' })).toEqual(move('ee'));
    expect(parseActionRequest({ action: 'accept', gameId: ID })).toEqual(act('accept'));
    expect(parseActionRequest({ action: 'propose_dead', gameId: ID, dead: 'ee' })).toEqual(dead('ee'));
    expect(parseActionRequest({ action: 'move', gameId: 'x', move: 'ee' })).toBeNull();
    expect(parseActionRequest({ action: 'move', gameId: ID })).toBeNull();
    expect(parseActionRequest({ action: 'autre', gameId: ID })).toBeNull();
    expect(parseActionRequest(null)).toBeNull();
  });

  it('joue un coup légal, avec écriture conditionnelle', () => {
    expect(planAction(row(), B, move('ee'))).toEqual({
      ok: true, kind: 'update', expect: { moves: '', counting: false, dead_stones: null }, patch: { moves: 'ee' }
    });
  });

  it('refuse hors tour, spectateur, partie IA ou terminée, coup illégal', () => {
    expect(planAction(row(), W, move('ee'))).toMatchObject({ ok: false, status: 409, error: 'tour' });
    expect(planAction(row(), X, move('ee'))).toMatchObject({ ok: false, status: 403 });
    expect(planAction(row({ bot_id: 'mochi' }), B, move('ee'))).toMatchObject({ ok: false, error: 'bot' });
    expect(planAction(row({ status: 'finished' }), B, move('ee'))).toMatchObject({ ok: false, error: 'terminee' });
    expect(planAction(row({ moves: 'ee' }), W, move('ee'))).toMatchObject({ ok: false, status: 422, error: 'occupe' });
    expect(planAction(row({ moves: KO }), W, move('bb'))).toMatchObject({ ok: false, status: 422, error: 'ko' });
    expect(planAction(row({ moves: 'eeee' }), B, move('aa'))).toMatchObject({ ok: false, error: 'partie-invalide' });
  });

  it('ouvre le comptage à la deuxième passe et bloque alors les coups', () => {
    expect(planAction(row({ moves: 'eett' }), B, move('tt'))).toMatchObject({
      ok: true, patch: { moves: 'eetttt', counting: true, dead_stones: null, dead_proposed_by: null }
    });
    expect(planAction(row({ moves: 'eetttt', counting: true }), W, move('aa'))).toMatchObject({ ok: false, error: 'comptage' });
    // Après une reprise au coup 3, une seule nouvelle passe ne suffit pas.
    expect(planAction(row({ moves: 'eetttt', resumed_at: 3 }), W, move('tt'))).toMatchObject({ ok: true, patch: { moves: 'eetttttt' } });
  });

  it('propose les pierres mortes, puis l’autre joueur accepte', () => {
    const counting = row({ moves: 'eetttt', counting: true });
    expect(planAction(row(), B, dead(''))).toMatchObject({ ok: false, error: 'pas-de-comptage' });
    expect(planAction(counting, W, dead('ee'))).toMatchObject({ ok: true, patch: { dead_stones: 'ee', dead_proposed_by: W } });
    expect(planAction(counting, W, dead('aa'))).toMatchObject({ ok: false, error: 'pierres-mortes' });
    expect(planAction(counting, W, act('accept'))).toMatchObject({ ok: false, error: 'pas-de-proposition' });
    const proposed = row({ moves: 'eetttt', counting: true, dead_stones: 'ee', dead_proposed_by: W });
    expect(planAction(proposed, W, act('accept'))).toMatchObject({ ok: false, error: 'proposition-propre' });
    expect(planAction(proposed, B, act('accept'))).toEqual({
      ok: true, kind: 'finish', expect: { moves: 'eetttt', counting: true, dead_stones: 'ee' }, result: 'W+7.5', black: 0, white: 7.5
    });
  });

  it('reprend la partie : le comptage est annulé', () => {
    const proposed = row({ moves: 'eetttt', counting: true, dead_stones: 'ee', dead_proposed_by: W });
    expect(planAction(proposed, B, act('resume'))).toMatchObject({
      ok: true, patch: { counting: false, dead_stones: null, dead_proposed_by: null, resumed_at: 3 }
    });
  });
});

describe('copie des règles pour la fonction Deno', () => {
  it('est à jour (sinon : npm run sync:functions)', () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    for (const f of GO_FILES) {
      const src = readFileSync(`${root}${SRC_DIR}/${f}`, 'utf8');
      const out = readFileSync(`${root}${OUT_DIR}/${f}`, 'utf8');
      expect(out, f).toBe(toDeno(src));
      expect(out).not.toMatch(/from '\.\/[\w-]+'/);
    }
  });
});
