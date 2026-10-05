-- Tests rejouables des parties lentes classées (issue #440) : file lente, appariement par la cote, délai de 1 à 3 jours
-- par coup, perte au temps décidée par le serveur (lecture, coup suivant, tâche planifiée), cote comptée une fois,
-- 10 parties en cours au plus, défis entre amis inchangés.
-- Transaction annulée à la fin : aucune donnée ne reste. Voir supabase/tests/LISEZMOI.md.
-- Le temps : now() est fixe dans une transaction ; le test recule les dates (created_at, date_limite).
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
  if sqlerrm not ilike '%' || p_motif || '%' and sqlstate <> p_motif then
    raise exception 'Mauvais refus pour « % » : % « % » (attendu : « % »)', p_sql, sqlstate, sqlerrm, p_motif;
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
create function pg_temp.etat(p_partie uuid) returns text
language sql as $$
  select status || ':' || coalesce(result, '-') || ':' || moves from public.games where id = p_partie;
$$;
-- Coup tel que l'écrit la fonction serveur game-action (clé service) : jouer_coup_defi, après les règles du go.
create function pg_temp.jouer(p_partie uuid, p_coup text, p_comptage boolean default false) returns text
language sql as $$
  select public.jouer_coup_defi(p_partie,
    (select case when (char_length(moves) / 2) % 2 = 0 then black_id else white_id end from public.games where id = p_partie),
    (select moves from public.games where id = p_partie), p_coup, p_comptage)::text;
$$;
-- Tâche planifiée : lancée par pg_cron (rôle postgres), sans jeton de joueur.
create function pg_temp.tache() returns table (finies integer, creees integer)
language sql as $$
  select set_config('request.jwt.claims', '{}', true);
  select * from public.lentes_tache();
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Comptes avec pseudo : 1 à 9 ; 10 anonyme ; 11 sans pseudo.
insert into auth.users (id, email, is_anonymous)
  select ('00000000-0000-4000-8000-0000000004' || lpad(n::text, 2, '0'))::uuid, 'l' || n || '@exemple.test', n = 10
  from generate_series(1, 11) n;
insert into public.profiles (id, username)
  select ('00000000-0000-4000-8000-0000000004' || lpad(n::text, 2, '0'))::uuid, case when n not in (10, 11) then 'lente' || n end
  from generate_series(1, 11) n
  on conflict (id) do update set username = excluded.username;
\set alice '''00000000-0000-4000-8000-000000000401'''
\set bruno '''00000000-0000-4000-8000-000000000402'''
\set chloe '''00000000-0000-4000-8000-000000000403'''
\set dora '''00000000-0000-4000-8000-000000000404'''
\set eve '''00000000-0000-4000-8000-000000000405'''
\set fanny '''00000000-0000-4000-8000-000000000406'''
\set gaston '''00000000-0000-4000-8000-000000000407'''
\set hugo '''00000000-0000-4000-8000-000000000408'''
\set ines '''00000000-0000-4000-8000-000000000409'''
\set dan '''00000000-0000-4000-8000-000000000410'''
\set karl '''00000000-0000-4000-8000-000000000411'''
select count(*) as parties_avant from public.games \gset
select count(*) as profils_avant from public.profiles \gset

-- 1. Accès : compte avec pseudo exigé ; taille et délai vérifiés ; anon fermé.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select pg_temp.doit_refuser('select public.chercher_partie_lente()', 'JGC01');
select pg_temp.doit_refuser('select public.quitter_file_lente()', '42501');
select pg_temp.connecte(:dan, true);
select pg_temp.doit_refuser('select public.chercher_partie_lente()', 'JGC01');
select pg_temp.connecte(:karl);
select pg_temp.doit_refuser('select public.chercher_partie_lente()', 'JGP01');
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser('select public.chercher_partie_lente(10::smallint)', '22023');
select pg_temp.doit_refuser('select public.chercher_partie_lente(9::smallint, 0::smallint)', '22023');
select pg_temp.doit_refuser('select public.chercher_partie_lente(9::smallint, 4::smallint)', '22023');
reset role;
set local role anon;
select pg_temp.doit_refuser('select public.chercher_partie_lente()', 'permission denied');
select pg_temp.doit_refuser('select count(*) from public.file_lente', 'permission denied');
reset role;

-- 2. Alice cherche (9 × 9, 1 jour par coup, valeurs par défaut) : personne, elle attend. Rappeler garde son ancienneté.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.chercher_partie_lente(), null::uuid, 'Alice attend');
select pg_temp.egal((select size || '/' || delai_jours || '/' || rating || '/' || coalesce(partie_id::text, '-') from public.file_lente), '9/1/800/-', 'Alice voit sa recherche');
reset role;
update public.file_lente set created_at = now() - interval '20 minutes' where user_id = :alice;
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.chercher_partie_lente(9::smallint, 1::smallint), null::uuid, 'Alice attend toujours');
reset role;
select pg_temp.egal((select created_at = now() - interval '20 minutes' from public.file_lente where user_id = :alice), true, 'ancienneté gardée');
-- Recherche privée, aucune écriture directe.
set local role authenticated;
select pg_temp.connecte(:bruno);
select pg_temp.egal((select count(*) from public.file_lente), 0::bigint, 'la recherche des autres est invisible');
select pg_temp.doit_refuser(format('insert into public.file_lente (user_id, size, delai_jours, rating) values (%L, 9, 1, 800)', :bruno), 'permission denied');
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser(format('update public.file_lente set rating = 3000 where user_id = %L', :alice), 'permission denied');
select pg_temp.doit_refuser(format('delete from public.file_lente where user_id = %L', :alice), 'permission denied');
reset role;
select pg_temp.egal((select rating from public.file_lente where user_id = :alice), 800, 'aucune écriture directe');

