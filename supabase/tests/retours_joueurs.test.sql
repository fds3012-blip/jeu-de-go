-- Tests rejouables des retours des joueurs en 3 questions (#537). Transaction annulée à la fin.
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
create function pg_temp.n() returns integer language sql as $$ select count(*)::int from public.retours $$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- 1. Sans compte (anon) : le retour est gardé, texte rogné ; questions 2 et 3 facultatives.
set local role anon;
select pg_temp.egal(public.envoyer_retour('oui', '  Plus de problèmes en 13 × 13.  ', 'reseau', 'fr'), true, 'anon : retour gardé');
select pg_temp.egal(public.envoyer_retour('peut_etre', null, null, 'en'), true, 'questions facultatives absentes');
select pg_temp.egal(public.envoyer_retour('non', '   ', 'club', 'fr'), true, 'texte vide : gardé sans texte');
reset role;
select pg_temp.egal(pg_temp.n(), 3, 'trois retours');
select pg_temp.egal((select ameliorer from public.retours where conseil = 'oui'), 'Plus de problèmes en 13 × 13.', 'texte rogné');
select pg_temp.egal((select ameliorer is null from public.retours where conseil = 'non'), true, 'texte blanc : null');
select pg_temp.egal((select source is null and langue = 'en' from public.retours where conseil = 'peut_etre'), true, 'source absente, langue gardée');

-- 2. Connecté (authenticated) : accepté, et rien de la session n'est gardé.
select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.egal(public.envoyer_retour('oui', 'Super.', 'ami', 'en'), true, 'authenticated : retour gardé');
reset role;
select pg_temp.egal(pg_temp.n(), 4, 'quatre retours');
select pg_temp.egal((select string_agg(column_name::text, ',' order by ordinal_position) from information_schema.columns
  where table_schema = 'public' and table_name = 'retours'), 'id,cree_le,conseil,ameliorer,source,langue',
  'colonnes : rien sur l''appelant (ni compte, ni appareil, ni IP)');

-- 3. Entrées mal formées : refus 22023, rien d'écrit.
set local role anon;
select pg_temp.doit_refuser_code($$select public.envoyer_retour(null, null, null, 'fr')$$, '22023');
select pg_temp.doit_refuser_code($$select public.envoyer_retour('Oui', null, null, 'fr')$$, '22023');
select pg_temp.doit_refuser_code($$select public.envoyer_retour('peut-être', null, null, 'fr')$$, '22023');
select pg_temp.doit_refuser_code($$select public.envoyer_retour('oui', null, 'tiktok', 'fr')$$, '22023');
select pg_temp.doit_refuser_code($$select public.envoyer_retour('oui', null, null, 'de')$$, '22023');
select pg_temp.doit_refuser_code($$select public.envoyer_retour('oui', null, null, null)$$, '22023');
select pg_temp.doit_refuser_code(format('select public.envoyer_retour(%L, %L, null, %L)', 'oui', repeat('é', 1001), 'fr'), '22023');
select pg_temp.egal(public.envoyer_retour('oui', repeat('é', 1000), null, 'fr'), true, '1 000 caractères : accepté');
reset role;
select pg_temp.egal(pg_temp.n(), 5, 'rien d''écrit pour une entrée mal formée');

-- 4. Aucune lecture ni écriture directe pour anon et authenticated.
set local role anon;
select pg_temp.doit_refuser_code($$select * from public.retours$$, '42501');
select pg_temp.doit_refuser_code($$insert into public.retours (conseil, langue) values ('oui', 'fr')$$, '42501');
select pg_temp.doit_refuser_code($$delete from public.retours$$, '42501');
select pg_temp.doit_refuser_code($$select * from public.retours_fenetre$$, '42501');
select pg_temp.doit_refuser_code($$select public.purger_retours()$$, '42501');
reset role;
set local role authenticated;
select pg_temp.doit_refuser_code($$select * from public.retours$$, '42501');
select pg_temp.doit_refuser_code($$update public.retours set ameliorer = 'x'$$, '42501');
select pg_temp.doit_refuser_code($$update public.retours_fenetre set n = 0$$, '42501');
select pg_temp.doit_refuser_code($$select public.purger_retours()$$, '42501');
reset role;

-- 5. Limite de fréquence : 20 par minute (5 déjà envoyés), puis refus comptés, rien d'écrit.
set local role anon;
select public.envoyer_retour('oui', null, null, 'fr') from generate_series(1, 14);  -- 5 + 14 = 19
select pg_temp.egal(public.envoyer_retour('oui', null, null, 'fr'), true, '20e retour de la minute accepté');
select pg_temp.egal(public.envoyer_retour('oui', null, null, 'fr'), false, '21e refusé');
select pg_temp.egal(public.envoyer_retour('non', 'encore', null, 'en'), false, '22e refusé');
reset role;
select pg_temp.egal(pg_temp.n(), 20, 'plafonné à 20 dans la minute');
select pg_temp.egal((select refus from public.retours_fenetre), 2, 'refus comptés');
select pg_temp.egal((select n_jour from public.retours_fenetre), 20, 'les refus ne comptent pas dans le jour');
-- Minute suivante : de nouveau accepté.
update public.retours_fenetre set debut = now() - interval '61 seconds';
set local role anon;
select pg_temp.egal(public.envoyer_retour('oui', null, null, 'fr'), true, 'nouvelle minute : accepté');
reset role;
select pg_temp.egal((select n from public.retours_fenetre), 1, 'fenêtre remise à 1');

-- 6. Plafond du jour : 500, puis refus ; un nouveau jour remet tout à zéro (refus compris).
update public.retours_fenetre set n_jour = 499, debut = now() - interval '61 seconds';
set local role anon;
select pg_temp.egal(public.envoyer_retour('oui', null, null, 'fr'), true, '500e du jour accepté');
select pg_temp.egal(public.envoyer_retour('oui', null, null, 'fr'), false, 'au-delà de 500 : refusé');
reset role;
update public.retours_fenetre set jour = jour - 1, debut = now() - interval '61 seconds';
set local role anon;
select pg_temp.egal(public.envoyer_retour('oui', null, null, 'fr'), true, 'nouveau jour : accepté');
reset role;
select pg_temp.egal((select n_jour = 1 and refus = 0 from public.retours_fenetre), true, 'jour et refus remis à zéro');

-- 7. Rétention : plus de 12 mois effacés, le reste gardé.
update public.retours set cree_le = now() - interval '13 months' where conseil = 'non';
select public.purger_retours();
select pg_temp.egal((select count(*)::int from public.retours where conseil = 'non'), 0, 'retours de plus de 12 mois effacés');
select pg_temp.egal((select count(*)::int from public.retours) > 0, true, 'retours récents gardés');

-- 8. Structure : RLS sans politique, security definer à search_path vide, droits d'exécution.
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class where oid in
  ('public.retours'::regclass, 'public.retours_fenetre'::regclass)), true, 'RLS active');
