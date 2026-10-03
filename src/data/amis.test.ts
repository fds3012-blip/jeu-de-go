import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from './supabase';
import {
  CODES_AMIS, defierAmi, demanderAmi, grouperAmis, lireAmis, mesAmis, messageAmi, pseudoSaisi, refusAmi, repondreAmi, retirerAmi
} from './amis';
import { traduire } from '../content/i18n';
import { CATALOGUE_AMIS, traduireAmis, type CleAmis } from '../content/i18n/amis';
import { fr } from '../content/i18n/fr';

/** Client Supabase simulé : seulement `rpc`, comme le reste de la couche amis. */
function client(reponses: Record<string, { data: unknown; error: unknown }> = {}) {
  const rpc = vi.fn(async (nom: string) => reponses[nom] ?? { data: null, error: null });
  return { db: { rpc } as unknown as Db, rpc };
}
const refus = (code: string) => ({ data: null, error: { code, message: 'texte brut du serveur', details: null, hint: null } });

describe('pseudo saisi', () => {
  it('garde un pseudo valide, sans espaces autour ni @', () => {
    expect(pseudoSaisi('  Bruno ')).toBe('Bruno');
    expect(pseudoSaisi('@ami_du-go')).toBe('ami_du-go');
  });
  it('refuse ce qui ne peut pas être un pseudo (e-mail, trop court, trop long, espaces)', () => {
    expect(pseudoSaisi('bruno@exemple.test')).toBeNull();
    expect(pseudoSaisi('ab')).toBeNull();
    expect(pseudoSaisi('a'.repeat(25))).toBeNull();
    expect(pseudoSaisi('deux mots')).toBeNull();
    expect(pseudoSaisi('')).toBeNull();
  });
});

describe('refus du serveur', () => {
  it('reconnaît chaque code de la migration, et ceux du compte obligatoire (#343)', () => {
    expect(refusAmi({ code: 'JGA01' })).toBe('introuvable');
    expect(refusAmi({ code: 'JGA05' })).toBe('limiteJour');
    expect(refusAmi({ code: 'JGA09' })).toBe('tropDeParties');
    expect(refusAmi({ code: 'JGC01' })).toBe('compte');
    expect(refusAmi({ code: 'JGP01' })).toBe('compte');
    expect(refusAmi({ code: '42501' })).toBeNull();
    expect(refusAmi(null)).toBeNull();
  });

  it('chaque code de la migration a son message, en français et en anglais', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261002010100_amis.sql'), 'utf8');
    const codes = [...new Set([...sql.matchAll(/errcode = '(JGA\d\d)'/g)].map(m => m[1]))].sort();
    expect(codes).toEqual(Object.keys(CODES_AMIS).filter(c => c.startsWith('JGA')).sort());
    for (const refus of Object.values(CODES_AMIS)) {
      expect(traduireAmis('fr', `amis.erreur.${refus}`)).not.toBe('');
      expect(traduireAmis('en', `amis.erreur.${refus}`)).not.toBe(traduireAmis('fr', `amis.erreur.${refus}`));
    }
  });

  it('ne montre jamais le texte brut du serveur', () => {
    expect(messageAmi({ code: 'JGA02', message: 'C’est ton propre pseudo' })).toBe(traduireAmis('fr', 'amis.erreur.toiMeme'));
    expect(messageAmi({ code: 'XX000', message: 'detail interne' })).toBe(traduire('fr', 'erreur.serveur'));
  });
});

