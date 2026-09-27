-- Issue #76 (suite) : série protégée côté serveur pour les joueurs connectés.
-- Même règle que l'appareil (src/app/gel.ts) :
--   - un gel gagné tous les 7 jours de série, 2 au plus en réserve ;
--   - à la réussite suivante, chaque jour manqué consomme un gel, si la réserve couvre tous les jours manqués ;
--   - sinon la série repart à 1 et les gels restent en réserve (on n'en brûle pas pour rien).
-- Les jours sont comptés en heure de Paris, comme le Go du jour (auparavant current_date, c'est-à-dire UTC).
-- Aucune suppression de données. RLS inchangé ; le client ne peut pas écrire ces colonnes (seul
-- record_puzzle_attempt, en security definer, les modifie).

alter table public.profiles
  add column if not exists streak_freezes integer not null default 0,
  add column if not exists streak_frozen_days date[] not null default '{}';

alter table public.profiles
  add constraint profiles_streak_freezes_range check (streak_freezes between 0 and 2);

-- Les droits d'écriture du client restent limités à (username, avatar_url, country).
revoke insert, update on public.profiles from anon, authenticated;
grant update (username, avatar_url, country) on public.profiles to authenticated;

create or replace function public.record_puzzle_attempt(p_puzzle text, p_solved boolean)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_diff integer;
  v_owner uuid;
  v_rating integer;
  v_last date;
  v_days integer;
  v_freezes integer;
  v_frozen date[];
  v_missed integer;
  v_exp numeric;
  v_new integer;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select difficulty, owner_id into v_diff, v_owner from public.puzzles where id = p_puzzle;
  if not found or (v_owner is not null and v_owner <> v_uid) then raise exception 'Problème introuvable'; end if;
  -- Le verrou sur le profil sérialise les essais d'un même joueur : deux premiers essais simultanés ne comptent qu'une fois.
  select puzzle_rating, streak_last, streak_days, streak_freezes, streak_frozen_days
    into v_rating, v_last, v_days, v_freezes, v_frozen
    from public.profiles where id = v_uid for update;

  if exists (select 1 from public.puzzle_attempts where user_id = v_uid and puzzle_id = p_puzzle) then
    -- Essai répété : cote inchangée, rien dans puzzle_attempts ni rating_history ; la série avance si réussi.
    v_new := v_rating;
  else
    v_exp := 1 / (1 + power(10::numeric, (v_diff - v_rating) / 400.0));
    v_new := greatest(100, v_rating + round(24 * ((case when p_solved then 1 else 0 end) - v_exp))::integer);
    insert into public.puzzle_attempts (user_id, puzzle_id, solved, rating_after) values (v_uid, p_puzzle, p_solved, v_new);
    insert into public.rating_history (user_id, kind, rating) values (v_uid, 'puzzle', v_new);
  end if;

  if p_solved and (v_last is null or v_last < v_today) then
    v_missed := case when v_last is null or v_days <= 0 then null else v_today - v_last - 1 end;
    if v_missed is null then
      v_days := 1;
    elsif v_missed = 0 then
      v_days := v_days + 1;
    elsif v_missed <= v_freezes then
      -- Assez de gels : un par jour manqué, les jours sont marqués gelés, la série continue.
      v_freezes := v_freezes - v_missed;
      v_frozen := (v_frozen || array(select (v_last + g)::date from generate_series(1, v_missed) g))[greatest(1, cardinality(v_frozen) + v_missed - 29):];
      v_days := v_days + 1;
    else
      -- Pas assez de gels : la série repart, la réserve est conservée.
      v_days := 1;
    end if;
    -- Un gel tous les 7 jours de série, dans la limite de 2.
    if v_days % 7 = 0 and v_freezes < 2 then v_freezes := v_freezes + 1; end if;

    update public.profiles set
      puzzle_rating = v_new,
      streak_days = v_days,
      streak_last = v_today,
      streak_freezes = v_freezes,
      streak_frozen_days = v_frozen
    where id = v_uid;
  else
    update public.profiles set puzzle_rating = v_new where id = v_uid;
  end if;
  return v_new;
end;
$$;
revoke execute on function public.record_puzzle_attempt(text, boolean) from public, anon;
grant execute on function public.record_puzzle_attempt(text, boolean) to authenticated;
