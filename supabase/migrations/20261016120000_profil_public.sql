-- Issue #560 : profil public d'un joueur, lu par son pseudo exact depuis « Mes amis », une demande d'ami, la fin
-- d'une partie en ligne ou le bilan de la semaine. Une seule fonction, `profil_public(p_pseudo)`, `security definer`
-- à `search_path` vide, réservée aux joueurs connectés avec un pseudo (JGC01 / JGP01 de #343, comme les amis).
--
-- Ce qu'un joueur voit d'un autre (et rien de plus) :
--   pseudo ; cote arrondie et « provisoire » (le grade s'en déduit dans l'app) ; nombre de parties classées finies ;
--   les 5 dernières parties classées (résultat vu du joueur consulté, date, taille, couleur, adversaire par pseudo —
--   « un joueur » si cet adversaire a bloqué le demandeur ou est bloqué par lui, ou n'a pas de pseudo) ;
--   le lien d'amitié avec le demandeur : aucun, envoyee (le demandeur a demandé), recue (le joueur consulté a
--   demandé), amis, ou moi (son propre pseudo).
-- Jamais : e-mail, identifiant, écart et volatilité de la cote, cote des problèmes, série, gels, dates, preuve
-- d'accord, badges, revues, parties contre l'ordinateur, parties non classées, parties en cours ou annulées.
--
-- Si l'un des deux a bloqué l'autre, la fonction rend NULL, exactement comme pour un pseudo inconnu : rien ne révèle le
-- blocage (même règle que « Ce joueur n'est pas disponible », #363).
--
-- Énumération : un joueur connecté lit déjà `profiles.username` par la RLS (#530), mais la fonction est un point
-- d'appel facile à boucler. Plafond : 60 consultations par heure glissante et par compte, pseudos inconnus compris
-- (JGV01, indice : minutes à attendre), notées dans `profils_consultes` (heure seulement), effacées après une heure (à
-- l'appel suivant) et par une tâche quotidienne. Même modèle que `exporter_mes_donnees` (#530).
--
-- RLS inchangée partout, aucun droit nouveau pour anon, aucune donnée supprimée hors le journal créé ici.

-- 1. Journal des consultations (plafond). RLS sans politique, voulu : l'app n'y lit ni n'y écrit.
create table if not exists public.profils_consultes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  fait_le timestamptz not null default now()
);
create index if not exists profils_consultes_user_fait_le on public.profils_consultes (user_id, fait_le desc);
alter table public.profils_consultes enable row level security;
revoke all on public.profils_consultes from public, anon, authenticated;
comment on table public.profils_consultes is
  '#560 : heure de chaque consultation d''un profil public, par compte, pour le plafond de 60 par heure. Gardé 1 heure. '
  'RLS sans politique, voulu : lu et écrit seulement par profil_public() et purger_profils_consultes().';

-- 2. Le profil public.
create or replace function public.profil_public(p_pseudo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_pseudo text := btrim(coalesce(p_pseudo, ''));
  v_plafond constant integer := 60;
  v_recents integer;
  v_premier timestamptz;
  v_attente integer;
  v_lui uuid;
  v_profil record;
  v_lien text;
begin
  -- Plafond, compté avant toute recherche : un pseudo inconnu coûte autant qu'un pseudo connu.
  delete from public.profils_consultes c where c.user_id = v_uid and c.fait_le < now() - interval '1 hour';
  select count(*), min(c.fait_le) into v_recents, v_premier
    from public.profils_consultes c where c.user_id = v_uid and c.fait_le > now() - interval '1 hour';
  if v_recents >= v_plafond then
    v_attente := greatest(1, ceil(extract(epoch from (v_premier + interval '1 hour' - now())) / 60)::integer);
    raise exception using errcode = 'JGV01',
      message = 'Tu as consulté beaucoup de profils. Réessaie dans ' || v_attente || ' min.',
      hint = v_attente::text;
  end if;
  insert into public.profils_consultes (user_id) values (v_uid);

  -- Joueur visé : un vrai compte avec ce pseudo exact (sans casse). Inconnu, mal formé ou anonyme : rien.
  if v_pseudo !~ '^[A-Za-z0-9_-]{3,24}$' then
    return null;
  end if;
  select p.id, p.username, p.rating, p.cote_provisoire into v_profil
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.username is not null and lower(p.username) = lower(v_pseudo)
      and coalesce(u.is_anonymous, false) = false;
  if v_profil.id is null then
    return null;
  end if;
  v_lui := v_profil.id;

  -- Blocage dans un sens ou dans l'autre : rien, comme un pseudo inconnu.
  if v_lui <> v_uid and public.est_bloque(v_uid, v_lui) then
    return null;
  end if;

  -- Lien d'amitié vu du demandeur.
  if v_lui = v_uid then
    v_lien := 'moi';
  else
    select case when f.status = 'accepted' then 'amis' when f.requester_id = v_uid then 'envoyee' else 'recue' end
      into v_lien
      from public.friendships f
      where (f.requester_id = v_uid and f.addressee_id = v_lui) or (f.requester_id = v_lui and f.addressee_id = v_uid)
      limit 1;
    v_lien := coalesce(v_lien, 'aucun');
  end if;

  return (
    with classees as (
      select g.id, g.size, g.updated_at,
             case when g.black_id = v_lui then 'noir' else 'blanc' end as couleur,
             case when g.result like 'B+%' then (g.black_id = v_lui)
                  when g.result like 'W+%' then (g.white_id = v_lui)
                  else null end as gagnee,
             case when g.black_id = v_lui then g.white_id else g.black_id end as adversaire_id
        from public.games g
        where g.status = 'finished' and g.rated and g.bot_id is null
          and g.black_id is not null and g.white_id is not null and g.black_id <> g.white_id
          and v_lui in (g.black_id, g.white_id)
    ),
    dernieres as (
      select c.*, p.username as adversaire_pseudo
        from classees c
        left join public.profiles p on p.id = c.adversaire_id
        order by c.updated_at desc, c.id desc
        limit 5
    )
    select jsonb_build_object(
      'pseudo', v_profil.username,
      'cote', round(v_profil.rating)::integer,
      'provisoire', coalesce(v_profil.cote_provisoire, false),
      'parties_classees', (select count(*) from classees),
      'lien', v_lien,
      'parties', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'adversaire', case
                   -- Le demandeur lui-même : son pseudo, et `toi` pour l'écran.
                   when d.adversaire_id = v_uid then d.adversaire_pseudo
                   -- Un joueur qui a bloqué le demandeur, ou bloqué par lui, ou sans pseudo : « un joueur ».
                   when d.adversaire_pseudo is null or public.est_bloque(v_uid, d.adversaire_id) then null
                   else d.adversaire_pseudo end,
                 'toi', d.adversaire_id = v_uid,
                 'gagnee', d.gagnee,
                 'le', to_char(d.updated_at at time zone 'Europe/Paris', 'YYYY-MM-DD'),
                 'taille', d.size,
                 'couleur', d.couleur
               ) order by d.updated_at desc, d.id desc)
          from dernieres d), '[]'::jsonb)
    )
  );
end;
$$;
comment on function public.profil_public(text) is
  '#560 : profil public d''un joueur par son pseudo exact : pseudo, cote arrondie, parties classées (nombre et 5 dernières, '
  'adversaire par pseudo sauf blocage), lien d''amitié avec le demandeur. NULL si inconnu ou si l''un bloque l''autre. '
  '60 par heure (JGV01, indice : minutes à attendre). Compte avec pseudo exigé (JGC01, JGP01).';
revoke all on function public.profil_public(text) from public, anon;
grant execute on function public.profil_public(text) to authenticated;

-- 3. Purge quotidienne du journal (défense en profondeur : chaque appel efface déjà ses lignes de plus d'une heure).
create or replace function public.purger_profils_consultes()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.profils_consultes where fait_le < now() - interval '1 hour';
$$;
comment on function public.purger_profils_consultes() is '#560 : efface le journal des consultations de profils de plus d''une heure. Tâche pg_cron quotidienne.';
revoke execute on function public.purger_profils_consultes() from public, anon, authenticated, service_role;

do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $s$select cron.schedule('purger-profils-consultes', '52 3 * * *', 'select public.purger_profils_consultes()')$s$;
  end if;
end;
$cron$;