-- 3. Bruno veut du 13 × 13 : réglages différents, moins d'une heure d'attente, pas d'appariement.
set local role authenticated;
select pg_temp.connecte(:bruno);
select pg_temp.egal(public.chercher_partie_lente(13::smallint, 1::smallint), null::uuid, 'Bruno attend en 13 × 13');
reset role;

-- 4. Chloé demande comme Alice : la partie lente classée est créée tout de suite.
set local role authenticated;
select pg_temp.connecte(:chloe);
select public.chercher_partie_lente(9::smallint, 1::smallint) as p1 \gset
reset role;
select pg_temp.egal(:'p1' is not null, true, 'Chloé trouve Alice');
select pg_temp.egal((select (rated, komi, handicap, rules, status::text, size, bot_id is null, prive)
  from public.games where id = :'p1'), row(true, 6.5::numeric(4,1), 0::smallint, 'japanese'::text, 'active'::text, 9::smallint, true, true), 'partie classée standard, jamais d''IA');
select pg_temp.egal((select array[least(black_id, white_id), greatest(black_id, white_id)]::text from public.games where id = :'p1'),
  array[least(:alice::uuid, :chloe::uuid), greatest(:alice::uuid, :chloe::uuid)]::text, 'Alice contre Chloé');
select pg_temp.egal((select delai_coup = interval '1 day' and date_limite = now() + interval '1 day' and lien_expire_le <= now()
  from public.defis where partie_id = :'p1'), true, '1 jour pour le premier coup, aucun lien utilisable');
select pg_temp.egal((select count(*) from public.file_lente where user_id = :chloe), 0::bigint, 'Chloé, présente, sort de la file');
select pg_temp.egal((select partie_id from public.file_lente where user_id = :alice), :'p1'::uuid, 'Alice, absente, est prévenue par sa ligne');
select black_id as noir1, white_id as blanc1 from public.games where id = :'p1' \gset
-- Noir est prévenu (« À toi de jouer ») s'il n'est pas devant l'écran.
select pg_temp.egal((select count(*) from public.notifications where partie_id = :'p1' and type = 'tour' and lue_le is null),
  case when :'noir1'::uuid = :alice::uuid then 1::bigint else 0::bigint end, 'notification de Noir absent');

-- 5. Alice voit « adversaire trouvé », l'ouvre : sa ligne est effacée. Un tiers ne lit ni le défi ni la partie.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal((select partie_id from public.file_lente), :'p1'::uuid, 'Alice lit la partie trouvée');
select pg_temp.egal(public.quitter_file_lente(), :'p1'::uuid, 'la partie trouvée est rendue');
select pg_temp.egal(public.quitter_file_lente(), null::uuid, 'plus rien dans la file');
select pg_temp.connecte(:dora);
select pg_temp.egal((select count(*) from public.games where id = :'p1'), 0::bigint, 'partie privée : un tiers ne la lit pas');
select pg_temp.doit_refuser(format('select public.victoire_au_temps(%L)', :'p1'), 'introuvable');
reset role;

