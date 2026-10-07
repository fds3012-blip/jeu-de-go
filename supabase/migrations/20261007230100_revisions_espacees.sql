-- Issue #469 : révision espacée synchronisée entre les appareils d'un même compte.
-- Les erreurs de partie (« Tes erreurs à rejouer », « Rejouer mes erreurs ») et les problèmes ratés reviennent à J+1,
-- J+3, J+7, J+14, J+30 ; un échec renvoie à J+1. Le calendrier se calcule sur l'appareil (src/app/revisionEspacee.ts) ;
-- le serveur garde seulement la file, pour la retrouver sur un autre appareil. Sans compte, rien n'arrive ici.
--
-- Contenu d'une ligne (une par élément et par joueur) :
-- - `cle` : `erreur-<empreinte de la position>` ou `pb:<id du problème>` ; `genre` en découle ;
-- - `etape` (0 à 4 : J+1 à J+30 ; 5 : acquis) et `prochain` (jour local du prochain passage ; null une fois acquis) ;
-- - `echecs` : échecs comptés depuis l'entrée dans la file ;
-- - `maj` : date du dernier changement, en millisecondes, donnée par l'appareil qui l'a fait ;
-- - `contenu` (erreurs seulement, tant qu'elles ne sont pas acquises) : la position pour la rejouer sur un autre
--   appareil (taille, rangées, couleur au trait, coups acceptés, coup joué, numéro du coup, date de création).
--   Jamais le nom de l'adversaire ni la partie : le serveur ne garde que ces clés-là et ignore le reste.
--
-- Règles :
-- - RLS active : chacun ne lit que ses lignes ; session anonyme refusée (politique restrictive) ; visiteurs : rien ;
-- - aucune écriture directe : tout passe par `echanger_revisions` (security definer, search_path vide), qui exige un vrai
--   compte (pas de pseudo exigé : la file sert dès la connexion) ;
-- - le changement le plus récent gagne, ligne par ligne ; à date égale, la ligne gardée reste (les appareils convergent) ;
--   date : entier entre 0 et maintenant + 1 jour (une horloge d'appareil très en avance ne gagne pas pour toujours) ;
-- - entrée mal formée : ignorée, sans erreur ; 200 lignes par envoi, 500 lignes par joueur au plus (au-delà, les nouvelles
--   restent sur l'appareil) ;
-- - une erreur acquise perd sa position (`contenu` mis à null) ;
-- - purge documentée (politique de confidentialité, section 3.2) : `purger_revisions`, tâche pg_cron quotidienne, efface
--   les lignes acquises depuis plus de 90 jours et les lignes sans changement depuis 400 jours ;
-- - suppression du compte : clé étrangère vers auth.users en cascade (`delete_my_account` supprime auth.users) ;
-- - aucune fonction de cote ne lit cette table.
--
-- Cette migration ne supprime, ne modifie et ne retire rien d'existant : une table, des politiques et des fonctions
-- nouvelles.

create table public.revisions (
  user_id uuid not null references auth.users (id) on delete cascade,
  cle text not null,
  genre text not null,
  etape smallint not null,
  prochain date,
  echecs integer not null default 0,
  contenu jsonb,
  maj bigint not null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  primary key (user_id, cle),
  constraint revisions_cle check (cle ~ '^(erreur-[0-9a-z]{1,13}|pb:[A-Za-z0-9_.-]{1,64})$'),
  constraint revisions_genre check (genre = case when cle like 'erreur-%' then 'erreur' else 'probleme' end),
  constraint revisions_etape check (etape between 0 and 5 and ((etape = 5) = (prochain is null))),
  constraint revisions_echecs check (echecs between 0 and 100000),
  constraint revisions_contenu check (contenu is null
    or (genre = 'erreur' and etape < 5 and jsonb_typeof(contenu) = 'object' and octet_length(contenu::text) <= 4096)),
  constraint revisions_maj check (maj >= 0)
);

comment on table public.revisions is
  'Issue #469 : file de révision espacée (erreurs de partie, problèmes ratés) d''un compte. Écriture par echanger_revisions seulement.';

-- Purge : lignes acquises anciennes, lignes abandonnées.
create index revisions_purge on public.revisions (modifie_le);

alter table public.revisions enable row level security;

-- Droits : rien pour les visiteurs ; un joueur connecté lit seulement (l'écriture passe par la fonction).
revoke all on table public.revisions from anon, authenticated;
grant select on table public.revisions to authenticated;
grant all on table public.revisions to service_role;

create policy "Révisions : lire les siennes" on public.revisions
  for select to authenticated using (user_id = (select auth.uid()));

-- Session anonyme (#316, #343) : rien. Forme `(select auth.jwt())` reconnue par l'analyseur (20261002003100).
create policy "Anonyme : pas de révisions" on public.revisions
  as restrictive for all to authenticated
  using (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true)
  with check (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);

-- Position d'une erreur, réduite aux seules clés utiles, ou null si elle est mal formée.
create function public.revision_contenu(p jsonb)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  v_n integer;
  v_r jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
  if jsonb_typeof(p -> 'size') <> 'number' or (p ->> 'size') not in ('9', '13', '19') then return null; end if;
  v_n := (p ->> 'size')::integer;
  if jsonb_typeof(p -> 'rows') <> 'array' or jsonb_array_length(p -> 'rows') <> v_n then return null; end if;
  for v_r in select value from jsonb_array_elements(p -> 'rows') loop
    if jsonb_typeof(v_r) <> 'string' or length(v_r #>> '{}') <> v_n or (v_r #>> '{}') !~ '^[.XO]+$' then return null; end if;
  end loop;
  if jsonb_typeof(p -> 'toPlay') <> 'number' or (p ->> 'toPlay') not in ('1', '2') then return null; end if;
  if jsonb_typeof(p -> 'reponses') <> 'array' or jsonb_array_length(p -> 'reponses') not between 1 and 20 then return null; end if;
  for v_r in select value from jsonb_array_elements(p -> 'reponses') loop
    if jsonb_typeof(v_r) <> 'number' or (v_r #>> '{}') !~ '^\d{1,3}$' or (v_r #>> '{}')::integer >= v_n * v_n then return null; end if;
  end loop;
  if jsonb_typeof(p -> 'joue') <> 'number' or (p ->> 'joue') !~ '^-?\d{1,3}$'
     or (p ->> 'joue')::integer < -1 or (p ->> 'joue')::integer >= v_n * v_n then return null; end if;
  if jsonb_typeof(p -> 'coup') <> 'number' or (p ->> 'coup') !~ '^\d{1,4}$'
     or (p ->> 'coup')::integer not between 1 and 1000 then return null; end if;
  if jsonb_typeof(p -> 'creeLe') <> 'string' or (p ->> 'creeLe') !~ '^\d{4}-\d{2}-\d{2}T[0-9:.]{5,15}Z$' then return null; end if;
  return jsonb_build_object('creeLe', p -> 'creeLe', 'size', p -> 'size', 'rows', p -> 'rows', 'toPlay', p -> 'toPlay',
    'reponses', p -> 'reponses', 'joue', p -> 'joue', 'coup', p -> 'coup');
end;
$$;

comment on function public.revision_contenu(jsonb) is
  'Issue #469 : position d''une erreur réduite aux clés utiles (taille, rangées, trait, réponses, coup joué, numéro, date), ou null.';
revoke all on function public.revision_contenu(jsonb) from public, anon, authenticated;

-- Fusionne la file envoyée par l'appareil avec celle du serveur (le plus récent gagne, ligne par ligne) et renvoie toute
-- la file du joueur (500 lignes au plus, les plus récentes d'abord). Appelée avec `[]`, elle lit seulement.
create function public.echanger_revisions(p_elements jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_max_maj numeric := floor(extract(epoch from now()) * 1000) + 86400000;
  v_n integer;
  v_e jsonb;
  v_cle text;
  v_genre text;
  v_etape integer;
  v_prochain date;
  v_echecs integer;
  v_maj bigint;
  v_contenu jsonb;
begin
  if v_uid is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or coalesce((select u.is_anonymous from auth.users u where u.id = v_uid), true) then
    raise exception 'Crée ton compte pour garder tes révisions' using errcode = 'JGC01';
  end if;
  p_elements := coalesce(p_elements, '[]'::jsonb);
  if jsonb_typeof(p_elements) <> 'array' then
    raise exception 'Révisions illisibles' using errcode = '22023';
  end if;
  if jsonb_array_length(p_elements) > 200 then
    raise exception 'Trop de révisions' using errcode = '22023';
  end if;

  -- Un envoi à la fois par joueur : deux appareils ne s'écrasent pas.
  perform pg_advisory_xact_lock(hashtextextended('revisions:' || v_uid::text, 0));
  select count(*) into v_n from public.revisions r where r.user_id = v_uid;

  for v_e in select value from jsonb_array_elements(p_elements) loop
    continue when jsonb_typeof(v_e) <> 'object';
    v_cle := v_e ->> 'cle';
    continue when v_cle is null or v_cle !~ '^(erreur-[0-9a-z]{1,13}|pb:[A-Za-z0-9_.-]{1,64})$';
    v_genre := case when v_cle like 'erreur-%' then 'erreur' else 'probleme' end;
    continue when jsonb_typeof(v_e -> 'etape') is distinct from 'number'
      or jsonb_typeof(v_e -> 'echecs') is distinct from 'number'
      or jsonb_typeof(v_e -> 'maj') is distinct from 'number';
    continue when (v_e ->> 'etape') !~ '^[0-5]$' or (v_e ->> 'echecs') !~ '^\d{1,6}$' or (v_e ->> 'maj') !~ '^\d{1,16}$';
    continue when (v_e ->> 'maj')::numeric > v_max_maj or (v_e ->> 'echecs')::integer > 100000;
    v_etape := (v_e ->> 'etape')::integer;
    v_echecs := (v_e ->> 'echecs')::integer;
    v_maj := (v_e ->> 'maj')::bigint;
    v_prochain := null;
    if v_etape < 5 then
      continue when jsonb_typeof(v_e -> 'prochain') is distinct from 'string' or (v_e ->> 'prochain') !~ '^\d{4}-\d{2}-\d{2}$';
      begin
        v_prochain := (v_e ->> 'prochain')::date;
      exception when others then
        continue;
      end;
      -- Un jour plausible : ni avant la création du jeu, ni plus de 31 jours après aujourd'hui (J+30 et fuseaux).
      continue when v_prochain < date '2026-01-01' or v_prochain > current_date + 31;
    end if;
    v_contenu := case when v_genre = 'erreur' and v_etape < 5 then public.revision_contenu(v_e -> 'contenu') end;

    if not exists (select 1 from public.revisions r where r.user_id = v_uid and r.cle = v_cle) then
      continue when v_n >= 500;
      v_n := v_n + 1;
    end if;
    insert into public.revisions as r (user_id, cle, genre, etape, prochain, echecs, contenu, maj)
    values (v_uid, v_cle, v_genre, v_etape, v_prochain, v_echecs, v_contenu, v_maj)
    on conflict (user_id, cle) do update
      set etape = excluded.etape, prochain = excluded.prochain, echecs = excluded.echecs,
          contenu = case when excluded.etape = 5 then null else coalesce(excluded.contenu, r.contenu) end,
          maj = excluded.maj, modifie_le = now()
      where excluded.maj > r.maj;
  end loop;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'cle', x.cle, 'etape', x.etape, 'prochain', to_char(x.prochain, 'YYYY-MM-DD'), 'echecs', x.echecs, 'maj', x.maj,
      'contenu', x.contenu) order by x.maj desc), '[]'::jsonb)
    from (select r.* from public.revisions r where r.user_id = v_uid order by r.maj desc limit 500) x
  );
end;
$$;

comment on function public.echanger_revisions(jsonb) is
  'Issue #469 : file de révision espacée du compte, fusionnée ligne par ligne (le plus récent gagne). Compte requis (JGC01).';

revoke all on function public.echanger_revisions(jsonb) from public, anon;
grant execute on function public.echanger_revisions(jsonb) to authenticated;

-- Rétention : une ligne acquise ne sert plus qu'à prévenir les autres appareils (90 jours suffisent) ; une ligne sans
-- changement depuis 400 jours est une file abandonnée. Effacées chaque nuit.
create function public.purger_revisions()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from public.revisions
  where (etape = 5 and modifie_le < now() - interval '90 days')
     or modifie_le < now() - interval '400 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
comment on function public.purger_revisions() is
  'Issue #469 : efface les révisions acquises depuis plus de 90 jours et celles sans changement depuis 400 jours. Tâche pg_cron quotidienne.';
revoke execute on function public.purger_revisions() from public, anon, authenticated, service_role;

do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $s$select cron.schedule('purger-revisions', '47 3 * * *', 'select public.purger_revisions()')$s$;
  end if;
end;
$cron$;
