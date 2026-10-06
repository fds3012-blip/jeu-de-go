-- Issue #440 : parties lentes classées (par correspondance). On joue quand on veut : 1, 2 ou 3 jours par coup,
-- plusieurs parties à la fois (10 au plus), appariées par la cote Glicko-2 (#417), et elles comptent pour la cote.
-- Décision de Florian (05/10). Règles : docs/game-design/partie-lente.md.
--
-- Réutilisation : une partie lente EST un défi (#81), mais classé. Une ligne de `games` (rated = true, komi 6,5,
-- handicap 0, jamais d'IA) et une ligne de `defis` (délai par coup, date limite du coup en cours), créées comme le fait
-- déjà `defier_ami` (#359). Tout le reste existe et ne change pas :
-- - les coups passent par la fonction serveur `game-action` (action `defi_coup`, règles du go rejouées : captures,
--   suicide, ko), puis par `jouer_coup_defi` (clé service), qui revérifie le joueur, le tour et le délai ;
-- - comptage et acceptation : `game-action` puis `finish_game_by_score`, qui compte la cote d'une partie classée ;
--   abandon : `resign_game`, idem ; temps réel : `games` et `defis` (déjà publiées) ; notifications : `notifier_partie`.
-- La fonction serveur game-action n'est donc PAS modifiée.
--
-- Ce qui est nouveau :
-- 1. une file d'attente lente à part (`file_lente`) : pas de purge à 30 s ni à 10 min comme la file du direct ; on y
--    attend des heures ou des jours. Le joueur voit sa recherche (RLS : sa seule ligne) et l'annule. Quand un adversaire
--    est trouvé pendant son absence, sa ligne garde la partie (`partie_id`) : l'accueil le prévient, puis il l'efface ;
-- 2. la perte au temps compte pour la cote (`defi_constater_temps`, branche des parties classées seulement), constatée
--    à la lecture ou au coup suivant comme avant, ET par une tâche pg_cron toutes les 10 minutes (`lentes_tache`), qui
--    tente aussi d'apparier les attentes devenues compatibles (l'écart de cote accepté grandit avec l'attente) ;
-- 3. au comptage d'une partie lente, le délai continue : il porte sur qui doit répondre (l'autre joueur quand des
--    pierres mortes sont proposées, sinon le joueur au trait) et repart à chaque proposition.
--
-- Défis entre amis (non classés) : rien ne change. Chaque nouvelle branche porte sur `games.rated`, qu'un défi d'ami
-- n'a jamais (creer_defi, defier_ami : rated = false).
--
-- Sécurité : RLS sur `file_lente` (lecture de sa seule ligne, aucune écriture directe) ; fonctions `security definer` à
-- `search_path` vide ; compte avec pseudo exigé (`exiger_compte_avec_pseudo`, JGC01 / JGP01) ; fonctions internes et
-- tâche fermées à l'app. Codes : JGL10 (10 parties lentes en cours), 22023 (taille ou délai invalide).
--
-- Données : aucune suppression de données de production. Les seuls DELETE portent sur la file d'attente lente
-- (`file_lente`) : sortie de la file à l'appariement, à l'annulation, ou une fois la partie trouvée vue.

-- 1. File d'attente lente
create table public.file_lente (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  size smallint not null check (size in (9, 13, 19)),
  delai_jours smallint not null check (delai_jours between 1 and 3),
  rating integer not null,
  rd numeric not null default 350,
  created_at timestamptz not null default now(),
  partie_id uuid references public.games(id) on delete cascade
);
comment on table public.file_lente is
  'File des parties lentes (#440). Écrite seulement par chercher_partie_lente, quitter_file_lente et lentes_tache.';
comment on column public.file_lente.partie_id is
  'Partie créée pendant l''attente (adversaire trouvé en l''absence du joueur) : l''accueil le prévient, puis la ligne est effacée.';
create index file_lente_attente_idx on public.file_lente (created_at) where partie_id is null;

alter table public.file_lente enable row level security;
create policy "Chacun lit sa recherche" on public.file_lente
  for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.file_lente from anon;
revoke insert, update, delete, truncate, references, trigger on public.file_lente from authenticated;
grant select on public.file_lente to authenticated;

-- 2. Délai d'une partie lente au comptage : il repart à chaque proposition de pierres mortes (l'autre doit répondre).
--    Défis d'amis : inchangé (coup joué, reprise après comptage).
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
     and (new.moves is distinct from old.moves or (old.counting and not new.counting)
          or (new.rated and new.counting and new.dead_proposed_by is distinct from old.dead_proposed_by)) then
    update public.defis set date_limite = now() + delai_coup where partie_id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.games_defi_garde() from public, anon, authenticated;

-- 3. Constat du temps (interne). Défi d'ami : comme avant (le joueur au trait perd, pas de délai au comptage, pas de
--    cote). Partie lente (classée) : le délai court aussi au comptage ; avant que chacun ait joué un coup, la partie est
--    annulée (`aborted`, sans cote) ; sinon perte au temps et cote comptée une fois (`apply_game_rating`).
--    Renvoie `B+T`, `W+T`, `annulee`, ou null si la partie continue.
create or replace function public.defi_constater_temps(p_partie uuid)
returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_limite timestamptz;
  v_premier text;
  v_trait text;
  v_perdant text;
  v_resultat text;
