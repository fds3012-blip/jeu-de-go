-- Tests rejouables de « Mes parties » synchronisées (issue #358). Transaction annulée à la fin : aucune donnée ne reste.
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
-- Une partie au format envoyé par l'appareil ; `i` fait varier la date, donc la clé.
create function pg_temp.partie(i int, p_mode text default 'ordi', p_sgf text default '(;GM[1]SZ[9];B[ee];W[cc])') returns jsonb
language sql as $$
  select jsonb_build_object(
    'cle', encode(extensions.digest(i::text || p_sgf, 'sha256'), 'hex'),
    'joue_le', (timestamptz '2026-09-01 10:00+00' + make_interval(mins => i))::text,
    'sgf', p_sgf, 'mode', p_mode, 'taille', 9, 'joueur', case when p_mode = 'deux' then null else 1 end,
    'adversaire', case when p_mode = 'ordi' then 'pomme' end, 'resultat', 'B+6.5')
$$;
create function pg_temp.envoi(p_de int, p_a int) returns jsonb
language sql as $$ select jsonb_agg(pg_temp.partie(i) order by i) from generate_series(p_de, p_a) i $$;
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

-- 1. Visiteur sans connexion : aucun droit.
set local role anon;
select pg_temp.doit_refuser('select * from public.parties_perso', 'permission denied');
select pg_temp.doit_refuser('select public.enregistrer_parties_perso(pg_temp.envoi(1, 1))', 'permission denied');
reset role;

set local role authenticated;
-- 2. Anonyme, compte sans pseudo, jeton sans utilisateur : refusés (#343).
select pg_temp.connecte(:bruno, true);
select pg_temp.doit_refuser('select public.enregistrer_parties_perso(pg_temp.envoi(1, 1))', 'Crée ton compte');
select pg_temp.connecte(:denis);
select pg_temp.doit_refuser('select public.enregistrer_parties_perso(pg_temp.envoi(1, 1))', 'Choisis ton pseudo');
select pg_temp.deconnecte();
select pg_temp.doit_refuser('select public.enregistrer_parties_perso(pg_temp.envoi(1, 1))', 'Crée ton compte');

-- 3. Aucune écriture directe, même sur ses propres lignes.
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser(format(
  'insert into public.parties_perso (user_id, cle, joue_le, sgf, mode, taille) values (%L, repeat(''a'', 64), now(), ''(;)'', ''ordi'', 9)', :alice),
  'permission denied');

-- 4. Alice envoie trois parties : trois clés rendues, trois lignes.
select pg_temp.egal((select count(*) from public.enregistrer_parties_perso(pg_temp.envoi(1, 3))), 3::bigint, 'trois parties acceptées');
select pg_temp.egal((select count(*) from public.parties_perso), 3::bigint, 'Alice lit ses trois parties');
-- Doublons : renvoyer les mêmes ne crée rien, et les clés sont rendues (elles sont sur le serveur).
select pg_temp.egal((select count(*) from public.enregistrer_parties_perso(pg_temp.envoi(1, 4))), 4::bigint, 'renvoi : quatre clés rendues');
select pg_temp.egal((select count(*) from public.parties_perso), 4::bigint, 'renvoi : une seule nouvelle ligne');
-- La même partie deux fois dans un envoi : une ligne.
select pg_temp.egal((select count(*) from public.enregistrer_parties_perso(jsonb_build_array(pg_temp.partie(5), pg_temp.partie(5)))), 1::bigint, 'doublon dans un envoi');
select pg_temp.egal((select count(*) from public.parties_perso), 5::bigint, 'doublon dans un envoi : une ligne');
-- Valeurs gardées telles qu'envoyées.
select pg_temp.egal((select format('%s|%s|%s|%s|%s', mode, taille, joueur, adversaire, resultat) from public.parties_perso
                     where cle = pg_temp.partie(1) ->> 'cle'), 'ordi|9|1|pomme|B+6.5', 'champs gardés');

-- 5. Entrées mal formées : ignorées, sans bloquer les autres.
select pg_temp.egal((select count(*) from public.enregistrer_parties_perso(jsonb_build_array(
  pg_temp.partie(6),
  pg_temp.partie(7) || '{"mode":"defi"}',
  pg_temp.partie(8) || '{"cle":"pas-une-empreinte"}',
  pg_temp.partie(9) || '{"taille":25}',
  pg_temp.partie(10) || '{"sgf":"pas un sgf"}',
  pg_temp.partie(11) || '{"joue_le":"2099-01-01T00:00:00Z"}',
  pg_temp.partie(12) || jsonb_build_object('adversaire', repeat('x', 41))
))), 1::bigint, 'seule l''entrée valide est acceptée');
-- SGF trop gros (plus de 64 Kio) : ignoré.
select pg_temp.egal((select count(*) from public.enregistrer_parties_perso(jsonb_build_array(
  pg_temp.partie(13, 'import', '(;GM[1]SZ[19]C[' || repeat('x', 65536) || '])')))), 0::bigint, 'SGF trop gros ignoré');
-- Envoi vide, trop long, ou qui n'est pas une liste : refusé.
select pg_temp.doit_refuser('select public.enregistrer_parties_perso(''[]''::jsonb)', 'entre 1 et 50');
select pg_temp.doit_refuser('select public.enregistrer_parties_perso(pg_temp.envoi(100, 150))', 'entre 1 et 50');
select pg_temp.doit_refuser('select public.enregistrer_parties_perso(''{}''::jsonb)', 'entre 1 et 50');
select pg_temp.egal((select count(*) from public.parties_perso), 6::bigint, 'Alice : six parties');

-- 6. Chacun ne lit que les siennes ; la même partie (même clé) peut exister chez deux joueurs.
select pg_temp.connecte(:chloe);
select pg_temp.egal((select count(*) from public.parties_perso), 0::bigint, 'Chloé ne lit pas les parties d''Alice');
select pg_temp.egal((select count(*) from public.enregistrer_parties_perso(pg_temp.envoi(1, 2))), 2::bigint, 'Chloé : mêmes clés, ses lignes');
select pg_temp.egal((select count(*) from public.parties_perso), 2::bigint, 'Chloé lit ses deux parties');
-- Anonyme : rien, même avec l'identifiant d'Alice dans un jeton marqué anonyme.
select pg_temp.connecte(:alice, true);
select pg_temp.egal((select count(*) from public.parties_perso), 0::bigint, 'jeton anonyme : aucune lecture');
select pg_temp.connecte(:alice);
-- Aucune modification ni suppression directe.
select pg_temp.doit_refuser('update public.parties_perso set resultat = ''W+R''', 'permission denied');
select pg_temp.doit_refuser('delete from public.parties_perso', 'permission denied');

-- 7. Plafond : 500 parties au plus. Alice en a 6 ; 10 envois de 50 la remplissent, les plus récentes d'abord.
select count(*) from generate_series(0, 9) k, lateral public.enregistrer_parties_perso(pg_temp.envoi(1000 + 50 * k, 1049 + 50 * k));
select pg_temp.egal((select count(*) from public.parties_perso), 500::bigint, 'plafond : 500 parties');
select pg_temp.egal((select count(*) from public.parties_perso where cle = pg_temp.partie(1499) ->> 'cle'), 1::bigint, 'la plus récente est gardée');
select pg_temp.egal((select count(*) from public.parties_perso where cle = pg_temp.partie(1450) ->> 'cle'), 0::bigint, 'au-delà du plafond : pas gardée');
-- Plafond atteint : une nouvelle partie est refusée ; un renvoi d'une partie déjà là passe toujours.
select pg_temp.doit_refuser('select public.enregistrer_parties_perso(pg_temp.envoi(2000, 2000))', 'déjà 500 parties');
select pg_temp.egal((select count(*) from public.enregistrer_parties_perso(pg_temp.envoi(1, 1))), 1::bigint, 'renvoi au plafond : accepté sans ajout');
select pg_temp.egal((select count(*) from public.parties_perso), 500::bigint, 'toujours 500');
reset role;

-- 8. « Supprimer mon compte » : ses parties partent avec lui (cascade depuis auth.users), celles de Chloé restent.
set local role authenticated;
select pg_temp.connecte(:alice);
select public.delete_my_account();
reset role;
select pg_temp.egal((select count(*) from public.parties_perso where user_id = :alice), 0::bigint, 'compte supprimé : parties supprimées');
select pg_temp.egal((select count(*) from public.parties_perso where user_id = :chloe), 2::bigint, 'parties de Chloé intactes');

-- 9. Structure : RLS active, droits, fonction sûre.
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.parties_perso'::regclass), true, 'RLS active');
select pg_temp.egal(has_table_privilege('anon', 'public.parties_perso', 'select'), false, 'anon : aucune lecture');
select pg_temp.egal(has_table_privilege('authenticated', 'public.parties_perso', 'insert'), false, 'authenticated : pas d''insertion directe');
select pg_temp.egal(has_table_privilege('authenticated', 'public.parties_perso', 'update'), false, 'authenticated : pas de modification');
select pg_temp.egal(has_table_privilege('authenticated', 'public.parties_perso', 'delete'), false, 'authenticated : pas de suppression');
select pg_temp.egal(has_function_privilege('anon', 'public.enregistrer_parties_perso(jsonb)', 'execute'), false, 'fonction fermée à anon');
select pg_temp.egal((select prosecdef and proconfig = array['search_path=""'] from pg_proc where oid = 'public.enregistrer_parties_perso(jsonb)'::regprocedure),
  true, 'security definer, search_path vide');

\echo 'parties_perso : tous les cas passent.'
rollback;
