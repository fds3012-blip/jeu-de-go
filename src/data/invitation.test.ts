// Inviter un ami (#729) : le lien, le code gardé sur l'appareil, et ce que le client fait des réponses du serveur.
// Les règles (plafond, vraie action, anti-abus) sont testées côté SQL : supabase/tests/invitations.test.sql.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.fn();
const memoire = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => { memoire.set(k, v); },
  removeItem: (k: string) => { memoire.delete(k); }, clear: () => memoire.clear(),
});
vi.mock('./analytics', async orig => ({ ...(await orig<typeof import('./analytics')>()), track: (...a: unknown[]) => track(...a) }));

const inv = await import('./invitation');
const { themeDebloque } = await import('../app/xp');
const { lireBadges, BADGES_KEY } = await import('../app/badgesGagnes');
import type { Db } from './supabase';

const CODE = 'abcdefghijklmnopqrstuvwxyzABCD_-';
const JOUR = 86_400_000;
const garder = (c = CODE, t = Date.now()) => localStorage.setItem(inv.INVITATION_KEY, JSON.stringify({ c, t }));
const db = (reponse: { data?: unknown; error?: unknown }) => ({ rpc: vi.fn().mockResolvedValue({ data: null, error: null, ...reponse }) }) as unknown as Db & { rpc: ReturnType<typeof vi.fn> };

beforeEach(() => { memoire.clear(); track.mockClear(); });

describe('lien et code', () => {
  it('le lien porte le code dans le fragment, jamais dans le chemin ni la requête', () => {
    expect(inv.lienInvitation(CODE, 'fr')).toBe(`https://mochi-go.app/i#${CODE}`);
    expect(inv.lienInvitation(CODE, 'en')).toBe(`https://mochi-go.app/en/i#${CODE}`);
    const u = new URL(inv.lienInvitation(CODE, 'fr'));
    expect(u.pathname + u.search).toBe('/i');
  });

  it('le code gardé doit être bien formé et récent', () => {
    expect(inv.codeGarde()).toBeNull();
    garder();
    expect(inv.codeGarde()?.code).toBe(CODE);
    garder(CODE, Date.now() - 31 * JOUR);
    expect(inv.codeGarde()).toBeNull();
    garder('trop-court');
    expect(inv.codeGarde()).toBeNull();
    localStorage.setItem(inv.INVITATION_KEY, 'pas du json');
    expect(inv.codeGarde()).toBeNull();
  });

  it('les cadeaux lus ne gardent que ceux qui existent', () => {
    expect(inv.lireCadeaux(['jade', 'or', 3, 'cerisier'])).toEqual(['cerisier', 'jade']);
    expect(inv.lireCadeaux('cerisier')).toEqual([]);
    expect(inv.lireCadeaux(null)).toEqual([]);
  });
});

describe('cadeaux sur l’appareil', () => {
  it('ouvrent le goban et les pierres sans le niveau, et seulement ceux reçus', () => {
    expect(themeDebloque('cerisier', 1)).toBe(false);
    expect(themeDebloque('jade', 1)).toBe(false);
    inv.noterCadeaux(['cerisier']);
    expect(themeDebloque('cerisier', 1)).toBe(true);
    expect(themeDebloque('jade', 1)).toBe(false);
    expect(themeDebloque('kaya', 1)).toBe(true);
    inv.noterCadeaux(['jade']);
    expect(themeDebloque('jade', 1)).toBe(true);
    expect(inv.cadeauxAppareil()).toEqual(['cerisier', 'jade']);
  });

  it('un cadeau n’est jamais retiré ; une valeur abîmée ne casse rien', () => {
    inv.noterCadeaux(['jade']);
    inv.noterCadeaux([]);
    expect(inv.cadeauxAppareil()).toEqual(['jade']);
    localStorage.setItem(inv.CADEAUX_KEY, '{"x":1}');
    expect(themeDebloque('cerisier', 1)).toBe(false);
    expect(inv.cadeauxAppareil()).toEqual([]);
  });
});

