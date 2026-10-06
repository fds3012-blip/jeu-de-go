-- Issues #363 et #373 : sécurité avant d'attirer des inconnus (décision de Florian du 05/10).
--
-- 1. Signalements (#363) : « Nous écrire » (bug, idée, autre), « Cette réponse me semble fausse » (problème) et
--    « Signaler ce joueur » (depuis une partie ou « Mes amis »). Table `signalements` : l'auteur ne lit que les siens,
--    personne d'autre côté app (le joueur signalé ne voit rien, ni l'auteur ni le signalement). Écriture par la seule
--    fonction `signaler` (security definer) : compte avec pseudo, 10 signalements par 24 heures au plus, texte de
--    500 caractères au plus, un même joueur signalé une fois par 24 heures par le même auteur (les suivants sont
--    acceptés sans nouvelle ligne). Pas de modération automatique : l'équipe lit la table et la vue
--    `signalements_a_revoir` (joueur signalé par au moins deux comptes différents) dans Supabase
--    (docs/produit/signalements-et-blocage.md). Gardés 12 mois, puis effacés (tâche quotidienne).
-- 2. Blocage : `bloquer_joueur`, `debloquer_joueur`, `mes_blocages`. Un joueur bloqué ne peut plus te défier (défi
--    direct ou par lien), t'envoyer de demande d'ami, ni t'être apparié en partie en direct (`find_match`, redéfinie
--    ici en entier à partir de 20261005090100_file_jamais_vide.sql, seule la condition de blocage est ajoutée), ni en
--    partie lente (`lente_apparier`, redéfinie de même à partir de 20261005200100_parties_lentes.sql, #440). Ses
--    messages en partie ne te parviennent plus. Bloquer retire aussi le lien d'amitié ou la demande entre vous deux
--    (comme « Retirer »). Le joueur bloqué n'en est pas prévenu : il lit « Ce joueur n'est pas disponible » (JGB01),
--    le même refus quel que soit le sens du blocage.
-- 3. Messages en partie (#373) : 6 messages prédéfinis et 4 émotes de Mochi, jamais de texte libre. Table
--    `messages_partie` (code seulement), lue par les deux joueurs (sauf les messages d'un joueur qu'on a bloqué),
--    publiée en temps réel. Écriture par `dire_en_partie` : partie entre deux humains, en cours ou finie depuis moins
--    de 10 minutes, 10 messages par partie et par joueur, 3 secondes entre deux messages. Gardés 30 jours.
-- 4. Parties en direct abandonnées : tâche pg_cron chaque minute (`direct_clore_abandonnees`) qui applique la règle
--    d'absence de #360 (`direct_constater`) quand les deux joueurs sont partis : la partie ne reste plus « en cours ».
--
-- Sécurité : RLS sur les trois nouvelles tables, aucune écriture directe ; fonctions `security definer` à
-- `search_path` vide ; fonctions internes fermées à l'app ; vue `security_invoker`, fermée à l'app.
--
-- Données : aucune donnée existante supprimée. Les DELETE sont dans le corps des fonctions : file d'attente
-- (`match_queue`, comme avant), déblocage, lien d'amitié retiré par celui qui bloque, purges de rétention des tables
-- créées ici. Aucune cote touchée ici : la tâche planifiée passe par `direct_constater` (#360), qui appelle
-- `apply_game_rating` comme `pendule_direct`.
--
-- Codes d'erreur (lus par src/data/securite.ts) :
--   JGS01 10 signalements en 24 heures      JGS02 signalement mal formé (type, motif, texte, problème)
--   JGS03 tu ne peux pas te signaler        JGB01 ce joueur n'est pas disponible (blocage, un sens ou l'autre)
--   JGB02 tu ne peux pas te bloquer         JGB03 500 joueurs bloqués au plus
--   JGM01 10 messages dans cette partie     JGM02 message inconnu
--   JGM03 trop vite (3 s entre deux)        JGM04 partie finie depuis plus de 10 minutes

-- 1. Signalements -------------------------------------------------------------------------------------------------

create table public.signalements (
  id bigint generated always as identity primary key,
  auteur_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('joueur', 'probleme', 'bug', 'idee', 'autre')),
  cible_joueur_id uuid references public.profiles(id) on delete set null,
  partie_id uuid references public.games(id) on delete set null,
  probleme_id text check (probleme_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  motif text check (motif in ('triche', 'pseudo', 'antijeu', 'abandon', 'reponse_fausse', 'enonce', 'autre')),
  texte text check (char_length(texte) between 1 and 500),
  version_app text check (version_app ~ '^[A-Za-z0-9._+-]{1,40}$'),
  contexte jsonb check (jsonb_typeof(contexte) = 'object' and pg_column_size(contexte) <= 2048),
  statut text not null default 'nouveau' check (statut in ('nouveau', 'en_cours', 'traite', 'rejete')),
  note_equipe text check (char_length(note_equipe) <= 2000),
  cree_le timestamptz not null default now(),
  traite_le timestamptz
);
comment on table public.signalements is
  'Issue #363 : signalements (joueur, problème, bug, idée, autre). Écrits par signaler() seulement ; l''auteur lit les siens ; l''équipe lit tout dans Supabase. Gardés 12 mois.';
comment on column public.signalements.auteur_id is 'Auteur du signalement. Jamais montré au joueur signalé. Null si l''auteur a supprimé son compte.';
comment on column public.signalements.cible_joueur_id is 'Joueur signalé (type joueur). Null si son compte a été supprimé.';
comment on column public.signalements.contexte is 'Contexte technique facultatif (écran, langue, taille du plateau…), 2 Ko au plus. Jamais d''e-mail.';
comment on column public.signalements.statut is 'Suivi par l''équipe : nouveau, en_cours, traite, rejete (modifié dans Supabase, jamais par l''app).';
create index signalements_auteur_idx on public.signalements (auteur_id, cree_le);
create index signalements_cible_idx on public.signalements (cible_joueur_id) where cible_joueur_id is not null;
create index signalements_partie_idx on public.signalements (partie_id) where partie_id is not null;
create index signalements_date_idx on public.signalements (cree_le);

alter table public.signalements enable row level security;
create policy "Lecture de ses propres signalements" on public.signalements
  for select to authenticated
  using (auteur_id = (select auth.uid()));
revoke all on public.signalements from anon;
revoke insert, update, delete, truncate on public.signalements from authenticated;

-- Joueur signalé par au moins deux comptes différents, signalements non clos : à revoir par l'équipe en premier.
create view public.signalements_a_revoir with (security_invoker = true) as
  select s.cible_joueur_id,
         p.username as pseudo,
         count(*) as signalements,
         count(distinct s.auteur_id) as auteurs,
         array_agg(distinct s.motif) as motifs,
         min(s.cree_le) as premier,
         max(s.cree_le) as dernier
  from public.signalements s
  left join public.profiles p on p.id = s.cible_joueur_id
  where s.type = 'joueur' and s.cible_joueur_id is not null and s.statut in ('nouveau', 'en_cours')
  group by s.cible_joueur_id, p.username
  having count(distinct s.auteur_id) >= 2;
comment on view public.signalements_a_revoir is
  'Issue #363 : joueurs signalés par au moins deux comptes différents (signalements nouveaux ou en cours). Équipe seulement.';
revoke all on public.signalements_a_revoir from public, anon, authenticated;

-- Signaler. `p_type` : joueur (avec `p_partie` : l'adversaire de cette partie, ou `p_pseudo`), probleme (`p_probleme`),
-- bug, idee, autre (texte obligatoire). Renvoie vrai. Un même joueur signalé une seconde fois dans les 24 heures par
-- le même auteur : accepté sans nouvelle ligne (rien à gagner à insister).
create or replace function public.signaler(
  p_type text, p_motif text default null, p_texte text default null, p_pseudo text default null,
  p_partie uuid default null, p_probleme text default null, p_version text default null, p_contexte jsonb default null
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_texte text := nullif(btrim(coalesce(p_texte, '')), '');
  v_cible uuid;
  v_game public.games%rowtype;
begin
  if p_type is null or p_type not in ('joueur', 'probleme', 'bug', 'idee', 'autre') then
    raise exception 'Signalement mal formé' using errcode = 'JGS02';
  end if;
  if v_texte is not null and char_length(v_texte) > 500 then
    raise exception 'Message trop long (500 caractères au plus)' using errcode = 'JGS02';
  end if;
  -- Un signalement à la fois par compte : la limite ne se contourne pas en parallèle.
  perform 1 from public.profiles where id = v_uid for update;
  if (select count(*) from public.signalements where auteur_id = v_uid and cree_le > now() - interval '24 hours') >= 10 then
    raise exception 'Tu as déjà envoyé 10 signalements aujourd''hui' using errcode = 'JGS01';
  end if;

  if p_type = 'joueur' then
    if p_motif is null or p_motif not in ('triche', 'pseudo', 'antijeu', 'abandon', 'autre') then
      raise exception 'Motif inconnu' using errcode = 'JGS02';
    end if;
    if p_partie is not null then
      select * into v_game from public.games where id = p_partie;
      if not found or v_uid is distinct from v_game.black_id and v_uid is distinct from v_game.white_id then
        raise exception 'Partie introuvable' using errcode = 'P0002';
      end if;
      v_cible := case when v_game.black_id = v_uid then v_game.white_id else v_game.black_id end;
      if v_cible is null or v_game.bot_id is not null then
        raise exception 'Partie introuvable' using errcode = 'P0002';
      end if;
    else
      v_cible := public.joueur_par_pseudo(p_pseudo);
    end if;
    if v_cible = v_uid then
      raise exception 'Tu ne peux pas te signaler toi-même' using errcode = 'JGS03';
    end if;
    if exists (select 1 from public.signalements where auteur_id = v_uid and cible_joueur_id = v_cible
               and cree_le > now() - interval '24 hours') then
      return true;
    end if;
  elsif p_type = 'probleme' then
    if p_probleme is null or p_probleme !~ '^[A-Za-z0-9_-]{1,64}$'
       or p_motif is null or p_motif not in ('reponse_fausse', 'enonce', 'autre') then
      raise exception 'Signalement mal formé' using errcode = 'JGS02';
    end if;
  else
    if v_texte is null or p_motif is not null then
      raise exception 'Écris ton message' using errcode = 'JGS02';
    end if;
  end if;

  insert into public.signalements (auteur_id, type, cible_joueur_id, partie_id, probleme_id, motif, texte, version_app, contexte)
    values (v_uid, p_type, v_cible, case when p_type = 'joueur' then p_partie end,
            case when p_type = 'probleme' then p_probleme end, p_motif, v_texte,
            case when p_version ~ '^[A-Za-z0-9._+-]{1,40}$' then p_version end,
            case when jsonb_typeof(p_contexte) = 'object' and pg_column_size(p_contexte) <= 2048 then p_contexte end);
  return true;
end;
$$;
comment on function public.signaler(text, text, text, text, uuid, text, text, jsonb) is
  'Issue #363 : envoie un signalement (joueur, problème, bug, idée, autre). Compte avec pseudo, 10 par 24 heures.';
revoke execute on function public.signaler(text, text, text, text, uuid, text, text, jsonb) from public, anon;
grant execute on function public.signaler(text, text, text, text, uuid, text, text, jsonb) to authenticated;

-- 2. Blocage ------------------------------------------------------------------------------------------------------

create table public.blocages (
  bloqueur_id uuid not null references public.profiles(id) on delete cascade,
  bloque_id uuid not null references public.profiles(id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (bloqueur_id, bloque_id),
  check (bloqueur_id <> bloque_id)
);
comment on table public.blocages is
  'Blocages entre joueurs (#363) : le bloqué ne peut plus défier, demander en ami, être apparié en direct, ni écrire en partie. Écrits par bloquer_joueur / debloquer_joueur. Le bloqué ne le voit pas.';
create index blocages_bloque_idx on public.blocages (bloque_id, bloqueur_id);

alter table public.blocages enable row level security;
create policy "Lecture de ses propres blocages" on public.blocages
  for select to authenticated
  using (bloqueur_id = (select auth.uid()));
revoke all on public.blocages from anon;
revoke insert, update, delete, truncate on public.blocages from authenticated;

-- Blocage dans un sens ou dans l'autre (interne).
create or replace function public.est_bloque(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.blocages
                 where (bloqueur_id = p_a and bloque_id = p_b) or (bloqueur_id = p_b and bloque_id = p_a));
$$;
comment on function public.est_bloque(uuid, uuid) is 'Issue #363 : vrai si l''un des deux a bloqué l''autre. Interne.';
revoke execute on function public.est_bloque(uuid, uuid) from public, anon, authenticated, service_role;

-- Bloquer : par pseudo (« Mes amis ») ou par partie (l'adversaire). Retire le lien d'amitié ou la demande entre vous.
create or replace function public.bloquer_joueur(p_pseudo text default null, p_partie uuid default null)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_cible uuid;
  v_game public.games%rowtype;
begin
  if p_partie is not null then
    select * into v_game from public.games where id = p_partie;
    if not found or v_uid is distinct from v_game.black_id and v_uid is distinct from v_game.white_id then
      raise exception 'Partie introuvable' using errcode = 'P0002';
    end if;
    v_cible := case when v_game.black_id = v_uid then v_game.white_id else v_game.black_id end;
    if v_cible is null or v_game.bot_id is not null then raise exception 'Partie introuvable' using errcode = 'P0002'; end if;
  else
    v_cible := public.joueur_par_pseudo(p_pseudo);
  end if;
  if v_cible = v_uid then raise exception 'Tu ne peux pas te bloquer toi-même' using errcode = 'JGB02'; end if;
  perform 1 from public.profiles where id = v_uid for update;
  if exists (select 1 from public.blocages where bloqueur_id = v_uid and bloque_id = v_cible) then return true; end if;
  if (select count(*) from public.blocages where bloqueur_id = v_uid) >= 500 then
    raise exception 'Tu as déjà bloqué 500 joueurs' using errcode = 'JGB03';
  end if;
  insert into public.blocages (bloqueur_id, bloque_id) values (v_uid, v_cible);
  delete from public.friendships
    where (requester_id = v_uid and addressee_id = v_cible) or (requester_id = v_cible and addressee_id = v_uid);
  return true;
end;
$$;

create or replace function public.debloquer_joueur(p_pseudo text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_cible uuid;
begin
  select p.id into v_cible from public.blocages b join public.profiles p on p.id = b.bloque_id
    where b.bloqueur_id = v_uid and lower(p.username) = lower(btrim(coalesce(p_pseudo, '')));
  if v_cible is null then return false; end if;
  delete from public.blocages where bloqueur_id = v_uid and bloque_id = v_cible;
  return true;
end;
$$;

-- Joueurs bloqués : pseudo et date, jamais d'identifiant.
create or replace function public.mes_blocages()
returns table (pseudo text, depuis timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
begin
  return query
    select p.username, b.cree_le
    from public.blocages b join public.profiles p on p.id = b.bloque_id
    where b.bloqueur_id = v_uid and p.username is not null
    order by lower(p.username)
    limit 500;
end;
$$;

comment on function public.bloquer_joueur(text, uuid) is 'Issue #363 : bloque un joueur (par pseudo ou par partie) ; retire le lien d''amitié entre vous.';
comment on function public.debloquer_joueur(text) is 'Issue #363 : débloque un joueur par son pseudo.';
comment on function public.mes_blocages() is 'Issue #363 : joueurs bloqués, par pseudo seulement.';
revoke execute on function public.bloquer_joueur(text, uuid), public.debloquer_joueur(text), public.mes_blocages() from public, anon;
grant execute on function public.bloquer_joueur(text, uuid), public.debloquer_joueur(text), public.mes_blocages() to authenticated;

-- Défis (direct ou par lien) et demandes d'ami refusés entre deux joueurs dont l'un a bloqué l'autre. Déclencheurs :
-- `defier_ami`, `rejoindre_defi` et `demander_ami` ne sont pas réécrites.
create or replace function public.defis_blocage()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.invite_id is not null and new.createur_id is not null and public.est_bloque(new.createur_id, new.invite_id) then
    raise exception 'Ce joueur n''est pas disponible' using errcode = 'JGB01';
  end if;
  return new;
end;
$$;
revoke execute on function public.defis_blocage() from public, anon, authenticated, service_role;
create trigger defis_blocage before insert or update of invite_id on public.defis
  for each row execute function public.defis_blocage();

create or replace function public.friendships_blocage()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if public.est_bloque(new.requester_id, new.addressee_id) then
    raise exception 'Ce joueur n''est pas disponible' using errcode = 'JGB01';
  end if;
  return new;
end;
$$;
revoke execute on function public.friendships_blocage() from public, anon, authenticated, service_role;
create trigger friendships_blocage before insert on public.friendships
  for each row execute function public.friendships_blocage();

-- Appariement (forme de #436, 20261005090100_file_jamais_vide.sql), redéfini en entier : seule la condition
-- « ni l'un ni l'autre n'a bloqué l'autre » (`est_bloque`) est ajoutée au choix de l'adversaire.
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
      -- #363 : jamais apparié avec un joueur qu'on a bloqué, ou qui nous a bloqué.
      and not public.est_bloque(v_uid, q.user_id)
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
  'Issues #436 et #363 : entre dans la file ou crée la partie classée en direct. Mêmes réglages d''abord ; après 30 s d''attente, ceux de qui attendait le plus. Cote Glicko-2. Jamais avec un joueur bloqué. Compte avec pseudo.';

-- Appariement des parties lentes (forme de #440, 20261005200100_parties_lentes.sql), redéfini en entier : seule la
-- condition « ni l'un ni l'autre n'a bloqué l'autre » (`est_bloque`) est ajoutée au choix de l'adversaire. Sans elle, le
-- déclencheur `defis_blocage` refuserait la partie et ferait échouer la recherche ou la tâche `lentes_tache`.
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
  'Issues #440 et #363 : apparie une attente de la file lente (cote Glicko-2, réglages, 10 parties au plus). Jamais avec un joueur bloqué. Interne.';

-- 3. Messages en partie (#373) ------------------------------------------------------------------------------------

create table public.messages_partie (
  id bigint generated always as identity primary key,
  partie_id uuid not null references public.games(id) on delete cascade,
  auteur_id uuid not null references public.profiles(id) on delete cascade,
  code text not null check (code in ('bonne_partie', 'bien_joue', 'merci', 'joli_coup', 'oups', 'a_la_prochaine',
                                     'mochi_salut', 'mochi_content', 'mochi_fier', 'mochi_pensif')),
  envoye_le timestamptz not null default now()
);
comment on table public.messages_partie is
  'Issue #373 : messages prédéfinis et émotes en partie entre deux humains (un code, jamais de texte libre). Écrits par dire_en_partie() ; lus par les deux joueurs. Gardés 30 jours.';
create index messages_partie_partie_idx on public.messages_partie (partie_id, auteur_id, envoye_le);
create index messages_partie_auteur_idx on public.messages_partie (auteur_id);
create index messages_partie_date_idx on public.messages_partie (envoye_le);

alter table public.messages_partie enable row level security;
-- Les deux joueurs de la partie ; jamais les messages d'un joueur qu'on a bloqué.
create policy "Lecture par les deux joueurs" on public.messages_partie
  for select to authenticated
  using (exists (select 1 from public.games g
                 where g.id = partie_id and (select auth.uid()) in (g.black_id, g.white_id))
         and (auteur_id = (select auth.uid())
              or not exists (select 1 from public.blocages b
                             where b.bloqueur_id = (select auth.uid()) and b.bloque_id = auteur_id)));
revoke all on public.messages_partie from anon;
revoke insert, update, delete, truncate on public.messages_partie from authenticated;

create or replace function public.dire_en_partie(p_partie uuid, p_code text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
  v_autre uuid;
  v_dernier timestamptz;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_code is null or p_code not in ('bonne_partie', 'bien_joue', 'merci', 'joli_coup', 'oups', 'a_la_prochaine',
                                      'mochi_salut', 'mochi_content', 'mochi_fier', 'mochi_pensif') then
    raise exception 'Message inconnu' using errcode = 'JGM02';
  end if;
  select * into v_game from public.games where id = p_partie;
  if not found or v_game.bot_id is not null or v_game.black_id is null or v_game.white_id is null
     or (v_uid is distinct from v_game.black_id and v_uid is distinct from v_game.white_id) then
    raise exception 'Partie introuvable' using errcode = 'P0002';
  end if;
  if v_game.status not in ('active', 'finished', 'aborted')
     or (v_game.status <> 'active' and v_game.updated_at < now() - interval '10 minutes') then
    raise exception 'Cette partie est finie' using errcode = 'JGM04';
  end if;
  -- Un message à la fois par joueur : les limites ne se contournent pas en parallèle.
  perform 1 from public.profiles where id = v_uid for update;
  select max(envoye_le) into v_dernier from public.messages_partie where partie_id = p_partie and auteur_id = v_uid;
  if (select count(*) from public.messages_partie where partie_id = p_partie and auteur_id = v_uid) >= 10 then
    raise exception 'Tu as déjà envoyé 10 messages dans cette partie' using errcode = 'JGM01';
  end if;
  if v_dernier is not null and v_dernier > now() - interval '3 seconds' then
    raise exception 'Un message toutes les 3 secondes' using errcode = 'JGM03';
  end if;
  v_autre := case when v_game.black_id = v_uid then v_game.white_id else v_game.black_id end;
  -- L'adversaire t'a bloqué : rien n'est écrit, sans le dire (il ne le verrait pas de toute façon).
  if exists (select 1 from public.blocages where bloqueur_id = v_autre and bloque_id = v_uid) then return true; end if;
  insert into public.messages_partie (partie_id, auteur_id, code) values (p_partie, v_uid, p_code);
  return true;
end;
$$;
comment on function public.dire_en_partie(uuid, text) is
  'Issue #373 : message prédéfini ou émote en partie entre humains. 10 par partie et par joueur, 3 s entre deux, jusqu''à 10 min après la fin.';
revoke execute on function public.dire_en_partie(uuid, text) from public, anon;
grant execute on function public.dire_en_partie(uuid, text) to authenticated;

-- Temps réel : la bulle arrive chez l'adversaire sans relecture (RLS : les deux joueurs seulement).
alter publication supabase_realtime add table public.messages_partie;

-- 4. Purges de rétention et parties en direct abandonnées (tâches planifiées) ---------------------------------------

create or replace function public.purger_securite()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.signalements where cree_le < now() - interval '12 months';
  delete from public.messages_partie where envoye_le < now() - interval '30 days';
end;
$$;
comment on function public.purger_securite() is
  'Issues #363 et #373 : efface les signalements de plus de 12 mois et les messages en partie de plus de 30 jours. Tâche pg_cron quotidienne.';
revoke execute on function public.purger_securite() from public, anon, authenticated, service_role;

-- Parties en direct dont les deux joueurs ont disparu depuis plus de 60 s : la règle d'absence de #360 est appliquée
-- comme si l'adversaire resté l'avait constatée (`direct_constater`). En jeu : celui qui doit jouer perd au temps
-- (annulée avant le premier coup de chacun). Au comptage : celui qui est parti le premier perd (le dernier vu tient
-- le rôle du joueur resté). Au plus 200 parties par passage. Renvoie le nombre de parties closes.
create or replace function public.direct_clore_abandonnees()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_p record;
  v_n integer := 0;
begin
  for v_p in
    select g.id, g.black_id, g.white_id, d.noir_vu_le, d.blanc_vu_le
    from public.parties_direct d join public.games g on g.id = d.partie_id
    where g.status = 'active'
      and coalesce(greatest(d.noir_vu_le, d.blanc_vu_le), d.cree_le) < now() - interval '60 seconds'
    order by d.cree_le
    limit 200
  loop
    perform public.direct_constater(v_p.id, null);
    if exists (select 1 from public.games where id = v_p.id and status = 'active' and counting) then
      perform public.direct_constater(v_p.id,
        case when coalesce(v_p.noir_vu_le, '-infinity') >= coalesce(v_p.blanc_vu_le, '-infinity')
             then v_p.black_id else v_p.white_id end);
    end if;
    if exists (select 1 from public.games where id = v_p.id and status <> 'active') then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end;
$$;
comment on function public.direct_clore_abandonnees() is
  'Issue #363 : clôt les parties en direct dont les deux joueurs sont partis (règle d''absence de #360). Tâche pg_cron chaque minute.';
revoke execute on function public.direct_clore_abandonnees() from public, anon, authenticated, service_role;

-- Tâches planifiées, si pg_cron est disponible (installé sur le projet, version 1.6.4 ; absent du Postgres jetable
-- des tests). `cron.schedule` avec un nom existant remplace la tâche : rejouer la migration ne la double pas.
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $s$select cron.schedule('clore-parties-direct-abandonnees', '* * * * *', 'select public.direct_clore_abandonnees()')$s$;
    execute $s$select cron.schedule('purger-securite', '37 3 * * *', 'select public.purger_securite()')$s$;
  end if;
end;
$cron$;
