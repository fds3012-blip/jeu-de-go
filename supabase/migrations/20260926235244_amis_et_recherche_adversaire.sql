-- Amis
create type public.friend_status as enum ('pending', 'accepted');
create table public.friendships (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.friend_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index friendships_addressee_idx on public.friendships (addressee_id);
create unique index friendships_pair_idx on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
alter table public.friendships enable row level security;

create policy "Voir ses propres relations" on public.friendships
  for select to authenticated using ((select auth.uid()) in (requester_id, addressee_id));
create policy "Envoyer une demande d'ami" on public.friendships
  for insert to authenticated with check (requester_id = (select auth.uid()) and status = 'pending');
create policy "Accepter une demande reçue" on public.friendships
  for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()) and status = 'accepted');
create policy "Retirer un ami ou une demande" on public.friendships
  for delete to authenticated using ((select auth.uid()) in (requester_id, addressee_id));

-- File d'attente pour trouver un adversaire de son niveau
create table public.match_queue (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  size smallint not null check (size in (9, 13, 19)),
  rating integer not null,
  created_at timestamptz not null default now()
);
create index match_queue_size_idx on public.match_queue (size, created_at);
alter table public.match_queue enable row level security;
create policy "Voir sa place dans la file" on public.match_queue
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Quitter la file" on public.match_queue
  for delete to authenticated using (user_id = (select auth.uid()));

-- Cherche un adversaire proche en cote ; crée la partie classée si trouvé, sinon inscrit dans la file.
-- L'écart accepté s'élargit avec l'attente (300 points + 10 par seconde d'attente de l'autre joueur).
create or replace function public.find_match(p_size smallint)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rating integer;
  v_opp uuid;
  v_game uuid;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_size not in (9, 13, 19) then raise exception 'Taille invalide'; end if;
  select rating into v_rating from public.profiles where id = v_uid;
  delete from public.match_queue where created_at < now() - interval '10 minutes';
  select q.user_id into v_opp from public.match_queue q
    where q.size = p_size and q.user_id <> v_uid
      and abs(q.rating - v_rating) <= 300 + 10 * extract(epoch from now() - q.created_at)
    order by q.created_at
    limit 1
    for update skip locked;
  if v_opp is not null then
    delete from public.match_queue where user_id in (v_uid, v_opp);
    insert into public.games (black_id, white_id, created_by, size, status, rated)
      values (case when random() < 0.5 then v_uid else v_opp end,
              null, v_uid, p_size, 'active', true)
      returning id into v_game;
    update public.games
      set white_id = case when black_id = v_uid then v_opp else v_uid end
      where id = v_game;
    return v_game;
  end if;
  insert into public.match_queue (user_id, size, rating) values (v_uid, p_size, v_rating)
    on conflict (user_id) do update set size = excluded.size, rating = excluded.rating, created_at = now();
  return null;
end;
$$;
revoke execute on function public.find_match(smallint) from public, anon;
grant execute on function public.find_match(smallint) to authenticated;
