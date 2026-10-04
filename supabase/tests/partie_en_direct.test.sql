-- Tests rejouables de la partie en direct (issue #360) : file d'attente, appariement, pendule tenue par le serveur,
-- perte au temps, déconnexion tolérée, partie classée qui fait bouger la cote une seule fois.
-- Transaction annulée à la fin : aucune donnée ne reste. Voir supabase/tests/LISEZMOI.md.
-- Le temps : now() est fixe dans une transaction ; le test recule donc les dates (trait_depuis, vu_le) pour simuler
-- l'attente. Les valeurs de pendule sont celles de src/go/pendule.ts (même calcul, vérifié aussi par Vitest).
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
  if sqlerrm not ilike '%' || p_motif || '%' and sqlstate <> p_motif then
    raise exception 'Mauvais refus pour « % » : % « % » (attendu : « % »)', p_sql, sqlstate, sqlerrm, p_motif;
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
-- Pendule d'une partie, lue sans RLS : « noir_ms/noir_periodes/blanc_ms/blanc_periodes ».
create function pg_temp.pendule(p_partie uuid) returns text
language sql as $$
  select noir_ms || '/' || noir_periodes || '/' || blanc_ms || '/' || blanc_periodes from public.parties_direct where partie_id = p_partie;
$$;
create function pg_temp.etat(p_partie uuid) returns text
language sql as $$
  select status || ':' || coalesce(result, '-') || ':' || moves from public.games where id = p_partie;
$$;
-- Un coup tel que l'écrit la fonction serveur game-action (clé service), après validation des règles.
create function pg_temp.jouer(p_partie uuid, p_coup text) returns text
language sql as $$
  update public.games set moves = moves || p_coup where id = p_partie and status = 'active' returning status || ':' || coalesce(result, '-');
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- Comptes avec pseudo : Alice, Bruno, Chloé, Éve, Fanny, Gaston, Hugo, Inès, Jules ; Dan est anonyme ; Karl sans pseudo.
insert into auth.users (id, email, is_anonymous)
  select ('00000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'd' || n || '@exemple.test', n = 4
  from generate_series(1, 11) n;
insert into public.profiles (id, username)
  select ('00000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, case when n not in (4, 11) then 'direct' || n end
  from generate_series(1, 11) n
  on conflict (id) do update set username = excluded.username;
\set alice '''00000000-0000-4000-8000-000000000001'''
\set bruno '''00000000-0000-4000-8000-000000000002'''
\set chloe '''00000000-0000-4000-8000-000000000003'''
\set dan '''00000000-0000-4000-8000-000000000004'''
\set eve '''00000000-0000-4000-8000-000000000005'''
\set fanny '''00000000-0000-4000-8000-000000000006'''
\set gaston '''00000000-0000-4000-8000-000000000007'''
\set hugo '''00000000-0000-4000-8000-000000000008'''
\set ines '''00000000-0000-4000-8000-000000000009'''
\set jules '''00000000-0000-4000-8000-000000000010'''
\set karl '''00000000-0000-4000-8000-000000000011'''
select count(*) as profils_avant from public.profiles \gset
select count(*) as parties_avant from public.games \gset

-- 1. Pendule pure : temps principal, byo-yomi, chute (mêmes cas que src/go/pendule.test.ts).
select pg_temp.egal((select main_ms || '/' || periodes || '/' || tombe from public.pendule_apres(600000, 3, 30000, 5000)), '595000/3/false', '5 s sur 10 min');
select pg_temp.egal((select main_ms || '/' || periodes || '/' || tombe from public.pendule_apres(1000, 3, 30000, 40000)), '0/2/false', 'une période perdue');
select pg_temp.egal((select main_ms || '/' || periodes || '/' || tombe from public.pendule_apres(0, 3, 30000, 29999)), '0/3/false', 'joué dans la période');
select pg_temp.egal((select main_ms || '/' || periodes || '/' || tombe from public.pendule_apres(0, 1, 30000, 30000)), '0/0/true', 'dernière période dépassée');
select pg_temp.egal((select main_ms || '/' || periodes || '/' || tombe from public.pendule_apres(600000, 3, 30000, 689999)), '0/1/false', 'juste avant la chute');
select pg_temp.egal((select main_ms || '/' || periodes || '/' || tombe from public.pendule_apres(600000, 3, 30000, 690000)), '0/0/true', 'chute exacte');
select pg_temp.egal((select main_ms || '/' || periodes || '/' || periode_ms from public.cadence_direct('normale')), '600000/3/30000', 'cadence par défaut : 10 min + 3 × 30 s');
select pg_temp.egal((select main_ms || '/' || periodes || '/' || periode_ms from public.cadence_direct('rapide')), '300000/3/20000', 'rapide');
select pg_temp.egal((select main_ms || '/' || periodes || '/' || periode_ms from public.cadence_direct('lente')), '1200000/5/30000', 'lente');

-- 2. Accès : compte avec pseudo exigé ; paramètres vérifiés.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select pg_temp.doit_refuser('select public.find_match(9::smallint)', 'JGC01');
select pg_temp.doit_refuser('select public.quitter_file_attente()', '42501');
select pg_temp.connecte(:dan, true);
select pg_temp.doit_refuser('select public.find_match(9::smallint)', 'JGC01');
select pg_temp.connecte(:karl);
select pg_temp.doit_refuser('select public.find_match(9::smallint)', 'JGP01');
select pg_temp.connecte(:alice);
select pg_temp.doit_refuser('select public.find_match(10::smallint)', '22023');
select pg_temp.doit_refuser('select public.find_match(9::smallint, ''blitz'')', '22023');
select pg_temp.doit_refuser('select public.find_match(9::smallint, ''normale'', ''ing'')', '22023');
reset role;
select pg_temp.egal((select count(*) from public.match_queue), 0::bigint, 'personne dans la file');

-- 3. File d'attente : Alice attend (9 × 9, normale, japonais) ; rappeler garde sa place et son ancienneté.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Alice attend');
reset role;
select pg_temp.egal((select cadence || '/' || regles || '/' || size from public.match_queue where user_id = :alice), 'normale/japanese/9', 'attente : cadence et comptage par défaut');
update public.match_queue set created_at = now() - interval '20 seconds', vu_le = now() - interval '2 seconds' where user_id = :alice;
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Alice attend toujours');
reset role;
select pg_temp.egal((select created_at = now() - interval '20 seconds' and vu_le = now() from public.match_queue where user_id = :alice), true, 'ancienneté gardée, présence notée');
-- Le joueur ne lit que sa place dans la file, et ne l'écrit pas directement.
set local role authenticated;
select pg_temp.connecte(:bruno);
select pg_temp.egal((select count(*) from public.match_queue), 0::bigint, 'file des autres invisible');
select pg_temp.doit_refuser(format('insert into public.match_queue (user_id, size, rating) values (%L, 9, 800)', :bruno), '42501');

-- 4. Pas d'appariement entre cadences ou comptages différents.
select pg_temp.egal(public.find_match(9::smallint, 'rapide'), null::uuid, 'Bruno, rapide : personne');
select pg_temp.egal(public.find_match(9::smallint, 'normale', 'chinese'), null::uuid, 'Bruno, comptage chinois : personne');
reset role;
select pg_temp.egal((select created_at = now() and regles = 'chinese' from public.match_queue where user_id = :bruno), true, 'nouvelle demande : nouvelle attente');

-- 5. Bruno demande la même chose qu'Alice : la partie classée est créée, pendule à 10 min + 3 × 30 s.
set local role authenticated;
select pg_temp.connecte(:bruno);
select public.find_match(9::smallint, 'normale', 'japanese') as p1 \gset
reset role;
select pg_temp.egal(:'p1' is not null, true, 'Bruno trouve Alice');
select pg_temp.egal((select (rated, komi, handicap, rules, status::text, size, bot_id is null)
  from public.games where id = :'p1'), row(true, 6.5::numeric(4,1), 0::smallint, 'japanese'::text, 'active'::text, 9::smallint, true), 'partie classée standard');
select pg_temp.egal((select array[least(black_id, white_id), greatest(black_id, white_id)]::text from public.games where id = :'p1'),
  array[least(:alice::uuid, :bruno::uuid), greatest(:alice::uuid, :bruno::uuid)]::text, 'Alice contre Bruno');
select pg_temp.egal(pg_temp.pendule(:'p1'), '600000/3/600000/3', 'pendules pleines');
select pg_temp.egal((select trait_depuis = now() and cadence = 'normale' from public.parties_direct where partie_id = :'p1'), true, 'la pendule de Noir tourne');
select pg_temp.egal((select count(*) from public.match_queue where user_id in (:alice, :bruno)), 0::bigint, 'les deux sortent de la file');
select black_id as noir1, white_id as blanc1 from public.games where id = :'p1' \gset

-- 6. Alice rappelle find_match (son attente) : elle retrouve la partie. Annuler maintenant rend aussi la partie.
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.find_match(9::smallint), :'p1'::uuid, 'Alice retrouve sa partie');
select pg_temp.egal(public.quitter_file_attente(), :'p1'::uuid, 'trop tard pour annuler : la partie est rendue');
-- Lecture de la pendule : les deux joueurs seulement ; aucune écriture directe.
select pg_temp.egal((select count(*) from public.parties_direct where partie_id = :'p1'), 1::bigint, 'Alice lit la pendule');
select pg_temp.doit_refuser(format('update public.parties_direct set noir_ms = 9999999 where partie_id = %L', :'p1'), '42501');
select pg_temp.doit_refuser(format('delete from public.parties_direct where partie_id = %L', :'p1'), '42501');
select pg_temp.doit_refuser(format('insert into public.parties_direct (partie_id, cadence, main_ms, periodes, periode_ms, noir_ms, blanc_ms, noir_periodes, blanc_periodes) values (%L, ''normale'', 600000, 3, 30000, 1, 1, 1, 1)', :'p1'), '42501');
-- Les coups ne s'écrivent pas directement (RLS : seules les parties contre l'IA se modifient) : rien ne change.
update public.games set moves = 'ee' where id = :'p1';
select pg_temp.egal((select moves from public.games where id = :'p1'), '', 'coup direct sans effet');
select pg_temp.connecte(:chloe);
select pg_temp.egal((select count(*) from public.parties_direct where partie_id = :'p1'), 0::bigint, 'un tiers ne lit pas la pendule');
select pg_temp.doit_refuser(format('select public.pendule_direct(%L)', :'p1'), 'P0002');
reset role;
set local role anon;
select pg_temp.doit_refuser(format('select public.pendule_direct(%L)', :'p1'), 'permission denied');
reset role;

