-- Issue #81, phase 1 (backend) : défier un ami par lien, partie en différé, sans compte pour commencer.
--
-- Une partie « défi » est une ligne de `games` (9 × 9, non classée, privée) accompagnée d'une ligne de `defis` :
-- jeton du lien, créateur, invité, délai par coup (3 jours) et date limite du coup en cours.
-- Le créateur prend Blanc : l'ami qui ouvre le lien a Noir et joue tout de suite.
--
-- Sécurité :
-- - RLS sur `defis` : seuls les deux joueurs lisent la ligne ; aucune écriture directe (ni politique, ni droit).
-- - Un défi n'est pas une partie publique : `games.prive` le retire de la lecture « parties publiques entre humains ».
-- - Les coups d'un défi passent par `game-action`, qui rejoue la partie (captures, suicide, ko : src/go/server.ts),
--   puis par `jouer_coup_defi`, réservée à la clé service, qui revérifie sous verrou le joueur, le tour, le délai
--   et que la partie n'a pas bougé. Un déclencheur refuse toute autre écriture des coups d'un défi.
-- - Toutes les fonctions sont `security definer` avec `search_path` vide. Aucune ne touche aux cotes (défi non classé).
-- - Victoire au temps constatée à la lecture (`victoire_au_temps`) ou au coup suivant : pas de tâche planifiée.

-- 1. Parties privées : un défi n'apparaît pas dans la lecture publique des parties entre humains.
alter table public.games add column prive boolean not null default false;
comment on column public.games.prive is 'Partie visible par ses seuls joueurs (défi par lien, issue #81).';

drop policy "Lecture par les joueurs, et parties publiques entre humains" on public.games;
create policy "Lecture par les joueurs, et parties publiques entre humains" on public.games
  for select to authenticated
  using ((select auth.uid()) in (black_id, white_id, created_by)
         or (bot_id is null and not prive and status in ('active', 'finished')));

-- 2. Table des défis
create table public.defis (
  partie_id uuid primary key references public.games(id) on delete cascade,
  jeton text not null unique check (jeton ~ '^[A-Za-z0-9_-]{32}$'),
  createur_id uuid references public.profiles(id) on delete set null,
  invite_id uuid references public.profiles(id) on delete set null,
  delai_coup interval not null default interval '3 days'
    check (delai_coup between interval '1 hour' and interval '14 days'),
  date_limite timestamptz,
  lien_expire_le timestamptz not null default now() + interval '7 days',
  cree_le timestamptz not null default now(),
  check (invite_id is null or invite_id is distinct from createur_id)
);
comment on table public.defis is 'Défi par lien (issue #81). Écrit uniquement par les fonctions creer_defi, rejoindre_defi, jouer_coup_defi.';
comment on column public.defis.jeton is 'Jeton du lien (24 octets aléatoires, base64url) : non devinable, utilisable une seule fois par un invité.';
comment on column public.defis.date_limite is 'Fin du délai du coup en cours ; passée, le joueur au trait perd au temps. Null avant l''arrivée de l''invité.';
comment on column public.defis.lien_expire_le is 'Au-delà, le lien ne permet plus de rejoindre le défi.';
create index defis_createur_idx on public.defis (createur_id);
create index defis_invite_idx on public.defis (invite_id);

alter table public.defis enable row level security;
create policy "Lecture par les deux joueurs du défi" on public.defis
  for select to authenticated
  using ((select auth.uid()) in (createur_id, invite_id));
revoke insert, update, delete on public.defis from anon, authenticated;
revoke all on public.defis from anon;

-- 3. Déclencheur : les coups d'un défi ne s'écrivent que par jouer_coup_defi ; chaque coup (ou reprise après
--    un comptage refusé) relance le délai du joueur suivant.
create or replace function public.games_defi_garde()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.defis where partie_id = new.id) then
    return new;
  end if;
  if new.moves is distinct from old.moves
     and coalesce(current_setting('jeu.coup_defi', true), '') <> new.id::text then
    raise exception 'Les coups d''un défi passent par la fonction serveur' using errcode = '42501';
  end if;
  if new.status = 'active'
     and (new.moves is distinct from old.moves or (old.counting and not new.counting)) then
    update public.defis set date_limite = now() + delai_coup where partie_id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.games_defi_garde() from public, anon, authenticated;