begin
  select * into v_game from public.games where id = p_partie for update;
  if not found then return null; end if;
  select date_limite into v_limite from public.defis where partie_id = p_partie for update;
  if v_limite is null or v_limite >= now() or v_game.status <> 'active' or (v_game.counting and not v_game.rated) then
    return null;
  end if;
  v_premier := case when v_game.handicap > 0 then 'W' else 'B' end;
  v_trait := case when (char_length(v_game.moves) / 2) % 2 = 0 then v_premier
                  else (case when v_premier = 'B' then 'W' else 'B' end) end;
  v_perdant := v_trait;
  if v_game.rated and v_game.counting and v_game.dead_proposed_by is not null then
    -- Pierres mortes proposées : c'est à l'autre de répondre.
    v_perdant := case when v_game.dead_proposed_by = v_game.black_id then 'W' else 'B' end;
  end if;
  if v_game.rated and char_length(v_game.moves) < 4 then
    update public.games set status = 'aborted', counting = false where id = p_partie;
    return 'annulee';
  end if;
  v_resultat := case when v_perdant = 'B' then 'W+T' else 'B+T' end;
  update public.games set status = 'finished', result = v_resultat, counting = false where id = p_partie;
  if v_game.rated then
    perform public.apply_game_rating(p_partie,
      case when v_perdant = 'B' then v_game.white_id else v_game.black_id end,
      case when v_perdant = 'B' then v_game.black_id else v_game.white_id end);
  end if;
  return v_resultat;
end;
$$;
revoke execute on function public.defi_constater_temps(uuid) from public, anon, authenticated, service_role;

-- 4. Parties lentes en cours d'un joueur (interne).
create or replace function public.lentes_en_cours(p_uid uuid)
returns integer
language sql stable security invoker set search_path = ''
as $$
  select count(*)::integer from public.defis d join public.games g on g.id = d.partie_id
  where g.rated and g.status = 'active' and p_uid in (g.black_id, g.white_id);
$$;
revoke execute on function public.lentes_en_cours(uuid) from public, anon, authenticated, service_role;

