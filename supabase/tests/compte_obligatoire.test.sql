-- Tests rejouables du compte obligatoire avec pseudo (issue #343). Transaction annulée à la fin : aucune donnée ne
-- reste. Voir supabase/tests/LISEZMOI.md. Le jeton est simulé par request.jwt.claims (sub, role, is_anonymous).
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
-- Refus attendu avec un code d'erreur (SQLSTATE) précis : c'est ce que le client lit (src/data/compteRequis.ts).
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

-- Alice : compte avec pseudo. Sam : compte sans pseudo. Bruno : anonyme. Élise : anonyme dans auth.users, jeton sans
-- claim. Chloé : compte avec pseudo.
insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', null, true),
  ('cccccccc-0000-4000-8000-000000000003', 'chloe@exemple.test', false),
  ('eeeeeeee-0000-4000-8000-000000000005', null, true),
  ('ffffffff-0000-4000-8000-000000000006', 'sam@exemple.test', false);
insert into public.profiles (id, username) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Alice'), ('bbbbbbbb-0000-4000-8000-000000000002', null),
  ('cccccccc-0000-4000-8000-000000000003', 'Chloe'), ('eeeeeeee-0000-4000-8000-000000000005', null),
  ('ffffffff-0000-4000-8000-000000000006', null)
  on conflict (id) do update set username = excluded.username;
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set chloe '''cccccccc-0000-4000-8000-000000000003'''
\set elise '''eeeeeeee-0000-4000-8000-000000000005'''
\set sam '''ffffffff-0000-4000-8000-000000000006'''

-- Un défi libre d'Alice, une partie à rejoindre par code.
set local role authenticated;
select pg_temp.connecte(:alice);
select partie_id as libre, jeton as jeton_libre from public.creer_defi() \gset
reset role;
insert into public.games (black_id, created_by, size, status, invite_code)
  values (:alice, :alice, 9, 'waiting', 'CODE43') returning id as parcode \gset
select count(*) as parties_avant from public.games \gset
select count(*) as profils_avant from public.profiles \gset

-- 1. Sans session, anonyme (claim ou auth.users) : JGC01 « Crée ton compte » pour les quatre fonctions.
set local role authenticated;
select pg_temp.deconnecte();
select pg_temp.doit_refuser_code('select * from public.creer_defi()', 'JGC01');
select pg_temp.doit_refuser_code(format('select public.rejoindre_defi(%L)', :'jeton_libre'), 'JGC01');
select pg_temp.doit_refuser_code('select public.find_match(9::smallint)', 'JGC01');
select pg_temp.doit_refuser_code('select public.join_game(''CODE43'')', 'JGC01');
select pg_temp.connecte(:bruno, true);
select pg_temp.doit_refuser_code('select * from public.creer_defi()', 'JGC01');
select pg_temp.doit_refuser_code(format('select public.rejoindre_defi(%L)', :'jeton_libre'), 'JGC01');
select pg_temp.doit_refuser_code('select public.find_match(9::smallint)', 'JGC01');
select pg_temp.doit_refuser_code('select public.join_game(''CODE43'')', 'JGC01');
select pg_temp.doit_refuser('select * from public.creer_defi()', 'Crée ton compte');
select pg_temp.connecte_sans_claim(:elise);
select pg_temp.doit_refuser_code('select * from public.creer_defi()', 'JGC01');
select pg_temp.doit_refuser_code(format('select public.rejoindre_defi(%L)', :'jeton_libre'), 'JGC01');
select pg_temp.doit_refuser_code('select public.find_match(9::smallint)', 'JGC01');
select pg_temp.doit_refuser_code('select public.join_game(''CODE43'')', 'JGC01');

-- 2. Compte sans pseudo : JGP01 « Choisis ton pseudo ».
select pg_temp.connecte(:sam);
select pg_temp.doit_refuser_code('select * from public.creer_defi()', 'JGP01');
select pg_temp.doit_refuser_code(format('select public.rejoindre_defi(%L)', :'jeton_libre'), 'JGP01');
select pg_temp.doit_refuser_code('select public.find_match(9::smallint)', 'JGP01');
select pg_temp.doit_refuser_code('select public.join_game(''CODE43'')', 'JGP01');
select pg_temp.doit_refuser('select * from public.creer_defi()', 'Choisis ton pseudo');
-- Partie entre humains créée directement : refusée sans pseudo ; contre l'IA : permise.
select pg_temp.doit_refuser(format('insert into public.games (white_id, created_by, size, status) values (%L, %L, 9, ''waiting'')', :sam, :sam), 'row-level security');
select pg_temp.egal(pg_temp.lignes(format('insert into public.games (black_id, created_by, size, status, bot_id) values (%L, %L, 9, ''active'', ''debutant'')', :sam, :sam)), 1::bigint, 'sans pseudo : partie contre l''IA');
reset role;
select pg_temp.egal((select count(*) from public.match_queue), 0::bigint, 'personne dans la file');
select pg_temp.egal((select status::text from public.games where id = :'parcode'), 'waiting', 'partie par code toujours libre');
select pg_temp.egal((select invite_id from public.defis where partie_id = :'libre'), null::uuid, 'défi toujours libre');

-- 3. Une fois le pseudo choisi, Sam peut tout faire.
update public.profiles set username = 'Sam' where id = :sam;
set local role authenticated;
select pg_temp.connecte(:sam);
select pg_temp.egal(pg_temp.lignes(format('insert into public.games (white_id, created_by, size, status) values (%L, %L, 9, ''waiting'')', :sam, :sam)), 1::bigint, 'avec pseudo : partie à rejoindre');
select pg_temp.egal(public.join_game('CODE43'), :'parcode'::uuid, 'avec pseudo : rejoint par code');
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'avec pseudo : entre dans la file');
select pg_temp.egal((select count(*) from public.creer_defi()), 1::bigint, 'avec pseudo : crée un défi');
select pg_temp.egal(public.rejoindre_defi(:'jeton_libre'), :'libre'::uuid, 'avec pseudo : rejoint un défi');
select pg_temp.connecte_sans_claim(:chloe);
select pg_temp.egal(public.find_match(9::smallint) is not null, true, 'compte sans claim avec pseudo : trouve un adversaire');
reset role;

