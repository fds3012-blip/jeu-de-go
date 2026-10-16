-- Issue #561 : titres mensuels. Chaque 1er du mois (pg_cron, mois civil de Paris), le serveur classe les JOUEURS ACTIFS
-- du mois écoulé (au moins 10 parties classées en ligne finies dans le mois) et donne un titre aux premiers :
--   top 1 %  « Maître du mois »  (`maitre`)
--   top 5 %  « Expert du mois »  (`expert`)
--   top 20 % « Habitué du mois » (`habitue`)
-- Doc : docs/game-design/titres-mensuels.md.
--
-- Mesure (une seule) : la cote Glicko-2 de FIN DE MOIS, lue dans `rating_history` (dernière ligne `game` du mois : la
-- cote après la dernière partie classée du mois). Pas le gain du mois : un départ bas (`choisir_depart_cote` à 300) ou
-- un compte neuf gagneraient 500 points en dix parties, et le gain pénalise les joueurs déjà bien placés. La cote de
-- fin de mois dit « les meilleurs parmi ceux qui ont joué » : stable, comprise en trois secondes, difficile à truquer.
--
-- Seuils calculés, jamais écrits en dur : rang par cote décroissante (`rank()`, les ex æquo partagent le rang et donc
-- le titre), coupures à ceil(1 %), ceil(5 %), ceil(20 %) du nombre d'actifs. Les cotes de coupure et les effectifs
-- sont gardés par mois dans `titres_mois` (table d'équipe).
--
-- Garde-fou : moins de 200 actifs dans le mois, rien n'est attribué : la fonction écrit seulement le nombre d'actifs
-- dans `titres_mois` (`publie = false`), aucune ligne dans `titres_joueurs`. Dès 200 : titres écrits, `publie = true`.
--
-- Pas de classement nominatif public : un joueur lit SES titres seulement (RLS sur `titres_joueurs`). Les titres d'un
-- autre joueur ne se lisent que par `titres_du_joueur(p_profile_id)`, pensée pour le profil public (#560) : compte avec
-- pseudo exigé, rien si l'un a bloqué l'autre (#363), mois publiés seulement, ni cote ni rang ni effectifs.
--
-- Parties comptées : les lignes `rating_history.kind = 'game'` du mois (une par joueur et par partie classée entre
-- humains, écrites par `apply_game_rating` seulement ; les défis, les parties contre l'IA et les problèmes n'y sont pas).
-- Mois civil d'Europe/Paris, bornes [1er 00:00, 1er du mois suivant 00:00[. Comptes sans pseudo exclus.
--
-- Sécurité : RLS sur les deux tables ; `titres_mois` sans politique (équipe : clé service seulement) ; aucun droit pour
-- anon ; fonctions `security definer` à `search_path` vide ; `calculer_titres_mensuels` fermée à l'app (pg_cron et clé
-- service). Rien n'est modifié ni supprimé dans les tables existantes. Les titres s'effacent avec le compte (cascade).
--
-- Tests : supabase/tests/titres_mensuels.test.sql. À appliquer à la main (Florian), pas par la CI.

-- 1. Résumé par mois (table d'équipe) : effectif, garde-fou, seuils calculés.
create table public.titres_mois (
  mois date primary key check (mois = date_trunc('month', mois)::date),
  actifs integer not null check (actifs >= 0),
  publie boolean not null default false,
  seuil_maitre integer,
  seuil_expert integer,
  seuil_habitue integer,
  n_maitre integer not null default 0 check (n_maitre >= 0),
  n_expert integer not null default 0 check (n_expert >= 0),
  n_habitue integer not null default 0 check (n_habitue >= 0),
  calcule_le timestamptz not null default now(),
  constraint titres_mois_publie_seuils check (
    (publie and seuil_maitre is not null and seuil_expert is not null and seuil_habitue is not null)
    or (not publie and seuil_maitre is null and seuil_expert is null and seuil_habitue is null and n_maitre = 0 and n_expert = 0 and n_habitue = 0))
);
comment on table public.titres_mois is
  'Issue #561 : par mois (1er du mois, Paris), nombre de joueurs actifs (10 parties classées ou plus), garde-fou (`publie` dès 200 actifs), cotes de coupure et effectifs des titres. Table d''équipe : RLS sans politique, voulu ; écrite par calculer_titres_mensuels seule, lue par la clé service.';
alter table public.titres_mois enable row level security;
revoke all on public.titres_mois from public, anon, authenticated;

-- 2. Titres des joueurs : une ligne par mois et par joueur titré. Chacun lit les siennes.
create table public.titres_joueurs (
  mois date not null references public.titres_mois(mois) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  titre text not null check (titre in ('maitre', 'expert', 'habitue')),
  cote integer not null,
  parties integer not null check (parties >= 10),
  primary key (mois, user_id)
);
comment on table public.titres_joueurs is
  'Issue #561 : titre du mois d''un joueur (maitre : top 1 %, expert : top 5 %, habitue : top 20 % des joueurs actifs), avec sa cote de fin de mois et ses parties classées du mois. Écrite par calculer_titres_mensuels seule. Un joueur lit ses lignes (RLS) ; celles des autres passent par titres_du_joueur. Effacée avec le compte.';
create index titres_joueurs_user_idx on public.titres_joueurs (user_id, mois desc);
alter table public.titres_joueurs enable row level security;
create policy "Chacun lit ses titres" on public.titres_joueurs
  for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.titres_joueurs from public, anon;
revoke insert, update, delete, truncate, references, trigger on public.titres_joueurs from authenticated;
grant select on public.titres_joueurs to authenticated;

-- 3. Calcul d'un mois. Sans argument : le mois civil de Paris qui vient de finir. Rejouable : le mois est recalculé
--    (titres du mois effacés puis réécrits). Refuse un mois pas encore fini (22023).
create or replace function public.calculer_titres_mensuels(p_mois date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mois date := coalesce(date_trunc('month', p_mois)::date,
                          (date_trunc('month', now() at time zone 'Europe/Paris') - interval '1 month')::date);
  v_debut timestamptz := v_mois::timestamp at time zone 'Europe/Paris';
  v_fin timestamptz := (v_mois + interval '1 month')::timestamp at time zone 'Europe/Paris';
  v_min_parties constant integer := 10;
  v_min_actifs constant integer := 200;
  v_actifs integer;
  v_resume record;
begin
  if v_fin > now() then
    raise exception 'Le mois % n''est pas fini', to_char(v_mois, 'YYYY-MM') using errcode = '22023';
  end if;

  -- Joueurs actifs du mois : cote de fin de mois (dernière ligne `game` du mois) et nombre de parties classées.
  create temp table titres_actifs on commit drop as
    with lignes as (
      select h.user_id, h.rating,
             row_number() over (partition by h.user_id order by h.created_at desc, h.id desc) as rang_date,
             count(*) over (partition by h.user_id) as parties
        from public.rating_history h
        join public.profiles p on p.id = h.user_id
        where h.kind = 'game' and h.created_at >= v_debut and h.created_at < v_fin
          and p.username is not null
    )
    select user_id, rating as cote, parties::integer as parties,
           rank() over (order by rating desc) as rang
      from lignes
      where rang_date = 1 and parties >= v_min_parties;
  select count(*) into v_actifs from pg_temp.titres_actifs;

  delete from public.titres_joueurs where mois = v_mois;

  if v_actifs >= v_min_actifs then
    -- Coupures sur la distribution réelle : ceil(1 %), ceil(5 %), ceil(20 %) des actifs ; ex æquo : même titre.
    insert into public.titres_joueurs (mois, user_id, titre, cote, parties)
      select v_mois, a.user_id,
             case when a.rang <= ceil(v_actifs * 0.01) then 'maitre'
                  when a.rang <= ceil(v_actifs * 0.05) then 'expert'
                  else 'habitue' end,
             a.cote, a.parties
        from pg_temp.titres_actifs a
        where a.rang <= ceil(v_actifs * 0.20);
    select count(*) filter (where titre = 'maitre') as n_maitre,
           count(*) filter (where titre = 'expert') as n_expert,
           count(*) filter (where titre = 'habitue') as n_habitue,
           min(cote) filter (where titre = 'maitre') as seuil_maitre,
           min(cote) filter (where titre = 'expert') as seuil_expert,
           min(cote) filter (where titre = 'habitue') as seuil_habitue
      into v_resume
      from public.titres_joueurs where mois = v_mois;
    -- Un palier vide (aucun expert parce que les ex æquo du haut l'ont absorbé) garde la coupure du palier au-dessus.
    v_resume.seuil_expert := coalesce(v_resume.seuil_expert, v_resume.seuil_maitre);
    v_resume.seuil_habitue := coalesce(v_resume.seuil_habitue, v_resume.seuil_expert);
    insert into public.titres_mois as m (mois, actifs, publie, seuil_maitre, seuil_expert, seuil_habitue, n_maitre, n_expert, n_habitue, calcule_le)
      values (v_mois, v_actifs, true, v_resume.seuil_maitre, v_resume.seuil_expert, v_resume.seuil_habitue,
              v_resume.n_maitre, v_resume.n_expert, v_resume.n_habitue, now())
      on conflict (mois) do update
        set actifs = excluded.actifs, publie = true,
            seuil_maitre = excluded.seuil_maitre, seuil_expert = excluded.seuil_expert, seuil_habitue = excluded.seuil_habitue,
            n_maitre = excluded.n_maitre, n_expert = excluded.n_expert, n_habitue = excluded.n_habitue, calcule_le = now();
  else
    -- Garde-fou : trop peu d'actifs pour une distribution qui veuille dire quelque chose. Le compteur seul.
    insert into public.titres_mois as m (mois, actifs, publie, calcule_le)
      values (v_mois, v_actifs, false, now())
      on conflict (mois) do update
        set actifs = excluded.actifs, publie = false,
            seuil_maitre = null, seuil_expert = null, seuil_habitue = null,
            n_maitre = 0, n_expert = 0, n_habitue = 0, calcule_le = now();
  end if;

  drop table pg_temp.titres_actifs;
  return (select to_jsonb(m) - 'calcule_le' from public.titres_mois m where m.mois = v_mois);
end;
$$;
comment on function public.calculer_titres_mensuels(date) is
  'Issue #561 : titres du mois écoulé (Paris) ou du mois donné, sur les joueurs actifs (10 parties classées ou plus) : top 1 % maitre, 5 % expert, 20 % habitue par cote de fin de mois. Moins de 200 actifs : compteur seul. Rejouable. Tâche pg_cron titres-mensuels ; clé service.';
revoke execute on function public.calculer_titres_mensuels(date) from public, anon, authenticated;
grant execute on function public.calculer_titres_mensuels(date) to service_role;

-- 4. Titres d'un joueur, pour le profil public (#560) : mois et titre, mois publiés seulement, du plus récent au plus
--    ancien. Compte avec pseudo exigé ; rien si l'un des deux a bloqué l'autre (comme un joueur inconnu).
create or replace function public.titres_du_joueur(p_profile_id uuid)
returns table (mois date, titre text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
begin
  if p_profile_id is null or (p_profile_id <> v_uid and public.est_bloque(v_uid, p_profile_id)) then
    return;
  end if;
  return query
    select t.mois, t.titre
      from public.titres_joueurs t
      join public.titres_mois m on m.mois = t.mois and m.publie
      where t.user_id = p_profile_id
      order by t.mois desc
      limit 36;
end;
$$;
comment on function public.titres_du_joueur(uuid) is
  'Issue #561 : mois et titre (maitre, expert, habitue) d''un joueur, mois publiés seulement, pour le profil public (#560). Compte avec pseudo exigé ; rien en cas de blocage. Ni cote, ni rang, ni effectifs.';
revoke execute on function public.titres_du_joueur(uuid) from public, anon;
grant execute on function public.titres_du_joueur(uuid) to authenticated;

-- 5. Tâche : le 1er de chaque mois à 1 h 17 UTC (2 h 17 ou 3 h 17 à Paris : le mois de Paris est fini), comme
--    `purger-retours` (20261014150000_retours_joueurs.sql). La fonction choisit elle-même le mois de Paris écoulé.
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $s$select cron.schedule('titres-mensuels', '17 1 1 * *', 'select public.calculer_titres_mensuels()')$s$;
  end if;
end;
$cron$;
