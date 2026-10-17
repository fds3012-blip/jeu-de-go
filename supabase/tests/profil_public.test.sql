-- Tests rejouables du profil public (issue #560, migration 20261016120000_profil_public.sql). Tout se passe dans une
-- transaction annulée à la fin : aucune donnée ne reste. Voir supabase/tests/LISEZMOI.md.
-- Le jeton est simulé par request.jwt.claims (sub, role, is_anonymous), comme PostgREST.
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
-- Le texte du profil ne contient pas `p_texte`.
create function pg_temp.absent(p_profil jsonb, p_texte text, p_cas text) returns void
language plpgsql as $$
begin
  if position(lower(p_texte) in lower(coalesce(p_profil::text, ''))) > 0 then
    raise exception 'ÉCHEC %: « % » trouvé dans le profil public', p_cas, p_texte;
  end if;
end;
$$;
-- Les parties du profil, en une ligne : « adversaire:gagnee:taille:couleur », la plus récente d'abord.
create function pg_temp.parties(p_profil jsonb) returns text
language sql as $$
  select coalesce(string_agg(coalesce(x ->> 'adversaire', '-') || ':' || coalesce(x ->> 'gagnee', 'nul') || ':' || (x ->> 'taille') || ':' || (x ->> 'couleur'), ',' order by o), '')
  from jsonb_array_elements(p_profil -> 'parties') with ordinality t(x, o);
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Comptes : Alice, Bruno, Eve, Gael (pseudo) ; Chloé (sans pseudo) ; Denis (anonyme) ; Fantôme : pseudo mais compte anonyme.
insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice-secret@exemple.test', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bruno-secret@exemple.test', false),
  ('cccccccc-0000-4000-8000-000000000003', 'chloe@exemple.test', false),
  ('dddddddd-0000-4000-8000-000000000004', null, true),
  ('eeeeeeee-0000-4000-8000-000000000005', 'eve@exemple.test', false),
  ('ffffffff-0000-4000-8000-000000000006', null, true),
  ('99999999-0000-4000-8000-000000000007', 'gael@exemple.test', false);
insert into public.profiles (id, username) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Alice'), ('bbbbbbbb-0000-4000-8000-000000000002', 'Bruno'),
  ('cccccccc-0000-4000-8000-000000000003', null), ('dddddddd-0000-4000-8000-000000000004', null),
  ('eeeeeeee-0000-4000-8000-000000000005', 'Eve'), ('ffffffff-0000-4000-8000-000000000006', 'Fantome'),
  ('99999999-0000-4000-8000-000000000007', 'Gael')
  on conflict (id) do update set username = excluded.username;
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set chloe '''cccccccc-0000-4000-8000-000000000003'''
\set denis '''dddddddd-0000-4000-8000-000000000004'''
\set eve '''eeeeeeee-0000-4000-8000-000000000005'''
\set gael '''99999999-0000-4000-8000-000000000007'''

-- Bruno : cote 1619,6 (arrondie à 1620), écart, volatilité, série, cote des problèmes : du privé, jamais rendu.
update public.profiles set rating = 1619.6, cote_rd = 60.5, cote_vol = 0.0601, cote_parties = 99,
  streak_days = 17, puzzle_rating = 1777, conditions_version = '1999-12-31', conditions_acceptees_le = now() where id = :bruno;

