import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { avecEtat, chercherAdversaire, refusDirect } from './direct';
import type { Db } from './supabase';
import type { Game } from './games';
import { CONTRAT_GAME_ACTION } from '../go/contrat';

// Issue #360 : migration de la partie en direct, lue sans les commentaires.
const sql = readFileSync(new URL('../../supabase/migrations/20261004180100_partie_en_direct.sql', import.meta.url), 'utf8')
  .split('\n').filter(l => !l.trim().startsWith('--')).join('\n');

describe('migration partie_en_direct', () => {
  it('aucune donnée de production supprimée : seuls DELETE sur la file d’attente', () => {
    expect(sql).not.toMatch(/\bdrop\s+(table|column|policy|trigger)\b/i);
    expect(sql).not.toMatch(/\btruncate\s+(table\s+)?public\./i);
    const suppressions = [...sql.matchAll(/\bdelete\s+from\s+([\w.]+)/gi)].map(m => m[1]);
    expect(suppressions.length).toBeGreaterThan(0);
    expect(new Set(suppressions)).toEqual(new Set(['public.match_queue']));
    // Seule fonction retirée : l'ancienne signature de find_match, remplacée par la nouvelle (valeurs par défaut).
    expect([...sql.matchAll(/\bdrop\s+function\s+([^;]+);/gi)].map(m => m[1].trim())).toEqual(['public.find_match(smallint)']);
  });
  it('RLS sur la nouvelle table, lecture seule pour les joueurs', () => {
    expect(sql).toContain('alter table public.parties_direct enable row level security;');
    expect(sql).toContain('revoke insert, update, delete, truncate on public.parties_direct from authenticated;');
    expect(sql).toContain('revoke all on public.parties_direct from anon;');
    expect(sql.match(/create table/gi)?.length).toBe(1);
  });
  it('security definer à search_path vide, internes fermées', () => {
    const fonctions = [...sql.matchAll(/create or replace function public\.(\w+)\([\s\S]*?\$\$;/g)];
    expect(fonctions.map(f => f[1]).sort()).toEqual(['cadence_direct', 'direct_constater', 'direct_en_cours', 'find_match', 'games_direct_pendule', 'pendule_apres', 'pendule_direct', 'quitter_file_attente']);
    for (const f of fonctions) expect(f[0], f[1]).toMatch(/set search_path = ''/);
    for (const n of ['cadence_direct(text)', 'pendule_apres(integer, integer, integer, bigint)']) expect(sql).toContain(`revoke execute on function public.${n} from public, anon, authenticated;`);
    for (const n of ['games_direct_pendule()', 'direct_constater(uuid, uuid)', 'direct_en_cours(uuid)']) expect(sql).toContain(`revoke execute on function public.${n} from public, anon, authenticated, service_role;`);
    for (const n of ['find_match(smallint, text, text)', 'quitter_file_attente()', 'pendule_direct(uuid)']) {
      expect(sql).toContain(`revoke execute on function public.${n} from public, anon;`);
      expect(sql).toContain(`grant execute on function public.${n} to authenticated;`);
    }
  });
  it('compte avec pseudo exigé, cote par le serveur seul', () => {
    expect(sql).toMatch(/find_match[\s\S]*?v_uid uuid := public\.exiger_compte_avec_pseudo\(\);/);
    expect(sql.match(/perform public\.apply_game_rating/g)?.length).toBe(2);
  });
  it('la fonction serveur game-action garde son contrat (rien à redéployer)', () => {
    expect(CONTRAT_GAME_ACTION).toBe(3);
  });
});

describe('données du direct', () => {
  it('refus traduits', () => {
    expect(refusDirect({ code: 'JGC01' })).toBe('compte');
    expect(refusDirect({ code: 'JGP01' })).toBe('compte');
    expect(refusDirect({ code: 'PGRST202' })).toBe('miseAJour');
    expect(refusDirect({ code: 'P0002' })).toBe('introuvable');
    expect(refusDirect(null)).toBe('serveur');
  });
  it('find_match appelée avec la taille, le temps et le comptage', async () => {
    const appels: unknown[] = [];
    const db = { rpc: async (nom: string, args: unknown) => { appels.push([nom, args]); return { data: null, error: null }; } } as unknown as Db;
    expect(await chercherAdversaire(db, 13, 'rapide', 'chinese')).toEqual({ ok: true, value: null });
    expect(appels).toEqual([['find_match', { p_size: 13, p_cadence: 'rapide', p_regles: 'chinese' }]]);
  });
  it('la partie suit l’état de la pendule', () => {
    const g = avecEtat({ id: 'p', moves: '', status: 'active' } as unknown as Game, {
      statut: 'finished', resultat: 'W+T', coups: 'eecc', comptage: false, mortes: null, mortesPar: null, cadence: 'normale', periodeMs: 30000,
      noir: { ms: 0, periodes: 0, vuLe: null }, blanc: { ms: 1, periodes: 3, vuLe: null }, traitDepuis: null, maintenant: 0,
    });
    expect([g.moves, g.status, g.result]).toEqual(['eecc', 'finished', 'W+T']);
  });
});
