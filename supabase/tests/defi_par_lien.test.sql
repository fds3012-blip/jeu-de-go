-- Tests rejouables du défi par lien (issue #81). Tout se passe dans une transaction annulée à la fin :
-- aucune donnée ne reste, même lancé sur une base réelle. Voir supabase/tests/LISEZMOI.md.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
begin;

-- Aides : se connecter comme un joueur (claims du jeton, comme PostgREST) et attendre un refus précis.
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
create function pg_temp.egal(p_obtenu anyelement, p_attendu anyelement, p_cas text) returns void
language plpgsql as $$
begin
  if p_obtenu is distinct from p_attendu then
    raise exception 'ÉCHEC %: obtenu %, attendu %', p_cas, p_obtenu, p_attendu;
  end if;
end;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Trois joueurs : Alice crée le défi, Bruno l'ouvre, Chloé est une tierce personne. Depuis #343, il faut un compte
-- avec pseudo pour créer ou rejoindre un défi (20260930233100_compte_obligatoire.sql) ; Denis, anonyme, est refusé.
insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bruno@exemple.test', false),
  ('cccccccc-0000-4000-8000-000000000003', 'chloe@exemple.test', false),
  ('dddddddd-0000-4000-8000-000000000004', null, true);
insert into public.profiles (id, username) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Alice'), ('bbbbbbbb-0000-4000-8000-000000000002', 'Bruno'),
  ('cccccccc-0000-4000-8000-000000000003', 'Chloe'), ('dddddddd-0000-4000-8000-000000000004', null)
  on conflict (id) do update set username = excluded.username;
\set denis '''dddddddd-0000-4000-8000-000000000004'''
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set chloe '''cccccccc-0000-4000-8000-000000000003'''

-- 1. Création : sans connexion, refusée ; connectée, renvoie une partie et un jeton de 32 caractères.
set local role anon;
select pg_temp.doit_refuser('select * from public.creer_defi()', 'permission denied');
reset role;
set local role authenticated;
select pg_temp.doit_refuser('select * from public.creer_defi()', 'Crée ton compte');
select pg_temp.connecte(:alice);
select partie_id as partie, jeton from public.creer_defi() \gset
select pg_temp.egal(:'jeton' ~ '^[A-Za-z0-9_-]{32}$', true, 'format du jeton');
select pg_temp.egal((select status::text from public.games where id = :'partie'), 'waiting', 'partie en attente');
select pg_temp.egal((select white_id from public.games where id = :'partie'), :alice::uuid, 'créatrice en Blanc');
select pg_temp.egal((select size::int from public.games where id = :'partie'), 9, 'plateau 9 × 9');

-- 2. Lecture : seuls les joueurs voient le défi et la partie ; personne n'écrit directement.
select pg_temp.egal((select count(*) from public.defis), 1::bigint, 'la créatrice lit son défi');
select pg_temp.connecte(:chloe);
select pg_temp.egal((select count(*) from public.defis), 0::bigint, 'un tiers ne lit pas le défi');
select pg_temp.egal((select count(*) from public.games where id = :'partie'), 0::bigint, 'un tiers ne lit pas la partie privée');
select pg_temp.doit_refuser(format('update public.defis set invite_id = %L where partie_id = %L', :chloe, :'partie'), 'permission denied');
select pg_temp.doit_refuser(format('insert into public.defis (partie_id, jeton) values (%L, %L)', :'partie', repeat('x', 32)), 'permission denied');
select pg_temp.doit_refuser(format('delete from public.defis where partie_id = %L', :'partie'), 'permission denied');
select pg_temp.doit_refuser('select public.rejoindre_defi(''inconnu'')', 'introuvable');
select pg_temp.doit_refuser(format('select public.rejoindre_defi(%L)', repeat('A', 32)), 'introuvable');
reset role;
set local role anon;
select pg_temp.doit_refuser('select count(*) from public.defis', 'permission denied');
reset role;

-- 3. Rejoindre : une session anonyme est refusée (#343) ; Bruno (compte avec pseudo) prend Noir ; la partie
--    commence ; le délai de 3 jours démarre.
set local role authenticated;
select pg_temp.connecte(:denis, true);
select pg_temp.doit_refuser(format('select public.rejoindre_defi(%L)', :'jeton'), 'Crée ton compte');
select pg_temp.connecte(:bruno);
select pg_temp.egal(public.rejoindre_defi(:'jeton'), :'partie'::uuid, 'l''invité rejoint');
select pg_temp.egal((select black_id from public.games where id = :'partie'), :bruno::uuid, 'invité en Noir');
select pg_temp.egal((select status::text from public.games where id = :'partie'), 'active', 'partie commencée');
select pg_temp.egal((select date_limite from public.defis), now() + interval '3 days', 'délai de 3 jours');
select pg_temp.connecte(:chloe);
select pg_temp.doit_refuser(format('select public.rejoindre_defi(%L)', :'jeton'), 'déjà un adversaire');
select pg_temp.connecte(:alice);
select pg_temp.egal(public.rejoindre_defi(:'jeton'), :'partie'::uuid, 'la créatrice retrouve sa partie');
select pg_temp.egal((select black_id from public.games where id = :'partie'), :bruno::uuid, 'la créatrice ne prend pas la place');

-- 4. Coups : jouer_coup_defi est réservée à la fonction serveur (clé service).
select pg_temp.doit_refuser(format('select public.jouer_coup_defi(%L, %L, '''', ''ee'')', :'partie', :bruno), 'permission denied');
select pg_temp.connecte(:bruno);
-- La RLS de games n'autorise la mise à jour que des parties contre l'IA : aucune ligne touchée.
update public.games set moves = 'ee' where id = :'partie';
select pg_temp.egal((select moves from public.games where id = :'partie'), '', 'aucun coup écrit directement par un joueur');
reset role;

set local role service_role;
-- Tiers refusé
select pg_temp.doit_refuser(format('select public.jouer_coup_defi(%L, %L, '''', ''ee'')', :'partie', :chloe), 'ne joues pas');
select pg_temp.doit_refuser(format('select public.jouer_coup_defi(%L, null, '''', ''ee'')', :'partie'), 'ne joues pas');
-- Hors tour refusé (Noir commence : Alice, Blanc, doit attendre)
select pg_temp.doit_refuser(format('select public.jouer_coup_defi(%L, %L, '''', ''ee'')', :'partie', :alice), 'pas ton tour');
-- Coup de Bruno accepté
select pg_temp.egal(public.jouer_coup_defi(:'partie', :bruno, '', 'ee') ->> 'coups', 'ee', 'premier coup de Noir');
-- Bruno ne rejoue pas deux fois de suite ; Alice ne joue pas sur une partie périmée
select pg_temp.doit_refuser(format('select public.jouer_coup_defi(%L, %L, ''ee'', ''cc'')', :'partie', :bruno), 'pas ton tour');
select pg_temp.doit_refuser(format('select public.jouer_coup_defi(%L, %L, '''', ''cc'')', :'partie', :alice), 'a changé');
select pg_temp.doit_refuser(format('select public.jouer_coup_defi(%L, %L, ''ee'', ''zz'')', :'partie', :alice), 'Coup invalide');
select pg_temp.doit_refuser(format('select public.jouer_coup_defi(%L, %L, ''ee'', ''jj'')', :'partie', :alice), 'hors du plateau');
-- Même la clé service ne peut pas écrire les coups d'un défi sans passer par la fonction
select pg_temp.doit_refuser(format('update public.games set moves = ''eecc'' where id = %L', :'partie'), 'fonction serveur');
select pg_temp.egal(public.jouer_coup_defi(:'partie', :alice, 'ee', 'cc') ->> 'coups', 'eecc', 'réponse de Blanc');
reset role;

-- 5. Délai dépassé ⇒ victoire au temps, constatée à la lecture. Noir (Bruno) est au trait et laisse passer 3 jours.
update public.defis set date_limite = now() - interval '1 minute' where partie_id = :'partie';
set local role authenticated;
select pg_temp.connecte(:chloe);
select pg_temp.doit_refuser(format('select public.victoire_au_temps(%L)', :'partie'), 'introuvable');
select pg_temp.connecte(:alice);
select pg_temp.egal(public.victoire_au_temps(:'partie'), 'W+T', 'Blanc gagne au temps');
select pg_temp.egal((select status::text from public.games where id = :'partie'), 'finished', 'partie terminée');
reset role;
set local role service_role;
select pg_temp.doit_refuser(format('select public.jouer_coup_defi(%L, %L, ''eecc'', ''dd'')', :'partie', :bruno), 'pas en cours');
reset role;

-- 6. Délai dépassé constaté au coup suivant : le coup est refusé, la victoire au temps reste enregistrée.
set local role authenticated;
select pg_temp.connecte(:alice);
select partie_id as partie2, jeton as jeton2 from public.creer_defi() \gset
select pg_temp.connecte(:bruno);
select pg_temp.egal(public.rejoindre_defi(:'jeton2'), :'partie2'::uuid, 'deuxième défi rejoint');
select pg_temp.egal(public.victoire_au_temps(:'partie2'), null::text, 'dans le délai : la partie continue');
reset role;
update public.defis set date_limite = now() - interval '1 second' where partie_id = :'partie2';
set local role service_role;
select pg_temp.egal(public.jouer_coup_defi(:'partie2', :bruno, '', 'ee') ->> 'resultat', 'W+T', 'coup trop tard : victoire au temps');
select pg_temp.egal((select result from public.games where id = :'partie2'), 'W+T', 'résultat enregistré');
select pg_temp.egal((select moves from public.games where id = :'partie2'), '', 'coup trop tard non écrit');
reset role;

-- 7. Lien expiré, et une partie publique entre humains reste lisible par tous (pas de régression).
set local role authenticated;
select pg_temp.connecte(:alice);
select partie_id as partie3, jeton as jeton3 from public.creer_defi() \gset
reset role;
update public.defis set lien_expire_le = now() - interval '1 second' where partie_id = :'partie3';
insert into public.games (black_id, white_id, created_by, size, status)
  values (:alice, :bruno, :alice, 9, 'active');
set local role authenticated;
select pg_temp.connecte(:chloe);
select pg_temp.doit_refuser(format('select public.rejoindre_defi(%L)', :'jeton3'), 'expiré');
select pg_temp.egal((select count(*) from public.games where not prive), 1::bigint, 'partie publique toujours visible');
select pg_temp.egal((select count(*) from public.games where prive), 0::bigint, 'aucun défi visible par un tiers');
reset role;

-- 8. Toutes les fonctions du défi sont security definer avec un search_path fixé ; la RLS est active.
select pg_temp.egal((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
  from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('creer_defi', 'rejoindre_defi', 'jouer_coup_defi', 'victoire_au_temps', 'games_defi_garde')),
  true, 'security definer et search_path');
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.defis'::regclass), true, 'RLS active sur defis');

\echo 'defi_par_lien : tous les cas passent.'
rollback;