-- 5. Appariement (interne) du joueur `p_uid`, qui a une attente dans la file. Même taille et même délai d'abord ; dès
--    que l'un des deux attend depuis 1 heure, les réglages peuvent différer (ceux de qui attend depuis le plus longtemps).
--    Écart de cote accepté = 100 + √(RD₁² + RD₂²) / 2 + 50 points par heure d'attente (la plus longue des deux). Le plus
--    proche en cote d'abord, puis les mêmes réglages, puis le plus ancien. Jamais deux parties lentes en cours entre les
--    deux mêmes joueurs, jamais au-delà de 10 parties en cours chacun.
--    `p_present` : le joueur est devant l'écran (sa ligne sort de la file) ; sinon (tâche planifiée), sa ligne garde la
--    partie pour l'accueil. L'adversaire, lui, attendait : sa ligne garde la partie. Renvoie la partie, ou null.
create or replace function public.lente_apparier(p_uid uuid, p_present boolean)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  c_elargir constant interval := interval '1 hour';
  v_moi public.file_lente%rowtype;
  v_q public.file_lente%rowtype;
  v_regle public.file_lente%rowtype;
  v_noir uuid;
  v_blanc uuid;
  v_partie uuid;
  v_jeton text;
begin
  select * into v_moi from public.file_lente where user_id = p_uid and partie_id is null for update;
  if not found or public.lentes_en_cours(p_uid) >= 10 then return null; end if;
  select q.* into v_q from public.file_lente q
    where q.user_id <> p_uid and q.partie_id is null
      and ((q.size = v_moi.size and q.delai_jours = v_moi.delai_jours)
           or now() - least(q.created_at, v_moi.created_at) >= c_elargir)
      and abs(q.rating - v_moi.rating) <= 100 + sqrt(q.rd * q.rd + v_moi.rd * v_moi.rd) / 2
                                          + 50 * extract(epoch from now() - least(q.created_at, v_moi.created_at)) / 3600
      and public.lentes_en_cours(q.user_id) < 10
      and not exists (select 1 from public.defis d join public.games g on g.id = d.partie_id
                      where g.rated and g.status = 'active'
                        and ((g.black_id = p_uid and g.white_id = q.user_id) or (g.black_id = q.user_id and g.white_id = p_uid)))
    order by abs(q.rating - v_moi.rating), (q.size = v_moi.size and q.delai_jours = v_moi.delai_jours) desc, q.created_at
    limit 1
    for update skip locked;
  if v_q.user_id is null then return null; end if;

  if v_moi.created_at < v_q.created_at then v_regle := v_moi; else v_regle := v_q; end if;
  if random() < 0.5 then v_noir := p_uid; v_blanc := v_q.user_id; else v_noir := v_q.user_id; v_blanc := p_uid; end if;
  -- Le jeton n'est pas partagé (les deux joueurs sont placés) ; la colonne l'exige. Lien expiré d'emblée.
  v_jeton := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');
  insert into public.games (black_id, white_id, created_by, size, rules, komi, status, rated, prive)
    values (v_noir, v_blanc, p_uid, v_regle.size, 'japanese', 6.5, 'active', true, true)
    returning id into v_partie;
  insert into public.defis (partie_id, jeton, createur_id, invite_id, delai_coup, date_limite, lien_expire_le)
    values (v_partie, v_jeton, p_uid, v_q.user_id, make_interval(days => v_regle.delai_jours),
            now() + make_interval(days => v_regle.delai_jours), now());
  if p_present then
    delete from public.file_lente where user_id = p_uid;
  else
    update public.file_lente set partie_id = v_partie where user_id = p_uid;
  end if;
  update public.file_lente set partie_id = v_partie where user_id = v_q.user_id;
  -- Noir doit jouer : « À toi de jouer » sur l'accueil (notification dans l'app, #367), sauf s'il est devant l'écran.
  if not (p_present and v_noir = p_uid) then
    perform public.notifier(v_noir, 'tour', v_partie);
  end if;
  return v_partie;
end;
$$;
revoke execute on function public.lente_apparier(uuid, boolean) from public, anon, authenticated, service_role;

-- 6. Chercher une partie lente : entre dans la file (ou y met à jour sa demande), puis tente l'appariement. Renvoie la
--    partie si un adversaire attendait, sinon null : la recherche reste ouverte, sans limite de durée.
create or replace function public.chercher_partie_lente(p_size smallint default 9, p_delai_jours smallint default 1)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_rating integer;
  v_rd numeric;
