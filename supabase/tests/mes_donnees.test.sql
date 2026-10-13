-- Tests rejouables de l'issue #530 (reprend #371) : export de mes données (`exporter_mes_donnees`) et décision D4
-- (profils fermés aux visiteurs non connectés, colonnes publiques seulement, `mon_profil`). Transaction annulée à la
-- fin : aucune donnée ne reste. Le jeton est simulé par request.jwt.claims (sub, role, is_anonymous), comme PostgREST.
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
    raise exception 'Mauvais refus pour « % » : « % » / % (attendu : « % »)', p_sql, sqlerrm, sqlstate, p_motif;
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
-- Le texte de l'export ne contient pas `p_texte`.
create function pg_temp.absent(p_export jsonb, p_texte text, p_cas text) returns void
language plpgsql as $$
begin
  if position(p_texte in p_export::text) > 0 then
    raise exception 'ÉCHEC %: « % » trouvé dans l''export', p_cas, p_texte;
  end if;
end;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Alice et Bruno ont un compte avec pseudo ; Chloé est une session sans compte (ancien défi par lien).
insert into auth.users (id, email, is_anonymous, created_at, last_sign_in_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.test', false, '2026-09-01 10:00+00', '2026-10-12 08:00+00'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bruno-secret@exemple.test', false, now(), now()),
  ('cccccccc-0000-4000-8000-000000000003', null, true, now(), now()),
  ('dddddddd-0000-4000-8000-000000000004', 'denis@exemple.test', false, now(), now());