describe('lecture de la liste', () => {
  const lignes = [
    { pseudo: 'zoe', etat: 'ami', depuis: '2026-10-01T10:00:00Z' },
    { pseudo: 'Bruno', etat: 'recue', depuis: '2026-10-02T10:00:00Z' },
    { pseudo: 'Alice', etat: 'ami', depuis: '2026-09-30T10:00:00Z' },
    { pseudo: 'Chloe', etat: 'envoyee', depuis: '2026-10-02T11:00:00Z' },
    { pseudo: 'Inconnu', etat: 'bloque' },
    { etat: 'ami' },
    null,
  ];

  it('ignore les lignes mal formées', () => {
    expect(lireAmis(lignes).map(a => a.pseudo)).toEqual(['zoe', 'Bruno', 'Alice', 'Chloe']);
    expect(lireAmis(null)).toEqual([]);
    expect(lireAmis({ pseudo: 'x' })).toEqual([]);
  });

  it('groupe : demandes reçues, amis, demandes envoyées, chacun par pseudo sans tenir compte des majuscules', () => {
    const g = grouperAmis(lireAmis(lignes));
    expect(g.recue.map(a => a.pseudo)).toEqual(['Bruno']);
    expect(g.ami.map(a => a.pseudo)).toEqual(['Alice', 'zoe']);
    expect(g.envoyee.map(a => a.pseudo)).toEqual(['Chloe']);
  });

  it('ne garde que pseudo, état et date : jamais d’identifiant ni d’e-mail', () => {
    const [a] = lireAmis([{ pseudo: 'Alice', etat: 'ami', depuis: 'x', id: 'uuid', email: 'a@b.c' }]);
    expect(Object.keys(a).sort()).toEqual(['depuis', 'etat', 'pseudo']);
  });
});

describe('textes de l’écran « Mes amis » (catalogue chargé avec l’écran)', () => {
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  it('anglais : mêmes clés et mêmes variables que le français, aucun texte vide', () => {
    expect(Object.keys(CATALOGUE_AMIS.en).sort()).toEqual(Object.keys(CATALOGUE_AMIS.fr).sort());
    for (const [cle, texte] of Object.entries(CATALOGUE_AMIS.fr) as [CleAmis, string][]) {
      expect(texte, cle).not.toBe('');
      expect(CATALOGUE_AMIS.en[cle], cle).not.toBe('');
      expect(vars(CATALOGUE_AMIS.en[cle]), cle).toEqual(vars(texte));
    }
  });
  it('« défi » seulement sous `defi.` (charte du vocabulaire), aucune clé en double avec le catalogue principal', () => {
    const avecDefi = Object.entries(CATALOGUE_AMIS.fr).filter(([, s]) => /(^|[^\p{L}])défi(er|s)?([^\p{L}]|$)/iu.test(s)).map(([k]) => k);
    expect(avecDefi.filter(k => !k.startsWith('defi.'))).toEqual([]);
    expect(Object.keys(CATALOGUE_AMIS.fr).filter(k => k in fr)).toEqual([]);
  });
  it('remplace les variables', () => {
    expect(traduireAmis('fr', 'amis.envoyee', { pseudo: 'Bruno' })).toContain('Bruno');
    expect(traduireAmis('en', 'amis.devenusAmis', { pseudo: 'Bruno' })).toBe('You and Bruno are now friends.');
  });
});

describe('vie privée (#359)', () => {
  const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261002010100_amis.sql'), 'utf8');
  const politique = readFileSync(resolve(__dirname, '../../docs/juridique/politique-confidentialite.md'), 'utf8');

  it('le journal des demandes part avec le compte (cascade) et après 30 jours', () => {
    expect(sql).toMatch(/demandeur_id uuid not null references public\.profiles\(id\) on delete cascade/);
    expect(sql).toMatch(/destinataire_id uuid not null references public\.profiles\(id\) on delete cascade/);
    expect(sql).toMatch(/envoyee_le < now\(\) - interval '30 days'/);
  });

  it('la politique décrit les amis, le journal de 30 jours et l’effacement avec le compte', () => {
    expect(politique).toContain('| **Amis** (#359) |');
    expect(politique).toContain('Journal : **30 jours**');
    expect(politique).toMatch(/\*\*effacés avec le compte\*\*/);
    expect(politique).toContain('tes amitiés et tes demandes d\'ami');
  });

  it('aucune fonction des amis ne renvoie d’identifiant ni d’e-mail', () => {
    expect(sql).toMatch(/returns table \(pseudo text, etat text, depuis timestamptz\)/);
    expect(sql).not.toMatch(/email/i);
  });
});

