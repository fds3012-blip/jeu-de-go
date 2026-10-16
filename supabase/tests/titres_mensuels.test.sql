-- Tests rejouables des titres mensuels (#561). Transaction annulée à la fin : aucune donnée ne reste.
-- Un mois fictif de parties (lignes `rating_history`), puis : garde-fou 200, seuils calculés sur la distribution
-- réelle, ex æquo, cote de FIN de mois (pas la meilleure), bornes du mois de Paris, RLS, droits, blocage.
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
-- Identifiant du joueur n (1 à 999).
create function pg_temp.j(n integer) returns uuid
language sql immutable as $$ select ('00000000-0000-4000-8000-000000000' || lpad(n::text, 3, '0'))::uuid $$;
-- Cote de fin de mois du joueur n dans la fixture : 400 + 5 n, sauf 257 qui rejoint 258 (ex æquo à 1690).
create function pg_temp.cote(n integer) returns integer
language sql immutable as $$ select case when n = 257 then 1690 else 400 + 5 * n end $$;
-- Un mois de parties pour le joueur n : p lignes `game` dans le mois (Paris), la dernière à sa cote de fin de mois,
-- les précédentes bien plus hautes (3000) : seule la DERNIÈRE doit compter.
create function pg_temp.mois_de(n integer, p_mois date, p integer) returns void
language sql as $$
  insert into public.rating_history (user_id, kind, rating, created_at)
    select pg_temp.j(n), 'game', case when k = p then pg_temp.cote(n) else 3000 end,
           (p_mois::timestamp + make_interval(days => 1 + k, hours => 12)) at time zone 'Europe/Paris'
    from generate_series(1, p) k;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- 300 comptes avec pseudo (le 299 sans pseudo).
insert into auth.users (id, email, is_anonymous)
  select pg_temp.j(n), 'j' || n || '@exemple.test', false from generate_series(1, 300) n;
insert into public.profiles (id, username)
  select pg_temp.j(n), case when n <> 299 then 'joueur' || n end from generate_series(1, 300) n
  on conflict (id) do update set username = excluded.username;

-- Août 2025 : 150 actifs (10 parties chacun) : sous le garde-fou.
select pg_temp.mois_de(n, '2025-08-01', 10) from generate_series(1, 150) n;

-- Septembre 2025 : 260 actifs (joueurs 1 à 260, 10 à 12 parties). Hors compte :
--   261 à 280 : 9 parties seulement ; 281 : 10 problèmes (kind puzzle) ; 282 : 10 parties mais en octobre ;
--   299 : 10 parties mais pas de pseudo ; 283 : 9 parties en septembre + 1 à 00:30 Paris le 1er octobre (hors mois) ;
--   284 : 9 parties + 1 à 23:30 Paris le 30 septembre (dans le mois : actif, 10 parties).
select pg_temp.mois_de(n, '2025-09-01', 10 + (n % 3)) from generate_series(1, 260) n;
select pg_temp.mois_de(n, '2025-09-01', 9) from generate_series(261, 280) n;
insert into public.rating_history (user_id, kind, rating, created_at)
  select pg_temp.j(281), 'puzzle', 2000, timestamptz '2025-09-10 12:00+02' + make_interval(hours => k) from generate_series(1, 10) k;
select pg_temp.mois_de(282, '2025-10-01', 10);
select pg_temp.mois_de(299, '2025-09-01', 10);
select pg_temp.mois_de(283, '2025-09-01', 9);
insert into public.rating_history (user_id, kind, rating, created_at) values (pg_temp.j(283), 'game', 100, timestamptz '2025-10-01 00:30 Europe/Paris');
select pg_temp.mois_de(284, '2025-09-01', 9);
insert into public.rating_history (user_id, kind, rating, created_at) values (pg_temp.j(284), 'game', 405, timestamptz '2025-09-30 23:30 Europe/Paris');

-- 1. Garde-fou : août (150 actifs) : compteur seul, rien de publié, aucun titre.
select public.calculer_titres_mensuels('2025-08-01');
select pg_temp.egal((select actifs || '/' || publie || '/' || coalesce(seuil_maitre::text, '-') || '/' || n_maitre || n_expert || n_habitue
  from public.titres_mois where mois = '2025-08-01'), '150/false/-/000', 'août : 150 actifs, non publié, pas de seuil');
select pg_temp.egal((select count(*)::int from public.titres_joueurs where mois = '2025-08-01'), 0, 'août : aucun titre écrit');

-- 2. Septembre : 261 actifs (1 à 260, et 284 avec sa 10e partie à 23 h 30 le 30). Appel par le mois ou un jour du mois.
select pg_temp.egal((public.calculer_titres_mensuels('2025-09-17') ->> 'actifs')::int, 261, 'septembre : 261 actifs');
select pg_temp.egal((select publie from public.titres_mois where mois = '2025-09-01'), true, 'septembre publié (≥ 200)');
-- Coupures : ceil(2,61) = 3, ceil(13,05) = 14, ceil(52,2) = 53 (rangs). Rangs : 260 → 1, 259 → 2, 258 et 257 → 3 (ex æquo),
-- 256 → 5, …, n → 261 − n. Rang ≤ 3 : 4 maîtres. Rang ≤ 14 ⇔ n ≥ 247 : 10 experts. Rang ≤ 53 ⇔ n ≥ 208 : 39 habitués.
select pg_temp.egal((select n_maitre || '/' || n_expert || '/' || n_habitue from public.titres_mois where mois = '2025-09-01'),
  '4/10/39', 'effectifs des titres, ex æquo compris');
select pg_temp.egal((select seuil_maitre || '/' || seuil_expert || '/' || seuil_habitue from public.titres_mois where mois = '2025-09-01'),
  '1690/1635/1440', 'seuils = cotes de coupure de la distribution réelle');
select pg_temp.egal((select count(*)::int from public.titres_joueurs where mois = '2025-09-01'), 53, '53 titrés');
select pg_temp.egal((select string_agg(titre, ',' order by titre) from public.titres_joueurs where mois = '2025-09-01' and user_id in (pg_temp.j(257), pg_temp.j(258))),
  'maitre,maitre', 'ex æquo : même titre');
select pg_temp.egal((select titre from public.titres_joueurs where mois = '2025-09-01' and user_id = pg_temp.j(247)), 'expert', 'rang 14 : expert');
select pg_temp.egal((select titre from public.titres_joueurs where mois = '2025-09-01' and user_id = pg_temp.j(246)), 'habitue', 'rang 15 : habitué');
select pg_temp.egal((select titre from public.titres_joueurs where mois = '2025-09-01' and user_id = pg_temp.j(208)), 'habitue', 'rang 53 : dernier habitué');
select pg_temp.egal((select count(*)::int from public.titres_joueurs where mois = '2025-09-01' and user_id = pg_temp.j(207)), 0, 'rang 54 : rien');
-- Cote de FIN de mois (la dernière du mois, pas la meilleure : les parties précédentes étaient à 3000) et parties du mois.
select pg_temp.egal((select cote || '/' || parties from public.titres_joueurs where mois = '2025-09-01' and user_id = pg_temp.j(260)), '1700/12', 'cote de fin de mois et parties (260 % 3 = 2 : 12 parties)');
-- Hors compte : 9 parties, problèmes, parties d'octobre, sans pseudo, 10e partie après minuit le 1er octobre.
select pg_temp.egal((select count(*)::int from public.titres_joueurs where user_id in (pg_temp.j(270), pg_temp.j(281), pg_temp.j(282), pg_temp.j(299), pg_temp.j(283))), 0,
  'inactifs, problèmes, autre mois, sans pseudo, partie après minuit : aucun titre');
-- 284 est actif (10 parties) mais sa cote (405) ne lui vaut aucun titre : il compte dans les 261.
select pg_temp.egal((select count(*)::int from public.titres_joueurs where user_id = pg_temp.j(284)), 0, '284 actif sans titre');

-- 3. Rejouable : un second calcul redonne la même chose, sans doublon.
select public.calculer_titres_mensuels('2025-09-01');
select pg_temp.egal((select count(*)::int from public.titres_joueurs where mois = '2025-09-01'), 53, 'recalcul : toujours 53 titrés');
select pg_temp.egal((select count(*)::int from public.titres_mois), 2, 'recalcul : une ligne par mois');
-- Un joueur dont les parties disparaissent perd son titre au recalcul (le mois est réécrit, pas complété).
delete from public.rating_history where user_id = pg_temp.j(260);
select public.calculer_titres_mensuels('2025-09-01');
select pg_temp.egal((select count(*)::int from public.titres_joueurs where user_id = pg_temp.j(260)), 0, 'recalcul : titre retiré');
select pg_temp.egal((select actifs from public.titres_mois where mois = '2025-09-01'), 260, 'recalcul : 260 actifs');

-- 4. Mois pas fini : refusé. Sans argument : le mois de Paris écoulé (fini), accepté.
select pg_temp.doit_refuser(format('select public.calculer_titres_mensuels(%L)', (now() at time zone 'Europe/Paris')::date), '22023');
select pg_temp.doit_refuser(format('select public.calculer_titres_mensuels(%L)', ((now() at time zone 'Europe/Paris')::date + interval '1 month')::date), '22023');
select pg_temp.egal((public.calculer_titres_mensuels() ->> 'mois')::date,
  (date_trunc('month', now() at time zone 'Europe/Paris') - interval '1 month')::date, 'sans argument : le mois écoulé');

-- 5. RLS : un joueur lit ses titres seulement ; rien pour anon ; aucune écriture ; table d'équipe fermée.
select pg_temp.connecte(pg_temp.j(258));
set local role authenticated;
select pg_temp.egal((select string_agg(mois || ':' || titre, ',') from public.titres_joueurs), '2025-09-01:maitre', 'le joueur 258 lit son seul titre');
select pg_temp.egal((select count(*)::int from public.titres_joueurs where user_id = pg_temp.j(259)), 0, 'pas les titres d''un autre');
select pg_temp.doit_refuser($$insert into public.titres_joueurs (mois, user_id, titre, cote, parties) values ('2025-09-01', pg_temp.j(258), 'maitre', 9999, 10)$$, '42501');
select pg_temp.doit_refuser($$update public.titres_joueurs set titre = 'maitre'$$, '42501');
select pg_temp.doit_refuser($$delete from public.titres_joueurs$$, '42501');
select pg_temp.doit_refuser($$select * from public.titres_mois$$, '42501');
select pg_temp.doit_refuser($$select public.calculer_titres_mensuels('2025-09-01')$$, '42501');
reset role;
select pg_temp.connecte(pg_temp.j(100));
set local role authenticated;
select pg_temp.egal((select count(*)::int from public.titres_joueurs), 0, 'joueur sans titre : rien');
reset role;
set local role anon;
select pg_temp.doit_refuser($$select * from public.titres_joueurs$$, '42501');
select pg_temp.doit_refuser($$select * from public.titres_mois$$, '42501');
select pg_temp.doit_refuser($$select public.calculer_titres_mensuels('2025-09-01')$$, '42501');
select pg_temp.doit_refuser($$select * from public.titres_du_joueur(pg_temp.j(258))$$, '42501');
reset role;

-- 6. titres_du_joueur : pour le profil public (#560). Compte avec pseudo exigé ; mois publiés seulement ; blocage.
select pg_temp.connecte(pg_temp.j(100));
set local role authenticated;
select pg_temp.egal((select string_agg(mois || ':' || titre, ',') from public.titres_du_joueur(pg_temp.j(258))), '2025-09-01:maitre', 'titres d''un autre joueur');
select pg_temp.egal((select count(*)::int from public.titres_du_joueur(pg_temp.j(100))), 0, 'soi-même sans titre : rien');
select pg_temp.egal((select count(*)::int from public.titres_du_joueur(pg_temp.j(1))), 0, 'actif en août (non publié) : rien');
select pg_temp.egal((select count(*)::int from public.titres_du_joueur(null)), 0, 'identifiant nul : rien');
select pg_temp.egal((select count(*)::int from public.titres_du_joueur(gen_random_uuid())), 0, 'inconnu : rien');
reset role;
-- Blocage dans un sens : rien, comme un inconnu.
insert into public.blocages (bloqueur_id, bloque_id) values (pg_temp.j(258), pg_temp.j(100));
select pg_temp.connecte(pg_temp.j(100));
set local role authenticated;
select pg_temp.egal((select count(*)::int from public.titres_du_joueur(pg_temp.j(258))), 0, 'bloqué par lui : rien');
reset role;
select pg_temp.connecte(pg_temp.j(258));
set local role authenticated;
select pg_temp.egal((select count(*)::int from public.titres_du_joueur(pg_temp.j(258))), 1, 'ses propres titres malgré un blocage émis');
reset role;
-- Sans session, en session anonyme, sans pseudo : refusé.
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
set local role authenticated;
select pg_temp.doit_refuser($$select * from public.titres_du_joueur(pg_temp.j(258))$$, 'JGC01');
reset role;
select pg_temp.connecte(pg_temp.j(100), true);
set local role authenticated;
select pg_temp.doit_refuser($$select * from public.titres_du_joueur(pg_temp.j(258))$$, 'JGC01');
reset role;
select pg_temp.connecte(pg_temp.j(299));
set local role authenticated;
select pg_temp.doit_refuser($$select * from public.titres_du_joueur(pg_temp.j(258))$$, 'JGP01');
reset role;
-- Mois dépublié (l'équipe a remis publie à false) : plus rien pour les autres.
update public.titres_mois set publie = false, seuil_maitre = null, seuil_expert = null, seuil_habitue = null, n_maitre = 0, n_expert = 0, n_habitue = 0 where mois = '2025-09-01';
select pg_temp.connecte(pg_temp.j(100));
set local role authenticated;
select pg_temp.egal((select count(*)::int from public.titres_du_joueur(pg_temp.j(259))), 0, 'mois dépublié : rien');
reset role;

-- 7. Suppression du compte : les titres partent avec (cascade).
delete from public.profiles where id = pg_temp.j(259);
select pg_temp.egal((select count(*)::int from public.titres_joueurs where user_id = pg_temp.j(259)), 0, 'titres effacés avec le profil');

-- 8. Structure : RLS, une seule politique (lecture des siens), security definer à search_path vide, droits.
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class where oid in ('public.titres_mois'::regclass, 'public.titres_joueurs'::regclass)), true, 'RLS active');
select pg_temp.egal((select count(*)::int from pg_policies where tablename = 'titres_mois'), 0, 'titres_mois : aucune politique');
select pg_temp.egal((select string_agg(cmd, ',') from pg_policies where tablename = 'titres_joueurs'), 'SELECT', 'titres_joueurs : lecture seule');
select pg_temp.egal((select bool_and(prosecdef and proconfig[1] = 'search_path=""') from pg_proc
  where oid in ('public.calculer_titres_mensuels(date)'::regprocedure, 'public.titres_du_joueur(uuid)'::regprocedure,
                'public.titres_actifs_du_mois(timestamptz, timestamptz, integer)'::regprocedure)), true, 'security definer, search_path vide');
select pg_temp.egal(has_function_privilege('authenticated', 'public.titres_actifs_du_mois(timestamptz, timestamptz, integer)', 'execute')
  or has_function_privilege('anon', 'public.titres_actifs_du_mois(timestamptz, timestamptz, integer)', 'execute'), false, 'contrôle interne fermé');
select pg_temp.egal(has_function_privilege('authenticated', 'public.calculer_titres_mensuels(date)', 'execute'), false, 'authenticated ne calcule pas');
select pg_temp.egal(has_function_privilege('anon', 'public.calculer_titres_mensuels(date)', 'execute'), false, 'anon ne calcule pas');
select pg_temp.egal(has_function_privilege('service_role', 'public.calculer_titres_mensuels(date)', 'execute'), true, 'clé service calcule');
select pg_temp.egal(has_function_privilege('authenticated', 'public.titres_du_joueur(uuid)', 'execute'), true, 'authenticated lit les titres d''un joueur');
select pg_temp.egal(has_function_privilege('anon', 'public.titres_du_joueur(uuid)', 'execute'), false, 'anon non');
select pg_temp.egal(has_table_privilege('anon', 'public.titres_joueurs', 'select'), false, 'anon ne lit pas les titres');
select pg_temp.egal(has_table_privilege('authenticated', 'public.titres_joueurs', 'select'), true, 'authenticated lit (RLS)');
select pg_temp.egal(has_table_privilege('authenticated', 'public.titres_joueurs', 'insert') or has_table_privilege('authenticated', 'public.titres_joueurs', 'update')
  or has_table_privilege('authenticated', 'public.titres_joueurs', 'delete'), false, 'aucune écriture pour authenticated');
select pg_temp.egal(has_table_privilege('authenticated', 'public.titres_mois', 'select'), false, 'table d''équipe fermée');

rollback;
\o
\echo 'titres_mensuels : tous les cas passent.'
