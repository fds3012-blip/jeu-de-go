-- Tests rejouables de la cote « à ta mesure » côté serveur (issue #284). Transaction annulée à la fin :
-- aucune donnée ne reste. Voir supabase/tests/LISEZMOI.md.
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
-- Cote d'un joueur, arrondie au centième (lue sans RLS).
create function pg_temp.cote(p_uid uuid) returns numeric
language sql as $$ select round(cote::numeric, 2) from public.cotes_a_mesure where user_id = p_uid; $$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Alice et Chloé ont un compte ; Bruno est anonyme.
insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', null, true),
  ('cccccccc-0000-4000-8000-000000000003', 'chloe@exemple.test', false);
insert into public.profiles (id) values
  ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002'), ('cccccccc-0000-4000-8000-000000000003')
  on conflict do nothing;
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set chloe '''cccccccc-0000-4000-8000-000000000003'''

-- Problèmes de test à difficulté connue (copies d'un problème commun), et un problème personnel de Chloé.
insert into public.puzzles (id, size, setup, answers, difficulty)
  select 'am-' || d, size, setup, answers, d from public.puzzles, (values (400), (480), (500), (520)) v(d)
  where owner_id is null and id = (select min(id) from public.puzzles where owner_id is null);
insert into public.puzzles (id, owner_id, size, setup, answers, difficulty)
  select 'am-perso', :chloe, size, setup, answers, 400 from public.puzzles where id = 'am-400';

set local role authenticated;

-- 1. Sans connexion ou en session anonyme : refusé, rien n'est écrit.
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select pg_temp.doit_refuser('select public.noter_a_mesure(''am-400'', ''premier'')', 'Connexion requise');
select pg_temp.connecte(:bruno, true);
select pg_temp.doit_refuser('select public.noter_a_mesure(''am-400'', ''premier'')', 'Crée un compte');
select pg_temp.doit_refuser('select public.importer_cote_appareil(900, 10)', 'Crée un compte');

-- 2. Aucune écriture directe, même sur sa propre ligne.
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser(format('insert into public.cotes_a_mesure (user_id, cote) values (%L, 2500)', :alice), 'permission denied');
select pg_temp.doit_refuser(format('insert into public.essais_a_mesure (user_id, puzzle_id, jour, resultat, cote_avant, cote_apres) values (%L, ''am-400'', current_date, ''premier'', 400, 480)', :alice), 'permission denied');
select pg_temp.doit_refuser('update public.cotes_a_mesure set cote = 2500', 'permission denied');
select pg_temp.doit_refuser('delete from public.essais_a_mesure', 'permission denied');
select pg_temp.doit_refuser('select public.noter_a_mesure(''am-400'', ''super'')', 'Résultat inconnu');
select pg_temp.doit_refuser('select public.noter_a_mesure(''am-perso'', ''premier'')', 'Problème introuvable');
select pg_temp.doit_refuser('select public.noter_a_mesure(''inexistant'', ''premier'')', 'Problème introuvable');

-- 3. Premier essai réussi : départ 400, difficulté 400, chance 0,5, K 160 : +80.
select pg_temp.egal(public.noter_a_mesure('am-400', 'premier'), true, 'premier essai noté');
select pg_temp.egal(pg_temp.cote(:alice), 480.00, 'cote après une réussite');
select pg_temp.egal((select (essais, serie) from public.cotes_a_mesure), row(1, 1), 'essais et série');
-- Rejouer le même problème : ne compte pas.
select pg_temp.egal(public.noter_a_mesure('am-400', 'rate'), false, 'rejouer ne compte pas');
select pg_temp.egal(pg_temp.cote(:alice), 480.00, 'cote inchangée après Rejouer');

-- 4. Échec : difficulté 480, chance 0,5, K = 160 × 12 / 13 : −73,85. Puis trouvé seul : +0,2 × K = +29,54.
select pg_temp.egal(public.noter_a_mesure('am-480', 'rate'), true, 'échec noté');
select pg_temp.egal(pg_temp.cote(:alice), 406.15, 'cote après un échec');
select pg_temp.egal((select serie from public.cotes_a_mesure), 0, 'la série repart');
select pg_temp.egal(public.noter_a_mesure('am-400', 'aide'), false, 'aide : seulement sur l''échec noté en dernier');
select pg_temp.egal(public.noter_a_mesure('am-480', 'aide'), true, 'réussite avec aide');
select pg_temp.egal(pg_temp.cote(:alice), 435.69, 'cote après la réussite avec aide');
select pg_temp.egal(public.noter_a_mesure('am-480', 'aide'), false, 'aide : une seule fois');
select pg_temp.egal(pg_temp.cote(:alice), 435.69, 'cote inchangée après une seconde aide');
select pg_temp.egal((select resultat from public.essais_a_mesure where puzzle_id = 'am-480'), 'aide', 'essai requalifié');

-- 5. Un autre jour : un problème réussi ne compte plus jamais ; un problème raté compte de nouveau.
select pg_temp.egal(public.noter_a_mesure('am-500', 'rate'), true, 'échec sur am-500');
reset role;
update public.essais_a_mesure set jour = jour - 1;
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.noter_a_mesure('am-500', 'aide'), false, 'aide : seulement le jour même');
select pg_temp.egal(public.noter_a_mesure('am-400', 'premier'), false, 'réussi hier : ne compte plus');
select pg_temp.egal(public.noter_a_mesure('am-480', 'premier'), false, 'réussi avec aide hier : ne compte plus');
select pg_temp.egal(public.noter_a_mesure('am-500', 'premier'), true, 'raté hier : compte de nouveau aujourd''hui');
select pg_temp.egal((select essais from public.cotes_a_mesure), 4, 'quatre premiers essais notés');

-- 6. Chacun ne lit que sa ligne ; l'import de la cote de l'appareil n'a lieu qu'avant tout essai.
select pg_temp.egal(public.importer_cote_appareil(2000, 0), false, 'import refusé après des essais');
select pg_temp.connecte(:chloe);
select pg_temp.egal((select count(*) from public.cotes_a_mesure), 0::bigint, 'Chloé ne voit pas la cote d''Alice');
select pg_temp.egal((select count(*) from public.essais_a_mesure), 0::bigint, 'Chloé ne voit pas les essais d''Alice');
select pg_temp.doit_refuser('select public.importer_cote_appareil(''NaN''::double precision, 1)', 'Cote invalide');
select pg_temp.egal(public.importer_cote_appareil(9999, 0), true, 'import de la cote de l''appareil');
select pg_temp.egal(pg_temp.cote(:chloe), 3000.00, 'cote importée bornée');
select pg_temp.egal(public.importer_cote_appareil(900, 10), true, 'import répété tant qu''aucun essai');
select pg_temp.egal((select (round(cote::numeric), essais) from public.cotes_a_mesure), row(900::numeric, 10), 'cote et essais importés');
select pg_temp.egal(public.importer_cote_appareil(1200, 0), false, 'une seule reprise : les essais importés comptent');
select pg_temp.egal(public.noter_a_mesure('am-perso', 'premier'), true, 'problème personnel noté par sa propriétaire');
select pg_temp.egal(public.importer_cote_appareil(400, 0), false, 'import refusé après un essai');
reset role;

-- 7. Structure : RLS active, fonctions fermées à anon, suppression du compte en cascade.
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relname in ('cotes_a_mesure', 'essais_a_mesure')), true, 'RLS active');
select pg_temp.egal(has_function_privilege('anon', 'public.noter_a_mesure(text, text)', 'execute'), false, 'anon ne note pas');
select pg_temp.egal(has_function_privilege('anon', 'public.importer_cote_appareil(double precision, integer)', 'execute'), false, 'anon n''importe pas');
select pg_temp.egal(has_table_privilege('anon', 'public.cotes_a_mesure', 'select'), false, 'anon ne lit pas');
delete from public.profiles where id = :alice;
select pg_temp.egal((select count(*) from public.essais_a_mesure where user_id = :alice), 0::bigint, 'essais supprimés avec le compte');
select pg_temp.egal((select count(*) from public.cotes_a_mesure where user_id = :alice), 0::bigint, 'cote supprimée avec le compte');

\echo 'cote_a_mesure : tous les cas passent.'
rollback;
