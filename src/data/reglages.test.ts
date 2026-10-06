import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from './supabase';

// Issue #448 : synchronisation des réglages du compte, côté appareil. Environnement Node : stockage en mémoire,
// fenêtre et document réduits à leurs écouteurs, serveur simulé avec la même règle que `enregistrer_reglages`.
const memoire = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => { memoire.set(k, v); }, removeItem: (k: string) => { memoire.delete(k); } });
vi.stubGlobal('window', { addEventListener: () => undefined, removeEventListener: () => undefined });
vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: () => undefined, removeEventListener: () => undefined });

const R = await import('./reglages');
const { appliquerSettings, settingsCourants, themeGobanGarde } = await import('../app/settings');
const { noterReglage, lireDatesReglages, DATES_REGLAGES_KEY } = await import('../app/reglagesDates');
const { fusionner, nettoyer } = await import('../app/reglagesCompte');
const { lireChoixLangue } = await import('../content/i18n/detection');
const { lireFaconEnLigne } = await import('../app/enLigne');
const { messagesCoupes } = await import('./securite');

type Reglages = Record<string, { v: unknown; t: number }>;
/** Serveur simulé : fusion clé par clé, à égalité la valeur gardée reste. `panne` : hors ligne. */
function faux(depart: Reglages = {}) {
  const s = { stock: { ...depart } as Reglages, envois: [] as Reglages[], panne: false };
  const db = {
    rpc: async (nom: string, args: { p_reglages: Reglages }) => {
      expect(nom).toBe('enregistrer_reglages');
      if (s.panne) return { data: null, error: { message: 'Failed to fetch' } };
      s.envois.push(args.p_reglages);
      s.stock = fusionner(nettoyer(args.p_reglages), s.stock);
      return { data: s.stock, error: null };
    },
  } as unknown as Db;
  return { s, db };
}

beforeEach(() => {
  memoire.clear();
  appliquerSettings({ theme: 'auto', size: 9, coordonnees: true, sound: true });
  memoire.clear();
});

describe('synchronisation des réglages (#448)', () => {
  it('au démarrage : le plus récent de chaque réglage gagne, sur l’appareil comme sur le serveur', async () => {
    noterReglage('coordonnees', 5_000);
    appliquerSettings({ coordonnees: false });
    noterReglage('theme', 1_000);
    appliquerSettings({ theme: 'light' });
    const { s, db } = faux({
      theme: { v: 'dark', t: 2_000 }, langue: { v: 'en', t: 2_000 }, enLigne: { v: 'lente', t: 2_000 },
      messagesCoupes: { v: true, t: 2_000 }, themeGoban: { v: 'ardoise', t: 2_000 }, coordonnees: { v: true, t: 4_000 },
    });
    const arreter = R.demarrerSynchroReglages(db);
    await vi.waitFor(() => expect(s.envois).toHaveLength(1));
    await vi.waitFor(() => expect(settingsCourants().theme).toBe('dark'));
    arreter();
    expect(settingsCourants().coordonnees).toBe(false); // plus récent sur l'appareil
    expect(lireChoixLangue()).toBe('en');
    expect(lireFaconEnLigne()).toBe('lente');
    expect(messagesCoupes()).toBe(true);
    expect(themeGobanGarde()).toBe('ardoise');
    expect(s.stock.coordonnees).toEqual({ v: false, t: 5_000 });
    // Les dates reçues sont gardées : rien n'est renvoyé comme un nouveau changement.
    expect(lireDatesReglages()).toMatchObject({ theme: 2_000, langue: 2_000, coordonnees: 5_000 });
  });

  it('un réglage changé avant #448 remplit un compte vide sans écraser un choix daté', async () => {
    appliquerSettings({ size: 13, theme: 'dark' }); // aucune date : réglages d'avant la synchronisation
    const { s, db } = faux({ theme: { v: 'light', t: 10 } });
    const arreter = R.demarrerSynchroReglages(db);
    await vi.waitFor(() => expect(settingsCourants().theme).toBe('light'));
    arreter();
    expect(s.stock.size).toEqual({ v: 13, t: 1 });
    expect(s.envois[0]).not.toHaveProperty('sound'); // jamais changé : pas envoyé
  });

  it('les changements rapprochés partent ensemble, sans attendre ; hors ligne, ils repartent plus tard', async () => {
    vi.useFakeTimers();
    try {
      const { s, db } = faux();
      const arreter = R.demarrerSynchroReglages(db);
      await vi.advanceTimersByTimeAsync(0);
      expect(s.envois).toHaveLength(1);
      noterReglage('sound'); appliquerSettings({ sound: false });
      noterReglage('size'); appliquerSettings({ size: 19 });
      await vi.advanceTimersByTimeAsync(R.DELAI_ENVOI_MS - 1);
      expect(s.envois).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(s.envois).toHaveLength(2);
      expect(s.stock).toMatchObject({ sound: { v: false }, size: { v: 19 } });
      // Hors ligne : le réglage local reste valable, l'envoi raté repart au changement suivant.
      s.panne = true;
      noterReglage('theme'); appliquerSettings({ theme: 'dark' });
      await vi.advanceTimersByTimeAsync(R.DELAI_ENVOI_MS);
      expect(settingsCourants().theme).toBe('dark');
      expect(s.stock.theme).toBeUndefined();
      s.panne = false;
      noterReglage('coordonnees'); appliquerSettings({ coordonnees: false });
      await vi.advanceTimersByTimeAsync(R.DELAI_ENVOI_MS);
      expect(s.stock).toMatchObject({ theme: { v: 'dark' }, coordonnees: { v: false } });
      arreter();
      // Arrêtée (déconnexion) : plus rien ne part.
      noterReglage('sound'); appliquerSettings({ sound: true });
      await vi.advanceTimersByTimeAsync(R.DELAI_ENVOI_MS * 2);
      expect(s.envois).toHaveLength(3);
    } finally { vi.useRealTimers(); }
  });

  it('stockage abîmé : rien ne casse', () => {
    memoire.set(DATES_REGLAGES_KEY, '[1, "x"');
    expect(lireDatesReglages()).toEqual({});
    memoire.set(DATES_REGLAGES_KEY, '{"theme":"hier","size":3}');
    expect(lireDatesReglages()).toEqual({ size: 3 });
  });
});