-- Parties de Bruno (la plus récente d'abord) : 6 classées finies (seules les 5 dernières sont rendues), une non classée,
-- une contre l'IA, une en cours, une annulée. Résultats et dates posés sans déclencheurs (rôle de réplication).
insert into public.games (id, black_id, white_id, created_by, size, status, result, rated, updated_at) values
  ('11111111-0000-4000-8000-000000000001', :bruno, :alice, :bruno, 9, 'finished', 'B+R', true, now() - interval '1 hour'),
  ('11111111-0000-4000-8000-000000000002', :alice, :bruno, :alice, 9, 'finished', 'B+5.5', true, now() - interval '2 hours'),
  ('11111111-0000-4000-8000-000000000003', :bruno, :eve, :bruno, 13, 'finished', 'W+T', true, now() - interval '3 hours'),
  ('11111111-0000-4000-8000-000000000004', :gael, :bruno, :gael, 9, 'finished', 'W+R', true, now() - interval '4 hours'),
  ('11111111-0000-4000-8000-000000000005', :bruno, :chloe, :bruno, 19, 'finished', 'B+12.5', true, now() - interval '5 hours'),
  ('11111111-0000-4000-8000-000000000006', :bruno, :eve, :bruno, 9, 'finished', 'B+R', true, now() - interval '6 hours'),
  ('11111111-0000-4000-8000-000000000007', :bruno, :eve, :bruno, 9, 'finished', 'B+R', false, now() - interval '10 minutes'),
  ('11111111-0000-4000-8000-000000000008', :bruno, :eve, :bruno, 9, 'active', null, true, now()),
  ('11111111-0000-4000-8000-000000000009', :bruno, :eve, :bruno, 9, 'aborted', null, true, now());
insert into public.games (id, black_id, created_by, size, status, result, bot_id, updated_at)
  values ('11111111-0000-4000-8000-000000000010', :bruno, :bruno, 9, 'finished', 'B+R', 'caillou', now());
set local session_replication_role = replica;
update public.games g set result = v.resultat, updated_at = v.le
  from (values ('11111111-0000-4000-8000-000000000001'::uuid, 'B+R', now() - interval '1 hour'),
               ('11111111-0000-4000-8000-000000000002'::uuid, 'B+5.5', now() - interval '2 hours'),
               ('11111111-0000-4000-8000-000000000003'::uuid, 'W+T', now() - interval '3 hours'),
               ('11111111-0000-4000-8000-000000000004'::uuid, 'W+R', now() - interval '4 hours'),
               ('11111111-0000-4000-8000-000000000005'::uuid, 'B+12.5', now() - interval '5 hours'),
               ('11111111-0000-4000-8000-000000000006'::uuid, 'B+R', now() - interval '6 hours'),
               ('11111111-0000-4000-8000-000000000007'::uuid, 'B+R', now() - interval '10 minutes'),
               ('11111111-0000-4000-8000-000000000010'::uuid, 'B+R', now())) v(id, resultat, le)
  where g.id = v.id;
set local session_replication_role = origin;

-- 1. Visiteur sans droit ; sans session, en session anonyme (claim ou auth.users) et sans pseudo : refusé.
set local role anon;
select pg_temp.deconnecte();
select pg_temp.doit_refuser('select public.profil_public(''Bruno'')', 'permission denied');
set local role authenticated;
select pg_temp.doit_refuser('select public.profil_public(''Bruno'')', 'JGC01');
select pg_temp.connecte(:denis, true);
select pg_temp.doit_refuser('select public.profil_public(''Bruno'')', 'JGC01');
select pg_temp.connecte(:denis);
select pg_temp.doit_refuser('select public.profil_public(''Bruno'')', 'JGC01');
select pg_temp.connecte(:chloe);
select pg_temp.doit_refuser('select public.profil_public(''Bruno'')', 'JGP01');
-- La table du plafond est fermée à l'app.
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser('select * from public.profils_consultes', 'permission denied');
select pg_temp.doit_refuser('insert into public.profils_consultes (user_id) values (''aaaaaaaa-0000-4000-8000-000000000001'')', 'permission denied');
select pg_temp.doit_refuser('select public.purger_profils_consultes()', 'permission denied');

-- 2. Pseudo inconnu, mal formé, e-mail, compte anonyme avec pseudo, nul : rien (null), sans erreur.
select pg_temp.connecte(:alice);
select pg_temp.egal(public.profil_public('Personne'), null::jsonb, 'inconnu');
select pg_temp.egal(public.profil_public('a b'), null::jsonb, 'mal formé');
select pg_temp.egal(public.profil_public('bruno-secret@exemple.test'), null::jsonb, 'e-mail');
select pg_temp.egal(public.profil_public('Fantome'), null::jsonb, 'compte anonyme');
select pg_temp.egal(public.profil_public(null), null::jsonb, 'nul');
select pg_temp.egal(public.profil_public(''), null::jsonb, 'vide');

-- 3. Alice regarde Bruno : pseudo exact sans casse, cote arrondie, 6 parties classées, les 5 dernières, aucun lien.
select pg_temp.egal(public.profil_public('bruno') ->> 'pseudo', 'Bruno', 'pseudo (sans casse)');
select pg_temp.egal(public.profil_public('  Bruno ') ->> 'pseudo', 'Bruno', 'espaces autour ignorés');
select pg_temp.egal((public.profil_public('Bruno') ->> 'cote')::integer, 1620, 'cote arrondie');
select pg_temp.egal((public.profil_public('Bruno') ->> 'provisoire')::boolean, false, 'cote sûre');
select pg_temp.egal((public.profil_public('Bruno') ->> 'parties_classees')::integer, 6, 'nombre de parties classées (ni IA, ni non classée, ni en cours, ni annulée)');
select pg_temp.egal(public.profil_public('Bruno') ->> 'lien', 'aucun', 'aucun lien');
select pg_temp.egal(jsonb_array_length(public.profil_public('Bruno') -> 'parties'), 5, '5 dernières parties');
select pg_temp.egal(pg_temp.parties(public.profil_public('Bruno')),
  'Alice:true:9:noir,Alice:false:9:blanc,Eve:false:13:noir,Gael:true:9:blanc,-:true:19:noir',
  'parties : la plus récente d''abord, résultat vu de Bruno, Chloé (sans pseudo) = un joueur');
select pg_temp.egal(public.profil_public('Bruno') -> 'parties' -> 0 ->> 'toi', 'true', 'Alice est l''adversaire de la première partie');
select pg_temp.egal(public.profil_public('Bruno') -> 'parties' -> 2 ->> 'toi', 'false', 'Eve n''est pas Alice');
select pg_temp.egal(public.profil_public('Bruno') -> 'parties' -> 0 ->> 'le', to_char((now() - interval '1 hour') at time zone 'Europe/Paris', 'YYYY-MM-DD'), 'date de la partie (jour de Paris, comme la fonction)');
-- Les clés rendues, et rien d'autre.
select pg_temp.egal((select string_agg(k, ',' order by k) from jsonb_object_keys(public.profil_public('Bruno')) k),
  'cote,lien,parties,parties_classees,provisoire,pseudo', 'clés du profil');
select pg_temp.egal((select string_agg(k, ',' order by k) from jsonb_object_keys(public.profil_public('Bruno') -> 'parties' -> 0) k),
  'adversaire,couleur,gagnee,le,taille,toi', 'clés d''une partie');
-- Rien de privé : e-mail, identifiant, écart, volatilité, série, cote des problèmes, preuve d'accord, IA.
select pg_temp.absent(public.profil_public('Bruno'), 'bruno-secret', 'e-mail');
select pg_temp.absent(public.profil_public('Bruno'), 'exemple.test', 'domaine de l''e-mail');
select pg_temp.absent(public.profil_public('Bruno'), 'bbbbbbbb-0000', 'identifiant de Bruno');
select pg_temp.absent(public.profil_public('Bruno'), 'aaaaaaaa-0000', 'identifiant d''Alice');
select pg_temp.absent(public.profil_public('Bruno'), '11111111-0000', 'identifiant d''une partie');
select pg_temp.absent(public.profil_public('Bruno'), '60.5', 'écart de la cote');
select pg_temp.absent(public.profil_public('Bruno'), '0.0601', 'volatilité');
select pg_temp.absent(public.profil_public('Bruno'), '1777', 'cote des problèmes');
select pg_temp.absent(public.profil_public('Bruno'), '1619.6', 'cote non arrondie');
select pg_temp.absent(public.profil_public('Bruno'), '1999-12-31', 'preuve d''accord');
select pg_temp.absent(public.profil_public('Bruno'), 'caillou', 'partie contre l''IA');
select pg_temp.absent(public.profil_public('Bruno'), '"17"', 'série');

-- 4. Son propre profil : lien « moi ».
select pg_temp.egal(public.profil_public('Alice') ->> 'lien', 'moi', 'soi-même');
select pg_temp.egal((public.profil_public('Alice') ->> 'parties_classees')::integer, 2, 'ses propres parties classées');

-- 5. Lien d'amitié : Alice demande Bruno (envoyee), Bruno voit « recue », il accepte : amis des deux côtés.
select pg_temp.egal(public.demander_ami('Bruno'), 'envoyee', 'demande envoyée');
select pg_temp.egal(public.profil_public('Bruno') ->> 'lien', 'envoyee', 'demande envoyée vue par Alice');
select pg_temp.connecte(:bruno);
select pg_temp.egal(public.profil_public('Alice') ->> 'lien', 'recue', 'demande reçue vue par Bruno');
select pg_temp.egal(public.repondre_ami('Alice', true), 'amis', 'acceptée');
select pg_temp.egal(public.profil_public('Alice') ->> 'lien', 'amis', 'amis (Bruno)');
select pg_temp.connecte(:alice);
select pg_temp.egal(public.profil_public('Bruno') ->> 'lien', 'amis', 'amis (Alice)');
-- Un joueur neuf : cote de départ, provisoire, aucune partie.
select pg_temp.egal((public.profil_public('Gael') ->> 'provisoire')::boolean, true, 'cote provisoire d''un joueur neuf');
select pg_temp.egal((public.profil_public('Gael') ->> 'parties_classees')::integer, 1, 'une partie classée pour Gael');
select pg_temp.egal(pg_temp.parties(public.profil_public('Gael')), 'Bruno:false:9:noir', 'la partie de Gael vue de Gael');

-- 6. Blocage : Gael bloque Alice. Alice ne voit plus Gael (rien, comme un inconnu), Gael ne voit plus Alice ;
--    dans le profil de Bruno, Gael devient « un joueur » pour Alice. Bruno, lui, voit toujours Gael. Débloqué : tout revient.
select pg_temp.connecte(:gael);
select pg_temp.egal(public.bloquer_joueur('Alice'), true, 'Gael bloque Alice');
select pg_temp.egal(public.profil_public('Alice'), null::jsonb, 'le bloqueur ne voit pas la bloquée');
select pg_temp.connecte(:alice);
select pg_temp.egal(public.profil_public('Gael'), null::jsonb, 'la bloquée ne voit pas le bloqueur (rien ne dit le blocage)');
select pg_temp.egal(pg_temp.parties(public.profil_public('Bruno')),
  'Alice:true:9:noir,Alice:false:9:blanc,Eve:false:13:noir,-:true:9:blanc,-:true:19:noir', 'Gael = un joueur pour Alice');
select pg_temp.absent(public.profil_public('Bruno'), 'Gael', 'le pseudo du bloqueur n''apparaît nulle part');
select pg_temp.connecte(:bruno);
select pg_temp.egal(pg_temp.parties(public.profil_public('Bruno')),
  'Alice:true:9:noir,Alice:false:9:blanc,Eve:false:13:noir,Gael:true:9:blanc,-:true:19:noir', 'Bruno voit toujours Gael');
select pg_temp.connecte(:gael);
select pg_temp.egal(public.debloquer_joueur('Alice'), true, 'Gael débloque Alice');
select pg_temp.connecte(:alice);
select pg_temp.egal(public.profil_public('Gael') ->> 'pseudo', 'Gael', 'Gael visible de nouveau');
-- Dans l'autre sens : Alice bloque Eve ; Eve devient « un joueur » dans le profil de Bruno, et son profil n'est plus lu.
select pg_temp.egal(public.bloquer_joueur('Eve'), true, 'Alice bloque Eve');
select pg_temp.egal(public.profil_public('Eve'), null::jsonb, 'Alice ne lit pas le profil d''un joueur qu''elle a bloqué');
select pg_temp.egal(pg_temp.parties(public.profil_public('Bruno')),
  'Alice:true:9:noir,Alice:false:9:blanc,-:false:13:noir,Gael:true:9:blanc,-:true:19:noir', 'Eve = un joueur pour Alice');
select pg_temp.egal(public.debloquer_joueur('Eve'), true, 'Alice débloque Eve');

-- 7. Plafond : 60 consultations par heure, pseudos inconnus compris ; puis JGV01 avec les minutes à attendre ;
--    un autre compte n'est pas gêné ; une heure plus tard, de nouveau possible.
reset role;
delete from public.profils_consultes where user_id = :alice;
set local role authenticated;
select pg_temp.connecte(:alice);
do $$ begin for i in 1..30 loop perform public.profil_public('Bruno'); perform public.profil_public('Inconnu' || i); end loop; end $$;
select pg_temp.doit_refuser('select public.profil_public(''Bruno'')', 'JGV01');
-- L'indice porte les minutes à attendre (1 à 60).
do $$
declare v_hint text;
begin
  perform public.profil_public('Bruno');
  raise exception 'REFUS ATTENDU, mais accepté';
exception when sqlstate 'JGV01' then
  get stacked diagnostics v_hint = pg_exception_hint;
  if v_hint !~ '^\d+$' or v_hint::integer < 1 or v_hint::integer > 60 then
    raise exception 'ÉCHEC indice JGV01 : %', v_hint;
  end if;
end;
$$;
select pg_temp.connecte(:bruno);
select pg_temp.egal(public.profil_public('Alice') ->> 'pseudo', 'Alice', 'Bruno n''est pas gêné par le plafond d''Alice');
reset role;
select pg_temp.egal((select count(*) from public.profils_consultes where user_id = :alice), 60::bigint, '60 consultations notées (le refus n''est pas compté)');
update public.profils_consultes set fait_le = fait_le - interval '61 minutes' where user_id = :alice;
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.profil_public('Bruno') ->> 'pseudo', 'Bruno', 'une heure plus tard : de nouveau possible');
reset role;
select pg_temp.egal((select count(*) from public.profils_consultes where user_id = :alice), 1::bigint, 'lignes de plus d''une heure effacées à l''appel');
-- Purge quotidienne.
insert into public.profils_consultes (user_id, fait_le) values (:bruno, now() - interval '2 hours');
select public.purger_profils_consultes();
select pg_temp.egal((select count(*) from public.profils_consultes where user_id = :bruno and fait_le < now() - interval '1 hour'), 0::bigint, 'purge');

