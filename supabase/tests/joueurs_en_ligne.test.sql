-- Tests rejouables du compteur de joueurs en ligne (issue #695) : `joueurs_en_ligne()` renvoie un seul nombre, sans
-- aucun identifiant, lisible par un visiteur (anon) comme par un compte. Il compte la file d'attente (appel de
-- find_match il y a moins de 30 s) et les joueurs d'une partie classée en direct encore active (vus il y a moins de 90 s).
-- Transaction annulée à la fin : aucune donnée ne reste. Voir supabase/tests/LISEZMOI.md.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
begin;

create function pg_temp.connecte(p_uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', false)::text, true);
$$;
create function pg_temp.egal(p_obtenu anyelement, p_attendu anyelement, p_cas text) returns void
language plpgsql as $$
begin
  if p_obtenu is distinct from p_attendu then
    raise exception 'ÉCHEC %: obtenu %, attendu %', p_cas, p_obtenu, p_attendu;
  end if;
end;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

insert into auth.users (id, email, is_anonymous)
  select ('00000000-0000-4000-8000-0000000007' || lpad(n::text, 2, '0'))::uuid, 'j' || n || '@exemple.test', false
  from generate_series(1, 4) n;
insert into public.profiles (id, username)
  select ('00000000-0000-4000-8000-0000000007' || lpad(n::text, 2, '0'))::uuid, 'enligne' || n
  from generate_series(1, 4) n
  on conflict (id) do update set username = excluded.username;
\set alice '''00000000-0000-4000-8000-000000000701'''
\set bruno '''00000000-0000-4000-8000-000000000702'''

-- 1. Personne : zéro. Un visiteur (anon) peut le demander.
set local role anon;
select pg_temp.egal(public.joueurs_en_ligne(), 0, 'personne en ligne');
reset role;

-- 2. Une attente fraîche compte ; sans nouvelles depuis plus de 30 s, elle ne compte plus.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Alice attend');
reset role;
select pg_temp.egal(public.joueurs_en_ligne(), 1, 'une attente');
update public.match_queue set vu_le = now() - interval '31 seconds';
select pg_temp.egal(public.joueurs_en_ligne(), 0, 'attente abandonnée : ne compte plus');

-- 3. Une partie classée active : chaque joueur compte tant qu'il a donné signe de vie il y a moins de 90 s.
set local role authenticated;
select pg_temp.connecte(:alice);
select public.find_match(9::smallint);
select pg_temp.connecte(:bruno);
select public.find_match(9::smallint) as partie \gset
reset role;
select pg_temp.egal((select count(*) from public.match_queue), 0::bigint, 'plus personne dans la file');
select pg_temp.egal(public.joueurs_en_ligne(), 1, 'partie créée : seul celui qui a appelé est là');
set local role authenticated;
select pg_temp.connecte(:alice);
select public.pendule_direct(:'partie'::uuid);
reset role;
select pg_temp.egal(public.joueurs_en_ligne(), 2, 'les deux joueurs sont là');
update public.parties_direct set blanc_vu_le = now() - interval '91 seconds', noir_vu_le = now() - interval '91 seconds' where partie_id = :'partie'::uuid;
select pg_temp.egal(public.joueurs_en_ligne(), 0, 'sans signe de vie depuis 90 s : plus là');
update public.parties_direct set blanc_vu_le = now(), noir_vu_le = now() where partie_id = :'partie'::uuid;
select pg_temp.egal(public.joueurs_en_ligne(), 2, 'de retour');
update public.games set status = 'aborted' where id = :'partie'::uuid;
select pg_temp.egal(public.joueurs_en_ligne(), 0, 'partie finie : ne compte plus');

-- 4. Rien de personnel : un entier, une fonction en lecture seule à search_path vide, ouverte à anon et aux comptes.
select pg_temp.egal((select pg_get_function_result(oid) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'joueurs_en_ligne'), 'integer', 'renvoie un entier');
select pg_temp.egal((select pg_get_function_arguments(oid) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'joueurs_en_ligne'), '', 'aucun paramètre');
select pg_temp.egal((select provolatile from pg_proc where pronamespace = 'public'::regnamespace and proname = 'joueurs_en_ligne'), 's', 'stable (lecture seule)');
select pg_temp.egal((select proconfig[1] from pg_proc where pronamespace = 'public'::regnamespace and proname = 'joueurs_en_ligne'), 'search_path=""', 'search_path vide');
select pg_temp.egal(has_function_privilege('anon', 'public.joueurs_en_ligne()', 'execute'), true, 'anon peut le demander');
select pg_temp.egal(has_function_privilege('authenticated', 'public.joueurs_en_ligne()', 'execute'), true, 'un compte aussi');
select pg_temp.egal(has_table_privilege('anon', 'public.match_queue', 'select'), false, 'la file reste fermée à anon');
select pg_temp.egal(has_table_privilege('anon', 'public.parties_direct', 'select'), false, 'les parties en direct restent fermées à anon');
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');

\o
\echo 'joueurs_en_ligne : tous les cas passent.'
rollback;
