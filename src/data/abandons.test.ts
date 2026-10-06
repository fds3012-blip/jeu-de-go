import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { attenteDuRefus, etatAbandons, lireEtatAbandons, plafondDuRefus, restantMs, texteDelai, texteRestant } from './abandons';
import { chercherAdversaire, refusDirect } from './direct';
import { refusLente } from './lente';
import { CATALOGUE_DIRECT } from '../content/i18n/direct';
import { CATALOGUE_LENTE } from '../content/i18n/lente';
import type { Db } from './supabase';

// Issue #442 : abandons répétés. La règle est au serveur (migration 20261006150100_abandons_repetes.sql, testée par
// supabase/tests/abandons_repetes.test.sql) ; ici, la lecture de ses réponses et les textes de l'écran.

const MAINTENANT = '2026-10-06T18:00:00Z';
const T = Date.parse(MAINTENANT);

describe('lireEtatAbandons', () => {
  it('lit l’attente en cours et l’écart avec l’heure du serveur', () => {
    const e = lireEtatAbandons({ direct_abandons: 3, direct_jusqu_a: '2026-10-06T18:05:00Z', direct_delai_min: 5, direct_prochain_min: 30,
      lentes_expirees: 0, lentes_plafond: 10, maintenant: MAINTENANT }, T - 2000);
    expect(e).toEqual({ abandons: 3, attente: { jusqua: T + 300_000, delaiMin: 5 }, prochainMin: 30, lentesExpirees: 0, lentesPlafond: 10, ecart: 2000 });
  });
  it('sans attente (ou attente déjà passée) : null ; prochain délai annoncé', () => {
    expect(lireEtatAbandons({ direct_abandons: 2, direct_jusqu_a: null, direct_prochain_min: 5, maintenant: MAINTENANT }, T)?.attente).toBeNull();
    expect(lireEtatAbandons({ direct_abandons: 3, direct_jusqu_a: '2026-10-06T17:59:00Z', direct_delai_min: 5, maintenant: MAINTENANT }, T)?.attente).toBeNull();
    expect(lireEtatAbandons({ direct_abandons: 2, direct_prochain_min: 5, maintenant: MAINTENANT }, T)?.prochainMin).toBe(5);
  });
  it('valeurs absentes : rien de grave (10 parties lentes, aucune partie quittée) ; réponse illisible : null', () => {
    expect(lireEtatAbandons({ maintenant: MAINTENANT }, T)).toMatchObject({ abandons: 0, attente: null, prochainMin: null, lentesPlafond: 10 });
    expect(lireEtatAbandons(null)).toBeNull();
    expect(lireEtatAbandons({ direct_abandons: 3 })).toBeNull();
    expect(lireEtatAbandons('x')).toBeNull();
  });
  it('etatAbandons : null si le serveur refuse (migration pas encore appliquée), sans bloquer l’écran', async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202' } }) } as unknown as Db;
    expect(await etatAbandons(db)).toBeNull();
    expect(db.rpc).toHaveBeenCalledWith('etat_abandons');
  });
});

describe('refus du serveur', () => {
  it('JGD01 : fin de l’attente (détail) et délai (indice)', () => {
    expect(attenteDuRefus({ code: 'JGD01', details: '2026-10-06T18:30:00Z', hint: '30' })).toEqual({ jusqua: T + 1_800_000, delaiMin: 30 });
    expect(attenteDuRefus({ code: 'JGL10' })).toBeNull();
    expect(attenteDuRefus(null)).toBeNull();
    // Détail illisible : le délai le plus court, l'écran relit l'état ensuite.
    const a = attenteDuRefus({ code: 'JGD01', details: 'n’importe quoi', hint: 'x' })!;
    expect(a.delaiMin).toBe(5);
    expect(a.jusqua).toBeGreaterThan(Date.now());
  });
  it('JGL11 : plafond réduit des parties lentes', () => {
    expect(plafondDuRefus({ code: 'JGL11', details: '5' })).toBe(5);
    expect(plafondDuRefus({ code: 'JGL11' })).toBe(2);
    expect(plafondDuRefus({ code: 'JGL10' })).toBeNull();
  });
  it('refusDirect et refusLente reconnaissent les nouveaux codes, sans changer les anciens', () => {
    expect(refusDirect({ code: 'JGD01' })).toBe('attente');
    expect(refusDirect({ code: 'P0002' })).toBe('introuvable');
    expect(refusLente({ code: 'JGL11' })).toBe('plafond');
    expect(refusLente({ code: 'JGL10' })).toBe('limite');
  });
  it('chercherAdversaire rend l’attente avec le refus', async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'JGD01', details: '2026-10-06T18:05:00Z', hint: '5' } }) } as unknown as Db;
    expect(await chercherAdversaire(db, 9, 'normale', 'japanese')).toEqual({ ok: false, error: 'attente', attente: { jusqua: T + 300_000, delaiMin: 5 } });
    const autre = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'P0002' } }) } as unknown as Db;
    expect(await chercherAdversaire(autre, 9, 'normale', 'japanese')).toEqual({ ok: false, error: 'introuvable', attente: null });
  });
});

