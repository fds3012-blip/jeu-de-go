-- Tests rejouables de la modération (issue #531, migration 20261014001100_moderation.sql) : pseudos interdits (sans
-- faux positifs grossiers), suspension (files, défis, amis, messages ; l'adversaire lit JGB01), fonctions de l'équipe
-- réservées au rôle de service, journal, résumé des signalements, purges, droits.
-- Transaction annulée à la fin : aucune donnée ne reste. Voir supabase/tests/LISEZMOI.md.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
begin;

create function pg_temp.connecte(p_uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', false)::text, true);
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
-- Détail du refus JGU01 (fin de la suspension).
create function pg_temp.detail_refus(p_sql text) returns text
language plpgsql as $$
declare v_detail text;
begin
  execute p_sql;
  return 'accepté';
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return sqlstate || '|' || coalesce(v_detail, '');
end;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Comptes avec pseudo : Alice (1), Bruno (2), Chloé (3), Denis (4), Eve (5), Fanny (6) ; Gaston (7) sans pseudo.
insert into auth.users (id, email, is_anonymous)
  select ('00000000-0000-4000-8000-0000000531' || lpad(n::text, 2, '0'))::uuid, 'm' || n || '@exemple.test', false
  from generate_series(1, 7) n;
insert into public.profiles (id, username)
  select ('00000000-0000-4000-8000-0000000531' || lpad(n::text, 2, '0'))::uuid,
         (array['Alice', 'Bruno', 'Chloe', 'Denis', 'Eve', 'Fanny', null])[n]
  from generate_series(1, 7) n
  on conflict (id) do update set username = excluded.username;
\set alice '''00000000-0000-4000-8000-000000053101'''
\set bruno '''00000000-0000-4000-8000-000000053102'''
\set chloe '''00000000-0000-4000-8000-000000053103'''
\set denis '''00000000-0000-4000-8000-000000053104'''
\set eve '''00000000-0000-4000-8000-000000053105'''
\set fanny '''00000000-0000-4000-8000-000000053106'''
\set gaston '''00000000-0000-4000-8000-000000053107'''

-- 1. Mots interdits : refusés, y compris collés, en majuscules, avec des chiffres ou des lettres répétées.
select pg_temp.egal(public.pseudo_interdit(p), true, 'interdit : ' || p) from unnest(array[
  'connard', 'GrosConnard', 'c0nnard', 'Le_Con', 'gros-con', 'CON', 'xX_salope_Xx', 'Sal0pe92', 'encule', 'Enfoire',
  'putain', 'la_pute', 'fdp', 'NTM', 'Niquetamere', 'merdeux', 'bougnoul', 'Hitler88', 'nazi_du_go',
  'fuck', 'FuckYou', 'fuuuck', 'motherfucker', 'f_u_c_k_e_r', 'bitch', 'BigDick', 'Dick_Head', 'shit', 'nigger', 'n1gga',
  'faggot', 'pussy', 'whore', 'Admin', 'admin_bob', 'Moderateur', 'MochiGo', 'Mochi', 'mochi', 'Mochi_Go_Officiel',
  'Support', 'staff', 'Pedophile', 'porno', 'Sexy_Girl', 'kys', 'connnnnard'
]) p;

-- 2. Pas de faux positifs grossiers : prénoms, villes, mots courants, pseudos de joueurs de go.
select pg_temp.egal(public.pseudo_interdit(p), false, 'accepté : ' || p) from unnest(array[
  'Conan', 'Falcon', 'Connor', 'Constance', 'Scunthorpe', 'Dickens', 'Benedick', 'Cassandra', 'Matsushita', 'Hancock',
  'Peacock', 'Cockpit', 'computer', 'Depute', 'Analyste', 'Canal', 'Grape', 'Therapist', 'Sussex', 'Essex',
  'Shitake', 'Pornic', 'Bassiste', 'Classique', 'technique', 'Unique', 'Chatterton', 'Habite', 'Titan', 'Titouan',
  'Arsenal', 'Nigeria', 'Niger', 'Penistone', 'Sextant', 'Mochi_fan', 'MochiLover', 'Le_Mochi',
  'Shusaku', 'Honinbo', 'AlphaGo', 'Go4Fun', 'Bruno75', 'Cuisinier', 'Assassin', 'Scrapper', 'Draper', 'Monegre',
  'Retardataire', 'Admiral', 'Badminton', 'Moderne', 'Supporter', 'Teamwork', 'Systeme_D', 'Rooted', 'Equipement',
  'Salesman', 'Sale_Bob', 'Pedalo', 'Sexton', 'Cumulus', 'Raper', 'Hitman', 'Nazare', 'Marguerite',
  'Debilitator', 'Coniques', 'Concombre', 'Kaiser', 'Fagot', 'Bicoque'
]) p;

-- 3. Le déclencheur refuse un nouveau pseudo interdit (JGP02), au joueur comme à l'équipe ; l'ancien reste.
set local role authenticated;
select pg_temp.connecte(:gaston);
select pg_temp.doit_refuser(format($$update public.profiles set username = 'GrosConnard' where id = %L$$, :gaston), 'JGP02');
select pg_temp.egal(public.pseudo_autorise('GrosConnard'), false, 'aide à la saisie : refusé');
select pg_temp.egal(public.pseudo_autorise('Conan'), true, 'aide à la saisie : accepté');
select pg_temp.egal(public.pseudo_autorise('a b'), false, 'aide à la saisie : format');
update public.profiles set username = 'Gaston' where id = :gaston;
select pg_temp.egal((select username from public.profiles where id = :gaston), 'Gaston', 'pseudo correct enregistré');
reset role;
select pg_temp.doit_refuser(format($$update public.profiles set username = 'Fuck_Off' where id = %L$$, :gaston), 'JGP02');
-- Un pseudo déjà pris avant la règle n'est pas touché, et le profil reste modifiable (autres colonnes).
alter table public.profiles disable trigger profiles_pseudo_autorise;
update public.profiles set username = 'Sal0pe_75' where id = :fanny;
alter table public.profiles enable trigger profiles_pseudo_autorise;
update public.profiles set country = 'FR' where id = :fanny;
select pg_temp.egal((select count(*) from public.pseudos_a_revoir where pseudo = 'Sal0pe_75'), 1::bigint, 'vue des pseudos à revoir');

-- 4. Fonctions de l'équipe : fermées à l'app, ouvertes au rôle de service.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser($$select public.suspendre_joueur('Bruno', 7, 'Insultes répétées')$$, '42501');
select pg_temp.doit_refuser($$select public.lever_suspension('Bruno')$$, '42501');
select pg_temp.doit_refuser($$select public.renommer_pseudo('Bruno', 'Bruno2')$$, '42501');
select pg_temp.doit_refuser($$select public.reclamer_resume_signalements()$$, '42501');
select pg_temp.doit_refuser($$select * from public.suspensions$$, '42501');
select pg_temp.doit_refuser($$select * from public.journal_moderation$$, '42501');
select pg_temp.doit_refuser($$select * from public.mots_interdits$$, '42501');
select pg_temp.doit_refuser($$select * from public.moderation_a_faire$$, '42501');
set local role anon;
select pg_temp.deconnecte();
select pg_temp.doit_refuser($$select public.pseudo_autorise('Conan')$$, '42501');
set local role service_role;
select pg_temp.deconnecte();
select pg_temp.doit_refuser($$select public.suspendre_joueur('Inconnu', 7, 'Insultes')$$, 'JGU02');
select pg_temp.doit_refuser($$select public.suspendre_joueur('Bruno', 0, 'Insultes')$$, 'JGU02');
select pg_temp.doit_refuser($$select public.suspendre_joueur('Bruno', 7, '')$$, 'JGU02');
select pg_temp.doit_refuser($$select public.renommer_pseudo('Bruno', 'Le_Con')$$, 'JGP02');
select pg_temp.doit_refuser($$select public.renommer_pseudo('Bruno', 'Alice')$$, '23505');
select pg_temp.egal(public.renommer_pseudo('Sal0pe_75', 'Fanny'), 'Fanny', 'renommer');
select pg_temp.egal(public.renommer_pseudo('fanny') ~ '^Joueur-[A-Za-z0-9xyz]{6}$', true, 'renommer sans nom : Joueur-xxxxxx');
select public.renommer_pseudo((select username from public.profiles where id = :fanny), 'Fanny');

-- 5. Bruno attend une partie en direct et une partie lente ; Denis et Bruno sont amis, avec un défi en cours.
reset role;
set local role authenticated;
select pg_temp.connecte(:bruno);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Bruno attend en direct');
select pg_temp.egal(public.chercher_partie_lente(13::smallint, 2::smallint), null::uuid, 'Bruno attend une partie lente');
select public.demander_ami('Denis');
select pg_temp.connecte(:denis);
select public.repondre_ami('Bruno', true);
select public.defier_ami('Bruno') as encours \gset
select partie_id as lien, jeton as jeton from public.creer_defi() \gset

-- Suspension de Bruno pour 7 jours : il sort des files ; ses parties en cours continuent.
reset role;
set local role service_role;
select pg_temp.deconnecte();
select pg_temp.egal(public.suspendre_joueur('bruno', 7, 'Insultes répétées en partie') > now() + interval '6 days', true, 'suspendu 7 jours');
reset role;
select pg_temp.egal((select count(*) from public.match_queue where user_id = :bruno), 0::bigint, 'sorti de la file du direct');
select pg_temp.egal((select count(*) from public.file_lente where user_id = :bruno), 0::bigint, 'sorti de la file lente');
select pg_temp.egal((select count(*) from public.suspensions_en_cours where pseudo = 'Bruno'), 1::bigint, 'vue des suspensions');
select pg_temp.egal((select count(*) from public.journal_moderation where joueur_id = :bruno and action = 'suspendre'), 1::bigint, 'journal');

-- 6. Pendant la suspension : JGU01 partout, avec la fin dans le détail.
set local role authenticated;
select pg_temp.connecte(:bruno);
select pg_temp.doit_refuser($$select public.find_match(9::smallint)$$, 'JGU01');
select pg_temp.egal(pg_temp.detail_refus($$select public.find_match(9::smallint)$$) ~ '^JGU01\|\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$', true, 'fin dans le détail');
select pg_temp.doit_refuser($$select public.chercher_partie_lente(9::smallint, 1::smallint)$$, 'JGU01');
select pg_temp.doit_refuser($$select * from public.creer_defi()$$, 'JGU01');
select pg_temp.doit_refuser(format($$select public.rejoindre_defi(%L)$$, :'jeton'), 'JGU01');
select pg_temp.doit_refuser($$select public.defier_ami('Denis')$$, 'JGU01');
select pg_temp.doit_refuser($$select public.demander_ami('Alice')$$, 'JGU01');
select pg_temp.doit_refuser(format($$select public.dire_en_partie(%L, 'bien_joue')$$, :'encours'), 'JGU01');
-- Ce qui ne touche personne reste permis : lire ses parties, son profil.
select pg_temp.egal((select count(*) from public.games where id = :'encours'), 1::bigint, 'partie en cours lisible');

-- 7. Les autres joueurs : la partie en cours continue (message permis), mais rien de nouveau avec Bruno (JGB01).
select pg_temp.connecte(:denis);
select pg_temp.egal(public.dire_en_partie(:'encours', 'bonne_partie'), true, 'Denis parle dans la partie en cours');
select pg_temp.doit_refuser($$select public.defier_ami('Bruno')$$, 'JGB01');
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser($$select public.demander_ami('Bruno')$$, 'JGB01');
-- Défi par lien créé par Bruno avant la suspension : personne ne le rejoint pendant (JGB01).
reset role;
set local role service_role;
select pg_temp.egal(public.lever_suspension('Bruno'), 1, 'lever');
reset role;
set local role authenticated;
select pg_temp.connecte(:bruno);
select partie_id as lienb, jeton as jetonb from public.creer_defi() \gset
reset role;
set local role service_role;
select public.suspendre_joueur('Bruno', null, 'Triche (moteur)') = 'infinity'::timestamptz as sans_fin \gset
reset role;
set local role authenticated;
select pg_temp.connecte(:chloe);
select pg_temp.doit_refuser(format($$select public.rejoindre_defi(%L)$$, :'jetonb'), 'JGB01');
select pg_temp.connecte(:bruno);
select pg_temp.egal(pg_temp.detail_refus($$select public.find_match(9::smallint)$$), 'JGU01|', 'sans fin : détail vide');

-- 8. Tâche planifiée (pas de session) : jamais arrêtée par un compte suspendu.
reset role;
select pg_temp.deconnecte();
select public.refuser_si_suspendu(array[:bruno]::uuid[]);

-- 9. Fin de la suspension : tout redevient possible.
update public.suspensions set debut = now() - interval '8 days', fin = now() - interval '1 day' where joueur_id = :bruno;
set local role authenticated;
select pg_temp.connecte(:bruno);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Bruno peut rejouer en direct');
select pg_temp.egal(public.demander_ami('Alice'), 'envoyee', 'Bruno peut demander Alice en ami');
select pg_temp.connecte(:chloe);
select pg_temp.egal(public.rejoindre_defi(:'jetonb'), :'lienb'::uuid, 'Chloé rejoint le défi de Bruno');

-- 10. Résumé des signalements : nombres seulement ; deux appels ne comptent pas deux fois.
select pg_temp.connecte(:alice);
select public.signaler('joueur', 'pseudo', 'Il m''a insulté', 'Bruno');
select pg_temp.connecte(:eve);
select public.signaler('joueur', 'antijeu', null, 'Bruno');
select public.signaler('bug', null, 'Le plateau clignote');
reset role;
set local role service_role;
select pg_temp.deconnecte();
select public.reclamer_resume_signalements() as r1 \gset
select pg_temp.egal((:'r1'::jsonb ->> 'nouveaux')::int, 3, 'trois nouveaux signalements');
select pg_temp.egal((:'r1'::jsonb -> 'par_type' ->> 'joueur')::int, 2, 'deux sur un joueur');
select pg_temp.egal((:'r1'::jsonb ->> 'a_revoir')::int, 1, 'un joueur signalé par deux comptes');
select pg_temp.egal(:'r1'::text ~* '(insult|clignote|bruno)', false, 'aucun texte libre ni pseudo');
reset role;
-- Le temps ne passe pas dans une transaction : le résumé suivant part de la fin du précédent.
update public.alertes_moderation set jusqua = now() + interval '1 second';
set local role service_role;
select pg_temp.egal((public.reclamer_resume_signalements() ->> 'nouveaux')::int, 0, 'rien de nouveau au résumé suivant');
reset role;
select pg_temp.egal((select nombre from public.moderation_a_faire where quoi = 'signalements_nouveaux'), 3::bigint, 'tableau de l''équipe');

-- 11. Rétention : journal et résumés de plus de 12 mois effacés, suspensions finies depuis plus de 12 mois aussi.
update public.journal_moderation set cree_le = now() - interval '13 months' where action = 'renommer';
update public.alertes_moderation set cree_le = now() - interval '13 months';
update public.suspensions set levee_le = now() - interval '13 months' where levee_le is not null;
select public.purger_moderation();
select pg_temp.egal((select count(*) from public.journal_moderation where action = 'renommer'), 0::bigint, 'journal purgé');
select pg_temp.egal((select count(*) from public.journal_moderation where action = 'suspendre'), 2::bigint, 'journal récent gardé');
select pg_temp.egal((select count(*) from public.alertes_moderation), 0::bigint, 'résumés purgés');
select pg_temp.egal((select count(*) from public.suspensions where joueur_id = :bruno), 1::bigint, 'suspension levée il y a 13 mois purgée');

-- 12. Droits et sécurité.
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');
select pg_temp.egal((select count(*) from pg_policies where schemaname = 'public'
  and tablename in ('mots_interdits', 'suspensions', 'journal_moderation', 'alertes_moderation')), 0::bigint,
  'aucune politique : accès par fonctions seulement');
select pg_temp.egal((select bool_or(has_table_privilege(r, 'public.' || t, 'select'))
  from unnest(array['anon', 'authenticated']) r,
       unnest(array['mots_interdits', 'suspensions', 'journal_moderation', 'alertes_moderation', 'pseudos_a_revoir',
                    'suspensions_en_cours', 'moderation_a_faire']) t), false, 'tables et vues fermées à l''app');
select pg_temp.egal((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('pseudo_interdit', 'pseudo_autorise', 'profiles_pseudo_autorise',
    'fin_suspension', 'refuser_si_suspendu', 'suspension_file', 'suspension_defi', 'suspension_partie', 'suspension_message',
    'suspension_amitie', 'moderation_joueur', 'suspendre_joueur', 'lever_suspension', 'renommer_pseudo',
    'reclamer_resume_signalements', 'purger_moderation')), true, 'security definer, search_path vide');
select pg_temp.egal((select string_agg(p.proname, ',' order by p.proname) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('pseudo_interdit', 'pseudo_autorise', 'profiles_pseudo_autorise',
    'fin_suspension', 'refuser_si_suspendu', 'suspension_file', 'suspension_defi', 'suspension_partie', 'suspension_message',
    'suspension_amitie', 'moderation_joueur', 'suspendre_joueur', 'lever_suspension', 'renommer_pseudo',
    'reclamer_resume_signalements', 'purger_moderation')
    and has_function_privilege('authenticated', p.oid, 'execute')), 'pseudo_autorise', 'seule l''aide à la saisie est ouverte à l''app');
select pg_temp.egal((select string_agg(p.proname, ',' order by p.proname) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('suspendre_joueur', 'lever_suspension', 'renommer_pseudo', 'reclamer_resume_signalements')
    and has_function_privilege('service_role', p.oid, 'execute')),
  'lever_suspension,reclamer_resume_signalements,renommer_pseudo,suspendre_joueur', 'fonctions de l''équipe : rôle de service');

\o
\echo 'moderation : tous les cas passent.'
\o /dev/null
rollback;
