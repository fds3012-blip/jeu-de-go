import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fusionner, MAX_AFFICHEES, type PartieHistorique } from '../app/historique';
import {
  aEnvoyer, cleDe, CODE_PLEIN, depuisLigne, envoyable, lireNotees, lirePartiesPerso, MAX_SGF, noter, paquets, synchroniser,
  SYNCHRO_KEY, versLigne,
} from './partiesPerso';
import type { Db } from './supabase';

const SGF = (coups = ';B[ee];W[cc]') => `(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]RE[B+6.5]${coups})`;
const partie = (p: Partial<PartieHistorique> = {}): PartieHistorique => {
  const date = p.date ?? '2026-10-02T10:00:00.000Z';
  return { id: date, date, sgf: SGF(), mode: 'ordi', taille: 9, joueur: 1, adversaire: 'pomme', resultat: 'B+6.5', ...p };
};
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const MAINTENANT = Date.parse('2026-10-02T12:00:00Z');

describe('clé stable et règles d’envoi', () => {
  it('clé : SHA-256 de « date ISO + saut de ligne + SGF », la même quelle que soit l’écriture de la date', async () => {
    const p = partie();
    expect(await cleDe(p)).toBe(sha(`2026-10-02T10:00:00.000Z\n${p.sgf}`));
    expect(await cleDe(partie({ date: '2026-10-02T12:00:00+02:00' }))).toBe(await cleDe(p));
    expect(await cleDe(partie({ sgf: SGF(';B[dd]') }))).not.toBe(await cleDe(p));
    expect(await cleDe(partie({ date: '2026-10-02T10:00:00.001Z' }))).not.toBe(await cleDe(p));
  });

  it('envoie les parties de l’appareil, pas les défis (déjà sur le serveur) ni ce que le serveur refuserait', () => {
    expect(envoyable(partie(), MAINTENANT)).toBe(true);
    for (const mode of ['guidee', 'deux', 'import'] as const) expect(envoyable(partie({ mode, joueur: mode === 'deux' ? null : 1 }), MAINTENANT)).toBe(true);
    expect(envoyable(partie({ mode: 'defi' }), MAINTENANT)).toBe(false);
    expect(envoyable(partie({ sgf: `(;C[${'é'.repeat(MAX_SGF / 2)}])` }), MAINTENANT)).toBe(false); // trop gros en octets
    expect(envoyable(partie({ date: '2026-10-05T10:00:00Z' }), MAINTENANT)).toBe(false); // dans le futur
    expect(envoyable(partie({ date: '1999-12-31T00:00:00Z' }), MAINTENANT)).toBe(false);
    expect(envoyable(partie({ adversaire: 'x'.repeat(41) }), MAINTENANT)).toBe(false);
    expect(envoyable(partie({ taille: 21 }), MAINTENANT)).toBe(false);
  });

  it('ligne envoyée puis relue : la même partie, même identifiant que sur l’appareil', async () => {
    const p = partie({ mode: 'deux', joueur: null, adversaire: undefined });
    const ligne = versLigne(p, (await cleDe(p))!);
    expect(ligne).toMatchObject({ joue_le: p.date, mode: 'deux', joueur: null, adversaire: null, resultat: 'B+6.5' });
    // Le serveur rend la date au format Postgres : l'identifiant redevient la date ISO de l'appareil.
    expect(depuisLigne({ ...ligne, joue_le: '2026-10-02 10:00:00+00' })).toEqual(p);
    expect(depuisLigne({ ...ligne, mode: 'defi' })).toBeNull();
    expect(depuisLigne({ ...ligne, sgf: 'abîmé' })).toBeNull();
    expect(depuisLigne(null)).toBeNull();
  });
});

describe('dédoublonnage', () => {
  it('à envoyer : sans les clés déjà notées, sans doublon, la plus ancienne d’abord', async () => {
    const a = partie({ date: '2026-10-01T10:00:00.000Z' });
    const b = partie({ date: '2026-10-02T10:00:00.000Z' });
    const defi = partie({ id: 'defi:g1', mode: 'defi' });
    const lignes = await aEnvoyer([b, a, defi], new Set([(await cleDe(b))!]), MAINTENANT);
    expect(lignes.map(l => l.joue_le)).toEqual([a.date]);
    expect((await aEnvoyer([b, a], new Set(), MAINTENANT)).map(l => l.joue_le)).toEqual([a.date, b.date]);
  });

  it('clés notées : par compte, sans doublon, bornées', () => {
    const c = (i: number) => sha(String(i));
    expect(lireNotees({ compte: 'moi', cles: [c(1), 'abîmée', 3] }, 'moi')).toEqual([c(1)]);
    expect(lireNotees({ compte: 'autre', cles: [c(1)] }, 'moi')).toEqual([]);
    expect(lireNotees('texte', 'moi')).toEqual([]);
    expect(noter([c(1), c(2)], [c(2), c(3)])).toEqual([c(1), c(2), c(3)]);
    const beaucoup = noter([], Array.from({ length: 700 }, (_, i) => c(i)));
    expect(beaucoup).toHaveLength(600);
    expect(beaucoup.at(-1)).toBe(c(699));
  });

  it('paquets de 50 au plus', () => {
    expect(paquets(Array.from({ length: 120 }, (_, i) => i)).map(p => p.length)).toEqual([50, 50, 20]);
    expect(paquets([])).toEqual([]);
  });

  it('fusion : la partie de l’appareil et la même relue du serveur n’apparaissent qu’une fois', () => {
    const locale = partie();
    const autreAppareil = partie({ date: '2026-09-30T08:00:00.000Z', sgf: SGF(';B[gg]') });
    const relue = depuisLigne({ ...versLigne(locale, 'x'), joue_le: '2026-10-02 10:00:00+00' })!;
    const l = fusionner([locale], [relue, autreAppareil], MAX_AFFICHEES);
    expect(l.map(p => p.date)).toEqual([locale.date, autreAppareil.date]);
    // Même instant et même SGF sous un autre identifiant : une seule ligne.
    expect(fusionner([locale], [{ ...locale, id: 'autre' }])).toHaveLength(1);
    // Au plus `max` parties.
    const many = Array.from({ length: 250 }, (_, i) => partie({ date: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() }));
    expect(fusionner([], many, MAX_AFFICHEES)).toHaveLength(MAX_AFFICHEES);
  });
});

