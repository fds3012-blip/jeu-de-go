-- Issue #529 : trois décors du goban de plus, récompenses des niveaux 10, 12 et 15 (`cerisier`, `jade`, `kaya-ancien`),
-- ajoutés à la liste blanche du réglage synchronisé `themeGoban` (#448). Même fonction que
-- 20261007223000_reglages_coach.sql, une seule ligne change (src/app/reglagesCompte.ts). La table, ses politiques (RLS
-- déjà en place) et ses droits ne changent pas ; la fonction reste security definer avec search_path vide.
-- Tant que cette migration n'est pas appliquée, l'appareil envoie le nouveau décor et le serveur l'ignore (valeur hors
-- liste blanche), sans erreur : le décor reste alors sur l'appareil.

create or replace function public.enregistrer_reglages(p_reglages jsonb)
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
        when 'coach' then x.v = any (array['"auto"', '"oui"', '"non"']::jsonb[])
        when 'cadence' then x.v = any (array['"rapide"', '"normale"', '"lente"']::jsonb[])
        when 'langue' then x.v = any (array['"fr"', '"en"']::jsonb[])
        when 'enLigne' then x.v = any (array['"direct"', '"lente"']::jsonb[])
        when 'themeGoban' then x.v = any (array['"kaya"', '"kaya-clair"', '"ardoise"', '"coquillage-dore"', '"cerisier"', '"jade"', '"kaya-ancien"']::jsonb[])
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
  'Issues #448, #470 et #529 : réglages du compte, fusionnés clé par clé (dernier changement gagne), liste blanche de clés et de valeurs.';

revoke all on function public.enregistrer_reglages(jsonb) from public, anon;
grant execute on function public.enregistrer_reglages(jsonb) to authenticated;
