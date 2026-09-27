-- Issue #29 : parties classées, cote des problèmes et progression des leçons protégées côté serveur.
-- Aucune suppression de données. RLS inchangé (déjà actif sur games, puzzle_attempts et lesson_progress).

-- 1. Partie classée : komi 6,5 et handicap 0, imposés par le serveur.
--    À la création, les valeurs envoyées par le client sont neutralisées (pas d'erreur pour le client actuel).
--    La contrainte empêche ensuite toute modification incohérente (y compris une partie contre l'IA passée en classée).
create or replace function public.games_guard_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.bot_id is null then
    new.moves := '';
    new.result := null;
    new.counting := false;
    new.dead_stones := null;
    new.dead_proposed_by := null;
    new.resumed_at := 0;
    new.score_black := null;
    new.score_white := null;
    new.analysis := null;
  end if;
  if new.rated then
    new.komi := 6.5;
    new.handicap := 0;
  end if;
  return new;
end;
$$;
revoke execute on function public.games_guard_insert() from public, anon, authenticated;

alter table public.games
  add constraint games_rated_standard check (not rated or (komi = 6.5 and handicap = 0));
comment on constraint games_rated_standard on public.games is
  'Partie classée : komi 6,5 et handicap 0 (issue #29).';

-- 2. Problèmes : seul le premier essai sur un problème compte pour la cote.
--    Un nouvel essai sur un problème déjà tenté ne change rien et renvoie la cote actuelle, sans erreur.
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
    return v_rating;
  end if;
  v_exp := 1 / (1 + power(10::numeric, (v_diff - v_rating) / 400.0));
  v_new := greatest(100, v_rating + round(24 * ((case when p_solved then 1 else 0 end) - v_exp))::integer);
  update public.profiles set
    puzzle_rating = v_new,
    streak_days = case
      when not p_solved then streak_days
      when v_last = current_date then streak_days
      when v_last = current_date - 1 then streak_days + 1
      else 1 end,
    streak_last = case when p_solved then current_date else streak_last end
  where id = v_uid;
  insert into public.puzzle_attempts (user_id, puzzle_id, solved, rating_after) values (v_uid, p_puzzle, p_solved, v_new);
  insert into public.rating_history (user_id, kind, rating) values (v_uid, 'puzzle', v_new);
  return v_new;
end;
$$;
revoke execute on function public.record_puzzle_attempt(text, boolean) from public, anon;
grant execute on function public.record_puzzle_attempt(text, boolean) to authenticated;

create index if not exists puzzle_attempts_user_puzzle_idx on public.puzzle_attempts (user_id, puzzle_id);

-- 3. Leçons : la progression ne recule jamais. Toute mise à jour (y compris l'upsert du client,
--    « on conflict do update ») garde le maximum : greatest(steps_done, excluded.steps_done).
create or replace function public.lesson_progress_keep_max()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.steps_done := greatest(old.steps_done, new.steps_done);
  return new;
end;
$$;
revoke execute on function public.lesson_progress_keep_max() from public, anon, authenticated;
create trigger lesson_progress_keep_max before update on public.lesson_progress
  for each row execute function public.lesson_progress_keep_max();
