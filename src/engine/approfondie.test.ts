// C8 (#732) : « Analyse approfondie » : réglage, vitesse, téléchargement sur demande (mock), annulation, replis.
import { describe, expect, it } from 'vitest';
import {
  APPROFONDI_NOM, APPROFONDI_OCTETS, APPROFONDI_SHA256, APPROFONDI_URL, creerApprofondi, lireReglage, optionsApprofondies, SEUIL_MS_PAR_VISITE,
  TROP_LENT_DUREE_MS, tropLent, CLE_REGLAGE, type ClientApprofondi, type DepsApprofondi,
} from './approfondie';
import type { Analysis, KataGoInfo } from './index';
import { newPosition } from '../go/rules';
import { loadModelBytes } from './katago/loader';
import { APPROFONDI_SHA256_DECOMPRESSE } from './approfondie';

const T0 = 1_800_000_000_000;
const analyse = (ms: number, visits = 64): Analysis => ({ moves: [], winrate: 0.5, lead: 0, ownership: new Float32Array(81), visits, ms, engine: 'faux' });

describe('réglage', () => {
  it('désactivé par défaut, ou si le stockage est illisible', () => {
    expect(lireReglage(null, T0)).toEqual({ actif: false, tropLentLe: null });
    expect(lireReglage('{pas du json', T0)).toEqual({ actif: false, tropLentLe: null });
    expect(lireReglage('{"actif":"oui"}', T0).actif).toBe(false);
  });
  it('« trop lent » est oublié au bout de 30 jours, et une date du futur est ignorée', () => {
    expect(lireReglage(JSON.stringify({ actif: true, tropLentLe: T0 - 1000 }), T0)).toEqual({ actif: true, tropLentLe: T0 - 1000 });
    expect(lireReglage(JSON.stringify({ actif: true, tropLentLe: T0 - TROP_LENT_DUREE_MS - 1 }), T0).tropLentLe).toBeNull();
    expect(lireReglage(JSON.stringify({ actif: true, tropLentLe: T0 + 3_600_000 }), T0).tropLentLe).toBeNull();
  });
});

describe('vitesse', () => {
  it('juge une recherche de 64 visites sur le temps par visite, pas une recherche trop courte', () => {
    expect(tropLent(analyse(64 * (SEUIL_MS_PAR_VISITE + 5)), 64)).toBe(true);
    expect(tropLent(analyse(64 * (SEUIL_MS_PAR_VISITE - 20)), 64)).toBe(false);
    expect(tropLent(analyse(5000, 3), 64)).toBe(true); // coupée par le temps : 3 visites seulement
    expect(tropLent(analyse(5000, 3), 8)).toBeNull();
    expect(tropLent(analyse(5000, 3), undefined)).toBeNull();
  });
  it('plus de temps accordé au réseau approfondi, mêmes visites', () => {
    expect(optionsApprofondies({ komi: 6.5, visits: 64, timeMs: 2560 })).toEqual({ komi: 6.5, visits: 64, timeMs: 7680 });
    expect(optionsApprofondies({ visits: 64 })).toEqual({ visits: 64 });
  });
});

