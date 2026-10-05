-- Issue #369, étendue par la décision de Florian du 05/10 : émulation entre amis, dès 2 joueurs.
-- 1. Go du jour entre amis : chaque essai du Go du jour d'aujourd'hui est noté par le serveur (table
--    `go_du_jour_resultats`) ; `classement_go_du_jour()` rend, pour le joueur et ses amis acceptés, « réussi »,
--    « vu » (réussi après avoir vu la réponse) ou « pas encore », et le nombre d'essais d'une réussite. Jamais de cote,
--    jamais de rang numérique, jamais un non-ami.
-- 2. « Rappelle-lui » : `rappeler_go_du_jour(pseudo)` prévient un ami qui n'a pas encore fait le Go du jour
--    (notification `go_du_jour` dans l'app, #367), une fois par jour et par ami, 20 rappels par jour au plus.
-- 3. Bilan de la semaine : `bilan_semaine(precedente)` rend les parties entre humains finies dans la semaine (lundi à
--    dimanche, heure de Paris), les victoires, les points de cote gagnés ou perdus, les Go du jour faits, et les amis
--    acceptés affrontés (« Tu as battu Léa 2 fois »). Un adversaire qui n'est pas un ami n'est jamais nommé.
-- 4. Records personnels de cote : `mes_records()` rend la meilleure cote atteinte en partie classée (et sa date), la
--    plus longue série de victoires classées et la série en cours. Lus dans `rating_history` et `games`.
-- Les objectifs de la semaine (XP) restent sur l'appareil : ils ne comparent personne (src/app/semaine.ts).
--
-- Sécurité :
-- - toutes les fonctions sont `security definer`, `search_path` vide, réservées à un compte avec pseudo
--   (`exiger_compte_avec_pseudo`, JGC01 / JGP01 de #343), fermées à anon ;
-- - le numéro du Go du jour est celui du serveur (heure de Paris) : un essai d'un autre jour est refusé (JGJ01) ;
-- - `go_du_jour_resultats` : RLS, chacun ne lit que ses lignes, aucune écriture directe ; `rappels_go_du_jour` :
--   RLS sans politique, aucun droit (journal interne) ;
-- - les amis sont lus dans `friendships` (statut `accepted`) à chaque appel : un ami retiré disparaît aussitôt.
-- Données : résultat du Go du jour gardé 35 jours (assez pour le bilan de la semaine précédente), rappels 30 jours,
-- effacés avec le compte (cascade). Aucune donnée existante supprimée ; aucune cote touchée.
--
-- Codes d'erreur (lus par src/data/emulation.ts) :
--   JGJ01 ce n'est pas le Go du jour d'aujourd'hui   JGJ02 ton ami a déjà fait le Go du jour
--   JGJ03 20 rappels envoyés aujourd'hui            JGJ04 résultat inconnu
--   et JGA01, JGA02, JGA08 de #359 (pseudo inconnu, toi-même, pas ton ami).

-- 1. Résultats du Go du jour
create table public.go_du_jour_resultats (
  user_id uuid not null references public.profiles(id) on delete cascade,
  numero integer not null check (numero >= 1),
  etat text not null default 'en_cours' check (etat in ('en_cours', 'reussi', 'vu')),
  essais smallint not null default 0 check (essais between 0 and 99),
  maj_le timestamptz not null default now(),
  primary key (user_id, numero)
);
comment on table public.go_du_jour_resultats is
  'Go du jour par joueur et par numéro (issue #369) : en cours, réussi ou vu (réponse montrée), nombre d''essais. Écrit par noter_go_du_jour seulement ; lu par son joueur (RLS) et, pour aujourd''hui, par ses amis acceptés via classement_go_du_jour. Gardé 35 jours.';
create index go_du_jour_resultats_numero_idx on public.go_du_jour_resultats (numero);
alter table public.go_du_jour_resultats enable row level security;
create policy "Chacun lit ses résultats du Go du jour" on public.go_du_jour_resultats
  for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.go_du_jour_resultats from anon;
revoke insert, update, delete, truncate, references, trigger on public.go_du_jour_resultats from authenticated;
grant select on public.go_du_jour_resultats to authenticated;

-- 2. Journal des rappels « Rappelle-lui » (interne)
create table public.rappels_go_du_jour (
  expediteur_id uuid not null references public.profiles(id) on delete cascade,
  destinataire_id uuid not null references public.profiles(id) on delete cascade,
  numero integer not null,
  envoye_le timestamptz not null default now(),
  primary key (expediteur_id, destinataire_id, numero)
);
comment on table public.rappels_go_du_jour is
  'Rappels du Go du jour entre amis (issue #369) : un par jour et par ami, 20 par jour au plus. Gardé 30 jours. Écrit par rappeler_go_du_jour seulement.';
create index rappels_go_du_jour_destinataire_idx on public.rappels_go_du_jour (destinataire_id);
create index rappels_go_du_jour_date_idx on public.rappels_go_du_jour (envoye_le);
alter table public.rappels_go_du_jour enable row level security;
revoke all on public.rappels_go_du_jour from anon, authenticated;

-- 3. Notifications : nouveau type `go_du_jour` (un ami te rappelle le Go du jour), sans partie.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('tour', 'comptage', 'fin', 'ami', 'go_du_jour'));
alter table public.notifications drop constraint if exists notifications_check;
alter table public.notifications add constraint notifications_check
  check ((type in ('ami', 'go_du_jour')) = (partie_id is null));
comment on column public.notifications.type is
  'tour : c''est ton coup dans un défi ; comptage : ta réponse est attendue au comptage ; fin : la partie est finie ; ami : une demande d''ami t''attend ; go_du_jour : un ami te rappelle le Go du jour (#369).';

create or replace function public.marquer_notifications_lues(p_partie uuid default null, p_type text default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_type is not null and p_type not in ('tour', 'comptage', 'fin', 'ami', 'go_du_jour') then
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

-- 4. Numéro du Go du jour d'aujourd'hui (heure de Paris), comme src/app/goDuJour.ts : n° 1 le 27/09/2026. Interne.
create or replace function public.numero_go_du_jour(p_jour date default null)
returns integer
language sql stable security definer set search_path = ''
as $$
  select (coalesce(p_jour, (now() at time zone 'Europe/Paris')::date) - date '2026-09-27') + 1;
$$;
comment on function public.numero_go_du_jour(date) is 'Issue #369 : numéro du Go du jour d''un jour (aujourd''hui à Paris par défaut). Interne.';
revoke execute on function public.numero_go_du_jour(date) from public, anon, authenticated, service_role;

-- 5. Noter un essai du Go du jour d'aujourd'hui. `p_resultat` : 'rate' (essai faux), 'reussi', 'vu' (réussi après
--    avoir vu la réponse). Une fois réussi ou vu, plus rien ne change. Renvoie l'état. Une réussite (ou « vu ») rend
--    lu le rappel d'un ami en attente.
create or replace function public.noter_go_du_jour(p_numero integer, p_resultat text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_numero integer := public.numero_go_du_jour();
  v_etat text;
begin
  if p_resultat is null or p_resultat not in ('rate', 'reussi', 'vu') then
    raise exception 'Résultat inconnu' using errcode = 'JGJ04';
  end if;
  if p_numero is distinct from v_numero then
    raise exception 'Ce n''est pas le Go du jour d''aujourd''hui' using errcode = 'JGJ01';
  end if;
  delete from public.go_du_jour_resultats where user_id = v_uid and numero < v_numero - 35;
  insert into public.go_du_jour_resultats as r (user_id, numero, etat, essais)
    values (v_uid, v_numero, case when p_resultat = 'rate' then 'en_cours' else p_resultat end, 1)
    on conflict (user_id, numero) do update
      set essais = least(99, r.essais + 1),
          etat = case when p_resultat = 'rate' then 'en_cours' else p_resultat end,
          maj_le = now()
      where r.etat = 'en_cours'
    returning etat into v_etat;
  if v_etat is null then
    select etat into v_etat from public.go_du_jour_resultats where user_id = v_uid and numero = v_numero;
  end if;
  if v_etat in ('reussi', 'vu') then
    update public.notifications set lue_le = now()
      where destinataire_id = v_uid and type = 'go_du_jour' and lue_le is null;
  end if;
  return v_etat;
end;
$$;

-- 6. Go du jour d'aujourd'hui : le joueur et ses amis acceptés. `etat` : 'reussi', 'vu' ou 'pas_encore' (un essai
--    en cours compte comme « pas encore ») ; `essais` seulement pour une réussite ; `rappele` : déjà rappelé
--    aujourd'hui par le joueur. Ordre : réussis (moins d'essais d'abord, puis le plus tôt), vus, pas encore.
create or replace function public.classement_go_du_jour()
returns table (pseudo text, etat text, essais integer, moi boolean, rappele boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_numero integer := public.numero_go_du_jour();
begin
  return query
    with joueurs as (
      select case when f.requester_id = v_uid then f.addressee_id else f.requester_id end as id
        from public.friendships f
        where f.status = 'accepted' and v_uid in (f.requester_id, f.addressee_id)
      union
      select v_uid
    )
    select p.username,
           case when r.etat in ('reussi', 'vu') then r.etat else 'pas_encore' end,
           case when r.etat = 'reussi' then r.essais::integer end,
           p.id = v_uid,
           exists (select 1 from public.rappels_go_du_jour x
                   where x.expediteur_id = v_uid and x.destinataire_id = p.id and x.numero = v_numero)
      from joueurs j
      join public.profiles p on p.id = j.id
      left join public.go_du_jour_resultats r on r.user_id = j.id and r.numero = v_numero
      where p.username is not null
      order by case r.etat when 'reussi' then 0 when 'vu' then 1 else 2 end,
               r.essais nulls last, r.maj_le nulls last, lower(p.username)
      limit 200;
end;
$$;

-- 7. « Rappelle-lui » : notification `go_du_jour` à un ami accepté qui n'a pas encore fait le Go du jour.
--    Renvoie 'envoye', ou 'deja' s'il a déjà été rappelé aujourd'hui par ce joueur (rien n'est renvoyé).
create or replace function public.rappeler_go_du_jour(p_pseudo text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_ami uuid := public.joueur_par_pseudo(p_pseudo);
  v_numero integer := public.numero_go_du_jour();
begin
  if v_ami = v_uid then
    raise exception 'C''est ton propre pseudo' using errcode = 'JGA02';
  end if;
  if not exists (select 1 from public.friendships
      where status = 'accepted'
        and ((requester_id = v_uid and addressee_id = v_ami) or (requester_id = v_ami and addressee_id = v_uid))) then
    raise exception 'Ce joueur n''est pas dans tes amis' using errcode = 'JGA08';
  end if;
  -- Un rappel à la fois par joueur : la limite du jour ne se contourne pas en parallèle.
  perform 1 from public.profiles where id = v_uid for update;
  if exists (select 1 from public.go_du_jour_resultats
      where user_id = v_ami and numero = v_numero and etat in ('reussi', 'vu')) then
    raise exception 'Ton ami a déjà fait le Go du jour' using errcode = 'JGJ02';
  end if;
  if exists (select 1 from public.rappels_go_du_jour
      where expediteur_id = v_uid and destinataire_id = v_ami and numero = v_numero) then
    return 'deja';
  end if;
  delete from public.rappels_go_du_jour where envoye_le < now() - interval '30 days';
  if (select count(*) from public.rappels_go_du_jour where expediteur_id = v_uid and numero = v_numero) >= 20 then
    raise exception 'Tu as envoyé 20 rappels aujourd''hui' using errcode = 'JGJ03';
  end if;
  insert into public.rappels_go_du_jour (expediteur_id, destinataire_id, numero) values (v_uid, v_ami, v_numero);
  perform public.notifier(v_ami, 'go_du_jour', null);
  return 'envoye';
end;
$$;

-- 8. Bilan de la semaine (lundi 0 h à dimanche 24 h, heure de Paris) : la semaine en cours, ou la précédente.
--    Parties entre humains finies (ni IA, ni partie annulée), victoires, points de cote des parties classées,
--    Go du jour faits, et amis acceptés affrontés (5 au plus) avec tes victoires et défaites contre chacun.
create or replace function public.bilan_semaine(p_precedente boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_lundi date := date_trunc('week', (now() at time zone 'Europe/Paris'))::date
                  - case when coalesce(p_precedente, false) then 7 else 0 end;
  v_debut timestamptz := v_lundi::timestamp at time zone 'Europe/Paris';
  v_fin timestamptz := (v_lundi + 7)::timestamp at time zone 'Europe/Paris';
  v_resultat jsonb;
begin
  with parties as (
    select case when g.black_id = v_uid then g.white_id else g.black_id end as adversaire,
           (g.result like 'B+%' and g.black_id = v_uid) or (g.result like 'W+%' and g.white_id = v_uid) as gagne,
           (g.result like 'B+%' or g.result like 'W+%') as decidee
      from public.games g
      where g.status = 'finished' and g.bot_id is null
        and g.black_id is not null and g.white_id is not null and g.black_id <> g.white_id
        and v_uid in (g.black_id, g.white_id)
        and g.updated_at >= v_debut and g.updated_at < v_fin
  ),
  amis as (
    select case when f.requester_id = v_uid then f.addressee_id else f.requester_id end as id
      from public.friendships f
      where f.status = 'accepted' and v_uid in (f.requester_id, f.addressee_id)
  ),
  contre_amis as (
    select p.username as pseudo,
           count(*) filter (where x.gagne) as victoires,
           count(*) filter (where x.decidee and not x.gagne) as defaites
      from parties x
      join amis a on a.id = x.adversaire
      join public.profiles p on p.id = x.adversaire
      where p.username is not null
      group by p.username
  )
  select jsonb_build_object(
    'semaine', to_char(v_lundi, 'YYYY-MM-DD'),
    'parties', (select count(*) from parties),
    'victoires', (select count(*) from parties where gagne),
    'parties_classees', (select count(*) from public.rating_history h
                          where h.user_id = v_uid and h.kind = 'game' and h.created_at >= v_debut and h.created_at < v_fin),
    'cote_ecart', (select coalesce(sum(h.ecart), 0) from public.rating_history h
                    where h.user_id = v_uid and h.kind = 'game' and h.created_at >= v_debut and h.created_at < v_fin),
    'go_du_jour', (select count(*) from public.go_du_jour_resultats r
                    where r.user_id = v_uid and r.etat in ('reussi', 'vu')
                      and r.numero between public.numero_go_du_jour(v_lundi) and public.numero_go_du_jour(v_lundi + 6)),
    'amis', coalesce((select jsonb_agg(jsonb_build_object('pseudo', c.pseudo, 'victoires', c.victoires, 'defaites', c.defaites)
                                       order by c.victoires desc, (c.victoires + c.defaites) desc, lower(c.pseudo))
                       from (select * from contre_amis order by victoires desc, (victoires + defaites) desc, lower(pseudo) limit 5) c),
                      '[]'::jsonb)
  ) into v_resultat;
  return v_resultat;
end;
$$;

-- 9. Records personnels de cote : meilleure cote atteinte après une partie classée (et sa date), plus longue série de
--    victoires classées, série en cours, nombre de parties classées. Rien avant la première partie classée.
create or replace function public.mes_records()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_ligne record;
  v_meilleure integer;
  v_meilleure_le timestamptz;
  v_serie integer := 0;
  v_record integer := 0;
  v_parties integer := 0;
begin
  for v_ligne in
    select h.rating, h.created_at,
           (g.result like 'B+%' and g.black_id = v_uid) or (g.result like 'W+%' and g.white_id = v_uid) as gagne
      from public.rating_history h
      join public.games g on g.id = h.game_id
      where h.user_id = v_uid and h.kind = 'game'
      order by h.created_at, h.id
  loop
    v_parties := v_parties + 1;
    if v_meilleure is null or v_ligne.rating > v_meilleure then
      v_meilleure := v_ligne.rating;
      v_meilleure_le := v_ligne.created_at;
    end if;
    v_serie := case when v_ligne.gagne then v_serie + 1 else 0 end;
    v_record := greatest(v_record, v_serie);
  end loop;
  return jsonb_build_object(
    'parties', v_parties,
    'meilleure_cote', v_meilleure,
    'meilleure_cote_le', case when v_meilleure_le is null then null
                              else to_char(v_meilleure_le at time zone 'Europe/Paris', 'YYYY-MM-DD') end,
    'serie_victoires', v_record,
    'serie_en_cours', v_serie
  );
end;
$$;

comment on function public.noter_go_du_jour(integer, text) is 'Issue #369 : essai du Go du jour d''aujourd''hui (rate, reussi, vu).';
comment on function public.classement_go_du_jour() is 'Issue #369 : Go du jour d''aujourd''hui du joueur et de ses amis acceptés, sans cote ni rang.';
comment on function public.rappeler_go_du_jour(text) is 'Issue #369 : rappel du Go du jour à un ami accepté, un par jour et par ami, 20 par jour.';
comment on function public.bilan_semaine(boolean) is 'Issue #369 : bilan de la semaine (en cours ou précédente) : parties entre humains, victoires, cote, Go du jour, amis affrontés.';
comment on function public.mes_records() is 'Issue #369 : meilleure cote et plus longue série de victoires en parties classées.';

revoke execute on function public.noter_go_du_jour(integer, text), public.classement_go_du_jour(),
  public.rappeler_go_du_jour(text), public.bilan_semaine(boolean), public.mes_records() from public, anon;
grant execute on function public.noter_go_du_jour(integer, text), public.classement_go_du_jour(),
  public.rappeler_go_du_jour(text), public.bilan_semaine(boolean), public.mes_records() to authenticated;
