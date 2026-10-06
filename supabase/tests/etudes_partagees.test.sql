-- Tests rejouables du partage d'une étude (issue #449, suite de #364). Transaction annulée à la fin : aucune donnée ne
-- reste. Le jeton est simulé par request.jwt.claims (sub, role, is_anonymous), comme PostgREST. Voir supabase/tests/LISEZMOI.md.
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
-- Une étude 9 × 9 au format partagé (src/go/etude.ts puis `sgfPublic`) : position posée, trait, variante de `i` coups.
create function pg_temp.etude(i int default 1) returns text
language sql as $$
  select '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]AB[cc][dd]AW[ee]PL[B]'
    || coalesce((select string_agg(case when k % 2 = 1 then ';B[' else ';W[' end || chr(97 + k % 9) || chr(102 + (k / 9) % 3) || ']', '')
                 from generate_series(1, i) k), '')
    || ')'
$$;
create function pg_temp.partager(i int default 1, p_coup int default 0) returns text
language sql as $$ select public.partager_etude(pg_temp.etude(i), 9::smallint, p_coup::smallint) $$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

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

-- 0. Lignes d'avant #449 : `objet` vaut `partie` (rien n'est réécrit).
select pg_temp.egal((select column_default from information_schema.columns
  where table_schema = 'public' and table_name = 'parties_partagees' and column_name = 'objet'), '''partie''::text', 'objet : partie par défaut');

-- 1. Visiteur sans connexion : pas de partage.
set local role anon;
select pg_temp.doit_refuser('select pg_temp.partager()', 'permission denied');
reset role;

set local role authenticated;
-- 2. Anonyme, compte sans pseudo, jeton sans utilisateur : refusés (#343).
select pg_temp.connecte(:bruno, true);
select pg_temp.doit_refuser('select pg_temp.partager()', 'Crée ton compte');
select pg_temp.connecte(:denis);
select pg_temp.doit_refuser('select pg_temp.partager()', 'Choisis ton pseudo');
select pg_temp.deconnecte();
select pg_temp.doit_refuser('select pg_temp.partager()', 'Crée ton compte');

-- 3. Alice partage son étude : un jeton ; la même étude : le même lien ; une autre variante : un autre lien.
select pg_temp.connecte(:alice);
select pg_temp.partager(2, 2) as j1 \gset
select pg_temp.egal(:'j1' ~ '^[A-Za-z0-9_-]{32}$', true, 'jeton de 32 caractères');
select pg_temp.egal(pg_temp.partager(2, 1), :'j1', 'même étude : même lien');
select pg_temp.egal((select coup from public.parties_partagees where jeton = :'j1'), 1::smallint, 'coup montré mis à jour');
select pg_temp.partager(3) as j2 \gset
select pg_temp.egal(:'j2' <> :'j1', true, 'autre variante : autre lien');
select pg_temp.egal((select objet from public.parties_partagees where jeton = :'j1'), 'etude', 'objet : etude');
select pg_temp.egal((select joueur is null and adversaire is null from public.parties_partagees where jeton = :'j1'), true, 'ni camp ni adversaire');
-- Position seule, sans variante : acceptée. Variante seule sur un goban vide : acceptée. 13 et 19 lignes : acceptés.
select pg_temp.egal(pg_temp.partager(0) ~ '^[A-Za-z0-9_-]{32}$', true, 'position sans variante');
select pg_temp.egal(public.partager_etude('(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese];B[ee])', 9::smallint, 0::smallint) ~ '^[A-Za-z0-9_-]{32}$', true, 'variante seule');
select pg_temp.egal(public.partager_etude('(;GM[1]FF[4]CA[UTF-8]SZ[13]KM[6.5]RU[Japanese]AB[gg]PL[W])', 13::smallint, 0::smallint) ~ '^[A-Za-z0-9_-]{32}$', true, '13 lignes');
select pg_temp.egal(public.partager_etude('(;GM[1]FF[4]CA[UTF-8]SZ[19]KM[6.5]RU[Japanese]AW[pd]PL[B];B[dp])', 19::smallint, 1::smallint) ~ '^[A-Za-z0-9_-]{32}$', true, '19 lignes');
-- La même suite partagée comme partie : un lien distinct, qui reste une partie.
select public.partager_partie(pg_temp.etude(2), 9::smallint, null, null, 0::smallint) as jp \gset
select pg_temp.egal(:'jp' <> :'j1', true, 'même SGF en partie : autre lien');
select pg_temp.egal((select objet from public.parties_partagees where jeton = :'jp'), 'partie', 'partager_partie : objet partie');
select pg_temp.egal(pg_temp.partager(2, 1), :'j1', 'l''étude garde son lien');
select pg_temp.egal((select count(*) from public.parties_partagees), 7::bigint, 'Alice lit ses sept partages');

-- 4. Rien d'autre que la position et la variante : nom, commentaire, date, résultat, goban vide, taille autre que
--    9, 13 ou 19, taille incohérente, coup hors limites, SGF trop long : refusés.
select pg_temp.doit_refuser($$select public.partager_etude('(;GM[1]FF[4]SZ[9]PB[Jean Dupont]AB[cc])', 9::smallint, 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_etude('(;GM[1]FF[4]SZ[9]AB[cc]C[mon adresse])', 9::smallint, 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_etude('(;GM[1]FF[4]SZ[9]DT[2026-10-06]AB[cc])', 9::smallint, 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_etude('(;GM[1]FF[4]SZ[9]RE[B+R]AB[cc])', 9::smallint, 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_etude('(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]PL[B])', 9::smallint, 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_etude('(;GM[1]FF[4]SZ[7]AB[cc])', 7::smallint, 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_etude(pg_temp.etude(), 13::smallint, 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_etude(pg_temp.etude(), 9::smallint, 2000::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_etude(pg_temp.etude(), 9::smallint, null)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_etude('pas un sgf', 9::smallint, 0::smallint)$$, 'illisible');
select pg_temp.doit_refuser($$select public.partager_etude('(;GM[1]SZ[9]' || repeat(';B[aa]', 3000) || ')', 9::smallint, 0::smallint)$$, 'illisible');
select pg_temp.egal((select count(*) from public.parties_partagees), 7::bigint, 'refus : aucune ligne en plus');

-- 5. Lecture publique par le jeton, sans compte : objet, étude, pseudo. Partie : objet partie. Rien d'autre.
reset role;
set local role anon;
select pg_temp.egal((select format('%s|%s|%s|%s|%s|%s|%s', objet, sgf, taille, joueur, adversaire, coup, pseudo) from public.lire_partage(:'j1')),
  format('etude|%s|9|||1|Alice', pg_temp.etude(2)), 'lecture sans compte');
select pg_temp.egal((select objet from public.lire_partage(:'jp')), 'partie', 'partie lue par lire_partage');
-- Applis déjà installées : `lire_partie_partagee` lit aussi l'étude (montrée comme une partie à revoir).
select pg_temp.egal((select sgf from public.lire_partie_partagee(:'j1')), pg_temp.etude(2), 'ancienne lecture intacte');
select pg_temp.egal((select count(*) from public.lire_partage(repeat('Q', 32))), 0::bigint, 'jeton inconnu : rien');
select pg_temp.egal((select count(*) from public.lire_partage('trop-court')), 0::bigint, 'jeton mal formé : rien');
select pg_temp.egal((select count(*) from public.lire_partage(null)), 0::bigint, 'jeton absent : rien');
select pg_temp.egal((select count(*) from public.lire_partage('%')), 0::bigint, 'joker : rien');
select pg_temp.doit_refuser('select * from public.parties_partagees', 'permission denied');
reset role;
set local role authenticated;

-- 6. Chloé ne lit pas la table d'Alice, ne retire pas son lien ; la même étude chez elle : son propre lien.
select pg_temp.connecte(:chloe);
select pg_temp.egal((select count(*) from public.parties_partagees), 0::bigint, 'Chloé ne lit pas la table d''Alice');
select pg_temp.egal((select pseudo from public.lire_partage(:'j2')), 'Alice', 'Chloé lit par le jeton');
select pg_temp.egal(public.retirer_partie_partagee(:'j1'), false, 'Chloé ne retire pas le lien d''Alice');
select pg_temp.egal(pg_temp.partager(2) <> :'j1', true, 'même étude chez Chloé : son lien');

-- 7. Alice retire son étude (même fonction que pour une partie) : le lien ne montre plus rien.
select pg_temp.connecte(:alice);
select pg_temp.egal(public.retirer_partie_partagee(:'j2'), true, 'Alice retire son lien');
select pg_temp.egal((select count(*) from public.lire_partage(:'j2')), 0::bigint, 'lien retiré : rien');

-- 8. Plafonds communs aux parties et aux études : 20 nouveaux liens par 24 heures (JGS01), 200 au plus (JGS02).
select count(*) from generate_series(10, 23) k, lateral pg_temp.partager(k);
select pg_temp.egal((select count(*) from public.parties_partagees where cree_le > now() - interval '24 hours'), 20::bigint, '20 liens aujourd''hui');
select pg_temp.doit_refuser('select pg_temp.partager(100)', 'Reviens demain');
select pg_temp.doit_refuser($$select public.partager_partie('(;GM[1]FF[4]SZ[9];B[aa])', 9::smallint, 1::smallint, null, 0::smallint)$$, 'Reviens demain');
select pg_temp.egal(pg_temp.partager(2), :'j1', 'plafond du jour : une étude déjà là revient');
reset role;
update public.parties_partagees set cree_le = now() - interval '2 days';
insert into public.parties_partagees (jeton, user_id, empreinte, sgf, taille, cree_le)
  select lpad(k::text, 32, 'Z'), :alice, encode(extensions.digest(k::text, 'sha256'), 'hex'), pg_temp.etude(), 9, now() - interval '3 days'
  from generate_series(1, 180) k;
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal((select count(*) from public.parties_partagees), 200::bigint, '200 liens');
select pg_temp.doit_refuser('select pg_temp.partager(101)', 'déjà 200');
reset role;

-- 9. « Supprimer mon compte » : ses études partagées partent avec lui ; celle de Chloé reste.
set local role authenticated;
select pg_temp.connecte(:alice);
select public.delete_my_account();
reset role;
select pg_temp.egal((select count(*) from public.lire_partage(:'j1')), 0::bigint, 'compte supprimé : lien mort');
select pg_temp.egal((select count(*) from public.parties_partagees where user_id = :chloe), 1::bigint, 'étude de Chloé intacte');

-- 10. Structure : droits, fonctions sûres.
select pg_temp.egal(has_function_privilege('anon', 'public.lire_partage(text)', 'execute'), true, 'anon lit par le jeton');
select pg_temp.egal(has_function_privilege('anon', 'public.partager_etude(text, smallint, smallint)', 'execute'), false, 'anon ne partage pas');
select pg_temp.egal(has_function_privilege('authenticated', 'public.partager_etude(text, smallint, smallint)', 'execute'), true, 'un compte partage');
select pg_temp.egal(has_column_privilege('authenticated', 'public.parties_partagees', 'objet', 'update'), false, 'objet : pas de modification directe');
select pg_temp.egal((select bool_and(prosecdef and proconfig = array['search_path=""']) from pg_proc
  where oid in ('public.partager_etude(text, smallint, smallint)'::regprocedure, 'public.lire_partage(text)'::regprocedure)),
  true, 'security definer, search_path vide');

\echo 'etudes_partagees : tous les cas passent.'
rollback;
