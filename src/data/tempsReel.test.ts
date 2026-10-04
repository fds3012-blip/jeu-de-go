import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from './supabase';
import { fusionnerPartie, suivreLignes } from './tempsReel';

// #425 : le suivi temps réel d'une partie. Le client Supabase est simulé : chaque canal garde ses liaisons
// `postgres_changes` et la fonction passée à `subscribe`, que le test appelle (SUBSCRIBED, CHANNEL_ERROR…).

interface FauxCanal {
  sujet: string;
  state: string;
  liaisons: { filtre: { table: string; filter: string; event: string }; cb: (p: { new: Record<string, unknown> }) => void }[];
  etat?: (s: string) => void;
  on: (type: string, filtre: { table: string; filter: string; event: string }, cb: (p: { new: Record<string, unknown> }) => void) => FauxCanal;
  subscribe: (cb: (s: string) => void) => FauxCanal;
}

function fauxDb() {
  const canaux: FauxCanal[] = [];
  let connecte = true;
  const realtime = {
    isConnected: vi.fn(() => connecte),
    connect: vi.fn(() => { connecte = true; }),
    disconnect: vi.fn(async () => { connecte = false; return 'ok'; }),
  };
  const channel = vi.fn((sujet: string) => {
    const c: FauxCanal = {
      sujet, state: 'closed', liaisons: [],
      on: (_t, filtre, cb) => { c.liaisons.push({ filtre, cb }); return c; },
      subscribe: cb => { c.etat = s => { if (s === 'SUBSCRIBED') c.state = 'joined'; cb(s); }; c.state = 'joining'; return c; },
    };
    canaux.push(c);
    return c;
  });
  const removeChannel = vi.fn(async (c: FauxCanal) => { c.state = 'closed'; return 'ok'; });
  const db = { channel, removeChannel, realtime } as unknown as Db;
  return { db, canaux, channel, removeChannel, realtime, couper: () => { connecte = false; } };
}

/** `window` et `document` minimaux (Vitest tourne sous Node) : visibilité réglable, événements. */
function page() {
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as 'visible' | 'hidden' });
  const win = new EventTarget();
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', win);
  return {
    cacher: () => { doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); },
    montrer: () => { doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')); },
    enLigne: () => win.dispatchEvent(new Event('online')),
  };
}

const ID = '11111111-1111-4111-8111-111111111111';

