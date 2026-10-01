-- Tests rejouables du rappel quotidien (issue #36). Transaction annulée à la fin : aucune donnée ne reste.
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

-- Alice et Chloé ont un compte avec pseudo ; Bruno est anonyme (ancien défi par lien) ; Denis a un compte sans pseudo.
insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', null, true),
  ('cccccccc-0000-4000-8000-000000000003', 'chloe@exemple.test', false),
  ('dddddddd-0000-4000-8000-000000000004', 'denis@exemple.test', false);
insert into public.profiles (id) values
  ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002'), ('cccccccc-0000-4000-8000-000000000003'),
  ('dddddddd-0000-4000-8000-000000000004')
  on conflict do nothing;
update public.profiles set username = 'Alice' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
update public.profiles set username = 'Chloe' where id = 'cccccccc-0000-4000-8000-000000000003';
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set chloe '''cccccccc-0000-4000-8000-000000000003'''
\set denis '''dddddddd-0000-4000-8000-000000000004'''
\set cle '''BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM'''
\set sec '''tBHItJI5svbpez7KI4CCXg'''

-- 1. Visiteur sans connexion : aucun droit.
set local role anon;
select pg_temp.doit_refuser('select * from public.abonnements_rappel', 'permission denied');
select pg_temp.doit_refuser(format('select public.enregistrer_abonnement_rappel(''https://push.exemple.test/1'', %L, %L, ''soir'', ''Europe/Paris'', ''fr'')', :cle, :sec), 'permission denied');
reset role;

set local role authenticated;
-- 2. Anonyme (défi par lien) : refusé, par la fonction comme par la table.
select pg_temp.connecte(:bruno, true);
select pg_temp.doit_refuser(format('select public.enregistrer_abonnement_rappel(''https://push.exemple.test/b'', %L, %L, ''soir'', ''Europe/Paris'', ''fr'')', :cle, :sec), 'Crée ton compte');
select pg_temp.doit_refuser(format('insert into public.abonnements_rappel (user_id, endpoint, p256dh, auth) values (%L, ''https://push.exemple.test/b'', %L, %L)', :bruno, :cle, :sec), 'permission denied');
-- Compte sans pseudo : refusé (#343).
select pg_temp.connecte(:denis);
select pg_temp.doit_refuser(format('select public.enregistrer_abonnement_rappel(''https://push.exemple.test/d'', %L, %L, ''soir'', ''Europe/Paris'', ''fr'')', :cle, :sec), 'Choisis ton pseudo');
-- Jeton sans utilisateur : refusé.
select pg_temp.deconnecte();
select pg_temp.doit_refuser(format('select public.enregistrer_abonnement_rappel(''https://push.exemple.test/x'', %L, %L, ''soir'', ''Europe/Paris'', ''fr'')', :cle, :sec), 'Crée ton compte');

-- 3. Alice s'abonne (téléphone, le soir) ; Chloé aussi (le matin, à Montréal).
select pg_temp.connecte(:alice);
select public.enregistrer_abonnement_rappel('https://push.exemple.test/alice', :cle, :sec, 'soir', 'Europe/Paris', 'fr') as abo_alice \gset
select pg_temp.connecte(:chloe);
select public.enregistrer_abonnement_rappel('https://push.exemple.test/chloe', :cle, :sec, 'matin', 'America/Montreal', 'en') as abo_chloe \gset
-- Fuseau inconnu : Paris.
select public.enregistrer_abonnement_rappel('https://push.exemple.test/chloe-2', :cle, :sec, 'midi', 'Mars/Olympus', 'fr') as abo_chloe2 \gset
reset role;
select pg_temp.egal((select fuseau from public.abonnements_rappel where id = :'abo_chloe2'), 'Europe/Paris', 'fuseau inconnu : Paris');
select pg_temp.egal((select user_id from public.abonnements_rappel where id = :'abo_alice'), :alice::uuid, 'abonnement lié au compte');
-- Valeurs hors liste refusées.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser(format('select public.enregistrer_abonnement_rappel(''https://push.exemple.test/alice'', %L, %L, ''nuit'', ''Europe/Paris'', ''fr'')', :cle, :sec), 'check constraint');
select pg_temp.doit_refuser(format('select public.enregistrer_abonnement_rappel(''http://push.exemple.test/alice'', %L, %L, ''soir'', ''Europe/Paris'', ''fr'')', :cle, :sec), 'check constraint');

-- 4. Chacun ne voit, ne modifie et ne supprime que les siens.
select pg_temp.egal((select count(*) from public.abonnements_rappel), 1::bigint, 'Alice ne lit que son abonnement');
select pg_temp.egal(pg_temp.lignes(format('update public.abonnements_rappel set moment = ''matin'' where id = %L', :'abo_chloe')), 0::bigint, 'Alice ne modifie pas celui de Chloé');
select pg_temp.egal(pg_temp.lignes(format('delete from public.abonnements_rappel where id = %L', :'abo_chloe')), 0::bigint, 'Alice ne supprime pas celui de Chloé');
select pg_temp.egal(pg_temp.lignes(format('update public.abonnements_rappel set moment = ''midi'' where id = %L', :'abo_alice')), 1::bigint, 'Alice change son moment');
select pg_temp.doit_refuser(format('update public.abonnements_rappel set dernier_envoi = ''2000-01-01'' where id = %L', :'abo_alice'), 'permission denied');
select pg_temp.doit_refuser(format('update public.abonnements_rappel set user_id = %L where id = %L', :chloe, :'abo_alice'), 'permission denied');
select pg_temp.doit_refuser(format('insert into public.abonnements_rappel (user_id, endpoint, p256dh, auth) values (%L, ''https://push.exemple.test/z'', %L, %L)', :alice, :cle, :sec), 'permission denied');
select pg_temp.doit_refuser('select * from public.reclamer_rappels()', 'permission denied');
select pg_temp.connecte(:alice);
select public.enregistrer_abonnement_rappel('https://push.exemple.test/alice', :cle, :sec, 'soir', 'Europe/Paris', 'fr');
select pg_temp.egal((select count(*) from public.abonnements_rappel), 1::bigint, 'réinscription : même ligne, pas de doublon');
reset role;

-- 5. Envois : le soir à Paris (18 h 05 le 1er octobre), seule Alice est due ; une seule fois par jour.
set local role service_role;
select pg_temp.egal((select count(*) from public.reclamer_rappels('2026-10-01 18:05+02')), 1::bigint, '18 h 05 à Paris : Alice');
select pg_temp.egal((select count(*) from public.reclamer_rappels('2026-10-01 18:05+02')), 0::bigint, 'deuxième passage : rien (un par jour)');
select pg_temp.egal((select count(*) from public.reclamer_rappels('2026-10-01 19:05+02')), 0::bigint, 'heure suivante : rien');
select pg_temp.egal((select dernier_envoi from public.abonnements_rappel where id = :'abo_alice'), '2026-10-01'::date, 'jour noté');
-- Le lendemain, tâche de 18 h manquée : rattrapée à 19 h ; pas à 20 h.
select pg_temp.egal((select count(*) from public.reclamer_rappels('2026-10-02 20:05+02')), 0::bigint, '20 h 05 : trop tard');
select pg_temp.egal((select count(*) from public.reclamer_rappels('2026-10-02 19:05+02')), 1::bigint, '19 h 05 : rattrapage');
-- Jamais la nuit, quel que soit le jour.
select pg_temp.egal((select count(*) from public.reclamer_rappels(h)) , 0::bigint, 'nuit : ' || h::text)
  from generate_series('2026-10-05 20:05+02'::timestamptz, '2026-10-06 08:05+02'::timestamptz, '1 hour') h;
-- Chloé (Montréal, matin 9 h) : 15 h à Paris.
select pg_temp.egal((select string_agg(langue, ',') from public.reclamer_rappels('2026-10-03 15:05+02')), 'en', '9 h 05 à Montréal : Chloé, en anglais');
-- Chloé (Paris, midi) : déjà un problème réussi aujourd'hui, pas de rappel.
reset role;
update public.profiles set streak_last = '2026-10-03' where id = :chloe;
set local role service_role;
select pg_temp.egal((select count(*) from public.reclamer_rappels('2026-10-03 12:05+02')), 0::bigint, 'déjà joué aujourd''hui : pas de rappel');
reset role;
update public.profiles set streak_last = '2026-10-02' where id = :chloe;
set local role service_role;
select pg_temp.egal((select count(*) from public.reclamer_rappels('2026-10-04 12:05+02')), 1::bigint, 'pas encore joué : rappel de midi');
reset role;

-- 6. Un appareil qui change de compte change de propriétaire et repart de zéro.
set local role authenticated;
select pg_temp.connecte(:chloe);
select public.enregistrer_abonnement_rappel('https://push.exemple.test/alice', :cle, :sec, 'matin', 'Europe/Paris', 'fr');
reset role;
select pg_temp.egal((select user_id from public.abonnements_rappel where endpoint = 'https://push.exemple.test/alice'), :chloe::uuid, 'appareil repris par Chloé');
select pg_temp.egal((select dernier_envoi from public.abonnements_rappel where endpoint = 'https://push.exemple.test/alice'), null::date, 'dernier envoi effacé');

-- 7. 20 appareils au plus par compte.
set local role authenticated;
select pg_temp.connecte(:alice);
select count(*) from (select public.enregistrer_abonnement_rappel('https://push.exemple.test/a' || i, :cle, :sec, 'soir', 'Europe/Paris', 'fr')
  from generate_series(1, 25) i) s;
select pg_temp.egal((select count(*) from public.abonnements_rappel), 20::bigint, '20 appareils au plus');
reset role;

-- 8. Suppression du compte : ses abonnements partent avec lui.
delete from auth.users where id = :chloe;
select pg_temp.egal((select count(*) from public.abonnements_rappel where user_id = :chloe), 0::bigint, 'suppression en cascade');

-- 9. Structure : RLS active, pas de droit pour anon.
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.abonnements_rappel'::regclass), true, 'RLS active');
select pg_temp.egal(has_table_privilege('anon', 'public.abonnements_rappel', 'select'), false, 'anon : aucune lecture');
select pg_temp.egal(has_function_privilege('authenticated', 'public.reclamer_rappels(timestamptz)', 'execute'), false, 'reclamer_rappels réservée au serveur');

\echo 'abonnements_rappel : tous les cas passent.'
rollback;
