-- Issue #448 : réglages synchronisés entre les appareils d'un même compte (suite de #365).
--
-- Pourquoi une table dédiée plutôt qu'une colonne `profiles.settings` : `profiles` est lisible par tous (« Profils
-- visibles par tous » : pseudo et cote des adversaires). Une colonne y serait lue par n'importe quel joueur, sauf à
-- retirer des droits par colonne sur une table très utilisée. Une table à part, lisible par son seul propriétaire,
-- est plus simple à garder sûre.
--
-- Contenu : un objet `{ clé: { "v": valeur, "t": date du changement en millisecondes depuis 1970 } }`. La date vient de
-- l'appareil qui a fait le changement : la règle « dernier changement gagne » s'applique clé par clé.
--
-- Règles :
-- - RLS active : chacun ne lit que sa ligne ; session anonyme refusée (politique restrictive) ; visiteurs : rien ;
-- - aucune écriture directe : tout passe par `enregistrer_reglages`, qui exige un vrai compte (pas de pseudo exigé :
--   les réglages servent dès la connexion) ;
-- - liste blanche de clés et de valeurs (mêmes que src/app/reglagesCompte.ts) : une entrée inconnue ou mal formée est
--   ignorée, sans erreur ; aucune donnée personnelle (pas de texte libre) ;
-- - date : entier entre 0 et maintenant + 1 jour (une horloge d'appareil très en avance ne gagne pas pour toujours) ;
--   à date égale, la valeur déjà gardée reste (les appareils convergent) ;
-- - une clé retirée de la liste blanche plus tard reste dans la ligne (rien n'est effacé) ; elle n'est plus modifiable ;
-- - suppression du compte : clé étrangère vers auth.users en cascade (`delete_my_account` supprime auth.users) ;
-- - aucune fonction de cote ne lit cette table.
--
-- Cette migration ne supprime, ne modifie et ne retire rien d'existant : une table, des politiques et une fonction
-- nouvelles.

create table public.reglages_compte (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reglages jsonb not null default '{}'::jsonb
    check (jsonb_typeof(reglages) = 'object' and octet_length(reglages::text) <= 8192),
  modifie_le timestamptz not null default now()
);

alter table public.reglages_compte enable row level security;

-- Droits : rien pour les visiteurs ; un joueur connecté lit seulement (l'écriture passe par la fonction).
revoke all on table public.reglages_compte from anon, authenticated;
grant select on table public.reglages_compte to authenticated;
grant all on table public.reglages_compte to service_role;

create policy "Réglages : lire les siens" on public.reglages_compte
  for select to authenticated using (user_id = (select auth.uid()));

-- Session anonyme (#316, #343) : rien. Forme `(select auth.jwt())` reconnue par l'analyseur (20261002003100).
create policy "Anonyme : pas de réglages" on public.reglages_compte
  as restrictive for all to authenticated
  using (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true)
  with check (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);

-- Fusionne les réglages envoyés par l'appareil avec ceux du serveur, clé par clé (la date la plus récente gagne), et
-- renvoie l'ensemble obtenu. Appelée avec `{}`, elle lit seulement. Entrées hors liste blanche : ignorées.
create function public.enregistrer_reglages(p_reglages jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_max_t numeric := floor(extract(epoch from now()) * 1000) + 86400000;
  v_actuels jsonb;
  v_nouveaux jsonb;
begin
  if v_uid is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or coalesce((select u.is_anonymous from auth.users u where u.id = v_uid), true) then
    raise exception 'Crée ton compte pour garder tes réglages' using errcode = 'JGC01';
  end if;
  p_reglages := coalesce(p_reglages, '{}'::jsonb);
  if jsonb_typeof(p_reglages) <> 'object' then
    raise exception 'Réglages illisibles' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_reglages)) > 32 then
    raise exception 'Trop de réglages' using errcode = '22023';
  end if;

  insert into public.reglages_compte (user_id) values (v_uid) on conflict (user_id) do nothing;
  -- Un envoi à la fois par joueur : deux appareils ne s'écrasent pas.
  select r.reglages into v_actuels from public.reglages_compte r where r.user_id = v_uid for update;

  -- Entrées valides : clé et valeur de la liste blanche, date entière dans les bornes.
  with entrees as (
    select e.key as cle, e.value -> 'v' as v,
           case when jsonb_typeof(e.value -> 't') = 'number' then (e.value ->> 't')::numeric end as t
    from jsonb_each(p_reglages) e
    where jsonb_typeof(e.value) = 'object'
  ), valides as (
    select x.cle, x.v, x.t from entrees x
    where x.t is not null and x.t >= 0 and x.t <= v_max_t and x.t = trunc(x.t)
      and case x.cle
        when 'theme' then x.v = any (array['"auto"', '"dark"', '"light"']::jsonb[])
        when 'size' then x.v = any (array['9', '13', '19']::jsonb[])
        when 'aide' then x.v = any (array['"auto"', '"oui"', '"non"']::jsonb[])
        when 'cadence' then x.v = any (array['"rapide"', '"normale"', '"lente"']::jsonb[])
        when 'langue' then x.v = any (array['"fr"', '"en"']::jsonb[])
        when 'enLigne' then x.v = any (array['"direct"', '"lente"']::jsonb[])
        when 'themeGoban' then x.v = any (array['"kaya"', '"kaya-clair"', '"ardoise"', '"coquillage-dore"']::jsonb[])
        when 'confirmTouch' then jsonb_typeof(x.v) = 'boolean'
        when 'sound' then jsonb_typeof(x.v) = 'boolean'
        when 'vibrations' then jsonb_typeof(x.v) = 'boolean'
        when 'celebrations' then jsonb_typeof(x.v) = 'boolean'
        when 'coordonnees' then jsonb_typeof(x.v) = 'boolean'
        when 'dernierCoup' then jsonb_typeof(x.v) = 'boolean'
        when 'numerosRevue' then jsonb_typeof(x.v) = 'boolean'
        when 'serieVisible' then jsonb_typeof(x.v) = 'boolean'
        when 'messagesCoupes' then jsonb_typeof(x.v) = 'boolean'
        else false
      end
  ), gagnantes as (
    select x.cle, x.v, x.t from valides x
    where jsonb_typeof(v_actuels -> x.cle -> 't') is distinct from 'number'
       or x.t > (v_actuels -> x.cle ->> 't')::numeric
  )
  select coalesce(jsonb_object_agg(g.cle, jsonb_build_object('v', g.v, 't', g.t)), '{}'::jsonb)
    into v_nouveaux from gagnantes g;

  if v_nouveaux <> '{}'::jsonb then
    update public.reglages_compte r
    set reglages = r.reglages || v_nouveaux, modifie_le = now()
    where r.user_id = v_uid
    returning r.reglages into v_actuels;
  end if;
  return v_actuels;
end;
$$;

comment on function public.enregistrer_reglages(jsonb) is
  'Issue #448 : réglages du compte, fusionnés clé par clé (dernier changement gagne), liste blanche de clés et de valeurs.';

revoke all on function public.enregistrer_reglages(jsonb) from public, anon;
grant execute on function public.enregistrer_reglages(jsonb) to authenticated;
