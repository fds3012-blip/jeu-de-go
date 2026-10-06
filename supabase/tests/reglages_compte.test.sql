-- Tests rejouables des réglages synchronisés (issue #448). Transaction annulée à la fin : aucune donnée ne reste.
-- Le jeton est simulé par request.jwt.claims (sub, role, is_anonymous), comme PostgREST. Voir supabase/tests/LISEZMOI.md.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
begin;

create function pg_temp.connecte(p_uid uuid, p_anonyme boolean default false) returns void
language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anonyme)::text, true);
$$;
create function pg_temp.deconnecte() returns void
language sql as $$ select set_config('request.jwt.claims', '{"role":"authenticated"}', true); $$;
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
create function pg_temp.r(p_v jsonb, p_t bigint) returns jsonb
language sql as $$ select jsonb_build_object('v', p_v, 't', p_t) $$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Alice et Chloé ont un compte (Chloé sans pseudo : les réglages n'en demandent pas) ; Bruno est anonyme.
insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', null, true),
  ('cccccccc-0000-4000-8000-000000000003', 'chloe@exemple.test', false);
insert into public.profiles (id) values
  ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002'), ('cccccccc-0000-4000-8000-000000000003')
  on conflict do nothing;
update public.profiles set username = 'Alice' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set chloe '''cccccccc-0000-4000-8000-000000000003'''

-- 1. Visiteur sans connexion : aucun droit.
set local role anon;
select pg_temp.doit_refuser('select * from public.reglages_compte', 'permission denied');
select pg_temp.doit_refuser('select public.enregistrer_reglages(''{}'')', 'permission denied');
reset role;

set local role authenticated;
-- 2. Anonyme, jeton sans utilisateur : refusés.
select pg_temp.connecte(:bruno, true);
select pg_temp.doit_refuser('select public.enregistrer_reglages(''{}'')', 'Crée ton compte');
select pg_temp.deconnecte();
select pg_temp.doit_refuser('select public.enregistrer_reglages(''{}'')', 'Crée ton compte');
-- Jeton qui se dit non anonyme pour un compte anonyme : refusé aussi (auth.users fait foi).
select pg_temp.connecte(:bruno, false);
select pg_temp.doit_refuser('select public.enregistrer_reglages(''{}'')', 'Crée ton compte');

-- 3. Première lecture : vide. Aucune écriture directe, même sur sa ligne.
select pg_temp.connecte(:alice);
select pg_temp.egal(public.enregistrer_reglages('{}'), '{}'::jsonb, 'lecture à vide');
select pg_temp.egal(public.enregistrer_reglages(null), '{}'::jsonb, 'null = lecture');
select pg_temp.doit_refuser($$insert into public.reglages_compte (user_id) values ('aaaaaaaa-0000-4000-8000-000000000001')$$, 'permission denied');
select pg_temp.doit_refuser($$update public.reglages_compte set reglages = '{}'$$, 'permission denied');
select pg_temp.doit_refuser($$delete from public.reglages_compte$$, 'permission denied');

-- 4. Liste blanche : clés et valeurs connues gardées, le reste ignoré sans erreur.
select pg_temp.egal(public.enregistrer_reglages(jsonb_build_object(
  'theme', pg_temp.r('"dark"', 1000),
  'size', pg_temp.r('13', 1000),
  'coordonnees', pg_temp.r('false', 1000),
  'langue', pg_temp.r('"en"', 1000),
  'enLigne', pg_temp.r('"lente"', 1000),
  'messagesCoupes', pg_temp.r('true', 1000),
  'themeGoban', pg_temp.r('"ardoise"', 1000),
  -- refusées : clé inconnue, valeur hors liste, mauvais type, date manquante, négative, décimale, trop loin
  'email', pg_temp.r('"alice@exemple.test"', 1000),
  'cadence', pg_temp.r('"eclair"', 1000),
  'sound', pg_temp.r('"oui"', 1000),
  'aide', '{"v":"oui"}'::jsonb,
  'vibrations', pg_temp.r('false', -1),
  'celebrations', '{"v":false,"t":1.5}'::jsonb,
  'dernierCoup', pg_temp.r('false', (extract(epoch from now()) * 1000)::bigint + 2 * 86400000),
  'numerosRevue', '"true"'::jsonb
)) ?& array['theme', 'size', 'coordonnees', 'langue', 'enLigne', 'messagesCoupes', 'themeGoban'], true, 'clés gardées');
select pg_temp.egal((select count(*) from public.reglages_compte r, jsonb_object_keys(r.reglages)), 7::bigint, 'seulement 7 clés');
select pg_temp.egal((select reglages -> 'theme' from public.reglages_compte), '{"v":"dark","t":1000}'::jsonb, 'forme gardée');

-- 5. Dernier changement gagne, clé par clé ; à date égale, la valeur gardée reste.
select pg_temp.egal(public.enregistrer_reglages(jsonb_build_object(
  'theme', pg_temp.r('"light"', 999),       -- plus ancien : ignoré
  'size', pg_temp.r('19', 1000),            -- même date : ignoré
  'coordonnees', pg_temp.r('true', 2000)    -- plus récent : gagne
)) - array['langue', 'enLigne', 'messagesCoupes', 'themeGoban'], jsonb_build_object(
  'theme', pg_temp.r('"dark"', 1000), 'size', pg_temp.r('13', 1000), 'coordonnees', pg_temp.r('true', 2000)), 'fusion');

-- 6. Chacun ne lit que sa ligne.
select pg_temp.connecte(:chloe);
select pg_temp.egal((select count(*) from public.reglages_compte), 0::bigint, 'Chloé ne voit pas Alice');
select pg_temp.egal(public.enregistrer_reglages(jsonb_build_object('sound', pg_temp.r('false', 5))), '{"sound":{"v":false,"t":5}}'::jsonb, 'Chloé sans pseudo');
select pg_temp.egal((select count(*) from public.reglages_compte), 1::bigint, 'Chloé voit la sienne');
select pg_temp.connecte(:bruno, true);
select pg_temp.egal((select count(*) from public.reglages_compte), 0::bigint, 'anonyme : rien');

-- 7. Entrées illisibles : refusées.
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser($$select public.enregistrer_reglages('[]')$$, 'illisibles');
select pg_temp.doit_refuser($$select public.enregistrer_reglages((select jsonb_object_agg('k' || i, 1) from generate_series(1, 33) i))$$, 'Trop de réglages');

-- 8. Une clé gardée qui n'est plus dans la liste blanche reste (rien n'est effacé).
reset role;
update public.reglages_compte set reglages = reglages || '{"ancienne":{"v":1,"t":1}}' where user_id = :alice;
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.enregistrer_reglages(jsonb_build_object('ancienne', pg_temp.r('2', 9))) -> 'ancienne', '{"v":1,"t":1}'::jsonb, 'clé ancienne gardée');

-- 9. Suppression du compte : la ligne part avec lui (cascade).
reset role;
delete from auth.users where id = :alice;
select pg_temp.egal((select count(*) from public.reglages_compte where user_id = :alice), 0::bigint, 'cascade');

rollback;
\o
\echo 'reglages_compte : OK'
