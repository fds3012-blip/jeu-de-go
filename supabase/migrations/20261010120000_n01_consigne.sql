-- Passe design #509 (constat 13) : la consigne du problème n01 « Deux pierres d'un coup » disait « Capture la pierre
-- marquée en un coup. », alors qu'il faut capturer les deux pierres blanches E5 et E4 (une seule est marquée).
-- Texte seulement : position (setup), réponse (E3), titre, explication et difficulté inchangés.
-- Source : src/content/lots/n-debutants.ts ; preuve : src/go/lot-n.test.ts.
-- La table puzzles garde sa RLS (activée dans 20260926235308_progression_problemes_lecons_badges).
update public.puzzles set prompt = 'Capture les deux pierres blanches en un coup.' where id = 'n01';
