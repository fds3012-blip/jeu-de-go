-- La passe s'écrit "tt" en SGF : on l'autorise dans le format des coups
alter table public.games drop constraint games_moves_check;
alter table public.games add constraint games_moves_check check (moves ~ '^([a-s]{2}|tt)*$' and char_length(moves) <= 2000);

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
  if v_uid is distinct from v_game.black_id and v_uid is distinct from v_game.white_id then
    raise exception 'Tu ne joues pas dans cette partie';
  end if;
  if p_move !~ '^([a-s]{2}|tt)$' then raise exception 'Coup invalide'; end if;
  v_max := chr(ascii('a') + v_game.size - 1);
  if p_move <> 'tt' and (substr(p_move, 1, 1) > v_max or substr(p_move, 2, 1) > v_max) then
    raise exception 'Coup hors du plateau';
  end if;
  v_n := char_length(v_game.moves) / 2;
  v_first := case when v_game.handicap > 0 then 'W' else 'B' end;
  v_turn := case when v_n % 2 = 0 then v_first else (case when v_first = 'B' then 'W' else 'B' end) end;
  if (v_turn = 'B' and v_uid is distinct from v_game.black_id) or (v_turn = 'W' and v_uid is distinct from v_game.white_id) then
    raise exception 'Ce n''est pas ton tour';
  end if;
  update public.games set moves = moves || p_move where id = p_game;
  return v_game.moves || p_move;
end;
$$;
revoke execute on function public.play_move(uuid, text) from public, anon;
grant execute on function public.play_move(uuid, text) to authenticated;