describe('appels au serveur', () => {
  it('mesAmis lit mes_amis', async () => {
    const c = client({ mes_amis: { data: [{ pseudo: 'Alice', etat: 'ami', depuis: 'd' }], error: null } });
    expect(await mesAmis(c.db)).toEqual({ ok: true, value: [{ pseudo: 'Alice', etat: 'ami', depuis: 'd' }] });
    expect(c.rpc).toHaveBeenCalledWith('mes_amis');
  });

  it('mesAmis : erreur claire', async () => {
    const c = client({ mes_amis: refus('JGP01') });
    expect(await mesAmis(c.db)).toEqual({ ok: false, error: traduireAmis('fr', 'amis.erreur.compte') });
  });

  it('demanderAmi envoie le pseudo nettoyé, et rend « envoyée » ou « amis »', async () => {
    const c = client({ demander_ami: { data: 'envoyee', error: null } });
    expect(await demanderAmi(c.db, ' @Bruno ')).toEqual({ ok: true, value: 'envoyee' });
    expect(c.rpc).toHaveBeenCalledWith('demander_ami', { p_pseudo: 'Bruno' });
    const croisee = client({ demander_ami: { data: 'amis', error: null } });
    expect(await demanderAmi(croisee.db, 'Bruno')).toEqual({ ok: true, value: 'amis' });
  });

  it('demanderAmi : pseudo impossible refusé sans appeler le serveur', async () => {
    const c = client();
    expect(await demanderAmi(c.db, 'bruno@exemple.test')).toEqual({ ok: false, error: traduireAmis('fr', 'amis.erreur.introuvable') });
    expect(c.rpc).not.toHaveBeenCalled();
  });

  it('demanderAmi : refus du serveur (doublon, limite du jour)', async () => {
    expect(await demanderAmi(client({ demander_ami: refus('JGA04') }).db, 'Bruno')).toEqual({ ok: false, error: traduireAmis('fr', 'amis.erreur.dejaEnvoyee') });
    expect(await demanderAmi(client({ demander_ami: refus('JGA05') }).db, 'Bruno')).toEqual({ ok: false, error: traduireAmis('fr', 'amis.erreur.limiteJour') });
  });

  it('demanderAmi : réponse inattendue = erreur', async () => {
    expect((await demanderAmi(client({ demander_ami: { data: 'autre', error: null } }).db, 'Bruno')).ok).toBe(false);
  });

  it('repondreAmi accepte ou refuse', async () => {
    const c = client({ repondre_ami: { data: 'amis', error: null } });
    expect(await repondreAmi(c.db, 'Alice', true)).toEqual({ ok: true, value: 'amis' });
    expect(c.rpc).toHaveBeenCalledWith('repondre_ami', { p_pseudo: 'Alice', p_accepter: true });
    const r = client({ repondre_ami: { data: 'refusee', error: null } });
    expect(await repondreAmi(r.db, 'Alice', false)).toEqual({ ok: true, value: 'refusee' });
    expect(r.rpc).toHaveBeenCalledWith('repondre_ami', { p_pseudo: 'Alice', p_accepter: false });
    expect(await repondreAmi(client({ repondre_ami: refus('JGA07') }).db, 'Alice', true)).toEqual({ ok: false, error: traduireAmis('fr', 'amis.erreur.aucuneDemande') });
  });

  it('retirerAmi', async () => {
    const c = client({ retirer_ami: { data: null, error: null } });
    expect(await retirerAmi(c.db, 'Alice')).toEqual({ ok: true, value: null });
    expect(c.rpc).toHaveBeenCalledWith('retirer_ami', { p_pseudo: 'Alice' });
    expect((await retirerAmi(client({ retirer_ami: refus('JGC01') }).db, 'Alice')).ok).toBe(false);
  });

  it('defierAmi rend la partie créée par le serveur', async () => {
    const c = client({ defier_ami: { data: '22222222-2222-4222-8222-000000000001', error: null } });
    expect(await defierAmi(c.db, 'Alice')).toEqual({ ok: true, value: '22222222-2222-4222-8222-000000000001' });
    expect(c.rpc).toHaveBeenCalledWith('defier_ami', { p_pseudo: 'Alice' });
    expect(await defierAmi(client({ defier_ami: refus('JGA08') }).db, 'Alice')).toEqual({ ok: false, error: traduireAmis('fr', 'amis.erreur.pasAmi') });
    expect(await defierAmi(client({ defier_ami: refus('JGA09') }).db, 'Alice')).toEqual({ ok: false, error: traduireAmis('fr', 'amis.erreur.tropDeParties') });
    expect((await defierAmi(client({ defier_ami: { data: null, error: null } }).db, 'Alice')).ok).toBe(false);
  });
});