// Client Supabase simulé : seulement ce qu'utilise partiesPerso.ts.
function fauxDb(rpc: (args: { p_parties: { cle: string }[] }) => { data: unknown; error: null | { code?: string; message: string } }, lignes: unknown[] = []) {
  const appels: { p_parties: { cle: string }[] }[] = [];
  const chaine = { select: () => chaine, eq: () => chaine, order: () => chaine, limit: async () => ({ data: lignes, error: null }) };
  const db = {
    rpc: vi.fn(async (_nom: string, args: { p_parties: { cle: string }[] }) => { appels.push(args); return rpc(args); }),
    from: vi.fn(() => chaine),
  };
  return { db: db as unknown as Db, appels };
}

describe('synchronisation', () => {
  // Stockage de l'appareil simulé (tests en environnement Node).
  beforeEach(() => {
    const m = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k), clear: () => m.clear(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  const parties = Array.from({ length: 3 }, (_, i) => partie({ date: new Date(Date.UTC(2026, 9, 1, 10, i)).toISOString() }));

  it('envoie une fois, note les clés acceptées, puis n’envoie plus rien', async () => {
    const { db, appels } = fauxDb(a => ({ data: a.p_parties.map(p => p.cle), error: null }));
    expect(await synchroniser(db, 'moi', () => parties)).toEqual({ envoyees: 3, plein: false });
    expect(appels).toHaveLength(1);
    expect(appels[0].p_parties).toHaveLength(3);
    expect(await synchroniser(db, 'moi', () => parties)).toEqual({ envoyees: 0, plein: false });
    expect(appels).toHaveLength(1);
    // Un autre compte sur le même appareil : il envoie les siennes.
    await synchroniser(db, 'autre', () => parties);
    expect(appels).toHaveLength(2);
  });

  it('hors ligne ou serveur en panne : rien n’est noté, l’envoi est refait la fois suivante', async () => {
    let enPanne = true;
    const { db, appels } = fauxDb(a => (enPanne ? { data: null, error: { message: 'Failed to fetch' } } : { data: a.p_parties.map(p => p.cle), error: null }));
    expect(await synchroniser(db, 'moi', () => parties)).toEqual({ erreur: 'Failed to fetch' });
    expect(localStorage.getItem(SYNCHRO_KEY)).toBeNull();
    enPanne = false;
    expect(await synchroniser(db, 'moi', () => parties)).toEqual({ envoyees: 3, plein: false });
    expect(appels).toHaveLength(2);
  });

  it('plafond atteint (JGL01) : arrêt sans erreur', async () => {
    const { db } = fauxDb(() => ({ data: null, error: { code: CODE_PLEIN, message: 'Tu as déjà 500 parties enregistrées' } }));
    expect(await synchroniser(db, 'moi', () => parties)).toEqual({ envoyees: 0, plein: true });
  });

  it('deux appels en même temps : un seul envoi', async () => {
    const { db, appels } = fauxDb(a => ({ data: a.p_parties.map(p => p.cle), error: null }));
    await Promise.all([synchroniser(db, 'moi', () => parties), synchroniser(db, 'moi', () => parties)]);
    expect(appels).toHaveLength(1);
  });

  it('nouvel appareil : les parties lues sur le serveur sont notées et ne repartent pas', async () => {
    const lignes = await Promise.all(parties.map(async p => versLigne(p, (await cleDe(p))!)));
    const { db, appels } = fauxDb(a => ({ data: a.p_parties.map(p => p.cle), error: null }), lignes);
    const r = await lirePartiesPerso(db, 'moi');
    expect(r.ok && r.value.map(p => p.date)).toEqual(parties.map(p => p.date));
    await synchroniser(db, 'moi', () => parties);
    expect(appels).toHaveLength(0);
  });
});

describe('migration parties_perso', () => {
  const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261002140100_parties_perso.sql'), 'utf8')
    .split('\n').filter(l => !l.trim().startsWith('--')).join('\n');

  it('ne supprime, ne modifie et ne retire rien (règle de Florian)', () => {
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/\bupdate\s+(public|auth)\./i);
    expect(sql).not.toMatch(/\b(drop|truncate|alter\s+table\s+public\.(?!parties_perso))\b/i);
  });

  it('RLS, fonction security definer à search_path vide, compte avec pseudo, plafond et doublons', () => {
    expect(sql).toMatch(/alter table public\.parties_perso enable row level security/);
    expect(sql).toMatch(/security definer set search_path = ''/);
    expect(sql).toMatch(/public\.exiger_compte_avec_pseudo\(\)/);
    expect(sql).toMatch(/v_max constant int := 500/);
    expect(sql).toMatch(/on conflict \(user_id, cle\) do nothing/);
    expect(sql).toMatch(/references auth\.users \(id\) on delete cascade/);
  });
});