describe('valider l’invitation gardée', () => {
  it('sans code : rien n’est demandé', async () => {
    const d = db({});
    expect(await inv.validerInvitationGardee(d)).toBeNull();
    expect(d.rpc).not.toHaveBeenCalled();
  });

  it('en attente (pas encore de vraie partie) : le code reste, rien n’est donné ni mesuré', async () => {
    garder();
    const d = db({ data: [{ statut: 'attente', cadeaux: [] }] });
    expect(await inv.validerInvitationGardee(d)).toBe('attente');
    expect(d.rpc).toHaveBeenCalledWith('valider_invitation', { p_code: CODE });
    expect(inv.codeGarde()?.code).toBe(CODE);
    expect(inv.cadeauxAppareil()).toEqual([]);
    expect(track).not.toHaveBeenCalled();
  });

  it('validée : cadeaux et badge « invité », mesure sans le code, code effacé', async () => {
    garder(CODE, Date.now() - 2 * JOUR - 1000);
    expect(await inv.validerInvitationGardee(db({ data: [{ statut: 'validee', cadeaux: ['cerisier'] }] }))).toBe('validee');
    expect(inv.cadeauxAppareil()).toEqual(['cerisier']);
    expect(lireBadges(JSON.parse(memoire.get(BADGES_KEY)!))).toEqual(['invite']);
    expect(track).toHaveBeenCalledWith('invitation_validee', { jours: 2 });
    expect(JSON.stringify(track.mock.calls)).not.toContain(CODE);
    expect(inv.codeGarde()).toBeNull();
  });

  it('déjà validée : on garde les cadeaux sans remesurer ; complet et invalide : on oublie le code', async () => {
    garder();
    expect(await inv.validerInvitationGardee(db({ data: [{ statut: 'deja', cadeaux: ['cerisier'] }] }))).toBe('deja');
    expect(inv.cadeauxAppareil()).toEqual(['cerisier']);
    expect(track).not.toHaveBeenCalledWith('invitation_validee', expect.anything());
    expect(inv.codeGarde()).toBeNull();
    for (const statut of ['complet', 'invalide']) {
      garder();
      expect(await inv.validerInvitationGardee(db({ data: [{ statut, cadeaux: [] }] }))).toBe(statut);
      expect(inv.codeGarde()).toBeNull();
    }
    expect(track).not.toHaveBeenCalledWith('invitation_validee', expect.anything());
  });

  it('erreur (hors ligne, compte sans pseudo) ou réponse illisible : le code reste, on réessaiera', async () => {
    garder();
    expect(await inv.validerInvitationGardee(db({ error: { code: 'JGP01' } }))).toBeNull();
    expect(await inv.validerInvitationGardee(db({ data: [{ statut: 'inconnu' }] }))).toBeNull();
    expect(await inv.validerInvitationGardee(db({ data: [] }))).toBeNull();
    expect(inv.codeGarde()?.code).toBe(CODE);
  });

  it('un code abîmé ou périmé est oublié sans appel au serveur', async () => {
    garder('abîmé');
    const d = db({});
    expect(await inv.validerInvitationGardee(d)).toBeNull();
    expect(d.rpc).not.toHaveBeenCalled();
    expect(memoire.has(inv.INVITATION_KEY)).toBe(false);
  });
});

describe('mon invitation', () => {
  it('lit le code, les amis, le plafond et les cadeaux ; un ami arrivé donne le badge « parrain »', async () => {
    const r = await inv.monInvitation(db({ data: [{ code: CODE, amis: 1, plafond: 5, cadeaux: ['cerisier', 'inconnu'] }] }));
    expect(r).toEqual({ ok: true, value: { code: CODE, amis: 1, plafond: 5, cadeaux: ['cerisier'] } });
    expect(inv.cadeauxAppareil()).toEqual(['cerisier']);
    expect(lireBadges(JSON.parse(memoire.get(BADGES_KEY)!))).toEqual(['parrain']);
  });

  it('sans ami arrivé, pas de badge ; réponse sans code ou erreur : échec', async () => {
    await inv.monInvitation(db({ data: [{ code: CODE, amis: 0, plafond: 5, cadeaux: [] }] }));
    expect(memoire.has(BADGES_KEY)).toBe(false);
    expect((await inv.monInvitation(db({ data: [{ code: 'court' }] }))).ok).toBe(false);
    expect((await inv.monInvitation(db({ error: { code: 'JGC01' } }))).ok).toBe(false);
  });
});