insert into auth.identities (user_id, provider, provider_id, identity_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'email', 'alice@exemple.test', '{"email":"alice@exemple.test"}'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'google', 'g-123', '{"email":"alice@exemple.test","sub":"g-123"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'email', 'bruno-secret@exemple.test', '{"email":"bruno-secret@exemple.test"}');
insert into public.profiles (id) values
  ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002'), ('cccccccc-0000-4000-8000-000000000003'),
  ('dddddddd-0000-4000-8000-000000000004')
  on conflict do nothing;
update public.profiles set username = 'Denis' where id = 'dddddddd-0000-4000-8000-000000000004';
update public.profiles set username = 'Alice', streak_days = 4, streak_last = '2026-10-12', streak_freezes = 1,
  conditions_version = '2026-09-30', conditions_acceptees_le = '2026-09-30 12:00+00'
  where id = 'aaaaaaaa-0000-4000-8000-000000000001';
update public.profiles set username = 'Bruno', streak_days = 77, puzzle_rating = 1234 where id = 'bbbbbbbb-0000-4000-8000-000000000002';
\set alice '''aaaaaaaa-0000-4000-8000-000000000001'''
\set bruno '''bbbbbbbb-0000-4000-8000-000000000002'''
\set chloe '''cccccccc-0000-4000-8000-000000000003'''
\set denis '''dddddddd-0000-4000-8000-000000000004'''

-- Données d'Alice et de Bruno, posées directement (comme les fonctions serveur les écriraient).
insert into public.games (id, black_id, white_id, created_by, size, komi, moves, status, result, rated, created_at) values
  ('00000000-0000-4000-8000-0000000000a1', :alice, :bruno, :alice, 9, 6.5, 'eeccttdd', 'finished', 'B+R', true, '2026-10-01 09:00+00'),
  ('00000000-0000-4000-8000-0000000000b1', :bruno, null, :bruno, 9, 6.5, 'ee', 'active', null, false, now());
insert into public.games (id, black_id, white_id, created_by, bot_id, size, komi, handicap, moves, status, created_at) values
  ('00000000-0000-4000-8000-0000000000a2', :alice, null, :alice, 'caillou', 9, 0.5, 2, 'ee', 'active', '2026-10-02 09:00+00');
-- Coups et résultat posés après coup (le garde d'insertion les vide), comme le feraient les fonctions serveur.
update public.games set moves = 'eeccttdd', status = 'finished', result = 'B+R' where id = '00000000-0000-4000-8000-0000000000a1';
update public.games set moves = 'ee' where id in ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000b1');
insert into public.defis (partie_id, jeton, createur_id, invite_id) values
  ('00000000-0000-4000-8000-0000000000a1', 'JetonSecretDuDefiAlice0123456789', :alice, :bruno);
insert into public.messages_partie (partie_id, auteur_id, code) values
  ('00000000-0000-4000-8000-0000000000a1', :alice, 'bonne_partie'),
  ('00000000-0000-4000-8000-0000000000a1', :bruno, 'oups');
insert into public.parties_perso (user_id, cle, joue_le, sgf, mode, taille, joueur, adversaire, resultat) values
  (:alice, repeat('a', 64), '2026-10-03 10:00+00', '(;GM[1]SZ[9]C[partie d''Alice];B[ee])', 'ordi', 9, 1, 'Pomme', 'B+3'),
  (:bruno, repeat('b', 64), '2026-10-03 10:00+00', '(;GM[1]SZ[9]C[partie secrete de Bruno];B[ee])', 'ordi', 9, 1, 'Pomme', 'B+3');
insert into public.reglages_compte (user_id, reglages) values
  (:alice, '{"theme":{"v":"dark","t":1}}'), (:bruno, '{"theme":{"v":"reglage-de-bruno","t":1}}');
insert into public.signalements (auteur_id, type, cible_joueur_id, partie_id, motif, texte, note_equipe) values
  (:alice, 'joueur', :bruno, '00000000-0000-4000-8000-0000000000a1', 'antijeu', 'Il joue n''importe où', 'note interne équipe'),
  (:bruno, 'joueur', :alice, null, 'pseudo', 'signalement secret de Bruno', null);
insert into public.blocages (bloqueur_id, bloque_id) values (:bruno, :alice);
insert into public.friendships (requester_id, addressee_id, status) values (:alice, :denis, 'accepted');
insert into public.abonnements_rappel (user_id, endpoint, p256dh, auth, moment, fuseau, langue) values
  (:alice, 'https://fcm.googleapis.com/fcm/send/adresse-secrete-alice', repeat('P', 60), repeat('K', 20), 'soir', 'Europe/Paris', 'fr');
insert into public.rating_history (user_id, kind, rating) values (:alice, 'depart', 800), (:bruno, 'depart', 1999);
insert into public.notifications (destinataire_id, type, partie_id) values
  (:alice, 'tour', '00000000-0000-4000-8000-0000000000a1'), (:bruno, 'ami', null);

-- 1. Visiteur non connecté (anon) : ni l'export, ni les profils, ni le classement, ni les autres tables d'un joueur.
set local role anon;
select pg_temp.doit_refuser('select public.exporter_mes_donnees()', 'permission denied');
select pg_temp.doit_refuser('select * from public.mon_profil()', 'permission denied');
select pg_temp.doit_refuser('select username from public.profiles', 'permission denied');
select pg_temp.doit_refuser('select * from public.leaderboard', 'permission denied');
select pg_temp.doit_refuser('select id from public.games', 'permission denied');
select pg_temp.doit_refuser('select user_id from public.achievements', 'permission denied');
select pg_temp.doit_refuser('select rating from public.rating_history', 'permission denied');
-- … mais les liens publics gardent le strict nécessaire, par leurs fonctions dédiées (#81, #364).
select pg_temp.egal((select createur_pseudo from public.apercu_defi('JetonSecretDuDefiAlice0123456789')), 'Alice', 'aperçu du défi sans compte : pseudo de qui invite');
reset role;

-- 2. Joueur connecté : autres profils, colonnes publiques seulement.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal((select username || ':' || rating || ':' || cote_provisoire from public.profiles where id = :bruno), 'Bruno:800:true', 'pseudo et cote d''un autre lisibles');
select pg_temp.egal((select rank::int from public.leaderboard where username = 'Bruno') >= 1, true, 'classement lisible connecté');
select pg_temp.doit_refuser(format('select streak_days from public.profiles where id = %L', :bruno), 'permission denied');
select pg_temp.doit_refuser(format('select puzzle_rating from public.profiles where id = %L', :bruno), 'permission denied');
select pg_temp.doit_refuser(format('select created_at from public.profiles where id = %L', :bruno), 'permission denied');
select pg_temp.doit_refuser(format('select conditions_version from public.profiles where id = %L', :bruno), 'permission denied');
select pg_temp.doit_refuser('select * from public.profiles', 'permission denied');
-- Son propre profil entier : par mon_profil(), une seule ligne, la sienne.
select pg_temp.egal((select count(*)::int from public.mon_profil()), 1, 'mon_profil : une ligne');
select pg_temp.egal((select username || ':' || streak_days || ':' || streak_freezes || ':' || conditions_version from public.mon_profil()),
  'Alice:4:1:2026-09-30', 'mon_profil : série, gels, preuve');
select pg_temp.connecte(:bruno);
select pg_temp.egal((select streak_days from public.mon_profil()), 77, 'mon_profil de Bruno : sa série');
-- Le pseudo reste modifiable par son titulaire (droit de colonne update gardé, where sur id).
update public.profiles set username = 'Bruno2' where id = :bruno;
select pg_temp.egal((select username from public.mon_profil()), 'Bruno2', 'pseudo modifiable');
update public.profiles set username = 'Bruno' where id = :bruno;
-- Session sans compte : son profil, rien d'autre.
select pg_temp.connecte(:chloe, true);
select pg_temp.egal((select count(*)::int from public.mon_profil() where username is null), 1, 'mon_profil d''une session sans compte');
-- Jeton sans utilisateur : rien.
select pg_temp.deconnecte();
select pg_temp.egal((select count(*)::int from public.mon_profil()), 0, 'mon_profil sans session : vide');
select pg_temp.doit_refuser('select public.exporter_mes_donnees()', 'JGC01');
select pg_temp.connecte('eeeeeeee-0000-4000-8000-00000000dead');
select pg_temp.doit_refuser('select public.exporter_mes_donnees()', 'JGC01');

-- 3. L'export d'Alice : ses données, toutes ; jamais celles de Bruno.
select pg_temp.connecte(:alice);
select public.exporter_mes_donnees() as export \gset
select pg_temp.egal((:'export'::jsonb ->> 'format'), 'mochi-go.mes-donnees', 'format');
select pg_temp.egal((:'export'::jsonb #>> '{compte,email}'), 'alice@exemple.test', 'e-mail du compte');
select pg_temp.egal((:'export'::jsonb #>> '{compte,cree_le}')::timestamptz, '2026-09-01 10:00+00'::timestamptz, 'date de création du compte');
select pg_temp.egal(jsonb_array_length(:'export'::jsonb #> '{compte,moyens_de_connexion}'), 2, 'deux moyens de connexion');
select pg_temp.egal((:'export'::jsonb #>> '{profil,username}'), 'Alice', 'pseudo');
select pg_temp.egal((:'export'::jsonb #>> '{profil,streak_days}')::int, 4, 'série');
select pg_temp.egal((:'export'::jsonb #>> '{profil,conditions_version}'), '2026-09-30', 'preuve d''accord aux conditions');
select pg_temp.egal((:'export'::jsonb #>> '{reglages,reglages,theme,v}'), 'dark', 'réglages');
select pg_temp.egal(jsonb_array_length(:'export'::jsonb -> 'historique_de_cote'), 1, 'historique de cote : le sien seulement');
select pg_temp.egal(jsonb_array_length(:'export'::jsonb -> 'parties_en_ligne'), 2, 'parties en ligne : les siennes (Bruno seul : absente)');
select pg_temp.egal(jsonb_array_length(:'export'::jsonb -> 'parties_enregistrees'), 1, 'parties enregistrées : les siennes');
select pg_temp.egal(jsonb_array_length(:'export'::jsonb -> 'notifications'), 1, 'notifications : les siennes');
select pg_temp.egal((:'export'::jsonb #>> '{amis,0,pseudo}') || '/' || (:'export'::jsonb #>> '{amis,0,demande}'), 'Denis/envoyee', 'amis : pseudo et sens');
select pg_temp.egal(jsonb_array_length(:'export'::jsonb -> 'joueurs_bloques'), 0, 'qui l''a bloquée : jamais dit');
select pg_temp.egal(jsonb_array_length(:'export'::jsonb -> 'signalements_envoyes'), 1, 'ses signalements seulement');
select pg_temp.egal((:'export'::jsonb #>> '{signalements_envoyes,0,message}'), 'Il joue n''importe où', 'texte de son signalement');
select pg_temp.egal((:'export'::jsonb #>> '{rappel_du_go_du_jour,0,service}'), 'https://fcm.googleapis.com', 'rappel : le service seulement');
-- Partie contre Bruno : SGF complet (pseudos, passe, résultat, date), camp, adversaire, défi sans jeton, son message.
select (:'export'::jsonb -> 'parties_en_ligne') -> 1 as partie \gset
select pg_temp.egal((:'partie'::jsonb ->> 'sgf'),
  '(;GM[1]FF[4]CA[UTF-8]AP[Mochi Go]SZ[9]KM[6.5]RU[Japanese]PB[Alice]PW[Bruno]RE[B+R]DT[2026-10-01];B[ee];W[cc];B[tt];W[dd])', 'SGF de la partie');
select pg_temp.egal((:'partie'::jsonb ->> 'ton_camp') || '/' || (:'partie'::jsonb #>> '{adversaire,pseudo}'), 'noir/Bruno', 'camp et adversaire');
select pg_temp.egal((:'partie'::jsonb #>> '{defi,role}'), 'createur', 'défi : rôle');
select pg_temp.egal(jsonb_array_length(:'partie'::jsonb -> 'tes_messages'), 1, 'messages : les siens seulement');
-- Partie contre l'ordi avec 2 pierres de handicap : AB, Blanc commence.
select pg_temp.egal(((:'export'::jsonb -> 'parties_en_ligne') -> 0 ->> 'sgf'),
  '(;GM[1]FF[4]CA[UTF-8]AP[Mochi Go]SZ[9]KM[0.5]RU[Japanese]HA[2]PB[Alice]PW[caillou]DT[2026-10-02]AB[gc][cg]PL[W];W[ee])', 'SGF avec handicap');
-- Rien de Bruno ni d'aucun secret.
select pg_temp.absent(:'export'::jsonb, 'bruno-secret@exemple.test', 'e-mail de Bruno');
select pg_temp.absent(:'export'::jsonb, 'partie secrete de Bruno', 'partie enregistrée de Bruno');
select pg_temp.absent(:'export'::jsonb, 'reglage-de-bruno', 'réglages de Bruno');
select pg_temp.absent(:'export'::jsonb, 'signalement secret de Bruno', 'signalement de Bruno contre Alice');
select pg_temp.absent(:'export'::jsonb, '1999', 'historique de cote de Bruno');
select pg_temp.absent(:'export'::jsonb, '00000000-0000-4000-8000-0000000000b1', 'partie de Bruno sans Alice');
select pg_temp.absent(:'export'::jsonb, 'JetonSecretDuDefiAlice', 'jeton du défi');
select pg_temp.absent(:'export'::jsonb, 'adresse-secrete-alice', 'adresse d''abonnement');
select pg_temp.absent(:'export'::jsonb, repeat('P', 60), 'clé de chiffrement du rappel');
select pg_temp.absent(:'export'::jsonb, 'note interne équipe', 'note de l''équipe');
select pg_temp.absent(:'export'::jsonb, '"oups"', 'message de Bruno');
select pg_temp.egal((:'export'::jsonb #>> '{signalements_envoyes,0}') like '%cible%', false, 'signalement sans le joueur visé');
select pg_temp.egal((:'export'::jsonb -> 'signalements_envoyes' -> 0) ? 'partie', false, 'signalement sans la partie visée');

-- 4. L'export de Bruno : le blocage qu'il a posé, son signalement ; rien d'Alice hors pseudo et parties communes.
select pg_temp.connecte(:bruno);
select public.exporter_mes_donnees() as export_b \gset
select pg_temp.egal((:'export_b'::jsonb #>> '{joueurs_bloques,0,pseudo}'), 'Alice', 'Bruno voit son blocage');
select pg_temp.egal(jsonb_array_length(:'export_b'::jsonb -> 'amis'), 0, 'Bruno : les amis d''Alice n''y sont pas');
select pg_temp.absent(:'export_b'::jsonb, 'alice@exemple.test', 'e-mail d''Alice');
select pg_temp.absent(:'export_b'::jsonb, 'Il joue n''importe où', 'signalement d''Alice contre Bruno');
select pg_temp.absent(:'export_b'::jsonb, 'partie d''Alice', 'partie enregistrée d''Alice');
select pg_temp.absent(:'export_b'::jsonb, '"bonne_partie"', 'message d''Alice');
select pg_temp.egal((:'export_b'::jsonb -> 'parties_en_ligne' -> 1 ->> 'ton_camp'), 'blanc', 'Bruno : camp blanc dans la partie commune');

-- 5. Session sans compte : son export (pas de pseudo), sans erreur.
select pg_temp.connecte(:chloe, true);
select pg_temp.egal((public.exporter_mes_donnees() #>> '{compte,sans_compte}'), 'true', 'export d''une session sans compte');

-- 6. Plafond : 3 exports par heure (Alice en a fait 1), puis JGX01 avec les minutes à attendre en indice.
select pg_temp.connecte(:alice);
select public.exporter_mes_donnees() is not null;
select public.exporter_mes_donnees() is not null;
select pg_temp.doit_refuser('select public.exporter_mes_donnees()', 'JGX01');
reset role;
select pg_temp.egal((select count(*)::int from public.exports_donnees where user_id = :alice), 3, 'refus non compté');
-- Une heure plus tard : de nouveau possible ; les lignes de plus de 24 heures sont effacées à l'export suivant.
update public.exports_donnees set fait_le = fait_le - interval '61 minutes' where user_id = :alice;
insert into public.exports_donnees (user_id, fait_le) values (:alice, now() - interval '3 days');
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(jsonb_array_length(public.exporter_mes_donnees() -> 'exports_recents'), 4, 'nouvel export, journal de 24 heures');
reset role;
select pg_temp.egal((select count(*)::int from public.exports_donnees where fait_le < now() - interval '24 hours'), 0, 'journal purgé à l''export');
insert into public.exports_donnees (user_id, fait_le) values (:bruno, now() - interval '2 days');
select public.purger_exports_donnees();
select pg_temp.egal((select count(*)::int from public.exports_donnees where user_id = :bruno), 1, 'purge quotidienne : l''export du jour reste');

-- 7. Journal fermé à l'app ; effacé avec le compte.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser('select * from public.exports_donnees', 'permission denied');
select pg_temp.doit_refuser(format('insert into public.exports_donnees (user_id) values (%L)', :alice), 'permission denied');
select pg_temp.doit_refuser('select public.purger_exports_donnees()', 'permission denied');
select pg_temp.doit_refuser('select public.sgf_partie_export(9, 6.5, ''japanese'', 0, ''ee'', null, null, null, null)', 'permission denied');
select public.delete_my_account();
reset role;
select pg_temp.egal((select count(*)::int from public.exports_donnees where user_id = :alice), 0, 'journal effacé avec le compte');

-- 8. Structure : RLS partout, security definer à search_path vide, droits d'exécution.
select pg_temp.egal((select relrowsecurity from pg_class where oid = 'public.exports_donnees'::regclass), true, 'RLS sur exports_donnees');
select pg_temp.egal((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 0, 'RLS sur toutes les tables');
select pg_temp.egal((select bool_and(p.proconfig @> array['search_path=""']) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('exporter_mes_donnees', 'mon_profil', 'purger_exports_donnees')
    and p.prosecdef), true, 'security definer à search_path vide');
select pg_temp.egal(has_function_privilege('anon', 'public.exporter_mes_donnees()', 'execute'), false, 'anon : pas d''export');
select pg_temp.egal(has_function_privilege('authenticated', 'public.exporter_mes_donnees()', 'execute'), true, 'authenticated : export');
select pg_temp.egal(has_function_privilege('anon', 'public.mon_profil()', 'execute'), false, 'anon : pas de mon_profil');
select pg_temp.egal(has_table_privilege('anon', 'public.profiles', 'select'), false, 'anon : pas de profils');
select pg_temp.egal(has_column_privilege('authenticated', 'public.profiles', 'streak_days', 'select'), false, 'série privée');
select pg_temp.egal(has_column_privilege('authenticated', 'public.profiles', 'username', 'select'), true, 'pseudo public');
select pg_temp.egal((select count(*)::int from pg_policies where tablename = 'profiles' and 'anon' = any(roles)), 0, 'aucune politique pour anon sur profiles');

rollback;
\o
\echo 'mes_donnees : tous les cas passent.'
