-- Décision D4 (docs/juridique/compte-obligatoire.md, écart E16 de la politique de confidentialité ; issue #530, reprend #371).
--
-- Avant : la politique « Profils visibles par tous » (to anon, authenticated using (true)) laissait n'importe qui, avec la
-- seule clé publique de l'app, lire la table entière : pseudo, cotes, série, gels, jours gelés, dates, preuve d'accord aux
-- conditions, pour tous les comptes, y compris ceux de mineurs.
--
-- Après :
--   1. Visiteur non connecté (rôle anon) : plus aucune lecture de `profiles` ni du classement `leaderboard`. Les liens
--      publics gardent le strict nécessaire par leurs fonctions dédiées, inchangées (`security definer`) :
--      `apercu_defi` (#81 : pseudo de qui t'invite), `lire_partie_partagee` et `lire_partage` (#364, #449 : pseudo de qui
--      partage). Défense en profondeur : anon perd aussi le droit de lecture (sans politique, donc déjà sans effet) sur
--      les autres tables qui décrivent un joueur : parties, badges, historique de cote, leçons, essais de problèmes, file.
--   2. Joueur connecté (rôle authenticated, sessions sans compte comprises) : lit les autres profils, mais seulement les
--      colonnes publiques : identifiant, pseudo, cote et cote provisoire (le grade s'en déduit dans l'app), plus
--      `avatar_url` et `country`, vides et non modifiables depuis E18 (gardées pour la vue `leaderboard`).
--   3. Série, gels, jours gelés, cote des problèmes, détail de la cote (écart, volatilité, parties, départ), dates et
--      preuve d'accord : lisibles par leur seul titulaire, par `mon_profil()`.
--
-- Rien n'est supprimé : aucune ligne, aucune colonne. RLS reste active sur `profiles`. Les fonctions `security definer`
-- (amis, défis, direct, cote, export…) lisent toujours la table entière : elles s'exécutent avec les droits de leur
-- propriétaire et ne rendent que ce qu'elles doivent.

-- 1. Politique de lecture : joueurs connectés seulement.
drop policy if exists "Profils visibles par tous" on public.profiles;
create policy "Profils visibles par les joueurs connectés" on public.profiles
  for select to authenticated using (true);

-- 2. Colonnes publiques seulement. Retirer le droit de table retire aussi les droits de colonne déjà donnés.
revoke select on public.profiles from anon, authenticated;
grant select (id, username, avatar_url, country, rating, cote_provisoire) on public.profiles to authenticated;

-- 3. Classement : joueurs connectés seulement (la vue est `security_invoker` : mêmes règles que la table).
revoke select on public.leaderboard from anon;

-- 4. Défense en profondeur : anon ne lit plus les tables qui décrivent un joueur (aucune politique ne l'y autorisait).
revoke select on public.games, public.achievements, public.rating_history, public.lesson_progress,
  public.puzzle_attempts, public.match_queue from anon;

-- 5. Son profil entier, pour son seul titulaire.
create or replace function public.mon_profil()
returns setof public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.profiles p where p.id = (select auth.uid());
$$;
comment on function public.mon_profil() is
  'D4 (#530) : le profil complet du joueur connecté (série, gels, dates, détail de la cote), lisible par lui seul. '
  'Les autres joueurs ne lisent que les colonnes publiques de profiles.';
revoke all on function public.mon_profil() from public, anon;
grant execute on function public.mon_profil() to authenticated;

comment on policy "Profils visibles par les joueurs connectés" on public.profiles is
  'D4 (#530) : joueurs connectés seulement ; colonnes publiques par droits de colonne (id, username, avatar_url, '
  'country, rating, cote_provisoire). Le reste : mon_profil().';
