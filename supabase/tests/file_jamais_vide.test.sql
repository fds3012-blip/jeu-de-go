-- Tests rejouables de la file d'attente élargie (issue #436) : file par défaut (9 × 9, normale, japonais), réglages
-- acceptés après 30 s d'attente avec ceux de qui attendait le plus, appariement par la cote gardé, et
-- `refuser_partie_direct` (« Rester » contre l'IA quand un humain arrive).
-- Transaction annulée à la fin : aucune donnée ne reste. Voir supabase/tests/LISEZMOI.md.
-- Le temps : now() est fixe dans une transaction ; le test recule `created_at` pour simuler l'attente.
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
-- Réglages d'une partie en direct : « taille/cadence/comptage/temps principal ».
create function pg_temp.reglages(p_partie uuid) returns text
language sql as $$
  select g.size || '/' || d.cadence || '/' || g.rules || '/' || d.main_ms
  from public.games g join public.parties_direct d on d.partie_id = g.id where g.id = p_partie;
$$;
create function pg_temp.joueurs(p_partie uuid) returns text
language sql as $$
  select array[least(black_id, white_id), greatest(black_id, white_id)]::text from public.games where id = p_partie;
$$;
create function pg_temp.paire(a uuid, b uuid) returns text
language sql as $$ select array[least(a, b), greatest(a, b)]::text; $$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Comptes avec pseudo : Alice (1) … Léa (12).
insert into auth.users (id, email, is_anonymous)
  select ('00000000-0000-4000-8000-0000000004' || lpad(n::text, 2, '0'))::uuid, 'f' || n || '@exemple.test', false
  from generate_series(1, 12) n;
insert into public.profiles (id, username)
  select ('00000000-0000-4000-8000-0000000004' || lpad(n::text, 2, '0'))::uuid, 'file' || n
  from generate_series(1, 12) n
  on conflict (id) do update set username = excluded.username;
\set alice '''00000000-0000-4000-8000-000000000401'''
\set bruno '''00000000-0000-4000-8000-000000000402'''
\set chloe '''00000000-0000-4000-8000-000000000403'''
\set eve '''00000000-0000-4000-8000-000000000405'''
\set fanny '''00000000-0000-4000-8000-000000000406'''
\set gaston '''00000000-0000-4000-8000-000000000407'''
\set hugo '''00000000-0000-4000-8000-000000000408'''
\set ines '''00000000-0000-4000-8000-000000000409'''
\set jules '''00000000-0000-4000-8000-000000000410'''
\set karim '''00000000-0000-4000-8000-000000000411'''
\set lea '''00000000-0000-4000-8000-000000000412'''
select count(*) as profils_avant from public.profiles \gset
select count(*) as parties_avant from public.games \gset

-- 1. File par défaut : find_match(9) sans autre réglage, c'est 9 × 9, normale, japonais.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Alice attend');
reset role;
select pg_temp.egal((select size || '/' || cadence || '/' || regles from public.match_queue where user_id = :alice), '9/normale/japanese', 'file par défaut');

-- 2. Moins de 30 s d'attente : pas d'appariement entre réglages différents (comme avant).
update public.match_queue set created_at = now() - interval '29 seconds' where user_id = :alice;
set local role authenticated;
select pg_temp.connecte(:bruno);
select pg_temp.egal(public.find_match(13::smallint, 'rapide'), null::uuid, 'Alice attend depuis 29 s : Bruno (13 × 13, rapide) attend aussi');
reset role;
select pg_temp.egal((select count(*) from public.match_queue where user_id in (:alice, :bruno)), 2::bigint, 'deux dans la file');

-- 3. Alice attend depuis 30 s : Chloé (19 × 19, lente, chinois) la trouve, avec les réglages d'Alice.
update public.match_queue set created_at = now() - interval '30 seconds' where user_id = :alice;
set local role authenticated;
select pg_temp.connecte(:chloe);
select public.find_match(19::smallint, 'lente', 'chinese') as p1 \gset
reset role;
select pg_temp.egal(:'p1' is not null, true, 'après 30 s : autres réglages acceptés');
select pg_temp.egal(pg_temp.joueurs(:'p1'), pg_temp.paire(:alice, :chloe), 'Chloé contre Alice (pas Bruno, qui vient d''arriver)');
select pg_temp.egal(pg_temp.reglages(:'p1'), '9/normale/japanese/600000', 'réglages de qui attendait le plus : Alice');
select pg_temp.egal((select (rated, komi, handicap) from public.games where id = :'p1'), row(true, 6.5::numeric(4,1), 0::smallint), 'partie classée standard');
select pg_temp.egal((select count(*) from public.match_queue where user_id in (:alice, :chloe)), 0::bigint, 'les deux sortent de la file');

