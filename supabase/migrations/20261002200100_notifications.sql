-- Issue #367, partie 2 (serveur) : notifications dans l'app. La partie 1 (#391) calcule déjà « À faire » sur
-- l'appareil (src/app/aFaire.ts) à partir des défis lus sous la RLS. Cette migration ajoute ce qui ne peut pas se
-- calculer sur l'appareil :
--   1. un signal par joueur, poussé en temps réel : « l'ami a joué », « il propose les pierres mortes », « la partie
--      est finie », « une demande d'ami t'attend ». Le client écoute SA seule file (filtre et RLS), au lieu d'écouter
--      toute la table `games`, dont la RLS laisse passer les parties publiques de tous les joueurs ;
--   2. la mémoire du « déjà vu » : ouvrir la partie marque sa notification lue et efface la pastille de l'onglet,
--      sur tous les appareils du joueur ;
--   3. la base du futur rappel poussé « C'est ton tour » (#36, #351), sans l'activer : une notification non lue
--      depuis un moment est exactement ce qu'un envoyeur lira.
--
-- Données gardées : destinataire, type, partie visée, dates de création et de lecture. Ni texte, ni adversaire
-- (le client lit le pseudo dans les profils publics, sous la RLS). Purge à 30 jours (tâche pg_cron ci-dessous).
--
-- Sécurité :
-- - RLS : chaque joueur lit ses seules lignes. Aucune écriture directe (ni politique, ni droit) ;
-- - écrites par des déclencheurs `security definer` (search_path vide) sur `games` (défis seulement) et
--   `friendships`, donc quel que soit le chemin : jouer_coup_defi, game-action, finish_game_by_score, resign_game,
--   victoire_au_temps, rejoindre_defi ;
-- - « lue » posé par `marquer_notifications_lues`, pour les seules lignes de l'appelant ;
-- - aucune cote touchée (les défis ne sont pas classés ; rien ici n'appelle apply_game_rating).

-- 1. Table
create table public.notifications (
  id bigint generated always as identity primary key,
  destinataire_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('tour', 'comptage', 'fin', 'ami')),
  partie_id uuid references public.games(id) on delete cascade,
  creee_le timestamptz not null default now(),
  lue_le timestamptz,
  check ((type = 'ami') = (partie_id is null))
);
comment on table public.notifications is
  'Notifications dans l''app (issue #367). Écrites par les déclencheurs notifier_partie et notifier_ami ; lues par leur destinataire (RLS) ; marquées lues par marquer_notifications_lues ; purgées à 30 jours.';
comment on column public.notifications.type is
  'tour : c''est ton coup dans un défi ; comptage : ta réponse est attendue au comptage ; fin : la partie est finie ; ami : une demande d''ami t''attend.';
comment on column public.notifications.lue_le is
  'Lue (cible ouverte) ou dépassée (l''état de la partie a changé). Null : en attente, pastille et futur rappel poussé (#36).';

-- Une seule notification en attente par joueur, type et cible : un coup de plus la rafraîchit, sans doublon.
create unique index notifications_en_attente_idx on public.notifications (destinataire_id, type, partie_id)
  nulls not distinct where lue_le is null;
create index notifications_partie_idx on public.notifications (partie_id);
create index notifications_creee_le_idx on public.notifications (creee_le);

alter table public.notifications enable row level security;
create policy "Chacun lit ses notifications" on public.notifications
  for select to authenticated
  using ((select auth.uid()) = destinataire_id);
revoke all on public.notifications from anon;
revoke insert, update, delete, truncate, references, trigger on public.notifications from authenticated;
grant select on public.notifications to authenticated;

-- 2. Écriture interne : crée la notification en attente, ou la rafraîchit si elle existe déjà.
create or replace function public.notifier(p_destinataire uuid, p_type text, p_partie uuid)
returns void
language sql security invoker set search_path = ''
as $$
  insert into public.notifications (destinataire_id, type, partie_id)
  select p_destinataire, p_type, p_partie
  where p_destinataire is not null
  on conflict (destinataire_id, type, partie_id) where lue_le is null
  do update set creee_le = now();
$$;
revoke execute on function public.notifier(uuid, text, uuid) from public, anon, authenticated, service_role;

-- 3. Déclencheur sur les défis. Chaque changement d'état rend « dépassé » ce qui attendait (tour, comptage), puis
--    prévient qui doit agir maintenant. Jamais l'auteur de l'action quand il est connu (auth.uid()) : il est déjà
--    devant la partie. Sous la clé service (game-action), auth.uid() est nul : le joueur au trait est l'autre.
create or replace function public.notifier_partie()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_acteur uuid := auth.uid();
  v_premier text;
  v_trait uuid;
  v_dest uuid;
