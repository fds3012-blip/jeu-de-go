-- Issue #436 : plus jamais de file vide. Une seule file par défaut (9 × 9, cadence normale, comptage japonais : les
-- valeurs par défaut de l'écran et de find_match), et, après 30 secondes d'attente, les autres réglages sont acceptés.
--
-- Règles (docs/game-design/partie-en-direct.md, « File d'attente et appariement ») :
-- - Même taille, même cadence, même comptage : appariés tout de suite, comme avant (#360).
-- - Dès que l'un des deux attend depuis 30 s (la plus longue des deux attentes), les réglages peuvent différer. La partie
--   prend alors la taille, la cadence et le comptage de celui qui attendait depuis le plus longtemps.
-- - L'appariement par la cote Glicko-2 (#417) ne change pas : écart accepté = 100 + √(RD₁² + RD₂²) / 2 + 10 points par
--   seconde d'attente ; le plus proche en cote d'abord, puis les mêmes réglages, puis le plus ancien dans la file.
--
-- Repli contre l'IA (client, #436) : au bout de 25 s, le joueur peut jouer contre l'IA en restant dans la file (il
-- rappelle find_match pendant cette partie, qui n'est jamais classée). Si un humain arrive, la partie en direct est
-- créée comme d'habitude. Le joueur la rejoint, ou la refuse : `refuser_partie_direct` l'annule alors (statut
-- `aborted`, sans effet sur la cote, comme une absence avant le premier coup), tant qu'il n'y a pas joué.
--
-- Sécurité : fonctions `security definer` à `search_path` vide, compte avec pseudo exigé par find_match, nouvelle
-- fonction fermée à anon. Aucune table créée ni modifiée (RLS inchangée).
--
-- Données : aucune suppression de données de production. Les seuls DELETE portent sur la file d'attente
-- (`match_queue`), comme avant : purge des attentes abandonnées, sortie de la file à l'appariement ou au refus.
-- find_match garde sa signature (create or replace) : rien n'est retiré.

-- 1. Appariement (#436) : file par défaut, puis réglages élargis après 30 s d'attente.
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
  select q.user_id, q.size, q.cadence, q.regles, q.created_at into v_q from public.match_queue q
    where q.user_id <> v_uid
      and ((q.size = p_size and q.cadence = p_cadence and q.regles = p_regles)
           or now() - least(q.created_at, coalesce(v_depuis, now())) >= c_elargir)
      and abs(q.rating - v_rating) <= 100 + sqrt(q.rd * q.rd + v_rd * v_rd) / 2
                                       + 10 * extract(epoch from now() - least(q.created_at, coalesce(v_depuis, now())))
      and public.direct_en_cours(q.user_id) is null
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
  'Issue #436 : entre dans la file ou crée la partie classée en direct. Mêmes réglages d''abord ; après 30 s d''attente, ceux de qui attendait le plus. Cote Glicko-2. Compte avec pseudo.';

-- 2. Refuser une partie en direct trouvée pendant le repli contre l'IA (« Rester »). Seulement pour un de ses
--    joueurs, tant qu'il n'y a pas joué : Noir avant son premier coup, Blanc avant le sien. La partie est annulée
--    (`aborted`), aucune cote ne bouge, l'adversaire voit « Partie annulée ». Le joueur sort aussi de la file.
--    Renvoie vrai si la partie a été annulée, faux sinon (déjà finie, ou déjà jouée : la partie continue).
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
  update public.games set status = 'aborted', counting = false where id = p_partie;
  return true;
end;
$$;
revoke execute on function public.refuser_partie_direct(uuid) from public, anon;
grant execute on function public.refuser_partie_direct(uuid) to authenticated;
comment on function public.refuser_partie_direct(uuid) is
  'Issue #436 : refuse une partie en direct trouvée pendant le repli contre l''IA, avant d''y avoir joué. Partie annulée, sans cote.';
