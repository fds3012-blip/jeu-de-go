-- Tests rejouables de la révision espacée synchronisée (issue #469). Transaction annulée à la fin : aucune donnée ne reste.
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
  if sqlerrm not ilike '%' || p_motif || '%' and sqlstate <> p_motif then
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
-- Une erreur de partie 9 × 9 (position d'avant, Noir au trait, réponse E3 = 58), avec le nom de l'adversaire en trop.
create function pg_temp.contenu() returns jsonb
language sql as $$
  select jsonb_build_object('creeLe', '2026-10-01T10:00:00.000Z', 'size', 9,
    'rows', jsonb_build_array('.........', '.........', '..O...X..', '.........', '....X....', '.........', '..X...O..', '.........', '.........'),
    'toPlay', 1, 'reponses', jsonb_build_array(58), 'joue', 0, 'coup', 14, 'adversaire', 'Léa');
$$;
create function pg_temp.ligne(p_cle text, p_etape int, p_prochain text, p_maj bigint, p_contenu jsonb default null) returns jsonb
language sql as $$
  select jsonb_strip_nulls(jsonb_build_object('cle', p_cle, 'etape', p_etape, 'prochain', p_prochain, 'echecs', 1, 'maj', p_maj, 'contenu', p_contenu));
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

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

-- 1. Visiteur sans connexion : aucun droit.
set local role anon;
select pg_temp.doit_refuser('select * from public.revisions', 'permission denied');
select pg_temp.doit_refuser('select public.echanger_revisions(''[]'')', 'permission denied');
reset role;

set local role authenticated;
-- 2. Anonyme, jeton sans utilisateur, jeton qui se dit non anonyme pour un compte anonyme : refusés.
select pg_temp.connecte(:bruno, true);
select pg_temp.doit_refuser('select public.echanger_revisions(''[]'')', 'Crée ton compte');
select pg_temp.deconnecte();
select pg_temp.doit_refuser('select public.echanger_revisions(''[]'')', 'Crée ton compte');
select pg_temp.connecte(:bruno, false);
select pg_temp.doit_refuser('select public.echanger_revisions(''[]'')', 'Crée ton compte');

-- 3. Première lecture : vide. Aucune écriture directe, même sur ses lignes ; fonctions internes fermées.
select pg_temp.connecte(:alice);
select pg_temp.egal(public.echanger_revisions('[]'), '[]'::jsonb, 'lecture à vide');
select pg_temp.egal(public.echanger_revisions(null), '[]'::jsonb, 'null = lecture');
select pg_temp.doit_refuser($$insert into public.revisions (user_id, cle, genre, etape, prochain, maj) values ('aaaaaaaa-0000-4000-8000-000000000001', 'pb:b1', 'probleme', 0, current_date, 1)$$, 'permission denied');
select pg_temp.doit_refuser($$update public.revisions set etape = 0$$, 'permission denied');
select pg_temp.doit_refuser($$delete from public.revisions$$, 'permission denied');
select pg_temp.doit_refuser($$select public.purger_revisions()$$, '42501');
select pg_temp.doit_refuser($$select public.revision_contenu('{}')$$, '42501');

-- 4. Lignes valides gardées, le reste ignoré sans erreur ; le nom de l'adversaire n'est jamais gardé.
select pg_temp.egal(jsonb_array_length(public.echanger_revisions(jsonb_build_array(
  pg_temp.ligne('erreur-abc12', 0, to_char(current_date + 1, 'YYYY-MM-DD'), 1000, pg_temp.contenu()),
  pg_temp.ligne('pb:b1', 2, to_char(current_date + 7, 'YYYY-MM-DD'), 1000),
  -- refusées : clé inconnue, étape hors bornes, date absente, date impossible, date trop loin, maj dans le futur,
  -- maj décimale, pas un objet
  pg_temp.ligne('email:alice', 0, to_char(current_date, 'YYYY-MM-DD'), 1000),
  pg_temp.ligne('pb:b2', 6, to_char(current_date, 'YYYY-MM-DD'), 1000),
  pg_temp.ligne('pb:b3', 1, null, 1000),
  pg_temp.ligne('pb:b4', 1, '2026-02-31', 1000),
  pg_temp.ligne('pb:b5', 1, to_char(current_date + 60, 'YYYY-MM-DD'), 1000),
  pg_temp.ligne('pb:b6', 1, to_char(current_date, 'YYYY-MM-DD'), (extract(epoch from now()) * 1000)::bigint + 2 * 86400000),
  '{"cle":"pb:b7","etape":1,"prochain":"2026-10-08","echecs":0,"maj":1.5}'::jsonb,
  '"pb:b8"'::jsonb
))), 2, 'deux lignes gardées');
select pg_temp.egal((select count(*) from public.revisions), 2::bigint, 'deux lignes en base');
select pg_temp.egal((select contenu ? 'adversaire' from public.revisions where cle = 'erreur-abc12'), false, 'adversaire jamais gardé');
select pg_temp.egal((select contenu -> 'reponses' from public.revisions where cle = 'erreur-abc12'), '[58]'::jsonb, 'position gardée');
select pg_temp.egal((select genre from public.revisions where cle = 'pb:b1'), 'probleme', 'genre déduit');
-- Position mal formée : la ligne est gardée sans position.
select public.echanger_revisions(jsonb_build_array(pg_temp.ligne('erreur-mal', 0, to_char(current_date + 1, 'YYYY-MM-DD'), 1000,
  pg_temp.contenu() || '{"rows":["..."]}')));
select pg_temp.egal((select contenu from public.revisions where cle = 'erreur-mal'), null::jsonb, 'position mal formée ignorée');

-- 5. Le plus récent gagne, ligne par ligne ; à date égale, la ligne gardée reste.
select public.echanger_revisions(jsonb_build_array(
  pg_temp.ligne('pb:b1', 0, to_char(current_date + 1, 'YYYY-MM-DD'), 999),   -- plus ancien : ignoré
  pg_temp.ligne('erreur-abc12', 3, to_char(current_date + 14, 'YYYY-MM-DD'), 1000)  -- même date : ignoré
));
select pg_temp.egal((select etape from public.revisions where cle = 'pb:b1'), 2::smallint, 'plus ancien ignoré');
select pg_temp.egal((select etape from public.revisions where cle = 'erreur-abc12'), 0::smallint, 'même date ignorée');
select public.echanger_revisions(jsonb_build_array(pg_temp.ligne('erreur-abc12', 1, to_char(current_date + 3, 'YYYY-MM-DD'), 2000)));
select pg_temp.egal((select etape from public.revisions where cle = 'erreur-abc12'), 1::smallint, 'plus récent gagne');
select pg_temp.egal((select contenu is not null from public.revisions where cle = 'erreur-abc12'), true, 'position gardée sans renvoi');
-- Acquise : la position est effacée.
select pg_temp.egal(public.echanger_revisions(jsonb_build_array(pg_temp.ligne('erreur-abc12', 5, null, 3000))) -> 0,
  '{"cle":"erreur-abc12","etape":5,"prochain":null,"echecs":1,"maj":3000,"contenu":null}'::jsonb, 'acquise, sans position');

-- 6. Chacun ne lit que ses lignes.
select pg_temp.connecte(:chloe);
select pg_temp.egal((select count(*) from public.revisions), 0::bigint, 'Chloé ne voit pas Alice');
select pg_temp.egal(public.echanger_revisions('[]'), '[]'::jsonb, 'Chloé : file vide');
select pg_temp.connecte(:bruno, true);
select pg_temp.egal((select count(*) from public.revisions), 0::bigint, 'anonyme : rien');

-- 7. Envois illisibles ou trop gros : refusés.
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser($$select public.echanger_revisions('{}')$$, 'illisibles');
select pg_temp.doit_refuser($$select public.echanger_revisions((select jsonb_agg(i) from generate_series(1, 201) i))$$, 'Trop de révisions');

-- 8. 500 lignes au plus par joueur : les nouvelles au-delà sont ignorées, les existantes se mettent à jour.
select public.echanger_revisions((select jsonb_agg(pg_temp.ligne('pb:x' || i, 0, to_char(current_date + 1, 'YYYY-MM-DD'), 10)) from generate_series(1, 200) i));
select public.echanger_revisions((select jsonb_agg(pg_temp.ligne('pb:y' || i, 0, to_char(current_date + 1, 'YYYY-MM-DD'), 10)) from generate_series(1, 200) i));
select public.echanger_revisions((select jsonb_agg(pg_temp.ligne('pb:z' || i, 0, to_char(current_date + 1, 'YYYY-MM-DD'), 10)) from generate_series(1, 200) i));
select pg_temp.egal((select count(*) from public.revisions), 500::bigint, '500 lignes au plus');
select public.echanger_revisions(jsonb_build_array(pg_temp.ligne('pb:b1', 3, to_char(current_date + 14, 'YYYY-MM-DD'), 5000)));
select pg_temp.egal((select etape from public.revisions where cle = 'pb:b1'), 3::smallint, 'mise à jour au plafond');
select pg_temp.egal(jsonb_array_length(public.echanger_revisions('[]')), 500, 'lecture plafonnée');

-- 9. Purge : acquises depuis plus de 90 jours, lignes sans changement depuis 400 jours ; le reste est gardé.
reset role;
update public.revisions set modifie_le = now() - interval '91 days' where cle in ('erreur-abc12', 'pb:b1');
update public.revisions set modifie_le = now() - interval '401 days' where cle = 'erreur-mal';
select pg_temp.egal(public.purger_revisions(), 2, 'acquise ancienne et ligne abandonnée effacées');
select pg_temp.egal((select count(*) from public.revisions where cle = 'pb:b1'), 1::bigint, 'non acquise de 91 jours gardée');

-- 10. Suppression du compte : les lignes partent avec lui (cascade).
delete from auth.users where id = :alice;
select pg_temp.egal((select count(*) from public.revisions where user_id = :alice), 0::bigint, 'cascade');

-- 11. Droits et search_path des fonctions.
select pg_temp.egal((select bool_and(p.proconfig @> array['search_path=""']) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('echanger_revisions', 'purger_revisions', 'revision_contenu')), true, 'search_path vide');
select pg_temp.egal(has_function_privilege('anon', 'public.echanger_revisions(jsonb)', 'execute'), false, 'anon sans droit');
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.revisions'::regclass), true, 'RLS active');

rollback;
\o
\echo 'revisions_espacees : OK'
