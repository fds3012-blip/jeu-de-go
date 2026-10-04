-- Issue #417 : cote de jeu visible, calculée en Glicko-2 par le serveur, et point de départ choisi une fois.
--
-- Règles (docs/game-design/cote.md) :
-- - Seules les parties classées entre humains comptent (`games.rated` et `bot_id is null`). Les parties contre les IA,
--   les défis, les problèmes et les leçons ne touchent pas cette cote. `puzzle_rating` et `cotes_a_mesure` : inchangés.
-- - `profiles.rating` reste la cote de jeu (même colonne, lue par la file d'attente et le classement) ; elle est
--   désormais tenue par Glicko-2 : écart de confiance `cote_rd`, volatilité `cote_vol`.
-- - Provisoire (« 1200 ? ») tant que `cote_rd` > 110 : colonne calculée `cote_provisoire`.
-- - Barème : 100 points = 1 grade, cote = 3000 − 100 × kyu (0 = 30e kyu, 3000 = 1er dan, 3800 = 9e dan).
-- - Départ choisi par le joueur avant sa première partie classée (`choisir_depart_cote`) : « Je découvre » 300,
--   « Je connais les règles » 800, « Je joue en club » : 3000 − 100 × kyu, du 25e kyu au 1er dan.
--
-- Le calcul est le même que src/go/cote.ts (mêmes constantes, mêmes arrondis), vérifié des deux côtés sur l'exemple de
-- Glickman et sur des parties de référence (src/go/cote.test.ts, supabase/tests/cote_glicko.test.sql).
--
-- Aucune donnée supprimée. Pas de nouvelle table (RLS déjà active sur profiles, rating_history, match_queue).
-- `resign_game` et `finish_game_by_score` ne changent pas : elles appellent toujours `apply_game_rating`, dont seul le
-- corps change (Elo K = 32 → Glicko-2).

-- 1. Colonnes de la cote

alter table public.profiles
  add column cote_rd numeric(6,2) not null default 350 check (cote_rd > 0 and cote_rd <= 350),
  add column cote_vol numeric(8,6) not null default 0.06 check (cote_vol > 0 and cote_vol < 1),
  add column cote_parties integer not null default 0 check (cote_parties >= 0),
  add column cote_maj_le timestamptz,
  add column cote_depart text check (cote_depart in ('decouvre', 'regles', 'club')),
  add column cote_depart_kyu smallint check (cote_depart_kyu between 0 and 25),
  add column cote_depart_le timestamptz,
  add column cote_provisoire boolean generated always as (cote_rd > 110) stored;
alter table public.profiles add constraint profiles_cote_depart_kyu
  check ((cote_depart = 'club') = (cote_depart_kyu is not null));
comment on column public.profiles.rating is
  'Cote de jeu (#417, Glicko-2), parties classées entre humains seulement. 100 points = 1 grade ; 3000 = 1er dan.';
comment on column public.profiles.cote_rd is 'Écart de confiance Glicko-2 (RD), de 50 à 350. Provisoire au-dessus de 110.';
comment on column public.profiles.cote_vol is 'Volatilité Glicko-2 (σ).';
comment on column public.profiles.cote_parties is 'Parties classées comptées dans la cote. Le départ ne se choisit plus après la première.';
comment on column public.profiles.cote_maj_le is 'Dernière partie classée comptée : l''écart de confiance grandit après 30 jours sans partie.';
comment on column public.profiles.cote_depart is 'Point de départ choisi (decouvre, regles, club), null si jamais choisi.';
comment on column public.profiles.cote_depart_kyu is 'Grade choisi à « Je joue en club » : kyu de 1 à 25, 0 pour le 1er dan.';
comment on column public.profiles.cote_provisoire is 'Cote provisoire (« 1200 ? ») : écart de confiance au-dessus de 110.';

-- Joueurs qui ont déjà des parties classées (ancienne cote Elo) : leur cote est gardée comme point de départ,
-- avec un écart de confiance qui baisse avec le nombre de parties déjà jouées.
update public.profiles p
  set cote_parties = h.n,
      cote_rd = greatest(110, 350 - 25 * h.n),
      cote_maj_le = h.derniere
  from (select user_id, count(*)::integer as n, max(created_at) as derniere
        from public.rating_history where kind = 'game' group by user_id) h
  where h.user_id = p.id;

-- Historique : écart de confiance et points gagnés ou perdus à chaque partie ; le départ choisi y est noté.
alter table public.rating_history
  add column rd numeric(6,2),
  add column ecart integer;
alter table public.rating_history drop constraint rating_history_kind_check;
alter table public.rating_history add constraint rating_history_kind_check check (kind in ('game', 'puzzle', 'depart'));
comment on column public.rating_history.ecart is 'Points gagnés (positif) ou perdus après une partie classée (#417).';
comment on column public.rating_history.rd is 'Écart de confiance après la partie ou le départ (#417).';

-- Une partie classée se joue entre humains (les parties contre les IA ne comptent pas). Vérifiée pour toute nouvelle
-- ligne ou modification ; les lignes existantes ne sont pas relues (not valid), rien n'est supprimé.
alter table public.games
  add constraint games_classee_entre_humains check (not rated or bot_id is null) not valid;
comment on constraint games_classee_entre_humains on public.games is
  'Issue #417 : une partie contre l''IA n''est jamais classée.';

-- File d'attente : l'écart de confiance sert à l'appariement.
alter table public.match_queue add column rd numeric(6,2) not null default 350;

-- 2. Glicko-2 (Glickman, « Example of the Glicko-2 system », 2013). Une période de classement contre une liste
--    d'adversaires ; renvoie les valeurs brutes (sans arrondi). Fonction pure.
create or replace function public.glicko2(
  p_cote double precision, p_rd double precision, p_vol double precision,
  p_adv_cotes double precision[], p_adv_rd double precision[], p_scores double precision[]
)
returns table (cote double precision, rd double precision, vol double precision)
language plpgsql immutable security invoker set search_path = ''
as $$
declare
  c_echelle constant double precision := 173.7178;
  c_tau constant double precision := 0.5;
  c_eps constant double precision := 0.000001;
  v_mu double precision := (p_cote - 1500) / c_echelle;
  v_phi double precision := p_rd / c_echelle;
  v_inv_v double precision := 0;
  v_somme double precision := 0;
  v_v double precision;
  v_delta double precision;
  v_ln_s2 double precision;
  v_xa double precision; v_xb double precision; v_xc double precision;
  v_fa double precision; v_fb double precision; v_fc double precision;
  v_k integer;
  v_i integer;
  v_g double precision; v_e double precision; v_muj double precision; v_phij double precision;
  v_sigma2 double precision; v_phi_etoile double precision; v_phi2 double precision;
  v_n integer := coalesce(cardinality(p_adv_cotes), 0);
begin
  if v_n = 0 then
    return query select p_cote, sqrt(v_phi * v_phi + p_vol * p_vol) * c_echelle, p_vol;
    return;
  end if;
  if cardinality(p_adv_rd) <> v_n or cardinality(p_scores) <> v_n then raise exception 'Tableaux de tailles différentes'; end if;
  for v_i in 1 .. v_n loop
    v_muj := (p_adv_cotes[v_i] - 1500) / c_echelle;
    v_phij := p_adv_rd[v_i] / c_echelle;
    v_g := 1 / sqrt(1 + 3 * v_phij * v_phij / (pi() * pi()));
    v_e := 1 / (1 + exp(-v_g * (v_mu - v_muj)));
    v_inv_v := v_inv_v + v_g * v_g * v_e * (1 - v_e);
    v_somme := v_somme + v_g * (p_scores[v_i] - v_e);
  end loop;
  v_v := 1 / v_inv_v;
  v_delta := v_v * v_somme;
  -- Volatilité : algorithme d'Illinois.
  v_ln_s2 := ln(p_vol * p_vol);
  v_xa := v_ln_s2;
  if v_delta * v_delta > v_phi * v_phi + v_v then
    v_xb := ln(v_delta * v_delta - v_phi * v_phi - v_v);
  else
    v_k := 1;
    while public.glicko2_f(v_ln_s2 - v_k * c_tau, v_ln_s2, v_delta, v_phi, v_v, c_tau) < 0 loop v_k := v_k + 1; end loop;
    v_xb := v_ln_s2 - v_k * c_tau;
  end if;
  v_fa := public.glicko2_f(v_xa, v_ln_s2, v_delta, v_phi, v_v, c_tau);
  v_fb := public.glicko2_f(v_xb, v_ln_s2, v_delta, v_phi, v_v, c_tau);
  v_i := 0;
  while abs(v_xb - v_xa) > c_eps and v_i < 100 loop
    v_xc := v_xa + (v_xa - v_xb) * v_fa / (v_fb - v_fa);
    v_fc := public.glicko2_f(v_xc, v_ln_s2, v_delta, v_phi, v_v, c_tau);
    if v_fc * v_fb <= 0 then v_xa := v_xb; v_fa := v_fb; else v_fa := v_fa / 2; end if;
    v_xb := v_xc; v_fb := v_fc;
    v_i := v_i + 1;
  end loop;
  v_sigma2 := exp(v_xa / 2);
  v_phi_etoile := sqrt(v_phi * v_phi + v_sigma2 * v_sigma2);
  v_phi2 := 1 / sqrt(1 / (v_phi_etoile * v_phi_etoile) + 1 / v_v);
  return query select (v_mu + v_phi2 * v_phi2 * v_somme) * c_echelle + 1500, v_phi2 * c_echelle, v_sigma2;
end;
$$;

-- Fonction f de l'algorithme d'Illinois (étape 5 de Glickman).
create or replace function public.glicko2_f(
  p_x double precision, p_a double precision, p_delta double precision, p_phi double precision, p_v double precision, p_tau double precision
)
returns double precision
language sql immutable security invoker set search_path = ''
as $$
  select exp(p_x) * (p_delta * p_delta - p_phi * p_phi - p_v - exp(p_x)) / (2 * power(p_phi * p_phi + p_v + exp(p_x), 2))
         - (p_x - p_a) / (p_tau * p_tau);
$$;

-- Écart de confiance après une absence : une période par tranche de 30 jours sans partie classée, plafond 350.
create or replace function public.cote_rd_apres_absence(p_rd numeric, p_vol numeric, p_depuis timestamptz, p_maintenant timestamptz)
returns double precision
language sql immutable security invoker set search_path = ''
as $$
  select case
    when p_depuis is null or floor(extract(epoch from p_maintenant - p_depuis) / 86400 / 30) < 1 then p_rd::double precision
    else least(350, sqrt(power(p_rd / 173.7178, 2) + floor(extract(epoch from p_maintenant - p_depuis) / 86400 / 30) * power(p_vol, 2)) * 173.7178)
  end;
$$;

revoke execute on function public.glicko2(double precision, double precision, double precision, double precision[], double precision[], double precision[]) from public, anon, authenticated;
revoke execute on function public.glicko2_f(double precision, double precision, double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.cote_rd_apres_absence(numeric, numeric, timestamptz, timestamptz) from public, anon, authenticated;

-- 3. Cote après une partie classée : remplace l'Elo (K = 32). Appelée par resign_game et finish_game_by_score.
--    Chaque joueur est mis à jour contre la cote d'avant-partie de l'autre. Une partie ne compte qu'une fois.
--    Arrondis : cote entière (bornée de 0 à 4000), RD au centième (plancher 50), volatilité au millionième.
create or replace function public.apply_game_rating(p_game uuid, p_winner uuid, p_loser uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_w public.profiles%rowtype;
  v_l public.profiles%rowtype;
  v_rd_w double precision;
  v_rd_l double precision;
  v_nw record;
  v_nl record;
  v_cote_w integer;
  v_cote_l integer;
begin
  if p_winner is null or p_loser is null or p_winner = p_loser then return; end if;
  select * into v_game from public.games where id = p_game;
  -- Parties contre les IA et parties non classées : jamais comptées.
  if not found or not v_game.rated or v_game.bot_id is not null then return; end if;
  if not (p_winner in (v_game.black_id, v_game.white_id) and p_loser in (v_game.black_id, v_game.white_id)) then
    raise exception 'Joueurs étrangers à la partie';
  end if;
  -- Verrous dans un ordre fixe (pas d'interblocage entre deux fins de partie simultanées).
  perform 1 from public.profiles where id in (p_winner, p_loser) order by id for update;
  if exists (select 1 from public.rating_history where game_id = p_game and kind = 'game') then return; end if;
  select * into v_w from public.profiles where id = p_winner;
  select * into v_l from public.profiles where id = p_loser;
  v_rd_w := public.cote_rd_apres_absence(v_w.cote_rd, v_w.cote_vol, v_w.cote_maj_le, now());
  v_rd_l := public.cote_rd_apres_absence(v_l.cote_rd, v_l.cote_vol, v_l.cote_maj_le, now());
  select * into v_nw from public.glicko2(v_w.rating, v_rd_w, v_w.cote_vol::double precision,
    array[v_l.rating::double precision], array[v_rd_l], array[1::double precision]);
  select * into v_nl from public.glicko2(v_l.rating, v_rd_l, v_l.cote_vol::double precision,
    array[v_w.rating::double precision], array[v_rd_w], array[0::double precision]);
  v_cote_w := least(4000, greatest(0, round(v_nw.cote::numeric)))::integer;
  v_cote_l := least(4000, greatest(0, round(v_nl.cote::numeric)))::integer;
  update public.profiles set rating = v_cote_w, cote_rd = greatest(50, round(v_nw.rd::numeric, 2)),
    cote_vol = round(v_nw.vol::numeric, 6), cote_parties = cote_parties + 1, cote_maj_le = now()
    where id = p_winner;
  update public.profiles set rating = v_cote_l, cote_rd = greatest(50, round(v_nl.rd::numeric, 2)),
    cote_vol = round(v_nl.vol::numeric, 6), cote_parties = cote_parties + 1, cote_maj_le = now()
    where id = p_loser;
  insert into public.rating_history (user_id, kind, rating, game_id, rd, ecart)
    select id, 'game', rating, p_game, cote_rd, rating - case when id = p_winner then v_w.rating else v_l.rating end
    from public.profiles where id in (p_winner, p_loser);
end;
$$;
revoke execute on function public.apply_game_rating(uuid, uuid, uuid) from public, anon, authenticated;
comment on function public.apply_game_rating(uuid, uuid, uuid) is
  'Issue #417 : Glicko-2 après une partie classée entre humains, une seule fois par partie. Interne.';

-- 4. Point de départ : choisi par le joueur (compte avec pseudo), modifiable tant qu'aucune partie classée n'est comptée.
--    Codes : JGR01 cote déjà lancée, JGR02 choix invalide, JGR03 partie classée en cours.
create or replace function public.choisir_depart_cote(p_depart text, p_kyu integer default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_cote integer;
  v_parties integer;
begin
  v_cote := case
    when p_depart = 'decouvre' and p_kyu is null then 300
    when p_depart = 'regles' and p_kyu is null then 800
    when p_depart = 'club' and p_kyu between 0 and 25 then 3000 - 100 * p_kyu
  end;
  if v_cote is null then raise exception 'Choix de départ invalide' using errcode = 'JGR02'; end if;
  select cote_parties into v_parties from public.profiles where id = v_uid for update;
  if v_parties > 0 then
    raise exception 'Ta cote est déjà lancée : le départ ne se change plus' using errcode = 'JGR01';
  end if;
  if exists (select 1 from public.games where rated and status = 'active' and v_uid in (black_id, white_id)) then
    raise exception 'Termine d''abord ta partie classée' using errcode = 'JGR03';
  end if;
  update public.profiles
    set rating = v_cote, cote_rd = 350, cote_vol = 0.06, cote_depart = p_depart,
        cote_depart_kyu = case when p_depart = 'club' then p_kyu end, cote_depart_le = now()
    where id = v_uid;
  update public.match_queue set rating = v_cote, rd = 350 where user_id = v_uid;
  insert into public.rating_history (user_id, kind, rating, rd, ecart) values (v_uid, 'depart', v_cote, 350, null);
  return v_cote;
end;
$$;
revoke execute on function public.choisir_depart_cote(text, integer) from public, anon;
grant execute on function public.choisir_depart_cote(text, integer) to authenticated;
comment on function public.choisir_depart_cote(text, integer) is
  'Issue #417 : départ de la cote (decouvre 300, regles 800, club 3000 − 100 × kyu de 25 à 0), avant la première partie classée.';

-- 5. Appariement par la cote Glicko-2 : écart accepté = 100 + la moitié de l'incertitude des deux joueurs
--    (√(RD₁² + RD₂²) / 2) + 10 points par seconde d'attente de l'autre joueur ; le plus proche en cote d'abord.
--    Deux nouveaux (RD 350) : ≈ 350 points ; deux joueurs sûrs (RD 60) : ≈ 140 points, un grade et demi.
create or replace function public.find_match(p_size smallint)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_rating integer;
  v_rd numeric;
  v_opp uuid;
  v_game uuid;
begin
  if p_size not in (9, 13, 19) then raise exception 'Taille invalide'; end if;
  select rating, cote_rd into v_rating, v_rd from public.profiles where id = v_uid;
  delete from public.match_queue where created_at < now() - interval '10 minutes';
  select q.user_id into v_opp from public.match_queue q
    where q.size = p_size and q.user_id <> v_uid
      and abs(q.rating - v_rating) <= 100 + sqrt(q.rd * q.rd + v_rd * v_rd) / 2 + 10 * extract(epoch from now() - q.created_at)
    order by abs(q.rating - v_rating), q.created_at
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
  insert into public.match_queue (user_id, size, rating, rd) values (v_uid, p_size, v_rating, v_rd)
    on conflict (user_id) do update set size = excluded.size, rating = excluded.rating, rd = excluded.rd, created_at = now();
  return null;
end;
$$;
revoke execute on function public.find_match(smallint) from public, anon;
grant execute on function public.find_match(smallint) to authenticated;
