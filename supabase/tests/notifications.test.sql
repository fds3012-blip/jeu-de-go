-- Tests rejouables des notifications dans l'app (issue #367, partie 2). Transaction annulée à la fin : aucune donnée
-- ne reste. Voir supabase/tests/LISEZMOI.md.
--
-- Temps réel : Supabase Realtime (postgres_changes) n'envoie une ligne modifiée à un abonné que si cet abonné peut la
-- lire sous la RLS. Il le vérifie en se mettant dans le rôle de l'abonné (`authenticated` et les claims de son jeton)
-- puis en relisant la ligne par sa clé. `pg_temp.temps_reel_voit` refait exactement cette lecture : ce qu'elle ne voit
-- pas n'arrive jamais sur le téléphone de l'abonné, quel que soit le filtre qu'il demande.
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
-- Lecture de Realtime pour un abonné : rôle authenticated, claims de son jeton, ligne relue par sa clé sous la RLS.
create function pg_temp.temps_reel_voit(p_uid uuid, p_table text, p_cle text, p_valeur text) returns boolean
language plpgsql as $$
declare
  v boolean;
begin
  perform pg_temp.connecte(p_uid);
  set local role authenticated;
  execute format('select exists (select 1 from public.%I where %I::text = %L)', p_table, p_cle, p_valeur) into v;
  reset role;
  return v;
end;
$$;
-- Notifications en attente d'un joueur, lues comme lui (RLS) : « type:partie », triées.
create function pg_temp.en_attente(p_uid uuid) returns text
language plpgsql as $$
declare
  v text;
begin
  perform pg_temp.connecte(p_uid);
  set local role authenticated;
  select coalesce(string_agg(type || ':' || coalesce(left(partie_id::text, 4), '-'), ',' order by type, partie_id), '')
    into v from public.notifications where lue_le is null;
  reset role;
  return v;
end;
$$;
-- Coup d'un défi tel que l'enregistre game-action (clé service, sans auth.uid()).
create function pg_temp.coup(p_partie uuid, p_joueur uuid, p_coup text, p_comptage boolean default false) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  perform public.jouer_coup_defi(p_partie, p_joueur, (select moves from public.games where id = p_partie), p_coup, p_comptage);
  reset role;
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

