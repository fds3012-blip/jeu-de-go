// #474 : partie contre l'ordi, le moteur échoue. Reproduction : le moteur rejette (voir src/engine/erreursMoteur.test.ts) ;
// sans filet, Game.tsx ne recevait jamais de coup et la partie restait sur « réfléchit… ».
import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureError = vi.hoisted(() => vi.fn());
vi.mock('../data/analytics', () => ({ captureError }));

import { bestMoveExplique, proposeComptage } from '../engine';
import { newPosition, play, type Position } from '../go/rules';
import { comptageDeSecours, coupDeSecours } from './secoursOrdi';

const cassee = { size: 9, board: null, toPlay: 1, captures: [0, 0, 0], lastMove: -1, ko: -1 } as unknown as Position;

beforeEach(() => captureError.mockClear());

describe('coup de secours de l’ordi (#474)', () => {
  it('moteur en échec : la chaîne de Game.tsx donne quand même un coup, erreur signalée', async () => {
    const pos = newPosition(9);
    const boum = new TypeError('moteur');
    const coup = await Promise.reject<never>(boum).catch((e: unknown) => coupDeSecours(pos, e));
    expect(coup.move).toBeGreaterThanOrEqual(0);
    expect(typeof play(pos, coup.move)).not.toBe('string');
    expect(captureError).toHaveBeenCalledWith(boum, { categorie: 'rendu', origine: 'ordi' });
  });

  it('position illisible : le vrai moteur rejette, le filet fait passer l’ordi', async () => {
    const coup = await bestMoveExplique(cassee, 'pomme').catch((e: unknown) => coupDeSecours(cassee, e));
    expect(coup).toEqual({ move: -1, raison: null });
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it('coup de secours illégal : l’ordi passe', () => {
    const pos = play(newPosition(9), 40);
    if (typeof pos === 'string') throw new Error(pos);
    expect(coupDeSecours(pos, new Error('x'), () => ({ move: 40, raison: null }))).toEqual({ move: -1, raison: null });
  });
});

describe('comptage de secours (#474)', () => {
  it('comptage en échec : rien de proposé, comptage manuel forcé, erreur signalée', async () => {
    const r = await proposeComptage(cassee, 6.5).catch((e: unknown) => comptageDeSecours(e));
    expect(r).toEqual({ dead: [], incertains: [], secours: true });
    expect(captureError).toHaveBeenCalledWith(expect.any(TypeError), { categorie: 'rendu', origine: 'comptage' });
  });
});
