// #531 : refus « compte suspendu » (JGU01) et « pseudo interdit » (JGP02), lus partout où l'app parle au serveur.
import { afterEach, describe, expect, it } from 'vitest';
import { estSuspendu, finSuspension, CODE_SUSPENDU } from './suspension';
import { refusDirect } from './direct';
import { refusLente } from './lente';
import { messageAmi } from './amis';
import { messageSecurite } from './securite';
import { CODE_PSEUDO_INTERDIT, usernameErrorFromDb } from './username';
import { pseudoDisponible } from './account';
import type { Db } from './supabase';
import { choisirLangue } from '../content/i18n/secondaires';

const suspendu = (details = '2026-10-20T08:00:00Z') => ({ code: 'JGU01', message: 'Ton compte est suspendu', details });

afterEach(() => choisirLangue('fr'));

describe('compte suspendu (JGU01)', () => {
  it('reconnaît le refus et lit la fin de la suspension', () => {
    expect(CODE_SUSPENDU).toBe('JGU01');
    expect(estSuspendu(suspendu())).toBe(true);
    expect(estSuspendu({ code: 'JGB01' })).toBe(false);
    expect(estSuspendu(null)).toBe(false);
    expect(finSuspension(suspendu())?.toISOString()).toBe('2026-10-20T08:00:00.000Z');
    expect(finSuspension(suspendu(''))).toBeNull();
    expect(finSuspension(suspendu('demain'))).toBeNull();
    expect(finSuspension({ code: 'JGB01', details: '2026-10-20T08:00:00Z' })).toBeNull();
  });

  it('chaque écran en ligne a son refus « suspendu », jamais le message générique', () => {
    expect(refusDirect(suspendu())).toBe('suspendu');
    expect(refusLente(suspendu())).toBe('suspendu');
    for (const message of [messageAmi(suspendu()), messageSecurite(suspendu())]) {
      expect(message).toMatch(/Ton compte est suspendu/);
      expect(message).toMatch(/ordi, les leçons/);
    }
  });

  it('en anglais aussi', () => {
    choisirLangue('en');
    expect(messageAmi(suspendu())).toMatch(/Your account is suspended: nothing online/);
    expect(messageSecurite(suspendu())).toMatch(/Your account is suspended: nothing online/);
  });
});

describe('pseudo interdit (JGP02)', () => {
  it('refus lisible à l’enregistrement, en français et en anglais', () => {
    expect(CODE_PSEUDO_INTERDIT).toBe('JGP02');
    expect(usernameErrorFromDb('JGP02')).toBe('Ce pseudo n’est pas accepté. Choisis-en un autre, sans gros mot ni nom de l’équipe.');
    choisirLangue('en');
    expect(usernameErrorFromDb('JGP02')).toMatch(/isn’t allowed/);
  });

  function client(autorise: { data: unknown; error: unknown } | Error) {
    const chaine = { select: () => chaine, ilike: () => chaine, neq: () => chaine, limit: async () => ({ data: [], error: null }) };
    const rpc = async () => { if (autorise instanceof Error) throw autorise; return autorise; };
    return { from: () => chaine, rpc } as unknown as Db;
  }

  it('dit le refus pendant la saisie, sans attendre l’enregistrement', async () => {
    expect(await pseudoDisponible(client({ data: false, error: null }), 'GrosConnard'))
      .toEqual({ ok: false, error: 'Ce pseudo n’est pas accepté. Choisis-en un autre, sans gros mot ni nom de l’équipe.', raison: 'interdit' });
    expect(await pseudoDisponible(client({ data: true, error: null }), 'Conan')).toEqual({ ok: true, value: true });
  });

  it('serveur sans la fonction ou réseau coupé : pas de refus inventé (l’enregistrement revérifie)', async () => {
    expect(await pseudoDisponible(client({ data: null, error: { code: 'PGRST202' } }), 'Conan')).toEqual({ ok: true, value: true });
    expect(await pseudoDisponible(client(new Error('réseau')), 'Conan')).toEqual({ ok: true, value: true });
  });
});
