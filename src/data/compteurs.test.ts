import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as A from './analytics';
import { _reinitialiserCompteurs, compterEtape, dejaComptee, DUREE_REPERE_MOIS, ETAPES, purgerReperesExpires, repereValide } from './compteurs';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
}

const flush = () => new Promise(r => setTimeout(r, 0));
let fetchMock: ReturnType<typeof vi.fn>;
let stockage: MemoryStorage;

function navigateur(adresse = 'https://jeu.test/') {
  stockage = new MemoryStorage();
  fetchMock = vi.fn(() => Promise.resolve(new Response('true')));
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', {});
  vi.stubGlobal('localStorage', stockage);
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('location', new URL(adresse));
  vi.stubGlobal('history', { state: null, replaceState: vi.fn() });
  vi.stubEnv('VITE_SUPABASE_URL', 'https://projet.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'cle-publique');
  vi.stubEnv('VITE_VERCEL_ENV', 'production');
}
const etapesEnvoyees = () => fetchMock.mock.calls.map(c => JSON.parse((c[1] as RequestInit).body as string).p_etape as string);

beforeEach(() => { A._resetForTests(); _reinitialiserCompteurs(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('compteurs anonymes de l’entonnoir (#437)', () => {
  it('appel anonyme : clé publique seulement, nom de l’étape seulement, ni cookie ni adresse d’origine', async () => {
    navigateur();
    compterEtape('premier_ecran', { nouveau: true });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://projet.supabase.co/rest/v1/rpc/compter_etape');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ p_etape: 'premier_ecran' });
    expect(init.headers).toEqual({ apikey: 'cle-publique', Authorization: 'Bearer cle-publique', 'Content-Type': 'application/json' });
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(init.keepalive).toBe(true);
  });

  it('une première session compte chaque étape une seule fois', async () => {
    navigateur();
    for (let i = 0; i < 3; i++) {
      compterEtape('premier_ecran', { nouveau: true });
      for (const e of ETAPES.slice(1)) compterEtape(e);
    }
    await flush();
    expect(etapesEnvoyees()).toEqual([...ETAPES]);
    // Page rechargée : les repères de l'appareil suffisent.
    _reinitialiserCompteurs();
    compterEtape('premier_ecran', { nouveau: true });
    ETAPES.forEach(e => compterEtape(e));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(ETAPES.length);
  });

  it('repère sans identifiant : le mois seulement, sous go.entonnoir.<étape>', async () => {
    navigateur();
    compterEtape('premier_ecran', { nouveau: true });
    compterEtape('premiere_pierre');
    const cles = [...Array(stockage.length).keys()].map(i => stockage.key(i));
    expect(cles).toEqual(['go.entonnoir.premier_ecran', 'go.entonnoir.premiere_pierre']);
    cles.forEach(k => expect(stockage.getItem(k!)).toMatch(/^\d{4}-\d{2}$/));
  });

  it('appareil déjà connu (pas nouveau) : ni premier écran ni étapes suivantes', async () => {
    navigateur();
    compterEtape('premier_ecran', { nouveau: false });
    compterEtape('premiere_pierre');
    compterEtape('limite_essai');
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('opposition à la mesure : rien n’est compté, les repères sont effacés', async () => {
    navigateur();
    compterEtape('premier_ecran', { nouveau: true });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    A.setOpposition(true);
    expect(stockage.getItem('go.entonnoir.premier_ecran')).toBeNull();
    _reinitialiserCompteurs();
    compterEtape('premier_ecran', { nouveau: true });
    compterEtape('premiere_pierre');
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('drapeau de l’équipe (?equipe=1) : rien n’est compté ; ?equipe=0 le retire', async () => {
    navigateur('https://jeu.test/?equipe=1&lang=fr#x');
    A.lireEquipeDansAdresse();
    expect(A.estEquipe()).toBe(true);
    expect(stockage.getItem(A.EQUIPE_KEY)).toBe('1');
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/?lang=fr#x');
    compterEtape('premier_ecran', { nouveau: true });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubGlobal('location', new URL('https://jeu.test/?equipe=0'));
    A.lireEquipeDansAdresse();
    expect(A.estEquipe()).toBe(false);
    expect(stockage.getItem(A.EQUIPE_KEY)).toBeNull();
  });

  it('drapeau posé pendant l’attente du premier écran : rien ne part', async () => {
    navigateur();
    compterEtape('premier_ecran', { nouveau: true });
    A.setEquipe(true);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preview Vercel ou développement local : rien (même base que la production)', async () => {
    navigateur();
    vi.stubEnv('VITE_VERCEL_ENV', 'preview');
    compterEtape('premier_ecran', { nouveau: true });
    vi.stubEnv('VITE_VERCEL_ENV', 'development');
    compterEtape('premier_ecran', { nouveau: true });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sans comptes configurés ou hors navigateur : rien', async () => {
    navigateur();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    compterEtape('premier_ecran', { nouveau: true });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('échec réseau silencieux, stockage bloqué : compté une fois dans la page', async () => {
    navigateur();
    fetchMock.mockImplementation(() => Promise.reject(new Error('hors ligne')));
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqué'); }, setItem: () => { throw new Error('bloqué'); } });
    compterEtape('premier_ecran', { nouveau: true });
    compterEtape('premier_ecran', { nouveau: true });
    compterEtape('premiere_pierre');
    await flush();
    expect(etapesEnvoyees()).toEqual(['premier_ecran', 'premiere_pierre']);
    expect(dejaComptee('premiere_pierre')).toBe(true);
  });

  it('repère valable 13 mois au plus (CNIL)', () => {
    const maintenant = new Date(2026, 9, 5); // octobre 2026
    expect(DUREE_REPERE_MOIS).toBe(13);
    expect(repereValide('2026-10', maintenant)).toBe(true);
    expect(repereValide('2025-10', maintenant)).toBe(true); // 12 mois
    expect(repereValide('2025-09', maintenant)).toBe(false); // 13 mois : expiré
    expect(repereValide('2027-01', maintenant)).toBe(false); // futur : invalide
    expect(repereValide('1', maintenant)).toBe(false);
    expect(repereValide(null, maintenant)).toBe(false);
  });

  it('repères expirés ou illisibles effacés à chaque lancement, les autres clés intactes', () => {
    navigateur();
    stockage.setItem('go.entonnoir.premier_ecran', '2025-09');
    stockage.setItem('go.entonnoir.premiere_pierre', 'n_importe_quoi');
    stockage.setItem('go.entonnoir.compte_cree', '2026-01');
    stockage.setItem('go.settings.v1', '{}');
    purgerReperesExpires(new Date(2026, 9, 5));
    expect(stockage.getItem('go.entonnoir.premier_ecran')).toBeNull();
    expect(stockage.getItem('go.entonnoir.premiere_pierre')).toBeNull();
    expect(stockage.getItem('go.entonnoir.compte_cree')).toBe('2026-01');
    expect(stockage.getItem('go.settings.v1')).toBe('{}');
  });

  it('mêmes étapes que la liste blanche de la migration', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261005120100_compteurs_entonnoir.sql'), 'utf8');
    const liste = /p_etape not in \(([^)]*)\)/.exec(sql)![1];
    expect(liste.match(/'([a-z_]+)'/g)!.map(s => s.slice(1, -1))).toEqual([...ETAPES]);
    expect(sql).toMatch(/security definer\s+set search_path = ''/);
    expect(sql).toMatch(/grant execute on function public\.compter_etape\(text\) to anon, authenticated;/);
    expect(sql).not.toMatch(/create policy/i);
  });
});