-- 8. Compte supprimé : son journal part avec lui (cascade).
delete from public.profiles where id = :gael;
select pg_temp.egal((select count(*) from public.profils_consultes where user_id = :gael), 0::bigint, 'journal effacé avec le profil');

-- 9. Structure : security definer à search_path vide, droits, RLS, aucun droit anon.
select pg_temp.egal((select bool_and(p.prosecdef and p.proconfig[1] = 'search_path=""') from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('profil_public', 'purger_profils_consultes')), true, 'security definer, search_path vide');
select pg_temp.egal(has_function_privilege('anon', 'public.profil_public(text)', 'execute'), false, 'anon : pas de profil public');
select pg_temp.egal(has_function_privilege('authenticated', 'public.profil_public(text)', 'execute'), true, 'authenticated : profil public');
select pg_temp.egal(has_function_privilege('authenticated', 'public.purger_profils_consultes()', 'execute'), false, 'purge fermée');
select pg_temp.egal(has_function_privilege('service_role', 'public.purger_profils_consultes()', 'execute'), false, 'purge fermée au service');
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.profils_consultes'::regclass), true, 'RLS sur profils_consultes');
select pg_temp.egal((select count(*) from pg_policy where polrelid = 'public.profils_consultes'::regclass), 0::bigint, 'aucune politique (voulu)');
select pg_temp.egal(has_table_privilege('anon', 'public.profils_consultes', 'select'), false, 'anon ne lit pas le journal');
select pg_temp.egal(has_table_privilege('authenticated', 'public.profils_consultes', 'select'), false, 'authenticated ne lit pas le journal');
select pg_temp.egal(has_table_privilege('anon', 'public.profiles', 'select'), false, 'anon ne lit toujours pas profiles (#530)');

\echo 'profil_public : tous les cas passent.'
rollback;
