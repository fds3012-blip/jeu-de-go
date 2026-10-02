-- Tests rejouables du rattachement d'une session anonyme à un compte (suite de #343, #353, #354).
-- Transaction annulée à la fin. Le jeton est simulé par request.jwt.claims (sub, role, is_anonymous).
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
begin;

create function pg_temp.connecte(p_uid uuid, p_anonyme boolean default false) returns void
language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anonyme)::text, true);
$$;
create function pg_temp.connecte_sans_claim(p_uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.deconnecte() returns void
language sql as $$ select set_config('request.jwt.claims', '{"role":"authenticated"}', true); $$;
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
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Alice, Chloé, Dan : vrais comptes avec pseudo. Bruno, Élise, Fred : anonymes (anciens défis).
insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', null, true),
  ('cccccccc-0000-4000-8000-000000000003', 'chloe@exemple.test', false),
  ('dddddddd-0000-4000-8000-000000000004', 'dan@exemple.test', false),
  ('eeeeeeee-0000-4000-8000-000000000005', null, true),
  ('ffffffff-0000-4000-8000-000000000006', null, true);
update public.profiles set username = 'Alice' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
update public.profiles set username = 'Chloe' where id = 'cccccccc-0000-4000-8000-000000000003';
update public.profiles set username = 'Dan' where id = 'dddddddd-0000-4000-8000-000000000004';
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set chloe '''cccccccc-0000-4000-8000-000000000003'''
\set dan '''dddddddd-0000-4000-8000-000000000004'''
\set elise '''eeeeeeee-0000-4000-8000-000000000005'''
\set fred '''ffffffff-0000-4000-8000-000000000006'''

-- Parties de Bruno (anonyme) :
--   d1 : défi créé par Bruno (Blanc), Alice invitée (Noir), en cours, 2 coups ;
--   d2 : défi créé par Chloé (Blanc), Bruno invité (Noir), en cours ;
--   d3 : défi créé par Bruno, encore en attente (lien libre) ;
--   d4 : partie finie où Bruno avait proposé les pierres mortes.
insert into public.games (id, white_id, black_id, created_by, size, status, prive)
  values ('11111111-0000-4000-8000-000000000001', :bruno, :alice, :bruno, 9, 'active', true),
         ('11111111-0000-4000-8000-000000000002', :chloe, :bruno, :chloe, 9, 'active', true),
         ('11111111-0000-4000-8000-000000000003', :bruno, null, :bruno, 9, 'waiting', true),
         ('11111111-0000-4000-8000-000000000004', :bruno, :alice, :bruno, 9, 'finished', true);
insert into public.defis (partie_id, jeton, createur_id, invite_id, date_limite) values
  ('11111111-0000-4000-8000-000000000001', 'JETON_D1_abcdefghijklmnopqrstuvw', :bruno, :alice, now() + interval '2 days'),
  ('11111111-0000-4000-8000-000000000002', 'JETON_D2_abcdefghijklmnopqrstuvw', :chloe, :bruno, now() + interval '1 day'),
  ('11111111-0000-4000-8000-000000000003', 'JETON_D3_abcdefghijklmnopqrstuvw', :bruno, null, null),
  ('11111111-0000-4000-8000-000000000004', 'JETON_D4_abcdefghijklmnopqrstuvw', :bruno, :alice, null);
select set_config('jeu.coup_defi', '11111111-0000-4000-8000-000000000001', true);
update public.games set moves = 'ddee' where id = '11111111-0000-4000-8000-000000000001';
select set_config('jeu.coup_defi', '', true);
update public.games set dead_proposed_by = :bruno, result = 'B+2' where id = '11111111-0000-4000-8000-000000000004';
select date_limite as limite_d1 from public.defis where partie_id = '11111111-0000-4000-8000-000000000001' \gset
select count(*) as parties_avant from public.games \gset
select count(*) as defis_avant from public.defis \gset

-- 1. preparer_rattachement : sans session refusé ; vrai compte refusé ; anonyme accepté (claim ou auth.users seul).
set local role authenticated;
select pg_temp.deconnecte();
select pg_temp.doit_refuser_code($$select public.preparer_rattachement()$$, '42501');
select pg_temp.connecte(:dan);
select pg_temp.doit_refuser_code($$select public.preparer_rattachement()$$, '42501');
select pg_temp.connecte_sans_claim(:bruno);
select public.preparer_rattachement() as code_vieux \gset
select pg_temp.egal(:'code_vieux' ~ '^[A-Za-z0-9_-]{32}$', true, 'code de 32 caractères base64url');
-- Second tirage : il remplace le premier (une ligne par anonyme), l'ancien code ne vaut plus rien.
select pg_temp.connecte(:bruno, true);
select public.preparer_rattachement() as code \gset
select pg_temp.egal(:'code' <> :'code_vieux', true, 'nouveau code différent');
reset role;
select pg_temp.egal((select count(*) from public.rattachements_anonymes where anonyme_id = :bruno), 1::bigint, 'une seule ligne par anonyme');
select pg_temp.egal((select count(*) from public.rattachements_anonymes where code_hash in (:'code', :'code_vieux')), 0::bigint, 'le code n''est pas gardé en clair');
select pg_temp.egal((select code_hash from public.rattachements_anonymes where anonyme_id = :bruno),
                    encode(extensions.digest(:'code', 'sha256'), 'hex'), 'empreinte SHA-256 du code');
select pg_temp.egal((select expire_le > now() + interval '14 minutes' and expire_le <= now() + interval '15 minutes'
                     from public.rattachements_anonymes where anonyme_id = :bruno), true, 'expire dans 15 minutes');

-- 2. rattacher_session_anonyme : refus sans session, en session anonyme, mauvais code, code mal formé, ancien code.
set local role authenticated;
select pg_temp.deconnecte();
select pg_temp.doit_refuser_code(format($$select public.rattacher_session_anonyme(%L)$$, :'code'), 'JGC01');
select pg_temp.connecte(:bruno, true);
select pg_temp.doit_refuser_code(format($$select public.rattacher_session_anonyme(%L)$$, :'code'), 'JGC01');
select pg_temp.connecte(:dan);
select pg_temp.doit_refuser_code($$select public.rattacher_session_anonyme('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')$$, 'P0002');
select pg_temp.doit_refuser_code($$select public.rattacher_session_anonyme('trop-court')$$, 'P0002');
select pg_temp.doit_refuser_code($$select public.rattacher_session_anonyme(null)$$, 'P0002');
select pg_temp.doit_refuser_code(format($$select public.rattacher_session_anonyme(%L)$$, :'code_vieux'), 'P0002');
reset role;
select pg_temp.egal((select count(*) from public.games where :bruno::uuid in (created_by, black_id, white_id, dead_proposed_by)), 4::bigint, 'rien déplacé après les refus');

-- 3. Code expiré : refusé. Bruno en tire un nouveau.
update public.rattachements_anonymes set expire_le = now() - interval '1 second' where anonyme_id = :bruno;
set local role authenticated;
select pg_temp.connecte(:dan);
select pg_temp.doit_refuser_code(format($$select public.rattacher_session_anonyme(%L)$$, :'code'), 'P0002');
select pg_temp.connecte(:bruno, true);
select public.preparer_rattachement() as code \gset

-- 4. Dan présente le code : les 4 parties et les 4 défis passent à Dan ; Bruno disparaît ; le code est consommé.
select pg_temp.connecte(:dan);
select pg_temp.egal(public.rattacher_session_anonyme(:'code'), 4, 'quatre parties déplacées');
-- Dan lit maintenant ses défis (RLS, comme le client) : les quatre.
select pg_temp.egal((select count(*) from public.defis), 4::bigint, 'Dan voit ses quatre défis');
select pg_temp.egal((select count(*) from public.games where :dan::uuid in (black_id, white_id, created_by)), 4::bigint, 'Dan voit ses quatre parties');
select pg_temp.doit_refuser_code(format($$select public.rattacher_session_anonyme(%L)$$, :'code'), 'P0002');
reset role;
select pg_temp.egal((select count(*) from public.games), :parties_avant::bigint, 'aucune partie perdue');
select pg_temp.egal((select count(*) from public.defis), :defis_avant::bigint, 'aucun défi perdu');
select pg_temp.egal((select count(*) from public.games where :bruno::uuid in (created_by, black_id, white_id, dead_proposed_by)), 0::bigint, 'plus aucune place de Bruno');
select pg_temp.egal((select count(*) from public.defis where :bruno::uuid in (createur_id, invite_id)), 0::bigint, 'plus aucun défi de Bruno');
-- d1 : Dan est Blanc et créateur, Alice reste Noir, coups et date limite intacts.
select pg_temp.egal((select (white_id, black_id, created_by, moves, status::text) from public.games where id = '11111111-0000-4000-8000-000000000001'),
                    (:dan::uuid, :alice::uuid, :dan::uuid, 'ddee'::text, 'active'::text), 'd1 : places et coups');
select pg_temp.egal((select (createur_id, invite_id, date_limite, jeton) from public.defis where partie_id = '11111111-0000-4000-8000-000000000001'),
                    (:dan::uuid, :alice::uuid, :'limite_d1'::timestamptz, 'JETON_D1_abcdefghijklmnopqrstuvw'::text), 'd1 : défi suit avec sa date limite et son jeton');
-- d2 : Chloé reste créatrice et Blanc, Dan est l'invité et Noir.
select pg_temp.egal((select (white_id, black_id, created_by) from public.games where id = '11111111-0000-4000-8000-000000000002'),
                    (:chloe::uuid, :dan::uuid, :chloe::uuid), 'd2 : places');
select pg_temp.egal((select (createur_id, invite_id) from public.defis where partie_id = '11111111-0000-4000-8000-000000000002'),
                    (:chloe::uuid, :dan::uuid), 'd2 : défi');
-- d3 : défi en attente, Dan créateur, toujours libre.
select pg_temp.egal((select (white_id, black_id, created_by, status::text) from public.games where id = '11111111-0000-4000-8000-000000000003'),
                    (:dan::uuid, null::uuid, :dan::uuid, 'waiting'::text), 'd3 : défi en attente');
-- d4 : partie finie, proposant des pierres mortes et résultat intacts.
select pg_temp.egal((select (dead_proposed_by, result) from public.games where id = '11111111-0000-4000-8000-000000000004'),
                    (:dan::uuid, 'B+2'::text), 'd4 : proposant et résultat');
-- Bruno : profil, compte et code supprimés.
select pg_temp.egal((select count(*) from public.profiles where id = :bruno), 0::bigint, 'profil de Bruno supprimé');
select pg_temp.egal((select count(*) from auth.users where id = :bruno), 0::bigint, 'compte anonyme de Bruno supprimé');
select pg_temp.egal((select count(*) from public.rattachements_anonymes), 0::bigint, 'code consommé');
-- Les autres comptes n'ont pas bougé.
select pg_temp.egal((select count(*) from auth.users where id in (:alice, :chloe, :dan, :elise, :fred)), 5::bigint, 'autres comptes intacts');

-- 5. Un joueur qui s'était défié lui-même : Élise (anonyme) créatrice, Dan invité. La place d'Élise est vidée, pas dédoublée.
insert into public.games (id, white_id, black_id, created_by, size, status, prive)
  values ('11111111-0000-4000-8000-000000000005', :elise, :dan, :elise, 9, 'active', true);
insert into public.defis (partie_id, jeton, createur_id, invite_id, date_limite) values
  ('11111111-0000-4000-8000-000000000005', 'JETON_D5_abcdefghijklmnopqrstuvw', :elise, :dan, now() + interval '1 day');
set local role authenticated;
select pg_temp.connecte(:elise, true);
select public.preparer_rattachement() as code_elise \gset
select pg_temp.connecte(:dan);
select pg_temp.egal(public.rattacher_session_anonyme(:'code_elise'), 1, 'une partie déplacée (Élise)');
reset role;
select pg_temp.egal((select (white_id, black_id, created_by) from public.games where id = '11111111-0000-4000-8000-000000000005'),
                    (null::uuid, :dan::uuid, :dan::uuid), 'd5 : place d''Élise vidée, Dan créateur');
select pg_temp.egal((select (createur_id, invite_id) from public.defis where partie_id = '11111111-0000-4000-8000-000000000005'),
                    (null::uuid, :dan::uuid), 'd5 : défi sans doublon');
select pg_temp.egal((select count(*) from auth.users where id = :elise), 0::bigint, 'compte anonyme d''Élise supprimé');

-- 6. Session visée devenue un vrai compte entre-temps (e-mail relié) : rien à déplacer, code refusé (il expire seul).
set local role authenticated;
select pg_temp.connecte(:fred, true);
select public.preparer_rattachement() as code_fred \gset
reset role;
update auth.users set is_anonymous = false, email = 'fred@exemple.test' where id = :fred;
set local role authenticated;
select pg_temp.connecte(:dan);
select pg_temp.doit_refuser_code(format($$select public.rattacher_session_anonyme(%L)$$, :'code_fred'), 'P0002');
reset role;
select pg_temp.egal((select count(*) from public.games where created_by = :fred), 0::bigint, 'rien déplacé pour Fred');
select pg_temp.egal((select count(*) from auth.users where id = :fred), 1::bigint, 'compte de Fred intact');

-- 7. Structure : table fermée à l'app (RLS active, aucune politique, aucun droit), fonctions security definer à
--    search_path vide, exécutables par authenticated seulement ; aucune cote touchée.
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.rattachements_anonymes'::regclass), true, 'RLS active');
select pg_temp.egal((select count(*) from pg_policy where polrelid = 'public.rattachements_anonymes'::regclass), 0::bigint, 'aucune politique');
select pg_temp.egal(has_table_privilege('authenticated', 'public.rattachements_anonymes', 'select'), false, 'authenticated ne lit pas la table');
select pg_temp.egal(has_table_privilege('anon', 'public.rattachements_anonymes', 'select'), false, 'anon ne lit pas la table');
select pg_temp.egal(has_table_privilege('service_role', 'public.rattachements_anonymes', 'select'), false, 'service_role ne lit pas la table');
select pg_temp.egal(has_table_privilege('authenticated', 'public.rattachements_anonymes', 'insert'), false, 'authenticated n''écrit pas la table');
select pg_temp.egal((select bool_and(prosecdef and proconfig[1] = 'search_path=""') from pg_proc
                     where proname in ('preparer_rattachement', 'rattacher_session_anonyme')), true, 'security definer, search_path vide');
select pg_temp.egal(has_function_privilege('authenticated', 'public.preparer_rattachement()', 'execute'), true, 'preparer : authenticated');
select pg_temp.egal(has_function_privilege('anon', 'public.preparer_rattachement()', 'execute'), false, 'preparer : pas anon');
select pg_temp.egal(has_function_privilege('service_role', 'public.preparer_rattachement()', 'execute'), false, 'preparer : pas service_role');
select pg_temp.egal(has_function_privilege('authenticated', 'public.rattacher_session_anonyme(text)', 'execute'), true, 'rattacher : authenticated');
select pg_temp.egal(has_function_privilege('anon', 'public.rattacher_session_anonyme(text)', 'execute'), false, 'rattacher : pas anon');
select pg_temp.egal(has_function_privilege('service_role', 'public.rattacher_session_anonyme(text)', 'execute'), false, 'rattacher : pas service_role');
select pg_temp.egal((select count(*) from public.rating_history), 0::bigint, 'aucune cote touchée');
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');

\echo 'rattacher_session_anonyme : tous les cas passent.'
rollback;
