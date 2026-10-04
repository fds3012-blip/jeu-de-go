// Issue #424 : la revue d'une partie entre amis se faisait sans KataGo. `preparerKataGo` ne prenait KataGo que
// s'il était déjà en mémoire ou en cache : une partie entre amis (ou contre Pomme et Caillou) ne l'avait jamais
// chargé. Désormais la revue le charge (téléchargement une seule fois), et dit pourquoi s'il ne peut pas servir.
// Et le moteur simple de secours n'estime plus +73,5 points après le premier coup.
import { afterEach, describe, expect, it } from 'vitest';
import { fromLabel } from '../go/coords';
import { newPosition, play, type Position } from '../go/rules';
import { avanceEstimee } from '../go/estimation';
import { positionsDepuisSgf } from '../app/revue';
import { SGF_424 } from '../app/partie424.fixture';
import { ownership, zones } from './dead';
import { preparerKataGo, raisonSansKataGo, setKataGo, type KataGoBackend } from './index';
import type { KataGoInfo } from './katago/client';

/** Faux KataGo : `start` réussit, échoue avec `erreur`, ou ne finit jamais. */
function faux(start: 'ok' | 'jamais' | string): KataGoBackend & { appels: number } {
  const k = {
    appels: 0,
    info: { state: 'inactif' } as KataGoInfo,
    analyze: async () => { throw new Error('pas utilisé'); },
    start: () => {
      k.appels++;
      if (start === 'jamais') return new Promise<void>(() => {});
      if (start === 'ok') { k.info = { state: 'pret', backend: 'webgl' }; return Promise.resolve(); }
      k.info = { state: 'indisponible', error: start };
      return Promise.reject(new Error(start));
    },
  };
  return k;
}

describe('preparerKataGo pour la revue (#424)', () => {
  afterEach(() => setKataGo(undefined));

  it('charge KataGo même s’il n’a jamais servi (réseau absent du cache) : plus de repli silencieux', async () => {
    const k = faux('ok');
    setKataGo(k);
    expect(await preparerKataGo()).toEqual({ pret: true });
    expect(k.appels).toBe(1);
  });

  it('déjà prêt : rien à charger', async () => {
    const k = faux('ok');
    k.info = { state: 'pret' };
    setKataGo(k);
    expect(await preparerKataGo()).toEqual({ pret: true });
    expect(k.appels).toBe(0);
  });

  it('téléchargement impossible : raison « reseau »', async () => {
    setKataGo(faux('Téléchargement du réseau impossible (404)'));
    expect(await preparerKataGo()).toEqual({ pret: false, raison: 'reseau' });
  });

  it('aucun backend (WebGPU, WebGL et CPU refusés) : raison « appareil »', async () => {
    setKataGo(faux('KataGo ne démarre sur aucun backend (webgl: shader ; cpu: mémoire)'));
    expect(await preparerKataGo()).toEqual({ pret: false, raison: 'appareil' });
  });

  it('chargement trop long : raison « delai », sans bloquer la revue', async () => {
    setKataGo(faux('jamais'));
    const t0 = Date.now();
    expect(await preparerKataGo(50)).toEqual({ pret: false, raison: 'delai' });
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('raisons lues dans les messages réels du chargement', () => {
    expect(raisonSansKataGo('Failed to fetch')).toBe('reseau');
    expect(raisonSansKataGo('Load failed')).toBe('reseau'); // Safari
    expect(raisonSansKataGo('KataGo pas encore prêt')).toBe('delai');
    expect(raisonSansKataGo('worker: SyntaxError')).toBe('appareil');
    expect(raisonSansKataGo('Aucun backend TensorFlow.js utilisable (webgpu: absent ; webgl: refusé ; cpu: refusé)')).toBe('appareil');
    expect(raisonSansKataGo(undefined)).toBe('appareil');
  });
});

describe('moteur simple, mode estimation (#424)', () => {
  const jouer = (coups: string[]): Position => coups.reduce<Position>((p, c) => {
    const r = play(p, fromLabel(c, 9));
    if (typeof r === 'string') throw new Error(r);
    return r;
  }, newPosition(9));
  const estime = (p: Position, estimation: boolean) => avanceEstimee(p, ownership(p, { playouts: 600, timeMs: 1e9, estimation }), 6.5);

  it('après le premier coup, la partie est encore égale : pas tout le plateau à Noir', () => {
    const p = jouer(['C3']);
    expect(estime(p, false)).toBeGreaterThan(60); // l'ancien défaut : un « territoire » de 80 cases
    expect(Math.abs(estime(p, true))).toBeLessThan(10);
  });

  it('partie de l’issue : après B8 et J8, plus de −88 ; une zone ouverte de 51 cases n’est le territoire de personne', () => {
    const { positions } = positionsDepuisSgf(SGF_424);
    for (const k of [27, 28, 36]) {
      expect(Math.abs(estime(positions[k], false)), `ancien, position ${k}`).toBeGreaterThan(60);
      expect(Math.abs(estime(positions[k], true)), `estimation, position ${k}`).toBeLessThan(35);
    }
    // Les règles de territoire restent intactes pour le comptage final (mode par défaut).
    const z = zones(positions[27]);
    expect([...z].filter(m => m === 2).length).toBeGreaterThan(40);
    expect([...zones(positions[27], true)].filter(m => m === 2).length).toBe(0);
  });
});
