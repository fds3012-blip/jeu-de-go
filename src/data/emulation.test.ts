import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  bilanSemaine, classementGoDuJour, lireBilanServeur, lireClassement, lireRecords, mesRecords, noterGoDuJour, rappelerGoDuJour, refusEmulation,
} from './emulation';
import type { Db } from './supabase';
import { CATALOGUE_EMULATION, traduireEmulation, type CleEmulation } from '../content/i18n/emulation';
import { rappelGoDuJour, TYPES_NOTIFICATION } from './notifications';

// Issue #369 : émulation entre amis. Le serveur compare, le client lit avec tolérance.
const db = (data: unknown, error: unknown = null) => {
  const rpc = vi.fn(async () => ({ data, error }));
  return { db: { rpc } as unknown as Db, rpc };
};

describe('classement du Go du jour', () => {
  it('lit les lignes du serveur, sans rang ni cote, en ignorant ce qui est mal formé', () => {
    expect(lireClassement([
      { pseudo: 'Léa', etat: 'reussi', essais: 1, moi: false, rappele: false },
      { pseudo: 'Moi', etat: 'reussi', essais: 2, moi: true, rappele: false },
      { pseudo: 'Tom', etat: 'vu', essais: 5, moi: false, rappele: false },
      { pseudo: 'Max', etat: 'pas_encore', essais: null, moi: false, rappele: true },
      { pseudo: 'Pirate', etat: 'champion' }, null, { etat: 'reussi' },
    ])).toEqual([
      { pseudo: 'Léa', etat: 'reussi', essais: 1, moi: false, rappele: false },
      { pseudo: 'Moi', etat: 'reussi', essais: 2, moi: true, rappele: false },
      { pseudo: 'Tom', etat: 'vu', essais: null, moi: false, rappele: false },
      { pseudo: 'Max', etat: 'pas_encore', essais: null, moi: false, rappele: true },
    ]);
    expect(lireClassement(null)).toEqual([]);
  });

  it('appelle les fonctions du serveur avec leurs arguments', async () => {
    const a = db('reussi');
    expect(await noterGoDuJour(a.db, 9, 'reussi')).toEqual({ ok: true, value: 'reussi' });
    expect(a.rpc).toHaveBeenCalledWith('noter_go_du_jour', { p_numero: 9, p_resultat: 'reussi' });
    const b = db([{ pseudo: 'Léa', etat: 'reussi', essais: 1, moi: false, rappele: false }]);
    expect(await classementGoDuJour(b.db)).toEqual({ ok: true, value: [{ pseudo: 'Léa', etat: 'reussi', essais: 1, moi: false, rappele: false }] });
    const c = db('envoye');
    expect(await rappelerGoDuJour(c.db, 'Léa')).toEqual({ ok: true, value: 'envoye' });
    expect(c.rpc).toHaveBeenCalledWith('rappeler_go_du_jour', { p_pseudo: 'Léa' });
  });

  it('traduit les refus du serveur, jamais son texte brut', async () => {
    expect(refusEmulation({ code: 'JGJ02' })).toBe('dejaFait');
    expect(refusEmulation({ code: 'JGJ03' })).toBe('limiteRappels');
    expect(refusEmulation({ code: 'JGA08' })).toBe('pasAmi');
    expect(refusEmulation({ code: 'JGC01' })).toBe('compte');
    expect(refusEmulation({ code: 'XX000', message: 'boom' })).toBe('serveur');
    expect(refusEmulation(null)).toBe('serveur');
    expect(await rappelerGoDuJour(db(null, { code: 'JGJ03' }).db, 'Léa')).toEqual({ ok: false, error: 'limiteRappels' });
    expect(await rappelerGoDuJour(db('autre').db, 'Léa')).toEqual({ ok: false, error: 'serveur' });
  });
});

