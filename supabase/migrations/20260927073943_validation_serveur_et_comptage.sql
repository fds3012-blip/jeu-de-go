-- Issue #9 : validation des coups par la fonction serveur `game-action` et fin de partie aux points.
-- Les clients ne peuvent plus appeler play_move : les coups passent par l'Edge Function, qui rejoue la partie
-- (captures, suicide, ko) puis écrit avec la clé service, qui ne quitte jamais l'environnement de la fonction.

-- État du comptage (après deux passes consécutives)
alter table public.games
  add column counting boolean not null default false,
  add column dead_stones text check (dead_stones is null or (dead_stones ~ '^([a-s]{2})*$' and char_length(dead_stones) <= 722)),
  add column dead_proposed_by uuid references public.profiles(id) on delete set null,
  add column resumed_at smallint not null default 0 check (resumed_at between 0 and 1000),
  add column score_black numeric(5,1),
  add column score_white numeric(5,1);
comment on column public.games.counting is 'Comptage en cours : les coups sont bloqués jusqu''à l''accord sur les pierres mortes ou la reprise.';
comment on column public.games.dead_stones is 'Pierres mortes proposées (SGF concaténé), groupes entiers.';
comment on column public.games.dead_proposed_by is 'Joueur qui a proposé les pierres mortes ; l''autre joueur accepte ou reprend.';
comment on column public.games.resumed_at is 'Nombre de coups au moment de la dernière reprise : seules les passes suivantes comptent pour ouvrir le comptage.';
create index games_dead_proposed_by_idx on public.games (dead_proposed_by);

-- Une partie entre humains démarre toujours vierge, même si le client envoie d'autres valeurs.
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
  return new;
end;
$$;
revoke execute on function public.games_guard_insert() from public, anon, authenticated;
create trigger games_guard_insert before insert on public.games
  for each row execute function public.games_guard_insert();

-- Mise à jour des cotes après une partie classée (même calcul Elo que l'abandon, K = 32)
create or replace function public.apply_game_rating(p_game uuid, p_winner uuid, p_loser uuid)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_rw integer;
  v_rl integer;
  v_exp numeric;
  v_delta integer;
begin
  if p_winner is null or p_loser is null then return; end if;
  select rating into v_rw from public.profiles where id = p_winner for update;
  select rating into v_rl from public.profiles where id = p_loser for update;
  v_exp := 1 / (1 + power(10::numeric, (v_rl - v_rw) / 400.0));
  v_delta := greatest(1, round(32 * (1 - v_exp)));
  update public.profiles set rating = rating + v_delta where id = p_winner;
  update public.profiles set rating = greatest(100, rating - v_delta) where id = p_loser;
  insert into public.rating_history (user_id, kind, rating, game_id)
    select id, 'game', rating, p_game from public.profiles where id in (p_winner, p_loser);
end;
$$;
revoke execute on function public.apply_game_rating(uuid, uuid, uuid) from public, anon, authenticated;

-- Abandon : même comportement, via la fonction commune de cotes ; ferme aussi un comptage en cours
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
  update public.games set status = 'finished', result = v_result, counting = false where id = p_game;
  if v_game.rated then
    perform public.apply_game_rating(p_game, v_winner, v_loser);
  end if;
  return v_result;
end;
$$;
revoke execute on function public.resign_game(uuid) from public, anon;
grant execute on function public.resign_game(uuid) to authenticated;

-- Fin aux points : appelée uniquement par la fonction serveur (clé service), après calcul du score par score.ts.
-- Vérifie sous verrou que la partie n'a pas bougé depuis la lecture (coups et pierres mortes identiques).
create or replace function public.finish_game_by_score(
  p_game uuid, p_user uuid, p_moves text, p_dead text, p_result text, p_black numeric, p_white numeric
)
returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_winner uuid;
  v_loser uuid;
begin
  select * into v_game from public.games where id = p_game for update;
  if not found then raise exception 'Partie introuvable'; end if;
  if v_game.bot_id is not null then raise exception 'Réservé aux parties entre humains'; end if;
  if v_game.status <> 'active' or not v_game.counting then raise exception 'Aucun comptage en cours'; end if;
  if p_user is distinct from v_game.black_id and p_user is distinct from v_game.white_id then
    raise exception 'Tu ne joues pas dans cette partie';
  end if;
  if v_game.dead_proposed_by is null or v_game.dead_proposed_by = p_user then
    raise exception 'C''est à l''autre joueur d''accepter';
  end if;
  if v_game.moves <> p_moves or coalesce(v_game.dead_stones, '') <> coalesce(p_dead, '') then
    raise exception 'La partie a changé, recharge-la';
  end if;
  if p_result !~ '^((B|W)\+[0-9]{1,3}(\.[0-9])?|0)$' then raise exception 'Résultat invalide'; end if;
  update public.games
    set status = 'finished', result = p_result, counting = false, score_black = p_black, score_white = p_white
    where id = p_game;
  if v_game.rated and p_result <> '0' then
    if left(p_result, 1) = 'B' then v_winner := v_game.black_id; v_loser := v_game.white_id;
    else v_winner := v_game.white_id; v_loser := v_game.black_id; end if;
    perform public.apply_game_rating(p_game, v_winner, v_loser);
  end if;
  return p_result;
end;
$$;
revoke execute on function public.finish_game_by_score(uuid, uuid, text, text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.finish_game_by_score(uuid, uuid, text, text, text, numeric, numeric) to service_role;

-- Les coups ne passent plus par play_move (qui ne vérifiait que le tour et le format)
revoke execute on function public.play_move(uuid, text) from public, anon, authenticated;
comment on function public.play_move(uuid, text) is 'Retirée des clients (issue #9) : les coups passent par la fonction serveur game-action.';
