-- Tests rejouables de la suppression des sessions sans compte inutilisées (issue #318). Tout se passe dans une
-- transaction annulée à la fin : aucune donnée ne reste. Voir supabase/tests/LISEZMOI.md.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
begin;

create function pg_temp.egal(p_obtenu anyelement, p_attendu anyelement, p_cas text) returns void
language plpgsql as $$
begin
  if p_obtenu is distinct from p_attendu then
    raise exception 'ÉCHEC %: obtenu %, attendu %', p_cas, p_obtenu, p_attendu;
  end if;
end;
$$;
create function pg_temp.existe(p_uid uuid) returns boolean language sql as $$
  select exists (select 1 from auth.users where id = p_uid)
$$;

-- Alice a un vrai compte (ancien, inactif : jamais touchée). Les autres sont anonymes :
-- Bruno (100 j, rien), Chloé (100 j, session rafraîchie il y a 10 j), Denis (100 j, connecté il y a 5 j),
-- Émile (100 j, a créé un défi joué par Alice, partie figée depuis 70 j), Fanny (100 j, défi jamais rejoint),
-- Gaston (100 j, partie avec Alice modifiée il y a 20 j), Hugo (créé il y a 30 j).
insert into auth.users (id, email, is_anonymous, created_at, last_sign_in_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false, now() - interval '400 days', now() - interval '300 days'),
  ('bbbbbbbb-0000-4000-8000-000000000002', null, true, now() - interval '100 days', now() - interval '100 days'),
  ('cccccccc-0000-4000-8000-000000000003', null, true, now() - interval '100 days', now() - interval '100 days'),
  ('dddddddd-0000-4000-8000-000000000004', null, true, now() - interval '100 days', now() - interval '5 days'),
  ('eeeeeeee-0000-4000-8000-000000000005', null, true, now() - interval '100 days', null),
  ('ffffffff-0000-4000-8000-000000000006', null, true, now() - interval '100 days', null),
  ('99999999-0000-4000-8000-000000000007', null, true, now() - interval '100 days', null),
  ('88888888-0000-4000-8000-000000000008', null, true, now() - interval '30 days', null);
insert into public.profiles (id) select id from auth.users on conflict do nothing;
insert into auth.sessions (user_id, updated_at, refreshed_at) values
  ('cccccccc-0000-4000-8000-000000000003', now() - interval '90 days', (now() - interval '10 days')::timestamp);
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set chloe '''cccccccc-0000-4000-8000-000000000003'''
\set denis '''dddddddd-0000-4000-8000-000000000004'''
\set emile '''eeeeeeee-0000-4000-8000-000000000005'''
\set fanny '''ffffffff-0000-4000-8000-000000000006'''
\set gaston '''99999999-0000-4000-8000-000000000007'''
\set hugo '''88888888-0000-4000-8000-000000000008'''

insert into public.games (black_id, white_id, created_by, size, status, prive, updated_at)
  values (:alice, :emile, :emile, 9, 'finished', true, now() - interval '70 days') returning id as partage \gset
insert into public.games (white_id, created_by, size, status, prive, updated_at)
  values (:fanny, :fanny, 9, 'waiting', true, now() - interval '70 days') returning id as seule \gset
insert into public.games (black_id, white_id, created_by, size, status, prive, updated_at)
  values (:alice, :gaston, :gaston, 9, 'active', true, now() - interval '20 days') returning id as recente \gset
insert into public.games (black_id, created_by, size, status, updated_at)
  values (:alice, :alice, 9, 'waiting', now() - interval '300 days') returning id as vieille_alice \gset

-- 1. Moins de 60 jours : refusé.
do $$
begin
  perform public.purger_anonymes_inactifs(30);
  raise exception 'REFUS ATTENDU';
exception when others then
  if sqlerrm not like 'Durée minimale%' then raise; end if;
end;
$$;

-- 2. Personne ne l'appelle depuis l'app.
select pg_temp.egal(has_function_privilege('authenticated', 'public.purger_anonymes_inactifs(integer, integer)', 'execute'), false, 'authenticated');
select pg_temp.egal(has_function_privilege('anon', 'public.purger_anonymes_inactifs(integer, integer)', 'execute'), false, 'anon');
select pg_temp.egal(has_function_privilege('service_role', 'public.purger_anonymes_inactifs(integer, integer)', 'execute'), false, 'service_role');

-- 3. Passage : Bruno, Émile et Fanny partent.
select pg_temp.egal(public.purger_anonymes_inactifs(), 3, 'nombre supprimé');
select pg_temp.egal(pg_temp.existe(:bruno), false, 'Bruno supprimé');
select pg_temp.egal(pg_temp.existe(:emile), false, 'Émile supprimé');
select pg_temp.egal(pg_temp.existe(:fanny), false, 'Fanny supprimée');
select pg_temp.egal((select count(*) from public.profiles where id in (:bruno, :emile, :fanny)), 0::bigint, 'profils supprimés');

-- 4. Gardés : vrai compte inactif, session rafraîchie, connexion récente, partie récente, compte récent.
select pg_temp.egal(pg_temp.existe(:alice), true, 'Alice (vrai compte) gardée');
select pg_temp.egal(pg_temp.existe(:chloe), true, 'Chloé (session rafraîchie) gardée');
select pg_temp.egal(pg_temp.existe(:denis), true, 'Denis (connexion récente) gardé');
select pg_temp.egal(pg_temp.existe(:gaston), true, 'Gaston (partie récente) gardé');
select pg_temp.egal(pg_temp.existe(:hugo), true, 'Hugo (compte récent) gardé');

-- 5. Parties : la partie partagée reste pour Alice, anonymisée ; celle sans adversaire est supprimée.
select pg_temp.egal((select created_by from public.games where id = :'partage'), :alice::uuid, 'créateur repris par Alice');
select pg_temp.egal((select white_id from public.games where id = :'partage'), null::uuid, 'place d''Émile vidée');
select pg_temp.egal((select black_id from public.games where id = :'partage'), :alice::uuid, 'place d''Alice intacte');
select pg_temp.egal((select count(*) from public.games where id = :'seule'), 0::bigint, 'partie de Fanny supprimée');
select pg_temp.egal((select count(*) from public.games where id in (:'recente', :'vieille_alice')), 2::bigint, 'autres parties intactes');

-- 6. Second passage : rien de plus.
select pg_temp.egal(public.purger_anonymes_inactifs(), 0, 'second passage');

\echo 'purge_anonymes : tous les cas passent.'
rollback;
