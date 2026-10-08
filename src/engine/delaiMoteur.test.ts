// #498 : un Worker du moteur qui ne répond plus (tué par iOS sans événement `error`, gelé après une mise en veille)
// ne bloque jamais la partie ni la revue : délai maximal, relance du Worker, un nouvel essai, puis le filet
// (coup de secours, comptage manuel, message « Réessayer »).
import { afterEach, describe, expect, it } from 'vitest';
import { newPosition, play, type Position } from '../go/rules';
import {
  _remplacerWorkersSimples, analyseRevue, bestMove, bestMoveExplique, estMoteurBloque, proposeComptage, reglerEchelleDelais,
  setKataGo, verifierMoteurs, type WorkerSimple,
} from './index';
import type { Demande, Reponse } from './simple.worker';
import { creerCanal } from './index';
import { delaiAnalyse, delaiTache, DelaiDepasse, facteurTaille, MoteurBloque, sousDelai } from './delais';
import { comptageDeSecours, coupDeSecours } from '../app/secoursOrdi';
import { KataGoClient, type WorkerLike } from './katago/client';
import type { KgRequest, KgResponse } from './katago/worker';
import type { Analysis } from './katago/search';

/** Faux Worker du moteur simple : `repondre` donne la réponse (ou `null` : silence, comme un Worker tué). */
function fauxWorker(repondre: (d: Demande) => Reponse | null, journal: { crees: number; termines: number; recus: Demande[] }): WorkerSimple {
  journal.crees++;
  const w: WorkerSimple = {
    onmessage: null, onerror: null,
    terminate() { journal.termines++; },
    postMessage(d) { journal.recus.push(d); const r = repondre(d); if (r) setTimeout(() => w.onmessage?.({ data: r } as MessageEvent<Reponse>), 0); },
  };
  return w;
}
const journalVide = () => ({ crees: 0, termines: 0, recus: [] as Demande[] });
const muet = () => null;

/** Échoue au lieu d'attendre indéfiniment. */
function auPlusTard<T>(p: Promise<T>, ms = 3000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('promesse jamais terminée')), ms))]);
}

function jouer(coups: number[]): Position {
  let p = newPosition(9);
  for (const m of coups) { const r = play(p, m); if (typeof r === 'string') throw new Error(r); p = r; }
  return p;
}

afterEach(() => {
  reglerEchelleDelais(1);
  _remplacerWorkersSimples();
  setKataGo(undefined);
});

describe('délais maximaux (#498)', () => {
  it('grandissent avec le budget et la taille du plateau, et restent généreux', () => {
    expect(facteurTaille(9)).toBe(1);
    expect(facteurTaille(13)).toBe(2);
    expect(facteurTaille(19)).toBe(4);
    // Pomme en 9 × 9 : bien plus que son budget de 150 ms (téléphone lent, démarrage du Worker).
    expect(delaiTache(150, 9)).toBeGreaterThanOrEqual(8000);
    expect(delaiTache(600, 19)).toBeGreaterThan(delaiTache(600, 13));
    expect(delaiTache(600, 13)).toBeGreaterThan(delaiTache(600, 9));
    // Sensei (200 visites, 1,8 s) : au moins deux fois son budget.
    expect(delaiAnalyse({ visits: 200, timeMs: 1800 }, 9)).toBeGreaterThan(2 * 1800);
    expect(delaiAnalyse({ visits: 200, timeMs: 1800 }, 19)).toBeGreaterThan(delaiAnalyse({ visits: 200, timeMs: 1800 }, 9));
  });
  it('sousDelai libère sa minuterie et rejette avec DelaiDepasse', async () => {
    await expect(sousDelai(new Promise(() => {}), 5)).rejects.toBeInstanceOf(DelaiDepasse);
    await expect(sousDelai(Promise.resolve(3), 5)).resolves.toBe(3);
  });
});

