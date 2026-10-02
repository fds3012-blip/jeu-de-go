-- Tests rejouables de la minimisation du profil et des données Google (E18, #354). Transaction annulée à la fin.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
begin;

create function pg_temp.connecte(p_uid uuid, p_anonyme boolean default false) returns void
language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anonyme)::text, true);
$$;
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

-- 1. Connexion Google : ce que Supabase écrit à la création du compte, nettoyé par le déclencheur.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test',
   '{"iss": "https://accounts.google.com", "sub": "1234567890", "email": "alice@exemple.test", "email_verified": true,
     "phone_verified": false, "provider_id": "1234567890", "name": "Alice Martin", "full_name": "Alice Martin",
     "given_name": "Alice", "family_name": "Martin", "picture": "https://lh3.googleusercontent.com/a/photo",
     "avatar_url": "https://lh3.googleusercontent.com/a/photo"}');
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
select pg_temp.egal((select raw_user_meta_data from auth.users where id = :alice),
  '{"iss": "https://accounts.google.com", "sub": "1234567890", "email": "alice@exemple.test", "email_verified": true,
    "phone_verified": false, "provider_id": "1234567890"}'::jsonb, 'nom et photo retirés à la création, le reste gardé');
insert into auth.identities (user_id, provider, provider_id, identity_data) values
  (:alice, 'google', '1234567890',
   '{"iss": "https://accounts.google.com", "sub": "1234567890", "email": "alice@exemple.test", "email_verified": true,
     "name": "Alice Martin", "picture": "https://lh3.googleusercontent.com/a/photo"}');
select pg_temp.egal((select identity_data from auth.identities where user_id = :alice),
  '{"iss": "https://accounts.google.com", "sub": "1234567890", "email": "alice@exemple.test", "email_verified": true}'::jsonb,
  'identité Google nettoyée');

-- 2. Reconnexion : Supabase réécrit nom et photo ; ils repartent aussitôt.
update auth.users set raw_user_meta_data = raw_user_meta_data || '{"name": "Alice Martin", "picture": "https://x/y"}' where id = :alice;
select pg_temp.egal((select raw_user_meta_data ?| array['name', 'picture', 'full_name', 'avatar_url', 'given_name', 'family_name']
                     from auth.users where id = :alice), false, 'rien ne revient à la reconnexion');
select pg_temp.egal((select raw_user_meta_data ->> 'email' from auth.users where id = :alice), 'alice@exemple.test', 'e-mail toujours là');
update auth.identities set identity_data = identity_data || '{"full_name": "Alice Martin", "avatar_url": "https://x/y"}' where user_id = :alice;
select pg_temp.egal((select identity_data ?| array['name', 'picture', 'full_name', 'avatar_url'] from auth.identities where user_id = :alice),
                    false, 'identité : rien ne revient');

-- 3. Compte par code (pas de métadonnées, ou métadonnées vides) : inchangé, pas d'erreur.
insert into auth.users (id, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bruno@exemple.test', null),
  ('cccccccc-0000-4000-8000-000000000003', 'chloe@exemple.test', '{"email_verified": true}');
select pg_temp.egal((select raw_user_meta_data from auth.users where id = 'bbbbbbbb-0000-4000-8000-000000000002'), null::jsonb, 'null reste null');
select pg_temp.egal((select raw_user_meta_data from auth.users where id = 'cccccccc-0000-4000-8000-000000000003'), '{"email_verified": true}'::jsonb, 'sans nom : inchangé');
-- Le profil est bien créé (handle_new_user intact) et n'a ni avatar ni pays.
select pg_temp.egal((select (username, avatar_url, country) from public.profiles where id = :alice), (null::text, null::text, null::text), 'profil vide de nom et photo');

-- 4. E18 : le joueur ne peut plus écrire avatar_url ni country ; le pseudo reste modifiable ; lecture inchangée.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser_code($$update public.profiles set avatar_url = 'https://exemple.test/image.png' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$, '42501');
select pg_temp.doit_refuser_code($$update public.profiles set country = 'FR' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$, '42501');
update public.profiles set username = 'Alice' where id = :alice;
select pg_temp.egal((select username from public.profiles where id = :alice), 'Alice', 'pseudo modifiable');
select pg_temp.egal((select count(*) from public.profiles where id = :alice), 1::bigint, 'profil lisible');
select pg_temp.egal((select count(*) from public.leaderboard where id = :alice), 1::bigint, 'classement lisible');
reset role;
select pg_temp.egal(has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'update'), false, 'avatar_url non modifiable');
select pg_temp.egal(has_column_privilege('authenticated', 'public.profiles', 'country', 'update'), false, 'country non modifiable');
select pg_temp.egal(has_column_privilege('authenticated', 'public.profiles', 'username', 'update'), true, 'username modifiable');
select pg_temp.egal(has_table_privilege('authenticated', 'public.profiles', 'update'), false, 'pas de mise à jour de toute la ligne');

-- 5. Structure : déclencheurs posés, fonctions fermées à l'app, search_path vide.
select pg_temp.egal((select count(*) from pg_trigger where tgname in ('auth_users_minimiser', 'auth_identities_minimiser')), 2::bigint, 'deux déclencheurs');
select pg_temp.egal((select bool_and(proconfig[1] = 'search_path=""') from pg_proc
                     where proname in ('retirer_nom_et_photo', 'auth_users_minimiser', 'auth_identities_minimiser')), true, 'search_path vide');
select pg_temp.egal(has_function_privilege('authenticated', 'public.retirer_nom_et_photo(jsonb)', 'execute'), false, 'fonction interne fermée');
select pg_temp.egal(has_function_privilege('anon', 'public.retirer_nom_et_photo(jsonb)', 'execute'), false, 'fonction interne fermée (anon)');
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');

\echo 'minimisation_profil_google : tous les cas passent.'
rollback;