describe('temps restant', () => {
  it('arrondi vers le haut, jamais négatif', () => {
    const a = { jusqua: T + 300_000, delaiMin: 5 };
    expect(restantMs(a, T)).toBe(300_000);
    expect(restantMs(a, T + 400_000)).toBe(0);
    expect(texteRestant(300_000)).toBe('5 min');
    expect(texteRestant(299_001)).toBe('5 min');
    expect(texteRestant(179_500)).toBe('3 min');
    expect(texteRestant(45_000)).toBe('45 s');
    expect(texteRestant(400)).toBe('1 s');
    expect(texteRestant(0)).toBe('0 s');
    expect(texteRestant(24 * 3600_000)).toBe('24 h');
    expect(texteRestant(90 * 60_000)).toBe('1 h 30');
    expect(texteRestant(61 * 60_000 + 1)).toBe('1 h 02');
  });
  it('délais de la règle : 5 min, 30 min, 24 h', () => {
    expect([5, 30, 1440].map(m => texteDelai(m))).toEqual(['5 min', '30 min', '24 h']);
  });
});

describe('textes', () => {
  const cles = (o: object, prefixe: string) => Object.keys(o).filter(k => k.startsWith(prefixe));
  it('chaque texte existe en français et en anglais, sans reproche ni majuscules criées', () => {
    for (const [fr, en, prefixes] of [[CATALOGUE_DIRECT.fr, CATALOGUE_DIRECT.en, ['direct.abandons.', 'direct.erreur.attente']],
      [CATALOGUE_LENTE.fr, CATALOGUE_LENTE.en, ['lente.plafond']]] as const) {
      for (const p of prefixes) {
        const k = cles(fr, p);
        expect(k.length).toBeGreaterThan(0);
        for (const c of k) {
          const f = (fr as Record<string, string>)[c], e = (en as Record<string, string>)[c];
          expect(e, c).toBeTruthy();
          expect(e, c).not.toBe(f);
          for (const t of [f, e]) {
            expect(t, c).not.toMatch(/[A-Z]{4,}|!{2,}/);
            expect(t, c).not.toMatch(/interdit|banned|punish|sanction/i);
            // Mêmes variables dans les deux langues.
            expect((t.match(/\{\w+\}/g) ?? []).sort(), c).toEqual((f.match(/\{\w+\}/g) ?? []).sort());
          }
        }
      }
    }
  });
  it('le message demandé par l’issue : « Tu as quitté plusieurs parties. Tu peux rejouer dans … »', () => {
    expect(CATALOGUE_DIRECT.fr['direct.abandons.titre']).toBe('Tu as quitté plusieurs parties.');
    expect(CATALOGUE_DIRECT.fr['direct.abandons.rejouer']).toBe('Tu peux rejouer en direct dans {temps}.');
    expect(CATALOGUE_DIRECT.fr['direct.abandons.ordi']).toBe('Jouer contre l’ordi en attendant');
  });
});

describe('migration', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261006150100_abandons_repetes.sql', import.meta.url), 'utf8');
  it('redéfinit find_match en gardant le blocage (#363) et ajoute l’attente', () => {
    const corps = sql.slice(sql.indexOf('create or replace function public.find_match'));
    expect(corps).toContain('not public.est_bloque(v_uid, q.user_id)');
    expect(corps).toContain("errcode = 'JGD01'");
    expect(corps).toContain('not public.en_attente_abandons(q.user_id)');
  });
  it('redéfinit lente_apparier en gardant le blocage, avec le plafond des deux joueurs', () => {
    const corps = sql.slice(sql.indexOf('create or replace function public.lente_apparier'));
    expect(corps).toContain('not public.est_bloque(p_uid, q.user_id)');
    expect(corps).toContain('public.lentes_en_cours(q.user_id) < public.plafond_lentes(q.user_id)');
  });
  it('RLS sur la nouvelle table, aucune écriture par l’app, search_path vide partout', () => {
    expect(sql).toContain('alter table public.abandons enable row level security;');
    expect(sql).toMatch(/revoke insert, update, delete, truncate.* on public\.abandons from authenticated/);
    const fonctions = sql.match(/create or replace function[\s\S]*?\$\$;/g) ?? [];
    expect(fonctions.length).toBeGreaterThanOrEqual(10);
    for (const f of fonctions) expect(f).toContain("set search_path = ''");
  });
});
