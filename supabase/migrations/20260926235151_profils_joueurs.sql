-- Profils des joueurs : un par compte, créé automatiquement à l'inscription
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username is null or (char_length(username) between 3 and 24 and username ~ '^[A-Za-z0-9_-]+$')),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  rating integer not null default 800,
  puzzle_rating integer not null default 800,
  streak_days integer not null default 0,
  streak_last date,
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Profil public de chaque joueur. Les cotes ne sont modifiables que par les fonctions serveur.';

alter table public.profiles enable row level security;

create policy "Profils visibles par tous" on public.profiles
  for select to anon, authenticated using (true);

create policy "Chacun modifie son propre profil" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Seuls pseudo, avatar et pays sont modifiables par le joueur (pas les cotes ni la série)
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, avatar_url, country) on public.profiles to authenticated;

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
