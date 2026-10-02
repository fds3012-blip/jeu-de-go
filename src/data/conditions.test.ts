import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { VERSION_CONDITIONS, accepterConditions, conditionsAJour, versionValide } from './conditions';
import type { Db } from './supabase';

const RACINE = resolve(__dirname, '../..');
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

describe('VERSION_CONDITIONS', () => {
  it('a la forme AAAA-MM-JJ attendue par le serveur', () => {
    expect(versionValide(VERSION_CONDITIONS)).toBe(true);
    expect(versionValide('v1')).toBe(false);
    expect(versionValide('30/09/2026')).toBe(false);
  });

  it('est la date de la dernière mise à jour des CGU (docs/juridique/cgu.md)', () => {
    const cgu = readFileSync(resolve(RACINE, 'docs/juridique/cgu.md'), 'utf8');
    const [annee, mois, jour] = VERSION_CONDITIONS.split('-').map(Number);
    const enFrancais = `${jour} ${MOIS[mois - 1]} ${annee}`;
    expect(cgu, `les CGU doivent citer « ${enFrancais} »`).toContain(enFrancais);
    // Aucune date plus récente que la version en vigueur dans l'en-tête des CGU (sinon la version est en retard).
    const entete = cgu.slice(0, cgu.indexOf('## '));
    for (const m of entete.matchAll(/(\d{1,2})(?:er)? (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) (\d{4})/g)) {
      const date = `${m[3]}-${String(MOIS.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      expect(date <= VERSION_CONDITIONS, `CGU mises à jour le ${date}, VERSION_CONDITIONS vaut ${VERSION_CONDITIONS}`).toBe(true);
    }
  });

  it('a la même forme que la contrainte de la migration', () => {
    const sql = readFileSync(resolve(RACINE, 'supabase/migrations/20261002000100_preuve_conditions.sql'), 'utf8');
    expect(sql).toContain(`'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`);
  });
});

describe('conditionsAJour', () => {
  it('vrai seulement pour la version en vigueur', () => {
    expect(conditionsAJour({ conditions_version: VERSION_CONDITIONS })).toBe(true);
    expect(conditionsAJour({ conditions_version: '2020-01-01' })).toBe(false);
    expect(conditionsAJour({ conditions_version: null })).toBe(false);
    expect(conditionsAJour(null)).toBe(false);
    expect(conditionsAJour(undefined)).toBe(false);
  });
});

describe('accepterConditions', () => {
  const db = (reponse: { data: unknown; error: { message: string; code?: string } | null }) => {
    const rpc = vi.fn().mockResolvedValue(reponse);
    return { db: { rpc } as unknown as Db, rpc };
  };

  it('appelle accepter_conditions avec la version en vigueur et rend la date gardée', async () => {
    const { db: d, rpc } = db({ data: '2026-10-02T08:00:00+00:00', error: null });
    const r = await accepterConditions(d);
    expect(rpc).toHaveBeenCalledWith('accepter_conditions', { p_version: VERSION_CONDITIONS });
    expect(r).toEqual({ ok: true, value: new Date('2026-10-02T08:00:00Z') });
  });

  it('accepte une autre version explicite, refuse une version mal formée sans appeler le serveur', async () => {
    const { db: d, rpc } = db({ data: '2027-01-15T08:00:00+00:00', error: null });
    expect((await accepterConditions(d, '2027-01-15')).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith('accepter_conditions', { p_version: '2027-01-15' });
    rpc.mockClear();
    expect((await accepterConditions(d, 'v2')).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rend une erreur si le serveur refuse (session anonyme : JGC01) ou répond n’importe quoi', async () => {
    expect((await accepterConditions(db({ data: null, error: { message: 'Crée ton compte', code: 'JGC01' } }).db)).ok).toBe(false);
    expect((await accepterConditions(db({ data: 'pas une date', error: null }).db)).ok).toBe(false);
  });
});
