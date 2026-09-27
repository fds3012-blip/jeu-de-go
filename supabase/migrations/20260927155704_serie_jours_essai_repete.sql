-- Issue #29 (suite) : un essai répété ne change pas la cote, mais un essai réussi fait toujours avancer
-- la série de jours (le « Go du jour » repropose des problèmes déjà tentés).
-- Aucune suppression de données. RLS inchangé.
create or replace function public.record_puzzle_attempt(p_puzzle text, p_solved boolean)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_diff integer;
  v_owner uuid;
  v_rating integer;
  v_last date;
  v_exp numeric;
  v_new integer;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select difficulty, owner_id into v_diff, v_owner from public.puzzles where id = p_puzzle;
  if not found or (v_owner is not null and v_owner <> v_uid) then raise exception 'Problème introuvable'; end if;
  -- Le verrou sur le profil sérialise les essais d'un même joueur : deux premiers essais simultanés ne comptent qu'une fois.
  select puzzle_rating, streak_last into v_rating, v_last from public.profiles where id = v_uid for update;

  if exists (select 1 from public.puzzle_attempts where user_id = v_uid and puzzle_id = p_puzzle) then
    -- Essai répété : cote inchangée, rien dans puzzle_attempts ni rating_history ; la série avance si réussi.
    v_new := v_rating;
  else
    v_exp := 1 / (1 + power(10::numeric, (v_diff - v_rating) / 400.0));
    v_new := greatest(100, v_rating + round(24 * ((case when p_solved then 1 else 0 end) - v_exp))::integer);
    insert into public.puzzle_attempts (user_id, puzzle_id, solved, rating_after) values (v_uid, p_puzzle, p_solved, v_new);
    insert into public.rating_history (user_id, kind, rating) values (v_uid, 'puzzle', v_new);
  end if;

  update public.profiles set
    puzzle_rating = v_new,
    streak_days = case
      when not p_solved then streak_days
      when v_last = current_date then streak_days
      when v_last = current_date - 1 then streak_days + 1
      else 1 end,
    streak_last = case when p_solved then current_date else streak_last end
  where id = v_uid;
  return v_new;
end;
$$;
revoke execute on function public.record_puzzle_attempt(text, boolean) from public, anon;
grant execute on function public.record_puzzle_attempt(text, boolean) to authenticated;
