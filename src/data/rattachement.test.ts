import { describe, expect, it, vi } from 'vitest';
import {
  CLE_RATTACHEMENT, DUREE_CODE_MS, FORMAT_CODE_RATTACHEMENT, garderCodeRattachement, lireCodeRattachement,
  oublierCodeRattachement, preparerRattachement, rattacherSessionAnonyme
} from './rattachement';
import type { Db } from './supabase';

const CODE = 'abcdefghijklmnopqrstuvwxyz012345';

const db = (reponse: { data: unknown; error: { message: string; code?: string } | null }) => {
  const rpc = vi.fn().mockResolvedValue(reponse);
  return { db: { rpc } as unknown as Db, rpc };
};

function memoire(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size; }
  };
}

describe('preparerRattachement', () => {
  it('appelle preparer_rattachement et rend le code', async () => {
    const { db: d, rpc } = db({ data: CODE, error: null });
    expect(await preparerRattachement(d)).toEqual({ ok: true, value: CODE });
    expect(rpc).toHaveBeenCalledWith('preparer_rattachement');
  });
  it('échoue si le serveur refuse (vrai compte : 42501) ou rend autre chose qu’un code', async () => {
    expect((await preparerRattachement(db({ data: null, error: { message: 'Réservé aux sessions sans compte', code: '42501' } }).db)).ok).toBe(false);
    expect((await preparerRattachement(db({ data: 'court', error: null }).db)).ok).toBe(false);
  });
});

describe('rattacherSessionAnonyme', () => {
  it('présente le code et rend le nombre de parties déplacées', async () => {
    const { db: d, rpc } = db({ data: 3, error: null });
    expect(await rattacherSessionAnonyme(d, CODE)).toEqual({ ok: true, value: 3 });
    expect(rpc).toHaveBeenCalledWith('rattacher_session_anonyme', { p_code: CODE });
  });
  it('refuse un code mal formé sans appeler le serveur, et rend une erreur si le serveur refuse', async () => {
    const { db: d, rpc } = db({ data: null, error: { message: 'Code de rattachement inconnu ou expiré', code: 'P0002' } });
    expect((await rattacherSessionAnonyme(d, 'xx')).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect((await rattacherSessionAnonyme(d, CODE)).ok).toBe(false);
  });
});

describe('code gardé sur l’appareil', () => {
  it('garde puis relit le code tant qu’il a moins de 15 minutes', () => {
    const s = memoire();
    garderCodeRattachement(CODE, s, 1000);
    expect(JSON.parse(s.getItem(CLE_RATTACHEMENT)!)).toEqual({ code: CODE, le: 1000 });
    expect(lireCodeRattachement(s, 1000 + DUREE_CODE_MS - 1)).toBe(CODE);
  });
  it('oublie un code périmé, illisible, mal formé ou venu du futur', () => {
    const s = memoire();
    garderCodeRattachement(CODE, s, 1000);
    expect(lireCodeRattachement(s, 1000 + DUREE_CODE_MS)).toBeNull();
    expect(s.getItem(CLE_RATTACHEMENT)).toBeNull();
    s.setItem(CLE_RATTACHEMENT, 'pas du JSON');
    expect(lireCodeRattachement(s, 5000)).toBeNull();
    s.setItem(CLE_RATTACHEMENT, JSON.stringify({ code: 'court', le: 1000 }));
    expect(lireCodeRattachement(s, 5000)).toBeNull();
    garderCodeRattachement(CODE, s, 9000);
    expect(lireCodeRattachement(s, 5000)).toBeNull();
  });
  it('ne garde pas un code mal formé, et oublierCodeRattachement efface', () => {
    const s = memoire();
    garderCodeRattachement('xx', s, 1000);
    expect(s.getItem(CLE_RATTACHEMENT)).toBeNull();
    garderCodeRattachement(CODE, s, 1000);
    oublierCodeRattachement(s);
    expect(lireCodeRattachement(s, 1000)).toBeNull();
  });
  it('sans stockage (navigation privée stricte), tout est sans effet', () => {
    garderCodeRattachement(CODE, null, 1000);
    expect(lireCodeRattachement(null, 1000)).toBeNull();
    oublierCodeRattachement(null);
  });
  it('la forme du code est celle du jeton de défi (32 caractères base64url)', () => {
    expect(FORMAT_CODE_RATTACHEMENT.test(CODE)).toBe(true);
    expect(FORMAT_CODE_RATTACHEMENT.test(CODE + 'a')).toBe(false);
    expect(FORMAT_CODE_RATTACHEMENT.test('abc+defghijklmnopqrstuvwxyz01234')).toBe(false);
  });
});
