-- Suppression automatique des sessions sans compte inutilisées (issue #318, décision de Florian du 29/09 : 60 jours).
-- Un ami qui ouvre un défi par lien sans s'inscrire reçoit un utilisateur anonyme. Sans activité depuis 60 jours,
-- ce compte est effacé, avec les mêmes règles que « Supprimer mon compte » (#114) :
--   - parties sans autre joueur : supprimées ;
--   - parties contre un vrai joueur : gardées pour lui, la place de l'anonyme devient « joueur supprimé ».
-- Activité = la plus récente de : création, dernière connexion, mise à jour du compte, rafraîchissement d'une
-- session, dernière modification d'une de ses parties. Seuls les comptes is_anonymous sont concernés.
-- Tâche quotidienne pg_cron (03:17 UTC), au plus 500 comptes par passage.

create or replace function public.purger_anonymes_inactifs(p_jours integer default 60, p_max integer default 500)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  -- Garde-fou : jamais moins de 60 jours (décision de Florian), jamais un vrai compte.
  if p_jours is null or p_jours < 60 then
    raise exception 'Durée minimale : 60 jours' using errcode = '22023';
  end if;

  select coalesce(array_agg(c.id), '{}') into v_ids
  from (
    select u.id
    from auth.users u
    where u.is_anonymous is true
      and greatest(
            u.created_at,
            u.last_sign_in_at,
            u.updated_at,
            (select max(greatest(s.updated_at, s.refreshed_at::timestamptz)) from auth.sessions s where s.user_id = u.id),
            (select max(g.updated_at) from public.games g where u.id in (g.black_id, g.white_id, g.created_by))
          ) < now() - make_interval(days => p_jours)
    order by u.created_at
    limit greatest(p_max, 0)
  ) c;

  if cardinality(v_ids) = 0 then
    return 0;
  end if;

  -- Parties sans autre joueur humain : supprimées (leur défi part avec, par cascade).
  delete from public.games g
  where g.created_by = any(v_ids)
    and (g.bot_id is not null
         or coalesce(
              case when g.black_id = any(v_ids) then null else g.black_id end,
              case when g.white_id = any(v_ids) then null else g.white_id end) is null);

  -- Parties partagées : l'adversaire devient créateur si besoin, puis la place de l'anonyme est vidée.
  update public.games g
  set created_by = coalesce(
        case when g.black_id = any(v_ids) then null else g.black_id end,
        case when g.white_id = any(v_ids) then null else g.white_id end)
  where g.created_by = any(v_ids);

  update public.games g
  set black_id = case when g.black_id = any(v_ids) then null else g.black_id end,
      white_id = case when g.white_id = any(v_ids) then null else g.white_id end,
      dead_proposed_by = case when g.dead_proposed_by = any(v_ids) then null else g.dead_proposed_by end
  where g.black_id = any(v_ids) or g.white_id = any(v_ids) or g.dead_proposed_by = any(v_ids);

  -- Le profil et ses données suivent par cascade ; le compte d'authentification en dernier.
  delete from public.profiles where id = any(v_ids);
  delete from auth.users where id = any(v_ids) and is_anonymous is true;

  return cardinality(v_ids);
end;
$$;
comment on function public.purger_anonymes_inactifs(integer, integer) is
  'Efface les utilisateurs anonymes sans activité depuis p_jours (60 au moins) et anonymise leurs parties partagées. Issue #318.';

-- Personne ne l'appelle depuis l'app : seule la tâche planifiée (rôle postgres) l'exécute.
revoke all on function public.purger_anonymes_inactifs(integer, integer) from public, anon, authenticated, service_role;

-- Tâche planifiée, si pg_cron est disponible (toujours sur Supabase ; absent du Postgres jetable des tests).
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $s$select cron.schedule('purger-anonymes-inactifs', '17 3 * * *',
                                    'select public.purger_anonymes_inactifs(60)')$s$;
  end if;
end;
$cron$;