describe('canal du moteur simple : Worker qui ne répond plus (#498)', () => {
  it('délai dépassé : la demande échoue, le Worker est arrêté, rien ne reste en attente', async () => {
    const j = journalVide();
    const c = creerCanal(() => fauxWorker(muet, j));
    const q = c.envoyer({ kind: 'dead', pos: newPosition(9) }, 10);
    expect(c.enAttente()).toBe(1);
    await expect(q).rejects.toBeInstanceOf(DelaiDepasse);
    expect(c.enAttente()).toBe(0);
    expect(j.termines).toBe(1);
    // La demande suivante démarre un nouveau Worker.
    void c.envoyer({ kind: 'dead', pos: newPosition(9) }, 10)?.catch(() => {});
    expect(j.crees).toBe(2);
  });

  it('coup de l’ordi : délai, relance, nouvel essai, puis MoteurBloque et coup de secours', async () => {
    reglerEchelleDelais(0.001);
    const j = journalVide();
    _remplacerWorkersSimples(() => fauxWorker(muet, j));
    const pos = jouer([40]);
    const e = await auPlusTard(bestMoveExplique(pos, 'caillou').then(() => null, x => x));
    expect(estMoteurBloque(e)).toBe(true);
    // Un Worker, puis un second après la relance : deux essais de la même demande.
    expect(j.crees).toBe(2);
    expect(j.recus.filter(d => d.kind === 'move')).toHaveLength(2);
    // Le filet de l'écran (secoursOrdi.ts, #474) joue un coup légal : la partie continue.
    const secours = coupDeSecours(pos, e);
    expect(secours.move === -1 || typeof play(pos, secours.move) !== 'string').toBe(true);
    // Worker abandonné pour la session : le coup suivant est calculé sans lui, sans attendre.
    const m = await auPlusTard(bestMove(pos, 'caillou', { timeMs: 30 }));
    expect(m === -1 || typeof play(pos, m) !== 'string').toBe(true);
    expect(j.crees).toBe(2);
  });

  it('le Worker relancé répond : le coup arrive, sans filet', async () => {
    reglerEchelleDelais(0.001);
    const j = journalVide();
    _remplacerWorkersSimples(() => fauxWorker(j.crees === 0 ? muet : d => ({ id: d.id, move: 20 }), j));
    const c = await auPlusTard(bestMoveExplique(jouer([40]), 'caillou'));
    expect(c.move).toBe(20);
    expect(j.crees).toBe(2);
  });

  it('comptage : Worker muet, MoteurBloque, puis comptage manuel', async () => {
    reglerEchelleDelais(0.001);
    const j = journalVide();
    _remplacerWorkersSimples(() => fauxWorker(muet, j));
    const r = await auPlusTard(proposeComptage(jouer([40, 41]), 6.5).catch(e => {
      expect(e).toBeInstanceOf(MoteurBloque);
      return comptageDeSecours(e);
    }));
    expect(r).toMatchObject({ dead: [], incertains: [], secours: true });
  });

  it('retour au premier plan : un Worker qui ne répond plus au ping est relancé', async () => {
    reglerEchelleDelais(0.001);
    const j = journalVide();
    let vivant = true;
    _remplacerWorkersSimples(() => fauxWorker(d => (vivant ? { id: d.id, move: 3 } : null), j));
    setKataGo(null);
    // Rien n'a encore été demandé : pas de Worker à vérifier.
    expect(await verifierMoteurs()).toEqual({ coups: true, estimation: true, katago: true });
    await bestMoveExplique(jouer([40]), 'caillou');
    expect(await verifierMoteurs()).toMatchObject({ coups: true });
    vivant = false; // mise en veille : iOS a tué le Worker
    expect(await auPlusTard(verifierMoteurs())).toMatchObject({ coups: false });
    expect(j.termines).toBe(1);
    vivant = true;
    expect((await auPlusTard(bestMoveExplique(jouer([40]), 'caillou'))).move).toBe(3);
  });
});

/** Faux Worker KataGo : prêt au démarrage ; `analyse` répond (ou pas) aux analyses ; `ping` à la vérification. */
function fauxKataGo(o: { analyse?: (m: KgRequest) => KgResponse | null; ping?: boolean }, journal: { crees: number; termines: number }): WorkerLike {
  journal.crees++;
  const w: WorkerLike = {
    onmessage: null, onerror: null,
    terminate() { journal.termines++; },
    postMessage(m) {
      const r: KgResponse | null = m.type === 'init' ? { id: m.id, type: 'ready', backend: 'cpu', name: 'factice', ms: 1, fromCache: true }
        : m.type === 'ping' ? (o.ping === false ? null : { id: m.id, type: 'pong' })
        : m.type === 'analyze' ? (o.analyse?.(m) ?? null) : null;
      if (r) setTimeout(() => w.onmessage?.({ data: r } as MessageEvent<KgResponse>), 0);
    },
  };
  return w;
}
const analyseVide = (): Analysis => ({ moves: [], winrate: 0.5, lead: 0, ownership: new Float32Array(81), visits: 1, ms: 1, engine: 'factice' });

