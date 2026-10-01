-- Issue #343 (décision de Florian du 30/09) : compte obligatoire avec pseudo pour jouer contre d'autres joueurs.
-- Plus de joueurs anonymes dans les défis : l'ami qui ouvre un lien voit le plateau et qui l'invite (apercu_defi),
-- crée son compte (e-mail + pseudo), puis rejoint le défi avant son premier coup.
--
-- Cette migration :
-- 1. ajoute `exiger_compte_avec_pseudo()`, contrôle interne commun, avec deux codes d'erreur distincts que le client
--    reconnaît (src/data/compteRequis.ts) :
--      JGC01 « Crée ton compte »   : pas de session, ou session anonyme ;
--      JGP01 « Choisis ton pseudo » : vrai compte dont le profil n'a pas encore de `username` ;
-- 2. l'appelle au début de `creer_defi`, `find_match`, `join_game`, et dans `rejoindre_defi` pour un nouvel invité ;
-- 3. ajoute `apercu_defi(jeton)`, lisible sans session : pseudo du créateur, taille, état du lien ;
-- 4. ajoute une politique restrictive : une partie entre humains (sans `bot_id`) créée directement exige un pseudo.
--
-- Exception voulue : un joueur (anonyme ou sans pseudo) DÉJÀ dans un défi garde sa partie. `rejoindre_defi` lui rend
-- sa partie comme avant, `jouer_coup_defi` (clé service, via game-action), `resign_game` (défi) et
-- `victoire_au_temps` sont inchangées. Les parties en cours ne cassent pas.
--
-- Anonyme : claim `is_anonymous` du jeton à true, OU compte encore anonyme dans auth.users (source de vérité ; un
-- jeton sans claim, émis avant l'activation, compte comme un vrai compte si auth.users le dit).
--
-- Aucune donnée supprimée, aucune politique retirée, RLS inchangée (active partout), aucun calcul de cote touché.
-- Les corps repris sont ceux de 20260929100100_garde_anonymes.sql (find_match, join_game, creer_defi) et de
-- 20260929003100_defi_par_lien.sql (rejoindre_defi), au contrôle près.

-- 1. Contrôle commun (interne : appelé seulement depuis les fonctions security definer ci-dessous).
create or replace function public.exiger_compte_avec_pseudo()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or coalesce((select u.is_anonymous from auth.users u where u.id = v_uid), true) then
    raise exception 'Crée ton compte pour jouer contre d''autres joueurs' using errcode = 'JGC01';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.username is not null) then
    raise exception 'Choisis ton pseudo pour jouer contre d''autres joueurs' using errcode = 'JGP01';
  end if;
  return v_uid;
end;
$$;
comment on function public.exiger_compte_avec_pseudo() is
  'Issue #343 : refuse (JGC01) sans compte ou en session anonyme, (JGP01) sans pseudo. Renvoie auth.uid(). Interne.';
revoke execute on function public.exiger_compte_avec_pseudo() from public, anon, authenticated, service_role;

-- 2. Fonctions du jeu en ligne

create or replace function public.find_match(p_size smallint)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_rating integer;
  v_opp uuid;
  v_game uuid;
begin
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

create or replace function public.join_game(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_game public.games%rowtype;
begin
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

-- Créer un défi : compte avec pseudo, 20 défis en attente au plus.
create or replace function public.creer_defi()
returns table (partie_id uuid, jeton text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_partie uuid;
  v_jeton text;
begin
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

-- Rejoindre un défi : un joueur déjà dans le défi (créateur ou invité, même anonyme) retrouve sa partie ;
-- un nouvel invité doit avoir un compte avec pseudo.
create or replace function public.rejoindre_defi(p_jeton text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_defi public.defis%rowtype;
  v_game public.games%rowtype;
begin
  if v_uid is null then raise exception 'Crée ton compte pour jouer contre d''autres joueurs' using errcode = 'JGC01'; end if;
  if p_jeton is null or p_jeton !~ '^[A-Za-z0-9_-]{32}$' then
    raise exception 'Défi introuvable' using errcode = 'P0002';
  end if;
  select * into v_defi from public.defis where jeton = p_jeton for update;
  if not found then raise exception 'Défi introuvable' using errcode = 'P0002'; end if;
  if v_uid = v_defi.createur_id or v_uid = v_defi.invite_id then return v_defi.partie_id; end if;
  perform public.exiger_compte_avec_pseudo();
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

-- 3. Aperçu d'un défi, sans session : ce que l'ami voit avant de créer son compte.
--    Le jeton (192 bits aléatoires) fait office de droit de lecture, comme pour rejoindre.
--    etat : 'libre' (à rejoindre), 'pris' (déjà un adversaire), 'expire' (lien périmé), 'fini' (partie terminée).
--    ma_place : 'createur' ou 'invite' si l'appelant est déjà dans ce défi (il peut y retourner), sinon null.
--    Aucune ligne si le jeton est inconnu ou mal formé.
create or replace function public.apercu_defi(p_jeton text)
returns table (createur_pseudo text, taille smallint, etat text, ma_place text)
language sql stable security definer set search_path = ''
as $$
  select p.username,
         g.size,
         case when g.status = 'finished' then 'fini'
              when d.invite_id is not null or g.status <> 'waiting' then 'pris'
              when d.lien_expire_le <= now() then 'expire'
              else 'libre' end,
         case when auth.uid() is not null and auth.uid() = d.createur_id then 'createur'
              when auth.uid() is not null and auth.uid() = d.invite_id then 'invite' end
  from public.defis d
  join public.games g on g.id = d.partie_id
  left join public.profiles p on p.id = d.createur_id
  where p_jeton ~ '^[A-Za-z0-9_-]{32}$' and d.jeton = p_jeton;
$$;
comment on function public.apercu_defi(text) is
  'Issue #343 : aperçu d''un défi par son jeton (pseudo du créateur, taille, état), lisible sans session.';
revoke execute on function public.apercu_defi(text) from public;
grant execute on function public.apercu_defi(text) to anon, authenticated;

-- 4. Partie entre humains créée directement par le client : pseudo exigé (les parties contre l'IA restent libres).
--    L'anonyme est déjà refusé pour toute création par « Anonyme : pas de création de partie » (#316).
create policy "Partie entre humains : pseudo requis" on public.games
  as restrictive for insert to authenticated
  with check (bot_id is not null
              or exists (select 1 from public.profiles p
                         where p.id = (select auth.uid()) and p.username is not null));
