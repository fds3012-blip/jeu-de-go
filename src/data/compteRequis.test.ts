import { describe, expect, it, vi } from 'vitest';
import { apercuDefi, compteRequis, lireApercu } from './compteRequis';
import type { Db } from './supabase';

describe('compteRequis', () => {
  it('reconnaît les deux refus du serveur', () => {
    expect(compteRequis({ code: 'JGC01', message: 'Crée ton compte…' })).toBe('compte');
    expect(compteRequis({ code: 'JGP01', message: 'Choisis ton pseudo…' })).toBe('pseudo');
  });
  it('ignore les autres erreurs', () => {
    expect(compteRequis({ code: '42501' })).toBeNull();
    expect(compteRequis({ code: 'P0002' })).toBeNull();
    expect(compteRequis(null)).toBeNull();
    expect(compteRequis(undefined)).toBeNull();
    expect(compteRequis('JGC01')).toBeNull();
  });
});

describe('lireApercu', () => {
  it('convertit une ligne valide', () => {
    expect(lireApercu({ createur_pseudo: 'Alice', taille: 9, etat: 'libre', ma_place: null }))
      .toEqual({ createurPseudo: 'Alice', taille: 9, etat: 'libre', maPlace: null });
    expect(lireApercu({ createur_pseudo: null, taille: 9, etat: 'pris', ma_place: 'invite' }))
      .toEqual({ createurPseudo: null, taille: 9, etat: 'pris', maPlace: 'invite' });
  });
  it('refuse une ligne absente ou mal formée', () => {
    expect(lireApercu(null)).toBeNull();
    expect(lireApercu({ taille: 9, etat: 'inconnu' })).toBeNull();
    expect(lireApercu({ taille: '9', etat: 'libre' })).toBeNull();
    expect(lireApercu({ taille: 9, etat: 'libre', ma_place: 'autre' })?.maPlace).toBeNull();
  });
});

describe('apercuDefi', () => {
  const db = (reponse: { data: unknown; error: { message: string } | null }) => {
    const rpc = vi.fn().mockResolvedValue(reponse);
    return { db: { rpc } as unknown as Db, rpc };
  };
  it('appelle apercu_defi avec le jeton', async () => {
    const { db: d, rpc } = db({ data: [{ createur_pseudo: 'Alice', taille: 9, etat: 'libre', ma_place: null }], error: null });
    const r = await apercuDefi(d, 'A'.repeat(32));
    expect(rpc).toHaveBeenCalledWith('apercu_defi', { p_jeton: 'A'.repeat(32) });
    expect(r).toEqual({ ok: true, value: { createurPseudo: 'Alice', taille: 9, etat: 'libre', maPlace: null } });
  });
  it('lien inconnu : null ; erreur : message', async () => {
    expect(await apercuDefi(db({ data: [], error: null }).db, 'x')).toEqual({ ok: true, value: null });
    expect(await apercuDefi(db({ data: null, error: { message: 'hors ligne' } }).db, 'x')).toEqual({ ok: false, error: 'hors ligne' });
  });
});
