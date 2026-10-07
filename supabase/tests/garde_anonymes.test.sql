-- Tests rejouables de la garde des comptes anonymes (issue #316). Tout se passe dans une transaction annulée
-- à la fin : aucune donnée ne reste. Voir supabase/tests/LISEZMOI.md.
-- Le jeton est simulé par request.jwt.claims (sub, role, is_anonymous), comme PostgREST.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
begin;

create function pg_temp.connecte(p_uid uuid, p_anonyme boolean default false) returns void
language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anonyme)::text, true);
$$;
-- Jeton sans claim is_anonymous (jetons émis avant l'activation) : traité comme un vrai compte.
create function pg_temp.connecte_sans_claim(p_uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
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
-- Nombre de lignes touchées par un update ou un delete (la RLS filtre sans erreur).
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

-- Alice et Chloé ont un compte ; Bruno et Denis sont anonymes.
insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', null, true),
  ('cccccccc-0000-4000-8000-000000000003', 'chloe@exemple.test', false),
  ('dddddddd-0000-4000-8000-000000000004', null, true);
-- Le déclencheur handle_new_user n'existe pas sur ce socle : les profils sont créés à la main. Les comptes ont un
-- pseudo, exigé pour le jeu en ligne et les défis depuis #343 (20260930233100_compte_obligatoire.sql).
insert into public.profiles (id, username) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Alice'), ('bbbbbbbb-0000-4000-8000-000000000002', null),
  ('cccccccc-0000-4000-8000-000000000003', 'Chloe'), ('dddddddd-0000-4000-8000-000000000004', null)
  on conflict (id) do update set username = excluded.username;
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set chloe '''cccccccc-0000-4000-8000-000000000003'''
\set denis '''dddddddd-0000-4000-8000-000000000004'''

-- Données de départ (écrites sans RLS) : une demande d'ami reçue par Bruno, un problème commun, une partie
-- classée en cours entre Alice et Chloé, une partie à rejoindre par code.
insert into public.friendships (requester_id, addressee_id) values (:alice, :bruno);
select id as probleme from public.puzzles where owner_id is null limit 1 \gset
insert into public.games (black_id, white_id, created_by, size, status, rated)
  values (:alice, :chloe, :alice, 9, 'active', true) returning id as classee \gset
insert into public.games (black_id, created_by, size, status, invite_code)
  values (:alice, :alice, 9, 'waiting', 'CODE42') returning id as parcode \gset

set local role authenticated;

-- 1. Un anonyme est refusé pour chaque action bloquée.
select pg_temp.connecte(:bruno, true);
-- Depuis #359, les demandes d'ami passent par des fonctions serveur (écriture directe fermée à tous).
select pg_temp.doit_refuser(format('insert into public.friendships (requester_id, addressee_id) values (%L, %L)', :bruno, :chloe), 'permission denied');
select pg_temp.doit_refuser('select public.demander_ami(''Chloe'')', 'Crée ton compte');
select pg_temp.doit_refuser('select public.repondre_ami(''Alice'', true)', 'Crée ton compte');
select pg_temp.doit_refuser(format('insert into public.puzzles (id, owner_id, size, setup, answers, difficulty) select ''anon-1'', %L, size, setup, answers, difficulty from public.puzzles where id = %L', :bruno, :'probleme'), 'row-level security');
select pg_temp.doit_refuser(format('insert into public.games (black_id, created_by, size, status) values (%L, %L, 9, ''waiting'')', :bruno, :bruno), 'row-level security');
select pg_temp.doit_refuser(format('insert into public.games (black_id, created_by, size, status, bot_id) values (%L, %L, 9, ''active'', ''debutant'')', :bruno, :bruno), 'row-level security');
select pg_temp.doit_refuser(format('insert into public.achievements (user_id, badge_id) values (%L, ''premiere_partie'')', :bruno), 'row-level security');
select pg_temp.doit_refuser(format('insert into public.lesson_progress (user_id, lesson_id, steps_done) values (%L, ''capture'', 1)', :bruno), 'row-level security');
select pg_temp.egal(pg_temp.lignes(format('update public.profiles set username = ''Bruno'' where id = %L', :bruno)), 0::bigint, 'anonyme : pas de pseudo');
select pg_temp.doit_refuser('select public.find_match(9::smallint)', 'Crée ton compte');
select pg_temp.doit_refuser('select public.join_game(''CODE42'')', 'Crée ton compte');
select pg_temp.doit_refuser(format('select public.resign_game(%L)', :'classee'), 'Crée un compte');
select pg_temp.doit_refuser(format('select public.record_puzzle_attempt(%L, true)', :'probleme'), 'Crée un compte');
select pg_temp.doit_refuser(format('select public.importer_serie_appareil(1, %L::date)', (now() at time zone 'Europe/Paris')::date), 'Crée un compte');
reset role;
select pg_temp.egal((select count(*) from public.match_queue), 0::bigint, 'anonyme absent de la file');
select pg_temp.egal((select status::text from public.games where id = :'parcode'), 'waiting', 'partie par code toujours libre');
select pg_temp.egal((select status::text from public.friendships where requester_id = :alice), 'pending', 'demande d''ami inchangée');
select pg_temp.egal((select username from public.profiles where id = :bruno), null::text, 'anonyme sans pseudo');
select pg_temp.egal((select count(*) from public.puzzle_attempts where user_id = :bruno), 0::bigint, 'aucun essai anonyme');
select pg_temp.egal((select count(*) from public.rating_history where user_id = :bruno), 0::bigint, 'aucune cote anonyme');
select pg_temp.egal((select count(*) from public.leaderboard where id = :bruno), 0::bigint, 'anonyme absent du classement');

-- Il garde la lecture : profils, problèmes communs, ses relations, sa progression (vide).
set local role authenticated;
select pg_temp.connecte(:bruno, true);
select pg_temp.egal((select count(*) > 0 from public.profiles), true, 'anonyme : lit les profils');
select pg_temp.egal((select count(*) > 0 from public.puzzles), true, 'anonyme : lit les problèmes communs');
select pg_temp.egal((select count(*) from public.friendships), 1::bigint, 'anonyme : lit ses relations');
select pg_temp.egal((select count(*) from public.lesson_progress), 0::bigint, 'anonyme : lit sa progression');

-- 2. Depuis #343, un anonyme ne rejoint plus un défi ; celui qui y est déjà (rejoint avant #343) y joue toujours.
select pg_temp.connecte(:alice);
select partie_id as defi, jeton from public.creer_defi() \gset
select pg_temp.connecte(:bruno, true);
select pg_temp.doit_refuser(format('select public.rejoindre_defi(%L)', :'jeton'), 'Crée ton compte');
reset role;
update public.games set black_id = :bruno, status = 'active' where id = :'defi';
update public.defis set invite_id = :bruno, date_limite = now() + delai_coup where partie_id = :'defi';
set local role authenticated;
select pg_temp.connecte(:bruno, true);
select pg_temp.egal(public.rejoindre_defi(:'jeton'), :'defi'::uuid, 'anonyme déjà invité : retrouve le défi');
select pg_temp.egal((select count(*) from public.games where id = :'defi'), 1::bigint, 'anonyme : lit la partie du défi');
select pg_temp.egal((select count(*) from public.defis where partie_id = :'defi'), 1::bigint, 'anonyme : lit le défi');
select pg_temp.egal(public.victoire_au_temps(:'defi'), null::text, 'anonyme : constate le temps');
reset role;
set local role service_role;
select pg_temp.egal(public.jouer_coup_defi(:'defi', :bruno, '', 'ee') ->> 'coups', 'ee', 'anonyme : joue un coup (game-action)');
reset role;
set local role authenticated;
select pg_temp.connecte(:bruno, true);
select pg_temp.egal(public.resign_game(:'defi'), 'W+R', 'anonyme : abandonne un défi');

-- Depuis #343, un anonyme ne crée plus de défi ; un défi qu'il a créé avant reste jouable par un compte.
select pg_temp.connecte(:denis, true);
select pg_temp.doit_refuser('select * from public.creer_defi()', 'Crée ton compte');
reset role;
insert into public.games (white_id, created_by, size, rules, komi, status, rated, prive)
  values (:denis, :denis, 9, 'japanese', 6.5, 'waiting', false, true) returning id as d1 \gset
insert into public.defis (partie_id, jeton, createur_id) values (:'d1', repeat('D', 32), :denis);
set local role authenticated;
select pg_temp.connecte(:chloe);
select pg_temp.egal(public.rejoindre_defi(repeat('D', 32)), :'d1'::uuid, 'un compte rejoint le défi d''un anonyme');
select pg_temp.connecte(:denis, true);
select pg_temp.egal(public.rejoindre_defi(repeat('D', 32)), :'d1'::uuid, 'anonyme créateur : retrouve son défi');

-- 3. Un vrai compte garde toutes ses actions (avec le claim à false, puis sans claim).
select pg_temp.connecte(:alice);
select pg_temp.egal(public.demander_ami('Chloe'), 'envoyee', 'compte : demande d''ami (#359 : par la fonction serveur)');
select pg_temp.egal(pg_temp.lignes(format('insert into public.puzzles (id, owner_id, size, setup, answers, difficulty) select ''alice-1'', %L, size, setup, answers, difficulty from public.puzzles where id = %L', :alice, :'probleme')), 1::bigint, 'compte : problème personnel');
select pg_temp.egal(pg_temp.lignes('delete from public.puzzles where id = ''alice-1'''), 1::bigint, 'compte : suppression de son problème');
select pg_temp.egal(pg_temp.lignes(format('insert into public.games (black_id, created_by, size, status) values (%L, %L, 9, ''waiting'')', :alice, :alice)), 1::bigint, 'compte : création de partie');
select pg_temp.egal(pg_temp.lignes(format('insert into public.achievements (user_id, badge_id) values (%L, ''premiere_partie'')', :alice)), 1::bigint, 'compte : badge');
select pg_temp.egal(pg_temp.lignes(format('insert into public.lesson_progress (user_id, lesson_id, steps_done) values (%L, ''capture'', 1)', :alice)), 1::bigint, 'compte : progression');
select pg_temp.egal(pg_temp.lignes(format('update public.lesson_progress set steps_done = 2 where user_id = %L', :alice)), 1::bigint, 'compte : progression mise à jour');
select pg_temp.egal(pg_temp.lignes(format('update public.profiles set username = ''Alice'' where id = %L', :alice)), 1::bigint, 'compte : pseudo');
select pg_temp.egal(public.record_puzzle_attempt(:'probleme', true) is not null, true, 'compte : cote des problèmes');
select pg_temp.egal(public.importer_serie_appareil(1, (now() at time zone 'Europe/Paris')::date), 1, 'compte : envoi de la série');
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'compte : entre dans la file');
select pg_temp.egal(public.resign_game(:'classee'), 'W+R', 'compte : abandon d''une partie classée');
select partie_id as defi_alice from public.creer_defi() \gset
select pg_temp.connecte_sans_claim(:chloe);
select pg_temp.egal(public.repondre_ami('Alice', true), 'amis', 'compte sans claim : accepte un ami (#359 : par la fonction serveur)');
select pg_temp.egal(public.join_game('CODE42'), :'parcode'::uuid, 'compte sans claim : rejoint par code');
select pg_temp.egal(public.find_match(9::smallint) is not null, true, 'compte sans claim : trouve un adversaire');
reset role;

-- Un compte a toujours 20 défis en attente au plus.
set local role authenticated;
select pg_temp.connecte(:chloe);
select count(*) from (select public.creer_defi() from generate_series(1, 20)) s;
select pg_temp.doit_refuser('select * from public.creer_defi()', 'déjà 20 défis');
reset role;

-- 4. Structure : politiques restrictives présentes, RLS active partout.
select pg_temp.egal((select string_agg(tablename || ':' || cmd, ',' order by tablename, cmd) from pg_policies
  where schemaname = 'public' and permissive = 'RESTRICTIVE' and 'authenticated' = any(roles)
    and coalesce(qual, with_check) like '%is_anonymous%'),
  'abonnements_rappel:ALL,achievements:INSERT,friendships:INSERT,friendships:UPDATE,games:INSERT,lesson_progress:INSERT,lesson_progress:UPDATE,parties_perso:ALL,profiles:UPDATE,puzzles:DELETE,puzzles:INSERT,reglages_compte:ALL,revisions:ALL',
  'politiques restrictives présentes (#448 : reglages_compte ; #469 : revisions)');
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');

\echo 'garde_anonymes : tous les cas passent.'
rollback;
