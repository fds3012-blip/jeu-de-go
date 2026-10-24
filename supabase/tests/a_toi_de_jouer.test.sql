-- Tests rejouables de la notification « à toi de jouer » (issue #699). Transaction annulée à la fin.
-- Le jeton est simulé par request.jwt.claims, comme PostgREST. Voir supabase/tests/LISEZMOI.md.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
begin;

create function pg_temp.connecte(p_uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', false)::text, true);
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
-- Nombre de poussées dues à `p_quand`, lues comme la fonction serveur (clé service).
create function pg_temp.dues(p_quand timestamptz) returns bigint
language plpgsql as $$
declare n bigint;
begin
  set local role service_role;
  select count(*) into n from public.reclamer_tours(p_quand);
  reset role;
  return n;
end;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bruno@exemple.test', false),
  ('cccccccc-0000-4000-8000-000000000003', 'chloe@exemple.test', false),
  ('dddddddd-0000-4000-8000-000000000004', 'denis@exemple.test', false);
insert into public.profiles (id, username) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Alice'), ('bbbbbbbb-0000-4000-8000-000000000002', 'Bruno'),
  ('cccccccc-0000-4000-8000-000000000003', 'Chloe'), ('dddddddd-0000-4000-8000-000000000004', 'Denis')
  on conflict (id) do update set username = excluded.username;
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set chloe '''cccccccc-0000-4000-8000-000000000003'''
\set denis '''dddddddd-0000-4000-8000-000000000004'''
\set cle '''BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM'''
\set sec '''tBHItJI5svbpez7KI4CCXg'''

-- 1. Inscriptions. Anciens clients (6 arguments) : rappel du jour allumé, « à toi de jouer » éteint.
set local role authenticated;
select pg_temp.connecte(:alice);
select public.enregistrer_abonnement_rappel('https://fcm.googleapis.com/fcm/send/alice', :cle, :sec, 'soir', 'Europe/Paris', 'fr', false, true) as abo_alice \gset
select pg_temp.connecte(:chloe);
select public.enregistrer_abonnement_rappel('https://fcm.googleapis.com/fcm/send/chloe-a', :cle, :sec, 'soir', 'Europe/Paris', 'fr') as abo_chloe_a \gset
select public.enregistrer_abonnement_rappel('https://fcm.googleapis.com/fcm/send/chloe-b', :cle, :sec, 'matin', 'America/Montreal', 'en', false, true) as abo_chloe_b \gset
select pg_temp.connecte(:bruno);
select public.enregistrer_abonnement_rappel('https://fcm.googleapis.com/fcm/send/bruno', :cle, :sec, 'soir', 'Europe/Paris', 'fr', false, true);
select pg_temp.connecte(:denis);
select public.enregistrer_abonnement_rappel('https://fcm.googleapis.com/fcm/send/denis', :cle, :sec, 'soir', 'Europe/Paris', 'fr', false, true);
reset role;
select pg_temp.egal((select jour from public.abonnements_rappel where id = :'abo_alice'), false, 'Alice : rappel du jour éteint');
select pg_temp.egal((select tour from public.abonnements_rappel where id = :'abo_alice'), true, 'Alice : à toi de jouer allumé');
select pg_temp.egal((select tour_depuis is not null from public.abonnements_rappel where id = :'abo_alice'), true, 'date d''activation posée');
select pg_temp.egal((select jour from public.abonnements_rappel where id = :'abo_chloe_a'), true, 'ancien client : rappel du jour allumé');
select pg_temp.egal((select tour from public.abonnements_rappel where id = :'abo_chloe_a'), false, 'ancien client : à toi de jouer éteint par défaut');
-- Dates d'activation fixées : tout le reste du test tourne sur des instants précis (Paris, heure d'hiver : +01).
update public.abonnements_rappel set tour_depuis = '2026-10-20 00:00+01' where tour and endpoint not like '%denis';
update public.abonnements_rappel set tour_depuis = '2026-10-26 10:00+01' where endpoint like '%denis';

-- Réinscription sans changer l'interrupteur (argument nul) : rien ne bouge, la date d'activation non plus.
set local role authenticated;
select pg_temp.connecte(:alice);
select public.enregistrer_abonnement_rappel('https://fcm.googleapis.com/fcm/send/alice', :cle, :sec, 'midi', 'Europe/Paris', 'fr', null, null);
reset role;
select pg_temp.egal((select tour_depuis from public.abonnements_rappel where id = :'abo_alice'), '2026-10-20 00:00+01'::timestamptz, 'date d''activation gardée');
select pg_temp.egal((select jour from public.abonnements_rappel where id = :'abo_alice'), false, 'argument nul : rappel du jour inchangé');
-- Tout éteindre par la fonction est refusé (on supprime la ligne à la place) ; la table l'interdit aussi.
set local role authenticated;
select pg_temp.doit_refuser('select public.enregistrer_abonnement_rappel(''https://fcm.googleapis.com/fcm/send/alice'', ' || quote_literal(:cle) || ', ' || quote_literal(:sec) || ', ''soir'', ''Europe/Paris'', ''fr'', false, false)', 'Aucun rappel');
reset role;
select pg_temp.doit_refuser('update public.abonnements_rappel set jour = false, tour = false, tour_depuis = null', 'abonnements_rappel_un_choix');
select pg_temp.doit_refuser('update public.abonnements_rappel set tour = true, tour_depuis = null where jour', 'abonnements_rappel_tour_depuis');

-- 2. Le rappel du jour ignore un appareil où il est éteint : Alice (jour éteint, soir) n'est pas due à 18 h 05.
set local role service_role;
select pg_temp.egal((select count(*) from public.reclamer_rappels('2026-10-26 18:05+01') where endpoint like '%alice'), 0::bigint, 'jour éteint : pas de rappel du jour');
select pg_temp.egal((select count(*) from public.reclamer_rappels('2026-10-26 18:05+01') where endpoint like '%chloe-a'), 0::bigint, 'déjà réclamé juste avant (un par jour)');
reset role;

-- 3. Parties. G1 et G2 : parties lentes classées en cours ; G3 : défi d'ami non classé ; G4 : classée mais finie.
insert into public.games (id, black_id, white_id, created_by, size, status, rated) values
  ('11111111-0000-4000-8000-000000000001', :bruno, :alice, :bruno, 9, 'active', true),
  ('11111111-0000-4000-8000-000000000002', :chloe, :alice, :chloe, 9, 'active', true),
  ('11111111-0000-4000-8000-000000000003', :bruno, :alice, :bruno, 9, 'active', false),
  ('11111111-0000-4000-8000-000000000004', :bruno, :alice, :bruno, 9, 'finished', true);
\set g1 '''11111111-0000-4000-8000-000000000001'''
\set g2 '''11111111-0000-4000-8000-000000000002'''
\set g3 '''11111111-0000-4000-8000-000000000003'''
\set g4 '''11111111-0000-4000-8000-000000000004'''
insert into public.notifications (destinataire_id, type, partie_id, creee_le, lue_le) values
  (:alice, 'tour', :g1, '2026-10-26 09:00+01', null),
  (:alice, 'tour', :g3, '2026-10-26 09:00+01', null),   -- défi d'ami : pas poussé
  (:alice, 'tour', :g4, '2026-10-26 09:00+01', null),   -- partie finie : pas poussé
  (:alice, 'fin',  :g4, '2026-10-26 09:00+01', null),   -- type non poussé
  (:alice, 'ami',  null, '2026-10-26 09:00+01', null),  -- type non poussé
  (:alice, 'tour', :g2, '2026-10-26 09:00+01', '2026-10-26 09:30+01'); -- déjà vue dans l'app : pas poussé

-- 4. Une seule poussée par notification ; seuls le tour d'une partie lente en cours et un appareil allumé comptent.
select pg_temp.egal(pg_temp.dues('2026-10-26 10:05+01'), 1::bigint, 'Alice : une poussée (partie lente en cours)');
select pg_temp.egal(pg_temp.dues('2026-10-26 10:05+01'), 0::bigint, 'deuxième passage : rien');
select pg_temp.egal(pg_temp.dues('2026-10-26 12:05+01'), 0::bigint, 'plus tard : rien (déjà poussée)');
select pg_temp.egal((select poussee_le from public.notifications where destinataire_id = :alice and partie_id = :g1), '2026-10-26 10:05+01'::timestamptz, 'date de poussée notée');
select pg_temp.egal((select count(*) from public.notifications where destinataire_id = :alice and poussee_le is not null), 1::bigint, 'les autres ne sont pas marquées');

-- 5. Anti-rafale : une par partie et par heure. Un comptage proposé sur G1 à 10 h 30 attend l'heure pleine suivante.
insert into public.notifications (destinataire_id, type, partie_id, creee_le) values (:alice, 'comptage', :g1, '2026-10-26 10:30+01');
select pg_temp.egal(pg_temp.dues('2026-10-26 10:40+01'), 0::bigint, 'même partie dans l''heure : attend');
select pg_temp.egal(pg_temp.dues('2026-10-26 11:10+01'), 1::bigint, 'plus d''une heure après : part');

-- 6. Jamais la nuit : un tour de 21 h attend 8 h le lendemain (heure de l'appareil).
insert into public.notifications (destinataire_id, type, partie_id, creee_le) values (:alice, 'tour', :g2, '2026-10-26 21:00+01');
select pg_temp.egal(pg_temp.dues(h), 0::bigint, 'nuit : ' || h::text)
  from generate_series('2026-10-26 20:05+01'::timestamptz, '2026-10-27 07:55+01', '1 hour') h;
select pg_temp.egal((select count(*) from public.notifications where partie_id = :g2 and poussee_le is not null), 0::bigint, 'rien de marqué la nuit');
select pg_temp.egal(pg_temp.dues('2026-10-27 08:05+01'), 1::bigint, '8 h 05 : part');

-- 7. Fuseau de l'appareil. Chloé : un appareil à Paris (« à toi de jouer » éteint) et un à Montréal (allumé).
insert into public.notifications (destinataire_id, type, partie_id, creee_le) values (:chloe, 'tour', :g2, '2026-10-28 08:00+01');
-- 10 h 05 à Paris = 5 h 05 à Montréal : nuit là-bas.
select pg_temp.egal(pg_temp.dues('2026-10-28 10:05+01'), 0::bigint, 'jour à Paris, nuit à Montréal : rien');
-- 14 h 05 à Paris = 9 h 05 à Montréal : part, vers l'appareil de Montréal seulement, en anglais.
set local role service_role;
select pg_temp.egal((select string_agg(endpoint || ':' || langue || ':' || type, ',') from public.reclamer_tours('2026-10-28 14:05+01')),
  'https://fcm.googleapis.com/fcm/send/chloe-b:en:tour', 'seul l''appareil allumé est prévenu, dans sa langue');
reset role;

-- 8. Réglage coupé : Chloé éteint « à toi de jouer » sur son appareil de Montréal, plus rien ne part pour elle.
insert into public.notifications (destinataire_id, type, partie_id, creee_le) values (:chloe, 'comptage', :g2, '2026-10-29 09:00+01');
set local role authenticated;
select pg_temp.connecte(:chloe);
select public.enregistrer_abonnement_rappel('https://fcm.googleapis.com/fcm/send/chloe-b', :cle, :sec, 'matin', 'America/Montreal', 'en', true, false);
reset role;
select pg_temp.egal((select tour_depuis from public.abonnements_rappel where id = :'abo_chloe_b'), null::timestamptz, 'date d''activation effacée');
select pg_temp.egal(pg_temp.dues('2026-10-29 15:05+01'), 0::bigint, 'réglage coupé : rien');
-- Le rallumer ne rattrape pas ce qui attendait déjà.
set local role authenticated;
select public.enregistrer_abonnement_rappel('https://fcm.googleapis.com/fcm/send/chloe-b', :cle, :sec, 'matin', 'America/Montreal', 'en', true, true);
reset role;
select pg_temp.egal((select tour_depuis > now() - interval '1 hour' from public.abonnements_rappel where id = :'abo_chloe_b'), true, 'réactivé : nouvelle date');
-- L'horloge du test est fixe : la date d'activation réelle est ramenée au moment du rallumage (29/10, 16 h).
update public.abonnements_rappel set tour_depuis = '2026-10-29 16:00+01' where id = :'abo_chloe_b';
select pg_temp.egal(pg_temp.dues('2026-10-30 15:05+01'), 0::bigint, 'rallumé : l''ancien tour n''est pas rattrapé');

-- 9. Seulement après l'activation (Denis allume à 10 h 00).
insert into public.games (id, black_id, white_id, created_by, size, status, rated) values
  ('11111111-0000-4000-8000-0000000000d1', :denis, :bruno, :denis, 9, 'active', true);
\set gd '''11111111-0000-4000-8000-0000000000d1'''
insert into public.notifications (destinataire_id, type, partie_id, creee_le) values (:denis, 'tour', :gd, '2026-10-26 09:59+01');
select pg_temp.egal(pg_temp.dues('2026-10-26 10:05+01'), 0::bigint, 'tour déjà en attente à l''activation : pas poussé');
update public.notifications set lue_le = now() where destinataire_id = :denis;
insert into public.notifications (destinataire_id, type, partie_id, creee_le) values (:denis, 'tour', :gd, '2026-10-26 10:01+01');
select pg_temp.egal(pg_temp.dues('2026-10-26 10:05+01'), 1::bigint, 'tour arrivé après l''activation : poussé');

-- 10. Trois par 24 heures au plus (Bruno, cinq parties lentes).
insert into public.games (id, black_id, white_id, created_by, size, status, rated)
  select ('22222222-0000-4000-8000-00000000000' || i)::uuid, :bruno, :chloe, :bruno, 9, 'active', true from generate_series(1, 5) i;
insert into public.notifications (destinataire_id, type, partie_id, creee_le)
  select :bruno, 'tour', ('22222222-0000-4000-8000-00000000000' || i)::uuid, '2026-11-02 09:00+01'::timestamptz + i * interval '1 minute' from generate_series(1, 5) i;
select pg_temp.egal(pg_temp.dues('2026-11-02 10:05+01'), 3::bigint, 'trois poussées au plus');
select pg_temp.egal((select count(*) from public.notifications where destinataire_id = :bruno and poussee_le is not null), 3::bigint, 'trois marquées');
select pg_temp.egal(pg_temp.dues('2026-11-02 12:05+01'), 0::bigint, 'plafond du jour atteint : les autres attendent');
select pg_temp.egal(pg_temp.dues('2026-11-03 11:05+01'), 2::bigint, '24 heures après : le reste part');
-- Les plus anciennes d'abord.
select pg_temp.egal((select string_agg(right(partie_id::text, 1), '' order by creee_le) from public.notifications
  where destinataire_id = :bruno and poussee_le = '2026-11-02 10:05+01'), '123', 'les plus anciennes d''abord');

-- 11. Un tour de plus de trois jours n'est plus poussé.
insert into public.notifications (destinataire_id, type, partie_id, creee_le) values (:alice, 'comptage', :g2, '2026-11-10 09:00+01');
select pg_temp.egal(pg_temp.dues('2026-11-13 09:05+01'), 0::bigint, 'plus de 3 jours : abandonné');

-- 12. Droits : la fonction est réservée au serveur ; le joueur ne touche ni la date de poussée ni ses interrupteurs en direct.
select pg_temp.egal(has_function_privilege('authenticated', 'public.reclamer_tours(timestamptz)', 'execute'), false, 'reclamer_tours : pas pour un joueur');
select pg_temp.egal(has_function_privilege('anon', 'public.reclamer_tours(timestamptz)', 'execute'), false, 'reclamer_tours : pas pour un visiteur');
select pg_temp.egal(has_function_privilege('service_role', 'public.reclamer_tours(timestamptz)', 'execute'), true, 'reclamer_tours : serveur');
select pg_temp.egal(has_function_privilege('anon', 'public.enregistrer_abonnement_rappel(text, text, text, text, text, text, boolean, boolean)', 'execute'), false, 'inscription : pas pour un visiteur');
select pg_temp.egal((select proconfig[1] from pg_proc where proname = 'reclamer_tours'), 'search_path=""', 'search_path vide');
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser('select * from public.reclamer_tours()', 'permission denied');
select pg_temp.doit_refuser('update public.notifications set poussee_le = null', 'permission denied');
select pg_temp.doit_refuser('update public.abonnements_rappel set tour = true', 'permission denied');
select pg_temp.doit_refuser('update public.abonnements_rappel set tour_depuis = now()', 'permission denied');
-- Chacun ne voit que ses appareils.
select pg_temp.egal((select count(*) from public.abonnements_rappel), 1::bigint, 'Alice ne voit que son appareil');
reset role;
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.abonnements_rappel'::regclass), true, 'RLS active (abonnements)');
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.notifications'::regclass), true, 'RLS active (notifications)');

\echo 'a_toi_de_jouer : tous les cas passent.'
rollback;