begin
  if p_size is null or p_size not in (9, 13, 19) then raise exception 'Taille invalide' using errcode = '22023'; end if;
  if p_delai_jours is null or p_delai_jours not between 1 and 3 then raise exception 'Délai invalide' using errcode = '22023'; end if;
  -- Le verrou sur le profil sérialise les recherches d'un même joueur (limite de 10 parties).
  select rating, cote_rd into v_rating, v_rd from public.profiles where id = v_uid for update;
  if public.lentes_en_cours(v_uid) >= 10 then
    raise exception 'Tu as déjà 10 parties lentes en cours' using errcode = 'JGL10';
  end if;
  insert into public.file_lente (user_id, size, delai_jours, rating, rd)
    values (v_uid, p_size, p_delai_jours, v_rating, v_rd)
    on conflict (user_id) do update
      set created_at = case when public.file_lente.partie_id is null and public.file_lente.size = excluded.size
                                 and public.file_lente.delai_jours = excluded.delai_jours
                            then public.file_lente.created_at else now() end,
          size = excluded.size, delai_jours = excluded.delai_jours, rating = excluded.rating, rd = excluded.rd,
          partie_id = null;
  return public.lente_apparier(v_uid, true);
end;
$$;
revoke execute on function public.chercher_partie_lente(smallint, smallint) from public, anon;
grant execute on function public.chercher_partie_lente(smallint, smallint) to authenticated;
comment on function public.chercher_partie_lente(smallint, smallint) is
  'Issue #440 : entre dans la file lente (taille, 1 à 3 jours par coup) ou crée la partie lente classée. Compte avec pseudo, 10 en cours au plus.';

-- 7. Quitter la file lente : annuler la recherche, ou effacer « adversaire trouvé » une fois vu. Renvoie la partie
--    trouvée pendant l'attente (l'écran l'ouvre), ou null.
create or replace function public.quitter_file_lente()
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_partie uuid;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  delete from public.file_lente where user_id = v_uid returning partie_id into v_partie;
  return v_partie;
end;
$$;
revoke execute on function public.quitter_file_lente() from public, anon;
grant execute on function public.quitter_file_lente() to authenticated;
comment on function public.quitter_file_lente() is
  'Issue #440 : annule la recherche de partie lente ; rend la partie trouvée pendant l''attente, s''il y en a une.';

-- 8. Tâche planifiée : pertes au temps des parties lentes (sans attendre qu'un joueur ouvre la partie), puis
--    appariement des attentes devenues compatibles. Renvoie le nombre de parties finies et de parties créées.
create or replace function public.lentes_tache()
returns table (finies integer, creees integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_finies integer := 0;
  v_creees integer := 0;
begin
  for v_id in
    select d.partie_id from public.defis d join public.games g on g.id = d.partie_id
    where g.rated and g.status = 'active' and d.date_limite < now()
    order by d.date_limite
  loop
    if public.defi_constater_temps(v_id) is not null then v_finies := v_finies + 1; end if;
  end loop;
  for v_id in select user_id from public.file_lente where partie_id is null order by created_at loop
    if public.lente_apparier(v_id, false) is not null then v_creees := v_creees + 1; end if;
  end loop;
  return query select v_finies, v_creees;
end;
$$;
revoke execute on function public.lentes_tache() from public, anon, authenticated, service_role;
comment on function public.lentes_tache() is
  'Issue #440 : pertes au temps des parties lentes et appariement de la file lente. Tâche pg_cron toutes les 10 minutes.';

-- Tâche planifiée, si pg_cron est disponible (installé en production ; absent du Postgres jetable des tests).
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $s$select cron.schedule('parties-lentes', '3-59/10 * * * *', 'select public.lentes_tache()')$s$;
  end if;
end;
$cron$;
