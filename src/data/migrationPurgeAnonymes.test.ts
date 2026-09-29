// Garde-fous statiques de la suppression des sessions sans compte inutilisées (#318). Les cas eux-mêmes (qui part,
// qui reste, parties anonymisées) sont vérifiés sur un vrai Postgres par supabase/tests/purge_anonymes.test.sql.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260929220100_purge_anonymes.sql'), 'utf8')
  .split('\n')
  .filter(ligne => !ligne.trim().startsWith('--'))
  .join('\n');
const corps = sql.match(/create or replace function public\.purger_anonymes_inactifs[\s\S]*?as \$\$([\s\S]*?)\$\$;/)?.[1] ?? '';

describe('migration purge_anonymes', () => {
  it('définit une seule fonction, security definer, fermée à l’app', () => {
    expect([...sql.matchAll(/create or replace function public\.(\w+)/g)].map(m => m[1])).toEqual(['purger_anonymes_inactifs']);
    expect(sql).toMatch(/security definer\s+set search_path = ''/);
    expect(sql).toMatch(/revoke all on function public\.purger_anonymes_inactifs\(integer, integer\) from public, anon, authenticated, service_role;/);
    expect(sql).not.toMatch(/\bgrant\b/i);
  });

  it('ne vise que les anonymes, jamais moins de 60 jours', () => {
    expect(corps).toMatch(/p_jours < 60 then\s+raise exception/);
    expect(corps).toMatch(/where u\.is_anonymous is true/);
    expect(corps).toMatch(/delete from auth\.users where id = any\(v_ids\) and is_anonymous is true;/);
    expect(sql).toMatch(/purger_anonymes_inactifs\(integer default 60|p_jours integer default 60/);
  });

  it('supprime seulement les parties sans autre joueur, anonymise les autres', () => {
    const suppressions = [...corps.matchAll(/delete from ([\w.]+)/g)].map(m => m[1]);
    expect(suppressions).toEqual(['public.games', 'public.profiles', 'auth.users']);
    expect(corps).toMatch(/delete from public\.games g\s+where g\.created_by = any\(v_ids\)\s+and \(g\.bot_id is not null\s+or coalesce\(/);
    expect(corps).toMatch(/update public\.games g\s+set created_by = coalesce\(/);
    expect(corps).toMatch(/set black_id = case when g\.black_id = any\(v_ids\) then null/);
  });

  it('planifie la tâche chaque nuit à 60 jours, sans toucher aux politiques ni à la RLS', () => {
    expect(sql).toMatch(/cron\.schedule\('purger-anonymes-inactifs', '17 3 \* \* \*',\s+'select public\.purger_anonymes_inactifs\(60\)'\)/);
    expect(sql).not.toMatch(/\b(create|drop|alter) policy\b|row level security|\btruncate\b|\bdrop (table|function)\b/i);
  });
});