-- 7. Coups (écrits par game-action, clé service) : chacun est décompté sur la pendule de qui l'a joué.
update public.parties_direct set trait_depuis = now() - interval '5 seconds' where partie_id = :'p1';
set local role service_role;
select pg_temp.egal(pg_temp.jouer(:'p1', 'ee'), 'active:-', 'Noir joue');
reset role;
select pg_temp.egal(pg_temp.pendule(:'p1'), '595000/3/600000/3', 'Noir a pris 5 s');
select pg_temp.egal((select trait_depuis = now() and noir_vu_le = now() from public.parties_direct where partie_id = :'p1'), true, 'la pendule de Blanc part, Noir est présent');
-- Blanc n'a plus qu'1 s de temps principal et réfléchit 40 s : une période perdue.
update public.parties_direct set blanc_ms = 1000, trait_depuis = now() - interval '40 seconds' where partie_id = :'p1';
set local role service_role;
select pg_temp.egal(pg_temp.jouer(:'p1', 'cc'), 'active:-', 'Blanc joue en byo-yomi');
reset role;
select pg_temp.egal(pg_temp.pendule(:'p1'), '595000/3/0/2', 'Blanc : 2 périodes restantes');

-- 8. Déconnexion tolérée : Noir absent depuis 30 s, Blanc consulte la pendule : la partie continue.
update public.parties_direct set trait_depuis = now() - interval '30 seconds', noir_vu_le = now() - interval '30 seconds' where partie_id = :'p1';
set local role authenticated;
select pg_temp.connecte(:'blanc1');
select pg_temp.egal((select p->>'statut' || '/' || (p->>'noir_ms') || '/' || (p->>'coups') from public.pendule_direct(:'p1') p), 'active/595000/eecc', '30 s d''absence : la partie continue');
-- Noir revient : sa présence est notée, sa pendule a continué de tourner.
select pg_temp.connecte(:'noir1');
select pg_temp.egal((select (p->>'trait_depuis')::timestamptz = now() - interval '30 seconds' from public.pendule_direct(:'p1') p), true, 'la pendule n''attend pas');
reset role;
select pg_temp.egal((select noir_vu_le = now() from public.parties_direct where partie_id = :'p1'), true, 'Noir est de retour');

