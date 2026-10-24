-- Issue #699 (C3) : notification « à toi de jouer » pour les parties lentes, en plus du rappel quotidien (#36).
-- Décision de Florian (22/10) : les deux sont gratuits, désactivés par défaut, et allumés par le joueur lui-même
-- (Profil > Rappels). Rien ne part sans abonnement explicite d'un appareil.
--
-- Modèle : une ligne de `abonnements_rappel` = un appareil. Deux interrupteurs indépendants par appareil :
--   - `jour` : le rappel du Go du jour (comportement de #36, inchangé pour les lignes existantes) ;
--   - `tour` : « à toi de jouer » dans une partie lente classée (éteint par défaut).
-- Une ligne existe tant qu'au moins un des deux est allumé (contrainte) ; les éteindre tous les deux supprime la ligne.
--
-- « À toi de jouer » lit la table `notifications` (#367) : une ligne `tour` (ton coup) ou `comptage` (ta réponse est
-- attendue) non lue, d'une partie classée encore en cours. `reclamer_tours` (clé service seulement) les choisit et les
-- marque envoyées (`poussee_le`) dans la même requête : une seule poussée par notification, jamais deux fois.
--
-- Sobriété (public avec enfants), appliquée ici, pas dans l'app :
--   - jamais la nuit : seulement de 8 h à 20 h, à l'heure de l'appareil ; une notification de nuit attend le matin ;
--   - une par partie et par heure au plus ; trois par 24 heures au plus pour un joueur ;
--   - seulement après l'activation (`tour_depuis`) : un tour déjà en attente au moment où le joueur allume le réglage
--     n'est pas poussé après coup ;
--   - jamais pour un tour de plus de 3 jours (la perte au temps est passée ou imminente : le rappel serait faux) ;
--   - une notification déjà vue dans l'app (`lue_le`) ne part pas.
-- Le contenu envoyé ne dépend que du type et de la langue : ni pseudo, ni adversaire, ni délai. La fonction serveur
-- ajoute l'identifiant de la partie à l'adresse ouverte au toucher (déjà connu de l'appareil, qui est le joueur).
-- Seules les parties classées (parties lentes) sont poussées : les défis entre amis restent dans l'app.

-- 1. Deux interrupteurs par appareil
alter table public.abonnements_rappel
  add column jour boolean not null default true,
  add column tour boolean not null default false,
  add column tour_depuis timestamptz;
alter table public.abonnements_rappel
  add constraint abonnements_rappel_un_choix check (jour or tour),
  add constraint abonnements_rappel_tour_depuis check (tour = (tour_depuis is not null));
comment on column public.abonnements_rappel.jour is 'Rappel du Go du jour allumé sur cet appareil (#36).';
comment on column public.abonnements_rappel.tour is '« À toi de jouer » (parties lentes classées) allumé sur cet appareil (#699). Éteint par défaut.';
comment on column public.abonnements_rappel.tour_depuis is 'Moment où « à toi de jouer » a été allumé : seules les notifications créées après sont poussées.';

-- 2. Mémoire de la poussée, côté notifications (écrite par reclamer_tours seulement)
alter table public.notifications add column poussee_le timestamptz;
comment on column public.notifications.poussee_le is 'Date de la notification poussée « à toi de jouer » (#699). Null : jamais poussée.';
create index notifications_a_pousser_idx on public.notifications (creee_le)
  where lue_le is null and poussee_le is null and type in ('tour', 'comptage');

-- 3. Inscription : même fonction qu'en #36, avec les deux interrupteurs.
--    p_jour (défaut vrai : les anciens clients allument le rappel du jour) et p_tour (défaut : inchangé).
--    Un argument nul garde la valeur actuelle de l'appareil (faux pour un appareil nouveau ou repris par un autre compte).
drop function public.enregistrer_abonnement_rappel(text, text, text, text, text, text);
create function public.enregistrer_abonnement_rappel(
  p_endpoint text, p_p256dh text, p_auth text, p_moment text, p_fuseau text, p_langue text,
  p_jour boolean default true, p_tour boolean default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid;
  v_fuseau text := p_fuseau;
  v_id uuid;
  v_ancien public.abonnements_rappel%rowtype;
  v_meme boolean;
  v_jour boolean;
  v_tour boolean;
begin
  -- #343 : un vrai compte avec pseudo (JGC01 sans compte ou en session anonyme, JGP01 sans pseudo).
  v_uid := public.exiger_compte_avec_pseudo();
  -- Fuseau inconnu : Paris (heure du lancement), plutôt qu'un rappel à une heure imprévisible.
  if v_fuseau is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_fuseau) then
    v_fuseau := 'Europe/Paris';
  end if;
  select * into v_ancien from public.abonnements_rappel where endpoint = p_endpoint for update;
  v_meme := found and v_ancien.user_id = v_uid;
  v_jour := coalesce(p_jour, v_meme and v_ancien.jour);
  v_tour := coalesce(p_tour, v_meme and v_ancien.tour);
  if not (v_jour or v_tour) then
    raise exception 'Aucun rappel à allumer' using errcode = '22023';
  end if;
  -- 20 appareils au plus par compte : au-delà, les plus anciens sont retirés.
  delete from public.abonnements_rappel
  where id in (select id from public.abonnements_rappel where user_id = v_uid and endpoint <> p_endpoint
               order by cree_le desc offset 19);
  insert into public.abonnements_rappel (user_id, endpoint, p256dh, auth, moment, fuseau, langue, jour, tour, tour_depuis)
  values (v_uid, p_endpoint, p_p256dh, p_auth, coalesce(p_moment, 'soir'), v_fuseau, coalesce(p_langue, 'fr'), v_jour, v_tour,
          case when v_tour then now() end)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, moment = excluded.moment,
        fuseau = excluded.fuseau, langue = excluded.langue, jour = excluded.jour, tour = excluded.tour,
        -- Déjà allumé par le même joueur : la date d'activation ne bouge pas (sinon un tour en attente serait perdu).
        tour_depuis = case when not excluded.tour then null
                           when v_meme and v_ancien.tour then v_ancien.tour_depuis
                           else now() end,
        -- Un appareil qui change de compte repart de zéro ; le même joueur garde son dernier envoi.
        dernier_envoi = case when public.abonnements_rappel.user_id = excluded.user_id
                             then public.abonnements_rappel.dernier_envoi end
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.enregistrer_abonnement_rappel(text, text, text, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.enregistrer_abonnement_rappel(text, text, text, text, text, text, boolean, boolean) to authenticated;

-- 4. Rappel du Go du jour : seulement les appareils où il est allumé. Corps de #36 sinon identique.
create or replace function public.reclamer_rappels(p_maintenant timestamptz default now())
returns table (id uuid, endpoint text, p256dh text, auth text, langue text, jour date)
language sql security definer set search_path = ''
as $$
  with dus as (
    select a.id, (p_maintenant at time zone a.fuseau) as local
    from public.abonnements_rappel a
    left join public.profiles p on p.id = a.user_id
    where a.jour
      and extract(hour from (p_maintenant at time zone a.fuseau))::int
            between public.heure_rappel(a.moment) and public.heure_rappel(a.moment) + 1
      and extract(hour from (p_maintenant at time zone a.fuseau))::int between 8 and 19
      and (a.dernier_envoi is null or a.dernier_envoi < (p_maintenant at time zone a.fuseau)::date)
      and (p.streak_last is null or p.streak_last < (p_maintenant at time zone a.fuseau)::date)
    for update of a skip locked
  )
  update public.abonnements_rappel a
     set dernier_envoi = dus.local::date
    from dus
   where a.id = dus.id
  returning a.id, a.endpoint, a.p256dh, a.auth, a.langue, a.dernier_envoi
$$;
revoke all on function public.reclamer_rappels(timestamptz) from public, anon, authenticated;
grant execute on function public.reclamer_rappels(timestamptz) to service_role;

-- 5. « À toi de jouer » : les poussées dues maintenant, marquées envoyées dans la même requête.
--    Une ligne par appareil à prévenir (un joueur avec deux téléphones en reçoit deux pour la même notification).
create function public.reclamer_tours(p_maintenant timestamptz default now())
returns table (id uuid, endpoint text, p256dh text, auth text, langue text, type text, partie_id uuid)
language sql security definer set search_path = ''
as $$
  with candidates as (
    -- Verrou de ligne : deux passages simultanés ne poussent pas deux fois la même notification.
    select n.id
    from public.notifications n
    where n.type in ('tour', 'comptage') and n.lue_le is null and n.poussee_le is null
      and n.creee_le > p_maintenant - interval '3 days'
    for update of n skip locked
  ), dues as (
    select n.id, n.destinataire_id, n.partie_id, n.type, n.creee_le,
           row_number() over (partition by n.destinataire_id order by n.creee_le, n.id) as rang
    from candidates c
    join public.notifications n on n.id = c.id
    join public.games g on g.id = n.partie_id and g.status = 'active' and g.rated
    where exists (
        -- Au moins un appareil allumé après la notification et dans sa journée (8 h à 20 h, heure de l'appareil).
        select 1 from public.abonnements_rappel a
        where a.user_id = n.destinataire_id and a.tour and n.creee_le >= a.tour_depuis
          and extract(hour from (p_maintenant at time zone a.fuseau))::int between 8 and 19)
      -- Une par partie et par heure au plus.
      and not exists (
        select 1 from public.notifications p
        where p.destinataire_id = n.destinataire_id and p.partie_id = n.partie_id and p.poussee_le > p_maintenant - interval '1 hour')
  ), choisies as (
    -- Trois par 24 heures au plus pour un joueur, les plus anciennes d'abord.
    select d.* from dues d
    where d.rang + (select count(*) from public.notifications p
                    where p.destinataire_id = d.destinataire_id and p.poussee_le > p_maintenant - interval '24 hours') <= 3
  ), marquees as (
    update public.notifications n set poussee_le = p_maintenant
      from choisies c where n.id = c.id and n.poussee_le is null
    returning n.id, n.destinataire_id, n.partie_id, n.type, n.creee_le
  )
  select a.id, a.endpoint, a.p256dh, a.auth, a.langue, m.type, m.partie_id
  from marquees m
  join public.abonnements_rappel a on a.user_id = m.destinataire_id and a.tour and m.creee_le >= a.tour_depuis
   and extract(hour from (p_maintenant at time zone a.fuseau))::int between 8 and 19
$$;
comment on function public.reclamer_tours(timestamptz) is
  'Poussées « à toi de jouer » dues (#699), marquées envoyées dans la même requête. Clé service seulement, appelée par la fonction envoyer-rappels.';
revoke all on function public.reclamer_tours(timestamptz) from public, anon, authenticated;
grant execute on function public.reclamer_tours(timestamptz) to service_role;
