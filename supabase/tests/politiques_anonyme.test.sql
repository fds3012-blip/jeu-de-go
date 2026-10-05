-- Tests rejouables de la réécriture des politiques « Anonyme » (advisors Supabase, règle auth_rls_initplan) et du
-- relevé de sécurité des fonctions. Transaction annulée à la fin.
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

insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', null, true),
  ('eeeeeeee-0000-4000-8000-000000000005', 'elise@exemple.test', false);
update public.profiles set username = 'Alice' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set elise '''eeeeeeee-0000-4000-8000-000000000005'''

-- 1. Les dix politiques existent toujours, restrictives, et lisent le jeton sous la forme reconnue par l'analyseur :
--    « ( SELECT auth.jwt() … » et plus jamais « ( SELECT ((auth.jwt() ».
select pg_temp.egal((select count(*) from pg_policy where polname like 'Anonyme : %'), 11::bigint, 'onze politiques Anonyme (dix + parties perso, #358)');
select pg_temp.egal((select bool_and(not polpermissive) from pg_policy where polname like 'Anonyme : %'), true, 'toutes restrictives');
select pg_temp.egal((select bool_and(
    coalesce(pg_get_expr(polqual, polrelid), '') !~ 'SELECT \(\(auth\.jwt'
    and coalesce(pg_get_expr(polwithcheck, polrelid), '') !~ 'SELECT \(\(auth\.jwt'
    and (coalesce(pg_get_expr(polqual, polrelid), '') || coalesce(pg_get_expr(polwithcheck, polrelid), '')) ~ 'SELECT auth\.jwt\(\)')
  from pg_policy where polname like 'Anonyme : %'), true, 'forme (select auth.jwt()) partout');
-- Les commandes n'ont pas changé : insert, update, delete, all selon la politique.
select pg_temp.egal((select string_agg(polname || ':' || polcmd::text, ',' order by polname) from pg_policy where polname like 'Anonyme : %'),
  'Anonyme : pas d''acceptation d''ami:w,Anonyme : pas de badge:a,Anonyme : pas de création de partie:a,Anonyme : pas de demande d''ami:a,'
  'Anonyme : pas de parties perso:*,Anonyme : pas de problème personnel:a,Anonyme : pas de pseudo:w,Anonyme : pas de rappel:*,Anonyme : pas de suppression de problème:d,'
  'Anonyme : progression des leçons sur l''appareil:a,Anonyme : progression des leçons sur l''appareil (mise à jour):w',
  'commandes inchangées');

-- 2. Même comportement qu'avant : l'anonyme (claim) est refusé, le vrai compte et le jeton sans claim passent.
set local role authenticated;
select pg_temp.connecte(:bruno, true);
select pg_temp.doit_refuser_code($$insert into public.games (black_id, created_by, size, bot_id) values ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 9, 'bot-1')$$, '42501');
select pg_temp.doit_refuser_code($$insert into public.friendships (requester_id, addressee_id) values ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001')$$, '42501');
select pg_temp.doit_refuser_code($$insert into public.lesson_progress (user_id, lesson_id, steps_done) values ('bbbbbbbb-0000-4000-8000-000000000002', 'l1', 1)$$, '42501');
select pg_temp.doit_refuser_code($$insert into public.achievements (user_id, badge_id) values ('bbbbbbbb-0000-4000-8000-000000000002', 'b1')$$, '42501');
-- Mise à jour du pseudo par un anonyme : aucune ligne touchée (politique restrictive sur update).
update public.profiles set username = 'Bruno' where id = :bruno;
select pg_temp.egal((select username from public.profiles where id = :bruno), null::text, 'anonyme sans pseudo');

select pg_temp.connecte(:alice);
insert into public.games (black_id, created_by, size, bot_id) values (:alice, :alice, 9, 'bot-1');
insert into public.lesson_progress (user_id, lesson_id, steps_done) values (:alice, 'l1', 1);
select pg_temp.connecte_sans_claim(:elise);
update public.profiles set username = 'Elise' where id = :elise;
select pg_temp.egal((select username from public.profiles where id = :elise), 'Elise', 'jeton sans claim : vrai compte');
reset role;

-- 3. Relevé de sécurité (advisors) : toute fonction security definer a search_path vide ; seule apercu_defi est
--    exécutable par anon (avec compter_etape depuis #437, compteurs anonymes, et lire_partie_partagee depuis #364 : lien de
--    revue lu par son seul jeton) ; aucune fonction de cote ou de purge n'est exécutable par authenticated.
select pg_temp.egal((select bool_and(p.proconfig[1] = 'search_path=""') from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef), true, 'security definer : search_path vide');
select pg_temp.egal((select string_agg(p.proname, ',' order by p.proname) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and has_function_privilege('anon', p.oid, 'execute')), 'apercu_defi,compter_etape,lire_partie_partagee', 'anon : apercu_defi, compter_etape et lire_partie_partagee seulement');
select pg_temp.egal((select bool_or(has_function_privilege('authenticated', p.oid, 'execute')) from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('apply_game_rating', 'finish_game_by_score', 'jouer_coup_defi', 'play_move', 'purger_anonymes_inactifs',
                      'reclamer_rappels', 'exiger_compte_avec_pseudo', 'retirer_nom_et_photo')), false, 'fonctions internes fermées');
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');

\echo 'politiques_anonyme : tous les cas passent.'
rollback;
