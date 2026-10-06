-- Tests rejouables des abandons répétés (issue #442, migration 20261006150100_abandons_repetes.sql) : journal des
-- parties quittées (absence, jamais venu, refus, délai d'une partie lente), seuil et délais du direct (5 min, 30 min,
-- 24 h), levée du délai, abandon propre et chute de pendule d'un joueur présent non comptés, refus comptés à partir du
-- troisième, dix parties jouées jusqu'au bout qui effacent tout, plafond réduit des parties lentes, RLS et droits.
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
-- Refus JGD01 de find_match : rend le détail (fin de l'attente) et l'indice (minutes).
create function pg_temp.refus_direct(p_uid uuid) returns text
language plpgsql as $$
declare
  v_detail text; v_hint text;
begin
  execute 'set local role authenticated';
  perform pg_temp.connecte(p_uid);
  perform public.find_match(9::smallint);
  execute 'reset role';
  return 'accepté';
exception when sqlstate 'JGD01' then
  get stacked diagnostics v_detail = pg_exception_detail, v_hint = pg_exception_hint;
  execute 'reset role';
  return v_hint || '|' || v_detail;
end;
$$;
create sequence pg_temp.ordre;
-- Partie en direct entre A (attend) et B (trouve), par la vraie file. Les parties sont datées dans l'ordre où elles
-- sont créées (now() est fixe dans la transaction).
create function pg_temp.apparier(p_a uuid, p_b uuid) returns uuid
language plpgsql as $$
declare
  v uuid;
begin
  execute 'set local role authenticated';
  perform pg_temp.connecte(p_a);
  if public.find_match(9::smallint) is not null then raise exception 'ÉCHEC apparier : A ne devait pas trouver'; end if;
  -- A attend depuis 5 minutes : l'écart de cote accepté couvre les cotes qui ont bougé pendant le test.
  execute 'reset role';
  update public.match_queue set created_at = now() - interval '5 minutes' where user_id = p_a;
  execute 'set local role authenticated';
  perform pg_temp.connecte(p_b);
  v := public.find_match(9::smallint);
  execute 'reset role';
  if v is null then raise exception 'ÉCHEC apparier : pas de partie (file : %, parties actives : %)',
    (select json_agg(q) from public.match_queue q), (select json_agg(g.id) from public.games g where g.status = 'active' and (p_a in (g.black_id, g.white_id) or p_b in (g.black_id, g.white_id))); end if;
  update public.parties_direct set cree_le = now() - interval '2 hours' + nextval('pg_temp.ordre') * interval '1 second'
    where partie_id = v;
  return v;
end;
$$;
-- `p_qui` quitte la partie en jeu (deux ou trois coups joués, c'est à lui) : absent depuis 90 s, l'autre est là et
-- constate. Renvoie le résultat écrit.
create function pg_temp.quitter(p_partie uuid, p_qui uuid) returns text
language plpgsql as $$
declare
  v_noir boolean;
begin
  select black_id = p_qui into v_noir from public.games where id = p_partie;
  update public.games set moves = case when v_noir then 'aabb' else 'aabbcc' end where id = p_partie;
  update public.parties_direct
    set trait_depuis = now() - interval '90 seconds',
        noir_vu_le = case when v_noir then now() - interval '90 seconds' else now() end,
        blanc_vu_le = case when v_noir then now() else now() - interval '90 seconds' end
    where partie_id = p_partie;
  return public.direct_constater(p_partie, (select case when v_noir then white_id else black_id end from public.games where id = p_partie));
end;
$$;
create function pg_temp.etat(p_uid uuid) returns jsonb
language plpgsql as $$
declare
  v jsonb;
begin
  execute 'set local role authenticated';
  perform pg_temp.connecte(p_uid);
  v := public.etat_abandons();
  execute 'reset role';
  return v;
end;
$$;
-- Partie lente entre A (attend) et B (trouve), par la vraie file lente.
create function pg_temp.lente(p_a uuid, p_b uuid) returns uuid
language plpgsql as $$
declare
  v uuid;
begin
  execute 'set local role authenticated';
  perform pg_temp.connecte(p_a);
  if public.chercher_partie_lente() is not null then raise exception 'ÉCHEC lente : A ne devait pas trouver'; end if;
  -- A attend depuis 24 heures : l'écart de cote accepté (+ 50 points par heure) couvre les cotes qui ont bougé plus haut
  -- dans le test, au hasard des couleurs tirées par find_match. Sans cela, l'appariement échouait par l'écart de cote
  -- (règle voulue de #440), pas par la règle testée ici.
  execute 'reset role';
  update public.file_lente set created_at = now() - interval '24 hours' where user_id = p_a;
  execute 'set local role authenticated';
  perform pg_temp.connecte(p_b);
  v := public.chercher_partie_lente();
  execute 'reset role';
  if v is null then raise exception 'ÉCHEC lente : pas de partie (file : %)', (select json_agg(q) from public.file_lente q); end if;
  perform set_config('request.jwt.claims', '{}', true);
  delete from public.file_lente where user_id in (p_a, p_b);
  return v;
end;
$$;
-- Un coup du joueur au trait dans une partie lente (comme game-action, clé service) : « aa », « bb », « cc »…
create function pg_temp.coup_lente(p_partie uuid) returns jsonb
language sql as $$
  select public.jouer_coup_defi(p_partie, case when (char_length(moves) / 2) % 2 = 0 then black_id else white_id end, moves,
                                repeat(chr(ascii('a') + char_length(moves) / 2), 2), false)
  from public.games where id = p_partie;
$$;
-- `p_qui` laisse passer son délai dans une partie lente (un coup de Noir d'abord si `p_qui` a Blanc). Tâche planifiée.
create function pg_temp.expirer(p_partie uuid, p_qui uuid) returns text
language plpgsql as $$
begin
  perform pg_temp.coup_lente(p_partie) from public.games
    where id = p_partie and p_qui <> case when (char_length(moves) / 2) % 2 = 0 then black_id else white_id end;
  update public.defis set date_limite = now() - interval '1 second' where partie_id = p_partie;
  perform set_config('request.jwt.claims', '{}', true);
  perform public.lentes_tache();
  return (select status || ':' || coalesce(result, '-') from public.games where id = p_partie);
end;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Comptes avec pseudo : 1 à 20 (abandon01 …) ; 21 anonyme.
insert into auth.users (id, email, is_anonymous)
  select ('00000000-0000-4000-8000-0000000007' || lpad(n::text, 2, '0'))::uuid, 'ab' || n || '@exemple.test', n = 21
  from generate_series(1, 21) n;
insert into public.profiles (id, username)
  select ('00000000-0000-4000-8000-0000000007' || lpad(n::text, 2, '0'))::uuid, case when n <> 21 then 'abandon' || lpad(n::text, 2, '0') end
  from generate_series(1, 21) n
  on conflict (id) do update set username = excluded.username;
\set alice '''00000000-0000-4000-8000-000000000701'''
\set bruno '''00000000-0000-4000-8000-000000000702'''
\set chloe '''00000000-0000-4000-8000-000000000703'''
\set denis '''00000000-0000-4000-8000-000000000704'''
\set eve '''00000000-0000-4000-8000-000000000705'''
\set fanny '''00000000-0000-4000-8000-000000000706'''
\set gaston '''00000000-0000-4000-8000-000000000707'''
\set hugo '''00000000-0000-4000-8000-000000000708'''
\set ines '''00000000-0000-4000-8000-000000000709'''
\set jules '''00000000-0000-4000-8000-000000000710'''
\set karl '''00000000-0000-4000-8000-000000000711'''
\set lea '''00000000-0000-4000-8000-000000000712'''
\set anonyme '''00000000-0000-4000-8000-000000000721'''
select count(*) as parties_avant from public.games \gset

-- 1. Accès : etat_abandons demande une session ; la table est fermée à l'écriture ; les fonctions internes aussi.
set local role anon;
select pg_temp.doit_refuser($$select public.etat_abandons()$$, '42501');
select pg_temp.doit_refuser($$select count(*) from public.abandons$$, '42501');
set local role authenticated;
select set_config('request.jwt.claims', '{}', true);
select pg_temp.doit_refuser($$select public.etat_abandons()$$, '42501');
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser(format($$insert into public.abandons (joueur_id, file, motif) values (%L, 'direct', 'absence')$$, :alice), '42501');
select pg_temp.doit_refuser($$delete from public.abandons$$, '42501');
select pg_temp.doit_refuser($$update public.abandons set cree_le = now() - interval '1 year'$$, '42501');
select pg_temp.doit_refuser(format($$select * from public.abandons_direct(%L)$$, :alice), '42501');
select pg_temp.doit_refuser(format($$select public.plafond_lentes(%L)$$, :alice), '42501');
select pg_temp.doit_refuser(format($$select public.en_attente_abandons(%L)$$, :alice), '42501');
select pg_temp.doit_refuser($$select public.purger_abandons()$$, '42501');
select pg_temp.egal(public.etat_abandons() ->> 'direct_abandons', '0', 'Alice : aucune partie quittée');
select pg_temp.egal(public.etat_abandons() ->> 'lentes_plafond', '10', 'Alice : 10 parties lentes au plus');
select pg_temp.egal(public.etat_abandons() ->> 'direct_prochain_min', null, 'Alice : pas de délai à annoncer');
-- Session anonyme : l'état se lit (vide), find_match reste réservé aux comptes avec pseudo.
select pg_temp.connecte(:anonyme, true);
select pg_temp.egal(public.etat_abandons() ->> 'direct_abandons', '0', 'anonyme : état vide');
reset role;

-- 2. Abandon propre et chute de la pendule d'un joueur présent : jamais comptés.
select pg_temp.apparier(:eve, :bruno) as p_res \gset
set local role authenticated;
select pg_temp.connecte(:eve);
select public.resign_game(:'p_res');
reset role;
select pg_temp.apparier(:eve, :chloe) as p_chute \gset
update public.games set moves = 'aabb' where id = :'p_chute';
update public.parties_direct set trait_depuis = now() - interval '20 minutes', noir_vu_le = now() - interval '3 seconds',
  blanc_vu_le = now() - interval '2 seconds' where partie_id = :'p_chute';
select pg_temp.egal(public.direct_constater(:'p_chute', null) like '_+T', true, 'pendule tombée : perte au temps');
select pg_temp.egal((select count(*) from public.abandons), 0::bigint, 'abandon propre et chute d''un joueur présent : rien de noté');

-- 3. Alice quitte deux parties : noté, aucun délai (déconnexions rares). L'écran prévient : la prochaine coûte 5 min.
select pg_temp.apparier(:alice, :bruno) as pa1 \gset
select pg_temp.egal(pg_temp.quitter(:'pa1', :alice) like '_+T', true, 'Alice absente : perte au temps');
select pg_temp.apparier(:alice, :chloe) as pa2 \gset
select pg_temp.egal(pg_temp.quitter(:'pa2', :alice) like '_+T', true, 'Alice absente, deuxième fois');
select pg_temp.egal((select string_agg(motif || '/' || file, ',') from public.abandons where joueur_id = :alice), 'absence/direct,absence/direct', 'deux absences notées');
select pg_temp.egal((select count(*) from public.abandons where joueur_id in (:bruno, :chloe)), 0::bigint, 'l''adversaire resté : rien');
select pg_temp.egal(pg_temp.etat(:alice) ->> 'direct_abandons', '2', 'Alice : 2 parties quittées');
select pg_temp.egal(pg_temp.etat(:alice) ->> 'direct_jusqu_a', null, 'pas encore d''attente');
select pg_temp.egal(pg_temp.etat(:alice) ->> 'direct_prochain_min', '5', 'prochaine : 5 min');
select pg_temp.egal(pg_temp.refus_direct(:alice), 'accepté', 'Alice peut chercher');
delete from public.match_queue where user_id = :alice;

-- 4. Troisième partie quittée : 5 minutes d'attente. find_match refuse (JGD01, détail = fin de l'attente) ; Alice ne
--    peut pas non plus être appariée si elle était restée dans la file.
select pg_temp.apparier(:alice, :bruno) as pa3 \gset
select pg_temp.quitter(:'pa3', :alice);
select pg_temp.egal(pg_temp.etat(:alice) ->> 'direct_abandons', '3', 'Alice : 3 parties quittées');
select pg_temp.egal(pg_temp.etat(:alice) ->> 'direct_delai_min', '5', 'délai : 5 min');
select pg_temp.egal((pg_temp.etat(:alice) ->> 'direct_jusqu_a')::timestamptz, now() + interval '5 minutes', 'attente jusqu''à dans 5 min');
select pg_temp.egal(pg_temp.refus_direct(:alice),
  '5|' || to_char((now() + interval '5 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'find_match refuse : JGD01, 5 min, fin de l''attente');
-- Restée dans la file avant son attente : personne ne la prend.
insert into public.match_queue (user_id, size, rating, rd, cadence, regles, vu_le) values (:alice, 9, 800, 350, 'normale', 'japanese', now());
set local role authenticated;
select pg_temp.connecte(:chloe);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Chloé n''est pas appariée avec Alice en attente');
select public.quitter_file_attente();
reset role;
delete from public.match_queue where user_id = :alice;
-- L'adversaire resté, lui, cherche librement.
select pg_temp.egal(pg_temp.refus_direct(:bruno), 'accepté', 'Bruno, resté, cherche librement');
delete from public.match_queue where user_id = :bruno;

-- 5. Levée du délai : 5 minutes plus tard, Alice rejoue.
update public.abandons set cree_le = cree_le - interval '301 seconds' where joueur_id = :alice;
select pg_temp.egal(pg_temp.etat(:alice) ->> 'direct_jusqu_a', null, 'attente finie');
select pg_temp.egal(pg_temp.refus_direct(:alice), 'accepté', 'Alice peut de nouveau chercher');
delete from public.match_queue where user_id = :alice;

-- 6. Quatrième : 30 minutes ; cinquième : 24 heures.
select pg_temp.apparier(:alice, :chloe) as pa4 \gset
select pg_temp.quitter(:'pa4', :alice);
select pg_temp.egal(pg_temp.refus_direct(:alice) like '30|%', true, 'quatrième : 30 min');
update public.abandons set cree_le = cree_le - interval '31 minutes' where joueur_id = :alice;
select pg_temp.egal(pg_temp.refus_direct(:alice), 'accepté', 'après 30 min : de nouveau permis');
delete from public.match_queue where user_id = :alice;
select pg_temp.apparier(:alice, :bruno) as pa5 \gset
select pg_temp.quitter(:'pa5', :alice);
select pg_temp.egal(pg_temp.refus_direct(:alice) like '1440|%', true, 'cinquième : 24 h');
select pg_temp.egal(pg_temp.etat(:alice) ->> 'direct_prochain_min', '1440', 'prochaine : 24 h encore');

-- 7. Fenêtre de 7 jours : passé ce délai, plus rien ne compte.
update public.abandons set cree_le = now() - interval '7 days 1 minute' where joueur_id = :alice;
select pg_temp.egal(pg_temp.etat(:alice) ->> 'direct_abandons', '0', '7 jours plus tard : compteur à zéro');
select pg_temp.egal(pg_temp.refus_direct(:alice), 'accepté', 'Alice rejoue');
delete from public.match_queue where user_id = :alice;

-- 8. Jamais venu : partie annulée avant un coup chacun, celui qui devait jouer est absent ; l'autre n'est pas noté.
select pg_temp.apparier(:fanny, :gaston) as pj \gset
-- Fanny doit jouer : le premier coup si elle a Noir ; sinon Gaston a joué le sien, puis c'est à elle.
update public.games set moves = 'aa' where id = :'pj' and white_id = :fanny;
update public.parties_direct d set trait_depuis = now() - interval '90 seconds',
  noir_vu_le = case when g.black_id = :fanny then null else now() end,
  blanc_vu_le = case when g.white_id = :fanny then null else now() end
  from public.games g where g.id = d.partie_id and d.partie_id = :'pj';
select pg_temp.egal(public.direct_constater(:'pj', :gaston), 'annulee', 'partie annulée');
select pg_temp.egal((select string_agg(motif || '/' || (joueur_id = :fanny), ',') from public.abandons where partie_id = :'pj'), 'jamais_venu/true', 'Fanny, jamais venue : notée');
select pg_temp.egal((select count(*) from public.abandons where joueur_id = :gaston), 0::bigint, 'Gaston, présent : rien');

-- 9. Refus d'une partie trouvée pendant le repli contre l'IA (#436) : notés « refus », comptés à partir du troisième.
create function pg_temp.refuser(p_partie uuid, p_uid uuid) returns boolean
language plpgsql as $$
declare v boolean;
begin
  execute 'set local role authenticated';
  perform pg_temp.connecte(p_uid);
  v := public.refuser_partie_direct(p_partie);
  execute 'reset role';
  return v;
end;
$$;
select pg_temp.apparier(:denis, :hugo) as pr1 \gset
select pg_temp.egal(pg_temp.refuser(:'pr1', :denis), true, 'premier refus');
select pg_temp.apparier(:denis, :ines) as pr2 \gset
select pg_temp.egal(pg_temp.refuser(:'pr2', :denis), true, 'deuxième refus');
select pg_temp.egal((select string_agg(motif, ',') from public.abandons where joueur_id = :denis), 'refus,refus', 'deux refus notés comme refus');
select pg_temp.egal((select count(*) from public.abandons where joueur_id in (:hugo, :ines)), 0::bigint, 'l''adversaire refusé : rien');
select pg_temp.egal(pg_temp.etat(:denis) ->> 'direct_abandons', '0', 'deux refus : ne comptent pas');
select pg_temp.apparier(:denis, :jules) as pr3 \gset
select pg_temp.egal(pg_temp.refuser(:'pr3', :denis), true, 'troisième refus');
select pg_temp.egal(pg_temp.etat(:denis) ->> 'direct_abandons', '1', 'troisième refus : compte');
-- Un refus de trop après deux absences : le seuil est atteint.
select pg_temp.apparier(:denis, :hugo) as pr4 \gset
select pg_temp.quitter(:'pr4', :denis);
select pg_temp.apparier(:denis, :ines) as pr5 \gset
select pg_temp.quitter(:'pr5', :denis);
select pg_temp.egal(pg_temp.refus_direct(:denis) like '5|%', true, 'trois refus et deux absences : 5 min');

-- 10. Dix parties jouées jusqu'au bout effacent tout : seules comptent les parties quittées parmi les 10 dernières.
select pg_temp.apparier(:karl, :lea) as pk1 \gset
select pg_temp.quitter(:'pk1', :karl);
select pg_temp.apparier(:karl, :lea) as pk2 \gset
select pg_temp.quitter(:'pk2', :karl);
select pg_temp.apparier(:karl, :lea) as pk3 \gset
select pg_temp.quitter(:'pk3', :karl);
update public.abandons set cree_le = cree_le - interval '1 hour' where joueur_id = :karl;
select pg_temp.egal(pg_temp.etat(:karl) ->> 'direct_abandons', '3', 'Karl : 3 parties quittées');
create function pg_temp.jouer_jusquau_bout(p_a uuid, p_b uuid, p_n integer) returns void
language plpgsql as $$
declare v uuid;
begin
  for i in 1..p_n loop
    v := pg_temp.apparier(p_a, p_b);
    execute 'set local role authenticated';
    perform pg_temp.connecte(p_b);
    perform public.resign_game(v);
    execute 'reset role';
  end loop;
end;
$$;
select pg_temp.jouer_jusquau_bout(:karl, :lea, 7);
select pg_temp.egal(pg_temp.etat(:karl) ->> 'direct_abandons', '3', 'sept parties de plus : les trois comptent encore');
select pg_temp.jouer_jusquau_bout(:karl, :lea, 1);
select pg_temp.egal(pg_temp.etat(:karl) ->> 'direct_abandons', '2', 'huitième : la plus ancienne sort des 10 dernières');
select pg_temp.jouer_jusquau_bout(:karl, :lea, 2);
select pg_temp.egal(pg_temp.etat(:karl) ->> 'direct_abandons', '0', 'dix parties jouées : tout est effacé');

-- 11. Parties lentes : délai dépassé noté (perte au temps ou partie annulée) ; abandon propre non noté ; plafond réduit.
select pg_temp.lente(:fanny, :bruno) as pl1 \gset
select pg_temp.egal(pg_temp.expirer(:'pl1', :fanny) in ('aborted:-', 'finished:B+T', 'finished:W+T'), true, 'lente expirée');
select pg_temp.egal((select motif || '/' || file || '/' || (joueur_id = :fanny) from public.abandons where partie_id = :'pl1'), 'delai/lente/true', 'Fanny notée, délai');
select pg_temp.egal((select count(*) from public.abandons where joueur_id = :bruno and file = 'lente'), 0::bigint, 'Bruno, à jour : rien');
select pg_temp.egal(pg_temp.etat(:fanny) ->> 'lentes_plafond', '10', 'une seule expirée : 10 au plus');
-- Partie lente abandonnée proprement : rien.
select pg_temp.lente(:fanny, :chloe) as pl_res \gset
set local role authenticated;
select pg_temp.connecte(:fanny);
select public.resign_game(:'pl_res');
reset role;
select pg_temp.egal((select count(*) from public.abandons where partie_id = :'pl_res'), 0::bigint, 'lente abandonnée proprement : rien');
-- Une partie avec coups joués, puis délai dépassé : perte au temps notée.
select pg_temp.lente(:fanny, :hugo) as pl2 \gset
select pg_temp.coup_lente(:'pl2') from generate_series(1, 4);
select pg_temp.egal(pg_temp.expirer(:'pl2', :fanny) like 'finished:_+T', true, 'lente perdue au temps');
select pg_temp.egal(pg_temp.etat(:fanny) ->> 'lentes_expirees', '2', 'deux expirées');
select pg_temp.egal(pg_temp.etat(:fanny) ->> 'lentes_plafond', '5', 'deux expirées : 5 au plus');
select pg_temp.lente(:fanny, :ines) as pl3 \gset
select pg_temp.expirer(:'pl3', :fanny);
select pg_temp.egal(pg_temp.etat(:fanny) ->> 'lentes_plafond', '2', 'trois expirées : 2 au plus');
-- Deux parties lentes en cours : la troisième est refusée (JGL11, le plafond en détail).
select pg_temp.lente(:fanny, :jules);
select pg_temp.lente(:fanny, :gaston);
set local role authenticated;
select pg_temp.connecte(:fanny);
select pg_temp.doit_refuser($$select public.chercher_partie_lente()$$, 'JGL11');
reset role;
-- La file ne l'apparie pas non plus (tâche planifiée) : sa ligne attend sans partie.
-- Ligne d'attente de 24 heures, à la vraie cote de Fanny : seul le plafond peut empêcher l'appariement (contrôle plus bas).
insert into public.file_lente (user_id, size, delai_jours, rating, rd, created_at)
  select id, 9, 1, rating, cote_rd, now() - interval '24 hours' from public.profiles where id = :fanny;
set local role authenticated;
select pg_temp.connecte(:karl);
select pg_temp.egal(public.chercher_partie_lente(), null::uuid, 'Karl n''est pas apparié avec Fanny au plafond');
reset role;
-- 30 jours plus tard : plafond rendu.
update public.abandons set cree_le = now() - interval '31 days' where joueur_id = :fanny and file = 'lente';
select pg_temp.egal(pg_temp.etat(:fanny) ->> 'lentes_plafond', '10', '30 jours plus tard : 10 au plus');
-- Contrôle : plafond rendu, la tâche planifiée apparie maintenant Fanny et Karl (c'était bien le plafond qui bloquait).
select set_config('request.jwt.claims', '{}', true);
select public.lentes_tache();
select pg_temp.egal((select count(*) from public.games g join public.defis d on d.partie_id = g.id
  where g.status = 'active' and g.rated and :fanny in (g.black_id, g.white_id) and :karl in (g.black_id, g.white_id)), 1::bigint,
  'plafond rendu : Fanny et Karl appariés par la tâche');
-- Les parties lentes ne comptent pas pour le direct, et inversement.
select pg_temp.egal(pg_temp.etat(:fanny) ->> 'direct_abandons', '1', 'Fanny : seule la partie en direct « jamais venue » compte au direct');

-- 12. RLS : chacun lit ses propres lignes, jamais celles des autres.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal((select count(*) from public.abandons), 5::bigint, 'Alice lit ses 5 parties quittées');
select pg_temp.egal((select count(*) from public.abandons where joueur_id <> :alice), 0::bigint, 'Alice ne voit rien des autres');
select pg_temp.connecte(:bruno);
select pg_temp.egal((select count(*) from public.abandons), 0::bigint, 'Bruno ne voit pas les parties quittées par ses adversaires');
reset role;

-- 13. Rétention : 90 jours, puis effacé par la tâche (rien d'autre).
update public.abandons set cree_le = now() - interval '91 days' where joueur_id = :alice;
select count(*) as total_avant from public.abandons \gset
select pg_temp.egal(public.purger_abandons(), 5, 'cinq lignes de plus de 90 jours effacées');
select pg_temp.egal((select count(*) from public.abandons), (:total_avant - 5)::bigint, 'les autres restent');

-- 14. Fonctions : security definer à search_path vide ; aucune partie supprimée.
select pg_temp.egal((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('games_journal_abandons', 'abandons_direct', 'en_attente_abandons', 'plafond_lentes',
                                               'etat_abandons', 'find_match', 'refuser_partie_direct', 'chercher_partie_lente', 'purger_abandons')),
  true, 'security definer, search_path vide');
select pg_temp.egal((select proconfig @> array['search_path=""'] from pg_proc where proname = 'lente_apparier'), true, 'lente_apparier : search_path vide');
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.abandons'::regclass), true, 'RLS active');
select pg_temp.egal((select count(*) from public.games) >= :parties_avant, true, 'aucune partie supprimée');

rollback;
\o
\echo abandons_repetes : tous les cas passent.
