import { dateDuNumero, importerSerieAppareil, serieAEnvoyer } from './serieServeur';
import type { Db } from './supabase';

const LANCEMENT = '2026-09-27';

function fauxClient(reponse: { data?: unknown; error?: unknown } | 'jette' = { data: 2, error: null }) {
  const appels: { fn: string; args: unknown }[] = [];
  const db = {
    rpc: async (fn: string, args: unknown) => {
      appels.push({ fn, args });
      if (reponse === 'jette') throw new Error('réseau');
      return { data: reponse.data ?? null, error: reponse.error ?? null };
    }
  } as unknown as Pick<Db, 'rpc'>;
  return { db, appels };
}

describe('date d’un Go du jour', () => {
  it('le n° 1 tombe le jour du lancement, puis +1 par jour', () => {
    expect(dateDuNumero(1, LANCEMENT)).toBe('2026-09-27');
    expect(dateDuNumero(2, LANCEMENT)).toBe('2026-09-28');
    expect(dateDuNumero(6, LANCEMENT)).toBe('2026-10-02');
    expect(dateDuNumero(97, LANCEMENT)).toBe('2027-01-01');
  });
});

describe('série à envoyer', () => {
  it('envoie une série réussie aujourd’hui ou hier', () => {
    expect(serieAEnvoyer({ dernier: 5, jours: 3 }, 5, LANCEMENT)).toEqual({ jours: 3, dernierJour: '2026-10-01' });
    expect(serieAEnvoyer({ dernier: 4, jours: 3 }, 5, LANCEMENT)).toEqual({ jours: 3, dernierJour: '2026-09-30' });
  });

  it('n’envoie rien pour une série morte, vide ou illisible', () => {
    expect(serieAEnvoyer({ dernier: 3, jours: 3 }, 5, LANCEMENT)).toBeNull();
    expect(serieAEnvoyer({ dernier: 6, jours: 3 }, 5, LANCEMENT)).toBeNull();
    expect(serieAEnvoyer(null, 5, LANCEMENT)).toBeNull();
    expect(serieAEnvoyer({ dernier: 5, jours: 0 }, 5, LANCEMENT)).toBeNull();
    expect(serieAEnvoyer({ dernier: '5', jours: 3 }, 5, LANCEMENT)).toBeNull();
    expect(serieAEnvoyer({ dernier: 5, jours: 2.5 }, 5, LANCEMENT)).toBeNull();
    expect(serieAEnvoyer('x', 5, LANCEMENT)).toBeNull();
  });

  it('borne les jours au numéro du dernier jour, comme le serveur', () => {
    expect(serieAEnvoyer({ dernier: 2, jours: 40 }, 2, LANCEMENT)).toEqual({ jours: 2, dernierJour: '2026-09-28' });
  });
});

describe('import à la connexion', () => {
  it('appelle la fonction serveur avec la série de l’appareil', async () => {
    const { db, appels } = fauxClient({ data: 4 });
    expect(await importerSerieAppareil(db, { jours: 3, dernierJour: '2026-10-01' })).toEqual({ ok: true, value: 4 });
    expect(appels).toEqual([{ fn: 'importer_serie_appareil', args: { p_jours: 3, p_dernier_jour: '2026-10-01' } }]);
  });

  it('n’appelle rien sans série à envoyer', async () => {
    const { db, appels } = fauxClient();
    expect(await importerSerieAppareil(db, null)).toEqual({ ok: true, value: null });
    expect(await importerSerieAppareil(db, { jours: 0, dernierJour: '2026-10-01' })).toEqual({ ok: true, value: null });
    expect(await importerSerieAppareil(db, { jours: 2, dernierJour: 'hier' })).toEqual({ ok: true, value: null });
    expect(appels).toEqual([]);
  });

  it('signale un refus du serveur sans planter', async () => {
    const { db } = fauxClient({ error: { message: 'Série invalide' } });
    expect(await importerSerieAppareil(db, { jours: 3, dernierJour: '2026-10-01' })).toEqual({ ok: false, error: 'Impossible d’enregistrer ta série.' });
  });

  it('signale une erreur réseau sans planter', async () => {
    const { db } = fauxClient('jette');
    expect((await importerSerieAppareil(db, { jours: 3, dernierJour: '2026-10-01' })).ok).toBe(false);
  });
});