-- 6. Coups (game-action → jouer_coup_defi, clé service) : chaque coup relance le délai d'un jour.
update public.defis set date_limite = now() + interval '2 hours' where partie_id = :'p1';
set local role service_role;
select pg_temp.egal(pg_temp.jouer(:'p1', 'ee')::jsonb ->> 'coups', 'ee', 'Noir joue');
reset role;
select pg_temp.egal((select date_limite from public.defis where partie_id = :'p1'), now() + interval '1 day', 'délai relancé : 1 jour');
set local role service_role;
select pg_temp.jouer(:'p1', 'cc');
select pg_temp.doit_refuser(format('update public.games set moves = moves || ''gg'' where id = %L', :'p1'), 'fonction serveur');
reset role;

-- 7. Les deux mêmes joueurs ne sont pas appariés une seconde fois tant que leur partie lente continue.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.chercher_partie_lente(), null::uuid, 'Alice cherche une deuxième partie');
select pg_temp.connecte(:chloe);
select pg_temp.egal(public.chercher_partie_lente(), null::uuid, 'Chloé aussi, mais pas contre Alice');
select pg_temp.egal(public.quitter_file_lente(), null::uuid, 'Chloé annule sa recherche');
select pg_temp.connecte(:alice);
select pg_temp.egal(public.quitter_file_lente(), null::uuid, 'Alice aussi');
reset role;
select pg_temp.egal((select count(*) from public.file_lente where user_id = :chloe), 0::bigint, 'recherche annulée');

-- 8. Perte au temps décidée par le serveur, sans que personne ouvre la partie : la tâche planifiée la constate.
--    Noir (au trait) laisse passer son jour ; Blanc gagne, la cote des deux bouge une fois (962 / 638, comme #417).
update public.defis set date_limite = now() - interval '1 minute' where partie_id = :'p1';
select pg_temp.egal((select finies from pg_temp.tache()), 1, 'la tâche finit une partie');
select pg_temp.egal(pg_temp.etat(:'p1'), 'finished:W+T:eecc', 'Blanc gagne au temps');
select pg_temp.egal((select string_agg(ecart::text, ',' order by ecart) from public.rating_history where game_id = :'p1' and kind = 'game'), '-162,162', 'cote : +162 / −162');
select pg_temp.egal((select rating from public.profiles where id = :'blanc1'), 962, 'Blanc 962');
select pg_temp.egal((select finies from pg_temp.tache()), 0, 'rien ne recompte');
set local role authenticated;
select pg_temp.connecte(:'noir1');
select pg_temp.egal(public.victoire_au_temps(:'p1'), 'W+T', 'résultat lu');
select pg_temp.doit_refuser(format('select public.resign_game(%L)', :'p1'), 'pas en cours');
reset role;
select pg_temp.egal((select count(*) from public.rating_history where game_id = :'p1'), 2::bigint, 'la cote a bougé une seule fois');
select pg_temp.egal((select count(*) from public.notifications where partie_id = :'p1' and type = 'fin'), 2::bigint, 'les deux joueurs sont prévenus de la fin');

-- 9. Réglages élargis après 1 heure : Bruno (13 × 13, 1 jour) attend depuis 2 heures ; Éve demande du 9 × 9 en
--    3 jours : la partie prend les réglages de Bruno, qui attendait le plus.
update public.file_lente set created_at = now() - interval '2 hours' where user_id = :bruno;
set local role authenticated;
select pg_temp.connecte(:eve);
select public.chercher_partie_lente(9::smallint, 3::smallint) as p2 \gset
reset role;
select pg_temp.egal((select g.size::int || '/' || extract(day from d.delai_coup)::int from public.games g join public.defis d on d.partie_id = g.id where g.id = :'p2'),
  '13/1', 'réglages de qui attendait le plus');

-- 10. Coup joué trop tard (constat au coup) : refusé, perte au temps enregistrée et comptée.
set local role service_role;
select pg_temp.jouer(:'p2', 'dd');
select pg_temp.jouer(:'p2', 'jj');
reset role;
select black_id as noir2, white_id as blanc2 from public.games where id = :'p2' \gset
update public.defis set date_limite = now() - interval '1 second' where partie_id = :'p2';
set local role service_role;
select pg_temp.egal(pg_temp.jouer(:'p2', 'gg')::jsonb ->> 'resultat', 'W+T', 'coup trop tard : perte au temps');
reset role;
select pg_temp.egal(pg_temp.etat(:'p2'), 'finished:W+T:ddjj', 'le coup tardif n''est pas joué');
select pg_temp.egal((select count(*) from public.rating_history where game_id = :'p2' and kind = 'game'), 2::bigint, 'cote comptée');

-- 11. Personne n'a vraiment joué (moins d'un coup chacun) : partie annulée, aucune cote (Fanny contre Gaston).
set local role authenticated;
select pg_temp.connecte(:fanny);
select pg_temp.egal(public.chercher_partie_lente(19::smallint, 2::smallint), null::uuid, 'Fanny attend en 19 × 19, 2 jours');
select pg_temp.connecte(:gaston);
select public.chercher_partie_lente(19::smallint, 2::smallint) as p3 \gset
reset role;
select pg_temp.egal((select date_limite from public.defis where partie_id = :'p3'), now() + interval '2 days', '2 jours par coup');
set local role service_role;
select pg_temp.jouer(:'p3', 'dd');
reset role;
update public.defis set date_limite = now() - interval '1 minute' where partie_id = :'p3';
set local role authenticated;
select pg_temp.connecte(:fanny);
select pg_temp.egal(public.victoire_au_temps(:'p3'), null::text, 'partie annulée : pas de résultat');
reset role;
select pg_temp.egal((select status::text from public.games where id = :'p3'), 'aborted', 'statut annulé');
select pg_temp.egal((select count(*) from public.rating_history where game_id = :'p3'), 0::bigint, 'aucune cote');