create trigger games_defi_garde before update on public.games
  for each row execute function public.games_defi_garde();

-- 4. Constat du temps (interne) : si le délai du coup en cours est passé, le joueur au trait perd.
--    Pas de délai pendant le comptage (les deux joueurs ont passé).
create or replace function public.defi_constater_temps(p_partie uuid)
returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_limite timestamptz;
  v_premier text;
  v_trait text;
  v_resultat text;
begin
  select * into v_game from public.games where id = p_partie for update;
  if not found then return null; end if;
  select date_limite into v_limite from public.defis where partie_id = p_partie for update;
  if v_limite is null or v_limite >= now() or v_game.status <> 'active' or v_game.counting then
    return null;
  end if;
  v_premier := case when v_game.handicap > 0 then 'W' else 'B' end;
  v_trait := case when (char_length(v_game.moves) / 2) % 2 = 0 then v_premier
                  else (case when v_premier = 'B' then 'W' else 'B' end) end;
  v_resultat := case when v_trait = 'B' then 'W+T' else 'B+T' end;
  update public.games set status = 'finished', result = v_resultat where id = p_partie;
  return v_resultat;
end;
$$;
revoke execute on function public.defi_constater_temps(uuid) from public, anon, authenticated, service_role;

-- 5. Créer un défi : renvoie la partie et le jeton du lien. Session anonyme acceptée.
create or replace function public.creer_defi()
returns table (partie_id uuid, jeton text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_partie uuid;
  v_jeton text;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if (select count(*) from public.defis d join public.games g on g.id = d.partie_id
      where d.createur_id = v_uid and g.status = 'waiting' and d.lien_expire_le > now()) >= 20 then
    raise exception 'Tu as déjà 20 défis en attente' using errcode = '54000';
  end if;
  v_jeton := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');
  insert into public.games (white_id, created_by, size, rules, komi, status, rated, prive)
    values (v_uid, v_uid, 9, 'japanese', 6.5, 'waiting', false, true)
    returning id into v_partie;
  insert into public.defis (partie_id, jeton, createur_id) values (v_partie, v_jeton, v_uid);
  return query select v_partie, v_jeton;
end;
$$;

-- 6. Rejoindre un défi par son jeton : l'invité prend Noir, la partie commence, le délai démarre.
--    Session anonyme acceptée. Le créateur qui ouvre son propre lien retrouve simplement sa partie.
create or replace function public.rejoindre_defi(p_jeton text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_defi public.defis%rowtype;
  v_game public.games%rowtype;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_jeton is null or p_jeton !~ '^[A-Za-z0-9_-]{32}$' then
    raise exception 'Défi introuvable' using errcode = 'P0002';
  end if;
  select * into v_defi from public.defis where jeton = p_jeton for update;
  if not found then raise exception 'Défi introuvable' using errcode = 'P0002'; end if;
  if v_uid = v_defi.createur_id or v_uid = v_defi.invite_id then return v_defi.partie_id; end if;
  if v_defi.invite_id is not null then
    raise exception 'Ce défi a déjà un adversaire' using errcode = '42501';
  end if;
  select * into v_game from public.games where id = v_defi.partie_id for update;
  if v_game.status <> 'waiting' then
    raise exception 'Ce défi n''est plus disponible' using errcode = '42501';
  end if;
  if v_defi.lien_expire_le <= now() then
    raise exception 'Ce lien a expiré' using errcode = '42501';
  end if;
  update public.games set black_id = v_uid, status = 'active' where id = v_defi.partie_id;
  update public.defis set invite_id = v_uid, date_limite = now() + delai_coup where partie_id = v_defi.partie_id;
  return v_defi.partie_id;
end;
$$;

-- 7. Enregistrer un coup de défi. Appelée par la fonction serveur game-action (clé service) après validation
--    des règles par src/go/server.ts (captures, suicide, ko). Revérifie ici, sous verrou : temps, joueur, tour,
--    état de la partie, format. Si le délai est dépassé, la victoire au temps est enregistrée et le coup refusé.
create or replace function public.jouer_coup_defi(
  p_partie uuid, p_joueur uuid, p_coups_avant text, p_coup text, p_comptage boolean default false
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_resultat text;
  v_premier text;
  v_trait text;
  v_max text;
  v_limite timestamptz;
begin
  select * into v_game from public.games where id = p_partie for update;
  if not found then raise exception 'Partie introuvable' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.defis where partie_id = p_partie) then
    raise exception 'Cette partie n''est pas un défi' using errcode = '22023';
  end if;
  v_resultat := public.defi_constater_temps(p_partie);
  if v_resultat is not null then
    -- Pas d'exception : elle annulerait l'enregistrement de la victoire au temps.
    return jsonb_build_object('ok', false, 'erreur', 'temps', 'resultat', v_resultat);
  end if;
  if p_joueur is null or (p_joueur is distinct from v_game.black_id and p_joueur is distinct from v_game.white_id) then
    raise exception 'Tu ne joues pas dans cette partie' using errcode = '42501';
  end if;
  if v_game.status <> 'active' then raise exception 'La partie n''est pas en cours' using errcode = '55000'; end if;
  if v_game.counting then raise exception 'Comptage en cours' using errcode = '55000'; end if;
  v_premier := case when v_game.handicap > 0 then 'W' else 'B' end;
  v_trait := case when (char_length(v_game.moves) / 2) % 2 = 0 then v_premier
                  else (case when v_premier = 'B' then 'W' else 'B' end) end;
  if (v_trait = 'B' and p_joueur is distinct from v_game.black_id)
     or (v_trait = 'W' and p_joueur is distinct from v_game.white_id) then
    raise exception 'Ce n''est pas ton tour' using errcode = '42501';
  end if;
  if p_coups_avant is null or v_game.moves <> p_coups_avant then
    raise exception 'La partie a changé, recharge-la' using errcode = '40001';
  end if;
  if p_coup is null or p_coup !~ '^([a-s]{2}|tt)$' then raise exception 'Coup invalide' using errcode = '22023'; end if;
  v_max := chr(ascii('a') + v_game.size - 1);
  if p_coup <> 'tt' and (substr(p_coup, 1, 1) > v_max or substr(p_coup, 2, 1) > v_max) then
    raise exception 'Coup hors du plateau' using errcode = '22023';
  end if;
  perform set_config('jeu.coup_defi', p_partie::text, true);
  update public.games
    set moves = moves || p_coup,
        counting = coalesce(p_comptage, false),
        dead_stones = case when p_comptage then null else dead_stones end,
        dead_proposed_by = case when p_comptage then null else dead_proposed_by end
    where id = p_partie;
  perform set_config('jeu.coup_defi', '', true);
  select date_limite into v_limite from public.defis where partie_id = p_partie;
  return jsonb_build_object('ok', true, 'coups', v_game.moves || p_coup, 'date_limite', v_limite);
end;
$$;

-- 8. Victoire au temps, constatée à la lecture par l'un des deux joueurs. Renvoie le résultat de la partie
--    (`B+T`, `W+T`, ou tout autre résultat déjà enregistré), ou null si elle continue.
create or replace function public.victoire_au_temps(p_partie uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select * into v_game from public.games where id = p_partie;
  if not found or not exists (select 1 from public.defis where partie_id = p_partie)
     or (v_uid is distinct from v_game.black_id and v_uid is distinct from v_game.white_id) then
    raise exception 'Défi introuvable' using errcode = 'P0002';
  end if;
  perform public.defi_constater_temps(p_partie);
  select result into v_game.result from public.games where id = p_partie;
  return v_game.result;
end;
$$;

revoke execute on function public.creer_defi(), public.rejoindre_defi(text), public.victoire_au_temps(uuid) from public, anon;
grant execute on function public.creer_defi(), public.rejoindre_defi(text), public.victoire_au_temps(uuid) to authenticated;
revoke execute on function public.jouer_coup_defi(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.jouer_coup_defi(uuid, uuid, text, text, boolean) to service_role;

-- Temps réel : l'adversaire voit arriver la date limite du coup en cours.
alter publication supabase_realtime add table public.defis;
