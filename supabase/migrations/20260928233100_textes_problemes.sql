-- Issue #282 : textes français de problèmes ambigus, relevés à la traduction anglaise (#167).
-- Voir docs/localisation/glossaire.md, « Textes français à reprendre ».
-- Mise à jour des textes seulement : aucune suppression, aucune position (setup.rows, setup.toPlay) ni réponse modifiée.
-- La réfutation vit dans setup.refutation : jsonb_set ne remplace que cette clé.
-- Chaque update ne s'applique que si le texte en base est encore l'ancien : relancer la migration ne change rien.
-- Source : src/content/lots/*.ts et src/content/puzzles.ts ; preuve : src/go/miseAJourTextes.test.ts.
-- La table puzzles garde sa RLS (activée dans 20260926235308_progression_problemes_lecons_badges).
--
-- Vérification après application (10 lignes attendues, chaque empreinte égale à celle du fichier de contenu) :
--   select id, md5(concat_ws('|', title, prompt, explanation, setup->>'refutation')) from public.puzzles
--   where id in ('n03','n13','n14','c4','d05','d10','d12','k01','q03','r04') order by id;
--   c4   fcb3c07451aee78ba8464ca1c53d24be
--   d05  5e90a3a85a95371eb1958da8204fd61b
--   d10  df506bbc5f1ab05e2df3c451149f98fa
--   d12  b4f8fa4f8ba50cc735e75c117ed61455
--   k01  2231fb0bd86e91c1a67ce09de80a3821
--   n03  eca2e2139b73c7f13c6078e8b86339f5
--   n13  850b97e011066d53f3d698f2536e5924
--   n14  65e62d3f75736af0df8df87a3e2f23ae
--   q03  de8a95517e1c19c313c063bee2e96c78
--   r04  f7bb7d41df13c0a8300b429dda17bc83

update public.puzzles set explanation = 'Bravo ! En E4, ta pierre s''allonge : tes deux pierres forment une chaîne avec trois libertés, D4, F4 et E3. Elle est hors de danger. Prendre B8 était tentant, mais Blanc aurait joué E4 et pris ta pierre.'
  where id = 'n03' and explanation = 'Bravo ! En E4, ta pierre s''allonge : tes deux pierres forment une chaîne avec trois libertés, D4, F4 et E3. Elle est hors de danger. Prendre B8 était tentant, mais Blanc aurait pris ta pierre en E4.';

update public.puzzles set setup = jsonb_set(setup, '{refutation}', to_jsonb('Pas tout à fait. Si tu t''allonges en E9, tes deux pierres n''ont qu''une liberté, F9 : tu te mets toi-même en atari, et Blanc les prend. Ailleurs, Blanc joue E9 et prend ta pierre. Regarde plutôt la pierre C9.'::text))
  where id = 'n13' and setup->>'refutation' = 'Pas tout à fait. Si tu t''allonges en E9, tes deux pierres n''ont qu''une liberté, F9 : tu te mets toi-même en atari, et Blanc les prend. Ailleurs, Blanc prend ta pierre en E9. Regarde plutôt la pierre C9.';

update public.puzzles set setup = jsonb_set(setup, '{refutation}', to_jsonb('Pas tout à fait. En A4, tes deux pierres n''ont que deux libertés : Blanc joue B4 et elles sont de nouveau en atari, contre le bord. Ailleurs, Blanc joue A4 et prend ta pierre. Regarde plutôt la pierre B5.'::text))
  where id = 'n14' and setup->>'refutation' = 'Pas tout à fait. En A4, tes deux pierres n''ont que deux libertés : Blanc joue B4 et elles sont de nouveau en atari, contre le bord. Ailleurs, Blanc prend ta pierre en A4. Regarde plutôt la pierre B5.';

update public.puzzles set setup = jsonb_set(setup, '{refutation}', to_jsonb('Pas tout à fait. Après B1, Blanc joue C1 : il prend ta pierre et se relie à ses pierres D1 et E1. Il s''échappe. Sacrifie plutôt ta pierre au point qui touche aussi ces pierres-là.'::text))
  where id = 'c4' and setup->>'refutation' = 'Pas tout à fait. Après B1, Blanc prend ta pierre en C1 et se relie à ses pierres D1 et E1 : il s''échappe. Sacrifie plutôt ta pierre au point qui touche aussi ces pierres-là.';

update public.puzzles set explanation = 'Superbe ! Ta pierre en C1 peut être prise, mais si Blanc joue B1 et la capture, son groupe n''a plus qu''une liberté : C1. Tu y rejoues aussitôt et prends 5 pierres. C''est un retour de capture (snapback) : on sacrifie une pierre pour en prendre plus. Ce n''est pas un ko, car tu reprends plusieurs pierres, pas une seule.'
  where id = 'c4' and explanation = 'Superbe ! Ta pierre en C1 peut être prise, mais si Blanc la capture en B1, son groupe n''a plus qu''une liberté : C1. Tu y rejoues aussitôt et prends 5 pierres. C''est un retour de capture (snapback) : on sacrifie une pierre pour en prendre plus. Ce n''est pas un ko, car tu reprends plusieurs pierres, pas une seule.';

update public.puzzles set explanation = 'Bien vu ! C''est une course aux libertés (semeai en japonais) : deux groupes s''entourent, aucun ne peut vivre seul, et le premier qui prend toutes les libertés de l''autre gagne. Ici, 2 contre 2 : celui qui joue d''abord gagne. En A2, Blanc n''a plus que A1 et tu le captures au coup suivant. A1 marche aussi : si Blanc joue A2 et prend ta pierre, son groupe n''a toujours qu''une liberté, A1, et tu le prends.'
  where id = 'd05' and explanation = 'Bien vu ! C''est une course aux libertés (semeai en japonais) : deux groupes s''entourent, aucun ne peut vivre seul, et le premier qui prend toutes les libertés de l''autre gagne. Ici, 2 contre 2 : celui qui joue d''abord gagne. En A2, Blanc n''a plus que A1 et tu le captures au coup suivant. A1 marche aussi : si Blanc prend ta pierre en A2, son groupe n''a toujours qu''une liberté, A1, et tu le prends.';

update public.puzzles set explanation = 'Bravo ! Dans une course aux libertés (semeai), on remplit d''abord les libertés extérieures : celles qui n''appartiennent qu''au groupe adverse, ici A2 et A1. C1 est une liberté commune, partagée par les deux groupes : on la remplit en dernier. Après A2, Blanc a 2 libertés (A1, C1) et toi 3 (C1, E2, E1) : tu captures Blanc un coup avant lui. A1 marche aussi : si Blanc joue A2 et prend ta pierre, il n''a toujours que deux libertés.'
  where id = 'd10' and explanation = 'Bravo ! Dans une course aux libertés (semeai), on remplit d''abord les libertés extérieures : celles qui n''appartiennent qu''au groupe adverse, ici A2 et A1. C1 est une liberté commune, partagée par les deux groupes : on la remplit en dernier. Après A2, Blanc a 2 libertés (A1, C1) et toi 3 (C1, E2, E1) : tu captures Blanc un coup avant lui. A1 marche aussi : si Blanc prend ta pierre en A2, il n''a toujours que deux libertés.';

update public.puzzles set setup = jsonb_set(setup, '{refutation}', to_jsonb('Pas tout à fait. Si tu remplis C1, ton groupe n''a plus que son œil E1 : Blanc y joue et le capture. Et A1 vient trop tôt : Blanc joue A2 et prend ta pierre, et tu ne peux plus rejouer en A1.'::text))
  where id = 'd12' and setup->>'refutation' = 'Pas tout à fait. Si tu remplis C1, ton groupe n''a plus que son œil E1 : Blanc y joue et le capture. Et A1 vient trop tôt : Blanc prend ta pierre en A2, et tu ne peux plus rejouer en A1.';

update public.puzzles set explanation = 'Bravo ! Après E2, les pierres blanches sont en atari : il ne leur reste qu''une liberté (un point vide à côté d''elles), F1. Si Blanc s''allonge en F1, tu joues F2 et il est de nouveau en atari, et ainsi de suite jusqu''au coin. Remettre en atari à chaque coup une pierre qui fuit, c''est une échelle. Ici, aucune pierre blanche ne bloque le chemin jusqu''au coin : l''échelle finit par capturer.'
  where id = 'k01' and explanation = 'Bravo ! Après E2, les pierres blanches sont en atari : il ne leur reste qu''une liberté (un point vide à côté d''elles), F1. Si Blanc s''allonge en F1, tu joues F2 et il est de nouveau en atari, et ainsi de suite jusqu''au coin. Remettre en atari à chaque coup une pierre qui fuit, c''est une échelle. Le long du bord, elle finit toujours par capturer.';

update public.puzzles set explanation = 'Superbe ! Deux coups marchent. En G1, tu réduis l''espace à quatre points, et F1 touche ta pierre : Blanc n''a plus la place pour deux yeux (deux points vides entourés par ses pierres). En D1, tu joues à l''intérieur de son espace et tu l''empêches de le couper en deux yeux. Dans les deux cas, son groupe finit capturé.'
  where id = 'q03' and explanation = 'Superbe ! Deux coups marchent. En G1, tu réduis l''espace à quatre points, et F1 touche ta pierre : Blanc n''a plus la place pour deux yeux (deux points vides entourés par ses pierres). En D1, tu joues au milieu de son espace et tu l''empêches de le couper en deux yeux. Dans les deux cas, son groupe finit capturé.';

update public.puzzles set explanation = 'Bravo ! Ton coup met B2 en atari : il ne lui reste qu''une liberté. Si Blanc s''allonge, tu prends ses deux pierres. Après A2, A1 est d''abord un faux œil : il ressemble à un œil, mais le point en diagonale B2 est à Blanc. Quand tu prends B2, A1 devient un vrai œil, et ton groupe est vivant. C2 marche aussi.'
  where id = 'r04' and explanation = 'Bravo ! Ton coup met B2 en atari : il ne lui reste qu''une liberté. Si Blanc s''allonge, tu prends ses deux pierres. Après A2, A1 est d''abord un faux œil : il ressemble à un œil, mais son coin B2 est à Blanc. Quand tu prends B2, A1 devient un vrai œil, et ton groupe est vivant. C2 marche aussi.';
