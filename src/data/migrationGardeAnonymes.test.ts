// Garde-fous statiques de la migration qui limite les comptes anonymes au défi par lien (#316). Les cas eux-mêmes
// (anonyme refusé, vrai compte inchangé, défi jouable) sont vérifiés sur un vrai Postgres par
// supabase/tests/garde_anonymes.test.sql.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260929100100_garde_anonymes.sql'), 'utf8')
  .split('\n')
  .filter(ligne => !ligne.trim().startsWith('--'))
  .join('\n');

const CLAIM = "(select (auth.jwt() ->> 'is_anonymous')::boolean) is not true";

/** Politiques créées : table, commande, restrictive ou non, texte complet. */
function politiques(): { table: string; cmd: string; restrictive: boolean; texte: string }[] {
  return [...sql.matchAll(/create policy "[^"]+" on public\.(\w+)\s+(as restrictive\s+)?for (\w+)[^;]*;/g)]
    .map(m => ({ table: m[1], cmd: m[3], restrictive: !!m[2], texte: m[0] }));
}

function fonctions(): { nom: string; entete: string; corps: string }[] {
  return [...sql.matchAll(/create or replace function public\.(\w+)\(([\s\S]*?)\$\$([\s\S]*?)\$\$;/g)]
    .map(m => ({ nom: m[1], entete: m[2], corps: m[3] }));
}

describe('migration garde_anonymes', () => {
  it('ajoute uniquement des politiques restrictives fondées sur le claim is_anonymous', () => {
    const p = politiques();
    expect(p.map(x => `${x.table}:${x.cmd}`).sort()).toEqual([
      'achievements:insert', 'friendships:insert', 'friendships:update', 'games:insert',
      'lesson_progress:insert', 'lesson_progress:update', 'profiles:update', 'puzzles:delete', 'puzzles:insert'
    ]);
    for (const x of p) {
      expect(x.restrictive, x.texte).toBe(true);
      expect(x.texte, x.texte).toContain('to authenticated');
      expect(x.texte, x.texte).toContain(CLAIM);
      if (x.cmd === 'update') expect(x.texte).toMatch(/using[\s\S]*with check/);
    }
  });

  it('refuse l’anonyme dans les fonctions hors défi, garde le défi ouvert', () => {
    const f = fonctions();
    expect(f.map(x => x.nom).sort()).toEqual(
      ['creer_defi', 'find_match', 'importer_serie_appareil', 'join_game', 'record_puzzle_attempt', 'resign_game']
    );
    for (const { nom, entete, corps } of f) {
      expect(entete, nom).toMatch(/security definer set search_path = ''/);
      expect(corps, nom).toContain("coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)");
    }
    const resign = f.find(x => x.nom === 'resign_game')!.corps;
    expect(resign).toMatch(/is_anonymous[\s\S]*and not exists \(select 1 from public\.defis where partie_id = p_game\)/);
    const creer = f.find(x => x.nom === 'creer_defi')!.corps;
    expect(creer).toMatch(/then 3 else 20 end/);
    expect(sql).not.toMatch(/function public\.(rejoindre_defi|victoire_au_temps|jouer_coup_defi)\b/);
  });

  it('ne supprime aucune donnée, ne retire aucune politique et garde la RLS', () => {
    const sansFonctions = sql.replace(/\$\$[\s\S]*?\$\$/g, '');
    expect(sansFonctions).not.toMatch(/\bdelete\s+from\b|\btruncate\b|\bdrop\s+(table|policy|function)\b/i);
    expect(sansFonctions).not.toMatch(/disable row level security|no force row level security/i);
    expect(sansFonctions).not.toMatch(/\bgrant\b|\brevoke\b/i);
    // Les corps repris ne gagnent aucune suppression : seule find_match vide la file périmée, comme avant.
    for (const { nom, corps } of fonctions()) {
      const suppressions = [...corps.matchAll(/delete from public\.(\w+)/g)].map(m => m[1]);
      expect(suppressions, nom).toEqual(nom === 'find_match' ? ['match_queue', 'match_queue'] : []);
    }
  });

  it('ne touche pas au calcul des cotes', () => {
    expect(sql).not.toMatch(/create or replace function public\.(apply_game_rating|finish_game_by_score)/);
  });
});