-- 4. L'adversaire attend depuis plus longtemps que l'appelant, qui n'était pas dans la file : réglages de l'adversaire.
update public.match_queue set created_at = now() - interval '40 seconds' where user_id = :bruno;
set local role authenticated;
select pg_temp.connecte(:eve);
select public.find_match(9::smallint) as p2 \gset
reset role;
select pg_temp.egal(pg_temp.joueurs(:'p2'), pg_temp.paire(:bruno, :eve), 'Eve trouve Bruno');
select pg_temp.egal(pg_temp.reglages(:'p2'), '13/rapide/japanese/300000', 'réglages de Bruno (13 × 13, rapide)');

-- 5. L'appelant attend depuis plus longtemps que l'adversaire : réglages de l'appelant.
set local role authenticated;
select pg_temp.connecte(:fanny);
select pg_temp.egal(public.find_match(19::smallint, 'lente'), null::uuid, 'Fanny attend (19 × 19, lente)');
select pg_temp.connecte(:gaston);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Gaston attend (9 × 9) : personne depuis 30 s');
reset role;
update public.match_queue set created_at = now() - interval '45 seconds' where user_id = :fanny;
update public.match_queue set created_at = now() - interval '35 seconds' where user_id = :gaston;
set local role authenticated;
select pg_temp.connecte(:fanny);
select public.find_match(19::smallint, 'lente') as p3 \gset
reset role;
select pg_temp.egal(pg_temp.joueurs(:'p3'), pg_temp.paire(:fanny, :gaston), 'Fanny trouve Gaston');
select pg_temp.egal(pg_temp.reglages(:'p3'), '19/lente/japanese/1200000', 'réglages de Fanny, qui attendait le plus');

-- 6. Cote égale : les mêmes réglages d'abord, même si un autre attend depuis plus longtemps.
set local role authenticated;
select pg_temp.connecte(:hugo);
select pg_temp.egal(public.find_match(13::smallint), null::uuid, 'Hugo attend (13 × 13)');
select pg_temp.connecte(:ines);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Inès attend (9 × 9)');
reset role;
update public.match_queue set created_at = now() - interval '60 seconds' where user_id = :hugo;
update public.match_queue set created_at = now() - interval '5 seconds' where user_id = :ines;
set local role authenticated;
select pg_temp.connecte(:jules);
select public.find_match(9::smallint) as p4 \gset
reset role;
select pg_temp.egal(pg_temp.joueurs(:'p4'), pg_temp.paire(:ines, :jules), 'Jules trouve Inès (mêmes réglages)');
select pg_temp.egal(pg_temp.reglages(:'p4'), '9/normale/japanese/600000', '9 × 9 normale');
select pg_temp.egal((select count(*) from public.match_queue where user_id = :hugo), 1::bigint, 'Hugo attend toujours');

-- 7. L'appariement par la cote est gardé : élargir les réglages n'élargit pas l'écart de cote au-delà de la règle.
update public.profiles set rating = 2600, cote_rd = 50 where id = :hugo;
update public.match_queue set rating = 2600, rd = 50 where user_id = :hugo;
set local role authenticated;
select pg_temp.connecte(:lea);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Léa (800) trop loin de Hugo (2600) : elle attend');
reset role;
select pg_temp.egal((select count(*) from public.match_queue where user_id in (:hugo, :lea)), 2::bigint, 'Hugo et Léa attendent');
-- Hugo, proche en cote après 60 s : Karim (2300) le trouve, réglages de Hugo.
update public.profiles set rating = 2300 where id = :karim;
set local role authenticated;
select pg_temp.connecte(:karim);
select public.find_match(19::smallint) as p5 \gset
reset role;
select pg_temp.egal(pg_temp.joueurs(:'p5'), pg_temp.paire(:hugo, :karim), 'Karim trouve Hugo');
select pg_temp.egal(pg_temp.reglages(:'p5'), '13/normale/japanese/600000', 'réglages de Hugo');

-- 8. refuser_partie_direct : accès.
set local role anon;
select pg_temp.doit_refuser(format('select public.refuser_partie_direct(%L)', :'p1'), '42501');
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select pg_temp.doit_refuser(format('select public.refuser_partie_direct(%L)', :'p1'), '42501');
select pg_temp.connecte(:lea);
select pg_temp.doit_refuser(format('select public.refuser_partie_direct(%L)', :'p1'), 'P0002');
reset role;
select pg_temp.egal((select status::text from public.games where id = :'p1'), 'active', 'un tiers ne touche pas la partie');

