-- Tests rejouables de la revue de sécurité #578 (migration 20261017090000_durcissement_578.sql).
-- Transaction annulée à la fin : aucune donnée ne reste. Voir supabase/tests/LISEZMOI.md.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
begin;

create function pg_temp.connecte(p_uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', false)::text, true);
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
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bruno@exemple.test', false);
insert into public.profiles (id) values ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002')
  on conflict do nothing;
update public.profiles set username = 'Alice' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
update public.profiles set username = 'Bruno' where id = 'bbbbbbbb-0000-4000-8000-000000000002';
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set cle '''BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM'''
\set sec '''tBHItJI5svbpez7KI4CCXg'''

-- 1. Visiteur (anon) : aucune écriture directe, sur aucune table ni vue de public.
select pg_temp.egal((
  select string_agg(c.relname || ':' || p.priv, ', ' order by c.relname, p.priv)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p(priv)
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f') and has_table_privilege('anon', c.oid, p.priv)
), null::text, 'anon : aucun droit d''écriture');
set local role anon;
select pg_temp.doit_refuser('insert into public.rating_history (user_id, kind, rating) values (''aaaaaaaa-0000-4000-8000-000000000001'', ''game'', 3000)', 'permission denied');
select pg_temp.doit_refuser('update public.games set result = ''B+R''', 'permission denied');
select pg_temp.doit_refuser('delete from public.puzzles', 'permission denied');
reset role;
-- Une table créée plus tard (par les migrations) n'accorde plus d'écriture à anon.
create table public.essai_durcissement_578 (id int);
select pg_temp.egal(has_table_privilege('anon', 'public.essai_durcissement_578', 'insert'), false, 'nouvelle table : pas d''insert pour anon');
select pg_temp.egal(has_table_privilege('authenticated', 'public.essai_durcissement_578', 'insert'), true, 'nouvelle table : authenticated inchangé');
drop table public.essai_durcissement_578;

-- 2. Joueur connecté : droits sans politique retirés, ceux dont l'app se sert gardés.
select pg_temp.egal(has_table_privilege('authenticated', 'public.rating_history', 'insert'), false, 'rating_history : pas d''insert');
select pg_temp.egal(has_table_privilege('authenticated', 'public.rating_history', 'update'), false, 'rating_history : pas d''update');
select pg_temp.egal(has_table_privilege('authenticated', 'public.rating_history', 'select'), true, 'rating_history : lecture gardée');
select pg_temp.egal(has_table_privilege('authenticated', 'public.puzzle_attempts', 'insert'), false, 'puzzle_attempts : pas d''insert');
select pg_temp.egal(has_table_privilege('authenticated', 'public.match_queue', 'insert'), false, 'match_queue : pas d''insert');
select pg_temp.egal(has_table_privilege('authenticated', 'public.match_queue', 'delete'), true, 'match_queue : quitter la file gardé');
select pg_temp.egal(has_table_privilege('authenticated', 'public.achievements', 'update'), false, 'achievements : pas d''update');
select pg_temp.egal(has_table_privilege('authenticated', 'public.achievements', 'insert'), true, 'achievements : insert gardé');
select pg_temp.egal(has_table_privilege('authenticated', 'public.puzzles', 'update'), false, 'puzzles : pas d''update');
select pg_temp.egal(has_table_privilege('authenticated', 'public.lesson_progress', 'delete'), false, 'lesson_progress : pas de delete');
select pg_temp.egal(has_table_privilege('authenticated', 'public.leaderboard', 'update'), false, 'leaderboard : vue en lecture seule');
select pg_temp.egal(has_column_privilege('authenticated', 'public.profiles', 'username', 'update'), true, 'pseudo toujours modifiable');

set local role authenticated;
select pg_temp.connecte(:alice);
-- Ce que l'app fait toujours : progression des leçons (upsert), pseudo.
insert into public.lesson_progress (user_id, lesson_id, steps_done) values (:alice, 'capture', 2)
  on conflict (user_id, lesson_id) do update set steps_done = excluded.steps_done;
insert into public.lesson_progress (user_id, lesson_id, steps_done) values (:alice, 'capture', 3)
  on conflict (user_id, lesson_id) do update set steps_done = excluded.steps_done;
select pg_temp.egal((select steps_done from public.lesson_progress where user_id = :alice and lesson_id = 'capture')::int, 3, 'upsert des leçons');
update public.profiles set username = 'Alice2' where id = :alice;
-- Ce qui reste refusé, désormais par le droit lui-même.
select pg_temp.doit_refuser(format('insert into public.rating_history (user_id, kind, rating) values (%L, ''game'', 3000)', :alice), 'permission denied');
select pg_temp.doit_refuser(format('insert into public.match_queue (user_id, size) values (%L, 9)', :alice), 'permission denied');
select pg_temp.doit_refuser('update public.leaderboard set rating = 3000', 'leaderboard');  -- refus de droit (et vue non modifiable : rank())
reset role;

-- 3. Rappel : seuls les services de notification des navigateurs sont acceptés comme adresse d'abonnement.
set local role authenticated;
select pg_temp.connecte(:alice);
select public.enregistrer_abonnement_rappel('https://fcm.googleapis.com/fcm/send/a1', :cle, :sec, 'soir', 'Europe/Paris', 'fr');
select public.enregistrer_abonnement_rappel('https://updates.push.services.mozilla.com/wpush/v2/a2', :cle, :sec, 'soir', 'Europe/Paris', 'fr');
select public.enregistrer_abonnement_rappel('https://web.push.apple.com/QAbc', :cle, :sec, 'soir', 'Europe/Paris', 'fr');
select public.enregistrer_abonnement_rappel('https://wns2-par02p.notify.windows.com/w/?token=a4', :cle, :sec, 'soir', 'Europe/Paris', 'fr');
select pg_temp.doit_refuser(format('select public.enregistrer_abonnement_rappel(%L, %L, %L, ''soir'', ''Europe/Paris'', ''fr'')', a, :cle, :sec), 'abonnements_rappel_service_connu')
from unnest(array[
  'https://evil.test/push', 'https://fcm.googleapis.com.evil.test/x', 'https://fcm.googleapis.com@evil.test/x',
  'https://fcm.googleapis.com:8443/x', 'https://169.254.169.254/latest', 'https://localhost/x',
  'https://notify.windows.com.evil.test/x', 'https://xjvsalkvpgcjrznznxoi.supabase.co/rest/v1/'
]) a;
select pg_temp.egal((select count(*) from public.abonnements_rappel where user_id = :alice), 4::bigint, 'quatre services acceptés');
reset role;
select pg_temp.egal((select convalidated from pg_constraint where conname = 'abonnements_rappel_service_connu'), false,
  'contrainte NOT VALID : abonnements existants non touchés');

-- 4. creer_defi : le profil est verrouillé avant le compte des défis en attente (S2, appels simultanés).
select pg_temp.egal((select prosrc ~ 'from public\.profiles where id = v_uid for update' from pg_proc where oid = 'public.creer_defi()'::regprocedure),
  true, 'creer_defi verrouille le profil');
select pg_temp.egal((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.creer_defi()'::regprocedure),
  true, 'creer_defi : security definer, search_path vide');
select pg_temp.egal(has_function_privilege('anon', 'public.creer_defi()', 'execute'), false, 'creer_defi : rien pour anon');
set local role authenticated;
select pg_temp.connecte(:bruno);
select count(*) from public.creer_defi();
select pg_temp.egal((select count(*) from public.defis where createur_id = :bruno), 1::bigint, 'défi créé');
reset role;
with g as (
  insert into public.games (white_id, created_by, size, rules, komi, status, rated, prive)
  select :bruno, :bruno, 9, 'japanese', 6.5, 'waiting', false, true from generate_series(1, 19)
  returning id)
insert into public.defis (partie_id, jeton, createur_id)
  select id, translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'), :bruno from g;
set local role authenticated;
select pg_temp.connecte(:bruno);
select pg_temp.doit_refuser('select * from public.creer_defi()', '20 défis en attente');
reset role;

-- 5. Toujours vrai : RLS active sur chaque table de public.
select pg_temp.egal((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity), 0::bigint, 'RLS partout');

\o
\echo 'durcissement_578 : tous les cas passent.'
rollback;