begin
  if not exists (select 1 from public.defis where partie_id = new.id) then
    return null;
  end if;

  update public.notifications set lue_le = now()
    where partie_id = new.id and lue_le is null and type in ('tour', 'comptage');

  -- Partie finie (abandon, temps, comptage accepté) : les deux joueurs, sauf l'auteur. Au comptage accepté par la
  -- fonction serveur, l'auteur est celui qui n'avait pas proposé.
  if new.status = 'finished' and old.status is distinct from 'finished' then
    if v_acteur is null and old.counting and old.dead_proposed_by is not null and coalesce(new.result, '') !~ '\+[RT]$' then
      v_acteur := case when old.dead_proposed_by = new.black_id then new.white_id else new.black_id end;
    end if;
    foreach v_dest in array array[new.black_id, new.white_id] loop
      if v_dest is distinct from v_acteur then
        perform public.notifier(v_dest, 'fin', new.id);
      end if;
    end loop;
    return null;
  end if;
  if new.status <> 'active' then
    return null;
  end if;

  if new.counting and new.dead_proposed_by is not null then
    -- Pierres mortes proposées : l'autre accepte ou reprend.
    v_dest := case when new.dead_proposed_by = new.black_id then new.white_id else new.black_id end;
  else
    -- Coup joué, reprise après un comptage, ou comptage qui commence (deux passes) : le joueur au trait, c'est-à-dire
    -- celui qui n'a pas joué le dernier coup.
    v_premier := case when new.handicap > 0 then 'W' else 'B' end;
    v_trait := case when ((char_length(new.moves) / 2) % 2 = 0) = (v_premier = 'B') then new.black_id else new.white_id end;
    v_dest := v_trait;
  end if;
  if v_dest is distinct from v_acteur then
    perform public.notifier(v_dest, case when new.counting then 'comptage' else 'tour' end, new.id);
  end if;
  return null;
end;
$$;
revoke execute on function public.notifier_partie() from public, anon, authenticated, service_role;
create trigger notifier_partie after update of moves, counting, dead_stones, dead_proposed_by, status on public.games
  for each row
  when (old.moves is distinct from new.moves or old.counting is distinct from new.counting
        or old.dead_stones is distinct from new.dead_stones or old.dead_proposed_by is distinct from new.dead_proposed_by
        or old.status is distinct from new.status)
  execute function public.notifier_partie();

-- 4. Déclencheur sur les amis : une demande reçue prévient ; quand plus aucune n'attend, la notification est dépassée.
create or replace function public.notifier_ami()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_dest uuid := case when tg_op = 'DELETE' then old.addressee_id else new.addressee_id end;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.notifier(new.addressee_id, 'ami', null);
  elsif not exists (select 1 from public.friendships where addressee_id = v_dest and status = 'pending') then
    update public.notifications set lue_le = now()
      where destinataire_id = v_dest and type = 'ami' and lue_le is null;
  end if;
  return null;
end;
$$;
revoke execute on function public.notifier_ami() from public, anon, authenticated, service_role;
create trigger notifier_ami after insert or update of status or delete on public.friendships
  for each row execute function public.notifier_ami();

-- 5. Marquer lues ses notifications : celles d'une partie (ouverte), d'un type (liste des amis ouverte), ou toutes.
--    Renvoie le nombre de lignes marquées. Session anonyme acceptée : un ancien défi en cours reste jouable.
create or replace function public.marquer_notifications_lues(p_partie uuid default null, p_type text default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_type is not null and p_type not in ('tour', 'comptage', 'fin', 'ami') then
    raise exception 'Type inconnu' using errcode = '22023';
  end if;
  update public.notifications set lue_le = now()
    where destinataire_id = v_uid and lue_le is null
      and (p_partie is null or partie_id = p_partie)
      and (p_type is null or type = p_type);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function public.marquer_notifications_lues(uuid, text) from public, anon;
grant execute on function public.marquer_notifications_lues(uuid, text) to authenticated;

-- 6. Purge : 30 jours après leur création, lues ou non. Personne ne l'appelle depuis l'app.
create or replace function public.purger_notifications()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from public.notifications where creee_le < now() - interval '30 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
comment on function public.purger_notifications() is 'Efface les notifications de plus de 30 jours. Tâche pg_cron quotidienne. Issue #367.';
revoke execute on function public.purger_notifications() from public, anon, authenticated, service_role;

do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $s$select cron.schedule('purger-notifications', '47 3 * * *', 'select public.purger_notifications()')$s$;
  end if;
end;
$cron$;

-- 7. Défis déjà en cours au déploiement : le joueur qui doit agir a sa notification en attente (sinon la pastille
--    ne s'allumerait qu'au coup suivant).
insert into public.notifications (destinataire_id, type, partie_id)
select a.dest, a.type, a.partie_id
from (
  select case
           when g.counting and g.dead_proposed_by is not null
             then case when g.dead_proposed_by = g.black_id then g.white_id else g.black_id end
           when ((char_length(g.moves) / 2) % 2 = 0) = (g.handicap = 0) then g.black_id
           else g.white_id
         end as dest,
         case when g.counting then 'comptage' else 'tour' end as type,
         g.id as partie_id
  from public.games g
  join public.defis d on d.partie_id = g.id
  where g.status = 'active'
) a
where a.dest is not null
on conflict do nothing;

-- 8. Temps réel : le joueur reçoit ses notifications sans recharger (RLS appliquée à chaque abonné).
alter publication supabase_realtime add table public.notifications;
