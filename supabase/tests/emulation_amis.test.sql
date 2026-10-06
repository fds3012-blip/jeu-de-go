-- Tests rejouables de l'émulation entre amis (issue #369, migration 20261005230100_emulation_amis.sql). Tout se passe
-- dans une transaction annulée à la fin : aucune donnée ne reste. Voir supabase/tests/LISEZMOI.md.
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
create function pg_temp.deconnecte() returns void
language sql as $$ select set_config('request.jwt.claims', '{}', true); $$;
create function pg_temp.doit_refuser(p_sql text, p_motif text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'REFUS ATTENDU, mais accepté : %', p_sql;
exception when others then
  if sqlerrm like 'REFUS ATTENDU%' then raise; end if;
  if sqlerrm not ilike '%' || p_motif || '%' and sqlstate <> p_motif then
    raise exception 'Mauvais refus pour « % » : « % » [%] (attendu : « % »)', p_sql, sqlerrm, sqlstate, p_motif;
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
-- Classement lu en une ligne : « pseudo:etat:essais:moi:rappele », dans l'ordre du serveur.
create function pg_temp.classement() returns text
language sql as $$
  select coalesce(string_agg(pseudo || ':' || etat || ':' || coalesce(essais::text, '-') || ':' || moi || ':' || rappele, ','), '')
  from public.classement_go_du_jour()
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Comptes : Alice, Bruno, Eve, Hugo (pseudo) ; Chloé (sans pseudo) ; Denis (anonyme). Alice et Bruno sont amis,
-- Alice et Gael aussi ; Eve n'est l'amie de personne ; Bruno a une demande en attente de Hugo (pas encore ami).
insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bruno@exemple.test', false),
  ('cccccccc-0000-4000-8000-000000000003', 'chloe@exemple.test', false),
  ('dddddddd-0000-4000-8000-000000000004', null, true),
  ('eeeeeeee-0000-4000-8000-000000000005', 'eve@exemple.test', false),
  ('99999999-0000-4000-8000-000000000007', 'gael@exemple.test', false),
  ('88888888-0000-4000-8000-000000000008', 'hugo@exemple.test', false);
insert into public.profiles (id, username) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Alice'), ('bbbbbbbb-0000-4000-8000-000000000002', 'Bruno'),
  ('cccccccc-0000-4000-8000-000000000003', null), ('dddddddd-0000-4000-8000-000000000004', null),
  ('eeeeeeee-0000-4000-8000-000000000005', 'Eve'), ('99999999-0000-4000-8000-000000000007', 'Gael'),
  ('88888888-0000-4000-8000-000000000008', 'Hugo')
  on conflict (id) do update set username = excluded.username;
-- 21 amis de Hugo, pour la limite de 20 rappels par jour.
insert into auth.users (id, email) select ('70000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'j' || i || '@exemple.test'
  from generate_series(1, 21) i;
insert into public.profiles (id, username) select ('70000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'Joueur' || i
  from generate_series(1, 21) i
  on conflict (id) do update set username = excluded.username;
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set chloe '''cccccccc-0000-4000-8000-000000000003'''
\set denis '''dddddddd-0000-4000-8000-000000000004'''
\set eve '''eeeeeeee-0000-4000-8000-000000000005'''
\set gael '''99999999-0000-4000-8000-000000000007'''
\set hugo '''88888888-0000-4000-8000-000000000008'''
insert into public.friendships (requester_id, addressee_id, status) values
  (:alice, :bruno, 'accepted'), (:gael, :alice, 'accepted'), (:hugo, :bruno, 'pending');
insert into public.friendships (requester_id, addressee_id, status)
  select :hugo, ('70000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'accepted' from generate_series(1, 21) i;
select ((now() at time zone 'Europe/Paris')::date - date '2026-09-27') + 1 as aujourdhui \gset

set local role authenticated;

-- 1. Compte avec pseudo exigé (JGC01, JGP01 de #343) pour chaque fonction ; anon n'a aucun droit.
select pg_temp.deconnecte();
select pg_temp.doit_refuser(format('select public.noter_go_du_jour(%s, ''reussi'')', :aujourdhui), 'JGC01');
select pg_temp.doit_refuser('select * from public.classement_go_du_jour()', 'JGC01');
select pg_temp.doit_refuser('select public.rappeler_go_du_jour(''Bruno'')', 'JGC01');
select pg_temp.doit_refuser('select public.bilan_semaine()', 'JGC01');
select pg_temp.doit_refuser('select public.mes_records()', 'JGC01');
select pg_temp.connecte(:denis, true);
select pg_temp.doit_refuser(format('select public.noter_go_du_jour(%s, ''reussi'')', :aujourdhui), 'JGC01');
select pg_temp.doit_refuser('select * from public.classement_go_du_jour()', 'JGC01');
select pg_temp.connecte(:chloe);
select pg_temp.doit_refuser(format('select public.noter_go_du_jour(%s, ''reussi'')', :aujourdhui), 'JGP01');
select pg_temp.doit_refuser('select public.bilan_semaine(true)', 'JGP01');
select pg_temp.doit_refuser('select public.mes_records()', 'JGP01');
reset role;
set local role anon;
select pg_temp.doit_refuser('select * from public.classement_go_du_jour()', 'permission denied');
select pg_temp.doit_refuser('select count(*) from public.go_du_jour_resultats', 'permission denied');
reset role;
set local role authenticated;

-- 2. Noter le Go du jour : seulement celui d'aujourd'hui (heure de Paris), résultat connu ; essais comptés par le
--    serveur ; une fois réussi, plus rien ne change. Aucune écriture directe.
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser(format('select public.noter_go_du_jour(%s, ''reussi'')', :aujourdhui - 1), 'JGJ01');
select pg_temp.doit_refuser(format('select public.noter_go_du_jour(%s, ''reussi'')', :aujourdhui + 1), 'JGJ01');
select pg_temp.doit_refuser('select public.noter_go_du_jour(null, ''reussi'')', 'JGJ01');
select pg_temp.doit_refuser(format('select public.noter_go_du_jour(%s, ''triche'')', :aujourdhui), 'JGJ04');
select pg_temp.doit_refuser(format('select public.noter_go_du_jour(%s, null)', :aujourdhui), 'JGJ04');
select pg_temp.egal(public.noter_go_du_jour(:aujourdhui, 'rate'), 'en_cours', 'Alice : un essai faux');
select pg_temp.egal(public.noter_go_du_jour(:aujourdhui, 'rate'), 'en_cours', 'Alice : deux essais faux');
select pg_temp.egal(public.noter_go_du_jour(:aujourdhui, 'reussi'), 'reussi', 'Alice réussit au 3e essai');
select pg_temp.egal(public.noter_go_du_jour(:aujourdhui, 'rate'), 'reussi', 'après la réussite, un essai ne change rien');
select pg_temp.egal(public.noter_go_du_jour(:aujourdhui, 'vu'), 'reussi', 'après la réussite, « vu » ne change rien');
select pg_temp.egal((select essais from public.go_du_jour_resultats where numero = :aujourdhui), 3::smallint, 'Alice : 3 essais');
select pg_temp.doit_refuser(format('insert into public.go_du_jour_resultats (user_id, numero, etat, essais) values (%L, 1, ''reussi'', 1)', :alice), 'permission denied');
select pg_temp.doit_refuser('update public.go_du_jour_resultats set essais = 1', 'permission denied');
select pg_temp.doit_refuser('delete from public.go_du_jour_resultats', 'permission denied');
select pg_temp.doit_refuser('select count(*) from public.rappels_go_du_jour', 'permission denied');
select pg_temp.doit_refuser('select public.numero_go_du_jour()', 'permission denied');
-- Eve (pas une amie) réussit du premier coup ; Gael voit la réponse.
select pg_temp.connecte(:eve);
select pg_temp.egal(public.noter_go_du_jour(:aujourdhui, 'reussi'), 'reussi', 'Eve réussit');
select pg_temp.egal((select count(*) from public.go_du_jour_resultats), 1::bigint, 'Eve ne lit que sa ligne (RLS)');
select pg_temp.connecte(:gael);
select pg_temp.egal(public.noter_go_du_jour(:aujourdhui, 'rate'), 'en_cours', 'Gael : un essai faux');
select pg_temp.egal(public.noter_go_du_jour(:aujourdhui, 'vu'), 'vu', 'Gael : réponse vue');

-- 3. Classement : le joueur et ses amis acceptés seulement (ni Eve, ni Hugo dont la demande attend) ; essais d'une
--    réussite seulement ; ni cote ni identifiant dans le résultat.
select pg_temp.connecte(:alice);
select pg_temp.egal(pg_temp.classement(), 'Alice:reussi:3:true:false,Gael:vu:-:false:false,Bruno:pas_encore:-:false:false',
  'Alice : elle, Gael (vu), Bruno (pas encore)');
select pg_temp.connecte(:bruno);
select pg_temp.egal(pg_temp.classement(), 'Alice:reussi:3:false:false,Bruno:pas_encore:-:true:false', 'Bruno : Alice, et lui ; jamais Hugo');
select pg_temp.connecte(:eve);
select pg_temp.egal(pg_temp.classement(), 'Eve:reussi:1:true:false', 'Eve, sans ami : elle seule');
select pg_temp.egal(pg_get_function_result('public.classement_go_du_jour()'::regprocedure),
  'TABLE(pseudo text, etat text, essais integer, moi boolean, rappele boolean)', 'classement : ni identifiant, ni cote');
-- Un ami retiré disparaît aussitôt.
reset role;
update public.friendships set status = 'pending' where requester_id = :gael and addressee_id = :alice;
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(pg_temp.classement(), 'Alice:reussi:3:true:false,Bruno:pas_encore:-:false:false', 'Gael, plus ami accepté, n''apparaît plus');
reset role;
update public.friendships set status = 'accepted' where requester_id = :gael and addressee_id = :alice;
set local role authenticated;

-- 4. « Rappelle-lui » : un ami accepté qui n'a pas fait le Go du jour ; une fois par jour et par ami.
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser('select public.rappeler_go_du_jour(''Eve'')', 'JGA08');
select pg_temp.doit_refuser('select public.rappeler_go_du_jour(''Hugo'')', 'JGA08');
select pg_temp.doit_refuser('select public.rappeler_go_du_jour(''alice'')', 'JGA02');
select pg_temp.doit_refuser('select public.rappeler_go_du_jour(''Personne'')', 'JGA01');
select pg_temp.doit_refuser('select public.rappeler_go_du_jour(''Gael'')', 'JGJ02');
select pg_temp.egal(public.rappeler_go_du_jour('bruno'), 'envoye', 'Alice rappelle Bruno');
select pg_temp.egal(public.rappeler_go_du_jour('Bruno'), 'deja', 'second rappel du jour : rien de plus');
select pg_temp.egal(pg_temp.classement(), 'Alice:reussi:3:true:false,Gael:vu:-:false:false,Bruno:pas_encore:-:false:true',
  'Alice voit qu''elle a rappelé Bruno');
select pg_temp.connecte(:bruno);
select pg_temp.egal((select count(*) from public.notifications where type = 'go_du_jour' and lue_le is null), 1::bigint,
  'Bruno a une notification « Go du jour » en attente');
select pg_temp.egal((select partie_id from public.notifications where type = 'go_du_jour'), null::uuid, 'sans partie');
select pg_temp.connecte(:alice);
select pg_temp.egal((select count(*) from public.notifications where type = 'go_du_jour'), 0::bigint, 'Alice ne lit pas la notification de Bruno');
-- Gael n'est pas l'ami de Bruno : pas de rappel.
select pg_temp.connecte(:gael);
select pg_temp.doit_refuser('select public.rappeler_go_du_jour(''Bruno'')', 'JGA08');
select pg_temp.connecte(:bruno);
select pg_temp.egal(public.noter_go_du_jour(:aujourdhui, 'rate'), 'en_cours', 'Bruno : un essai faux');
select pg_temp.egal((select count(*) from public.notifications where type = 'go_du_jour' and lue_le is null), 1::bigint,
  'un essai faux ne lit pas le rappel');
select pg_temp.egal(public.noter_go_du_jour(:aujourdhui, 'reussi'), 'reussi', 'Bruno réussit au 2e essai');
select pg_temp.egal((select count(*) from public.notifications where type = 'go_du_jour' and lue_le is null), 0::bigint,
  'sa réussite rend le rappel lu');
select pg_temp.egal(pg_temp.classement(), 'Bruno:reussi:2:true:false,Alice:reussi:3:false:false', 'moins d''essais d''abord');
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser('select public.rappeler_go_du_jour(''Bruno'')', 'JGJ02');
-- `marquer_notifications_lues` connaît le nouveau type ; une notification « Go du jour » n'a jamais de partie.
select pg_temp.egal(public.marquer_notifications_lues(null, 'go_du_jour'), 0, 'type go_du_jour accepté');
reset role;
select pg_temp.doit_refuser(format('insert into public.notifications (destinataire_id, type, partie_id) values (%L, ''go_du_jour'', gen_random_uuid())', :bruno), 'check');
set local role authenticated;
-- 20 rappels par jour au plus.
select pg_temp.connecte(:hugo);
select count(*) from (select public.rappeler_go_du_jour('Joueur' || i) from generate_series(1, 20) i) s;
select pg_temp.doit_refuser('select public.rappeler_go_du_jour(''Joueur21'')', 'JGJ03');
select pg_temp.egal(public.rappeler_go_du_jour('Joueur1'), 'deja', 'déjà rappelé : pas un refus');
-- Journal gardé 30 jours.
reset role;
update public.rappels_go_du_jour set envoye_le = now() - interval '31 days', numero = numero - 31
  where expediteur_id = :hugo and destinataire_id = '70000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.connecte(:hugo);
select pg_temp.egal(public.rappeler_go_du_jour('Joueur21'), 'envoye', 'le rappel d''un autre jour ne compte pas dans la limite');
reset role;
select pg_temp.egal((select count(*) from public.rappels_go_du_jour where envoye_le < now() - interval '30 days'), 0::bigint, 'rappels de plus de 30 jours effacés');
set local role authenticated;

-- 4 bis. Blocages (#363) : un ami bloqué disparaît du classement et ne peut plus être rappelé, dans les deux sens,
--        même si un lien d'amitié réapparaissait (posé ici sans déclencheurs).
select pg_temp.connecte(:gael);
select pg_temp.egal(public.bloquer_joueur('Alice'), true, 'Gael bloque Alice');
select pg_temp.egal(pg_temp.classement(), 'Gael:vu:-:true:false', 'Gael ne voit plus Alice');
select pg_temp.doit_refuser('select public.rappeler_go_du_jour(''Alice'')', 'JGA08');
select pg_temp.connecte(:alice);
select pg_temp.egal(pg_temp.classement(), 'Bruno:reussi:2:false:true,Alice:reussi:3:true:false', 'Alice ne voit plus Gael (bloquée par lui)');
select pg_temp.doit_refuser('select public.rappeler_go_du_jour(''Gael'')', 'JGA08');
reset role;
set local session_replication_role = replica;
insert into public.friendships (requester_id, addressee_id, status) values (:gael, :alice, 'accepted');
set local session_replication_role = origin;
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(pg_temp.classement(), 'Bruno:reussi:2:false:true,Alice:reussi:3:true:false', 'lien réapparu : toujours caché');
select pg_temp.doit_refuser('select public.rappeler_go_du_jour(''Gael'')', 'JGA08');
reset role;
delete from public.friendships where requester_id = :gael and addressee_id = :alice;
set local role authenticated;

-- 5. Bilan de la semaine. Parties de cette semaine (heure de Paris) : Alice bat Bruno 2 fois, perd 1 fois contre lui,
--    bat Eve (pas une amie) 1 fois ; une partie contre l'IA, une partie annulée et une partie en cours ne comptent pas ;
--    une partie de la semaine dernière ne compte que dans le bilan précédent.
reset role;
insert into public.games (id, black_id, white_id, created_by, size, status, result, rated, updated_at) values
  ('11111111-0000-4000-8000-000000000001', :alice, :bruno, :alice, 9, 'finished', 'B+R', true, now()),
  ('11111111-0000-4000-8000-000000000002', :bruno, :alice, :alice, 9, 'finished', 'W+5.5', true, now()),
  ('11111111-0000-4000-8000-000000000003', :alice, :bruno, :alice, 9, 'finished', 'W+T', true, now()),
  ('11111111-0000-4000-8000-000000000004', :eve, :alice, :alice, 9, 'finished', 'W+R', false, now()),
  ('11111111-0000-4000-8000-000000000005', :alice, :bruno, :alice, 9, 'aborted', null, true, now()),
  ('11111111-0000-4000-8000-000000000006', :alice, :bruno, :alice, 9, 'active', null, true, now()),
  ('11111111-0000-4000-8000-000000000007', :alice, :bruno, :alice, 9, 'finished', 'B+R', true, now() - interval '7 days');
insert into public.games (black_id, created_by, size, status, result, bot_id, updated_at)
  values (:alice, :alice, 9, 'finished', 'B+R', 'caillou', now());
-- `games_guard_insert` remet le résultat à zéro à la création, `games_touch_updated_at` date chaque mise à jour :
-- résultats et dates posés sans déclencheurs (rôle de réplication, annulé avec la transaction).
set local session_replication_role = replica;
update public.games g set result = v.resultat, updated_at = v.le
  from (values ('11111111-0000-4000-8000-000000000001'::uuid, 'B+R', now()), ('11111111-0000-4000-8000-000000000002'::uuid, 'W+5.5', now()),
               ('11111111-0000-4000-8000-000000000003'::uuid, 'W+T', now()), ('11111111-0000-4000-8000-000000000004'::uuid, 'W+R', now()),
               ('11111111-0000-4000-8000-000000000007'::uuid, 'B+R', now() - interval '7 days')) v(id, resultat, le)
  where g.id = v.id;
set local session_replication_role = origin;
insert into public.rating_history (user_id, kind, rating, game_id, rd, ecart, created_at) values
  (:alice, 'game', 950, '11111111-0000-4000-8000-000000000007', 290, 150, now() - interval '7 days'),
  (:alice, 'game', 1000, '11111111-0000-4000-8000-000000000001', 270, 50, now() - interval '3 minutes'),
  (:alice, 'game', 1030, '11111111-0000-4000-8000-000000000002', 260, 30, now() - interval '2 minutes'),
  (:alice, 'game', 1010, '11111111-0000-4000-8000-000000000003', 250, -20, now() - interval '1 minute');
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.bilan_semaine() - 'semaine', jsonb_build_object('parties', 4, 'victoires', 3, 'parties_classees', 3,
  'cote_ecart', 60, 'go_du_jour', 1, 'amis', jsonb_build_array(jsonb_build_object('pseudo', 'Bruno', 'victoires', 2, 'defaites', 1))),
  'bilan d''Alice : 4 parties, 3 victoires, +60, Bruno nommé, Eve jamais');
select pg_temp.egal(public.bilan_semaine() ->> 'semaine',
  to_char(date_trunc('week', now() at time zone 'Europe/Paris'), 'YYYY-MM-DD'), 'la semaine commence le lundi (Paris)');
select pg_temp.egal(public.bilan_semaine(true) - 'semaine', jsonb_build_object('parties', 1, 'victoires', 1, 'parties_classees', 1,
  'cote_ecart', 150, 'go_du_jour', 0, 'amis', jsonb_build_array(jsonb_build_object('pseudo', 'Bruno', 'victoires', 1, 'defaites', 0))),
  'semaine précédente');
select pg_temp.connecte(:bruno);
select pg_temp.egal(public.bilan_semaine() -> 'amis', jsonb_build_array(jsonb_build_object('pseudo', 'Alice', 'victoires', 1, 'defaites', 2)),
  'Bruno : battu 2 fois par Alice, une victoire');
select pg_temp.connecte(:eve);
select pg_temp.egal(public.bilan_semaine() - 'semaine', jsonb_build_object('parties', 1, 'victoires', 0, 'parties_classees', 0,
  'cote_ecart', 0, 'go_du_jour', 1, 'amis', '[]'::jsonb), 'Eve : une partie, Alice jamais nommée (pas une amie)');

-- 5 bis. Blocage : l'ami bloqué n'est plus nommé dans le bilan, même si un lien d'amitié réapparaissait.
select pg_temp.connecte(:bruno);
select public.bloquer_joueur('Alice');
reset role;
set local session_replication_role = replica;
insert into public.friendships (requester_id, addressee_id, status) values (:alice, :bruno, 'accepted');
set local session_replication_role = origin;
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.bilan_semaine() -> 'amis', '[]'::jsonb, 'Bruno bloque Alice : plus nommé dans son bilan');
select pg_temp.egal((public.bilan_semaine() ->> 'parties')::int, 4, 'les parties restent comptées');

-- 6. Records : meilleure cote et plus longue série de victoires classées. Alice : V (950), V (1000), V (1030), D (1010)
--    → record 3 victoires de suite, série en cours 0, meilleure cote 1030 aujourd'hui.
select pg_temp.connecte(:alice);
select pg_temp.egal(public.mes_records() - 'meilleure_cote_le', jsonb_build_object('parties', 4, 'meilleure_cote', 1030,
  'serie_victoires', 3, 'serie_en_cours', 0), 'records d''Alice');
select pg_temp.egal(public.mes_records() ->> 'meilleure_cote_le', to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD'), 'date du record');
select pg_temp.connecte(:gael);
select pg_temp.egal(public.mes_records(), jsonb_build_object('parties', 0, 'meilleure_cote', null, 'meilleure_cote_le', null,
  'serie_victoires', 0, 'serie_en_cours', 0), 'aucune partie classée : rien');
select pg_temp.egal((select count(*) from public.rating_history), 0::bigint, 'Gael ne lit pas l''historique des autres');

-- 7. Suppression du compte : résultats et rappels partent avec lui (cascade).
select pg_temp.connecte(:alice);
select public.delete_my_account();
reset role;
select pg_temp.egal((select count(*) from public.go_du_jour_resultats where user_id = :alice), 0::bigint, 'compte supprimé : résultats effacés');
select pg_temp.egal((select count(*) from public.rappels_go_du_jour where :alice in (expediteur_id, destinataire_id)), 0::bigint, 'compte supprimé : rappels effacés');
delete from public.profiles where id = :hugo;
select pg_temp.egal((select count(*) from public.rappels_go_du_jour where :hugo in (expediteur_id, destinataire_id)), 0::bigint, 'profil effacé : rappels effacés');

-- 8. Structure : RLS partout, journal sans politique ni droit, fonctions bien ouvertes, search_path vide.
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.go_du_jour_resultats'::regclass), true, 'RLS sur les résultats');
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.rappels_go_du_jour'::regclass), true, 'RLS sur les rappels');
select pg_temp.egal((select count(*) from pg_policies where tablename = 'rappels_go_du_jour'), 0::bigint, 'rappels : aucune politique');
select pg_temp.egal((select string_agg(cmd, ',') from pg_policies where tablename = 'go_du_jour_resultats'), 'SELECT', 'résultats : lecture seule');
select pg_temp.egal(has_table_privilege('authenticated', 'public.rappels_go_du_jour', 'select,insert,update,delete')
  or has_table_privilege('anon', 'public.rappels_go_du_jour', 'select,insert,update,delete'), false, 'rappels : aucun droit');
select pg_temp.egal(has_table_privilege('authenticated', 'public.go_du_jour_resultats', 'insert,update,delete')
  or has_table_privilege('anon', 'public.go_du_jour_resultats', 'select'), false, 'résultats : ni écriture, ni anon');
select pg_temp.egal((select string_agg(p.proname, ',' order by p.proname) from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('noter_go_du_jour', 'classement_go_du_jour', 'rappeler_go_du_jour', 'bilan_semaine', 'mes_records', 'numero_go_du_jour')
    and has_function_privilege('authenticated', p.oid, 'execute')),
  'bilan_semaine,classement_go_du_jour,mes_records,noter_go_du_jour,rappeler_go_du_jour', 'droits des fonctions (numero_go_du_jour interne)');
select pg_temp.egal((select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('noter_go_du_jour', 'classement_go_du_jour', 'rappeler_go_du_jour', 'bilan_semaine', 'mes_records', 'numero_go_du_jour')),
  false, 'anon : aucune fonction de l''émulation');
select pg_temp.egal((select bool_and(p.prosecdef and p.proconfig[1] = 'search_path=""') from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('noter_go_du_jour', 'classement_go_du_jour', 'rappeler_go_du_jour', 'bilan_semaine', 'mes_records', 'numero_go_du_jour', 'marquer_notifications_lues')),
  true, 'security definer, search_path vide');
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');

\echo 'emulation_amis : tous les cas passent.'
rollback;
