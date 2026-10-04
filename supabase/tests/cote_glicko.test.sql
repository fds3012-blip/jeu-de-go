-- Tests rejouables de la cote de jeu Glicko-2 (issue #417). Transaction annulée à la fin : aucune donnée ne reste.
-- Voir supabase/tests/LISEZMOI.md. Les valeurs attendues sont celles de src/go/cote.ts (même calcul, mêmes arrondis),
-- vérifiées aussi dans src/go/cote.test.ts.
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
  if sqlerrm not ilike '%' || p_motif || '%' and sqlstate <> p_motif then
    raise exception 'Mauvais refus pour « % » : % « % » (attendu : « % »)', p_sql, sqlstate, sqlerrm, p_motif;
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
-- Cote, RD, volatilité et parties d'un joueur (lus sans RLS).
create function pg_temp.etat(p_uid uuid) returns text
language sql as $$
  select rating || '/' || cote_rd || '/' || cote_vol || '/' || cote_parties || '/' || cote_provisoire
  from public.profiles where id = p_uid;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Comptes avec pseudo : Alice, Bruno, Chloé, Éve, Fanny, Gaston, Hugo, Inès, Jules ; Dan est anonyme.
insert into auth.users (id, email, is_anonymous)
  select ('00000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'j' || n || '@exemple.test', n = 4
  from generate_series(1, 10) n;
insert into public.profiles (id, username)
  select ('00000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, case when n <> 4 then 'joueur' || n end
  from generate_series(1, 10) n
  on conflict (id) do update set username = excluded.username;
\set alice '''00000000-0000-4000-8000-000000000001'''
\set bruno '''00000000-0000-4000-8000-000000000002'''
\set chloe '''00000000-0000-4000-8000-000000000003'''
\set dan '''00000000-0000-4000-8000-000000000004'''
\set eve '''00000000-0000-4000-8000-000000000005'''
\set fanny '''00000000-0000-4000-8000-000000000006'''
\set gaston '''00000000-0000-4000-8000-000000000007'''
\set hugo '''00000000-0000-4000-8000-000000000008'''
\set ines '''00000000-0000-4000-8000-000000000009'''
\set jules '''00000000-0000-4000-8000-000000000010'''

-- 1. Valeurs par défaut : 800, RD 350, provisoire, aucune partie.
select pg_temp.egal(pg_temp.etat(:alice), '800/350.00/0.060000/0/true', 'profil neuf');

-- 2. Glicko-2 : exemple de Glickman (1500, RD 200, contre 1400/30 gagné, 1550/100 perdu, 1700/300 perdu).
select pg_temp.egal((select round(cote::numeric, 2) || '/' || round(rd::numeric, 2) || '/' || round(vol::numeric, 5)
  from public.glicko2(1500, 200, 0.06, array[1400, 1550, 1700]::float8[], array[30, 100, 300]::float8[], array[1, 0, 0]::float8[])),
  '1464.05/151.52/0.06000', 'exemple de Glickman');
-- Sans adversaire : seul l'écart de confiance grandit.
select pg_temp.egal((select round(rd::numeric, 2) from public.glicko2(1500, 50, 0.06, '{}', '{}', '{}')), 51.07, 'période sans partie');

-- 3. Point de départ : compte avec pseudo exigé, choix bornés, notés dans l'historique.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select pg_temp.doit_refuser('select public.choisir_depart_cote(''regles'')', 'JGC01');
select pg_temp.connecte(:dan, true);
select pg_temp.doit_refuser('select public.choisir_depart_cote(''regles'')', 'JGC01');
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser('select public.choisir_depart_cote(''expert'')', 'JGR02');
select pg_temp.doit_refuser('select public.choisir_depart_cote(''regles'', 10)', 'JGR02');
select pg_temp.doit_refuser('select public.choisir_depart_cote(''club'')', 'JGR02');
select pg_temp.doit_refuser('select public.choisir_depart_cote(''club'', 26)', 'JGR02');
select pg_temp.doit_refuser('select public.choisir_depart_cote(''club'', -1)', 'JGR02');
select pg_temp.egal(public.choisir_depart_cote('decouvre'), 300, 'je découvre : 300');
select pg_temp.egal(public.choisir_depart_cote('club', 15), 1500, 'club 15e kyu : 1500');
select pg_temp.egal(public.choisir_depart_cote('club', 0), 3000, 'club 1er dan : 3000');
select pg_temp.egal(public.choisir_depart_cote('club', 25), 500, 'club 25e kyu : 500');
-- Tant qu'aucune partie classée n'est comptée, le départ se change encore.
select pg_temp.egal(public.choisir_depart_cote('regles'), 800, 'je connais les règles : 800');
select pg_temp.egal((select (cote_depart, cote_depart_kyu, rating) from public.profiles where id = :alice), row('regles'::text, null::smallint, 800), 'départ gardé');
select pg_temp.egal((select count(*)::integer from public.rating_history where user_id = :alice and kind = 'depart'), 5, 'départs dans l''historique (lus par RLS)');
-- Aucune écriture directe de la cote, même sur son propre profil.
select pg_temp.doit_refuser(format('update public.profiles set rating = 3800 where id = %L', :alice), 'permission denied');
select pg_temp.doit_refuser(format('update public.profiles set cote_rd = 50 where id = %L', :alice), 'permission denied');
select pg_temp.doit_refuser(format('update public.profiles set cote_parties = 1 where id = %L', :alice), 'permission denied');
select pg_temp.doit_refuser(format('insert into public.rating_history (user_id, kind, rating) values (%L, ''game'', 3000)', :alice), '42501');
-- Fonctions de calcul fermées à l'app.
select pg_temp.doit_refuser(format('select public.apply_game_rating(gen_random_uuid(), %L, %L)', :alice, :bruno), 'permission denied');
select pg_temp.doit_refuser('select * from public.glicko2(1500, 200, 0.06, ''{}'', ''{}'', ''{}'')', 'permission denied');
-- L'historique d'un autre joueur ne se lit pas.
select pg_temp.connecte(:bruno);
select pg_temp.egal((select count(*)::integer from public.rating_history where user_id = :alice), 0, 'historique d''un autre invisible');
reset role;

-- 4. Partie classée en cours : le départ ne se change pas.
insert into public.games (black_id, white_id, created_by, size, status, rated)
  values (:alice, :bruno, :alice, 9, 'active', true) returning id as partie \gset
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser('select public.choisir_depart_cote(''decouvre'')', 'JGR03');

-- 5. Bruno abandonne : Alice (800, RD 350) bat Bruno (800, RD 350) : 962 / 638, RD 290,32, ±162.
select pg_temp.connecte(:bruno);
select pg_temp.egal(public.resign_game(:'partie'), 'B+R', 'abandon de Bruno');
reset role;
select pg_temp.egal(pg_temp.etat(:alice), '962/290.32/0.060000/1/true', 'Alice après sa victoire');
select pg_temp.egal(pg_temp.etat(:bruno), '638/290.32/0.060000/1/true', 'Bruno après sa défaite');
select pg_temp.egal((select string_agg(rating || ':' || ecart || ':' || rd, ',' order by rating) from public.rating_history
  where game_id = :'partie' and kind = 'game'), '638:-162:290.32,962:162:290.32', 'historique de la partie');
select pg_temp.egal((select puzzle_rating from public.profiles where id = :alice), 800, 'cote des problèmes inchangée');
-- Une partie ne compte qu'une fois.
select public.apply_game_rating(:'partie', :alice, :bruno);
select pg_temp.egal(pg_temp.etat(:alice), '962/290.32/0.060000/1/true', 'partie déjà comptée : rien ne change');
-- Joueur étranger à la partie : refusé.
select pg_temp.doit_refuser(format('select public.apply_game_rating(%L, %L, %L)', :'partie', :chloe, :bruno), 'étrangers');

-- 6. Après la première partie classée, le départ ne se choisit plus.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser('select public.choisir_depart_cote(''club'', 1)', 'JGR01');
reset role;

-- 7. Parties non classées et parties contre l'IA : jamais comptées.
insert into public.games (black_id, white_id, created_by, size, status, rated)
  values (:alice, :bruno, :alice, 9, 'finished', false) returning id as amicale \gset
select public.apply_game_rating(:'amicale', :alice, :bruno);
select pg_temp.egal(pg_temp.etat(:alice), '962/290.32/0.060000/1/true', 'partie non classée : rien ne change');
select pg_temp.doit_refuser(format('insert into public.games (black_id, created_by, size, status, rated, bot_id) values (%L, %L, 9, ''active'', true, ''caillou'')', :alice, :alice),
  'games_classee_entre_humains');

-- 8. Second match : Chloé (1500, RD 80) bat Alice (962, RD 290,32) : 1503 / 942.
update public.profiles set rating = 1500, cote_rd = 80, cote_parties = 20, cote_maj_le = now() where id = :chloe;
insert into public.games (black_id, white_id, created_by, size, status, rated)
  values (:chloe, :alice, :chloe, 9, 'active', true) returning id as partie2 \gset
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.resign_game(:'partie2'), 'B+R', 'abandon d''Alice');
reset role;
select pg_temp.egal(pg_temp.etat(:chloe), '1503/80.28/0.059999/21/false', 'Chloé, cote sûre');
select pg_temp.egal(pg_temp.etat(:alice), '942/274.69/0.060000/2/true', 'Alice, toujours provisoire');

-- 9. Absence : Éve (1500, RD 80) n'a pas joué depuis 95 jours (3 périodes : RD 82,01) ; elle bat Fanny (2900, RD 120).
update public.profiles set rating = 1500, cote_rd = 80, cote_parties = 30, cote_maj_le = now() - interval '95 days' where id = :eve;
update public.profiles set rating = 2900, cote_rd = 120, cote_parties = 8, cote_maj_le = now() where id = :fanny;
select pg_temp.egal(round(public.cote_rd_apres_absence(80, 0.06, now() - interval '95 days', now())::numeric, 2), 82.01, 'RD après 95 jours');
select pg_temp.egal(round(public.cote_rd_apres_absence(80, 0.06, now() - interval '29 days', now())::numeric, 2), 80.00, 'RD après 29 jours');
select pg_temp.egal(round(public.cote_rd_apres_absence(300, 0.06, now() - interval '9000 days', now())::numeric, 2), 350.00, 'RD plafonné à 350');
insert into public.games (black_id, white_id, created_by, size, status, rated)
  values (:eve, :fanny, :eve, 9, 'finished', true) returning id as partie3 \gset
select public.apply_game_rating(:'partie3', :eve, :fanny);
select pg_temp.egal(pg_temp.etat(:eve), '1537/82.67/0.060012/31/false', 'Éve après son exploit');
select pg_temp.egal(pg_temp.etat(:fanny), '2819/120.44/0.060013/9/true', 'Fanny après sa défaite');

-- 10. Fin aux points (fonction serveur, clé service) : même calcul, appelé une fois.
update public.profiles set rating = 800, cote_rd = 350, cote_vol = 0.06, cote_parties = 0, cote_maj_le = null where id in (:gaston, :hugo);
insert into public.games (black_id, white_id, created_by, size, status, rated)
  values (:gaston, :hugo, :gaston, 9, 'active', true) returning id as partie4 \gset
update public.games set counting = true, dead_stones = '', dead_proposed_by = :hugo where id = :'partie4';
set local role service_role;
select pg_temp.egal(public.finish_game_by_score(:'partie4', :gaston, '', '', 'B+12.5', 40, 27.5), 'B+12.5', 'comptage accepté');
reset role;
select pg_temp.egal(pg_temp.etat(:gaston), '962/290.32/0.060000/1/true', 'Gaston gagne aux points');
select pg_temp.egal(pg_temp.etat(:hugo), '638/290.32/0.060000/1/true', 'Hugo perd aux points');

-- 11. Appariement par la cote : le plus proche d'abord, écart accepté selon l'incertitude.
--     Inès (1300, RD 350) attend ; Jules (800, RD 350) : 500 > 100 + 247 → pas d'adversaire, il attend aussi.
--     Bruno (638→1000 ici, RD 350) : Jules à 200, Inès à 300 → Jules, le plus proche.
update public.profiles set rating = 1300, cote_rd = 350 where id = :ines;
update public.profiles set rating = 800, cote_rd = 350 where id = :jules;
update public.profiles set rating = 1000, cote_rd = 350 where id = :bruno;
set local role authenticated;
select pg_temp.connecte(:ines);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Inès attend');
select pg_temp.connecte(:jules);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Jules trop loin d''Inès : il attend');
select pg_temp.connecte(:bruno);
select public.find_match(9::smallint) as partie5 \gset
reset role;
select pg_temp.egal((select array[least(black_id, white_id), greatest(black_id, white_id)]::text from public.games where id = :'partie5'),
  array[least(:bruno::uuid, :jules::uuid), greatest(:bruno::uuid, :jules::uuid)]::text, 'Bruno trouve Jules, le plus proche');
select pg_temp.egal((select rated from public.games where id = :'partie5'), true, 'partie trouvée classée');
select pg_temp.egal((select rating || '/' || rd from public.match_queue where user_id = :ines), '1300/350.00', 'Inès attend toujours, avec son RD');
-- Deux joueurs sûrs (RD 60) : 160 points d'écart > 100 + 42 → pas d'adversaire.
update public.profiles set rating = 2000, cote_rd = 60 where id = :gaston;
update public.profiles set rating = 2160, cote_rd = 60 where id = :hugo;
delete from public.match_queue where user_id = :ines;
set local role authenticated;
select pg_temp.connecte(:gaston);
select pg_temp.egal(public.find_match(13::smallint), null::uuid, 'Gaston attend');
select pg_temp.connecte(:hugo);
select pg_temp.egal(public.find_match(13::smallint), null::uuid, 'Hugo trop loin pour deux cotes sûres');
reset role;

-- 12. Structure : fonctions à search_path vide, internes fermées, RLS active partout.
select pg_temp.egal((select bool_and(p.proconfig @> array['search_path=""']) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('glicko2', 'glicko2_f', 'cote_rd_apres_absence', 'apply_game_rating', 'choisir_depart_cote', 'find_match')),
  true, 'search_path vide');
select pg_temp.egal((select bool_or(has_function_privilege(r, p.oid, 'execute')) from pg_proc p, unnest(array['anon', 'authenticated']) r
  where p.pronamespace = 'public'::regnamespace and p.proname in ('glicko2', 'glicko2_f', 'cote_rd_apres_absence', 'apply_game_rating')),
  false, 'calcul fermé à l''app');
select pg_temp.egal(has_function_privilege('anon', 'public.choisir_depart_cote(text, integer)', 'execute'), false, 'départ fermé à anon');
select pg_temp.egal(has_function_privilege('authenticated', 'public.choisir_depart_cote(text, integer)', 'execute'), true, 'départ ouvert aux comptes');
select pg_temp.egal((select prosecdef from pg_proc where oid = 'public.apply_game_rating(uuid, uuid, uuid)'::regprocedure), true, 'apply_game_rating security definer');
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');

\echo 'cote_glicko : tous les cas passent.'
rollback;
