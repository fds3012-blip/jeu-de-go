-- Issue #91, lot F : courses aux libertés (semeai), coupes et connexions, 9 × 9, Noir au trait.
-- Problèmes communs (owner_id null), tous prouvés par src/go/lot-f.test.ts. Aucun seki, aucun ko.
-- Insertion seule : aucun problème existant n'est modifié ni supprimé.
-- setup.refutation : texte affiché après une erreur.
-- La table puzzles garde sa RLS (activée dans 20260926235308_progression_problemes_lecons_badges).
insert into public.puzzles (id, owner_id, size, setup, answers, title, prompt, explanation, difficulty) values
 ('f01', null, 9, '{"rows":[".XO......","XXO......",".XO......","XXO......","X.OO.....","XTX.O....",".OX......",".OX......",".OX......"],"toPlay":"B","refutation":"Pas tout à fait. Blanc joue B5 et relie son groupe au mur blanc C5 : il sort de la course et ne peut plus être capturé. Bloque d''abord la sortie."}', array['B5'], 'Bloque la sortie', 'Course aux libertés : ton groupe C1-C4 contre le groupe blanc marqué. Attention, Blanc peut rejoindre son mur.', 'Bravo ! Le groupe blanc a 4 libertés : A3, A2, A1 et B5. Mais B5 n''est pas une liberté comme les autres : en y jouant, Blanc se relierait au mur blanc C5. Dans une course aux libertés (semeai), où deux groupes s''entourent et où le premier qui prend toutes les libertés de l''autre gagne, on bloque d''abord la sortie. Après B5, Blanc a 3 libertés et toi 4 (D4, D3, D2, D1) : tu gagnes la course.', 900)
on conflict (id) do nothing;
