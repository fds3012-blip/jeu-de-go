-- Issue #360 : jouer en direct contre un humain. File d'attente, appariement par la cote Glicko-2 (#417), partie
-- classée, pendule tenue par le serveur (byo-yomi japonais), perte au temps décidée par le serveur, déconnexion tolérée.
--
-- Règles (docs/game-design/partie-en-direct.md) :
-- - Partie en direct seulement avec un compte avec pseudo (`exiger_compte_avec_pseudo`, codes JGC01 / JGP01).
-- - Seules ces parties sont classées (komi 6,5, handicap 0, imposés par `games_guard_insert`). Les parties contre l'IA
--   ne le sont jamais (`games_classee_entre_humains`), les défis entre amis restent amicaux : rien ne change pour eux.
-- - Cadences : « rapide » 5 min + 3 × 20 s, « normale » 10 min + 3 × 30 s (par défaut), « lente » 20 min + 5 × 30 s.
--   Byo-yomi japonais : une fois le temps principal épuisé, chaque coup doit être joué dans une période ; une période
--   dépassée est perdue, la dernière dépassée fait perdre au temps.
-- - La pendule est tenue par le serveur : l'heure de la base (now()) fait foi, jamais celle du client.
--   * Chaque coup écrit dans `games` (par la fonction serveur game-action, clé service) est décompté par le déclencheur
--     `games_direct_pendule`. Un coup arrivé après la chute n'est pas joué : la perte au temps est écrite à sa place.
--   * Entre deux coups, `pendule_direct` (appelée par chaque joueur toutes les quelques secondes, elle sert aussi de
--     signe de présence) constate la chute et la perte au temps.
--   * Pendant le comptage (après deux passes), la pendule est arrêtée ; elle repart à la reprise.
-- - Déconnexion tolérée 60 secondes : la pendule continue de tourner (une déconnexion de 30 s ne fait pas perdre, sauf
--   chute de la pendule). Au-delà de 60 s sans signe de présence quand c'est à lui d'agir (son coup, ou le comptage),
--   le joueur absent perd au temps (`B+T` / `W+T`), constaté par l'adversaire resté. Avant que chacun ait joué un coup,
--   la partie est annulée (`aborted`), sans effet sur la cote.
-- - La cote bouge une seule fois, par le serveur : `apply_game_rating` (#417), appelée par la perte au temps ici, par
--   `resign_game` et `finish_game_by_score` comme avant.
--
-- Sécurité : RLS sur la nouvelle table `parties_direct` (lecture par les deux joueurs, aucune écriture directe) ;
-- fonctions `security definer` à `search_path` vide ; fonctions internes fermées à l'app.
--
-- Données : aucune suppression de données de production. Les seuls DELETE portent sur la file d'attente
-- (`match_queue`), comme avant : purge des attentes abandonnées, sortie de la file à l'appariement ou à l'annulation.
-- `find_match(smallint)` est remplacée par `find_match(smallint, text, text)` (paramètres ajoutés avec valeurs par
-- défaut : un appel `find_match(p_size)` reste valable). Rien d'autre n'est retiré.
--
-- La fonction serveur game-action n'est pas modifiée : ses écritures conditionnelles passent par le déclencheur.

-- 1. File d'attente : cadence, règles de comptage et dernier signe de vie de l'attente.

alter table public.match_queue
  add column cadence text not null default 'normale' check (cadence in ('rapide', 'normale', 'lente')),
  add column regles text not null default 'japanese' check (regles in ('japanese', 'chinese')),
  add column vu_le timestamptz not null default now();
comment on column public.match_queue.cadence is 'Cadence demandée (#360) : rapide, normale (10 min + 3 × 30 s), lente.';
comment on column public.match_queue.regles is 'Comptage demandé (#360) : japonais par défaut, chinois en option.';
comment on column public.match_queue.vu_le is 'Dernier appel de find_match par le joueur qui attend : sans nouvelle depuis 30 s, il a quitté.';

-- 2. Pendule des parties en direct

create table public.parties_direct (
  partie_id uuid primary key references public.games(id) on delete cascade,
  cadence text not null check (cadence in ('rapide', 'normale', 'lente')),
  main_ms integer not null check (main_ms between 60000 and 3600000),
  periodes smallint not null check (periodes between 1 and 10),
  periode_ms integer not null check (periode_ms between 5000 and 120000),
  noir_ms integer not null check (noir_ms >= 0),
  blanc_ms integer not null check (blanc_ms >= 0),
  noir_periodes smallint not null check (noir_periodes >= 0),
  blanc_periodes smallint not null check (blanc_periodes >= 0),
  trait_depuis timestamptz,
  comptage_depuis timestamptz,
  noir_vu_le timestamptz,
  blanc_vu_le timestamptz,
  cree_le timestamptz not null default now()
);
comment on table public.parties_direct is
  'Partie en direct (#360) : pendule tenue par le serveur. Écrite seulement par find_match, pendule_direct et le déclencheur games_direct_pendule.';
comment on column public.parties_direct.noir_ms is 'Temps principal restant à Noir (ms), au début du coup en cours.';
comment on column public.parties_direct.noir_periodes is 'Périodes de byo-yomi restantes à Noir.';
comment on column public.parties_direct.trait_depuis is 'Début du coup en cours ; null quand la pendule est arrêtée (comptage, fin).';
comment on column public.parties_direct.comptage_depuis is 'Début du comptage en cours (deux passes), null sinon.';
comment on column public.parties_direct.noir_vu_le is 'Dernier signe de présence de Noir (pendule_direct ou coup joué).';

alter table public.parties_direct enable row level security;
create policy "Lecture par les deux joueurs" on public.parties_direct
  for select to authenticated
  using (exists (select 1 from public.games g
                 where g.id = partie_id and (select auth.uid()) in (g.black_id, g.white_id)));
revoke all on public.parties_direct from anon;
revoke insert, update, delete, truncate on public.parties_direct from authenticated;

-- 3. Cadences et calcul de la pendule (fonctions pures, internes ; même calcul que src/go/pendule.ts).

create or replace function public.cadence_direct(p_cadence text)
returns table (main_ms integer, periodes smallint, periode_ms integer)
language sql immutable security invoker set search_path = ''
as $$
  select c.m, c.p, c.pm from (values
    ('rapide', 300000, 3::smallint, 20000),
    ('normale', 600000, 3::smallint, 30000),
    ('lente', 1200000, 5::smallint, 30000)
  ) c(nom, m, p, pm)
  where c.nom = p_cadence;
$$;

-- Pendule d'un joueur après `p_ecoule_ms` de réflexion sur un coup : temps principal d'abord, puis byo-yomi.
-- Tombée quand l'écoulé atteint le temps principal plus toutes les périodes restantes.
create or replace function public.pendule_apres(p_main_ms integer, p_periodes integer, p_periode_ms integer, p_ecoule_ms bigint)
returns table (main_ms integer, periodes integer, tombe boolean)
language sql immutable security invoker set search_path = ''
as $$
  select
    case when tombe then 0 when e <= p_main_ms then (p_main_ms - e)::integer else 0 end,
    case when tombe then 0 when e <= p_main_ms then p_periodes
         else p_periodes - ((e - p_main_ms) / p_periode_ms)::integer end,
    tombe
  from (select greatest(p_ecoule_ms, 0) as e,
               greatest(p_ecoule_ms, 0) >= p_main_ms::bigint + p_periodes::bigint * p_periode_ms as tombe) x;
$$;

revoke execute on function public.cadence_direct(text) from public, anon, authenticated;
revoke execute on function public.pendule_apres(integer, integer, integer, bigint) from public, anon, authenticated;

-- 4. Déclencheur : chaque coup d'une partie en direct est décompté sur la pendule du joueur qui l'a joué.
--    Coup arrivé après la chute : il n'est pas joué, la perte au temps est écrite à sa place (et la cote comptée).
create or replace function public.games_direct_pendule()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.parties_direct%rowtype;
  v_noir boolean;
  v_ecoule bigint;
  v_r record;
  v_maintenant timestamptz := now();
begin
  select * into v_p from public.parties_direct where partie_id = new.id for update;
  if not found or old.status <> 'active' then
    return new;
  end if;
  if new.moves is distinct from old.moves and new.status = 'active' then
    -- Partie classée : handicap 0, Noir joue les coups pairs (0, 2, 4…).
    v_noir := (char_length(old.moves) / 2) % 2 = 0;
    v_ecoule := case when v_p.trait_depuis is null then 0
                     else floor(extract(epoch from v_maintenant - v_p.trait_depuis) * 1000)::bigint end;
    select * into v_r from public.pendule_apres(
      case when v_noir then v_p.noir_ms else v_p.blanc_ms end,
      case when v_noir then v_p.noir_periodes else v_p.blanc_periodes end,
      v_p.periode_ms, v_ecoule);
    if v_r.tombe then
      new.moves := old.moves;
      new.counting := false;
      new.dead_stones := old.dead_stones;
      new.dead_proposed_by := old.dead_proposed_by;
      new.resumed_at := old.resumed_at;
      new.status := 'finished';
      new.result := case when v_noir then 'W+T' else 'B+T' end;
      update public.parties_direct
        set noir_ms = case when v_noir then 0 else noir_ms end,
            noir_periodes = case when v_noir then 0 else noir_periodes end,
            blanc_ms = case when v_noir then blanc_ms else 0 end,
            blanc_periodes = case when v_noir then blanc_periodes else 0 end,
            trait_depuis = null, comptage_depuis = null
        where partie_id = new.id;
      if old.rated then
        perform public.apply_game_rating(new.id,
          case when v_noir then old.white_id else old.black_id end,
          case when v_noir then old.black_id else old.white_id end);
      end if;
      return new;
    end if;
    update public.parties_direct
      set noir_ms = case when v_noir then v_r.main_ms else noir_ms end,
          noir_periodes = case when v_noir then v_r.periodes else noir_periodes end,
          blanc_ms = case when v_noir then blanc_ms else v_r.main_ms end,
          blanc_periodes = case when v_noir then blanc_periodes else v_r.periodes end,
          noir_vu_le = case when v_noir then v_maintenant else noir_vu_le end,
          blanc_vu_le = case when v_noir then blanc_vu_le else v_maintenant end,
          trait_depuis = case when new.counting then null else v_maintenant end,
          comptage_depuis = case when new.counting then v_maintenant else null end
      where partie_id = new.id;
  elsif old.counting and not new.counting and new.status = 'active' then
    -- Reprise après un comptage refusé : la pendule du joueur au trait repart.
    update public.parties_direct set trait_depuis = v_maintenant, comptage_depuis = null where partie_id = new.id;
  end if;
  if new.status <> 'active' then
    update public.parties_direct set trait_depuis = null, comptage_depuis = null where partie_id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.games_direct_pendule() from public, anon, authenticated, service_role;
create trigger games_direct_pendule before update on public.games
  for each row execute function public.games_direct_pendule();

-- 5. Constat (interne) : chute de la pendule, ou absence de plus de 60 s de qui doit agir. Renvoie le résultat
--    enregistré (`B+T`, `W+T`, `annulee`) ou null si la partie continue. `p_appelant` : le joueur présent.
create or replace function public.direct_constater(p_partie uuid, p_appelant uuid)
returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  c_absence constant interval := interval '60 seconds';
  v_game public.games%rowtype;
  v_p public.parties_direct%rowtype;
  v_noir_trait boolean;
  v_r record;
  v_perdant_noir boolean;
  v_tombe boolean := false;
  v_ref timestamptz;
begin
  select * into v_game from public.games where id = p_partie for update;
  select * into v_p from public.parties_direct where partie_id = p_partie for update;
  if v_game.id is null or v_p.partie_id is null or v_game.status <> 'active' then return null; end if;
  v_noir_trait := (char_length(v_game.moves) / 2) % 2 = 0;

  if not v_game.counting and v_p.trait_depuis is not null then
    -- Chute de la pendule du joueur au trait.
    select * into v_r from public.pendule_apres(
      case when v_noir_trait then v_p.noir_ms else v_p.blanc_ms end,
      case when v_noir_trait then v_p.noir_periodes else v_p.blanc_periodes end,
      v_p.periode_ms, floor(extract(epoch from now() - v_p.trait_depuis) * 1000)::bigint);
    v_tombe := v_r.tombe;
    if v_tombe then
      v_perdant_noir := v_noir_trait;
    else
      -- Absence du joueur au trait (jamais l'appelant : il vient de donner signe de vie).
      v_ref := greatest(v_p.trait_depuis, case when v_noir_trait then v_p.noir_vu_le else v_p.blanc_vu_le end);
      if p_appelant is distinct from (case when v_noir_trait then v_game.black_id else v_game.white_id end)
         and now() - v_ref > c_absence then
        v_perdant_noir := v_noir_trait;
      end if;
    end if;
  elsif v_game.counting and v_p.comptage_depuis is not null then
    -- Comptage : l'adversaire de l'appelant, s'il est absent depuis plus de 60 s.
    if p_appelant = v_game.black_id
       and now() - greatest(v_p.comptage_depuis, v_p.blanc_vu_le) > c_absence then
      v_perdant_noir := false;
    elsif p_appelant = v_game.white_id
       and now() - greatest(v_p.comptage_depuis, v_p.noir_vu_le) > c_absence then
      v_perdant_noir := true;
    end if;
  end if;

  if v_perdant_noir is null then return null; end if;

  if char_length(v_game.moves) < 4 then
    -- Personne n'a encore vraiment commencé (moins d'un coup chacun) : partie annulée, sans cote.
    update public.games set status = 'aborted', counting = false where id = p_partie;
    return 'annulee';
  end if;
  update public.games
    set status = 'finished', counting = false, result = case when v_perdant_noir then 'W+T' else 'B+T' end
    where id = p_partie;
  update public.parties_direct
    set noir_ms = case when v_perdant_noir and v_tombe then 0 else noir_ms end,
        noir_periodes = case when v_perdant_noir and v_tombe then 0 else noir_periodes end,
        blanc_ms = case when not v_perdant_noir and v_tombe then 0 else blanc_ms end,
        blanc_periodes = case when not v_perdant_noir and v_tombe then 0 else blanc_periodes end
    where partie_id = p_partie;
  if v_game.rated then
    perform public.apply_game_rating(p_partie,
      case when v_perdant_noir then v_game.white_id else v_game.black_id end,
      case when v_perdant_noir then v_game.black_id else v_game.white_id end);
  end if;
  return case when v_perdant_noir then 'W+T' else 'B+T' end;
end;
$$;
revoke execute on function public.direct_constater(uuid, uuid) from public, anon, authenticated, service_role;

-- 6. Partie en direct en cours du joueur (interne).
create or replace function public.direct_en_cours(p_uid uuid)
returns uuid
language sql stable security invoker set search_path = ''
as $$
  select g.id from public.parties_direct d join public.games g on g.id = d.partie_id
  where g.status = 'active' and p_uid in (g.black_id, g.white_id)
  order by d.cree_le desc
  limit 1;
$$;
revoke execute on function public.direct_en_cours(uuid) from public, anon, authenticated, service_role;

-- 7. Appariement (#360, forme finale ; remplace celle de #417) : même taille, même cadence, même comptage, par la cote
--    Glicko-2. Écart accepté = 100 + √(RD₁² + RD₂²) / 2 + 10 points par seconde d'attente (la plus longue des deux) ;
--    le plus proche en cote d'abord, puis le plus ancien dans la file. Le joueur qui attend rappelle find_match toutes
--    les 2 à 3 secondes : il garde sa place (et son ancienneté), et retrouve la partie dès qu'un adversaire l'a créée.
--    Une partie en direct déjà en cours est rendue telle quelle (une seule à la fois).
drop function public.find_match(smallint);
create or replace function public.find_match(p_size smallint, p_cadence text default 'normale', p_regles text default 'japanese')
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_rating integer;
  v_rd numeric;
  v_depuis timestamptz;
  v_opp uuid;
  v_game uuid;
  v_noir uuid;
  v_c record;
begin
  if p_size is null or p_size not in (9, 13, 19) then raise exception 'Taille invalide' using errcode = '22023'; end if;
  select * into v_c from public.cadence_direct(p_cadence);
  if v_c.main_ms is null then raise exception 'Cadence invalide' using errcode = '22023'; end if;
  if p_regles is null or p_regles not in ('japanese', 'chinese') then raise exception 'Comptage invalide' using errcode = '22023'; end if;

  v_game := public.direct_en_cours(v_uid);
  if v_game is not null then
    perform public.direct_constater(v_game, v_uid);
    if exists (select 1 from public.games where id = v_game and status = 'active') then
      delete from public.match_queue where user_id = v_uid;
      return v_game;
    end if;
  end if;

  select rating, cote_rd into v_rating, v_rd from public.profiles where id = v_uid;
  -- Attentes abandonnées (plus de nouvelles depuis 30 s, ou plus de 10 minutes) : retirées de la file.
  delete from public.match_queue where vu_le < now() - interval '30 seconds' or created_at < now() - interval '10 minutes';
  select created_at into v_depuis from public.match_queue
    where user_id = v_uid and size = p_size and cadence = p_cadence and regles = p_regles;
  select q.user_id into v_opp from public.match_queue q
    where q.size = p_size and q.cadence = p_cadence and q.regles = p_regles and q.user_id <> v_uid
      and abs(q.rating - v_rating) <= 100 + sqrt(q.rd * q.rd + v_rd * v_rd) / 2
                                       + 10 * extract(epoch from now() - least(q.created_at, coalesce(v_depuis, now())))
      and public.direct_en_cours(q.user_id) is null
    order by abs(q.rating - v_rating), q.created_at
    limit 1
    for update skip locked;
  if v_opp is not null then
    delete from public.match_queue where user_id in (v_uid, v_opp);
    v_noir := case when random() < 0.5 then v_uid else v_opp end;
    insert into public.games (black_id, white_id, created_by, size, rules, status, rated)
      values (v_noir, case when v_noir = v_uid then v_opp else v_uid end, v_uid, p_size, p_regles, 'active', true)
      returning id into v_game;
    insert into public.parties_direct (partie_id, cadence, main_ms, periodes, periode_ms, noir_ms, blanc_ms,
                                       noir_periodes, blanc_periodes, trait_depuis, noir_vu_le, blanc_vu_le)
      values (v_game, p_cadence, v_c.main_ms, v_c.periodes, v_c.periode_ms, v_c.main_ms, v_c.main_ms,
              v_c.periodes, v_c.periodes, now(), null, null);
    -- L'appelant est là : signe de présence.
    update public.parties_direct
      set noir_vu_le = case when v_noir = v_uid then now() end,
          blanc_vu_le = case when v_noir = v_uid then null else now() end
      where partie_id = v_game;
    return v_game;
  end if;
  insert into public.match_queue (user_id, size, rating, rd, cadence, regles, vu_le)
    values (v_uid, p_size, v_rating, v_rd, p_cadence, p_regles, now())
    on conflict (user_id) do update
      set created_at = case when public.match_queue.size = excluded.size and public.match_queue.cadence = excluded.cadence
                                 and public.match_queue.regles = excluded.regles
                            then public.match_queue.created_at else now() end,
          size = excluded.size, rating = excluded.rating, rd = excluded.rd,
          cadence = excluded.cadence, regles = excluded.regles, vu_le = now();
  return null;
end;
$$;
revoke execute on function public.find_match(smallint, text, text) from public, anon;
grant execute on function public.find_match(smallint, text, text) to authenticated;
comment on function public.find_match(smallint, text, text) is
  'Issue #360 : entre dans la file ou crée la partie classée en direct (taille, cadence, comptage, cote Glicko-2). Compte avec pseudo.';

-- 8. Annuler l'attente. Si un adversaire a déjà créé la partie, elle est rendue : l'écran l'ouvre au lieu d'annuler.
create or replace function public.quitter_file_attente()
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  delete from public.match_queue where user_id = v_uid;
  return public.direct_en_cours(v_uid);
end;
$$;
revoke execute on function public.quitter_file_attente() from public, anon;
grant execute on function public.quitter_file_attente() to authenticated;

-- 9. Pendule d'une partie en direct, lue par un de ses joueurs : signe de présence, constat de la chute ou de
--    l'absence de l'adversaire, puis l'état complet (heure du serveur comprise, pour caler l'affichage du client).
create or replace function public.pendule_direct(p_partie uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
  v_p public.parties_direct%rowtype;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select * into v_game from public.games where id = p_partie;
  if not found or not exists (select 1 from public.parties_direct where partie_id = p_partie)
     or (v_uid is distinct from v_game.black_id and v_uid is distinct from v_game.white_id) then
    raise exception 'Partie introuvable' using errcode = 'P0002';
  end if;
  if v_game.status = 'active' then
    update public.parties_direct
      set noir_vu_le = case when v_uid = v_game.black_id then now() else noir_vu_le end,
          blanc_vu_le = case when v_uid = v_game.white_id then now() else blanc_vu_le end
      where partie_id = p_partie;
    perform public.direct_constater(p_partie, v_uid);
  end if;
  select * into v_game from public.games where id = p_partie;
  select * into v_p from public.parties_direct where partie_id = p_partie;
  return jsonb_build_object(
    'statut', v_game.status, 'resultat', v_game.result, 'coups', v_game.moves, 'comptage', v_game.counting,
    'mortes', v_game.dead_stones, 'mortes_par', v_game.dead_proposed_by,
    'cadence', v_p.cadence, 'main_ms', v_p.main_ms, 'periodes', v_p.periodes, 'periode_ms', v_p.periode_ms,
    'noir_ms', v_p.noir_ms, 'blanc_ms', v_p.blanc_ms, 'noir_periodes', v_p.noir_periodes, 'blanc_periodes', v_p.blanc_periodes,
    'trait_depuis', v_p.trait_depuis, 'comptage_depuis', v_p.comptage_depuis,
    'noir_vu_le', v_p.noir_vu_le, 'blanc_vu_le', v_p.blanc_vu_le, 'maintenant', now());
end;
$$;
revoke execute on function public.pendule_direct(uuid) from public, anon;
grant execute on function public.pendule_direct(uuid) to authenticated;
comment on function public.pendule_direct(uuid) is
  'Issue #360 : pendule d''une partie en direct (signe de présence, constat de la perte au temps). Joueurs seulement.';

-- 10. Temps réel : chaque coup déplace la pendule, les deux joueurs la voient arriver (RLS : eux seuls).
alter publication supabase_realtime add table public.parties_direct;
