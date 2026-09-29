-- Tests de la migration places_du_joueur (revue de sécurité du 29/09, constat S1) : un client ne peut pas
-- inscrire un autre joueur dans une partie qu'il crée ou modifie directement. Transaction annulée à la fin.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
begin;

create function pg_temp.connecte(p_uid uuid, p_anonyme boolean default false) returns void
language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anonyme)::text, true);
$$;
create function pg_temp.doit_refuser(p_sql text, p_motif text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'REFUS ATTENDU, mais accepté : %', p_sql;
exception when others then
  if sqlerrm like 'REFUS ATTENDU%' then raise; end if;
  if sqlerrm not ilike '%' || p_motif || '%' then
    raise exception 'Mauvais refus pour « % » : « % » (attendu : « % »)', p_sql, sqlerrm, p_motif;
  end if;
end;
$$;
create function pg_temp.lignes(p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
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

insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false),
  ('cccccccc-0000-4000-8000-000000000003', 'chloe@exemple.test', false);
insert into public.profiles (id) values
  ('aaaaaaaa-0000-4000-8000-000000000001'), ('cccccccc-0000-4000-8000-000000000003')
  on conflict do nothing;
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set chloe '''cccccccc-0000-4000-8000-000000000003'''

set local role authenticated;
select pg_temp.connecte(:alice);

-- 1. Création : Alice ne peut pas inscrire Chloé, ni dans une partie contre l'IA, ni dans une partie à rejoindre.
select pg_temp.doit_refuser(format(
  'insert into public.games (black_id, white_id, created_by, size, status, bot_id, result) values (%L, %L, %L, 9, ''finished'', ''debutant'', ''B+R'')',
  :alice, :chloe, :alice), 'row-level security');
select pg_temp.doit_refuser(format(
  'insert into public.games (black_id, white_id, created_by, size, status) values (%L, %L, %L, 9, ''waiting'')',
  :alice, :chloe, :alice), 'row-level security');

-- 2. Toujours permis : sa propre partie contre l'IA, une partie à rejoindre où l'autre place est vide.
select pg_temp.egal(pg_temp.lignes(format(
  'insert into public.games (black_id, created_by, size, status, bot_id) values (%L, %L, 9, ''active'', ''debutant'')',
  :alice, :alice)), 1::bigint, 'partie contre l''IA');
select pg_temp.egal(pg_temp.lignes(format(
  'insert into public.games (white_id, created_by, size, status) values (%L, %L, 9, ''waiting'')',
  :alice, :alice)), 1::bigint, 'partie à rejoindre');

-- 3. Modification : Alice ne peut pas ajouter Chloé à sa partie contre l'IA ; elle peut toujours la jouer.
select id as ia from public.games where bot_id is not null and created_by = :alice \gset
select pg_temp.doit_refuser(format('update public.games set white_id = %L where id = %L', :chloe, :'ia'), 'row-level security');
select pg_temp.egal(pg_temp.lignes(format('update public.games set moves = ''ee'' where id = %L', :'ia')), 1::bigint, 'coup contre l''IA');
reset role;

-- 4. Les fonctions serveur remplissent toujours la place de l'adversaire (elles contournent la RLS).
set local role authenticated;
select pg_temp.connecte(:alice);
select partie_id as defi, jeton from public.creer_defi() \gset
select pg_temp.connecte(:chloe);
select pg_temp.egal(public.rejoindre_defi(:'jeton'), :'defi'::uuid, 'rejoindre un défi');
reset role;
select pg_temp.egal((select black_id from public.games where id = :'defi'), :chloe::uuid, 'Chloé en Noir dans le défi');

-- 5. Structure : les deux politiques restrictives sont présentes, RLS active partout.
select pg_temp.egal((select string_agg(cmd, ',' order by cmd) from pg_policies
  where schemaname = 'public' and tablename = 'games' and permissive = 'RESTRICTIVE'
    and policyname like 'Places de la partie%'), 'INSERT,UPDATE', 'politiques présentes');
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');

\echo 'places_du_joueur : tous les cas passent.'
rollback;
