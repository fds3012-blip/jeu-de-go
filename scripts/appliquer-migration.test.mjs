// Appliquer une migration depuis la CI (#421) : garde-fous, sans réseau.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { controler, identite, requete, sansCommentaires } from './appliquer-migration.mjs';

const F = '20261004180100_partie_en_direct.sql';

describe('appliquer une migration (#421)', () => {
  it('lit la version et le nom depuis le fichier', () => {
    expect(identite(F)).toEqual({ version: '20261004180100', nom: 'partie_en_direct' });
    expect(identite('mauvais nom.sql')).toBeNull();
  });

  it('refuse ce qui efface des données ou retire le RLS', () => {
    for (const sql of ['truncate public.games;', 'drop table public.games;', 'alter table public.profiles drop column pseudo;',
      'drop schema public cascade;', 'delete from public.profiles;', 'alter table public.games disable row level security;']) {
      expect(controler(F, sql).erreurs.length, sql).toBeGreaterThan(0);
    }
  });

  it('permet de retirer le droit truncate', () => {
    expect(controler(F, 'revoke insert, update, delete, truncate on public.t from authenticated;').erreurs).toEqual([]);
  });

  it('permet un delete dans une fonction, avec un avertissement', () => {
    const r = controler(F, 'create or replace function public.f() returns void language sql as $$ delete from public.match_queue where false $$;');
    expect(r.erreurs).toEqual([]);
    expect(r.avertissements[0]).toMatch(/delete from/);
  });

  it('exige le RLS sur une nouvelle table', () => {
    expect(controler(F, 'create table public.t (id int);').erreurs).toContain('nouvelle table sans « enable row level security »');
    expect(controler(F, 'create table public.t (id int); alter table public.t enable row level security;').erreurs).toEqual([]);
  });

  it('ignore les mots cités dans les commentaires', () => {
    expect(sansCommentaires('-- on ne fait pas de truncate ici\nselect 1; /* drop table */')).not.toMatch(/truncate|drop/);
    expect(controler(F, '-- jamais de truncate\nselect 1;').erreurs).toEqual([]);
  });

  it('enveloppe la migration et sa trace dans une seule transaction', () => {
    const q = requete('select 1;', { version: '20261004180100', nom: 'partie_en_direct' });
    expect(q.startsWith('begin;')).toBe(true);
    expect(q.trimEnd().endsWith('commit;')).toBe(true);
    expect(q).toContain("values ('20261004180100', 'partie_en_direct')");
  });

  it('toutes les migrations récentes du dépôt passent les garde-fous', () => {
    const dossier = new URL('../supabase/migrations/', import.meta.url);
    for (const f of readdirSync(dossier).filter((n) => n >= '20261004')) {
      expect(controler(f, readFileSync(new URL(f, dossier), 'utf8')).erreurs, f).toEqual([]);
    }
  });
});