-- 1. Structure : RLS, une seule politique (lecture), aucun droit d'écriture, publiée en temps réel.
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.notifications'::regclass), true, 'RLS active');
select pg_temp.egal((select string_agg(polcmd::text, ',') from pg_policy where polrelid = 'public.notifications'::regclass), 'r', 'lecture seule');
select pg_temp.egal(has_table_privilege('anon', 'public.notifications', 'select'), false, 'anon : rien');
select pg_temp.egal(has_table_privilege('authenticated', 'public.notifications', 'insert,update,delete,truncate'), false, 'aucune écriture directe');
select pg_temp.egal(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications'), true, 'publiée en temps réel');
select pg_temp.egal((select bool_and(p.proconfig[1] = 'search_path=""') from pg_proc p
  where p.proname in ('notifier', 'notifier_partie', 'notifier_ami', 'marquer_notifications_lues', 'purger_notifications')), true, 'search_path vide');
select pg_temp.egal((select bool_or(has_function_privilege(r, p.oid, 'execute')) from pg_proc p, unnest(array['anon', 'authenticated', 'service_role']) r
  where p.proname in ('notifier', 'notifier_partie', 'notifier_ami', 'purger_notifications')), false, 'fonctions internes fermées');
select pg_temp.egal(has_function_privilege('anon', 'public.marquer_notifications_lues(uuid, text)', 'execute'), false, 'anon ne marque rien');
select pg_temp.egal(has_function_privilege('authenticated', 'public.marquer_notifications_lues(uuid, text)', 'execute'), true, 'un joueur marque les siennes');

-- 2. Un défi Alice (Blanc) contre Bruno (Noir). Rejoindre ne prévient personne : Bruno joue tout de suite.
set local role authenticated;
select pg_temp.connecte(:alice);
select partie_id as partie, jeton from public.creer_defi() \gset
select pg_temp.connecte(:bruno);
select public.rejoindre_defi(:'jeton');
reset role;
select pg_temp.egal(pg_temp.en_attente(:bruno), '', 'rejoindre : rien pour Bruno');
select pg_temp.egal(pg_temp.en_attente(:alice), '', 'rejoindre : rien pour Alice');

-- 3. Bruno joue : « c'est ton tour » pour Alice seulement. Elle seule la lit, en direct comme en temps réel.
select pg_temp.coup(:'partie', :bruno, 'ee');
select pg_temp.egal(pg_temp.en_attente(:alice), 'tour:' || left(:'partie', 4), 'Alice : à toi');
select pg_temp.egal(pg_temp.en_attente(:bruno), '', 'Bruno : rien');
select id as notif from public.notifications where destinataire_id = :alice \gset
select pg_temp.egal(pg_temp.temps_reel_voit(:alice, 'notifications', 'id', :'notif'), true, 'temps réel : Alice reçoit la sienne');
select pg_temp.egal(pg_temp.temps_reel_voit(:bruno, 'notifications', 'id', :'notif'), false, 'temps réel : pas l''adversaire');
select pg_temp.egal(pg_temp.temps_reel_voit(:chloe, 'notifications', 'id', :'notif'), false, 'temps réel : pas un tiers');
-- Chloé demande la file d'Alice (filtre destinataire_id=eq.Alice) : la RLS ne lui donne rien.
set local role authenticated;
select pg_temp.connecte(:chloe);
select pg_temp.egal((select count(*) from public.notifications where destinataire_id = :alice), 0::bigint, 'un tiers ne lit pas les notifications d''un autre');
reset role;

-- 4. Alice joue : sa notification est dépassée, Bruno a la sienne. Une seule en attente par joueur et partie.
select pg_temp.coup(:'partie', :alice, 'cc');
select pg_temp.egal(pg_temp.en_attente(:alice), '', 'Alice a joué : plus rien');
select pg_temp.egal(pg_temp.en_attente(:bruno), 'tour:' || left(:'partie', 4), 'Bruno : à toi');
select pg_temp.coup(:'partie', :bruno, 'gg');
select pg_temp.coup(:'partie', :alice, 'gc');
select pg_temp.egal((select count(*) from public.notifications where destinataire_id = :bruno and lue_le is null), 1::bigint, 'pas de doublon');

-- 5. Marquer lue : ouvrir la partie l'efface ; on ne marque que les siennes ; type inconnu refusé ; sans session refusé.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.marquer_notifications_lues(:'partie'), 0, 'Alice n''a rien à marquer');
select pg_temp.doit_refuser('select public.marquer_notifications_lues(null, ''autre'')', 'Type inconnu');
select pg_temp.connecte(:bruno);
select pg_temp.egal(public.marquer_notifications_lues(:'partie'), 1, 'Bruno ouvre la partie');
select pg_temp.egal((select count(*) from public.notifications where lue_le is null), 0::bigint, 'plus de pastille');
select pg_temp.doit_refuser(format('update public.notifications set lue_le = null where destinataire_id = %L', :bruno), 'permission denied');
select pg_temp.doit_refuser(format('insert into public.notifications (destinataire_id, type, partie_id) values (%L, ''tour'', %L)', :chloe, :'partie'), 'permission denied');
select pg_temp.doit_refuser('delete from public.notifications', 'permission denied');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select pg_temp.doit_refuser('select public.marquer_notifications_lues()', 'Connexion requise');
reset role;
set local role anon;
select pg_temp.doit_refuser('select public.marquer_notifications_lues()', 'permission denied');
select pg_temp.doit_refuser('select count(*) from public.notifications', 'permission denied');
reset role;

-- 6. Comptage : deux passes, celui qui n'a pas passé en dernier est prévenu ; une proposition prévient l'autre.
select pg_temp.coup(:'partie', :bruno, 'tt');
select pg_temp.egal(pg_temp.en_attente(:alice), 'tour:' || left(:'partie', 4), 'Bruno passe : Alice joue');
select pg_temp.coup(:'partie', :alice, 'tt', true);
select pg_temp.egal(pg_temp.en_attente(:alice), '', 'Alice passe : rien pour elle');
select pg_temp.egal(pg_temp.en_attente(:bruno), 'comptage:' || left(:'partie', 4), 'Bruno : comptage');
-- Bruno propose les pierres mortes (game-action, clé service) : Alice doit répondre.
set local role service_role;
update public.games set dead_stones = '', dead_proposed_by = :bruno where id = :'partie';
reset role;
select pg_temp.egal(pg_temp.en_attente(:bruno), '', 'Bruno a proposé : rien pour lui');
select pg_temp.egal(pg_temp.en_attente(:alice), 'comptage:' || left(:'partie', 4), 'Alice : accepter ou reprendre');

-- 7. Fin : Alice accepte (finish_game_by_score, clé service) : Bruno est prévenu, pas Alice. Aucune cote touchée.
create temp table cotes as select id, rating from public.profiles;
grant select on cotes to service_role;
set local role service_role;
select public.finish_game_by_score(:'partie', :alice, (select moves from public.games where id = :'partie'), '', 'W+2.5', 40, 42.5);
reset role;
select pg_temp.egal(pg_temp.en_attente(:alice), '', 'Alice a accepté : rien');
select pg_temp.egal(pg_temp.en_attente(:bruno), 'fin:' || left(:'partie', 4), 'Bruno : partie finie');
select pg_temp.egal((select count(*) from public.profiles p join cotes c using (id) where p.rating is distinct from c.rating), 0::bigint, 'aucune cote touchée');

-- 8. Abandon (resign_game, auth.uid() connu) : l'adversaire seul est prévenu.
set local role authenticated;
select pg_temp.connecte(:alice);
select partie_id as partie2, jeton as jeton2 from public.creer_defi() \gset
select pg_temp.connecte(:chloe);
select public.rejoindre_defi(:'jeton2');
select public.resign_game(:'partie2');
reset role;
select pg_temp.egal(pg_temp.en_attente(:chloe), '', 'Chloé abandonne : rien pour elle');
select pg_temp.egal(pg_temp.en_attente(:alice), 'fin:' || left(:'partie2', 4), 'Alice : partie finie');

-- 9. Partie hors défi (en ligne, en direct) : aucune notification.
insert into public.games (black_id, white_id, created_by, size, status) values (:alice, :denis, :alice, 9, 'active') returning id as publique \gset
update public.games set moves = 'ee' where id = :'publique';
select pg_temp.egal((select count(*) from public.notifications where partie_id = :'publique'), 0::bigint, 'hors défi : rien');

-- 10. Pourquoi l'app écoute `notifications` et non `games` : la RLS de `games` laisse passer à tout joueur connecté
--     les parties publiques entre humains (E17). Chloé recevrait chaque coup de cette partie ; pas d'un défi.
select pg_temp.egal(pg_temp.temps_reel_voit(:chloe, 'games', 'id', :'publique'), true, 'games : une partie publique arrive chez un tiers');
select pg_temp.egal(pg_temp.temps_reel_voit(:chloe, 'games', 'id', :'partie'), false, 'games : un défi n''arrive pas chez un tiers');
select pg_temp.egal(pg_temp.temps_reel_voit(:chloe, 'defis', 'partie_id', :'partie'), false, 'defis : pas chez un tiers');
select pg_temp.egal(pg_temp.temps_reel_voit(:bruno, 'defis', 'partie_id', :'partie'), true, 'defis : chez un joueur');

-- 11. Amis : une demande prévient le destinataire (une seule notification pour plusieurs demandes) ; quand plus
--     aucune n'attend, elle est dépassée. Depuis #359, les amis s'écrivent par les fonctions serveur seulement
--     (demander_ami, repondre_ami, retirer_ami : 20261002010100_amis.sql).
set local role authenticated;
select pg_temp.connecte(:bruno);
select public.demander_ami('Denis');
select pg_temp.connecte(:chloe);
select public.demander_ami('Denis');
reset role;
select pg_temp.egal(pg_temp.en_attente(:denis), 'ami:-', 'Denis : demandes d''ami');
select pg_temp.egal(pg_temp.en_attente(:bruno), 'fin:' || left(:'partie', 4), 'Bruno : pas de notification d''ami');
set local role authenticated;
select pg_temp.connecte(:denis);
select public.repondre_ami('Bruno', true);
reset role;
select pg_temp.egal(pg_temp.en_attente(:denis), 'ami:-', 'une demande attend encore');
set local role authenticated;
select pg_temp.connecte(:denis);
select public.repondre_ami('Chloe', false);
reset role;
select pg_temp.egal(pg_temp.en_attente(:denis), '', 'plus aucune demande : dépassée');

-- 12. Purge : plus de 30 jours, effacées ; les récentes restent. Compte supprimé : ses notifications partent avec.
update public.notifications set creee_le = now() - interval '31 days' where destinataire_id = :alice;
select pg_temp.egal(public.purger_notifications() > 0, true, 'purge : vieilles effacées');
select pg_temp.egal((select count(*) from public.notifications where destinataire_id = :alice), 0::bigint, 'Alice : purgées');
select pg_temp.egal((select count(*) from public.notifications where destinataire_id = :bruno) > 0, true, 'Bruno : gardées');
delete from public.profiles where id = :bruno;
select pg_temp.egal((select count(*) from public.notifications where destinataire_id = :bruno), 0::bigint, 'compte supprimé : effacées');

\echo 'notifications : tous les cas passent.'
rollback;
