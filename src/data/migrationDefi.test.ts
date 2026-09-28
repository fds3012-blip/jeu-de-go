// Garde-fous statiques de la migration du défi par lien (#81). Les cas de sécurité eux-mêmes (tiers, hors tour,
// délai dépassé) sont vérifiés sur un vrai Postgres par supabase/tests/defi_par_lien.test.sql.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260929003100_defi_par_lien.sql'), 'utf8')
  .split('\n')
  .filter(ligne => !ligne.trim().startsWith('--'))
  .join('\n');

/** Blocs `create or replace function … $$ … $$;` : nom et en-tête (avant le corps). */
function fonctions(): { nom: string; entete: string }[] {
  return [...sql.matchAll(/create or replace function public\.(\w+)\(([\s\S]*?)\$\$/g)].map(m => ({ nom: m[1], entete: m[2] }));
}

describe('migration defi_par_lien', () => {
  it('active la RLS sur chaque table créée', () => {
    const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map(m => m[1]);
    expect(tables).toEqual(['defis']);
    for (const t of tables) expect(sql).toContain(`alter table public.${t} enable row level security`);
  });

  it("n'ouvre aucune écriture directe sur defis", () => {
    expect(sql).not.toMatch(/create policy[^;]*on public\.defis\s+for (insert|update|delete|all)/i);
    expect(sql).toMatch(/revoke insert, update, delete on public\.defis from anon, authenticated/);
  });

  it('fixe search_path sur chaque fonction, security definer pour les fonctions appelables', () => {
    const f = fonctions();
    expect(f.map(x => x.nom).sort()).toEqual(
      ['creer_defi', 'defi_constater_temps', 'games_defi_garde', 'jouer_coup_defi', 'rejoindre_defi', 'victoire_au_temps']
    );
    for (const { nom, entete } of f) {
      expect(entete, nom).toMatch(/set search_path = ''/);
      if (nom !== 'defi_constater_temps') expect(entete, nom).toMatch(/security definer/);
    }
  });

  it('réserve jouer_coup_defi à la clé service, les autres aux joueurs connectés', () => {
    expect(sql).toMatch(/revoke execute on function public\.jouer_coup_defi\([^)]*\) from public, anon, authenticated;/);
    expect(sql).toMatch(/grant execute on function public\.jouer_coup_defi\([^)]*\) to service_role;/);
    expect(sql).toMatch(/grant execute on function public\.creer_defi\(\), public\.rejoindre_defi\(text\), public\.victoire_au_temps\(uuid\) to authenticated;/);
    expect(sql).toMatch(/revoke execute on function public\.defi_constater_temps\(uuid\) from public, anon, authenticated, service_role;/);
  });

  it('ne supprime aucune donnée et ne touche pas aux cotes', () => {
    expect(sql).not.toMatch(/\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/i);
    expect(sql).not.toMatch(/apply_game_rating|\brating\b/);
  });
});
