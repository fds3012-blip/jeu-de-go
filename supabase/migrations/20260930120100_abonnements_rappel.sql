-- Issue #36 : rappel quotidien du Go du jour par notification web (Web Push, clés VAPID).
--
-- Une ligne par appareil abonné (un navigateur ou une app installée), liée à un vrai compte : pas de rappel
-- sans compte (#343), et une session anonyme (défi par lien) est refusée.
--
-- Règles de sécurité :
-- - RLS active : chaque joueur ne lit, ne modifie et ne supprime que ses abonnements ; anonymes et visiteurs refusés ;
-- - l'inscription passe par `enregistrer_abonnement_rappel` : un appareil déjà abonné par un autre compte (téléphone
--   partagé, changement de compte) change de propriétaire, car seul l'appareil connaît son adresse d'abonnement ;
-- - le client ne peut changer que le moment et la langue ; `dernier_envoi` n'est écrit que par le serveur ;
-- - `reclamer_rappels` (clé service seulement) choisit les rappels à envoyer et les marque envoyés dans la même
--   requête : un rappel par jour au plus, même si la tâche tourne deux fois.
--
-- Jamais la nuit : trois moments seulement (matin 9 h, midi 12 h, soir 18 h, heure du joueur), une fenêtre de
-- 2 heures pour rattraper une tâche manquée, et aucun envoi hors de 8 h à 20 h locales.
-- Pas de rappel un jour où le joueur a déjà réussi un problème (profiles.streak_last) : rien à rappeler.
--
-- L'envoi lui-même est fait par la fonction serveur `envoyer-rappels` (supabase/functions/envoyer-rappels), lancée
-- chaque heure par pg_cron (supabase/planification/envoyer-rappels.sql, désactivé tant que Florian ne l'a pas activé).

create table public.abonnements_rappel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Adresse du service de notification du navigateur (Google, Apple, Mozilla…) : unique par appareil.
  endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1024),
  -- Clés publiques de chiffrement du navigateur (RFC 8291), en base64url.
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{40,200}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{16,64}$'),
  moment text not null default 'soir' check (moment in ('matin', 'midi', 'soir')),
  fuseau text not null default 'Europe/Paris' check (length(fuseau) between 1 and 64),
  langue text not null default 'fr' check (langue in ('fr', 'en')),
  -- Jour (heure du joueur) du dernier rappel envoyé.
  dernier_envoi date,
  cree_le timestamptz not null default now()
);

create index abonnements_rappel_user_id_idx on public.abonnements_rappel (user_id);

alter table public.abonnements_rappel enable row level security;

-- Droits : rien pour les visiteurs ; un joueur connecté lit, supprime, et change seulement moment et langue.
revoke all on table public.abonnements_rappel from anon, authenticated;
grant select, delete on table public.abonnements_rappel to authenticated;
grant update (moment, langue) on table public.abonnements_rappel to authenticated;
grant all on table public.abonnements_rappel to service_role;

create policy "Rappel : lire ses abonnements" on public.abonnements_rappel
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Rappel : créer ses abonnements" on public.abonnements_rappel
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Rappel : modifier ses abonnements" on public.abonnements_rappel
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Rappel : supprimer ses abonnements" on public.abonnements_rappel
  for delete to authenticated using (user_id = (select auth.uid()));

-- Pas de rappel pour une session anonyme (#316, #343) : ni lecture, ni écriture.
create policy "Anonyme : pas de rappel" on public.abonnements_rappel
  as restrictive for all to authenticated
  using ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true)
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);

-- Heure locale de chaque moment. Tout reste entre 8 h et 20 h (garde de reclamer_rappels).
create function public.heure_rappel(p_moment text) returns int
language sql immutable set search_path = ''
as $$ select case p_moment when 'matin' then 9 when 'midi' then 12 when 'soir' then 18 end $$;

-- Inscrit l'appareil (ou met à jour son moment, sa langue, son fuseau) pour le joueur connecté.
create function public.enregistrer_abonnement_rappel(
  p_endpoint text, p_p256dh text, p_auth text, p_moment text, p_fuseau text, p_langue text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_fuseau text := p_fuseau;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Compte requis pour le rappel' using errcode = '42501';
  end if;
  -- Fuseau inconnu : Paris (heure du lancement), plutôt qu'un rappel à une heure imprévisible.
  if v_fuseau is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_fuseau) then
    v_fuseau := 'Europe/Paris';
  end if;
  -- 20 appareils au plus par compte : au-delà, les plus anciens sont retirés.
  delete from public.abonnements_rappel
  where id in (select id from public.abonnements_rappel where user_id = v_uid and endpoint <> p_endpoint
               order by cree_le desc offset 19);
  insert into public.abonnements_rappel (user_id, endpoint, p256dh, auth, moment, fuseau, langue)
  values (v_uid, p_endpoint, p_p256dh, p_auth, coalesce(p_moment, 'soir'), v_fuseau, coalesce(p_langue, 'fr'))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, moment = excluded.moment,
        fuseau = excluded.fuseau, langue = excluded.langue,
        -- Un appareil qui change de compte repart de zéro ; le même joueur garde son dernier envoi.
        dernier_envoi = case when public.abonnements_rappel.user_id = excluded.user_id
                             then public.abonnements_rappel.dernier_envoi end
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.enregistrer_abonnement_rappel(text, text, text, text, text, text) from public, anon;
grant execute on function public.enregistrer_abonnement_rappel(text, text, text, text, text, text) to authenticated;

-- Rappels à envoyer maintenant, marqués envoyés dans la même requête (verrou de ligne : pas de double envoi).
create function public.reclamer_rappels(p_maintenant timestamptz default now())
returns table (id uuid, endpoint text, p256dh text, auth text, langue text, jour date)
language sql security definer set search_path = ''
as $$
  with dus as (
    select a.id, (p_maintenant at time zone a.fuseau) as local
    from public.abonnements_rappel a
    left join public.profiles p on p.id = a.user_id
    where extract(hour from (p_maintenant at time zone a.fuseau))::int
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

revoke all on function public.heure_rappel(text) from public, anon;
grant execute on function public.heure_rappel(text) to authenticated, service_role;
