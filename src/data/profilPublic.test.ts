// Profil public d'un joueur (issue #560) : lecture tolérante de la réponse du serveur, refus connus, appel.
import { describe, expect, it, vi } from 'vitest';
import { CODES_PROFIL_PUBLIC, lireProfilPublic, messageProfilPublic, profilPublic, refusProfilPublic } from './profilPublic';
import type { Db } from './supabase';

const REPONSE = {
  pseudo: 'Bruno', cote: 1620, provisoire: false, parties_classees: 6, lien: 'aucun',
  parties: [
    { adversaire: 'Alice', toi: true, gagnee: true, le: '2026-10-15', taille: 9, couleur: 'noir' },
    { adversaire: 'Eve', toi: false, gagnee: false, le: '2026-10-14', taille: 13, couleur: 'blanc' },
    { adversaire: null, toi: false, gagnee: null, le: '2026-10-13', taille: 19, couleur: 'noir' },
  ],
};

describe('lireProfilPublic', () => {
  it('lit un profil complet', () => {
    const p = lireProfilPublic(REPONSE)!;
    expect(p.pseudo).toBe('Bruno');
    expect(p.cote).toBe(1620);
    expect(p.provisoire).toBe(false);
    expect(p.partiesClassees).toBe(6);
    expect(p.lien).toBe('aucun');
    expect(p.parties).toHaveLength(3);
    expect(p.parties[0]).toEqual({ adversaire: 'Alice', toi: true, gagnee: true, le: '2026-10-15', taille: 9, couleur: 'noir' });
    expect(p.parties[2].adversaire).toBeNull();
    expect(p.parties[2].gagnee).toBeNull();
  });

  it('rien pour null, un tableau, un objet sans pseudo', () => {
    expect(lireProfilPublic(null)).toBeNull();
    expect(lireProfilPublic([])).toBeNull();
    expect(lireProfilPublic({ cote: 1200 })).toBeNull();
    expect(lireProfilPublic({ pseudo: '' })).toBeNull();
  });

  it('tolère ce qui manque ou est mal formé, et borne les parties à 5', () => {
    const p = lireProfilPublic({ pseudo: 'Léa', cote: '1200', lien: 'bizarre', parties: [
      { le: 'hier', taille: 9 }, { le: '2026-10-10', taille: 3 }, { le: '2026-10-10', taille: 9 },
      ...Array.from({ length: 6 }, (_, i) => ({ le: `2026-10-0${i + 1}`, taille: 9, couleur: 'blanc', gagnee: 'oui' })),
    ] })!;
    expect(p.cote).toBe(0);
    expect(p.provisoire).toBe(false);
    expect(p.partiesClassees).toBe(0);
    expect(p.lien).toBe('aucun');
    expect(p.parties).toHaveLength(5);
    expect(p.parties[0]).toEqual({ adversaire: null, toi: false, gagnee: null, le: '2026-10-10', taille: 9, couleur: 'noir' });
    expect(p.parties[1].couleur).toBe('blanc');
    expect(p.parties[1].gagnee).toBeNull();
  });

  it('connaît les cinq liens', () => {
    for (const lien of ['aucun', 'envoyee', 'recue', 'amis', 'moi']) expect(lireProfilPublic({ pseudo: 'X', lien })!.lien).toBe(lien);
  });
});

describe('refus du serveur', () => {
  it('JGV01 : trop de consultations, avec les minutes à attendre en indice', () => {
    expect(refusProfilPublic({ code: 'JGV01' })).toBe('tropVite');
    expect(messageProfilPublic({ code: 'JGV01', hint: '12' })).toContain('12 min');
    expect(messageProfilPublic({ code: 'JGV01' })).toContain('1 min');
  });
  it('compte ou pseudo exigé : un seul message', () => {
    expect(CODES_PROFIL_PUBLIC.JGC01).toBe('compte');
    expect(CODES_PROFIL_PUBLIC.JGP01).toBe('compte');
    expect(messageProfilPublic({ code: 'JGP01' })).toMatch(/compte/);
  });
  it('erreur inconnue : message générique, jamais le texte brut du serveur', () => {
    expect(refusProfilPublic({ code: 'XX000', message: 'relation profiles' })).toBeNull();
    expect(messageProfilPublic({ code: 'XX000', message: 'relation profiles' })).not.toContain('relation');
    expect(messageProfilPublic(undefined)).toBeTruthy();
  });
});

describe('profilPublic', () => {
  const faux = (reponse: { data?: unknown; error?: unknown }) => {
    const rpc = vi.fn().mockResolvedValue({ data: reponse.data ?? null, error: reponse.error ?? null });
    return { db: { rpc } as unknown as Db, rpc };
  };

  it('appelle profil_public avec le pseudo nettoyé (@ et espaces retirés)', async () => {
    const { db, rpc } = faux({ data: REPONSE });
    const r = await profilPublic(db, ' @Bruno ');
    expect(rpc).toHaveBeenCalledWith('profil_public', { p_pseudo: 'Bruno' });
    expect(r.ok && r.value?.pseudo).toBe('Bruno');
  });

  it('un pseudo qui ne peut pas en être un : indisponible, sans appel', async () => {
    const { db, rpc } = faux({ data: REPONSE });
    const r = await profilPublic(db, 'a b@c');
    expect(rpc).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, value: null });
  });

  it('null du serveur (inconnu ou blocage, sans distinction) : indisponible', async () => {
    const r = await profilPublic(faux({ data: null }).db, 'Personne');
    expect(r).toEqual({ ok: true, value: null });
  });

  it('erreur du serveur : message clair', async () => {
    const r = await profilPublic(faux({ error: { code: 'JGV01', hint: '3' } }).db, 'Bruno');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('3 min');
  });
});
