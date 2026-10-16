-- Issue #558 : correction du texte affiché après une erreur pour ab01 et ab05 (lot AB, #557).
-- L'ancien texte disait « tu perds au moins deux points de plus ». C'est prouvé en comptage par surfaces (règle
-- chinoise, src/go/lot-ab.test.ts), mais pas en règle japonaise, celle de ces problèmes : là, la perte prouvée pour
-- chaque erreur est d'un point au moins (src/go/refutation-fin.ts, minimax exact, bornes égales). L'ancien texte
-- nommait aussi la réplique C1 (ab01) ou D2 (ab05), qui n'est pas la meilleure après certaines erreurs (A1, B1).
-- Le nouveau texte ne dit que ce qui est prouvé dans les deux règles. Même contenu que src/content/lots/ab-club.ts.
-- Seul le champ setup.refutation de ces deux lignes change, comme dans 20260928233100_textes_problemes.sql.
update public.puzzles
  set setup = jsonb_set(setup, '{refutation}', to_jsonb('Pas tout à fait. Blanc garde l’avantage au premier rang : tu perds au moins un point par rapport au bon coup.'::text))
  where id = 'ab01' and owner_id is null;
update public.puzzles
  set setup = jsonb_set(setup, '{refutation}', to_jsonb('Pas tout à fait. Blanc garde sa pierre D1 dans ton coin : tu perds au moins un point par rapport au bon coup.'::text))
  where id = 'ab05' and owner_id is null;
