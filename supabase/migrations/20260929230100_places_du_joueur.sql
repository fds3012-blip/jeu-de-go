-- Revue de sécurité du 29/09 (docs/qa/securite-2026-09-29.md, constat S1).
--
-- Problème : les politiques « Création par un joueur de la partie » (insert) et « Parties contre l'IA modifiables
-- par leur joueur » (update) exigent seulement que l'appelant occupe UNE des deux places (black_id, white_id).
-- L'autre place pouvait donc nommer n'importe quel autre joueur : un client pouvait fabriquer une partie contre l'IA
-- (terminée, avec un résultat) qui apparaissait dans l'historique d'un autre joueur, sans son accord.
-- Aucun effet sur les cotes (resign_game et finish_game_by_score refusent les parties contre l'IA), mais c'est une
-- écriture au nom d'un tiers.
--
-- Correction : politique RESTRICTIVE (elle s'ajoute en « et ») sur l'insertion et la modification directes :
-- chaque place est vide ou occupée par l'appelant. Les parties entre humains reçoivent leur adversaire par les
-- fonctions serveur (join_game, find_match, rejoindre_defi), qui appartiennent à `postgres` et contournent la RLS :
-- elles ne sont pas touchées. L'application n'écrit jamais `games` directement : rien ne change pour elle.
--
-- Aucune donnée modifiée ni supprimée. RLS inchangée ailleurs (active sur chaque table).

create policy "Places de la partie : l'appelant seulement" on public.games
  as restrictive for insert to authenticated
  with check ((black_id is null or black_id = (select auth.uid()))
              and (white_id is null or white_id = (select auth.uid())));

create policy "Places de la partie : l'appelant seulement (mise à jour)" on public.games
  as restrictive for update to authenticated
  using ((black_id is null or black_id = (select auth.uid()))
         and (white_id is null or white_id = (select auth.uid())))
  with check ((black_id is null or black_id = (select auth.uid()))
              and (white_id is null or white_id = (select auth.uid())));
