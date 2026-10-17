// #584 : « À faire » n'est plus relu à chaque changement d'onglet : une lecture est gardée une minute au plus, par
// compte, et relue avant si le joueur change quelque chose (version), sur une relecture forcée ou après une erreur.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../data/supabase';
import { _oublierAFaire, aRelire, chargerAFaireFrais, FRAICHEUR_A_FAIRE_MS } from './aFaireCharge';
import { invaliderAFaire, versionAFaire } from '../data/fraicheurAFaire';
import { demanderAmi, repondreAmi } from '../data/amis';
import { marquerLues } from '../data/notifications';

/** Client qui compte ses lectures : tables vides, `mes_amis` rend une demande reçue (ou une erreur). */
function fauxDb(o: { erreurAmis?: boolean } = {}) {
  const lus: string[] = [];
  const requete = (t: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'or', 'order', 'in', 'limit', 'maybeSingle']) q[m] = () => q;
    q.then = (ok: (v: unknown) => unknown) => { lus.push(t); return Promise.resolve({ data: t === 'file_lente' ? null : [], error: null }).then(ok); };
    return q;
  };
  const rpc = async (nom: string) => {
    lus.push(nom);
    return o.erreurAmis ? { data: null, error: { message: 'réseau' } } : { data: [{ pseudo: 'Léa', etat: 'recue' }], error: null };
  };
  return { db: { from: requete, rpc } as unknown as Db, lus };
}

afterEach(() => _oublierAFaire());

describe('« À faire » gardé une minute (#584)', () => {
  it('cinq changements d’onglet en une minute : une seule lecture (défis, notifications, recherche lente, amis)', async () => {
    const { db, lus } = fauxDb();
    for (let i = 0; i < 5; i++) expect((await chargerAFaireFrais(db, 'u1', new Map(), true, i === 0)).demandesAmis).toBe(1);
    expect(lus.sort()).toEqual(['defis', 'file_lente', 'mes_amis', 'notifications']);
  });

  it('relu : forcé (retour sur l’app, temps réel), « À faire » changé, autre compte', async () => {
    const { db, lus } = fauxDb();
    await chargerAFaireFrais(db, 'u1', new Map(), true, false);
    await chargerAFaireFrais(db, 'u1', new Map(), true, true);
    invaliderAFaire();
    await chargerAFaireFrais(db, 'u1', new Map(), true, false);
    await chargerAFaireFrais(db, 'u2', new Map(), true, false);
    expect(lus.filter(t => t === 'defis')).toHaveLength(4);
  });

  it('plus d’une minute après : relu', () => {
    const g = { compte: 'u1', t: 1_000, version: versionAFaire() };
    expect(aRelire(g, 'u1', 1_000 + FRAICHEUR_A_FAIRE_MS - 1)).toBe(false);
    expect(aRelire(g, 'u1', 1_000 + FRAICHEUR_A_FAIRE_MS)).toBe(true);
  });

  it('session sans compte complet : pas de `mes_amis` ; demandes d’ami en erreur : lecture pas gardée', async () => {
    const { db, lus } = fauxDb();
    expect((await chargerAFaireFrais(db, 'anonyme', new Map(), false, false)).demandesAmis).toBe(0);
    expect(lus).not.toContain('mes_amis');
    const ko = fauxDb({ erreurAmis: true });
    await chargerAFaireFrais(ko.db, 'u3', new Map(), true, false);
    await chargerAFaireFrais(ko.db, 'u3', new Map(), true, false);
    expect(ko.lus.filter(t => t === 'mes_amis')).toHaveLength(2);
  });

  it('les écritures du joueur qui changent « À faire » augmentent sa version', async () => {
    const db = { rpc: vi.fn(async () => ({ data: 'amis', error: null })) } as unknown as Db;
    for (const ecrire of [() => demanderAmi(db, 'Bruno'), () => repondreAmi(db, 'Bruno', true), () => marquerLues(db)]) {
      const v = versionAFaire();
      await ecrire();
      expect(versionAFaire()).toBe(v + 1);
    }
  });
});