-- 12. Comptage d'une partie lente : le délai continue et porte sur qui doit répondre (Hugo contre Inès).
set local role authenticated;
select pg_temp.connecte(:hugo);
select pg_temp.egal(public.chercher_partie_lente(), null::uuid, 'Hugo attend');
select pg_temp.connecte(:ines);
select public.chercher_partie_lente() as p4 \gset
reset role;
select black_id as noir4, white_id as blanc4 from public.games where id = :'p4' \gset
set local role service_role;
select pg_temp.jouer(:'p4', 'ee');
select pg_temp.jouer(:'p4', 'cc');
select pg_temp.jouer(:'p4', 'tt');
select pg_temp.jouer(:'p4', 'tt', true);
-- Noir propose les pierres mortes (game-action, écriture conditionnelle) : le délai repart, c'est à Blanc de répondre.
update public.defis set date_limite = now() + interval '1 hour' where partie_id = :'p4';
update public.games set dead_stones = '', dead_proposed_by = :'noir4' where id = :'p4';
reset role;
select pg_temp.egal((select date_limite from public.defis where partie_id = :'p4'), now() + interval '1 day', 'proposition : délai relancé');
update public.defis set date_limite = now() - interval '1 minute' where partie_id = :'p4';
select pg_temp.egal((select finies from pg_temp.tache()), 1, 'Blanc n''a pas répondu à temps');
select pg_temp.egal(pg_temp.etat(:'p4'), 'finished:B+T:eecctttt', 'Noir gagne au temps pendant le comptage');
select pg_temp.egal((select counting from public.games where id = :'p4'), false, 'comptage fermé');

-- 13. Cotes éloignées : appariées seulement après une longue attente, par la tâche planifiée (les deux sont absents).
update public.profiles set rating = 2000, cote_rd = 60 where id = :dora;
update public.profiles set rating = 800, cote_rd = 350 where id = :hugo;
set local role authenticated;
select pg_temp.connecte(:dora);
select pg_temp.egal(public.chercher_partie_lente(), null::uuid, 'Dora (2000) attend');
select pg_temp.connecte(:hugo);
select pg_temp.egal(public.chercher_partie_lente(), null::uuid, 'Hugo (800) : trop loin pour l''instant');
reset role;
select pg_temp.egal((select creees from pg_temp.tache()), 0, 'pas encore');
update public.file_lente set created_at = now() - interval '20 hours' where user_id = :dora;
select pg_temp.egal((select creees from pg_temp.tache()), 1, 'après 20 heures : 100 + 177 + 1000 ≥ 1200');
select pg_temp.egal((select count(*) from public.file_lente where user_id in (:dora, :hugo) and partie_id is not null), 2::bigint, 'les deux sont prévenus sur l''accueil');

