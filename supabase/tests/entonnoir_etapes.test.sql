-- Tests rejouables des étapes ajoutées à l'entonnoir anonyme (#519, migration 20261010180000). Transaction annulée.
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

-- Une ligne d'avant la migration reste intacte (aucune donnée touchée).
insert into public.compteurs_entonnoir values ((now() at time zone 'Europe/Paris')::date - 2, 'premier_ecran', 11);

-- 1. Les trois nouvelles étapes se comptent, par anon comme par authenticated ; les anciennes aussi.
set local role anon;
select pg_temp.egal(public.compter_etape('premier_geste'), true, 'anon : premier geste');
select pg_temp.egal(public.compter_etape('partie_ouverte'), true, 'anon : partie ouverte');
select pg_temp.egal(public.compter_etape('premier_toucher_plateau'), true, 'anon : premier toucher du plateau');
select pg_temp.egal(public.compter_etape('premiere_pierre'), true, 'anon : première pierre (inchangée)');
reset role;
set local role authenticated;
select pg_temp.egal(public.compter_etape('premier_geste'), true, 'authenticated : premier geste');
reset role;
select pg_temp.egal(pg_temp.n('premier_geste'), 2, 'premier geste : 2');
select pg_temp.egal(pg_temp.n('partie_ouverte'), 1, 'partie ouverte : 1');
select pg_temp.egal(pg_temp.n('premier_toucher_plateau'), 1, 'premier toucher : 1');

-- 2. Toujours une liste blanche : étape inconnue refusée par la fonction, et par la contrainte en écriture directe.
set local role anon;
select pg_temp.doit_refuser_code($$select public.compter_etape('deuxieme_jour')$$, '22023');
select pg_temp.doit_refuser_code($$select public.compter_etape(null)$$, '22023');
reset role;
select pg_temp.doit_refuser_code($$insert into public.compteurs_entonnoir values (current_date, 'n_importe_quoi', 1)$$, '23514');

-- 3. Plafond par minute pour une nouvelle étape aussi (60, puis refus compté).
update public.compteurs_entonnoir_fenetre set n = 60, debut = now() where etape = 'partie_ouverte';
set local role anon;
select pg_temp.egal(public.compter_etape('partie_ouverte'), false, 'partie ouverte : 61e de la minute refusé');
reset role;
select pg_temp.egal(pg_temp.n('partie_ouverte'), 1, 'refus : total inchangé');

-- 4. Ancienne ligne intacte.
select pg_temp.egal((select n from public.compteurs_entonnoir where etape = 'premier_ecran'
  and jour = (now() at time zone 'Europe/Paris')::date - 2), 11, 'ligne d''avant intacte');

-- 5. Structure inchangée : RLS sans politique, security definer à search_path vide, droits.
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class where oid in
  ('public.compteurs_entonnoir'::regclass, 'public.compteurs_entonnoir_fenetre'::regclass)), true, 'RLS active');
select pg_temp.egal((select count(*)::int from pg_policies where tablename in ('compteurs_entonnoir', 'compteurs_entonnoir_fenetre')),
  0, 'aucune politique');
select pg_temp.egal((select prosecdef and proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.compter_etape(text)'::regprocedure),
  true, 'security definer, search_path vide');
select pg_temp.egal(has_function_privilege('anon', 'public.compter_etape(text)', 'execute'), true, 'anon peut compter');
select pg_temp.egal(has_table_privilege('anon', 'public.compteurs_entonnoir', 'select'), false, 'anon ne lit pas');
select pg_temp.egal(has_table_privilege('authenticated', 'public.compteurs_entonnoir', 'insert'), false, 'authenticated n''écrit pas');

rollback;
\o
\echo 'entonnoir_etapes : tous les cas passent.'