-- 9. Chute : Noir joue après la fin de sa dernière période. Le coup n'est pas joué, Blanc gagne au temps,
--    la cote des deux bouge une fois (962 / 638 entre deux nouveaux, comme #417).
update public.parties_direct set noir_ms = 0, noir_periodes = 1, trait_depuis = now() - interval '31 seconds' where partie_id = :'p1';
set local role service_role;
select pg_temp.egal(pg_temp.jouer(:'p1', 'gg'), 'finished:W+T', 'coup trop tard : perte au temps');
reset role;
select pg_temp.egal(pg_temp.etat(:'p1'), 'finished:W+T:eecc', 'le coup tardif n''est pas joué');
select pg_temp.egal(pg_temp.pendule(:'p1'), '0/0/0/2', 'pendule de Noir à zéro');
select pg_temp.egal((select trait_depuis is null from public.parties_direct where partie_id = :'p1'), true, 'pendule arrêtée');
select pg_temp.egal((select string_agg(ecart::text, ',' order by ecart) from public.rating_history where game_id = :'p1' and kind = 'game'), '-162,162', 'cote : +162 / −162');
select pg_temp.egal((select rating from public.profiles where id = :'blanc1'), 962, 'Blanc 962');
-- Rien ne recompte : nouveau constat, nouvel abandon refusé.
set local role authenticated;
select pg_temp.connecte(:'blanc1');
select pg_temp.egal((select p->>'resultat' from public.pendule_direct(:'p1') p), 'W+T', 'résultat lu');
select pg_temp.doit_refuser(format('select public.resign_game(%L)', :'p1'), 'pas en cours');
reset role;
select pg_temp.egal((select count(*) from public.rating_history where game_id = :'p1'), 2::bigint, 'la cote a bougé une seule fois');

-- 10. Chute constatée entre deux coups : Chloé et Éve ; le joueur au trait laisse tomber sa pendule.
set local role authenticated;
select pg_temp.connecte(:chloe);
select pg_temp.egal(public.find_match(13::smallint, 'rapide'), null::uuid, 'Chloé attend en rapide');
select pg_temp.connecte(:eve);
select public.find_match(13::smallint, 'rapide') as p2 \gset
reset role;
select pg_temp.egal(pg_temp.pendule(:'p2'), '300000/3/300000/3', 'rapide : 5 min + 3 × 20 s');
select black_id as noir2, white_id as blanc2 from public.games where id = :'p2' \gset
set local role service_role;
select pg_temp.jouer(:'p2', 'dd');
select pg_temp.jouer(:'p2', 'jj');
reset role;
-- Noir au trait, présent, mais sa pendule est tombée (5 min + 60 s écoulées).
update public.parties_direct set trait_depuis = now() - interval '360 seconds', noir_vu_le = now() where partie_id = :'p2';
set local role authenticated;
select pg_temp.connecte(:'noir2');
select pg_temp.egal((select p->>'resultat' from public.pendule_direct(:'p2') p), 'W+T', 'la pendule de Noir est tombée : constaté même par lui');
reset role;
select pg_temp.egal((select count(*) from public.rating_history where game_id = :'p2' and kind = 'game'), 2::bigint, 'cote comptée');

-- 11. Absence de plus de 60 s du joueur au trait : l'adversaire resté gagne au temps (Fanny contre Gaston).
set local role authenticated;
select pg_temp.connecte(:fanny);
select pg_temp.egal(public.find_match(19::smallint, 'lente'), null::uuid, 'Fanny attend');
select pg_temp.connecte(:gaston);
select public.find_match(19::smallint, 'lente') as p3 \gset
reset role;
select black_id as noir3, white_id as blanc3 from public.games where id = :'p3' \gset
set local role service_role;
select pg_temp.jouer(:'p3', 'dd');
select pg_temp.jouer(:'p3', 'pp');
reset role;
update public.parties_direct set trait_depuis = now() - interval '70 seconds', noir_vu_le = now() - interval '70 seconds' where partie_id = :'p3';
set local role authenticated;
-- Le joueur absent qui revient n'est pas jugé absent : il vient de donner signe de vie.
select pg_temp.connecte(:'noir3');
select pg_temp.egal((select p->>'statut' from public.pendule_direct(:'p3') p), 'active', 'Noir revient à temps');
reset role;
update public.parties_direct set noir_vu_le = now() - interval '70 seconds' where partie_id = :'p3';
set local role authenticated;
select pg_temp.connecte(:'blanc3');
select pg_temp.egal((select p->>'resultat' from public.pendule_direct(:'p3') p), 'W+T', 'Noir absent plus de 60 s : Blanc gagne');
reset role;
select pg_temp.egal((select count(*) from public.rating_history where game_id = :'p3' and kind = 'game'), 2::bigint, 'cote comptée une fois');

-- 12. Absent avant que chacun ait joué : partie annulée, aucune cote (Hugo contre Inès).
set local role authenticated;
select pg_temp.connecte(:hugo);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Hugo attend');
select pg_temp.connecte(:ines);
select public.find_match(9::smallint) as p4 \gset
reset role;
select black_id as noir4, white_id as blanc4 from public.games where id = :'p4' \gset
update public.parties_direct set trait_depuis = now() - interval '61 seconds', noir_vu_le = null where partie_id = :'p4';
set local role authenticated;
select pg_temp.connecte(:'blanc4');
select pg_temp.egal((select p->>'statut' from public.pendule_direct(:'p4') p), 'aborted', 'Noir jamais venu : partie annulée');
reset role;
select pg_temp.egal((select count(*) from public.rating_history where game_id = :'p4'), 0::bigint, 'partie annulée : aucune cote');
-- Hugo et Inès peuvent rejouer aussitôt (la partie annulée n'est plus « en cours »).
set local role authenticated;
select pg_temp.connecte(:hugo);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Hugo rejoue : il attend');
select pg_temp.egal(public.quitter_file_attente(), null::uuid, 'Hugo annule son attente');
reset role;
select pg_temp.egal((select count(*) from public.match_queue where user_id = :hugo), 0::bigint, 'Hugo sort de la file');

-- 13. Comptage : la pendule s'arrête après deux passes, repart à la reprise ; absence au comptage (Jules contre Bruno).
set local role authenticated;
select pg_temp.connecte(:jules);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Jules attend');
select pg_temp.connecte(:bruno);
select public.find_match(9::smallint) as p5 \gset
reset role;
select black_id as noir5, white_id as blanc5 from public.games where id = :'p5' \gset
set local role service_role;
select pg_temp.jouer(:'p5', 'ee');
select pg_temp.jouer(:'p5', 'cc');
select pg_temp.jouer(:'p5', 'tt');
update public.games set moves = moves || 'tt', counting = true where id = :'p5';
reset role;
select pg_temp.egal((select trait_depuis is null and comptage_depuis = now() from public.parties_direct where partie_id = :'p5'), true, 'comptage : pendule arrêtée');
-- Reprise : la pendule de Noir (au trait après deux passes) repart.
set local role service_role;
update public.games set counting = false, resumed_at = 4 where id = :'p5';
reset role;
select pg_temp.egal((select trait_depuis = now() and comptage_depuis is null from public.parties_direct where partie_id = :'p5'), true, 'reprise : la pendule repart');
set local role service_role;
select pg_temp.jouer(:'p5', 'tt');
update public.games set moves = moves || 'tt', counting = true where id = :'p5';
reset role;
-- Blanc propose, puis disparaît plus de 60 s : Noir gagne au temps.
update public.parties_direct set comptage_depuis = now() - interval '90 seconds', blanc_vu_le = now() - interval '90 seconds' where partie_id = :'p5';
set local role authenticated;
select pg_temp.connecte(:'noir5');
select pg_temp.egal((select p->>'resultat' from public.pendule_direct(:'p5') p), 'B+T', 'absent pendant le comptage : perte au temps');
reset role;

-- 14. Abandon d'une partie en direct : comme avant (resign_game), la pendule s'arrête, la cote bouge une fois.
update public.profiles set rating = 800 where id in (:alice, :chloe);
set local role authenticated;
select pg_temp.connecte(:alice);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Alice attend de nouveau');
select pg_temp.connecte(:chloe);
select public.find_match(9::smallint) as p6 \gset
select pg_temp.egal(public.resign_game(:'p6') ~ '^[BW]\+R$', true, 'Chloé abandonne');
reset role;
select pg_temp.egal((select trait_depuis is null from public.parties_direct where partie_id = :'p6'), true, 'abandon : pendule arrêtée');
select pg_temp.egal((select count(*) from public.rating_history where game_id = :'p6' and kind = 'game'), 2::bigint, 'abandon : cote comptée');

-- 15. File : une attente sans nouvelles depuis 30 s est retirée au passage suivant.
set local role authenticated;
select pg_temp.connecte(:gaston);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Gaston attend');
reset role;
update public.match_queue set vu_le = now() - interval '31 seconds' where user_id = :gaston;
set local role authenticated;
select pg_temp.connecte(:fanny);
select pg_temp.egal(public.find_match(9::smallint), null::uuid, 'Gaston parti : Fanny attend');
reset role;
select pg_temp.egal((select count(*) from public.match_queue where user_id = :gaston), 0::bigint, 'attente abandonnée retirée');

-- 16. Défis entre amis et parties contre l'IA : aucune pendule, rien ne change pour eux.
select pg_temp.egal((select count(*) from public.parties_direct d join public.games g on g.id = d.partie_id where not g.rated or g.bot_id is not null), 0::bigint, 'pendule seulement pour les parties classées');

-- 17. Structure : RLS, droits, search_path, aucune donnée supprimée.
select pg_temp.egal((select count(*) >= :parties_avant from public.games), true, 'aucune partie supprimée');
select pg_temp.egal((select count(*) from public.profiles), :profils_avant::bigint, 'aucun profil supprimé');
select pg_temp.egal((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('find_match', 'quitter_file_attente', 'pendule_direct', 'games_direct_pendule')),
  true, 'security definer, search_path vide');
select pg_temp.egal((select bool_and(p.proconfig @> array['search_path=""']) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('cadence_direct', 'pendule_apres', 'direct_constater', 'direct_en_cours')),
  true, 'fonctions internes : search_path vide');
select pg_temp.egal((select bool_or(has_function_privilege(r, p.oid, 'execute')) from pg_proc p, unnest(array['anon', 'authenticated']) r
  where p.pronamespace = 'public'::regnamespace and p.proname in ('cadence_direct', 'pendule_apres', 'direct_constater', 'direct_en_cours', 'games_direct_pendule')),
  false, 'internes fermées à l''app');
select pg_temp.egal((select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('find_match', 'quitter_file_attente', 'pendule_direct')), false, 'fermées à anon');
select pg_temp.egal((select bool_and(has_function_privilege('authenticated', p.oid, 'execute')) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('find_match', 'quitter_file_attente', 'pendule_direct')), true, 'ouvertes aux comptes');
select pg_temp.egal((select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'find_match'), 1::bigint, 'une seule find_match');
select pg_temp.egal((select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'parties_direct'), 1::bigint, 'pendule en temps réel');
select pg_temp.egal((select bool_and(relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'), true, 'RLS active sur chaque table');
select pg_temp.egal(has_table_privilege('anon', 'public.parties_direct', 'select'), false, 'anon ne lit pas la pendule');

\o
\echo 'partie_en_direct : tous les cas passent.'
rollback;