-- 9. Noir n'a pas joué : il refuse, la partie est annulée, aucune cote ne bouge ; l'autre peut rejouer.
select black_id as noir1, white_id as blanc1 from public.games where id = :'p1' \gset
set local role authenticated;
select pg_temp.connecte(:'noir1');
select pg_temp.egal(public.refuser_partie_direct(:'p1'), true, 'Noir refuse avant son premier coup');
select pg_temp.egal(public.refuser_partie_direct(:'p1'), false, 'deuxième refus : rien à faire');
reset role;
select pg_temp.egal((select status::text || ':' || coalesce(result, '-') from public.games where id = :'p1'), 'aborted:-', 'partie annulée, sans résultat');
select pg_temp.egal((select trait_depuis is null from public.parties_direct where partie_id = :'p1'), true, 'pendule arrêtée');
select pg_temp.egal((select count(*) from public.rating_history where game_id = :'p1'), 0::bigint, 'aucune cote');
set local role authenticated;
select pg_temp.connecte(:'blanc1');
-- (19 × 19 lente chinois : Léa, qui attend en 9 × 9 depuis 0 s, ne lui est pas proposée.)
select pg_temp.egal(public.find_match(19::smallint, 'lente', 'chinese'), null::uuid, 'l''autre joueur peut chercher de nouveau');
select pg_temp.egal(public.quitter_file_attente(), null::uuid, 'plus de partie en cours pour lui');

-- 10. Blanc n'a pas joué, Noir si : Blanc peut refuser ; Noir, lui, a déjà joué et ne peut plus.
reset role;
select black_id as noir2, white_id as blanc2 from public.games where id = :'p2' \gset
update public.games set moves = 'ee' where id = :'p2';
set local role authenticated;
select pg_temp.connecte(:'noir2');
select pg_temp.egal(public.refuser_partie_direct(:'p2'), false, 'Noir a joué : la partie continue');
reset role;
select pg_temp.egal((select status::text from public.games where id = :'p2'), 'active', 'toujours en cours');
set local role authenticated;
select pg_temp.connecte(:'blanc2');
select pg_temp.egal(public.refuser_partie_direct(:'p2'), true, 'Blanc refuse avant son premier coup');
reset role;
select pg_temp.egal((select status::text || ':' || moves from public.games where id = :'p2'), 'aborted:ee', 'annulée, coups gardés');

-- 11. Chacun a joué : refus impossible (il faudra abandonner, ce qui compte la cote).
select black_id as noir3, white_id as blanc3 from public.games where id = :'p3' \gset
update public.games set moves = 'ddpp' where id = :'p3';
set local role authenticated;
select pg_temp.connecte(:'blanc3');
select pg_temp.egal(public.refuser_partie_direct(:'p3'), false, 'Blanc a joué : refus impossible');
reset role;
select pg_temp.egal((select status::text from public.games where id = :'p3'), 'active', 'la partie continue');

-- 12. Refuser fait aussi sortir de la file (le joueur ne veut plus être prévenu).
set local role authenticated;
select pg_temp.connecte(:lea);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Léa attend encore');
reset role;
-- Léa est dans la file ; une partie d'elle (Noir, rien joué) est refusée : elle en sort.
insert into public.games (id, black_id, white_id, created_by, size, rules, status, rated)
  values ('00000000-0000-4000-8000-0000000004ff', :lea, :jules, :lea, 9, 'japanese', 'active', false);
insert into public.parties_direct (partie_id, cadence, main_ms, periodes, periode_ms, noir_ms, blanc_ms, noir_periodes, blanc_periodes, trait_depuis)
  values ('00000000-0000-4000-8000-0000000004ff', 'normale', 600000, 3, 30000, 600000, 600000, 3, 3, now());
set local role authenticated;
select pg_temp.connecte(:lea);
select pg_temp.egal(public.refuser_partie_direct('00000000-0000-4000-8000-0000000004ff'), true, 'Léa refuse');
reset role;
select pg_temp.egal((select count(*) from public.match_queue where user_id = :lea), 0::bigint, 'Léa sort de la file');

-- 13. Structure : security definer, search_path vide, droits, une seule find_match, aucune donnée supprimée.
select pg_temp.egal((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('find_match', 'refuser_partie_direct')),
  true, 'security definer, search_path vide');
select pg_temp.egal((select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('find_match', 'refuser_partie_direct')), false, 'fermées à anon');
select pg_temp.egal((select bool_and(has_function_privilege('authenticated', p.oid, 'execute')) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('find_match', 'refuser_partie_direct')), true, 'ouvertes aux comptes');
select pg_temp.egal((select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'find_match'), 1::bigint, 'une seule find_match');
select pg_temp.egal((select pg_get_function_identity_arguments(oid) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'find_match'),
  'p_size smallint, p_cadence text, p_regles text', 'même signature');
select pg_temp.egal((select count(*) >= :parties_avant + 6 from public.games), true, 'aucune partie supprimée');
select pg_temp.egal((select count(*) from public.profiles), :profils_avant::bigint, 'aucun profil supprimé');
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');

\o
\echo 'file_jamais_vide : tous les cas passent.'
rollback;
