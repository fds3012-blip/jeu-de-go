-- Issue #176 (suite de #161) : la série du Go du jour gardée sur l'appareil est envoyée au serveur à la connexion.
-- Le client ne peut pas écrire les colonnes de série (droits limités à username, avatar_url, country) :
-- cette fonction est le seul chemin, et elle borne tout ce qu'elle reçoit.
--
-- Règles :
--   - p_dernier_jour est aujourd'hui ou hier, en heure de Paris (une série plus ancienne est déjà morte) ;
--   - 0 <= p_jours <= numéro du Go du jour de p_dernier_jour (1 le jour du lancement, 2026-09-27,
--     même date que LANCEMENT dans src/app/goDuJour.ts) : impossible d'avoir plus de jours de suite
--     que de jours écoulés depuis le lancement ;
--   - la série du serveur ne baisse jamais : ni streak_days ni streak_last ne reculent. On ne prend la série
--     de l'appareil que si elle est plus longue, ou aussi longue mais plus récente ;
--   - idempotente : un second appel avec les mêmes valeurs ne change rien ;
--   - les gels (streak_freezes, streak_frozen_days, issue #76) ne sont pas touchés : la réserve de l'appareil
--     et celle du serveur restent séparées, et le serveur ne donne un gel qu'à une réussite qu'il a vue.
-- Aucune suppression de données. Pas de nouvelle table, RLS inchangé.

create or replace function public.importer_serie_appareil(p_jours integer, p_dernier_jour date)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_lancement constant date := date '2026-09-27';
  v_days integer;
  v_last date;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_jours is null or p_dernier_jour is null then raise exception 'Série invalide'; end if;
  if p_dernier_jour not in (v_today, v_today - 1) then raise exception 'Série invalide : dernier jour hors bornes'; end if;
  if p_jours < 0 or p_jours > (p_dernier_jour - v_lancement) + 1 then raise exception 'Série invalide : nombre de jours hors bornes'; end if;

  -- Verrou sur le profil : sérialisé avec record_puzzle_attempt.
  select streak_days, streak_last into v_days, v_last from public.profiles where id = v_uid for update;
  if not found then raise exception 'Profil introuvable'; end if;

  if p_jours > v_days or (p_jours = v_days and p_jours > 0 and (v_last is null or p_dernier_jour > v_last)) then
    v_days := p_jours;
    v_last := greatest(v_last, p_dernier_jour);
    update public.profiles set streak_days = v_days, streak_last = v_last where id = v_uid;
  end if;
  return v_days;
end;
$$;

revoke execute on function public.importer_serie_appareil(integer, date) from public, anon;
grant execute on function public.importer_serie_appareil(integer, date) to authenticated;
