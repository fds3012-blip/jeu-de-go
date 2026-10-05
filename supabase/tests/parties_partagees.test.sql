-- Tests rejouables du lien de revue en lecture seule (issue #364). Transaction annulée à la fin : aucune donnée ne reste.
-- Le jeton est simulé par request.jwt.claims (sub, role, is_anonymous), comme PostgREST. Voir supabase/tests/LISEZMOI.md.
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
language sql as $$ select set_config('request.jwt.claims', '{"role":"authenticated"}', true); $$;
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
-- Une partie 9 × 9 au format partagé (src/app/partage.ts, `sgfPublic`) ; `i` ajoute des coups, donc change l'empreinte.
create function pg_temp.sgf(i int default 0) returns text
language sql as $$
  select '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]RE[B+1.5];B[ee];W[cc]'
    || coalesce((select string_agg(';B[' || chr(97 + k % 9) || chr(97 + (k / 9) % 9) || ']', '') from generate_series(1, i) k), '')
    || ')'
$$;
-- Partage d'Alice (ou de qui est connecté) : jeton rendu.
create function pg_temp.partager(i int default 0, p_coup int default 2, p_adversaire text default 'Tigre') returns text
language sql as $$ select public.partager_partie(pg_temp.sgf(i), 9::smallint, 1::smallint, p_adversaire, p_coup::smallint) $$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Alice et Chloé ont un compte avec pseudo ; Bruno est anonyme ; Denis a un compte sans pseudo.
insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', null, true),
  ('cccccccc-0000-4000-8000-000000000003', 'chloe@exemple.test', false),
  ('dddddddd-0000-4000-8000-000000000004', 'denis@exemple.test', false);
insert into public.profiles (id) values
  ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002'), ('cccccccc-0000-4000-8000-000000000003'),
  ('dddddddd-0000-4000-8000-000000000004')
  on conflict do nothing;
update public.profiles set username = 'Alice' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
update public.profiles set username = 'Chloe' where id = 'cccccccc-0000-4000-8000-000000000003';
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set chloe '''cccccccc-0000-4000-8000-000000000003'''
\set denis '''dddddddd-0000-4000-8000-000000000004'''

-- 1. Visiteur sans connexion : ni la table, ni le partage.
set local role anon;
select pg_temp.doit_refuser('select * from public.parties_partagees', 'permission denied');
select pg_temp.doit_refuser('select pg_temp.partager()', 'permission denied');
select pg_temp.doit_refuser('select public.retirer_partie_partagee(repeat(''A'', 32))', 'permission denied');
reset role;

set local role authenticated;
-- 2. Anonyme, compte sans pseudo, jeton sans utilisateur : refusés (#343).
select pg_temp.connecte(:bruno, true);
select pg_temp.doit_refuser('select pg_temp.partager()', 'Crée ton compte');
select pg_temp.connecte(:denis);
select pg_temp.doit_refuser('select pg_temp.partager()', 'Choisis ton pseudo');
select pg_temp.deconnecte();
select pg_temp.doit_refuser('select pg_temp.partager()', 'Crée ton compte');

-- 3. Aucune écriture directe, même sur ses propres lignes.
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser(format(
  'insert into public.parties_partagees (jeton, user_id, empreinte, sgf, taille) values (repeat(''A'', 32), %L, repeat(''a'', 64), ''(;SZ[9])'', 9)', :alice),
  'permission denied');

-- 4. Alice partage sa partie : un jeton de 32 caractères. La même partie une seconde fois : le même lien,
--    avec le moment clé mis à jour. Une autre partie : un autre lien.
select pg_temp.partager(0, 2) as j1 \gset
select pg_temp.egal(:'j1' ~ '^[A-Za-z0-9_-]{32}$', true, 'jeton de 32 caractères');
select pg_temp.egal(pg_temp.partager(0, 1), :'j1', 'même partie : même lien');
select pg_temp.egal((select coup from public.parties_partagees where jeton = :'j1'), 1::smallint, 'moment clé mis à jour');
select pg_temp.partager(1, 3) as j2 \gset
select pg_temp.egal(:'j2' <> :'j1', true, 'autre partie : autre lien');
select pg_temp.egal((select count(*) from public.parties_partagees), 2::bigint, 'Alice lit ses deux partages');
-- Partie à deux sur le même appareil (sans camp, sans adversaire) : acceptée.
select pg_temp.egal(public.partager_partie(pg_temp.sgf(2), 9::smallint, null, null, 0::smallint) ~ '^[A-Za-z0-9_-]{32}$', true, 'partie à deux');
-- Adversaire de l'échelle avec un accent : accepté.
select pg_temp.egal(pg_temp.partager(3, 0, 'Éléphant') ~ '^[A-Za-z0-9_-]{32}$', true, 'nom avec accent');

-- 5. Rien d'autre que la partie : un SGF avec un nom, un commentaire, une date ou un lieu est refusé, comme une
--    taille qui ne correspond pas, un adversaire au nom bizarre ou un moment clé hors limites.
select pg_temp.doit_refuser($$select public.partager_partie('(;GM[1]FF[4]SZ[9]PB[Jean Dupont];B[ee])', 9::smallint, 1::smallint, null, 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_partie('(;GM[1]FF[4]SZ[9];B[ee]C[mon adresse : 3 rue X])', 9::smallint, 1::smallint, null, 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_partie('(;GM[1]FF[4]SZ[9]DT[2026-10-05];B[ee])', 9::smallint, 1::smallint, null, 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_partie('(;GM[1]FF[4]SZ[9]RE[Jean];B[ee])', 9::smallint, 1::smallint, null, 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_partie('pas un sgf', 9::smallint, 1::smallint, null, 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_partie(pg_temp.sgf(), 13::smallint, 1::smallint, null, 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_partie(pg_temp.sgf(), 9::smallint, 3::smallint, null, 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_partie(pg_temp.sgf(), 9::smallint, 1::smallint, '<script>', 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_partie(pg_temp.sgf(), 9::smallint, 1::smallint, null, 2000::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_partie('(;GM[1]SZ[9]' || repeat(';B[aa]', 3000) || ')', 9::smallint, 1::smallint, null, 0::smallint)$$, 'illisible');
-- Handicap et passes : acceptés.
select pg_temp.egal(public.partager_partie('(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[0.5]HA[2]AB[cc][gg]PL[W];W[ee];B[];W[tt]RE[W+R])', 9::smallint, 2::smallint, 'Pomme', 1::smallint)
  ~ '^[A-Za-z0-9_-]{32}$', true, 'handicap, passes, abandon');
select pg_temp.egal((select count(*) from public.parties_partagees), 5::bigint, 'refus : aucune ligne en plus');

-- 6. Lecture publique par le jeton, sans compte : la partie, le pseudo, l'adversaire, le moment clé. Rien d'autre.
reset role;
set local role anon;
select pg_temp.egal((select format('%s|%s|%s|%s|%s|%s', sgf, taille, joueur, adversaire, coup, pseudo) from public.lire_partie_partagee(:'j1')),
  format('%s|9|1|Tigre|1|Alice', pg_temp.sgf(0)), 'lecture sans compte');
select pg_temp.egal((select count(*) from public.lire_partie_partagee(repeat('Q', 32))), 0::bigint, 'jeton inconnu : rien');
select pg_temp.egal((select count(*) from public.lire_partie_partagee('trop-court')), 0::bigint, 'jeton mal formé : rien');
select pg_temp.egal((select count(*) from public.lire_partie_partagee(null)), 0::bigint, 'jeton absent : rien');
select pg_temp.egal((select count(*) from public.lire_partie_partagee('%')), 0::bigint, 'joker : rien');
-- Ni les parties de l'appareil, ni les défis : la lecture publique ne passe que par ce jeton.
select pg_temp.doit_refuser('select * from public.parties_perso', 'permission denied');
reset role;
set local role authenticated;

-- 7. Chloé ne lit pas les partages d'Alice dans la table ; seulement par le jeton, comme tout le monde.
select pg_temp.connecte(:chloe);
select pg_temp.egal((select count(*) from public.parties_partagees), 0::bigint, 'Chloé ne lit pas la table d''Alice');
select pg_temp.egal((select pseudo from public.lire_partie_partagee(:'j2')), 'Alice', 'Chloé lit par le jeton');
-- Chloé ne peut pas retirer le lien d'Alice ; elle partage la même partie : son propre lien, distinct.
select pg_temp.egal(public.retirer_partie_partagee(:'j1'), false, 'Chloé ne retire pas le lien d''Alice');
select pg_temp.egal((select count(*) from public.lire_partie_partagee(:'j1')), 1::bigint, 'lien d''Alice intact');
select pg_temp.egal(pg_temp.partager(0) <> :'j1', true, 'même partie chez Chloé : son lien');
-- Aucune modification ni suppression directe.
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser('update public.parties_partagees set coup = 0', 'permission denied');
select pg_temp.doit_refuser('delete from public.parties_partagees', 'permission denied');

-- 8. Alice rend la partie privée : le lien ne montre plus rien ; la retirer deux fois est sans effet.
select pg_temp.egal(public.retirer_partie_partagee(:'j2'), true, 'Alice retire son lien');
select pg_temp.egal((select count(*) from public.lire_partie_partagee(:'j2')), 0::bigint, 'lien retiré : rien');
select pg_temp.egal(public.retirer_partie_partagee(:'j2'), false, 'second retrait sans effet');
select pg_temp.deconnecte();
select pg_temp.doit_refuser(format('select public.retirer_partie_partagee(%L)', :'j1'), 'Connexion requise');

-- 9. Plafonds : 20 nouveaux liens par 24 heures (JGS01), 200 au plus (JGS02). Un lien déjà là se repartage toujours.
select pg_temp.connecte(:alice);
select count(*) from generate_series(10, 25) k, lateral pg_temp.partager(k);
select pg_temp.egal((select count(*) from public.parties_partagees where cree_le > now() - interval '24 hours'), 20::bigint, '20 liens aujourd''hui');
select pg_temp.doit_refuser('select pg_temp.partager(100)', 'Reviens demain');
select pg_temp.egal(pg_temp.partager(0), :'j1', 'plafond du jour : un lien déjà là revient');
reset role;
update public.parties_partagees set cree_le = now() - interval '2 days';
insert into public.parties_partagees (jeton, user_id, empreinte, sgf, taille, cree_le)
  select lpad(k::text, 32, 'Z'), :alice, encode(extensions.digest(k::text, 'sha256'), 'hex'), pg_temp.sgf(), 9, now() - interval '3 days'
  from generate_series(1, 180) k;
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal((select count(*) from public.parties_partagees), 200::bigint, '200 liens');
select pg_temp.doit_refuser('select pg_temp.partager(101)', 'déjà 200');
reset role;

-- 10. « Supprimer mon compte » : ses partages partent avec lui (cascade), ceux de Chloé restent.
set local role authenticated;
select pg_temp.connecte(:alice);
select public.delete_my_account();
reset role;
select pg_temp.egal((select count(*) from public.parties_partagees where user_id = :alice), 0::bigint, 'compte supprimé : partages supprimés');
select pg_temp.egal((select count(*) from public.lire_partie_partagee(:'j1')), 0::bigint, 'compte supprimé : lien mort');
select pg_temp.egal((select count(*) from public.parties_partagees where user_id = :chloe), 1::bigint, 'partage de Chloé intact');

-- 11. Structure : RLS active, droits, fonctions sûres.
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.parties_partagees'::regclass), true, 'RLS active');
select pg_temp.egal(has_table_privilege('anon', 'public.parties_partagees', 'select'), false, 'anon : aucune lecture directe');
select pg_temp.egal(has_table_privilege('authenticated', 'public.parties_partagees', 'insert'), false, 'authenticated : pas d''insertion');
select pg_temp.egal(has_table_privilege('authenticated', 'public.parties_partagees', 'update'), false, 'authenticated : pas de modification');
select pg_temp.egal(has_table_privilege('authenticated', 'public.parties_partagees', 'delete'), false, 'authenticated : pas de suppression');
select pg_temp.egal(has_function_privilege('anon', 'public.lire_partie_partagee(text)', 'execute'), true, 'anon lit par le jeton');
select pg_temp.egal(has_function_privilege('anon', 'public.partager_partie(text, smallint, smallint, text, smallint)', 'execute'), false, 'anon ne partage pas');
select pg_temp.egal(has_function_privilege('anon', 'public.retirer_partie_partagee(text)', 'execute'), false, 'anon ne retire pas');
select pg_temp.egal(has_function_privilege('authenticated', 'public.sgf_partageable(text)', 'execute'), false, 'contrôle interne fermé');
select pg_temp.egal((select bool_and(prosecdef and proconfig = array['search_path=""']) from pg_proc
  where oid in ('public.partager_partie(text, smallint, smallint, text, smallint)'::regprocedure,
                'public.lire_partie_partagee(text)'::regprocedure, 'public.retirer_partie_partagee(text)'::regprocedure)),
  true, 'security definer, search_path vide');

\echo 'parties_partagees : tous les cas passent.'
rollback;
