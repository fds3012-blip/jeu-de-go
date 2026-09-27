-- Issue #136, lot H : relier pour sauver une pierre en atari, 9 × 9, Noir au trait.
-- Problèmes communs (owner_id null), tous prouvés par src/go/lot-h.test.ts. Aucun seki, aucun ko.
-- Insertion seule : aucun problème existant n'est modifié ni supprimé.
-- setup.refutation : texte affiché après une erreur.
-- La table puzzles garde sa RLS (activée dans 20260926235308_progression_problemes_lecons_badges).
insert into public.puzzles (id, owner_id, size, setup, answers, title, prompt, explanation, difficulty) values
 ('h01', null, 9, '{"rows":[".........",".........",".........",".........",".........","OOOOO....","XSXOSO...",".X.X.O...","....O...."],"toPlay":"B","refutation":"Pas tout à fait. Ta pierre E3 est en atari : sa seule liberté est E2. Si tu joues ailleurs, Blanc y joue et la capture. Relie-la d''abord."}', array['E2'], 'Sauve en reliant', 'Ta pierre E3 est en atari. Sauve-la en la reliant à tes pierres.', 'Bravo ! E3 n''a qu''une liberté, E2. En E2, tu la relies à D2 : le groupe gagne des libertés en C2 et D1. Si Blanc coupe en C2, sa pierre n''a plus qu''une liberté, C1 : tu la captures et tout reste relié. Une pierre en atari se sauve souvent en la reliant.', 720)
on conflict (id) do nothing;
