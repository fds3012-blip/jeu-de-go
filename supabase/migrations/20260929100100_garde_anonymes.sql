-- Issue #316 (prérequis de #81) : limiter les sessions anonymes Supabase au défi par lien, AVANT d'activer
-- la connexion anonyme.
--
-- Un utilisateur anonyme a le rôle `authenticated`, comme un vrai compte ; seul son jeton le distingue
-- (claim `is_anonymous = true`). Cette migration :
-- 1. ajoute des politiques RESTRICTIVES (elles s'ajoutent en « et » aux politiques existantes) qui refusent
--    à un anonyme les écritures hors défi : demandes d'ami, problèmes personnels, parties, badges, leçons, pseudo ;
-- 2. refuse l'anonyme dans les fonctions serveur hors défi : recherche d'adversaire, partie par code, abandon
--    d'une partie qui n'est pas un défi, cote des problèmes, envoi de la série ;
-- 3. limite un créateur anonyme à 3 défis en attente (20 pour un vrai compte).
--
-- Ce qui reste permis à un anonyme : lire (profils, problèmes communs, ses propres données), créer un défi (3 au plus
-- en attente), rejoindre un défi, y jouer (fonction serveur game-action, clé service), abandonner un défi, constater
-- la victoire au temps, supprimer son compte.
--
-- Lecture du claim : `(select (auth.jwt() ->> 'is_anonymous')::boolean) is not true` (un claim absent compte comme
-- un vrai compte : les jetons émis avant l'activation n'ont pas ce claim, et un anonyme qui lie un e-mail le perd au
-- rafraîchissement de son jeton).
--
-- Les fonctions `security definer` appartiennent à `postgres`, qui contourne la RLS (BYPASSRLS) : les politiques
-- restrictives ne bloquent donc pas `creer_defi` quand elle insère la partie d'un défi. Les contrôles des fonctions
-- sont faits dans leur corps, ci-dessous. Les corps repris ici sont identiques à ceux de la production, à l'ajout
-- près du contrôle de l'anonyme.
--
-- Aucune donnée supprimée, aucune politique retirée, RLS inchangée (active partout). Le calcul des cotes est
-- inchangé : un anonyme n'y a simplement plus accès.

-- 1. Politiques restrictives

create policy "Anonyme : pas de demande d'ami" on public.friendships
  as restrictive for insert to authenticated
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);

create policy "Anonyme : pas d'acceptation d'ami" on public.friendships
  as restrictive for update to authenticated
  using ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true)
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);

create policy "Anonyme : pas de problème personnel" on public.puzzles
  as restrictive for insert to authenticated
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);

create policy "Anonyme : pas de suppression de problème" on public.puzzles
  as restrictive for delete to authenticated
  using ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);

-- Les défis créent leur partie par creer_defi (security definer), pas par cette voie.
create policy "Anonyme : pas de création de partie" on public.games
  as restrictive for insert to authenticated
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);

create policy "Anonyme : pas de badge" on public.achievements
  as restrictive for insert to authenticated
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);

-- Sans compte, la progression des leçons reste sur l'appareil (politique de confidentialité, section 3.1).
create policy "Anonyme : progression des leçons sur l'appareil" on public.lesson_progress
  as restrictive for insert to authenticated
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);

create policy "Anonyme : progression des leçons sur l'appareil (mise à jour)" on public.lesson_progress
  as restrictive for update to authenticated
  using ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true)
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);

-- Un anonyme n'a pas de pseudo : il n'apparaît pas au classement et ne réserve pas de pseudo avec des sessions jetables.
-- Il le choisira après avoir lié un e-mail (son jeton n'est alors plus anonyme).
create policy "Anonyme : pas de pseudo" on public.profiles
  as restrictive for update to authenticated
  using ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true)
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);

-- 2. Fonctions serveur hors défi : l'appelant anonyme est refusé (errcode 42501).

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
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Crée un compte pour jouer en ligne' using errcode = '42501';
  end if;
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
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Crée un compte pour jouer en ligne' using errcode = '42501';
  end if;
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

-- Abandon : un anonyme peut abandonner un défi (non classé), pas une autre partie.
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
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     and not exists (select 1 from public.defis where partie_id = p_game) then
    raise exception 'Crée un compte pour jouer en ligne' using errcode = '42501';
  end if;
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

