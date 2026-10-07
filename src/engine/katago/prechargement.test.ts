// #475 : réseau servi depuis l'app avec repli, progression, préchargement discret, backend mémorisé.
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newPosition } from '../../go/rules';
import { _reinitialiserPrechargement, modelUrls, prechargerApresPartie, setKataGo, type KataGoBackend } from '../index';
import { progressionAffichee } from '../../app/progressionKataGo';
import { KataGoClient, type KataGoInfo, type WorkerLike } from './client';
import { fakeNetBytes } from './fakeNet';
import { CACHE_NAME, DEFAULT_MODEL_URL, LEGACY_MODEL_URL, loadModelBytes, MODEL_FILE, MODEL_OCTETS, MODEL_OCTETS_DECOMPRESSE, MODEL_SHA256, MODEL_SHA256_DECOMPRESSE, ordreBackends } from './loader';
import { decisionPrechargement, ecrireMemo, formatMo, lireMemo, MEMO_DUREE_MS, PARTIES_MIN_PRECHARGEMENT, type ContextePrechargement } from './prechargement';
import type { KgRequest, KgResponse } from './worker';

const VERSIONNE = fileURLToPath(new URL(`../../../public/reseaux/${MODEL_FILE}`, import.meta.url));

describe('réseau servi par l’app (#475)', () => {
  it('le fichier versionné est bien le réseau g170 publié par KataGo : empreinte et taille', () => {
    const b = readFileSync(VERSIONNE);
    expect(statSync(VERSIONNE).size).toBe(MODEL_OCTETS);
    expect(createHash('sha256').update(b).digest('hex')).toBe(MODEL_SHA256);
    expect(b[0] === 0x1f && b[1] === 0x8b).toBe(true);
    // Forme décompressée en route (serveur qui ajoute `Content-Encoding: gzip`) : empreinte et taille connues aussi.
    const brut = gunzipSync(b);
    expect(brut.length).toBe(MODEL_OCTETS_DECOMPRESSE);
    expect(createHash('sha256').update(brut).digest('hex')).toBe(MODEL_SHA256_DECOMPRESSE);
  });
  it('nom avec empreinte, servi depuis /reseaux/, repli sur la copie du dépôt KataGo', () => {
    expect(MODEL_FILE).toBe('g170-b6c96-s175395328-d26788732.f5d32604.bin.gz');
    expect(DEFAULT_MODEL_URL).toBe(`/reseaux/${MODEL_FILE}`);
    const urls = modelUrls();
    expect(urls).toHaveLength(2);
    expect(new URL(urls[0]).pathname).toBe(DEFAULT_MODEL_URL);
    expect(urls[1]).toBe(LEGACY_MODEL_URL);
  });
  it('vercel.json : cache d’un an, immuable, pour /reseaux/*.bin.gz', () => {
    const v = JSON.parse(readFileSync(fileURLToPath(new URL('../../../vercel.json', import.meta.url)), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
    const r = v.headers.find(h => h.source.startsWith('/reseaux/'));
    expect(r).toBeDefined();
    expect(new RegExp(`^${r!.source.replace('(.*)', '.*')}$`).test(DEFAULT_MODEL_URL)).toBe(true);
    expect(r!.headers).toContainEqual({ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' });
  });
});

/** Faux Cache API (une seule boîte). */
function fauxCaches(initial: Record<string, Uint8Array> = {}) {
  const store = new Map<string, Uint8Array>(Object.entries(initial));
  const cache = {
    async match(u: string) { const b = store.get(u); return b ? new Response(b as BlobPart) : undefined; },
    async put(u: string, r: Response) { store.set(u, new Uint8Array(await r.arrayBuffer())); },
  } as unknown as Cache;
  return { store, caches: { open: async (n: string) => { expect(n).toBe(CACHE_NAME); return cache; } } };
}

/** Réponse lue en plusieurs morceaux, comme un vrai téléchargement. */
function enMorceaux(b: Uint8Array, taille = 1000, longueur = true): Response {
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(c) { if (i >= b.length) { c.close(); return; } c.enqueue(b.slice(i, i + taille)); i += taille; },
  });
  return new Response(body, { headers: longueur ? { 'content-length': String(b.length) } : {} });
}

const hex = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

describe('téléchargement du réseau : repli, progression, empreinte', () => {
  const net = fakeNetBytes();
  const A = 'https://mochi-go.app/reseaux/n.bin.gz', B = 'https://raw.githubusercontent.com/n.bin.gz';

  it('notre copie répond : une seule requête, rangée sous notre adresse', async () => {
    const c = fauxCaches(), vus: string[] = [];
    const r = await loadModelBytes([A, B], { fetch: async u => { vus.push(u); return new Response(net as BlobPart); }, caches: c.caches });
    expect(vus).toEqual([A]);
    expect(r).toMatchObject({ fromCache: false, url: A });
    expect([...c.store.keys()]).toEqual([A]);
  });

  it('notre copie échoue (404, coupure) : repli sur l’ancienne adresse, rangé sous la nôtre', async () => {
    for (const panne of [async () => new Response('x', { status: 404 }), async () => { throw new TypeError('Failed to fetch'); }]) {
      const c = fauxCaches(), vus: string[] = [];
      const r = await loadModelBytes([A, B], { fetch: async u => { vus.push(u); return u === A ? panne() : new Response(net as BlobPart); }, caches: c.caches });
      expect(vus).toEqual([A, B]);
      expect(r.url).toBe(B);
      expect(c.store.has(A)).toBe(true);
    }
  });

  it('les deux échouent : erreur « Téléchargement… impossible » qui nomme chaque adresse (raison « reseau »)', async () => {
    const p = loadModelBytes([A, B], { fetch: async u => new Response('x', { status: u === A ? 503 : 404 }) });
    await expect(p).rejects.toThrow(/^Téléchargement du réseau impossible .*503.*404/);
  });

  it('ancienne copie déjà en cache (avant #475) : rien n’est téléchargé', async () => {
    const c = fauxCaches({ [B]: net });
    const fetch = vi.fn();
    const r = await loadModelBytes([A, B], { fetch, caches: c.caches });
    expect(fetch).not.toHaveBeenCalled();
    expect(r).toMatchObject({ fromCache: true, url: B });
  });

  it('empreinte vérifiée : un fichier différent (portail captif, copie abîmée) est refusé, l’adresse suivante essayée', async () => {
    const autre = fakeNetBytes(7);
    const r = await loadModelBytes([A, B], { fetch: async u => new Response((u === A ? autre : net) as BlobPart), sha256: hex(net), digest: async b => hex(b) });
    expect(r.url).toBe(B);
    await expect(loadModelBytes([A], { fetch: async () => new Response(autre as BlobPart), sha256: hex(net), digest: async b => hex(b) })).rejects.toThrow(/empreinte/);
  });

  it('fichier décompressé en route (Content-Encoding: gzip) : accepté par sa seconde empreinte, progression juste', async () => {
    const brut = fakeNetBytes(3);
    const vus: [number, number][] = [];
    const res = () => {
      const r = enMorceaux(brut, 500);
      return new Response(r.body, { headers: { 'content-length': '10', 'content-encoding': 'gzip' } });
    };
    const ok = await loadModelBytes([A], { fetch: async () => res(), sha256: [hex(net), hex(brut)], digest: async b => hex(b), onProgress: (a, t) => vus.push([a, t]), totalDecompresse: brut.length });
    expect(ok.bytes).toEqual(brut);
    expect(vus[1]).toEqual([500, brut.length]);
  });

  it('sans crypto.subtle (page non sécurisée) : pas de vérification, le fichier est accepté', async () => {
    const r = await loadModelBytes([A], { fetch: async () => new Response(net as BlobPart), sha256: 'autre', digest: async () => null });
    expect(r.url).toBe(A);
  });

  it('progression : de 0 à la taille, croissante, avec ou sans Content-Length', async () => {
    for (const longueur of [true, false]) {
      const vus: [number, number][] = [];
      const r = await loadModelBytes([A], { fetch: async () => enMorceaux(net, 1000, longueur), onProgress: (a, t) => vus.push([a, t]), totalParDefaut: longueur ? 0 : 2000 });
      expect(r.bytes).toEqual(net);
      expect(vus[0][0]).toBe(0);
      expect(vus.at(-1)).toEqual([net.length, net.length]);
      for (let i = 1; i < vus.length; i++) {
        expect(vus[i][0]).toBeGreaterThanOrEqual(vus[i - 1][0]);
        expect(vus[i][0]).toBeLessThanOrEqual(vus[i][1]);
      }
    }
  });

  it('téléchargement non permis (build de test) : le cache seulement', async () => {
    const fetch = vi.fn();
    await expect(loadModelBytes([A], { fetch, telechargement: false, caches: fauxCaches().caches })).rejects.toThrow(/Téléchargement.*non autorisé/);
    expect(fetch).not.toHaveBeenCalled();
    expect((await loadModelBytes([A], { fetch, telechargement: false, caches: fauxCaches({ [A]: net }).caches })).fromCache).toBe(true);
  });

  it('interrompu (aucun backend) : pas de repli, erreur d’interruption', async () => {
    const ctrl = new AbortController();
    const vus: string[] = [];
    const p = loadModelBytes([A, B], { signal: ctrl.signal, fetch: async u => { vus.push(u); ctrl.abort(); throw new DOMException('aborted', 'AbortError'); } });
    await expect(p).rejects.toThrow(/interrompu/);
    expect(vus).toEqual([A]);
  });
});

describe('préchargement après la partie : règle des données mobiles', () => {
  const base: ContextePrechargement = { partiesLancees: 3, connexion: null, enCache: false, etat: 'inactif', visible: true };
  it('permis à partir de la 2e partie, si le navigateur ne dit rien de la connexion (Safari, Firefox)', () => {
    expect(decisionPrechargement(base)).toEqual({ ok: true });
    expect(decisionPrechargement({ ...base, partiesLancees: PARTIES_MIN_PRECHARGEMENT })).toEqual({ ok: true });
  });
  it('jamais au premier lancement (première partie)', () => {
    expect(decisionPrechargement({ ...base, partiesLancees: 1 })).toEqual({ ok: false, raison: 'premier-lancement' });
    expect(decisionPrechargement({ ...base, partiesLancees: 0 })).toEqual({ ok: false, raison: 'premier-lancement' });
  });
  it('Wi-Fi ou connexion inconnue : oui ; données mobiles, économie de données, 2g : non', () => {
    expect(decisionPrechargement({ ...base, connexion: { type: 'wifi', effectiveType: '4g' } })).toEqual({ ok: true });
    expect(decisionPrechargement({ ...base, connexion: { effectiveType: '4g' } })).toEqual({ ok: true });
    expect(decisionPrechargement({ ...base, connexion: { type: 'cellular', effectiveType: '4g' } })).toEqual({ ok: false, raison: 'reseau-mobile' });
    expect(decisionPrechargement({ ...base, connexion: { type: 'wifi', saveData: true } })).toEqual({ ok: false, raison: 'economie-donnees' });
    expect(decisionPrechargement({ ...base, connexion: { effectiveType: 'slow-2g' } })).toEqual({ ok: false, raison: 'connexion-lente' });
  });
  it('rien à faire : déjà en cache, KataGo déjà en route, ou page cachée', () => {
    expect(decisionPrechargement({ ...base, enCache: true })).toEqual({ ok: false, raison: 'deja-en-cache' });
    expect(decisionPrechargement({ ...base, etat: 'pret' })).toEqual({ ok: false, raison: 'deja-en-route' });
    expect(decisionPrechargement({ ...base, etat: 'chargement' })).toEqual({ ok: false, raison: 'deja-en-route' });
    expect(decisionPrechargement({ ...base, visible: false })).toEqual({ ok: false, raison: 'arriere-plan' });
  });
});

describe('prechargerApresPartie (moteur)', () => {
  afterEach(() => { setKataGo(undefined); _reinitialiserPrechargement(); vi.unstubAllGlobals(); });
  function faux(): KataGoBackend & { precharges: number } {
    const k = { precharges: 0, info: { state: 'inactif' } as KataGoInfo, analyze: async () => { throw new Error('non'); }, precharger: async () => { k.precharges++; return true; } };
    return k;
  }
  it('2e partie, connexion inconnue : précharge une fois, pas deux dans la même session', async () => {
    const k = faux();
    setKataGo(k);
    expect(await prechargerApresPartie(2, 0)).toEqual({ ok: true });
    expect(k.precharges).toBe(1);
    expect(await prechargerApresPartie(3, 0)).toMatchObject({ ok: false });
    expect(k.precharges).toBe(1);
  });
  it('première partie ou données mobiles : rien n’est téléchargé', async () => {
    const k = faux();
    setKataGo(k);
    expect(await prechargerApresPartie(1, 0)).toEqual({ ok: false, raison: 'premier-lancement' });
    _reinitialiserPrechargement();
    vi.stubGlobal('navigator', { connection: { type: 'cellular', effectiveType: '4g' }, userAgent: 'test' });
    expect(await prechargerApresPartie(5, 0)).toEqual({ ok: false, raison: 'reseau-mobile' });
    expect(k.precharges).toBe(0);
  });
});

describe('backend mémorisé', () => {
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)';
  it('relu tel quel tant que le navigateur est le même et qu’il a moins de 30 jours', () => {
    const t = 1_800_000_000_000;
    const s = ecrireMemo('webgl', ua, t);
    expect(lireMemo(s, ua, t + 1000)).toBe('webgl');
    expect(lireMemo(s, ua + ' nouveau', t + 1000)).toBeNull();
    expect(lireMemo(s, ua, t + MEMO_DUREE_MS + 1)).toBeNull();
    expect(lireMemo('{"backend":"tpu","ua":"x","date":1}', 'x', 2)).toBeNull();
    expect(lireMemo('pas du json', ua, t)).toBeNull();
    expect(lireMemo(null, ua, t)).toBeNull();
  });
  it('ordre des backends : le mémorisé d’abord, puis les autres dans l’ordre habituel', () => {
    expect(ordreBackends(null)).toEqual(['webgpu', 'webgl', 'cpu']);
    expect(ordreBackends('webgl')).toEqual(['webgl', 'webgpu', 'cpu']);
    expect(ordreBackends('cpu')).toEqual(['cpu', 'webgpu', 'webgl']);
  });
});

describe('client : progression, préchargement, mémoire du backend', () => {
  const analysis = { moves: [], winrate: 0.5, lead: 0, ownership: new Float32Array(81), visits: 1, ms: 1, engine: 'x' };
  /** Faux Worker : `repondre` renvoie la liste des messages à envoyer pour chaque requête. */
  function fauxWorker(repondre: (m: KgRequest) => KgResponse[], recus: KgRequest[] = []): WorkerLike {
    const w: WorkerLike = {
      onmessage: null, onerror: null, terminate() {},
      postMessage(m) { recus.push(m); for (const r of repondre(m)) setTimeout(() => w.onmessage?.({ data: r } as MessageEvent<KgResponse>), 0); },
    };
    return w;
  }
  function memo(initial: 'webgpu' | 'webgl' | 'cpu' | null) {
    const m = { val: initial, lire: () => m.val, ecrire: (b: typeof initial) => { m.val = b; } };
    return m;
  }

  it('la progression du téléchargement arrive aux abonnés, puis disparaît une fois prêt', async () => {
    const vus: KataGoInfo[] = [];
    const c = new KataGoClient({ makeWorker: () => fauxWorker(m => m.type === 'init'
      ? [{ id: m.id, type: 'progress', recu: 2_100_000, total: 3_827_339 }, { id: m.id, type: 'ready', backend: 'webgl', name: 'g170', ms: 5, fromCache: false }]
      : [{ id: m.id, type: 'analysis', analysis }]) });
    c.ecouter(i => vus.push(i));
    await c.analyze(newPosition(9));
    const enCours = vus.find(i => i.progression);
    expect(enCours).toMatchObject({ state: 'chargement', progression: { recu: 2_100_000, total: 3_827_339 } });
    expect(progressionAffichee(enCours!, 'fr')).toEqual({ recu: '2,1', total: '3,8' });
    expect(progressionAffichee(enCours!, 'en')).toEqual({ recu: '2.1', total: '3.8' });
    expect(c.info.progression).toBeUndefined();
    expect(progressionAffichee(c.info)).toBeNull();
  });

  it('envoie les adresses, l’empreinte et le droit de télécharger au Worker', async () => {
    const recus: KgRequest[] = [];
    const c = new KataGoClient({ urls: ['a', 'b'], sha256: 'abc', telechargement: () => false,
      makeWorker: () => fauxWorker(m => [{ id: m.id, type: 'ready', backend: 'cpu', name: 'g', ms: 1, fromCache: true }], recus) });
    await c.start();
    expect(recus[0]).toMatchObject({ type: 'init', urls: ['a', 'b'], sha256: 'abc', telechargement: false });
  });

  it('préchargement : réseau mis en cache sans démarrer KataGo, puis le démarrage réutilise le même Worker', async () => {
    const recus: KgRequest[] = [];
    let crees = 0;
    const c = new KataGoClient({ makeWorker: () => { crees++; return fauxWorker(m => m.type === 'precharger'
      ? [{ id: m.id, type: 'progress', recu: 10, total: 100 }, { id: m.id, type: 'precharge', fromCache: false, ms: 3 }]
      : [{ id: m.id, type: 'ready', backend: 'webgl', name: 'g', ms: 1, fromCache: true }], recus); } });
    expect(await c.precharger()).toBe(true);
    expect(c.info).toMatchObject({ state: 'inactif', prechargement: 'fait' });
    expect(c.info.progression).toBeUndefined();
    await c.start();
    expect(crees).toBe(1);
    expect(recus.map(m => m.type)).toEqual(['precharger', 'init']);
    expect(c.info.state).toBe('pret');
  });

  it('backend mémorisé : essayé d’abord, écrit après un succès, effacé si le démarrage échoue sur l’appareil', async () => {
    const recus: KgRequest[] = [];
    const m = memo('webgl');
    const c = new KataGoClient({ memo: m, makeWorker: () => fauxWorker(r => [{ id: r.id, type: 'ready', backend: 'cpu', name: 'g', ms: 1, fromCache: true }], recus) });
    await c.start();
    expect(recus[0]).toMatchObject({ type: 'init', backends: ['webgl', 'webgpu', 'cpu'] });
    expect(m.val).toBe('cpu');

    const m2 = memo('webgpu');
    const c2 = new KataGoClient({ memo: m2, makeWorker: () => fauxWorker(r => [{ id: r.id, type: 'error', error: 'KataGo ne démarre sur aucun backend' }]) });
    await expect(c2.start()).rejects.toThrow();
    expect(m2.val).toBeNull();

    // Un échec de téléchargement ne dit rien du backend : il reste mémorisé.
    const m3 = memo('webgl');
    const c3 = new KataGoClient({ memo: m3, makeWorker: () => fauxWorker(r => [{ id: r.id, type: 'error', error: 'Téléchargement du réseau impossible (HTTP 404)' }]) });
    await expect(c3.start()).rejects.toThrow();
    expect(m3.val).toBe('webgl');
  });

  it('sans mémoire : ordre habituel (le Worker choisit)', async () => {
    const recus: KgRequest[] = [];
    const c = new KataGoClient({ memo: memo(null), makeWorker: () => fauxWorker(r => [{ id: r.id, type: 'ready', backend: 'webgpu', name: 'g', ms: 1, fromCache: true }], recus) });
    await c.start();
    expect((recus[0] as { backends?: unknown }).backends).toBeUndefined();
  });
});

describe('affichage en mégaoctets', () => {
  it('« 2,1 / 3,8 Mo » en français, « 2.1 / 3.8 MB » en anglais', () => {
    expect(formatMo(2_100_000)).toBe('2,1');
    expect(formatMo(MODEL_OCTETS)).toBe('3,8');
    expect(formatMo(MODEL_OCTETS, 'en')).toBe('3.8');
    expect(formatMo(0)).toBe('0,0');
  });
});
