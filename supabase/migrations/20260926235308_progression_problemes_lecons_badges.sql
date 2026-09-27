-- Problèmes : communs (owner_id null) ou tirés des parties d'un joueur
create table public.puzzles (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  owner_id uuid references public.profiles(id) on delete cascade,
  source_game uuid references public.games(id) on delete set null,
  size smallint not null check (size in (9, 13, 19)),
  setup jsonb not null,
  answers text[] not null check (cardinality(answers) between 1 and 8),
  title text check (title is null or char_length(title) <= 80),
  prompt text check (prompt is null or char_length(prompt) <= 400),
  explanation text check (explanation is null or char_length(explanation) <= 800),
  difficulty integer not null default 800,
  created_at timestamptz not null default now()
);
create index puzzles_owner_idx on public.puzzles (owner_id);
create index puzzles_source_game_idx on public.puzzles (source_game);
alter table public.puzzles enable row level security;
create policy "Problèmes communs et personnels visibles" on public.puzzles
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy "Créer ses propres problèmes" on public.puzzles
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Supprimer ses propres problèmes" on public.puzzles
  for delete to authenticated using (owner_id = (select auth.uid()));

create table public.puzzle_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  puzzle_id text not null references public.puzzles(id) on delete cascade,
  solved boolean not null,
  rating_after integer not null,
  created_at timestamptz not null default now()
);
create index puzzle_attempts_user_idx on public.puzzle_attempts (user_id, created_at desc);
create index puzzle_attempts_puzzle_idx on public.puzzle_attempts (puzzle_id);
alter table public.puzzle_attempts enable row level security;
create policy "Voir ses propres essais" on public.puzzle_attempts
  for select to authenticated using (user_id = (select auth.uid()));

-- Enregistre un essai : met à jour la cote problèmes (Elo) et la série de jours
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
  select puzzle_rating, streak_last into v_rating, v_last from public.profiles where id = v_uid for update;
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

-- Leçons
create table public.lesson_progress (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  lesson_id text not null check (lesson_id ~ '^[a-z0-9_-]{1,32}$'),
  steps_done smallint not null default 0 check (steps_done between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.lesson_progress enable row level security;
create policy "Voir sa progression" on public.lesson_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Enregistrer sa progression" on public.lesson_progress
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Mettre à jour sa progression" on public.lesson_progress
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Badges (visibles sur les profils)
create table public.achievements (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  badge_id text not null check (badge_id ~ '^[a-z0-9_-]{1,32}$'),
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);
alter table public.achievements enable row level security;
create policy "Badges visibles par les joueurs connectés" on public.achievements
  for select to authenticated using (true);
create policy "Gagner un badge" on public.achievements
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Classement (respecte les règles d'accès de la table profiles)
create view public.leaderboard with (security_invoker = true) as
  select id, username, country, rating, rank() over (order by rating desc) as rank
  from public.profiles
  where username is not null;

-- Les six problèmes de base de l'application
insert into public.puzzles (id, owner_id, size, setup, answers, title, prompt, difficulty) values
 ('b1', null, 9, '{"rows":[".........",".........",".........","...X.....","..XT.O...","...X.....",".........",".........","........."],"toPlay":"B"}', array['E5'], 'Capture la pierre', 'La pierre blanche marquée n''a plus qu''une liberté. Capture-la.', 400),
 ('b2', null, 9, '{"rows":[".........",".........",".........",".........",".........",".........",".........","...XTX...","........."],"toPlay":"B"}', array['E3'], 'Vers le bord', 'Mets la pierre marquée en atari du bon côté pour qu''elle ne puisse plus s''échapper.', 650),
 ('b3', null, 9, '{"rows":[".........",".........",".........",".........","..XT.TX..","...X.X...",".........",".........","........."],"toPlay":"B"}', array['E5'], 'Double atari', 'Un seul coup peut mettre les deux pierres marquées en atari en même temps.', 500),
 ('b4', null, 9, '{"rows":[".........",".........",".........","...O.....","..OSO....","..O.X....",".........",".........","........."],"toPlay":"B"}', array['D4'], 'Sauve ta pierre', 'Ta pierre marquée est en atari. Donne-lui des libertés.', 400),
 ('b5', null, 9, '{"rows":[".........",".........","....O....","...O.....","...OSOX..","....OX...",".........",".........","........."],"toPlay":"B"}', array['F6'], 'Capturer pour se sauver', 'Ta pierre marquée est en atari, et s''allonger ne suffit pas.', 750),
 ('b6', null, 9, '{"rows":[".........",".........",".........","....X....","...XT....",".....X...",".........",".........","........."],"toPlay":"B"}', array['F5','E4'], 'L''échelle', 'Mets la pierre marquée en atari pour qu''elle ne s''échappe jamais.', 850);
