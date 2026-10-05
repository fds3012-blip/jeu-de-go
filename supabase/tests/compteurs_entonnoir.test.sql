-- Tests rejouables des compteurs anonymes de l'entonnoir (#437). Transaction annulée à la fin.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
begin;

create function pg_temp.doit_refuser_code(p_sql text, p_code text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'REFUS ATTENDU, mais accepté : %', p_sql;
exception when others then
  if sqlerrm like 'REFUS ATTENDU%' then raise; end if;
  if sqlstate <> p_code then
    raise exception 'Mauvais refus pour « % » : % « % » (attendu : %)', p_sql, sqlstate, sqlerrm, p_code;
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
create function pg_temp.n(p_etape text) returns integer
language sql as $$
  select n from public.compteurs_entonnoir where etape = p_etape and jour = (now() at time zone 'Europe/Paris')::date;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- 1. Visiteur sans session (anon) : chaque étape se compte, par jour à Paris.
set local role anon;
select pg_temp.egal(public.compter_etape('premier_ecran'), true, 'anon : premier écran compté');
select pg_temp.egal(public.compter_etape('premier_ecran'), true, 'anon : deuxième appareil');
select public.compter_etape(e) from unnest(array['premiere_pierre', 'premiere_partie_finie', 'limite_essai',
  'compte_cree', 'premiere_partie_en_ligne']) e;
reset role;
select pg_temp.egal(pg_temp.n('premier_ecran'), 2, 'incrément');
select pg_temp.egal((select count(*)::int from public.compteurs_entonnoir), 6, 'une ligne par étape');
select pg_temp.egal((select bool_and(n = 1) from public.compteurs_entonnoir where etape <> 'premier_ecran'), true, 'autres étapes à 1');

-- 2. Compte connecté (authenticated, avec ou sans claims) : même chose, rien de la session n'est gardé.
select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.egal(public.compter_etape('compte_cree'), true, 'authenticated : compté');
reset role;
select pg_temp.egal(pg_temp.n('compte_cree'), 2, 'compte créé : 2');
-- Aucune colonne ne peut porter quoi que ce soit sur l'appelant.
select pg_temp.egal((select string_agg(column_name::text, ',' order by ordinal_position) from information_schema.columns
  where table_schema = 'public' and table_name = 'compteurs_entonnoir'), 'jour,etape,n', 'colonnes : jour, étape, nombre');

-- 3. Liste blanche : étape inconnue, vide ou nulle refusée (22023), rien d'écrit.
set local role anon;
select pg_temp.doit_refuser_code($$select public.compter_etape('inscription')$$, '22023');
select pg_temp.doit_refuser_code($$select public.compter_etape('')$$, '22023');
select pg_temp.doit_refuser_code($$select public.compter_etape(null)$$, '22023');
select pg_temp.doit_refuser_code($$select public.compter_etape('Premier_Ecran')$$, '22023');
reset role;
select pg_temp.egal((select count(*)::int from public.compteurs_entonnoir), 6, 'rien d''écrit pour une étape inconnue');

-- 4. Tables fermées : ni lecture ni écriture directe pour anon et authenticated.
set local role anon;
select pg_temp.doit_refuser_code($$select * from public.compteurs_entonnoir$$, '42501');
select pg_temp.doit_refuser_code($$insert into public.compteurs_entonnoir values (current_date, 'premier_ecran', 999)$$, '42501');
select pg_temp.doit_refuser_code($$update public.compteurs_entonnoir set n = 0$$, '42501');
select pg_temp.doit_refuser_code($$select * from public.compteurs_entonnoir_fenetre$$, '42501');
reset role;
set local role authenticated;
select pg_temp.doit_refuser_code($$select * from public.compteurs_entonnoir$$, '42501');
select pg_temp.doit_refuser_code($$update public.compteurs_entonnoir set n = 0$$, '42501');
select pg_temp.doit_refuser_code($$delete from public.compteurs_entonnoir$$, '42501');
select pg_temp.doit_refuser_code($$update public.compteurs_entonnoir_fenetre set n = 0$$, '42501');
reset role;

-- 5. Limite de fréquence : 60 appels par minute et par étape, puis refus comptés ; les autres étapes ne sont pas gênées.
set local role anon;
select public.compter_etape('premiere_pierre') from generate_series(1, 58);  -- 1 + 58 = 59 dans la minute
select pg_temp.egal(public.compter_etape('premiere_pierre'), true, '60e appel de la minute accepté');
select pg_temp.egal(public.compter_etape('premiere_pierre'), false, '61e appel refusé');
select pg_temp.egal(public.compter_etape('premiere_pierre'), false, '62e appel refusé');
select pg_temp.egal(public.compter_etape('limite_essai'), true, 'autre étape non gênée');
reset role;
select pg_temp.egal(pg_temp.n('premiere_pierre'), 60, 'premiere_pierre plafonnée à 60 dans la minute');
select pg_temp.egal((select refus from public.compteurs_entonnoir_fenetre where etape = 'premiere_pierre'), 2, 'refus comptés');
-- Minute suivante (fenêtre vieillie) : on compte de nouveau.
update public.compteurs_entonnoir_fenetre set debut = now() - interval '61 seconds' where etape = 'premiere_pierre';
set local role anon;
select pg_temp.egal(public.compter_etape('premiere_pierre'), true, 'nouvelle minute : compté');
reset role;
select pg_temp.egal(pg_temp.n('premiere_pierre'), 61, 'compté après la minute');
select pg_temp.egal((select n from public.compteurs_entonnoir_fenetre where etape = 'premiere_pierre'), 1, 'fenêtre remise à 1');

-- 6. Plafond du jour : 20 000 par étape, puis refus (le nombre ne bouge plus).
update public.compteurs_entonnoir set n = 19999 where etape = 'premiere_partie_finie';
set local role anon;
select pg_temp.egal(public.compter_etape('premiere_partie_finie'), true, '20 000e accepté');
select pg_temp.egal(public.compter_etape('premiere_partie_finie'), false, 'au-delà de 20 000 : refusé');
reset role;
select pg_temp.egal(pg_temp.n('premiere_partie_finie'), 20000, 'plafond du jour');
-- Le refus de la veille ne s'ajoute pas à ceux du jour.
update public.compteurs_entonnoir_fenetre set refus_jour = current_date - 3, refus = 40 where etape = 'premiere_partie_finie';
set local role anon;
select public.compter_etape('premiere_partie_finie');
reset role;
select pg_temp.egal((select refus from public.compteurs_entonnoir_fenetre where etape = 'premiere_partie_finie'), 1, 'refus remis à zéro chaque jour');

-- 7. Un autre jour : nouvelle ligne, celle de la veille intacte.
insert into public.compteurs_entonnoir values ((now() at time zone 'Europe/Paris')::date - 1, 'premier_ecran', 7);
set local role anon;
select public.compter_etape('premier_ecran');
reset role;
select pg_temp.egal((select n from public.compteurs_entonnoir where etape = 'premier_ecran'
  and jour = (now() at time zone 'Europe/Paris')::date - 1), 7, 'veille intacte');
select pg_temp.egal(pg_temp.n('premier_ecran'), 3, 'jour courant');

-- 8. Structure : RLS sans politique, security definer à search_path vide, droits d'exécution.
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class where oid in
  ('public.compteurs_entonnoir'::regclass, 'public.compteurs_entonnoir_fenetre'::regclass)), true, 'RLS active');
select pg_temp.egal((select count(*)::int from pg_policies where tablename in ('compteurs_entonnoir', 'compteurs_entonnoir_fenetre')),
  0, 'aucune politique (aucune lecture publique)');
select pg_temp.egal((select prosecdef and proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.compter_etape(text)'::regprocedure),
  true, 'security definer, search_path vide');
select pg_temp.egal(has_function_privilege('anon', 'public.compter_etape(text)', 'execute'), true, 'anon peut compter');
select pg_temp.egal(has_function_privilege('authenticated', 'public.compter_etape(text)', 'execute'), true, 'authenticated peut compter');
select pg_temp.egal(has_table_privilege('anon', 'public.compteurs_entonnoir', 'select'), false, 'anon ne lit pas');
select pg_temp.egal(has_table_privilege('authenticated', 'public.compteurs_entonnoir', 'select'), false, 'authenticated ne lit pas');

rollback;
\o
\echo 'compteurs_entonnoir : tous les cas passent.'