describe('client KataGo : analyses trop longues (#498)', () => {
  it('fuite : après N analyses abandonnées, aucune demande ne reste en attente', async () => {
    const j = { crees: 0, termines: 0 };
    const c = new KataGoClient({ timeoutMs: 5, makeWorker: () => fauxKataGo({}, j) });
    for (let i = 0; i < 25; i++) await expect(c.analyze(newPosition(9))).rejects.toThrow(/trop longue/);
    // Avant #498 : 25 entrées (et leurs promesses) gardées pour toujours.
    expect(c.enAttente).toBe(0);
  });

  it('bestMove : KataGo muet, relancé une fois, puis abandonné ; l’ordi joue avec le moteur simple', async () => {
    reglerEchelleDelais(0.001);
    _remplacerWorkersSimples(() => null);
    const j = { crees: 0, termines: 0 };
    const c = new KataGoClient({ makeWorker: () => fauxKataGo({}, j) });
    setKataGo(c);
    const m = await auPlusTard(bestMove(newPosition(9), 'tigre', { timeMs: 30, seed: 1 }));
    expect(m).toBeGreaterThanOrEqual(0);
    expect(j.crees).toBe(2);
    expect(c.info.state).toBe('indisponible');
    expect(c.enAttente).toBe(0);
    // Coup suivant : KataGo abandonné, le moteur simple répond tout de suite.
    expect(await auPlusTard(bestMove(newPosition(9), 'tigre', { timeMs: 30, seed: 2 }))).toBeGreaterThanOrEqual(0);
    expect(j.crees).toBe(2);
  });

  it('revue : KataGo bloqué, l’analyse lève MoteurBloque (message et « Réessayer » à l’écran)', async () => {
    reglerEchelleDelais(0.001);
    let relances = 0;
    setKataGo({ info: { state: 'pret' }, analyze: () => new Promise<Analysis>(() => {}), relancer: () => { relances++; } });
    await expect(auPlusTard(analyseRevue(newPosition(9), 6.5))).rejects.toBeInstanceOf(MoteurBloque);
    expect(relances).toBe(1);
  });

  it('vérification au retour : sans pong, le Worker est relancé, et l’analyse suivante en démarre un neuf', async () => {
    const j = { crees: 0, termines: 0 };
    let ping = true;
    const c = new KataGoClient({ makeWorker: () => fauxKataGo({ analyse: m => ({ id: m.id, type: 'analysis', analysis: analyseVide() }), ping }, j) });
    await c.analyze(newPosition(9));
    expect(await c.verifier(20)).toBe(true);
    ping = false;
    // Le Worker déjà créé garde son comportement : on en simule un gelé en recréant le client.
    const gele = new KataGoClient({ makeWorker: () => fauxKataGo({ analyse: m => ({ id: m.id, type: 'analysis', analysis: analyseVide() }), ping }, j) });
    await gele.analyze(newPosition(9));
    expect(await gele.verifier(10)).toBe(false);
    expect(gele.info.state).toBe('inactif');
    ping = true;
    const avant = j.crees;
    expect((await gele.analyze(newPosition(9))).engine).toBe('factice');
    expect(j.crees).toBe(avant + 1);
  });

  it('Worker tué pendant le démarrage : indisponible au lieu d’attendre pour toujours', async () => {
    const c = new KataGoClient({ delaiDemarrageMs: 10, initWaitMs: 1000, makeWorker: () => ({ onmessage: null, onerror: null, terminate() {}, postMessage() {} }) });
    await expect(auPlusTard(c.analyze(newPosition(9)))).rejects.toThrow(/démarrage/);
    expect(c.info.state).toBe('indisponible');
    expect(c.enAttente).toBe(0);
  });

  it('arrêt (dispose) : les demandes en cours se terminent', async () => {
    const c = new KataGoClient({ timeoutMs: 60_000, makeWorker: () => fauxKataGo({}, { crees: 0, termines: 0 }) });
    await c.start();
    const q = c.analyze(newPosition(9));
    await new Promise(r => setTimeout(r, 0));
    c.dispose();
    await expect(auPlusTard(q)).rejects.toThrow(/arrêté/);
    expect(c.enAttente).toBe(0);
  });
});