-- 4. Parties en cours avant #343 : l'anonyme (invité ou créateur) et le compte sans pseudo gardent leur défi.
update public.profiles set username = null where id = :sam;
insert into public.games (white_id, black_id, created_by, size, rules, komi, status, rated, prive)
  values (:alice, :bruno, :alice, 9, 'japanese', 6.5, 'active', false, true) returning id as ancien \gset
insert into public.defis (partie_id, jeton, createur_id, invite_id, date_limite)
  values (:'ancien', repeat('A', 32), :alice, :bruno, now() + interval '3 days');
insert into public.games (white_id, black_id, created_by, size, rules, komi, status, rated, prive)
  values (:bruno, :sam, :bruno, 9, 'japanese', 6.5, 'active', false, true) returning id as ancien2 \gset
insert into public.defis (partie_id, jeton, createur_id, invite_id, date_limite)
  values (:'ancien2', repeat('B', 32), :bruno, :sam, now() + interval '3 days');
set local role authenticated;
select pg_temp.connecte(:bruno, true);
select pg_temp.egal(public.rejoindre_defi(repeat('A', 32)), :'ancien'::uuid, 'anonyme invité : retrouve son défi');
select pg_temp.egal(public.rejoindre_defi(repeat('B', 32)), :'ancien2'::uuid, 'anonyme créateur : retrouve son défi');
select pg_temp.egal(public.victoire_au_temps(:'ancien'), null::text, 'anonyme : constate le temps');
select pg_temp.connecte(:sam);
select pg_temp.egal(public.rejoindre_defi(repeat('B', 32)), :'ancien2'::uuid, 'sans pseudo : retrouve son défi');
reset role;
set local role service_role;
select pg_temp.egal(public.jouer_coup_defi(:'ancien', :bruno, '', 'ee') ->> 'coups', 'ee', 'anonyme : joue (game-action)');
select pg_temp.egal(public.jouer_coup_defi(:'ancien2', :sam, '', 'ee') ->> 'coups', 'ee', 'sans pseudo : joue (game-action)');
reset role;
set local role authenticated;
select pg_temp.connecte(:bruno, true);
select pg_temp.egal(public.resign_game(:'ancien'), 'W+R', 'anonyme : abandonne son défi');
reset role;