describe('le réseau demandé', () => {
  it('vient du dépôt KataGo (hôte déjà dans la CSP), avec l’empreinte attendue et la taille annoncée', () => {
    expect(APPROFONDI_URL).toBe(`https://raw.githubusercontent.com/lightvector/KataGo/master/cpp/tests/models/${APPROFONDI_NOM}.bin.gz`);
    expect(APPROFONDI_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(APPROFONDI_OCTETS).toBe(11_138_361);
  });
});

/** Un faux appareil : stockage, cache et client simulés ; compte tout ce qui touche au réseau. */
function appareil(opts: { precharge?: boolean | 'attend'; demarrage?: 'ok' | 'echec'; ms?: number } = {}) {
  const stock = new Map<string, string>();
  const j = { enCache: false, clients: 0, precharger: 0, starts: 0, relances: 0, disposes: 0, analyses: 0, telechargementPermisPendant: [] as boolean[] };
  let liberer: (v: boolean) => void = () => {};
  const deps: DepsApprofondi = {
    client: permis => {
      j.clients++;
      const c: ClientApprofondi = {
        info: { state: 'inactif' } as KataGoInfo,
        async precharger() {
          j.precharger++; j.telechargementPermisPendant.push(permis());
          if (opts.precharge === 'attend') return new Promise<boolean>(r => { liberer = r; });
          if (opts.precharge !== false) j.enCache = true;
          return opts.precharge !== false;
        },
        async start() {
          j.starts++;
          if (opts.demarrage === 'echec') throw new Error('démarrage');
          c.info = { state: 'pret' } as KataGoInfo;
        },
        async analyze() { j.analyses++; return analyse(opts.ms ?? 1000); },
        relancer() { j.relances++; liberer(false); },
        abandonner() {},
        dispose() { j.disposes++; },
        ecouter: () => () => {},
      };
      return c;
    },
    stockage: { getItem: k => stock.get(k) ?? null, setItem: (k, v) => { stock.set(k, v); }, removeItem: k => { stock.delete(k); } },
    enCache: async () => j.enCache,
    vider: async () => { j.enCache = false; return true; },
    maintenant: () => T0,
  };
  return { ap: creerApprofondi(deps), j, stock };
}

describe('jamais sans demande', () => {
  it('désactivée : ni client, ni téléchargement, ni démarrage, même réseau en cache', async () => {
    const { ap, j } = appareil();
    j.enCache = true;
    expect(await ap.fournir()).toBeNull();
    expect(await ap.etat()).toBe('en-cache');
    expect(j).toMatchObject({ clients: 0, precharger: 0, starts: 0 });
    expect(ap.raisonRepli()).toBeNull();
  });
  it('active mais réseau absent du cache (cache vidé par le navigateur) : le petit réseau, rien n’est téléchargé', async () => {
    const { ap, j } = appareil();
    ap.reactiver();
    expect(await ap.fournir()).toBeNull();
    expect(j).toMatchObject({ clients: 0, precharger: 0 });
    expect(ap.raisonRepli()).toBe('indisponible');
    expect(ap.reglage().actif).toBe(false);
  });
});

describe('activer (le geste du joueur)', () => {
  it('télécharge avec la permission, active, puis fournit le réseau sans retélécharger', async () => {
    const { ap, j, stock } = appareil();
    expect(await ap.etat()).toBe('desactivee');
    expect(await ap.activer()).toBe('ok');
    expect(j.telechargementPermisPendant).toEqual([true]);
    expect(JSON.parse(stock.get(CLE_REGLAGE)!)).toEqual({ actif: true, tropLentLe: null });
    expect(await ap.etat()).toBe('active');
    const k = await ap.fournir();
    expect(k).not.toBeNull();
    expect(j.precharger).toBe(1);
    expect(j.starts).toBe(1);
  });
  it('échec du téléchargement (ou de l’empreinte) : rien n’est activé', async () => {
    const { ap, stock } = appareil({ precharge: false });
    expect(await ap.activer()).toBe('echec');
    expect(stock.has(CLE_REGLAGE)).toBe(false);
    expect(await ap.etat()).toBe('desactivee');
    expect(await ap.fournir()).toBeNull();
  });
  it('annulation : le client est arrêté, rien n’est activé, état revenu', async () => {
    const { ap, j, stock } = appareil({ precharge: 'attend' });
    const p = ap.activer();
    await Promise.resolve();
    await Promise.resolve();
    expect(await ap.etat()).toBe('telechargement');
    ap.annuler();
    expect(await p).toBe('annule');
    expect(j.relances).toBeGreaterThan(0);
    expect(stock.has(CLE_REGLAGE)).toBe(false);
    expect(await ap.etat()).toBe('desactivee');
  });
  it('un second appel pendant le téléchargement ne lance pas un second téléchargement', async () => {
    const { ap, j } = appareil({ precharge: 'attend' });
    const p = ap.activer();
    await Promise.resolve();
    await Promise.resolve();
    expect(await ap.activer()).toBe('echec');
    ap.annuler();
    await p;
    expect(j.precharger).toBe(1);
  });
});

describe('replis sur le petit réseau', () => {
  it('démarrage en échec : null, silencieux, raison « indisponible »', async () => {
    const { ap, j } = appareil({ demarrage: 'echec' });
    await ap.activer();
    expect(await ap.fournir()).toBeNull();
    expect(ap.raisonRepli()).toBe('indisponible');
    expect(j.disposes).toBeGreaterThan(0);
  });
  it('appareil trop lent : la réponse reste valable, puis le petit réseau et le GPU libéré', async () => {
    const { ap, j, stock } = appareil({ ms: 64 * (SEUIL_MS_PAR_VISITE + 30) });
    await ap.activer();
    const k = (await ap.fournir())!;
    const a = await k.analyze(newPosition(9), { visits: 64 });
    expect(a.visits).toBe(64);
    expect(JSON.parse(stock.get(CLE_REGLAGE)!).tropLentLe).toBe(T0);
    expect(ap.raisonRepli()).toBe('trop-lent');
    expect(await ap.etat()).toBe('trop-lent');
    const disposes = j.disposes;
    expect(await ap.fournir()).toBeNull();
    expect(j.disposes).toBe(disposes + 1);
    expect(ap.raisonRepli()).toBe('trop-lent');
    // « Réessayer » le remet en route.
    ap.reactiver();
    expect(ap.raisonRepli()).toBeNull();
    expect(await ap.etat()).toBe('active');
  });
  it('appareil assez rapide : rien n’est noté', async () => {
    const { ap, stock } = appareil({ ms: 64 * 40 });
    await ap.activer();
    await (await ap.fournir())!.analyze(newPosition(9), { visits: 64 });
    expect(JSON.parse(stock.get(CLE_REGLAGE)!).tropLentLe).toBeNull();
    expect(ap.raisonRepli()).toBeNull();
  });
});

describe('désactiver et libérer la place', () => {
  it('désactiver garde le réseau ; libérer l’efface', async () => {
    const { ap, j, stock } = appareil();
    await ap.activer();
    ap.desactiver();
    expect(stock.has(CLE_REGLAGE)).toBe(false);
    expect(await ap.etat()).toBe('en-cache');
    expect(await ap.fournir()).toBeNull();
    ap.reactiver();
    expect(await ap.etat()).toBe('active');
    expect(await ap.liberer()).toBe(true);
    expect(j.enCache).toBe(false);
    expect(await ap.etat()).toBe('desactivee');
  });
});

describe('empreinte vérifiée', () => {
  it('un fichier qui n’a pas l’empreinte attendue est refusé et rien n’est rangé dans le cache', async () => {
    const rangé: string[] = [];
    const caches = { open: async () => ({ match: async () => undefined, put: async (u: string) => { rangé.push(u); } }) } as unknown as Pick<CacheStorage, 'open'>;
    const faux = new Uint8Array(4096).fill(7);
    await expect(loadModelBytes([APPROFONDI_URL], {
      fetch: async () => new Response(faux), caches, sha256: [APPROFONDI_SHA256, APPROFONDI_SHA256_DECOMPRESSE],
      digest: async () => 'a'.repeat(64),
    })).rejects.toThrow(/empreinte inattendue/);
    expect(rangé).toEqual([]);
  });
  it('le bon fichier est accepté et rangé sous son adresse', async () => {
    const rangé: string[] = [];
    const caches = { open: async () => ({ match: async () => undefined, put: async (u: string) => { rangé.push(u); } }) } as unknown as Pick<CacheStorage, 'open'>;
    const r = await loadModelBytes([APPROFONDI_URL], {
      fetch: async () => new Response(new Uint8Array(4096)), caches, sha256: [APPROFONDI_SHA256, APPROFONDI_SHA256_DECOMPRESSE],
      digest: async () => APPROFONDI_SHA256,
    });
    expect(r.fromCache).toBe(false);
    expect(rangé).toEqual([APPROFONDI_URL]);
  });
});