-- Cote des problèmes : réservée aux comptes. Sans compte, les problèmes se jouent sur l'appareil.
create or replace function public.record_puzzle_attempt(p_puzzle text, p_solved boolean)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_diff integer;
  v_owner uuid;
  v_rating integer;
  v_last date;
  v_days integer;
  v_freezes integer;
  v_frozen date[];
  v_missed integer;
  v_exp numeric;
  v_new integer;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Crée un compte pour garder ta cote' using errcode = '42501';
  end if;
  select difficulty, owner_id into v_diff, v_owner from public.puzzles where id = p_puzzle;
  if not found or (v_owner is not null and v_owner <> v_uid) then raise exception 'Problème introuvable'; end if;
  -- Le verrou sur le profil sérialise les essais d'un même joueur : deux premiers essais simultanés ne comptent qu'une fois.
  select puzzle_rating, streak_last, streak_days, streak_freezes, streak_frozen_days
    into v_rating, v_last, v_days, v_freezes, v_frozen
    from public.profiles where id = v_uid for update;

  if exists (select 1 from public.puzzle_attempts where user_id = v_uid and puzzle_id = p_puzzle) then
    -- Essai répété : cote inchangée, rien dans puzzle_attempts ni rating_history ; la série avance si réussi.
    v_new := v_rating;
  else
    v_exp := 1 / (1 + power(10::numeric, (v_diff - v_rating) / 400.0));
    v_new := greatest(100, v_rating + round(24 * ((case when p_solved then 1 else 0 end) - v_exp))::integer);
    insert into public.puzzle_attempts (user_id, puzzle_id, solved, rating_after) values (v_uid, p_puzzle, p_solved, v_new);
    insert into public.rating_history (user_id, kind, rating) values (v_uid, 'puzzle', v_new);
  end if;

  if p_solved and (v_last is null or v_last < v_today) then
    v_missed := case when v_last is null or v_days <= 0 then null else v_today - v_last - 1 end;
    if v_missed is null then
      v_days := 1;
    elsif v_missed = 0 then
      v_days := v_days + 1;
    elsif v_missed <= v_freezes then
      -- Assez de gels : un par jour manqué, les jours sont marqués gelés, la série continue.
      v_freezes := v_freezes - v_missed;
      v_frozen := (v_frozen || array(select (v_last + g)::date from generate_series(1, v_missed) g))[greatest(1, cardinality(v_frozen) + v_missed - 29):];
      v_days := v_days + 1;
    else
      -- Pas assez de gels : la série repart, la réserve est conservée.
      v_days := 1;
    end if;
    -- Un gel tous les 7 jours de série, dans la limite de 2.
    if v_days % 7 = 0 and v_freezes < 2 then v_freezes := v_freezes + 1; end if;

    update public.profiles set
      puzzle_rating = v_new,
      streak_days = v_days,
      streak_last = v_today,
      streak_freezes = v_freezes,
      streak_frozen_days = v_frozen
    where id = v_uid;
  else
    update public.profiles set puzzle_rating = v_new where id = v_uid;
  end if;
  return v_new;
end;
$$;

-- Série de l'appareil : envoyée au serveur seulement avec un compte.
create or replace function public.importer_serie_appareil(p_jours integer, p_dernier_jour date)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_lancement constant date := date '2026-09-27';
  v_days integer;
  v_last date;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Crée un compte pour garder ta série' using errcode = '42501';
  end if;
  if p_jours is null or p_dernier_jour is null then raise exception 'Série invalide'; end if;
  if p_dernier_jour not in (v_today, v_today - 1) then raise exception 'Série invalide : dernier jour hors bornes'; end if;
  if p_jours < 0 or p_jours > (p_dernier_jour - v_lancement) + 1 then raise exception 'Série invalide : nombre de jours hors bornes'; end if;

  -- Verrou sur le profil : sérialisé avec record_puzzle_attempt.
  select streak_days, streak_last into v_days, v_last from public.profiles where id = v_uid for update;
  if not found then raise exception 'Profil introuvable'; end if;

  if p_jours > v_days or (p_jours = v_days and p_jours > 0 and (v_last is null or p_dernier_jour > v_last)) then
    v_days := p_jours;
    v_last := greatest(v_last, p_dernier_jour);
    update public.profiles set streak_days = v_days, streak_last = v_last where id = v_uid;
  end if;
  return v_days;
end;
$$;

-- 3. Créer un défi : accepté pour un anonyme, limité à 3 défis en attente (20 pour un vrai compte).
create or replace function public.creer_defi()
returns table (partie_id uuid, jeton text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_max integer := case when coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then 3 else 20 end;
  v_partie uuid;
  v_jeton text;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if (select count(*) from public.defis d join public.games g on g.id = d.partie_id
      where d.createur_id = v_uid and g.status = 'waiting' and d.lien_expire_le > now()) >= v_max then
    raise exception 'Tu as déjà % défis en attente', v_max using errcode = '54000';
  end if;
  v_jeton := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');
  insert into public.games (white_id, created_by, size, rules, komi, status, rated, prive)
    values (v_uid, v_uid, 9, 'japanese', 6.5, 'waiting', false, true)
    returning id into v_partie;
  insert into public.defis (partie_id, jeton, createur_id) values (v_partie, v_jeton, v_uid);
  return query select v_partie, v_jeton;
end;
$$;