select pg_temp.egal((select count(*)::int from pg_policies where tablename in ('retours', 'retours_fenetre')),
  0, 'aucune politique (aucune lecture publique)');
select pg_temp.egal((select bool_and(prosecdef and proconfig[1] = 'search_path=""') from pg_proc
  where oid in ('public.envoyer_retour(text, text, text, text)'::regprocedure, 'public.purger_retours()'::regprocedure)),
  true, 'security definer, search_path vide');
select pg_temp.egal(has_function_privilege('anon', 'public.envoyer_retour(text, text, text, text)', 'execute'), true, 'anon peut envoyer');
select pg_temp.egal(has_function_privilege('authenticated', 'public.envoyer_retour(text, text, text, text)', 'execute'), true, 'authenticated peut envoyer');
select pg_temp.egal(has_function_privilege('anon', 'public.purger_retours()', 'execute'), false, 'anon ne purge pas');
select pg_temp.egal(has_function_privilege('authenticated', 'public.purger_retours()', 'execute'), false, 'authenticated ne purge pas');
select pg_temp.egal(has_table_privilege('anon', 'public.retours', 'select'), false, 'anon ne lit pas');
select pg_temp.egal(has_table_privilege('authenticated', 'public.retours', 'select'), false, 'authenticated ne lit pas');

rollback;
\o
\echo 'retours_joueurs : tous les cas passent.'