describe('bilan de la semaine et records', () => {
  it('lit le bilan avec tolérance ; 5 amis au plus', async () => {
    const brut = { semaine: '2026-10-05', parties: 4, victoires: 3, parties_classees: 3, cote_ecart: -12.4, go_du_jour: 2,
      amis: [...Array.from({ length: 7 }, (_, i) => ({ pseudo: `Ami${i}`, victoires: 1, defaites: 0 })), { victoires: 2 }] };
    const b = lireBilanServeur(brut)!;
    expect(b).toMatchObject({ semaine: '2026-10-05', parties: 4, victoires: 3, partiesClassees: 3, coteEcart: -12, goDuJour: 2 });
    expect(b.amis).toHaveLength(5);
    expect(lireBilanServeur({ semaine: 'lundi' })).toBeNull();
    expect(lireBilanServeur([])).toBeNull();
    const a = db(brut);
    expect((await bilanSemaine(a.db, true)).ok).toBe(true);
    expect(a.rpc).toHaveBeenCalledWith('bilan_semaine', { p_precedente: true });
    expect(await bilanSemaine(db(null, { code: 'JGP01' }).db)).toEqual({ ok: false, error: 'compte' });
  });

  it('lit les records ; rien avant la première partie classée', async () => {
    expect(lireRecords({ parties: 4, meilleure_cote: 1030, meilleure_cote_le: '2026-10-05', serie_victoires: 3, serie_en_cours: 0 }))
      .toEqual({ parties: 4, meilleureCote: 1030, meilleureCoteLe: '2026-10-05', serieVictoires: 3, serieEnCours: 0 });
    expect(lireRecords({ parties: 0, meilleure_cote: null, meilleure_cote_le: '2026-10-05' }))
      .toEqual({ parties: 0, meilleureCote: null, meilleureCoteLe: null, serieVictoires: 0, serieEnCours: 0 });
    expect(lireRecords('x')).toBeNull();
    expect((await mesRecords(db({ parties: 1, meilleure_cote: 962, serie_victoires: 1, serie_en_cours: 1 }).db)).ok).toBe(true);
  });
});

describe('rappel d’un ami (notification `go_du_jour`)', () => {
  it('le type est connu ; seul un rappel d’aujourd’hui compte', () => {
    expect(TYPES_NOTIFICATION).toContain('go_du_jour');
    const jour = (iso: string) => iso.slice(0, 10);
    const n = (type: 'go_du_jour' | 'ami', creeeLe: string) => ({ id: 1, type, partieId: null, creeeLe });
    expect(rappelGoDuJour([n('go_du_jour', '2026-10-05T08:00:00Z')], '2026-10-05', jour)).toBe(true);
    expect(rappelGoDuJour([n('go_du_jour', '2026-10-04T08:00:00Z')], '2026-10-05', jour)).toBe(false);
    expect(rappelGoDuJour([n('ami', '2026-10-05T08:00:00Z')], '2026-10-05', jour)).toBe(false);
  });
});

describe('textes FR et EN', () => {
  const cles = Object.keys(CATALOGUE_EMULATION.fr) as CleEmulation[];
  const textes = (v: unknown) => (typeof v === 'string' ? [v] : Object.values(v as Record<string, string>));

  it('chaque clé a son anglais, les mêmes variables, et des phrases courtes', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    for (const k of cles) {
      const fr = textes(CATALOGUE_EMULATION.fr[k]), en = textes(CATALOGUE_EMULATION.en[k]);
      expect(en.every(Boolean), k).toBe(true);
      expect(vars(en.join(' ')), k).toEqual(expect.arrayContaining(vars(fr.at(-1)!)));
      for (const s of fr) expect(s.length, k).toBeLessThan(110);
    }
  });

  it('vocabulaire : ni « Continuer », ni « défi », ni rang, ni la cote dans le Go du jour (#137)', () => {
    for (const k of cles) {
      for (const s of textes(CATALOGUE_EMULATION.fr[k])) {
        expect(s, k).not.toMatch(/^Continuer\b|(^|[^\p{L}])défi|\b\d+(e|ᵉ|er)\b.*(place|rang)|classement/iu);
        if (k.startsWith('jour.')) expect(s, k).not.toMatch(/\bcotes?\b|rating/i);
      }
    }
  });

  it('pluriels et tutoiement', () => {
    expect(traduireEmulation('fr', 'jour.reussi', { n: 1 })).toBe('Réussi en 1 essai');
    expect(traduireEmulation('fr', 'jour.reussi', { n: 3 })).toBe('Réussi en 3 essais');
    expect(traduireEmulation('en', 'semaine.amis.battu', { pseudo: 'Léa', n: 2 })).toBe('You beat Léa 2 times.');
    expect(traduireEmulation('fr', 'semaine.amis.battu', { pseudo: 'Léa', n: 2 })).toBe('Tu as battu Léa 2 fois.');
    expect(traduireEmulation('fr', 'semaine.obj.problemes', { n: 5 })).toBe('Réussis 5 problèmes');
  });

  it('le composant du Go du jour n’affiche pas de cote (lu dans le code, comme sansCote.test.ts)', () => {
    const src = readFileSync(new URL('../ui/AmisDuJour.tsx', import.meta.url), 'utf8');
    const appels = [...src.matchAll(/\bte\(\s*'([^']+)'/g)].map(m => m[1]);
    expect(appels.length).toBeGreaterThan(5);
    expect(appels.every(k => k.startsWith('jour.'))).toBe(true);
  });
});
