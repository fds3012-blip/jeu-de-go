-- Tests rejouables de la sécurité entre joueurs (issues #363 et #373, migration 20261005220100_securite_signalements.sql) :
-- signalements, blocage (défis, demandes d'ami, appariement en direct), messages prédéfinis en partie, tâche qui
-- clôt les parties en direct abandonnées, purge de rétention.
-- Transaction annulée à la fin : aucune donnée ne reste. Voir supabase/tests/LISEZMOI.md.
-- Le temps : now() est fixe dans une transaction ; le test recule les dates pour simuler l'attente.
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
-- Un coup tel que l'écrit la fonction serveur game-action (clé service), après validation des règles.
create function pg_temp.jouer(p_partie uuid, p_coup text) returns text
language sql as $$
  update public.games set moves = moves || p_coup where id = p_partie and status = 'active' returning status || ':' || coalesce(result, '-');
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Comptes avec pseudo : Alice (1), Bruno (2), Chloé (3), Eve (5), Fanny (6), Gaston (7), Hugo (8), Inès (9), Jules (10) ;
-- Denis (4) est anonyme ; Karl (11) n'a pas de pseudo.
insert into auth.users (id, email, is_anonymous)
  select ('00000000-0000-4000-8000-0000000006' || lpad(n::text, 2, '0'))::uuid, 's' || n || '@exemple.test', n = 4
  from generate_series(1, 11) n;
insert into public.profiles (id, username)
  select ('00000000-0000-4000-8000-0000000006' || lpad(n::text, 2, '0'))::uuid,
         (array['Alice', 'Bruno', 'Chloe', null, 'Eve', 'Fanny', 'Gaston', 'Hugo', 'Ines', 'Jules', null])[n]
  from generate_series(1, 11) n
  on conflict (id) do update set username = excluded.username;
\set alice '''00000000-0000-4000-8000-000000000601'''
\set bruno '''00000000-0000-4000-8000-000000000602'''
\set chloe '''00000000-0000-4000-8000-000000000603'''
\set denis '''00000000-0000-4000-8000-000000000604'''
\set eve '''00000000-0000-4000-8000-000000000605'''
\set fanny '''00000000-0000-4000-8000-000000000606'''
\set gaston '''00000000-0000-4000-8000-000000000607'''
\set hugo '''00000000-0000-4000-8000-000000000608'''
\set ines '''00000000-0000-4000-8000-000000000609'''
\set jules '''00000000-0000-4000-8000-000000000610'''
\set karl '''00000000-0000-4000-8000-000000000611'''
select count(*) as profils_avant from public.profiles \gset

-- 1. Signaler : compte avec pseudo exigé.
set local role anon;
select pg_temp.deconnecte();
select pg_temp.doit_refuser($$select public.signaler('bug', null, 'Ça plante')$$, '42501');
set local role authenticated;
select pg_temp.deconnecte();
select pg_temp.doit_refuser($$select public.signaler('bug', null, 'Ça plante')$$, 'JGC01');
select pg_temp.connecte(:denis, true);
select pg_temp.doit_refuser($$select public.signaler('bug', null, 'Ça plante')$$, 'JGC01');
select pg_temp.connecte(:karl);
select pg_temp.doit_refuser($$select public.signaler('bug', null, 'Ça plante')$$, 'JGP01');

-- 2. « Nous écrire » : bug, idée, autre ; texte obligatoire, 500 caractères au plus, pas de motif.
select pg_temp.connecte(:alice);
select pg_temp.egal(public.signaler('bug', null, '  Le plateau clignote.  ', p_version => 'abc1234', p_contexte => '{"ecran":"profil","langue":"fr"}'), true, 'bug envoyé');
select pg_temp.doit_refuser($$select public.signaler('bug', null, '   ')$$, 'JGS02');
select pg_temp.doit_refuser($$select public.signaler('idee', null, null)$$, 'JGS02');
select pg_temp.doit_refuser($$select public.signaler('autre', null, repeat('a', 501))$$, 'JGS02');
select pg_temp.egal(public.signaler('autre', null, repeat('a', 500)), true, '500 caractères : accepté');
select pg_temp.doit_refuser($$select public.signaler('bug', 'triche', 'Texte')$$, 'JGS02');
select pg_temp.doit_refuser($$select public.signaler('spam', null, 'Texte')$$, 'JGS02');
select pg_temp.doit_refuser($$select public.signaler(null, null, 'Texte')$$, 'JGS02');
-- Version mal formée et contexte trop gros : ignorés, le signalement passe.
select pg_temp.egal(public.signaler('idee', null, 'Un mode zen', p_version => 'v1 ; drop', p_contexte => jsonb_build_object('x', repeat('y', 3000))), true, 'idée envoyée');
reset role;
select pg_temp.egal((select texte || '|' || version_app || '|' || (contexte->>'ecran') || '|' || statut from public.signalements where auteur_id = :alice and type = 'bug'),
  'Le plateau clignote.|abc1234|profil|nouveau', 'bug enregistré : texte nettoyé, version, contexte, statut');
select pg_temp.egal((select version_app is null and contexte is null from public.signalements where auteur_id = :alice and type = 'idee'), true, 'version et contexte invalides : ignorés');

-- 3. « Cette réponse me semble fausse » : l'identifiant du problème arrive en base.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.signaler('probleme', 'reponse_fausse', null, p_probleme => 'ko-3'), true, 'problème signalé');
select pg_temp.doit_refuser($$select public.signaler('probleme', 'reponse_fausse', null, p_probleme => 'ko 3 ; x')$$, 'JGS02');
select pg_temp.doit_refuser($$select public.signaler('probleme', 'triche', null, p_probleme => 'ko-3')$$, 'JGS02');
select pg_temp.doit_refuser($$select public.signaler('probleme', null, null)$$, 'JGS02');
reset role;
select pg_temp.egal((select probleme_id || '/' || motif from public.signalements where auteur_id = :alice and type = 'probleme'), 'ko-3/reponse_fausse', 'problème : identifiant et motif');

-- 4. Signaler un joueur par son pseudo : motif obligatoire, pas soi-même, pseudo exact d'un vrai compte.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.signaler('joueur', 'triche', 'Joue trop vite et trop bien', p_pseudo => 'bruno'), true, 'Bruno signalé par Alice');
-- Une seconde fois dans les 24 heures : accepté, sans nouvelle ligne.
select pg_temp.egal(public.signaler('joueur', 'antijeu', null, p_pseudo => 'Bruno'), true, 'Bruno signalé de nouveau');
select pg_temp.doit_refuser($$select public.signaler('joueur', 'triche', null, p_pseudo => 'Alice')$$, 'JGS03');
select pg_temp.doit_refuser($$select public.signaler('joueur', 'triche', null, p_pseudo => 'Personne')$$, 'JGA01');
select pg_temp.doit_refuser($$select public.signaler('joueur', 'insulte', null, p_pseudo => 'Bruno')$$, 'JGS02');
select pg_temp.doit_refuser($$select public.signaler('joueur', null, null, p_pseudo => 'Bruno')$$, 'JGS02');
reset role;
select pg_temp.egal((select count(*) from public.signalements where auteur_id = :alice and cible_joueur_id = :bruno), 1::bigint, 'un seul signalement de Bruno par Alice');

-- 5. RLS : chacun ne lit que ses signalements ; personne n'écrit directement ; le joueur signalé ne voit rien.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal((select count(*) from public.signalements), 5::bigint, 'Alice lit ses 5 signalements');
select pg_temp.connecte(:bruno);
select pg_temp.egal((select count(*) from public.signalements), 0::bigint, 'Bruno (signalé) ne voit rien');
select pg_temp.doit_refuser($$insert into public.signalements (auteur_id, type, texte) values ('00000000-0000-4000-8000-000000000602', 'bug', 'x')$$, '42501');
select pg_temp.doit_refuser($$update public.signalements set statut = 'traite'$$, '42501');
select pg_temp.doit_refuser($$delete from public.signalements$$, '42501');
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser($$update public.signalements set texte = 'changé' where auteur_id = auth.uid()$$, '42501');
set local role anon;
select pg_temp.doit_refuser($$select count(*) from public.signalements$$, '42501');
reset role;

-- 6. Vue serveur : un joueur signalé par deux comptes différents est marqué pour revue.
select pg_temp.egal((select count(*) from public.signalements_a_revoir where cible_joueur_id = :bruno), 0::bigint, 'un seul auteur : pas encore à revoir');
set local role authenticated;
select pg_temp.connecte(:chloe);
select pg_temp.egal(public.signaler('joueur', 'pseudo', null, p_pseudo => 'Bruno'), true, 'Bruno signalé par Chloé');
select pg_temp.doit_refuser($$select count(*) from public.signalements_a_revoir$$, '42501');
reset role;
select pg_temp.egal((select pseudo || '/' || auteurs || '/' || signalements from public.signalements_a_revoir where cible_joueur_id = :bruno),
  'Bruno/2/2', 'deux comptes différents : Bruno à revoir');
update public.signalements set statut = 'traite', traite_le = now() where cible_joueur_id = :bruno;
select pg_temp.egal((select count(*) from public.signalements_a_revoir where cible_joueur_id = :bruno), 0::bigint, 'traité : plus à revoir');

-- 7. Limite : 10 signalements par 24 heures et par compte.
set local role authenticated;
select pg_temp.connecte(:eve);
select pg_temp.egal((select bool_and(public.signaler('bug', null, 'Bug n° ' || i)) from generate_series(1, 10) i), true, '10 signalements acceptés');
select pg_temp.doit_refuser($$select public.signaler('bug', null, 'Un de trop')$$, 'JGS01');
reset role;
update public.signalements set cree_le = now() - interval '25 hours' where auteur_id = :eve;
set local role authenticated;
select pg_temp.egal(public.signaler('bug', null, 'Le lendemain'), true, '24 heures plus tard : de nouveau permis');
reset role;

-- 8. Signaler l'adversaire depuis une partie (défi entre amis Alice–Chloé) : la cible vient du serveur.
set local role authenticated;
select pg_temp.connecte(:alice);
select public.demander_ami('Chloe');
select pg_temp.connecte(:chloe);
select public.repondre_ami('Alice', true);
select pg_temp.connecte(:alice);
select public.defier_ami('Chloe') as pac \gset
select pg_temp.connecte(:chloe);
select pg_temp.egal(public.signaler('joueur', 'abandon', null, p_partie => :'pac'), true, 'Chloé signale son adversaire');
select pg_temp.connecte(:fanny);
select pg_temp.doit_refuser(format($$select public.signaler('joueur', 'triche', null, p_partie => %L)$$, :'pac'), 'P0002');
reset role;
select pg_temp.egal((select cible_joueur_id = :alice and partie_id = :'pac' from public.signalements where auteur_id = :chloe and type = 'joueur' and partie_id is not null),
  true, 'cible : Alice, partie gardée');

-- 9. Bloquer : ni demande d'ami, ni défi (direct ou par lien), ni appariement en direct, dans un sens comme dans l'autre.
set local role authenticated;
select pg_temp.connecte(:hugo);
select pg_temp.egal(public.bloquer_joueur('ines'), true, 'Hugo bloque Inès');
select pg_temp.egal(public.bloquer_joueur('Ines'), true, 'bloquer deux fois : sans effet');
select pg_temp.egal((select string_agg(pseudo, ',') from public.mes_blocages()), 'Ines', 'Hugo voit Inès dans ses blocages');
select pg_temp.doit_refuser($$select public.bloquer_joueur('Hugo')$$, 'JGB02');
select pg_temp.doit_refuser($$select public.bloquer_joueur('Personne')$$, 'JGA01');
select pg_temp.doit_refuser($$insert into public.blocages (bloqueur_id, bloque_id) values ('00000000-0000-4000-8000-000000000608', '00000000-0000-4000-8000-000000000601')$$, '42501');
select pg_temp.doit_refuser($$delete from public.blocages$$, '42501');
select pg_temp.connecte(:ines);
-- Inès ne voit ni le blocage, ni rien dans ses propres blocages.
select pg_temp.egal((select count(*) from public.blocages), 0::bigint, 'Inès ne lit pas le blocage d''Hugo');
select pg_temp.egal((select count(*) from public.mes_blocages()), 0::bigint, 'Inès n''a bloqué personne');
select pg_temp.doit_refuser($$select public.demander_ami('Hugo')$$, 'JGB01');
select pg_temp.connecte(:hugo);
select pg_temp.doit_refuser($$select public.demander_ami('Ines')$$, 'JGB01');
-- Défi par lien : Inès ne peut pas rejoindre le lien d'Hugo.
select partie_id as pdl, jeton as jdl from public.creer_defi() \gset
select pg_temp.connecte(:ines);
select pg_temp.doit_refuser(format($$select public.rejoindre_defi(%L)$$, :'jdl'), 'JGB01');
reset role;
select pg_temp.egal((select status || '/' || coalesce(black_id::text, '-') from public.games where id = :'pdl'), 'waiting/-', 'le défi attend toujours');
select pg_temp.egal((select invite_id is null from public.defis where partie_id = :'pdl'), true, 'personne n''a rejoint');
-- Défi direct : bloquer un ami retire le lien d'amitié, et le défi direct n'est plus possible.
set local role authenticated;
select pg_temp.connecte(:gaston);
select public.demander_ami('Jules');
select pg_temp.connecte(:jules);
select public.repondre_ami('Gaston', true);
select pg_temp.egal(public.bloquer_joueur('Gaston'), true, 'Jules bloque son ami Gaston');
reset role;
select pg_temp.egal((select count(*) from public.friendships where :gaston in (requester_id, addressee_id) and :jules in (requester_id, addressee_id)), 0::bigint, 'lien d''amitié retiré');
set local role authenticated;
select pg_temp.connecte(:gaston);
select pg_temp.doit_refuser($$select public.defier_ami('Jules')$$, 'JGA08');
reset role;
-- Le déclencheur garde aussi un défi direct écrit autrement (défense en profondeur).
select pg_temp.doit_refuser(format($$insert into public.defis (partie_id, jeton, createur_id, invite_id) values (%L, %L, %L, %L)$$,
  :'pac', repeat('Z', 32), :gaston, :jules), 'JGB01');
-- Appariement : Hugo et Inès attendent avec les mêmes réglages et la même cote, mais ne sont jamais appariés.
set local role authenticated;
select pg_temp.connecte(:hugo);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Hugo attend');
reset role;
update public.match_queue set created_at = now() - interval '5 seconds' where user_id = :hugo;
set local role authenticated;
select pg_temp.connecte(:ines);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Inès attend aussi : pas appariée avec Hugo');
reset role;
-- Même après 2 minutes d'attente (écart de cote très large) : jamais.
update public.match_queue set created_at = now() - interval '120 seconds', vu_le = now() where user_id in (:hugo, :ines);
set local role authenticated;
select pg_temp.connecte(:hugo);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Hugo attend toujours');
reset role;
update public.match_queue set created_at = now() - interval '6 seconds' where user_id = :hugo;
update public.match_queue set created_at = now() - interval '5 seconds' where user_id = :ines;
-- Jules arrive : il est apparié avec Hugo (le plus ancien) ; Inès reste dans la file.
set local role authenticated;
select pg_temp.connecte(:jules);
select public.find_match(9::smallint) as pd \gset
reset role;
select pg_temp.egal((select array[least(black_id, white_id), greatest(black_id, white_id)]::text from public.games where id = :'pd'),
  array[least(:hugo::uuid, :jules::uuid), greatest(:hugo::uuid, :jules::uuid)]::text, 'Jules joue contre Hugo');
select pg_temp.egal((select count(*) from public.match_queue where user_id = :ines), 1::bigint, 'Inès attend encore');
-- File lente (#440) : Hugo et Inès cherchent une partie lente avec les mêmes réglages ; jamais appariés.
set local role authenticated;
select pg_temp.connecte(:hugo);
select pg_temp.egal(public.chercher_partie_lente(9::smallint, 1::smallint), null::uuid, 'Hugo attend une partie lente');
select pg_temp.connecte(:ines);
select pg_temp.egal(public.chercher_partie_lente(9::smallint, 1::smallint), null::uuid, 'Inès aussi : pas appariée avec Hugo');
reset role;
select pg_temp.egal((select count(*) from public.file_lente where user_id in (:hugo, :ines) and partie_id is null), 2::bigint, 'les deux attendent');
-- La tâche planifiée ne les apparie pas non plus (et n'échoue pas sur le déclencheur de blocage).
select pg_temp.egal((select creees from public.lentes_tache()), 0, 'tâche lente : aucune partie entre eux');
delete from public.file_lente where user_id in (:hugo, :ines);
-- Débloquer : tout redevient possible.
set local role authenticated;
select pg_temp.connecte(:hugo);
select pg_temp.egal(public.debloquer_joueur('INES'), true, 'Hugo débloque Inès');
select pg_temp.egal(public.debloquer_joueur('Ines'), false, 'débloquer deux fois : rien à faire');
select pg_temp.connecte(:ines);
select pg_temp.egal(public.demander_ami('Hugo'), 'envoyee', 'Inès peut de nouveau demander Hugo en ami');
reset role;

-- 10. Messages en partie : codes seulement, les deux joueurs, 10 par partie et par joueur, 3 s entre deux.
set local role authenticated;
select pg_temp.connecte(:bruno);
select public.demander_ami('Eve');
select pg_temp.connecte(:eve);
select public.repondre_ami('Bruno', true);
select pg_temp.connecte(:bruno);
select public.defier_ami('Eve') as pm \gset
select pg_temp.egal(public.dire_en_partie(:'pm', 'bien_joue'), true, 'Bruno : « Bien joué »');
select pg_temp.doit_refuser(format($$select public.dire_en_partie(%L, 'merci')$$, :'pm'), 'JGM03');
select pg_temp.doit_refuser(format($$select public.dire_en_partie(%L, 'Tu es nul')$$, :'pm'), 'JGM02');
select pg_temp.doit_refuser(format($$select public.dire_en_partie(%L, null)$$, :'pm'), 'JGM02');
select pg_temp.doit_refuser($$insert into public.messages_partie (partie_id, auteur_id, code) values (gen_random_uuid(), auth.uid(), 'merci')$$, '42501');
select pg_temp.connecte(:eve);
select pg_temp.egal((select string_agg(code, ',') from public.messages_partie where partie_id = :'pm'), 'bien_joue', 'Eve lit le message de Bruno');
select pg_temp.connecte(:fanny);
select pg_temp.egal((select count(*) from public.messages_partie), 0::bigint, 'Fanny ne lit rien');
select pg_temp.doit_refuser(format($$select public.dire_en_partie(%L, 'merci')$$, :'pm'), 'P0002');
set local role anon;
select pg_temp.deconnecte();
select pg_temp.doit_refuser(format($$select public.dire_en_partie(%L, 'merci')$$, :'pm'), '42501');
reset role;
-- 9 messages plus anciens (10 en tout) : le 11e est refusé par le serveur.
update public.messages_partie set envoye_le = now() - interval '1 minute' where partie_id = :'pm';
insert into public.messages_partie (partie_id, auteur_id, code, envoye_le)
  select :'pm', :bruno, 'merci', now() - interval '1 minute' from generate_series(1, 9);
set local role authenticated;
select pg_temp.connecte(:bruno);
select pg_temp.doit_refuser(format($$select public.dire_en_partie(%L, 'merci')$$, :'pm'), 'JGM01');
-- Eve, elle, peut encore parler (la limite est par joueur).
select pg_temp.connecte(:eve);
select pg_temp.egal(public.dire_en_partie(:'pm', 'mochi_content'), true, 'Eve : émote de Mochi');
reset role;
-- Partie finie depuis plus de 10 minutes : plus de message. Finie depuis peu : « À la prochaine » passe.
set local session_replication_role = replica;
update public.games set status = 'finished', result = 'B+R', updated_at = now() - interval '11 minutes' where id = :'pac';
set local session_replication_role = origin;
set local role authenticated;
select pg_temp.connecte(:chloe);
select pg_temp.doit_refuser(format($$select public.dire_en_partie(%L, 'a_la_prochaine')$$, :'pac'), 'JGM04');
reset role;
set local session_replication_role = replica;
update public.games set updated_at = now() - interval '2 minutes' where id = :'pac';
set local session_replication_role = origin;
set local role authenticated;
select pg_temp.connecte(:chloe);
select pg_temp.egal(public.dire_en_partie(:'pac', 'a_la_prochaine'), true, 'finie depuis 2 minutes : message permis');
-- Alice bloque Chloé depuis la partie : les messages de Chloé ne lui parviennent plus.
select pg_temp.connecte(:alice);
select pg_temp.egal((select count(*) from public.messages_partie where partie_id = :'pac'), 1::bigint, 'Alice lit le message de Chloé');
select pg_temp.egal(public.bloquer_joueur(p_partie => :'pac'), true, 'Alice bloque son adversaire depuis la partie');
select pg_temp.egal((select count(*) from public.messages_partie where partie_id = :'pac'), 0::bigint, 'bloquée : ses messages disparaissent');
reset role;
update public.messages_partie set envoye_le = now() - interval '1 minute' where partie_id = :'pac';
set local role authenticated;
select pg_temp.connecte(:chloe);
select pg_temp.egal(public.dire_en_partie(:'pac', 'merci'), true, 'Chloé bloquée : réponse normale, sans le dire');
select pg_temp.egal((select count(*) from public.messages_partie where partie_id = :'pac'), 1::bigint, 'rien de nouveau écrit');
select pg_temp.egal(public.dire_en_partie(:'pac', 'merci'), true, 'pas de limite de 3 s révélée non plus');
reset role;
select pg_temp.egal((select bloque_id from public.blocages where bloqueur_id = :alice), :chloe::uuid, 'blocage par partie : l''adversaire');

-- 11. Tâche planifiée : partie en direct dont les deux joueurs sont partis (Hugo–Jules, partie :pd).
select black_id as noird, white_id as blancd from public.games where id = :'pd' \gset
set local role service_role;
select pg_temp.jouer(:'pd', 'ee');
select pg_temp.jouer(:'pd', 'cc');
reset role;
-- Un joueur encore là (vu il y a 5 s) : la tâche ne touche à rien, c'est lui qui constatera.
update public.parties_direct set trait_depuis = now() - interval '90 seconds', noir_vu_le = now() - interval '90 seconds', blanc_vu_le = now() - interval '5 seconds' where partie_id = :'pd';
select pg_temp.egal(public.direct_clore_abandonnees(), 0, 'un joueur présent : rien');
select pg_temp.egal((select status from public.games where id = :'pd'), 'active', 'la partie continue');
-- Les deux partis depuis plus de 60 s : Noir, au trait, perd au temps ; la cote bouge une fois.
update public.parties_direct set blanc_vu_le = now() - interval '70 seconds' where partie_id = :'pd';
select pg_temp.egal(public.direct_clore_abandonnees(), 1, 'une partie close');
select pg_temp.egal((select status || '/' || result from public.games where id = :'pd'), 'finished/W+T', 'Noir absent au trait : Blanc gagne');
select pg_temp.egal((select count(*) from public.rating_history where game_id = :'pd' and kind = 'game'), 2::bigint, 'cote comptée une fois');
select pg_temp.egal(public.direct_clore_abandonnees(), 0, 'deuxième passage : rien');
-- Avant que chacun ait joué : partie annulée, aucune cote (Inès contre Fanny).
set local role authenticated;
select pg_temp.connecte(:fanny);
select public.find_match(9::smallint) as pa \gset
reset role;
update public.parties_direct set trait_depuis = now() - interval '70 seconds', noir_vu_le = now() - interval '70 seconds', blanc_vu_le = now() - interval '70 seconds' where partie_id = :'pa';
select pg_temp.egal(public.direct_clore_abandonnees(), 1, 'partie sans coup close');
select pg_temp.egal((select status from public.games where id = :'pa'), 'aborted', 'personne n''a joué : annulée');
select pg_temp.egal((select count(*) from public.rating_history where game_id = :'pa'), 0::bigint, 'annulée : aucune cote');
-- Comptage abandonné par les deux : celui qui est parti le premier perd (Gaston contre Hugo).
set local role authenticated;
select pg_temp.connecte(:gaston);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Gaston attend');
select pg_temp.connecte(:hugo);
select public.find_match(9::smallint) as pc \gset
reset role;
select black_id as noirc, white_id as blancc from public.games where id = :'pc' \gset
set local role service_role;
select pg_temp.jouer(:'pc', 'ee');
select pg_temp.jouer(:'pc', 'cc');
select pg_temp.jouer(:'pc', 'tt');
update public.games set moves = moves || 'tt', counting = true where id = :'pc';
reset role;
update public.parties_direct set comptage_depuis = now() - interval '5 minutes', noir_vu_le = now() - interval '4 minutes', blanc_vu_le = now() - interval '3 minutes' where partie_id = :'pc';
select pg_temp.egal(public.direct_clore_abandonnees(), 1, 'comptage abandonné : clos');
select pg_temp.egal((select result from public.games where id = :'pc'), 'W+T', 'Noir parti le premier : Blanc gagne');
-- Fermée à l'app.
set local role authenticated;
select pg_temp.connecte(:hugo);
select pg_temp.doit_refuser($$select public.direct_clore_abandonnees()$$, '42501');
select pg_temp.doit_refuser($$select public.purger_securite()$$, '42501');
select pg_temp.doit_refuser($$select public.est_bloque(auth.uid(), auth.uid())$$, '42501');
reset role;

-- 12. Purge de rétention : signalements de plus de 12 mois, messages de plus de 30 jours.
update public.signalements set cree_le = now() - interval '13 months' where auteur_id = :eve;
update public.messages_partie set envoye_le = now() - interval '31 days' where partie_id = :'pm' and code = 'mochi_content';
select count(*) as signalements_avant from public.signalements \gset
select public.purger_securite();
select pg_temp.egal((select count(*) from public.signalements where auteur_id = :eve), 0::bigint, 'signalements de 13 mois effacés');
select pg_temp.egal((select count(*) from public.signalements), (:signalements_avant - 11)::bigint, 'les autres restent');
select pg_temp.egal((select count(*) from public.messages_partie where partie_id = :'pm'), 10::bigint, 'messages de 31 jours effacés, les autres restent');

-- 13. Compte supprimé : ses blocages partent, ses signalements restent sans auteur ; le joueur signalé supprimé : la
--     cible devient vide, le signalement reste.
set local role authenticated;
select pg_temp.connecte(:alice);
select public.delete_my_account();
reset role;
select pg_temp.egal((select count(*) from public.blocages where :alice in (bloqueur_id, bloque_id)), 0::bigint, 'blocages effacés avec le compte');
select pg_temp.egal((select count(*) from public.signalements where auteur_id is null and type = 'probleme' and probleme_id = 'ko-3'), 1::bigint, 'signalement gardé, sans auteur');
select pg_temp.egal((select count(*) from public.signalements where partie_id = :'pac' and cible_joueur_id is null), 1::bigint, 'cible effacée, signalement gardé');

-- 14. Structure : RLS, droits, search_path, temps réel, aucune donnée supprimée.
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');
select pg_temp.egal(has_table_privilege('authenticated', 'public.signalements', 'insert') or has_table_privilege('authenticated', 'public.signalements', 'update')
  or has_table_privilege('authenticated', 'public.signalements', 'delete') or has_table_privilege('authenticated', 'public.blocages', 'insert')
  or has_table_privilege('authenticated', 'public.blocages', 'delete') or has_table_privilege('authenticated', 'public.messages_partie', 'insert')
  or has_table_privilege('authenticated', 'public.messages_partie', 'update'), false, 'aucune écriture directe');
select pg_temp.egal(has_table_privilege('anon', 'public.signalements', 'select') or has_table_privilege('anon', 'public.blocages', 'select')
  or has_table_privilege('anon', 'public.messages_partie', 'select'), false, 'anon : rien');
select pg_temp.egal(has_table_privilege('authenticated', 'public.signalements_a_revoir', 'select'), false, 'vue fermée à l''app');
select pg_temp.egal((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('signaler', 'bloquer_joueur', 'debloquer_joueur', 'mes_blocages', 'est_bloque',
    'dire_en_partie', 'defis_blocage', 'friendships_blocage', 'find_match', 'purger_securite', 'direct_clore_abandonnees')),
  true, 'security definer, search_path vide');
select pg_temp.egal((select p.proconfig @> array['search_path=""'] and not has_function_privilege('authenticated', p.oid, 'execute')
  from pg_proc p where p.oid = 'public.lente_apparier(uuid, boolean)'::regprocedure), true, 'lente_apparier : interne, search_path vide');
select pg_temp.egal((select string_agg(p.proname, ',' order by p.proname) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('signaler', 'bloquer_joueur', 'debloquer_joueur', 'mes_blocages', 'est_bloque',
    'dire_en_partie', 'defis_blocage', 'friendships_blocage', 'purger_securite', 'direct_clore_abandonnees')
    and has_function_privilege('authenticated', p.oid, 'execute')),
  'bloquer_joueur,debloquer_joueur,dire_en_partie,mes_blocages,signaler', 'droits des fonctions');
select pg_temp.egal((select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('signaler', 'bloquer_joueur', 'debloquer_joueur', 'mes_blocages', 'est_bloque',
    'dire_en_partie', 'purger_securite', 'direct_clore_abandonnees')), false, 'anon : aucune fonction');
select pg_temp.egal((select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages_partie'), 1::bigint, 'messages publiés en temps réel');
select pg_temp.egal((select count(*) from public.profiles), (:profils_avant - 1)::bigint, 'seul le compte supprimé par le test manque');

\o
\echo 'securite_signalements : tous les cas passent.'
\o /dev/null
rollback;