-- 5. Aperçu du lien, sans session (rôle anon) : pseudo du créateur, taille, état ; rien pour un jeton inconnu.
reset role;
insert into public.games (white_id, created_by, size, rules, komi, status, rated, prive)
  values (:alice, :alice, 9, 'japanese', 6.5, 'waiting', false, true) returning id as perime \gset
insert into public.defis (partie_id, jeton, createur_id, lien_expire_le)
  values (:'perime', repeat('E', 32), :alice, now() - interval '1 second');
set local role authenticated;
select pg_temp.connecte(:alice);
select jeton as jeton_neuf from public.creer_defi() \gset
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select pg_temp.egal((select createur_pseudo || '/' || taille || '/' || etat || '/' || coalesce(ma_place, '-')
  from public.apercu_defi(:'jeton_neuf')), 'Alice/9/libre/-', 'aperçu : défi libre');
select pg_temp.egal((select etat from public.apercu_defi(:'jeton_libre')), 'pris', 'aperçu : déjà un adversaire');
select pg_temp.egal((select etat from public.apercu_defi(repeat('E', 32))), 'expire', 'aperçu : lien expiré');
select pg_temp.egal((select etat from public.apercu_defi(repeat('A', 32))), 'fini', 'aperçu : partie finie');
select pg_temp.egal((select count(*) from public.apercu_defi(repeat('Z', 32))), 0::bigint, 'aperçu : jeton inconnu');
select pg_temp.egal((select count(*) from public.apercu_defi('x'' or 1=1 --')), 0::bigint, 'aperçu : jeton mal formé');
select pg_temp.doit_refuser('select public.exiger_compte_avec_pseudo()', 'permission denied');
reset role;
set local role authenticated;
select pg_temp.connecte(:bruno, true);
select pg_temp.egal((select ma_place from public.apercu_defi(repeat('A', 32))), 'invite', 'aperçu : ma place d''invité');
select pg_temp.connecte(:alice);
select pg_temp.egal((select ma_place from public.apercu_defi(:'jeton_neuf')), 'createur', 'aperçu : ma place de créatrice');
select pg_temp.doit_refuser('select public.exiger_compte_avec_pseudo()', 'permission denied');
reset role;

-- 6. Aucune donnée supprimée ; structure : security definer, search_path vide, droits, RLS active partout.
select pg_temp.egal((select count(*) >= :parties_avant from public.games), true, 'aucune partie supprimée');
select pg_temp.egal((select count(*) from public.profiles), :profils_avant::bigint, 'aucun profil supprimé');
select pg_temp.egal((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
  from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('exiger_compte_avec_pseudo', 'creer_defi', 'rejoindre_defi', 'find_match', 'join_game', 'apercu_defi')),
  true, 'security definer et search_path');
select pg_temp.egal(has_function_privilege('authenticated', 'public.exiger_compte_avec_pseudo()', 'execute'), false, 'contrôle interne non exposé');
select pg_temp.egal(has_function_privilege('anon', 'public.apercu_defi(text)', 'execute'), true, 'aperçu lisible sans session');
select pg_temp.egal(has_function_privilege('anon', 'public.creer_defi()', 'execute'), false, 'anon ne crée pas de défi');
select pg_temp.egal((select count(*) from pg_policies where schemaname = 'public' and tablename = 'games'
  and permissive = 'RESTRICTIVE' and policyname = 'Partie entre humains : pseudo requis' and cmd = 'INSERT'), 1::bigint, 'politique pseudo présente');
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');

\echo 'compte_obligatoire : tous les cas passent.'
rollback;
