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
