-- Tests rejouables des amis (issue #359, migration 20261002010100_amis.sql). Tout se passe dans une transaction
-- annulée à la fin : aucune donnée ne reste. Voir supabase/tests/LISEZMOI.md.
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
-- Refus attendu : le message ou le code SQLSTATE doit contenir le motif.
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
create function pg_temp.amis_de_moi() returns text
language sql as $$ select coalesce(string_agg(pseudo || ':' || etat, ',' order by pseudo), '') from public.mes_amis() $$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Comptes : Alice, Bruno, Eve, Gael, Hugo (pseudo) ; Chloé (sans pseudo) ; Denis (anonyme) ;
-- Fantôme : profil avec pseudo mais compte anonyme (ne doit jamais être trouvé).
insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bruno@exemple.test', false),
  ('cccccccc-0000-4000-8000-000000000003', 'chloe@exemple.test', false),
  ('dddddddd-0000-4000-8000-000000000004', null, true),
  ('eeeeeeee-0000-4000-8000-000000000005', 'eve@exemple.test', false),
  ('ffffffff-0000-4000-8000-000000000006', null, true),
  ('99999999-0000-4000-8000-000000000007', 'gael@exemple.test', false),
  ('88888888-0000-4000-8000-000000000008', 'hugo@exemple.test', false);
insert into public.profiles (id, username) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Alice'), ('bbbbbbbb-0000-4000-8000-000000000002', 'Bruno'),
  ('cccccccc-0000-4000-8000-000000000003', null), ('dddddddd-0000-4000-8000-000000000004', null),
  ('eeeeeeee-0000-4000-8000-000000000005', 'Eve'), ('ffffffff-0000-4000-8000-000000000006', 'Fantome'),
  ('99999999-0000-4000-8000-000000000007', 'Gael'), ('88888888-0000-4000-8000-000000000008', 'Hugo')
  on conflict (id) do update set username = excluded.username;
-- 20 destinataires pour la limite du jour.
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

set local role authenticated;

-- 1. Compte avec pseudo exigé (JGC01, JGP01 de #343).
select pg_temp.deconnecte();
select pg_temp.doit_refuser('select public.demander_ami(''Bruno'')', 'JGC01');
select pg_temp.doit_refuser('select * from public.mes_amis()', 'JGC01');
select pg_temp.connecte(:denis, true);
select pg_temp.doit_refuser('select public.demander_ami(''Bruno'')', 'JGC01');
select pg_temp.doit_refuser('select public.defier_ami(''Bruno'')', 'JGC01');
select pg_temp.connecte(:chloe);
select pg_temp.doit_refuser('select public.demander_ami(''Bruno'')', 'JGP01');
select pg_temp.doit_refuser('select public.repondre_ami(''Bruno'', true)', 'JGP01');

-- 2. Aucune écriture directe ; le journal est fermé à l'app.
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser(format('insert into public.friendships (requester_id, addressee_id) values (%L, %L)', :alice, :bruno), 'permission denied');
select pg_temp.doit_refuser('update public.friendships set status = ''accepted''', 'permission denied');
select pg_temp.doit_refuser('delete from public.friendships', 'permission denied');
select pg_temp.doit_refuser('select count(*) from public.demandes_ami_journal', 'permission denied');
select pg_temp.doit_refuser('select public.joueur_par_pseudo(''Bruno'')', 'permission denied');

-- 3. Pseudo introuvable, mal formé, compte anonyme, soi-même.
select pg_temp.doit_refuser('select public.demander_ami(''Personne'')', 'JGA01');
select pg_temp.doit_refuser('select public.demander_ami(''a'')', 'JGA01');
select pg_temp.doit_refuser('select public.demander_ami(''bruno@exemple.test'')', 'JGA01');
select pg_temp.doit_refuser('select public.demander_ami(null)', 'JGA01');
select pg_temp.doit_refuser('select public.demander_ami(''Fantome'')', 'JGA01');
select pg_temp.doit_refuser('select public.demander_ami(''ALICE'')', 'JGA02');

-- 4. Demande (pseudo exact sans casse), doublon refusé ; chacun voit ses seules relations, par pseudo.
select pg_temp.egal(public.demander_ami(' bruno '), 'envoyee', 'Alice demande Bruno');
select pg_temp.doit_refuser('select public.demander_ami(''Bruno'')', 'JGA04');
select pg_temp.egal(pg_temp.amis_de_moi(), 'Bruno:envoyee', 'Alice voit sa demande envoyée');
select pg_temp.doit_refuser('select public.defier_ami(''Bruno'')', 'JGA08');
select pg_temp.connecte(:bruno);
select pg_temp.egal(pg_temp.amis_de_moi(), 'Alice:recue', 'Bruno voit la demande reçue');
select pg_temp.connecte(:eve);
select pg_temp.egal(pg_temp.amis_de_moi(), '', 'Eve ne voit rien');
select pg_temp.egal((select count(*) from public.friendships), 0::bigint, 'Eve ne lit pas les relations des autres (RLS)');
select pg_temp.doit_refuser('select public.repondre_ami(''Alice'', true)', 'JGA07');
select pg_temp.egal(pg_get_function_result('public.mes_amis()'::regprocedure),
  'TABLE(pseudo text, etat text, depuis timestamp with time zone)', 'mes_amis : ni identifiant ni e-mail');

-- 5. Acceptation, puis plus de nouvelle demande.
select pg_temp.connecte(:bruno);
select pg_temp.egal(public.repondre_ami('alice', true), 'amis', 'Bruno accepte');
select pg_temp.egal(pg_temp.amis_de_moi(), 'Alice:ami', 'Bruno : Alice est son amie');
select pg_temp.doit_refuser('select public.demander_ami(''Alice'')', 'JGA03');
select pg_temp.doit_refuser('select public.repondre_ami(''Alice'', true)', 'JGA07');
select pg_temp.connecte(:alice);
select pg_temp.egal(pg_temp.amis_de_moi(), 'Bruno:ami', 'Alice : Bruno est son ami');

-- 6. Demande croisée : la seconde vaut acceptation.
select pg_temp.connecte(:eve);
select pg_temp.egal(public.demander_ami('Alice'), 'envoyee', 'Eve demande Alice');
select pg_temp.connecte(:alice);
select pg_temp.egal(public.demander_ami('Eve'), 'amis', 'Alice demande Eve : amies');
select pg_temp.egal(pg_temp.amis_de_moi(), 'Bruno:ami,Eve:ami', 'Alice a deux amis');

-- 7. Refus silencieux ; pas de relance sous 7 jours.
select pg_temp.egal(public.demander_ami('Gael'), 'envoyee', 'Alice demande Gael');
select pg_temp.connecte(:gael);
select pg_temp.egal(public.repondre_ami('Alice', false), 'refusee', 'Gael refuse');
select pg_temp.egal(pg_temp.amis_de_moi(), '', 'refus : plus de relation pour Gael');
select pg_temp.connecte(:alice);
select pg_temp.egal(pg_temp.amis_de_moi(), 'Bruno:ami,Eve:ami', 'refus : plus de demande chez Alice');
select pg_temp.doit_refuser('select public.demander_ami(''Gael'')', 'JGA06');
reset role;
update public.demandes_ami_journal set envoyee_le = now() - interval '8 days' where destinataire_id = :gael;
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.demander_ami('Gael'), 'envoyee', 'après 7 jours, nouvelle demande possible');
select public.retirer_ami('Gael');
select pg_temp.connecte(:gael);
select pg_temp.egal(pg_temp.amis_de_moi(), '', 'demande annulée : Gael ne la voit plus');

-- 8. 20 demandes par 24 heures au plus.
select pg_temp.connecte(:hugo);
select count(*) from (select public.demander_ami('Joueur' || i) from generate_series(1, 20) i) s;
select pg_temp.doit_refuser('select public.demander_ami(''Joueur21'')', 'JGA05');
reset role;
update public.demandes_ami_journal set envoyee_le = now() - interval '25 hours' where demandeur_id = :hugo;
set local role authenticated;
select pg_temp.connecte(:hugo);
select pg_temp.egal(public.demander_ami('Joueur21'), 'envoyee', 'le lendemain, Hugo peut de nouveau demander');
-- Journal gardé 30 jours : les lignes plus anciennes sont effacées à la demande suivante.
reset role;
update public.demandes_ami_journal set envoyee_le = now() - interval '31 days' where demandeur_id = :hugo
  and envoyee_le < now() - interval '24 hours';
set local role authenticated;
select pg_temp.connecte(:eve);
select pg_temp.egal(public.demander_ami('Hugo'), 'envoyee', 'Eve demande Hugo');
reset role;
select pg_temp.egal((select count(*) from public.demandes_ami_journal where envoyee_le < now() - interval '30 days'), 0::bigint, 'journal de plus de 30 jours effacé');

-- 9. Défier un ami : la partie commence tout de suite, l'ami a Noir ; lue par les deux seuls joueurs.
set local role authenticated;
select pg_temp.connecte(:alice);
select public.defier_ami('bruno') as partie \gset
reset role;
select pg_temp.egal((select black_id::text || ',' || white_id::text || ',' || status || ',' || rated || ',' || prive || ',' || size from public.games where id = :'partie'),
  :bruno || ',' || :alice || ',active,false,true,9', 'partie du défi : Bruno Noir, Alice Blanc, non classée, privée');
select pg_temp.egal((select invite_id = :bruno and createur_id = :alice and date_limite > now() + interval '2 days' and lien_expire_le <= now()
  from public.defis where partie_id = :'partie'), true, 'défi : invité placé, délai lancé, lien inutilisable');
set local role authenticated;
select pg_temp.connecte(:bruno);
select pg_temp.egal((select count(*) from public.defis where partie_id = :'partie'), 1::bigint, 'Bruno lit le défi');
select pg_temp.egal(public.victoire_au_temps(:'partie'), null::text, 'Bruno constate le temps');
select pg_temp.connecte(:eve);
select pg_temp.egal((select count(*) from public.games where id = :'partie'), 0::bigint, 'Eve ne lit pas la partie');
select pg_temp.doit_refuser('select public.defier_ami(''Bruno'')', 'JGA08');
reset role;
set local role service_role;
select pg_temp.egal(public.jouer_coup_defi(:'partie', :bruno, '', 'ee') ->> 'coups', 'ee', 'Bruno joue le premier coup');
reset role;
set local role authenticated;
select pg_temp.connecte(:alice);
select count(*) from (select public.defier_ami('Bruno') from generate_series(1, 2)) s;
select pg_temp.doit_refuser('select public.defier_ami(''Bruno'')', 'JGA09');
select pg_temp.egal((select count(*) from public.games where white_id = :alice and black_id = :bruno), 3::bigint, '3 défis en cours au plus contre un ami');

-- 10. Retirer un ami : la relation part, idempotent ; les défis en cours restent.
select public.retirer_ami('Bruno');
select public.retirer_ami('Bruno');
select pg_temp.egal(pg_temp.amis_de_moi(), 'Eve:ami', 'Bruno n''est plus dans la liste');
select pg_temp.doit_refuser('select public.defier_ami(''Bruno'')', 'JGA08');
select pg_temp.egal((select count(*) from public.games where id = :'partie'), 1::bigint, 'le défi en cours reste');
select pg_temp.connecte(:bruno);
select pg_temp.egal(pg_temp.amis_de_moi(), '', 'Bruno ne voit plus Alice');

-- 11. Suppression du compte : relations et journal partent avec lui.
select pg_temp.connecte(:eve);
select public.delete_my_account();
reset role;
select pg_temp.egal((select count(*) from public.friendships where :eve in (requester_id, addressee_id)), 0::bigint, 'compte supprimé : relations effacées');
select pg_temp.egal((select count(*) from public.demandes_ami_journal where :eve in (demandeur_id, destinataire_id)), 0::bigint, 'compte supprimé : journal effacé');
-- Profil effacé autrement (purge des anonymes, effacement manuel) : cascade.
delete from public.profiles where id = :hugo;
select pg_temp.egal((select count(*) from public.friendships where :hugo in (requester_id, addressee_id)), 0::bigint, 'profil effacé : relations effacées');
select pg_temp.egal((select count(*) from public.demandes_ami_journal where :hugo in (demandeur_id, destinataire_id)), 0::bigint, 'profil effacé : journal effacé');

-- 12. Structure : RLS partout, journal sans politique ni droit pour l'app, fonctions bien ouvertes.
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.demandes_ami_journal'::regclass), true, 'RLS sur le journal');
select pg_temp.egal((select count(*) from pg_policies where tablename = 'demandes_ami_journal'), 0::bigint, 'journal : aucune politique');
select pg_temp.egal(has_table_privilege('authenticated', 'public.demandes_ami_journal', 'select,insert,update,delete')
  or has_table_privilege('anon', 'public.demandes_ami_journal', 'select,insert,update,delete'), false, 'journal : aucun droit');
select pg_temp.egal(has_table_privilege('authenticated', 'public.friendships', 'insert,update,delete'), false, 'friendships : pas d''écriture directe');
select pg_temp.egal(has_table_privilege('authenticated', 'public.friendships', 'select'), true, 'friendships : lecture de ses relations');
select pg_temp.egal((select string_agg(p.proname, ',' order by p.proname) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('demander_ami', 'repondre_ami', 'retirer_ami', 'mes_amis', 'defier_ami', 'joueur_par_pseudo')
    and has_function_privilege('authenticated', p.oid, 'execute')), 'defier_ami,demander_ami,mes_amis,repondre_ami,retirer_ami', 'droits des fonctions');
select pg_temp.egal((select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('demander_ami', 'repondre_ami', 'retirer_ami', 'mes_amis', 'defier_ami', 'joueur_par_pseudo')),
  false, 'anon : aucune fonction des amis');
select pg_temp.egal((select bool_and(p.prosecdef and p.proconfig[1] = 'search_path=""') from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('demander_ami', 'repondre_ami', 'retirer_ami', 'mes_amis', 'defier_ami', 'joueur_par_pseudo')),
  true, 'security definer, search_path vide');
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');

\echo 'amis : tous les cas passent.'
rollback;
