create type public.game_status as enum ('waiting', 'active', 'finished', 'aborted');

create table public.games (
  id uuid primary key default gen_random_uuid(),
  black_id uuid references public.profiles(id) on delete set null,
  white_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  bot_id text check (bot_id is null or bot_id ~ '^[a-z0-9_-]{1,32}$'),
  size smallint not null check (size in (9, 13, 19)),
  rules text not null default 'japanese' check (rules in ('japanese', 'chinese')),
  komi numeric(4,1) not null default 6.5 check (komi between -50 and 50),
  handicap smallint not null default 0 check (handicap between 0 and 9),
  moves text not null default '' check (moves ~ '^([a-s]{2})*$' and char_length(moves) <= 2000),
  status public.game_status not null default 'active',
  result text check (result is null or result ~ '^((B|W)\+(R|T|[0-9]{1,3}(\.[0-9])?)|0)$'),
  rated boolean not null default false,
  invite_code text unique check (invite_code is null or invite_code ~ '^[A-Z0-9]{4,8}$'),
  analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.games.moves is 'Coups concaténés en coordonnées SGF (2 lettres par coup, "tt" = passe).';
comment on column public.games.bot_id is 'Adversaire IA (null pour une partie entre humains).';

create index games_black_idx on public.games (black_id);
create index games_white_idx on public.games (white_id);
create index games_created_by_idx on public.games (created_by);
create index games_status_idx on public.games (status);

alter table public.games enable row level security;

create policy "Lecture par les joueurs, et parties publiques entre humains" on public.games
  for select to authenticated
  using ((select auth.uid()) in (black_id, white_id, created_by)
         or (bot_id is null and status in ('active', 'finished')));

create policy "Création par un joueur de la partie" on public.games
  for insert to authenticated
  with check (created_by = (select auth.uid())
              and (select auth.uid()) in (black_id, white_id)
              and (bot_id is not null or status = 'waiting'));

create policy "Parties contre l'IA modifiables par leur joueur" on public.games
  for update to authenticated
  using (bot_id is not null and created_by = (select auth.uid()))
  with check (bot_id is not null and created_by = (select auth.uid()));

create policy "Parties contre l'IA supprimables par leur joueur" on public.games
  for delete to authenticated
  using (bot_id is not null and created_by = (select auth.uid()));

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger games_touch_updated_at before update on public.games
  for each row execute function public.touch_updated_at();

-- Historique des cotes (écrit uniquement par les fonctions serveur)
create table public.rating_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('game', 'puzzle')),
  rating integer not null,
  game_id uuid references public.games(id) on delete set null,
  created_at timestamptz not null default now()
);
create index rating_history_user_idx on public.rating_history (user_id, created_at desc);
create index rating_history_game_idx on public.rating_history (game_id);
alter table public.rating_history enable row level security;
create policy "Chacun voit son historique" on public.rating_history
  for select to authenticated using (user_id = (select auth.uid()));

-- Rejoindre une partie par code
create or replace function public.join_game(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_game from public.games
    where invite_code = upper(trim(p_code)) and status = 'waiting'
    for update;
  if not found then raise exception 'Partie introuvable ou déjà commencée'; end if;
  if v_uid in (v_game.black_id, v_game.white_id) then return v_game.id; end if;
  if v_game.black_id is null then
    update public.games set black_id = v_uid, status = 'active' where id = v_game.id;
  else
    update public.games set white_id = v_uid, status = 'active' where id = v_game.id;
  end if;
  return v_game.id;
end;
$$;

-- Jouer un coup dans une partie entre humains (vérifie le tour et le format)
create or replace function public.play_move(p_game uuid, p_move text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
  v_n integer;
  v_first text;
  v_turn text;
  v_max text;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_game from public.games where id = p_game for update;
  if not found then raise exception 'Partie introuvable'; end if;
  if v_game.bot_id is not null then raise exception 'Réservé aux parties entre humains'; end if;
  if v_game.status <> 'active' then raise exception 'La partie n''est pas en cours'; end if;
  if v_uid not in (coalesce(v_game.black_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(v_game.white_id, '00000000-0000-0000-0000-000000000000'::uuid)) then
    raise exception 'Tu ne joues pas dans cette partie';
  end if;
  if p_move !~ '^[a-s]{2}$' then raise exception 'Coup invalide'; end if;
  v_max := chr(ascii('a') + v_game.size - 1);
  if p_move <> 'tt' and (substr(p_move, 1, 1) > v_max or substr(p_move, 2, 1) > v_max) then
    raise exception 'Coup hors du plateau';
  end if;
  v_n := char_length(v_game.moves) / 2;
  v_first := case when v_game.handicap > 0 then 'W' else 'B' end;
  v_turn := case when v_n % 2 = 0 then v_first else (case when v_first = 'B' then 'W' else 'B' end) end;
  if (v_turn = 'B' and v_uid <> v_game.black_id) or (v_turn = 'W' and v_uid <> v_game.white_id) then
    raise exception 'Ce n''est pas ton tour';
  end if;
  update public.games set moves = moves || p_move where id = p_game;
  return v_game.moves || p_move;
end;
$$;

-- Abandonner : termine la partie et met à jour les cotes si elle est classée
create or replace function public.resign_game(p_game uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
  v_result text;
  v_winner uuid;
  v_loser uuid;
  v_rw integer;
  v_rl integer;
  v_exp numeric;
  v_delta integer;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_game from public.games where id = p_game for update;
  if not found then raise exception 'Partie introuvable'; end if;
  if v_game.bot_id is not null then raise exception 'Réservé aux parties entre humains'; end if;
  if v_game.status <> 'active' then raise exception 'La partie n''est pas en cours'; end if;
  if v_uid = v_game.black_id then v_result := 'W+R'; v_winner := v_game.white_id; v_loser := v_game.black_id;
  elsif v_uid = v_game.white_id then v_result := 'B+R'; v_winner := v_game.black_id; v_loser := v_game.white_id;
  else raise exception 'Tu ne joues pas dans cette partie';
  end if;
  update public.games set status = 'finished', result = v_result where id = p_game;
  if v_game.rated and v_winner is not null and v_loser is not null then
    select rating into v_rw from public.profiles where id = v_winner for update;
    select rating into v_rl from public.profiles where id = v_loser for update;
    v_exp := 1 / (1 + power(10::numeric, (v_rl - v_rw) / 400.0));
    v_delta := greatest(1, round(32 * (1 - v_exp)));
    update public.profiles set rating = rating + v_delta where id = v_winner;
    update public.profiles set rating = greatest(100, rating - v_delta) where id = v_loser;
    insert into public.rating_history (user_id, kind, rating, game_id)
      select id, 'game', rating, p_game from public.profiles where id in (v_winner, v_loser);
  end if;
  return v_result;
end;
$$;

revoke execute on function public.join_game(text), public.play_move(uuid, text), public.resign_game(uuid) from public, anon;
grant execute on function public.join_game(text), public.play_move(uuid, text), public.resign_game(uuid) to authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Coups en direct : les changements de la table games sont diffusés en temps réel (filtrés par les règles d'accès)
alter publication supabase_realtime add table public.games;
