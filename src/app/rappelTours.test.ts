// « À toi de jouer » (issue #699), côté appareil : permission demandée seulement au geste, deux interrupteurs sur un même
// abonnement, désinscription en un geste. Navigateur et base simulés (environnement node).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activerRappel, activerTours, couperRappel, couperTours, etatRappel, noterRappel, RAPPEL_KEY } from './rappel';
import type { Db } from '../data/supabase';

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc';

function monde(permission: 'default' | 'granted' | 'denied' = 'default', reponse: 'granted' | 'denied' = 'granted') {
  const stock = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => stock.get(k) ?? null, setItem: (k: string, v: string) => void stock.set(k, v), removeItem: (k: string) => void stock.delete(k) });
  const etat = { permission, demandes: 0, abonne: false, desabonne: 0 };
  const abonnement = {
    endpoint: ENDPOINT,
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }),
    unsubscribe: async () => { etat.abonne = false; etat.desabonne++; return true; },
  };
  vi.stubGlobal('Notification', {
    get permission() { return etat.permission; },
    requestPermission: async () => { etat.demandes++; etat.permission = reponse; return reponse; },
  });
  vi.stubGlobal('navigator', {
    serviceWorker: { ready: Promise.resolve({ pushManager: {
      getSubscription: async () => (etat.abonne ? abonnement : null),
      subscribe: async () => { etat.abonne = true; return abonnement; },
    } }) },
  });
  const appels: { nom: string; args: Record<string, unknown> }[] = [];
  const supprimes: string[] = [];
  let echec = false;
  const db = {
    rpc: async (nom: string, args: Record<string, unknown>) => { appels.push({ nom, args }); return { data: 'id', error: echec ? { message: 'refus' } : null }; },
    from: () => ({ delete: () => ({ eq: async (_c: string, v: string) => { supprimes.push(v); return { error: null }; } }) }),
  } as unknown as Db;
  return { etat, db, appels, supprimes, stock, echouer: () => { echec = true; } };
}

beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('activer « à toi de jouer »', () => {
  it('demande la permission au geste, inscrit seulement l’interrupteur des tours, garde l’autre', async () => {
    const m = monde();
    expect(await activerTours(m.db, 'midi', 'fr')).toBe('ok');
    expect(m.etat.demandes).toBe(1);
    // Rappel du jour inchangé côté serveur (nul = garder), tours allumé.
    expect(m.appels).toHaveLength(1);
    expect(m.appels[0].args).toMatchObject({ p_endpoint: ENDPOINT, p_langue: 'fr', p_jour: null, p_tour: true });
    expect(etatRappel()).toMatchObject({ tours: true, actif: false });
  });

  it('permission refusée : rien d’inscrit, rien de noté', async () => {
    const m = monde('default', 'denied');
    expect(await activerTours(m.db, 'soir', 'fr')).toBe('refuse_navigateur');
    expect(m.appels).toHaveLength(0);
    expect(etatRappel().tours).toBe(false);
  });

  it('permission déjà accordée : pas de nouvelle fenêtre ; erreur du serveur : non noté', async () => {
    const m = monde('granted');
    m.echouer();
    expect(await activerTours(m.db, 'soir', 'en')).toBe('erreur');
    expect(m.etat.demandes).toBe(0);
    expect(etatRappel().tours).toBe(false);
  });

  it('allumer le rappel du jour ne touche pas aux tours', async () => {
    const m = monde();
    await activerRappel(m.db, 'matin', 'fr');
    expect(m.appels[0].args).toMatchObject({ p_jour: true, p_tour: null });
    expect(etatRappel()).toMatchObject({ actif: true, tours: false });
  });
});

describe('couper en un geste', () => {
  it('seul réglage allumé : l’abonnement est retiré du serveur et du navigateur', async () => {
    const m = monde('granted');
    await activerTours(m.db, 'soir', 'fr');
    m.appels.length = 0;
    expect(await couperTours(m.db, 'fr')).toBe('ok');
    expect(m.supprimes).toEqual([ENDPOINT]);
    expect(m.etat.desabonne).toBe(1);
    expect(m.appels).toHaveLength(0);
    expect(etatRappel().tours).toBe(false);
  });

  it('les deux allumés : couper l’un garde l’abonnement pour l’autre', async () => {
    const m = monde('granted');
    await activerRappel(m.db, 'soir', 'fr');
    await activerTours(m.db, 'soir', 'fr');
    m.appels.length = 0;
    expect(await couperTours(m.db, 'fr')).toBe('ok');
    expect(m.appels[0].args).toMatchObject({ p_jour: null, p_tour: false });
    expect(m.supprimes).toEqual([]);
    expect(m.etat.abonne).toBe(true);
    expect(etatRappel()).toMatchObject({ actif: true, tours: false });

    await activerTours(m.db, 'soir', 'fr');
    m.appels.length = 0;
    expect(await couperRappel(m.db, 'fr')).toBe('ok');
    expect(m.appels[0].args).toMatchObject({ p_jour: false, p_tour: null });
    expect(etatRappel()).toMatchObject({ actif: false, tours: true });
    expect(m.etat.abonne).toBe(true);
  });

  it('le serveur refuse de garder l’abonnement : il est retiré, et les deux réglages tombent (rien ne continue à partir)', async () => {
    const m = monde('granted');
    await activerRappel(m.db, 'soir', 'fr');
    await activerTours(m.db, 'soir', 'fr');
    m.echouer();
    await couperTours(m.db, 'fr');
    expect(m.supprimes).toEqual([ENDPOINT]);
    expect(m.etat.abonne).toBe(false);
    expect(etatRappel()).toMatchObject({ actif: false, tours: false });
  });

  it('état gardé sur l’appareil sous la clé du rappel', async () => {
    const m = monde('granted');
    noterRappel({ tours: true });
    expect(JSON.parse(m.stock.get(RAPPEL_KEY)!)).toMatchObject({ tours: true });
  });
});
