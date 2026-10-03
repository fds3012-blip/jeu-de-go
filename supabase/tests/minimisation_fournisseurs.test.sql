-- Tests rejouables de la minimisation des données Apple et Facebook (#411). Transaction annulée à la fin.
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

-- 1. Connexion Facebook : nom, photo et surnom retirés ; identifiant et e-mail gardés.
insert into auth.users (id, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'fanny@exemple.test',
   '{"iss": "https://www.facebook.com", "sub": "987654", "provider_id": "987654", "email": "fanny@exemple.test", "email_verified": true,
     "name": "Fanny Martin", "full_name": "Fanny Martin", "nickname": "fanny.m", "slug": "fanny.martin.5",
     "picture": "https://graph.facebook.com/987654/picture", "avatar_url": "https://graph.facebook.com/987654/picture"}');
\set fanny '''bbbbbbbb-0000-4000-8000-000000000001'''
select pg_temp.egal((select raw_user_meta_data from auth.users where id = :fanny),
  '{"iss": "https://www.facebook.com", "sub": "987654", "provider_id": "987654", "email": "fanny@exemple.test", "email_verified": true}'::jsonb,
  'Facebook : nom, photo, surnom retirés');
insert into auth.identities (user_id, provider, provider_id, identity_data) values
  (:fanny, 'facebook', '987654', '{"sub": "987654", "email": "fanny@exemple.test", "nickname": "fanny.m", "name": "Fanny Martin"}');
select pg_temp.egal((select identity_data from auth.identities where user_id = :fanny),
  '{"sub": "987654", "email": "fanny@exemple.test"}'::jsonb, 'identité Facebook nettoyée');

-- 2. Apple, première connexion (nom une seule fois), adresse relais : l'indicateur d'adresse privée reste.
insert into auth.users (id, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-4000-8000-000000000002', 'abc123@privaterelay.appleid.com',
   '{"iss": "https://appleid.apple.com", "sub": "001234.abcd", "email": "abc123@privaterelay.appleid.com", "email_verified": true,
     "is_private_email": true, "full_name": "Jean Dupont", "name": "Jean Dupont"}');
select pg_temp.egal((select raw_user_meta_data from auth.users where id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  '{"iss": "https://appleid.apple.com", "sub": "001234.abcd", "email": "abc123@privaterelay.appleid.com", "email_verified": true,
    "is_private_email": true}'::jsonb, 'Apple : nom retiré, adresse relais gardée');

-- 3. Reconnexion : rien ne revient.
update auth.users set raw_user_meta_data = raw_user_meta_data || '{"nickname": "f", "preferred_username": "f", "user_name": "f"}' where id = :fanny;
select pg_temp.egal((select raw_user_meta_data ?| array['nickname', 'preferred_username', 'user_name', 'slug'] from auth.users where id = :fanny),
  false, 'surnoms retirés à la reconnexion');

-- 4. Fonction fermée à l'app, RLS partout.
select pg_temp.egal(has_function_privilege('authenticated', 'public.retirer_nom_et_photo(jsonb)', 'execute'), false, 'fonction fermée à l''app');
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');

\echo 'minimisation_fournisseurs : tous les cas passent.'
rollback;
