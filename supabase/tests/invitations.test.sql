-- Tests rejouables d'« Inviter un ami » (issue #729, docs/produit/invitation-2026-10.md). Transaction annulée à la fin :
-- aucune donnée ne reste. Le jeton est simulé par request.jwt.claims (sub, role, is_anonymous), comme PostgREST.
-- Voir supabase/tests/LISEZMOI.md.
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
-- Un joueur de test : identifiant a0000000-…-N, compte avec pseudo (sauf `p_pseudo` nul).
create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('a0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
-- Une partie synchronisée au compte : `coups` coups noirs et blancs en alternance, `mode` et `i` (clé distincte).
create function pg_temp.partie(p_uid uuid, p_coups int, p_mode text default 'ordi', i int default 0) returns void
language sql as $$
  insert into public.parties_perso (user_id, cle, joue_le, sgf, mode, taille)
  select p_uid, md5('cle' || p_uid || i) || md5('cle2' || p_uid || i), now(),
    '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]'
      || coalesce((select string_agg(';' || case when k % 2 = 1 then 'B' else 'W' end || '[' || chr(97 + k % 9) || chr(97 + (k / 9) % 9) || ']', '')
                   from generate_series(1, p_coups) k), '') || ')',
    p_mode, 9
$$;
-- Le statut rendu par valider_invitation pour le joueur connecté.
create function pg_temp.valider(p_code text) returns text language sql as $$
  select statut from public.valider_invitation(p_code)
$$;
create function pg_temp.cadeaux_valider(p_code text) returns text language sql as $$
  select array_to_string(cadeaux, ',') from public.valider_invitation(p_code)
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- 1 Alice (parrain), 2 Bruno (anonyme), 3 Chloé, 4 Denis (sans pseudo), 5 Élise, 6 à 12 : d'autres invités.
insert into auth.users (id, email, is_anonymous)
select pg_temp.uid(n), case when n = 2 then null else 'u' || n || '@exemple.test' end, n = 2 from generate_series(1, 12) n;
insert into public.profiles (id) select pg_temp.uid(n) from generate_series(1, 12) n on conflict do nothing;
update public.profiles set username = 'Joueur' || (right(id::text, 2)) where id <> pg_temp.uid(4) and id <> pg_temp.uid(2);
update public.profiles set username = 'Alice' where id = pg_temp.uid(1);
\set alice '''a0000000-0000-4000-8000-000000000001'''
\set bruno '''a0000000-0000-4000-8000-000000000002'''
\set chloe '''a0000000-0000-4000-8000-000000000003'''
\set denis '''a0000000-0000-4000-8000-000000000004'''
\set elise '''a0000000-0000-4000-8000-000000000005'''

-- 1. Visiteur sans connexion : ni les tables, ni les fonctions.
set local role anon;
select pg_temp.doit_refuser('select * from public.invitation_codes', 'permission denied');
select pg_temp.doit_refuser('select * from public.invitations', 'permission denied');
select pg_temp.doit_refuser('select * from public.cadeaux', 'permission denied');
select pg_temp.doit_refuser('select * from public.mon_invitation()', 'permission denied');
select pg_temp.doit_refuser('select * from public.valider_invitation(repeat(''A'', 32))', 'permission denied');
reset role;

-- 2. Sans compte avec pseudo : session anonyme (JGC01), jeton sans utilisateur (JGC01), compte sans pseudo (JGP01).
set local role authenticated;
select pg_temp.connecte(:bruno, true);
select pg_temp.doit_refuser_code('select * from public.mon_invitation()', 'JGC01');
select pg_temp.doit_refuser_code('select * from public.valider_invitation(repeat(''A'', 32))', 'JGC01');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select pg_temp.doit_refuser_code('select * from public.mon_invitation()', 'JGC01');
select pg_temp.connecte(:denis);
select pg_temp.doit_refuser_code('select * from public.mon_invitation()', 'JGP01');
select pg_temp.doit_refuser_code('select * from public.valider_invitation(repeat(''A'', 32))', 'JGP01');
reset role;

-- 3. Mon invitation : un code de 32 caractères, créé à la première demande, toujours le même, un par joueur.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal((select count(*) from public.mon_invitation()), 1::bigint, 'une ligne');
select code as code_alice from public.mon_invitation() \gset
select pg_temp.egal(:'code_alice' ~ '^[A-Za-z0-9_-]{32}$', true, 'code de 32 caractères base64url');
select pg_temp.egal((select code from public.mon_invitation()), :'code_alice', 'le même code à chaque demande');
select pg_temp.egal((select amis from public.mon_invitation()), 0, 'aucun ami arrivé');
select pg_temp.egal((select plafond from public.mon_invitation()), 5, 'plafond de 5');
select pg_temp.egal((select cadeaux from public.mon_invitation()), '{}'::text[], 'aucun cadeau');
select pg_temp.connecte(:chloe);
select code as code_chloe from public.mon_invitation() \gset
select pg_temp.egal(:'code_chloe' <> :'code_alice', true, 'un code par joueur');
reset role;
-- 192 bits : 32 caractères base64url ; pas de doublon entre les deux codes ; un seul code par joueur en base.
select pg_temp.egal((select count(*) from public.invitation_codes), 2::bigint, 'un code par joueur en base');

-- 4. Les tables sont fermées à l'app (le parrain ne doit jamais voir qui est arrivé) ; les cadeaux, en lecture seule.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser('select * from public.invitation_codes', 'permission denied');
select pg_temp.doit_refuser('select * from public.invitations', 'permission denied');
select pg_temp.doit_refuser('insert into public.invitations (invite_id, parrain_id, rang) values (pg_temp.uid(5), pg_temp.uid(1), 1)', 'permission denied');
select pg_temp.doit_refuser('insert into public.invitation_codes (user_id, code) values (pg_temp.uid(1), repeat(''B'', 32))', 'permission denied');
select pg_temp.doit_refuser('update public.invitation_codes set code = repeat(''B'', 32)', 'permission denied');
select pg_temp.doit_refuser('insert into public.cadeaux (user_id, cadeau, origine) values (pg_temp.uid(1), ''jade'', ''parrain'')', 'permission denied');
select pg_temp.doit_refuser('update public.cadeaux set cadeau = ''jade''', 'permission denied');
select pg_temp.doit_refuser('delete from public.cadeaux', 'permission denied');
select pg_temp.doit_refuser('select public.cadeaux_de(pg_temp.uid(1))', 'permission denied');
reset role;

-- 5. Valider : tout ce qui n'ouvre rien. Chloé (3) joue ensuite avec le lien d'Alice.
set local role authenticated;
select pg_temp.connecte(:chloe);
select pg_temp.egal(pg_temp.valider(null), 'invalide', 'code absent');
select pg_temp.egal(pg_temp.valider('court'), 'invalide', 'code trop court');
select pg_temp.egal(pg_temp.valider(repeat('A', 31) || '!'), 'invalide', 'caractère interdit');
select pg_temp.egal(pg_temp.valider(repeat('A', 32)), 'invalide', 'code inconnu');
select pg_temp.egal(pg_temp.valider(:'code_chloe'), 'invalide', 'son propre code : jamais d''auto-invitation');
-- Code juste, mais aucune partie : en attente (le code est gardé côté client), rien n'est écrit.
select pg_temp.egal(pg_temp.valider(:'code_alice'), 'attente', 'aucune partie : en attente');
reset role;
select pg_temp.egal((select count(*) from public.invitations), 0::bigint, 'rien d''écrit en attente');
select pg_temp.egal((select count(*) from public.cadeaux), 0::bigint, 'aucun cadeau en attente');
-- Des parties qui ne comptent pas : 9 coups ; 12 coups à deux sur le même appareil ; un import de 12 coups.
select pg_temp.partie(pg_temp.uid(3), 9, 'ordi', 1);
select pg_temp.partie(pg_temp.uid(3), 12, 'deux', 2);
select pg_temp.partie(pg_temp.uid(3), 12, 'import', 3);
set local role authenticated;
select pg_temp.connecte(:chloe);
select pg_temp.egal(pg_temp.valider(:'code_alice'), 'attente', '9 coups, à deux, import : en attente');
reset role;
select pg_temp.egal((select count(*) from public.invitations), 0::bigint, 'toujours rien d''écrit');

-- Un compte de plus de 30 jours n'est plus un « nouveau joueur » (Élise, 5) : invalide, même avec une vraie partie.
select pg_temp.partie(pg_temp.uid(5), 12, 'ordi', 1);
update auth.users set created_at = now() - interval '31 days' where id = pg_temp.uid(5);
set local role authenticated;
select pg_temp.connecte(:elise);
select pg_temp.egal(pg_temp.valider(:'code_alice'), 'invalide', 'compte de plus de 30 jours');
reset role;
update auth.users set created_at = now() - interval '29 days' where id = pg_temp.uid(5);
set local role authenticated;
select pg_temp.egal(pg_temp.valider(:'code_alice'), 'validee', 'compte de 29 jours : accepté');
reset role;
-- Élise est donc la première amie d'Alice ; la suite repart d'un rang 1 propre pour Chloé.
select pg_temp.egal((select rang from public.invitations where invite_id = pg_temp.uid(5)), 1::smallint, 'Élise : rang 1');
select pg_temp.egal((select array_agg(cadeau order by cadeau) from public.cadeaux where user_id = pg_temp.uid(1)), array['cerisier'], 'parrain : Cerisier au 1er ami');
select pg_temp.egal((select array_agg(cadeau) from public.cadeaux where user_id = pg_temp.uid(5)), array['cerisier'], 'invitée : Cerisier');
select pg_temp.egal((select origine from public.cadeaux where user_id = pg_temp.uid(1) and cadeau = 'cerisier'), 'parrain', 'origine parrain');
select pg_temp.egal((select origine from public.cadeaux where user_id = pg_temp.uid(5) and cadeau = 'cerisier'), 'invite', 'origine invité');
select pg_temp.egal((select array_agg(badge_id order by badge_id) from public.achievements where user_id in (pg_temp.uid(1), pg_temp.uid(5))), array['invite', 'parrain'], 'badges Parrain et Invité');

-- 6. Chloé a maintenant une vraie partie de 10 coups : validée, les deux reçoivent ; une seconde fois : « deja ».
select pg_temp.partie(pg_temp.uid(3), 10, 'guidee', 4);
set local role authenticated;
select pg_temp.connecte(:chloe);
select pg_temp.egal(pg_temp.valider(:'code_alice'), 'validee', '10 coups guidée : validée');
select pg_temp.egal(pg_temp.cadeaux_valider(:'code_alice'), 'cerisier', 'deja rend les cadeaux de l''invité');
select pg_temp.egal(pg_temp.valider(:'code_alice'), 'deja', 'une seule récompense par invité');
select pg_temp.egal(pg_temp.valider(repeat('A', 32)), 'deja', 'déjà validée : n''importe quel code répond deja');
select pg_temp.connecte(:alice);
select pg_temp.egal((select amis from public.mon_invitation()), 2, 'Alice : deux amis arrivés');
select pg_temp.egal((select cadeaux from public.mon_invitation()), array['cerisier'], 'Alice : Cerisier seulement (jade au 3e)');
reset role;
select pg_temp.egal((select rang from public.invitations where invite_id = pg_temp.uid(3)), 2::smallint, 'Chloé : rang 2');
select pg_temp.egal((select count(*) from public.cadeaux where user_id = pg_temp.uid(1)), 1::bigint, 'pas de nouveau cadeau au 2e ami');

-- 7. Croisé : Alice (compte récent) ne peut pas utiliser le code de Chloé, qui a été invitée par elle.
select pg_temp.partie(pg_temp.uid(1), 12, 'ordi', 1);
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(pg_temp.valider(:'code_chloe'), 'invalide', 'invitation croisée refusée');
reset role;

-- 8. Le 3e ami donne les pierres Jade, jusqu'au 5e ; le 6e trouve le lien « complet » et personne ne reçoit rien.
select pg_temp.partie(pg_temp.uid(n), 12, 'ordi', 1) from generate_series(6, 12) n;
set local role authenticated;
select pg_temp.connecte(pg_temp.uid(6));
select pg_temp.egal(pg_temp.valider(:'code_alice'), 'validee', '3e ami');
reset role;
select pg_temp.egal((select array_agg(cadeau order by cadeau) from public.cadeaux where user_id = pg_temp.uid(1)), array['cerisier', 'jade'], 'parrain : Jade au 3e ami');
select pg_temp.egal((select origine from public.cadeaux where user_id = pg_temp.uid(1) and cadeau = 'jade'), 'parrain', 'origine du Jade');
set local role authenticated;
select pg_temp.connecte(pg_temp.uid(7));
select pg_temp.egal(pg_temp.valider(:'code_alice'), 'validee', '4e ami');
select pg_temp.connecte(pg_temp.uid(8));
select pg_temp.egal(pg_temp.valider(:'code_alice'), 'validee', '5e ami');
select pg_temp.connecte(:alice);
select pg_temp.egal((select amis from public.mon_invitation()), 5, 'Alice : cinq amis, le plafond');
select pg_temp.connecte(pg_temp.uid(9));
select pg_temp.egal(pg_temp.valider(:'code_alice'), 'complet', '6e ami : complet');
reset role;
select pg_temp.egal((select count(*) from public.invitations where parrain_id = pg_temp.uid(1)), 5::bigint, 'jamais plus de 5 amis');
select pg_temp.egal((select count(*) from public.cadeaux where user_id = pg_temp.uid(9)), 0::bigint, 'le 6e ne reçoit rien');
select pg_temp.egal((select count(*) from public.achievements where user_id = pg_temp.uid(9)), 0::bigint, 'le 6e n''a pas de badge');
select pg_temp.egal((select count(*) from public.cadeaux where user_id = pg_temp.uid(1)), 2::bigint, 'Alice : deux cadeaux, pas un de plus');

-- Un ami dont le compte est supprimé libère sa place : le suivant prend le rang libre (3), sans collision.
delete from auth.users where id = pg_temp.uid(6);
select pg_temp.egal((select count(*) from public.invitations where parrain_id = pg_temp.uid(1)), 4::bigint, 'compte de l''ami supprimé : invitation effacée');
set local role authenticated;
select pg_temp.connecte(pg_temp.uid(9));
select pg_temp.egal(pg_temp.valider(:'code_alice'), 'validee', 'la place libérée sert au suivant');
reset role;
select pg_temp.egal((select rang from public.invitations where invite_id = pg_temp.uid(9)), 3::smallint, 'rang libre réutilisé');
select pg_temp.egal((select count(*) from public.invitations where parrain_id = pg_temp.uid(1)), 5::bigint, 'toujours 5 au plus');

-- 9. Le plafond et l'unicité sont aussi dans les contraintes (même sans passer par la fonction).
select pg_temp.doit_refuser('insert into public.invitations (invite_id, parrain_id, rang) values (pg_temp.uid(10), pg_temp.uid(1), 6)', 'invitations_rang_check');
select pg_temp.doit_refuser('insert into public.invitations (invite_id, parrain_id, rang) values (pg_temp.uid(10), pg_temp.uid(1), 5)', 'invitations_parrain_rang_key');
select pg_temp.doit_refuser('insert into public.invitations (invite_id, parrain_id, rang) values (pg_temp.uid(10), pg_temp.uid(10), 1)', 'invitations_pas_soi_meme');
select pg_temp.doit_refuser('insert into public.invitations (invite_id, parrain_id, rang) values (pg_temp.uid(3), pg_temp.uid(12), 1)', 'invitations_pkey');
select pg_temp.doit_refuser('insert into public.invitation_codes (user_id, code) values (pg_temp.uid(10), ''trop-court'')', 'invitation_codes_code_check');
select pg_temp.doit_refuser('insert into public.cadeaux (user_id, cadeau, origine) values (pg_temp.uid(10), ''or'', ''parrain'')', 'cadeaux_cadeau_check');
select pg_temp.doit_refuser('insert into public.cadeaux (user_id, cadeau, origine) values (pg_temp.uid(10), ''jade'', ''achat'')', 'cadeaux_origine_check');

-- 10. Lectures : chacun ne lit que ses cadeaux ; la session anonyme ne voit rien.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal((select count(*) from public.cadeaux), 2::bigint, 'Alice lit ses deux cadeaux');
select pg_temp.egal((select bool_and(user_id = pg_temp.uid(1)) from public.cadeaux), true, 'seulement les siens');
select pg_temp.connecte(:chloe);
select pg_temp.egal((select count(*) from public.cadeaux), 1::bigint, 'Chloé lit son cadeau');
select pg_temp.connecte(:bruno, true);
select pg_temp.egal((select count(*) from public.cadeaux), 0::bigint, 'anonyme : aucun cadeau');
reset role;

-- 11. Mes données : le nombre d'amis, la date d'arrivée, les cadeaux ; jamais le code ni l'identité de l'autre.
set local role authenticated;
select pg_temp.connecte(:alice);
select public.exporter_mes_donnees() as export_alice \gset
select pg_temp.egal((:'export_alice'::jsonb #>> '{invitations,amis_arrives}')::int, 5, 'export : cinq amis arrivés');
select pg_temp.egal(jsonb_array_length(:'export_alice'::jsonb #> '{invitations,cadeaux}'), 2, 'export : deux cadeaux');
select pg_temp.egal(:'export_alice'::jsonb #> '{invitations,invite_le}', 'null'::jsonb, 'export : Alice n''a pas été invitée');
select pg_temp.egal(position(:'code_alice' in :'export_alice') = 0, true, 'export : sans le code d''invitation');
select pg_temp.egal(position('Joueur03' in :'export_alice') = 0 and position(substr(pg_temp.uid(3)::text, 1, 36) in :'export_alice') = 0,
  true, 'export : ni pseudo ni identifiant d''un invité');
select pg_temp.connecte(:chloe);
select public.exporter_mes_donnees() as export_chloe \gset
select pg_temp.egal(:'export_chloe'::jsonb #>> '{invitations,invite_le}' is not null, true, 'export de l''invitée : date d''arrivée');
select pg_temp.egal(position(substr(pg_temp.uid(1)::text, 1, 36) in :'export_chloe') = 0, true, 'export de l''invitée : pas l''identifiant du parrain');
reset role;

-- 12. Suppression du compte du parrain : code, invitations et cadeaux partent (cascade) ; les cadeaux des invités restent.
delete from auth.users where id = pg_temp.uid(1);
select pg_temp.egal((select count(*) from public.invitation_codes where user_id = pg_temp.uid(1)), 0::bigint, 'code effacé avec le compte');
select pg_temp.egal((select count(*) from public.invitations where parrain_id = pg_temp.uid(1)), 0::bigint, 'invitations effacées avec le compte');
select pg_temp.egal((select count(*) from public.cadeaux where user_id = pg_temp.uid(1)), 0::bigint, 'cadeaux effacés avec le compte');
select pg_temp.egal((select count(*) from public.cadeaux where user_id = pg_temp.uid(3)), 1::bigint, 'le cadeau de l''invitée reste');
select pg_temp.egal((select count(*) from public.invitations where invite_id = pg_temp.uid(3)), 0::bigint, 'invitation de l''invitée effacée avec le parrain');
set local role authenticated;
select pg_temp.connecte(pg_temp.uid(10));
select pg_temp.egal(pg_temp.valider(:'code_alice'), 'invalide', 'le code d''un compte supprimé ne répond plus');
reset role;

-- 13. Droits et durcissement : security definer à search_path vide, rien pour anon, internes fermées, RLS partout.
select pg_temp.egal((select bool_and(p.proconfig[1] = 'search_path=""') from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('mon_invitation', 'valider_invitation', 'cadeaux_de') and p.prosecdef), true, 'search_path vide');
select pg_temp.egal((select count(*) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('mon_invitation', 'valider_invitation', 'cadeaux_de')), 3::bigint, 'trois fonctions');
select pg_temp.egal((select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('mon_invitation', 'valider_invitation', 'cadeaux_de')), false, 'anon : aucune fonction d''invitation');
select pg_temp.egal(has_function_privilege('authenticated', 'public.mon_invitation()', 'execute'), true, 'authenticated : mon_invitation');
select pg_temp.egal(has_function_privilege('authenticated', 'public.valider_invitation(text)', 'execute'), true, 'authenticated : valider_invitation');
select pg_temp.egal(has_function_privilege('authenticated', 'public.cadeaux_de(uuid)', 'execute'), false, 'cadeaux_de interne');
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class where oid in
  ('public.invitation_codes'::regclass, 'public.invitations'::regclass, 'public.cadeaux'::regclass)), true, 'RLS active sur les trois tables');
select pg_temp.egal((select count(*) from pg_policy where polrelid in ('public.invitation_codes'::regclass, 'public.invitations'::regclass)), 0::bigint,
  'codes et invitations : aucune politique (fermées à l''app)');
select pg_temp.egal((select bool_or(has_table_privilege(r, c, p))
  from unnest(array['anon', 'authenticated']) r,
       unnest(array['public.invitation_codes', 'public.invitations']) c,
       unnest(array['select', 'insert', 'update', 'delete']) p), false, 'aucun droit sur les tables fermées');
select pg_temp.egal((select bool_or(has_table_privilege('anon', 'public.cadeaux', p) or has_table_privilege('authenticated', 'public.cadeaux', p))
  from unnest(array['insert', 'update', 'delete']) p), false, 'cadeaux : aucune écriture par l''app');

\echo 'invitations : tous les cas passent.'
rollback;
