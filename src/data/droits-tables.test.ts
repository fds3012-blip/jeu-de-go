import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// #135 : la migration ne fait que retirer des droits, sans toucher aux données
// ni aux droits SELECT / INSERT / UPDATE / DELETE gérés par la RLS.
describe('migration retirer_droits_inutiles', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260927220000_retirer_droits_inutiles.sql'),
    'utf8',
  )
    .split('\n')
    .filter((ligne) => !ligne.trim().startsWith('--'))
    .join('\n');

  it('retire truncate, references et trigger aux tables existantes et futures', () => {
    expect(sql).toMatch(/revoke truncate, references, trigger\s+on all tables in schema public\s+from anon, authenticated/i);
    expect(sql).toMatch(/alter default privileges for role postgres in schema public\s+revoke truncate, references, trigger on tables/i);
  });

  it('ne touche ni aux données ni aux droits gérés par la RLS', () => {
    expect(sql).not.toMatch(/\b(delete|update|insert|drop|grant|select)\b/i);
    expect(sql).not.toMatch(/^\s*truncate\b/im);
  });
});

// #148 : même principe pour MAINTAIN (Postgres 17), sans rien retirer d'autre.
describe('migration retirer_maintain', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260927231000_retirer_maintain.sql'),
    'utf8',
  )
    .split('\n')
    .filter((ligne) => !ligne.trim().startsWith('--'))
    .join('\n');

  it('retire maintain aux tables existantes et futures', () => {
    expect(sql).toMatch(/revoke maintain\s+on all tables in schema public\s+from anon, authenticated/i);
    expect(sql).toMatch(/alter default privileges for role postgres in schema public\s+revoke maintain on tables\s+from anon, authenticated/i);
  });

  it("ne retire rien d'autre et ne touche pas aux données", () => {
    expect(sql).not.toMatch(/\b(delete|update|insert|drop|grant|select|truncate|references|trigger)\b/i);
  });
});
