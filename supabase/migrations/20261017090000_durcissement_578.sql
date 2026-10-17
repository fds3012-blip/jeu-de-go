-- Issue #578 : revue de sécurité d'octobre 2026 (docs/architecture/modele-menace-2026-10.md).
-- Aucune donnée supprimée ni modifiée. Rien ne change pour l'app : chaque droit retiré était déjà refusé par la RLS
-- (aucune politique ne le permettait). On retire le droit lui-même : une politique ajoutée par erreur demain ne
-- suffira plus à ouvrir une écriture. Tests : supabase/tests/durcissement_578.test.sql.

-- 1. Visiteur sans session (rôle anon) : aucune écriture directe sur aucune table ni vue de public.
--    Aucune politique n'est ouverte à anon (relevé du 17/10/2026) ; les fonctions ouvertes au visiteur
--    (apercu_defi, lire_partage, lire_partie_partagee, compter_etape, envoyer_retour) sont security definer.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
-- Même règle pour les tables créées plus tard par ce rôle (les migrations) : plus d'écriture accordée d'office à anon.
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon;

-- 2. Joueur connecté : droits d'écriture sans aucune politique qui les permette (ni usage par l'app).
--    L'app n'écrit directement que dans profiles (pseudo), lesson_progress (upsert), games (parties contre l'IA,
--    partie à rejoindre) et achievements (insert) : ces droits restent.
revoke insert, update, delete on public.rating_history from authenticated;   -- écrite par les fonctions de cote seules
revoke insert, update, delete on public.puzzle_attempts from authenticated;  -- record_puzzle_attempt seule
revoke insert, update on public.match_queue from authenticated;              -- find_match seule ; « Quitter la file » garde delete
revoke update, delete on public.achievements from authenticated;             -- « Gagner un badge » garde insert
revoke update on public.puzzles from authenticated;                          -- créer et supprimer ses problèmes restent
revoke delete on public.lesson_progress from authenticated;                  -- l'upsert garde insert et update
revoke insert, update, delete on public.leaderboard from authenticated;      -- vue de lecture (déjà non modifiable : rank())

-- 3. Rappel quotidien (#36) : l'adresse d'abonnement vient du navigateur du joueur. Seuls les services de
--    notification des navigateurs sont acceptés, sinon la fonction envoyer-rappels pourrait envoyer un POST vers
--    l'hôte de son choix (SSRF). Même liste que endpointAutorise (supabase/functions/envoyer-rappels/logique.ts).
--    NOT VALID : les abonnements existants ne sont ni vérifiés ni touchés ; la fonction filtre aussi à l'envoi.
--    La table n'existe pas encore en production (20261001000100_abonnements_rappel.sql non appliquée) : appliquer
--    celle-là d'abord, sinon cette partie est sautée (la fonction serveur filtre de toute façon).
do $$
begin
  if to_regclass('public.abonnements_rappel') is not null
     and not exists (select 1 from pg_constraint where conname = 'abonnements_rappel_service_connu') then
    alter table public.abonnements_rappel
      add constraint abonnements_rappel_service_connu check (endpoint ~ ('^https://(fcm\.googleapis\.com|android\.googleapis\.com'
        || '|([a-z0-9-]+\.)*push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'))
      not valid;
  end if;
end;
$$;

-- 4. S2 de la revue du 29/09 : creer_defi comptait les défis en attente sans verrou ; des appels simultanés
--    dépassaient la limite de 20. Le profil du créateur est verrouillé avant le compte. Corps identique sinon.
create or replace function public.creer_defi()
returns table (partie_id uuid, jeton text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_partie uuid;
  v_jeton text;
begin
  perform 1 from public.profiles where id = v_uid for update;
  if (select count(*) from public.defis d join public.games g on g.id = d.partie_id
      where d.createur_id = v_uid and g.status = 'waiting' and d.lien_expire_le > now()) >= 20 then
    raise exception 'Tu as déjà 20 défis en attente' using errcode = '54000';
  end if;
  v_jeton := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');
  insert into public.games (white_id, created_by, size, rules, komi, status, rated, prive)
    values (v_uid, v_uid, 9, 'japanese', 6.5, 'waiting', false, true)
    returning id into v_partie;
  insert into public.defis (partie_id, jeton, createur_id) values (v_partie, v_jeton, v_uid);
  return query select v_partie, v_jeton;
end;
$$;
