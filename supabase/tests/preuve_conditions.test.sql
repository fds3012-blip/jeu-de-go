-- Tests rejouables de la preuve d'acceptation des conditions (D2, suite de #343). Transaction annulée à la fin.
-- Le jeton est simulé par request.jwt.claims (sub, role, is_anonymous). Voir supabase/tests/LISEZMOI.md.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
begin;

create function pg_temp.connecte(p_uid uuid, p_anonyme boolean default false) returns void
language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anonyme)::text, true);
$$;
create function pg_temp.connecte_sans_claim(p_uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.deconnecte() returns void
language sql as $$ select set_config('request.jwt.claims', '{"role":"authenticated"}', true); $$;
create function pg_temp.doit_refuser_code(p_sql text, p_code text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'REFUS ATTENDU, mais accepté : %', p_sql;
exception when others then
  if sqlerrm like 'REFUS ATTENDU%' then raise; end if;
  if sqlstate <> p_code then
    raise exception 'Mauvais refus pour « % » : % « % » (attendu : %)', p_sql, sqlstate, sqlerrm, p_code;
  end if;
end;
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

-- Alice : vrai compte. Bruno : anonyme (claim). Élise : anonyme dans auth.users, jeton sans claim.
insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', null, true),
  ('eeeeeeee-0000-4000-8000-000000000005', null, true);
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set elise '''eeeeeeee-0000-4000-8000-000000000005'''

-- 1. Le profil naît sans preuve.
select pg_temp.egal((select conditions_version from public.profiles where id = :alice), null::text, 'version vide au départ');
select pg_temp.egal((select conditions_acceptees_le from public.profiles where id = :alice), null::timestamptz, 'date vide au départ');

-- 2. Refus : sans session, anonyme (claim), anonyme (auth.users, jeton sans claim), version mal formée.
set local role authenticated;
select pg_temp.deconnecte();
select pg_temp.doit_refuser_code($$select public.accepter_conditions('2026-09-30')$$, 'JGC01');
select pg_temp.connecte(:bruno, true);
select pg_temp.doit_refuser_code($$select public.accepter_conditions('2026-09-30')$$, 'JGC01');
select pg_temp.connecte_sans_claim(:elise);
select pg_temp.doit_refuser_code($$select public.accepter_conditions('2026-09-30')$$, 'JGC01');
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser_code($$select public.accepter_conditions('v1')$$, '22023');
select pg_temp.doit_refuser_code($$select public.accepter_conditions('30/09/2026')$$, '22023');
select pg_temp.doit_refuser_code($$select public.accepter_conditions(null)$$, '22023');
select pg_temp.egal((select count(*) from public.profiles where conditions_version is not null), 0::bigint, 'aucune preuve après les refus');

-- 3. Le client ne peut pas écrire la preuve directement (droit de colonne absent), ni la version ni la date.
select pg_temp.doit_refuser_code($$update public.profiles set conditions_version = '2026-09-30' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$, '42501');
select pg_temp.doit_refuser_code($$update public.profiles set conditions_acceptees_le = now() where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$, '42501');
-- Le pseudo reste modifiable par le joueur lui-même (rien d'autre ne change).
update public.profiles set username = 'Alice' where id = :alice;
select pg_temp.egal((select username from public.profiles where id = :alice), 'Alice', 'pseudo toujours modifiable');

-- 4. Alice accepte : date et version gardées ; la fonction renvoie la date gardée.
select public.accepter_conditions('2026-09-30') as premiere \gset
select pg_temp.egal((select conditions_version from public.profiles where id = :alice), '2026-09-30', 'version gardée');
select pg_temp.egal((select conditions_acceptees_le from public.profiles where id = :alice), :'premiere'::timestamptz, 'date gardée = date renvoyée');

-- 5. Même version acceptée à nouveau (par exemple à une reconnexion) : la première date fait preuve, elle ne bouge pas.
select pg_temp.egal(public.accepter_conditions('2026-09-30'), :'premiere'::timestamptz, 'même version : première date gardée');

-- 6. Nouvelle version des conditions : la preuve est remplacée (date et version).
select pg_temp.egal((select conditions_version from public.profiles where id = :alice), '2026-09-30', 'avant la nouvelle version');
select public.accepter_conditions('2027-01-15') as seconde \gset
select pg_temp.egal((select conditions_version from public.profiles where id = :alice), '2027-01-15', 'nouvelle version gardée');
select pg_temp.egal((:'seconde'::timestamptz >= :'premiere'::timestamptz), true, 'nouvelle date postérieure ou égale');

-- 7. Alice n'écrit que pour elle : le profil de Bruno n'a pas bougé.
select pg_temp.egal((select conditions_version from public.profiles where id = :bruno), null::text, 'profil d''un autre intact');
reset role;

-- 8. Structure : la fonction est security definer à search_path vide, fermée à anon et service_role, ouverte à authenticated ;
--    les deux colonnes vont ensemble ; RLS toujours active sur profiles.
select pg_temp.egal((select prosecdef from pg_proc where proname = 'accepter_conditions'), true, 'security definer');
select pg_temp.egal((select proconfig[1] from pg_proc where proname = 'accepter_conditions'), 'search_path=""', 'search_path vide');
select pg_temp.egal(has_function_privilege('anon', 'public.accepter_conditions(text)', 'execute'), false, 'anon sans droit');
select pg_temp.egal(has_function_privilege('service_role', 'public.accepter_conditions(text)', 'execute'), false, 'service_role sans droit');
select pg_temp.egal(has_function_privilege('authenticated', 'public.accepter_conditions(text)', 'execute'), true, 'authenticated avec droit');
select pg_temp.egal(has_column_privilege('authenticated', 'public.profiles', 'conditions_version', 'update'), false, 'version non modifiable par le client');
select pg_temp.egal(has_column_privilege('authenticated', 'public.profiles', 'conditions_acceptees_le', 'update'), false, 'date non modifiable par le client');
select pg_temp.egal(has_table_privilege('authenticated', 'public.profiles', 'insert'), false, 'pas d''insertion directe');
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), true, 'RLS active sur profiles');
select pg_temp.doit_refuser_code($$insert into public.profiles (id, conditions_version) values ('aaaaaaaa-0000-4000-8000-000000000009', '2026-09-30')$$, '23514');

\echo 'preuve_conditions : tous les cas passent.'
rollback;
