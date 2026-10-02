-- Advisors Supabase (lecture du 01/10, catégorie performance, règle 0003 « auth_rls_initplan ») : les politiques
-- restrictives « Anonyme : … » lisent le claim du jeton sous la forme `(select (auth.jwt() ->> 'is_anonymous')::boolean)`.
-- Postgres l'évalue déjà une fois par requête, mais l'analyseur de Supabase ne reconnaît que la forme
-- `(select auth.jwt())` et signale ces dix politiques. Réécriture à l'identique, sans changer le sens :
--   `((select auth.jwt()) ->> 'is_anonymous')::boolean is not true`
-- (un claim absent compte toujours comme un vrai compte, voir 20260929100100_garde_anonymes.sql).
--
-- Relevé des autres avertissements, laissés tels quels (voulus) :
-- - sécurité : « SECURITY DEFINER exécutable par authenticated » pour les 12 RPC de l'app (c'est l'API du jeu, chaque
--   fonction contrôle l'appelant dans son corps) et par anon pour `apercu_defi` (voulu : aperçu du lien sans session,
--   le jeton de 192 bits fait office de droit de lecture) ; « connexions anonymes autorisées » (les anciennes sessions
--   doivent finir leur défi, D3 ; les politiques restrictives ci-dessous les bornent) ; protection contre les mots de
--   passe fuités désactivée (réglage du tableau de bord ; l'app n'a pas de mot de passe) ;
-- - performance : trois index jamais utilisés (`essais_a_mesure_puzzle_idx`, `puzzle_attempts_puzzle_idx`,
--   `puzzle_attempts_user_puzzle_idx`) : gardés, le projet est trop jeune pour conclure.
-- Toutes les fonctions `security definer` ont déjà `search_path = ''` et aucune n'est exécutable par anon sauf
-- `apercu_defi` (vérifié sur les migrations rejouées, test ci-joint).
-- Aucune donnée touchée, aucune politique retirée ni ajoutée, RLS inchangée.

alter policy "Anonyme : pas de demande d'ami" on public.friendships
  with check (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "Anonyme : pas d'acceptation d'ami" on public.friendships
  using (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true)
  with check (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "Anonyme : pas de problème personnel" on public.puzzles
  with check (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "Anonyme : pas de suppression de problème" on public.puzzles
  using (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "Anonyme : pas de création de partie" on public.games
  with check (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "Anonyme : pas de badge" on public.achievements
  with check (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "Anonyme : progression des leçons sur l'appareil" on public.lesson_progress
  with check (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "Anonyme : progression des leçons sur l'appareil (mise à jour)" on public.lesson_progress
  using (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true)
  with check (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "Anonyme : pas de pseudo" on public.profiles
  using (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true)
  with check (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
alter policy "Anonyme : pas de rappel" on public.abonnements_rappel
  using (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true)
  with check (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);
