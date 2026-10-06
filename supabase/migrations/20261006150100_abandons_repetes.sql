-- Issue #442 : freiner les abandons répétés (suite de #363, après les parties lentes de #440).
-- Règles : docs/game-design/partie-en-direct.md (section « Parties quittées ») et docs/game-design/partie-lente.md
-- (section « Parties laissées expirer »).
--
-- Ce qui compte comme une partie quittée (journal `abandons`, écrit par le seul déclencheur `games_journal_abandons`) :
-- - en direct, perte au temps (`B+T` / `W+T`) d'un joueur ABSENT : aucun signe de présence depuis plus de 60 s au
--   moment du constat (`direct_constater`, la tâche `direct_clore_abandonnees`, ou un coup arrivé après la chute). La
--   chute de la pendule d'un joueur présent ne compte pas : son dernier signe de vie a moins de 60 s ;
-- - en direct, partie annulée parce que le joueur qui devait jouer n'est jamais venu (absent depuis plus de 60 s) ;
-- - en direct, partie trouvée puis refusée (`refuser_partie_direct`, « Rester », #436) : notée à part (`refus`), elle
--   ne compte qu'à partir du troisième refus (« refus répété ») ;
-- - en partie lente (classée), délai par coup dépassé : perte au temps ou partie annulée avant un coup chacun
--   (`defi_constater_temps`, à la lecture, au coup suivant ou par la tâche `lentes_tache`).
-- Jamais : l'abandon propre (`resign_game`, `W+R` / `B+R`), le compte accepté, une partie contre l'IA, un défi entre
-- amis (non classé).
--
-- Sanction, toujours sans perte de cote supplémentaire :
-- - direct (`find_match`) : parties quittées comptées sur 7 jours glissants, parmi les 10 dernières parties en direct du
--   joueur (dix parties jouées jusqu'au bout effacent tout). 0 à 2 : rien (déconnexion rare). 3 : 5 minutes d'attente
--   après la dernière partie quittée ; 4 : 30 minutes ; 5 et plus : 24 heures. Pendant l'attente, `find_match` refuse
--   avec le code JGD01 (`detail` : fin de l'attente, ISO 8601 ; `hint` : minutes du délai) et personne n'est apparié
--   avec ce joueur ;
-- - parties lentes (`chercher_partie_lente`, `lente_apparier`) : parties laissées expirer sur 30 jours glissants. 0 ou 1 :
--   10 parties en cours au plus (inchangé). 2 : 5 au plus. 3 et plus : 2 au plus. Au plafond réduit, code JGL11
--   (`detail` : le plafond). Les parties déjà en cours continuent.
-- `etat_abandons()` rend au joueur son état (compteur, attente, plafond), pour que l'écran le dise avant qu'il cherche.
--
-- `find_match` est redéfinie EN ENTIER à partir de sa dernière forme (#363, 20261005220100_securite_signalements.sql :
-- conditions de blocage `est_bloque` gardées), de même `lente_apparier` (#363, même fichier) et `chercher_partie_lente`
-- (#440, 20261005200100_parties_lentes.sql), et `refuser_partie_direct` (#436, 20261005090100_file_jamais_vide.sql),
-- qui marque son refus pour le journal. Seules les conditions décrites ici sont ajoutées.
--
-- Sécurité : RLS sur `abandons` (chacun lit ses lignes, aucune écriture par l'app) ; fonctions `security definer` à
-- `search_path` vide ; fonctions internes et déclencheur fermés à l'app.
--
-- Données : aucune donnée existante supprimée ni modifiée ; le journal part de zéro (pas de reprise du passé : la
-- règle n'était pas annoncée). Les seuls DELETE sont dans le corps des fonctions : file d'attente du direct (comme
-- avant), file lente (comme avant), et purge de rétention du journal créé ici (90 jours, tâche quotidienne).
--
-- Codes d'erreur (lus par src/data/abandons.ts) :
--   JGD01 attente après des parties en direct quittées    JGL11 plafond de parties lentes réduit

-- 1. Journal des parties quittées ---------------------------------------------------------------------------------

create table public.abandons (
  id bigint generated always as identity primary key,
  joueur_id uuid not null references public.profiles(id) on delete cascade,
  partie_id uuid references public.games(id) on delete set null,
  file text not null check (file in ('direct', 'lente')),
  motif text not null check (motif in ('absence', 'jamais_venu', 'refus', 'delai')),
  cree_le timestamptz not null default now(),
  unique (joueur_id, partie_id)
);
comment on table public.abandons is
  'Issue #442 : parties quittées (direct : absence, jamais venu, refus ; lente : délai dépassé). Écrit par le déclencheur games_journal_abandons seulement ; chacun lit les siennes. Gardé 90 jours.';
comment on column public.abandons.motif is
  'absence : perte au temps sans signe de vie depuis 60 s ; jamais_venu : partie annulée, le joueur qui devait jouer n''est pas venu ; refus : partie trouvée refusée (#436) ; delai : partie lente laissée expirer.';
create index abandons_joueur_idx on public.abandons (joueur_id, file, cree_le);
create index abandons_date_idx on public.abandons (cree_le);
create index abandons_partie_idx on public.abandons (partie_id) where partie_id is not null;

alter table public.abandons enable row level security;
create policy "Lecture de ses propres abandons" on public.abandons
  for select to authenticated
  using (joueur_id = (select auth.uid()));
revoke all on public.abandons from anon;
revoke insert, update, delete, truncate, references, trigger on public.abandons from authenticated;

-- 2. Déclencheur : chaque fin de partie classée entre humains est examinée une fois (passage de « active » à « finie »
--    ou « annulée »). Il n'écrit que dans le journal ; il ne touche ni la partie ni la cote.
create or replace function public.games_journal_abandons()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  c_absence constant interval := interval '60 seconds';
  v_p public.parties_direct%rowtype;
  v_refus text := coalesce(current_setting('jeu.refus_direct', true), '');
  v_noir_trait boolean := (char_length(new.moves) / 2) % 2 = 0;
  v_noir boolean;
  v_vu timestamptz;
begin
  select * into v_p from public.parties_direct where partie_id = new.id;
  if found then
    if new.status = 'aborted' then
      if v_refus <> '' and v_refus in (new.id::text || ':' || new.black_id::text, new.id::text || ':' || new.white_id::text) then
        insert into public.abandons (joueur_id, partie_id, file, motif)
          values (split_part(v_refus, ':', 2)::uuid, new.id, 'direct', 'refus')
          on conflict do nothing;
        return null;
      end if;
      v_noir := v_noir_trait;
      v_vu := case when v_noir then v_p.noir_vu_le else v_p.blanc_vu_le end;
      if v_vu is null or v_vu < now() - c_absence then
        insert into public.abandons (joueur_id, partie_id, file, motif)
          values (case when v_noir then new.black_id else new.white_id end, new.id, 'direct', 'jamais_venu')
          on conflict do nothing;
      end if;
    elsif new.result in ('B+T', 'W+T') then
      v_noir := new.result = 'W+T';
      v_vu := case when v_noir then v_p.noir_vu_le else v_p.blanc_vu_le end;
      -- Joueur présent dont la pendule est tombée : il a donné signe de vie depuis moins de 60 s, rien n'est noté.
      if v_vu is null or v_vu < now() - c_absence then
        insert into public.abandons (joueur_id, partie_id, file, motif)
          values (case when v_noir then new.black_id else new.white_id end, new.id, 'direct', 'absence')
          on conflict do nothing;
      end if;
    end if;
    return null;
  end if;

  if new.rated and exists (select 1 from public.defis where partie_id = new.id) then
    if new.status = 'aborted' then
      -- Comme `defi_constater_temps` : qui devait répondre (l'autre, si des pierres mortes étaient proposées).
      v_noir := case when old.counting and old.dead_proposed_by is not null then old.dead_proposed_by = new.white_id
                     else v_noir_trait end;
    elsif new.result in ('B+T', 'W+T') then
      v_noir := new.result = 'W+T';
    end if;
    if v_noir is not null then
      insert into public.abandons (joueur_id, partie_id, file, motif)
        values (case when v_noir then new.black_id else new.white_id end, new.id, 'lente', 'delai')
        on conflict do nothing;
    end if;
  end if;
  return null;
end;
$$;
comment on function public.games_journal_abandons() is
  'Issue #442 : note dans `abandons` la partie quittée (direct : absence, jamais venu, refus ; lente : délai dépassé). Déclencheur.';
revoke execute on function public.games_journal_abandons() from public, anon, authenticated, service_role;
create trigger games_journal_abandons after update on public.games
  for each row
  when (old.status = 'active' and new.status in ('finished', 'aborted') and new.bot_id is null)
  execute function public.games_journal_abandons();

-- 3. Règle du direct (interne) : parties quittées comptées et fin de l'attente. ---------------------------------------
--    Comptées : celles des 7 derniers jours parmi les 10 dernières parties en direct du joueur ; les refus à partir du
--    troisième. Délai : 3 → 5 min, 4 → 30 min, 5 et plus → 24 h, à partir de la dernière partie quittée.
create or replace function public.abandons_direct(p_uid uuid)
returns table (abandons integer, dernier timestamptz, delai interval, jusqu_a timestamptz)
language sql stable security definer set search_path = ''
as $$
  with dernieres as (
    select d.partie_id from public.parties_direct d join public.games g on g.id = d.partie_id
    where p_uid in (g.black_id, g.white_id)
    order by d.cree_le desc
    limit 10
  ), comptes as (
    select (count(*) filter (where a.motif <> 'refus')
            + greatest(count(*) filter (where a.motif = 'refus') - 2, 0))::integer as n,
           max(a.cree_le) as dernier
    from public.abandons a
    where a.joueur_id = p_uid and a.file = 'direct' and a.cree_le > now() - interval '7 days'
      and a.partie_id in (select partie_id from dernieres)
  ), regle as (
    select n, dernier,
           case when n >= 5 then interval '24 hours' when n = 4 then interval '30 minutes'
                when n = 3 then interval '5 minutes' end as delai
    from comptes
  )
  select n, dernier, delai, case when dernier + delai > now() then dernier + delai end
  from regle;
$$;
comment on function public.abandons_direct(uuid) is
  'Issue #442 : parties en direct quittées (7 jours, 10 dernières parties, refus à partir du 3e), délai et fin de l''attente. Interne.';
revoke execute on function public.abandons_direct(uuid) from public, anon, authenticated, service_role;

create or replace function public.en_attente_abandons(p_uid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select jusqu_a is not null from public.abandons_direct(p_uid);
$$;
revoke execute on function public.en_attente_abandons(uuid) from public, anon, authenticated, service_role;

-- 4. Règle des parties lentes (interne) : plafond de parties en cours selon les parties laissées expirer en 30 jours.
create or replace function public.plafond_lentes(p_uid uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select case when n >= 3 then 2 when n = 2 then 5 else 10 end
  from (select count(*) as n from public.abandons
        where joueur_id = p_uid and file = 'lente' and cree_le > now() - interval '30 days') x;
$$;
comment on function public.plafond_lentes(uuid) is
  'Issue #442 : parties lentes en cours au plus (10 ; 5 après 2 parties laissées expirer en 30 jours ; 2 après 3). Interne.';
revoke execute on function public.plafond_lentes(uuid) from public, anon, authenticated, service_role;

-- 5. État du joueur, pour l'écran (Direct et Parties lentes) : compteur, attente, plafond, heure du serveur.
create or replace function public.etat_abandons()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_d record;
  v_lentes integer;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select * into v_d from public.abandons_direct(v_uid);
  select count(*) into v_lentes from public.abandons
    where joueur_id = v_uid and file = 'lente' and cree_le > now() - interval '30 days';
  return jsonb_build_object(
    'direct_abandons', v_d.abandons,
    'direct_jusqu_a', v_d.jusqu_a,
    'direct_delai_min', (extract(epoch from v_d.delai) / 60)::integer,
    -- Délai de la prochaine partie quittée : l'écran prévient avant (« encore une, et tu attendras 5 min »).
    'direct_prochain_min', case when v_d.abandons + 1 >= 5 then 1440 when v_d.abandons + 1 = 4 then 30
                                when v_d.abandons + 1 = 3 then 5 end,
    'lentes_expirees', v_lentes,
    'lentes_plafond', public.plafond_lentes(v_uid),
    'maintenant', now());
end;
$$;
comment on function public.etat_abandons() is
  'Issue #442 : parties quittées du joueur connecté (direct : compteur, attente ; lentes : expirées, plafond) et heure du serveur.';
revoke execute on function public.etat_abandons() from public, anon;
grant execute on function public.etat_abandons() to authenticated;

-- 6. Appariement en direct (forme de #363, 20261005220100_securite_signalements.sql), redéfini en entier : seules
--    l'attente après des parties quittées (refus JGD01) et la condition « l'adversaire n'est pas en attente » sont
--    ajoutées. La partie en direct déjà en cours est toujours rendue (le joueur peut y revenir).
create or replace function public.find_match(p_size smallint, p_cadence text default 'normale', p_regles text default 'japanese')
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  c_elargir constant interval := interval '30 seconds';
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_rating integer;
  v_rd numeric;
  v_depuis timestamptz;
  v_opp uuid;
  v_q record;
  v_taille smallint;
  v_cadence text;
  v_regles text;
  v_game uuid;
  v_noir uuid;
  v_c record;
  v_attente record;
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

  -- #442 : parties en direct quittées à répétition : attente avant une nouvelle recherche, dite à l'écran.
  select * into v_attente from public.abandons_direct(v_uid);
  if v_attente.jusqu_a is not null then
    raise exception 'Tu as quitté plusieurs parties. Tu pourras rejouer en direct bientôt.'
      using errcode = 'JGD01',
            detail = to_char(v_attente.jusqu_a at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            hint = (extract(epoch from v_attente.delai) / 60)::integer::text;
  end if;

  select rating, cote_rd into v_rating, v_rd from public.profiles where id = v_uid;
  -- Attentes abandonnées (plus de nouvelles depuis 30 s, ou plus de 10 minutes) : retirées de la file.
  delete from public.match_queue where vu_le < now() - interval '30 seconds' or created_at < now() - interval '10 minutes';
  select created_at into v_depuis from public.match_queue
    where user_id = v_uid and size = p_size and cadence = p_cadence and regles = p_regles;
  select q.user_id, q.size, q.cadence, q.regles, q.created_at into v_q from public.match_queue q
    where q.user_id <> v_uid
      and ((q.size = p_size and q.cadence = p_cadence and q.regles = p_regles)
           or now() - least(q.created_at, coalesce(v_depuis, now())) >= c_elargir)
      and abs(q.rating - v_rating) <= 100 + sqrt(q.rd * q.rd + v_rd * v_rd) / 2
                                       + 10 * extract(epoch from now() - least(q.created_at, coalesce(v_depuis, now())))
      and public.direct_en_cours(q.user_id) is null
      -- #363 : jamais apparié avec un joueur qu'on a bloqué, ou qui nous a bloqué.
      and not public.est_bloque(v_uid, q.user_id)
      -- #442 : jamais avec un joueur en attente après des parties quittées (resté dans la file avant son attente).
      and not public.en_attente_abandons(q.user_id)
    order by abs(q.rating - v_rating), (q.size = p_size and q.cadence = p_cadence and q.regles = p_regles) desc, q.created_at
    limit 1
    for update skip locked;
  v_opp := v_q.user_id;
  if v_opp is not null then
    -- Réglages de la partie : ceux de qui attendait depuis le plus longtemps (l'adversaire, sauf si l'appelant
    -- attendait avant lui avec ces réglages).
    if v_depuis is not null and v_depuis < v_q.created_at then
      v_taille := p_size; v_cadence := p_cadence; v_regles := p_regles;
    else
      v_taille := v_q.size; v_cadence := v_q.cadence; v_regles := v_q.regles;
    end if;
    select * into v_c from public.cadence_direct(v_cadence);
    delete from public.match_queue where user_id in (v_uid, v_opp);
    v_noir := case when random() < 0.5 then v_uid else v_opp end;
    insert into public.games (black_id, white_id, created_by, size, rules, status, rated)
      values (v_noir, case when v_noir = v_uid then v_opp else v_uid end, v_uid, v_taille, v_regles, 'active', true)
      returning id into v_game;
    insert into public.parties_direct (partie_id, cadence, main_ms, periodes, periode_ms, noir_ms, blanc_ms,
                                       noir_periodes, blanc_periodes, trait_depuis, noir_vu_le, blanc_vu_le)
      values (v_game, v_cadence, v_c.main_ms, v_c.periodes, v_c.periode_ms, v_c.main_ms, v_c.main_ms,
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
  'Issues #436, #363 et #442 : entre dans la file ou crée la partie classée en direct. Mêmes réglages d''abord ; après 30 s d''attente, ceux de qui attendait le plus. Cote Glicko-2. Jamais avec un joueur bloqué. Attente (JGD01) après des parties quittées. Compte avec pseudo.';

-- 7. Refuser une partie trouvée pendant le repli contre l'IA (forme de #436, 20261005090100_file_jamais_vide.sql),
--    redéfinie en entier : seule la marque du refus (`jeu.refus_direct`, le temps de la transaction) est ajoutée, pour
--    que le journal note un refus et non une absence.
create or replace function public.refuser_partie_direct(p_partie uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select * into v_game from public.games where id = p_partie for update;
  if not found or not exists (select 1 from public.parties_direct where partie_id = p_partie)
     or (v_uid is distinct from v_game.black_id and v_uid is distinct from v_game.white_id) then
    raise exception 'Partie introuvable' using errcode = 'P0002';
  end if;
  delete from public.match_queue where user_id = v_uid;
  if v_game.status <> 'active' then return false; end if;
  -- A-t-il déjà joué ? Noir joue le coup 1 (2 caractères), Blanc le coup 2 (4 caractères).
  if char_length(v_game.moves) >= (case when v_uid = v_game.black_id then 2 else 4 end) then return false; end if;
  -- #442 : le journal note un refus (compté à partir du troisième), pas une absence.
  perform set_config('jeu.refus_direct', p_partie::text || ':' || v_uid::text, true);
  update public.games set status = 'aborted', counting = false where id = p_partie;
  perform set_config('jeu.refus_direct', '', true);
  return true;
end;
$$;
revoke execute on function public.refuser_partie_direct(uuid) from public, anon;
grant execute on function public.refuser_partie_direct(uuid) to authenticated;
comment on function public.refuser_partie_direct(uuid) is
  'Issues #436 et #442 : refuse une partie en direct trouvée pendant le repli contre l''IA, avant d''y avoir joué. Partie annulée, sans cote ; noté comme refus (compté à partir du 3e).';

-- 8. Appariement des parties lentes (forme de #363, 20261005220100_securite_signalements.sql), redéfini en entier :
--    seul le plafond de parties en cours change (10 → `plafond_lentes`, pour les deux joueurs).
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
  -- #442 : plafond réduit après des parties laissées expirer.
  if not found or public.lentes_en_cours(p_uid) >= public.plafond_lentes(p_uid) then return null; end if;
  select q.* into v_q from public.file_lente q
    where q.user_id <> p_uid and q.partie_id is null
      and ((q.size = v_moi.size and q.delai_jours = v_moi.delai_jours)
           or now() - least(q.created_at, v_moi.created_at) >= c_elargir)
      and abs(q.rating - v_moi.rating) <= 100 + sqrt(q.rd * q.rd + v_moi.rd * v_moi.rd) / 2
                                          + 50 * extract(epoch from now() - least(q.created_at, v_moi.created_at)) / 3600
      and public.lentes_en_cours(q.user_id) < public.plafond_lentes(q.user_id)
      -- #363 : jamais apparié avec un joueur qu'on a bloqué, ou qui nous a bloqué.
      and not public.est_bloque(p_uid, q.user_id)
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
comment on function public.lente_apparier(uuid, boolean) is
  'Issues #440, #363 et #442 : apparie une attente de la file lente (cote Glicko-2, réglages, plafond de parties en cours). Jamais avec un joueur bloqué. Interne.';

-- 9. Chercher une partie lente (forme de #440, 20261005200100_parties_lentes.sql), redéfinie en entier : seul le
--    plafond change (10, ou moins après des parties laissées expirer : JGL11, `detail` = le plafond).
create or replace function public.chercher_partie_lente(p_size smallint default 9, p_delai_jours smallint default 1)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_rating integer;
  v_rd numeric;
  v_plafond integer;
begin
  if p_size is null or p_size not in (9, 13, 19) then raise exception 'Taille invalide' using errcode = '22023'; end if;
  if p_delai_jours is null or p_delai_jours not between 1 and 3 then raise exception 'Délai invalide' using errcode = '22023'; end if;
  -- Le verrou sur le profil sérialise les recherches d'un même joueur (limite de parties en cours).
  select rating, cote_rd into v_rating, v_rd from public.profiles where id = v_uid for update;
  v_plafond := public.plafond_lentes(v_uid);
  if public.lentes_en_cours(v_uid) >= v_plafond then
    if v_plafond < 10 then
      raise exception 'Tu as laissé expirer plusieurs parties lentes : % en cours au plus pour l''instant', v_plafond
        using errcode = 'JGL11', detail = v_plafond::text;
    end if;
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
  'Issues #440 et #442 : entre dans la file lente (taille, 1 à 3 jours par coup) ou crée la partie lente classée. Compte avec pseudo ; 10 en cours au plus, moins après des parties laissées expirer (JGL11).';

-- 10. Rétention : le journal sert 30 jours au plus à la règle ; gardé 90 jours (vérifications, réclamations), puis
--     effacé chaque nuit.
create or replace function public.purger_abandons()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from public.abandons where cree_le < now() - interval '90 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
comment on function public.purger_abandons() is 'Issue #442 : efface les parties quittées de plus de 90 jours. Tâche pg_cron quotidienne.';
revoke execute on function public.purger_abandons() from public, anon, authenticated, service_role;

do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $s$select cron.schedule('purger-abandons', '41 3 * * *', 'select public.purger_abandons()')$s$;
  end if;
end;
$cron$;