-- 14. Dix parties lentes en cours au plus : la onzième recherche est refusée.
insert into public.games (black_id, white_id, created_by, size, status, rated, prive)
  select :gaston, :fanny, :gaston, 9, 'active', true, true from generate_series(1, 10);
insert into public.defis (partie_id, jeton, createur_id, invite_id, date_limite, lien_expire_le)
  select g.id, translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'), :gaston, :fanny, now() + interval '1 day', now()
  from public.games g where g.black_id = :gaston and g.white_id = :fanny and g.status = 'active';
set local role authenticated;
select pg_temp.connecte(:gaston);
select pg_temp.doit_refuser('select public.chercher_partie_lente()', 'JGL10');
reset role;

-- 15. Défis entre amis : rien ne change (pas de délai au comptage, pas de cote, annulation impossible).
set local role authenticated;
select pg_temp.connecte(:alice);
select partie_id as d1, jeton as j1 from public.creer_defi() \gset
select pg_temp.connecte(:bruno);
select pg_temp.egal(public.rejoindre_defi(:'j1'), :'d1'::uuid, 'défi rejoint');
reset role;
set local role service_role;
select pg_temp.jouer(:'d1', 'tt');
select pg_temp.jouer(:'d1', 'tt', true);
reset role;
update public.defis set date_limite = now() - interval '1 minute' where partie_id = :'d1';
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.victoire_au_temps(:'d1'), null::text, 'défi : pas de délai pendant le comptage');
reset role;
select pg_temp.egal((select finies from pg_temp.tache()), 0, 'la tâche ne touche pas aux défis d''amis');
set local role authenticated;
select pg_temp.connecte(:alice);
select partie_id as d2, jeton as j2 from public.creer_defi() \gset
select pg_temp.connecte(:bruno);
select pg_temp.egal(public.rejoindre_defi(:'j2'), :'d2'::uuid, 'deuxième défi');
reset role;
update public.defis set date_limite = now() - interval '1 minute' where partie_id = :'d2';
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.victoire_au_temps(:'d2'), 'W+T', 'défi : perte au temps dès le premier coup, comme avant');
reset role;
select pg_temp.egal((select count(*) from public.rating_history where game_id in (:'d1', :'d2')), 0::bigint, 'défi : jamais de cote');

-- 16. Structure : RLS, droits, search_path, aucune donnée supprimée.
select pg_temp.egal((select count(*) >= :parties_avant from public.games), true, 'aucune partie supprimée');
select pg_temp.egal((select count(*) from public.profiles), :profils_avant::bigint, 'aucun profil supprimé');
select pg_temp.egal((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('chercher_partie_lente', 'quitter_file_lente', 'lentes_tache', 'games_defi_garde')),
  true, 'security definer, search_path vide');
select pg_temp.egal((select bool_and(p.proconfig @> array['search_path=""']) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('lente_apparier', 'lentes_en_cours', 'defi_constater_temps')),
  true, 'fonctions internes : search_path vide');
select pg_temp.egal((select bool_or(has_function_privilege(r, p.oid, 'execute')) from pg_proc p, unnest(array['anon', 'authenticated', 'service_role']) r
  where p.pronamespace = 'public'::regnamespace and p.proname in ('lente_apparier', 'lentes_en_cours', 'lentes_tache', 'defi_constater_temps')),
  false, 'internes et tâche fermées à l''app');
select pg_temp.egal((select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('chercher_partie_lente', 'quitter_file_lente')), false, 'fermées à anon');
select pg_temp.egal((select bool_and(has_function_privilege('authenticated', p.oid, 'execute')) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('chercher_partie_lente', 'quitter_file_lente')), true, 'ouvertes aux comptes');
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');
select pg_temp.egal(has_table_privilege('anon', 'public.file_lente', 'select'), false, 'anon ne lit pas la file');
select pg_temp.egal(has_table_privilege('authenticated', 'public.file_lente', 'insert')
  or has_table_privilege('authenticated', 'public.file_lente', 'update')
  or has_table_privilege('authenticated', 'public.file_lente', 'delete'), false, 'aucune écriture directe dans la file');

\o
\echo 'parties_lentes : tous les cas passent.'
rollback;
