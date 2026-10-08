// #474 : une erreur dans le moteur simple (sans Worker : repli sur le fil principal) doit rejeter la promesse.
// Avant : l'exception sortait du minuteur (erreur non attrapée, envoyée à Sentry sans contexte) et la promesse
// ne se terminait jamais. Contre l'ordi, la partie restait bloquée sur « réfléchit… ».
import { describe, expect, it } from 'vitest';
import type { Position } from '../go/rules';
import { bestMoveExplique, proposeComptage, proposeDead } from './index';

// Position abîmée (ex. état restauré d'une ancienne version) : le moteur lève une exception en la lisant.
const cassee = { size: 9, board: null, toPlay: 1, captures: [0, 0, 0], lastMove: -1, ko: -1 } as unknown as Position;

/** Échoue au lieu d'attendre indéfiniment. */
function auPlusTard<T>(p: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('promesse jamais terminée')), ms))]);
}

describe('moteur : les erreurs remontent à l’appelant (#474)', () => {
  it('coup de l’ordi', async () => {
    await expect(auPlusTard(bestMoveExplique(cassee, 'pomme'))).rejects.toThrow(TypeError);
  });
  it('pierres mortes', async () => {
    await expect(auPlusTard(proposeDead(cassee))).rejects.toThrow(TypeError);
  });
  it('comptage', async () => {
    await expect(auPlusTard(proposeComptage(cassee, 6.5))).rejects.toThrow(TypeError);
  });
});