describe('suivreLignes', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('donne la ligne reçue tout de suite, sans relire ; relit à la confirmation de l’abonnement', () => {
    page();
    const f = fauxDb();
    const surLigne = vi.fn();
    const rattraper = vi.fn();
    const arreter = suivreLignes(f.db, `defi-${ID}`, [{ table: 'games', filtre: `id=eq.${ID}`, surLigne }], { rattraper });
    const c = f.canaux[0];
    expect(c.liaisons[0].filtre).toMatchObject({ event: 'UPDATE', table: 'games', filter: `id=eq.${ID}` });
    c.etat!('SUBSCRIBED');
    expect(rattraper).toHaveBeenCalledTimes(1);
    c.liaisons[0].cb({ new: { id: ID, moves: 'eecc' } });
    expect(surLigne).toHaveBeenCalledWith({ id: ID, moves: 'eecc' });
    // Aucune attente : ni minuterie, ni relecture de plus.
    expect(rattraper).toHaveBeenCalledTimes(1);
    arreter();
    expect(f.removeChannel).toHaveBeenCalledWith(c);
    c.liaisons[0].cb({ new: { id: ID, moves: 'eeccdd' } });
    expect(surLigne).toHaveBeenCalledTimes(1);
  });

  it('un sujet de canal neuf à chaque abonnement (le même nom rendrait le canal en cours de fermeture)', () => {
    page();
    const f = fauxDb();
    const a = suivreLignes(f.db, `defi-${ID}`, [], { rattraper: vi.fn() });
    a();
    const b = suivreLignes(f.db, `defi-${ID}`, [], { rattraper: vi.fn() });
    b();
    expect(f.canaux[0].sujet).not.toBe(f.canaux[1].sujet);
    expect(f.canaux.every(c => c.sujet.startsWith(`defi-${ID}-`))).toBe(true);
  });

  it('erreur, délai dépassé ou fermeture : nouvel abonnement après 1 s, puis 2 s', () => {
    page();
    const f = fauxDb();
    const rattraper = vi.fn();
    const arreter = suivreLignes(f.db, 'direct-x', [], { rattraper });
    f.canaux[0].etat!('CHANNEL_ERROR');
    expect(f.removeChannel).toHaveBeenCalledWith(f.canaux[0]);
    vi.advanceTimersByTime(999);
    expect(f.canaux).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(f.canaux).toHaveLength(2);
    f.canaux[1].etat!('TIMED_OUT');
    vi.advanceTimersByTime(2000);
    expect(f.canaux).toHaveLength(3);
    f.canaux[2].etat!('SUBSCRIBED');
    expect(rattraper).toHaveBeenCalledTimes(1);
    // Un ancien canal qui parle encore est ignoré.
    f.canaux[0].etat!('SUBSCRIBED');
    expect(rattraper).toHaveBeenCalledTimes(1);
    arreter();
  });

  it('retour au premier plan (iOS) : relecture immédiate, puis nouvel abonnement', () => {
    const p = page();
    const f = fauxDb();
    const rattraper = vi.fn();
    const arreter = suivreLignes(f.db, 'defi-x', [], { rattraper });
    f.canaux[0].etat!('SUBSCRIBED');
    rattraper.mockClear();
    p.cacher();
    vi.advanceTimersByTime(30_000);
    f.couper(); // la connexion est morte pendant la veille
    p.montrer();
    expect(rattraper).toHaveBeenCalledTimes(1);
    expect(f.realtime.connect).toHaveBeenCalled();
    expect(f.canaux).toHaveLength(2);
    expect(f.removeChannel).toHaveBeenCalledWith(f.canaux[0]);
    f.canaux[1].etat!('SUBSCRIBED');
    expect(rattraper).toHaveBeenCalledTimes(2);
    arreter();
  });

  it('un bref passage en arrière-plan avec un canal en place : relecture seule', () => {
    const p = page();
    const f = fauxDb();
    const rattraper = vi.fn();
    const arreter = suivreLignes(f.db, 'defi-x', [], { rattraper });
    f.canaux[0].etat!('SUBSCRIBED');
    rattraper.mockClear();
    p.cacher();
    vi.advanceTimersByTime(200);
    p.montrer();
    expect(rattraper).toHaveBeenCalledTimes(1);
    expect(f.canaux).toHaveLength(1);
    arreter();
  });

  it('retour du réseau : relecture et nouvel abonnement', () => {
    const p = page();
    const f = fauxDb();
    const rattraper = vi.fn();
    const arreter = suivreLignes(f.db, 'defi-x', [], { rattraper });
    f.canaux[0].etat!('SUBSCRIBED');
    rattraper.mockClear();
    p.enLigne();
    expect(rattraper).toHaveBeenCalledTimes(1);
    expect(f.canaux).toHaveLength(2);
    arreter();
  });

  it('connexion à demi ouverte : sans confirmation en 3 s, la connexion est refaite', async () => {
    page();
    const f = fauxDb();
    const arreter = suivreLignes(f.db, 'defi-x', [], { rattraper: vi.fn() });
    await vi.advanceTimersByTimeAsync(2999);
    expect(f.realtime.disconnect).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(f.realtime.disconnect).toHaveBeenCalledTimes(1);
    expect(f.realtime.connect).toHaveBeenCalledTimes(1);
    expect(f.canaux).toHaveLength(2);
    // Réseau lent : la garde suivante attend deux fois plus longtemps.
    await vi.advanceTimersByTimeAsync(5999);
    expect(f.realtime.disconnect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.realtime.disconnect).toHaveBeenCalledTimes(2);
    arreter();
  });

  it('arrêté : plus d’écoute de la page ni de nouvel abonnement', () => {
    const p = page();
    const f = fauxDb();
    const rattraper = vi.fn();
    const arreter = suivreLignes(f.db, 'defi-x', [], { rattraper });
    arreter();
    p.cacher();
    vi.advanceTimersByTime(10_000);
    p.montrer();
    p.enLigne();
    expect(rattraper).not.toHaveBeenCalled();
    expect(f.canaux).toHaveLength(1);
    expect(f.realtime.disconnect).not.toHaveBeenCalled();
  });
});

describe('fusionnerPartie', () => {
  const partie = { id: ID, moves: 'ee', counting: false, status: 'active', result: null, analysis: { a: 1 } };

  it('reprend les colonnes connues et bien typées de la ligne reçue', () => {
    expect(fusionnerPartie(partie, { id: ID, moves: 'eecc', counting: false, status: 'active', result: null }))
      .toEqual({ ...partie, moves: 'eecc' });
    expect(fusionnerPartie(partie, { moves: 'eecctttt', counting: true, dead_stones: 'cc' }))
      .toEqual({ ...partie, moves: 'eecctttt', counting: true, dead_stones: 'cc' });
  });

  it('garde ce qui manque ou est mal formé (grande colonne inchangée absente de l’événement)', () => {
    expect(fusionnerPartie(partie, { moves: 'eecc', status: 42, analysis: 'x', inconnue: 1 })).toEqual({ ...partie, moves: 'eecc' });
  });

  it('ignore une ligne plus ancienne que l’affichage (coup affiché d’avance chez qui joue)', () => {
    expect(fusionnerPartie({ ...partie, moves: 'eecc' }, { moves: 'ee' })).toBeNull();
  });
});
