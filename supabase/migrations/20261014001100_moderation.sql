-- Issue #531 (chantier C7) : sécurité avant l'ouverture au public. Modération côté serveur.
--
-- 1. Pseudos interdits (D8) : table `mots_interdits` (FR et EN : insultes, haine, sexe, usurpation de l'équipe),
--    fonction `pseudo_interdit` et déclencheur sur `profiles.username` (refus JGP02). Comparaison après
--    normalisation (minuscules, coupure aux majuscules et aux chiffres, chiffres qui imitent des lettres, lettres
--    répétées) et selon trois portées, pour éviter les faux positifs grossiers :
--      - `partout` : le mot peut être collé à d'autres (« GrosConnard ») ; réservé aux mots longs et sans ambiguïté ;
--      - `mot` : le mot doit être seul entre séparateurs (« Le_Con » refusé, « Falcon » ou « Conan » acceptés) ;
--      - `exact` : le pseudo entier (« Mochi », « Admin »).
--    `pseudo_autorise` (app) donne la réponse pendant la saisie ; le déclencheur reste la seule garantie.
--    Pseudos déjà pris : jamais modifiés d'office. Vue `pseudos_a_revoir` pour l'équipe, puis `renommer_pseudo`.
-- 2. Suspension d'un compte : table `suspensions`, fonctions `suspendre_joueur(pseudo, jours, motif)`,
--    `lever_suspension(pseudo)` et `renommer_pseudo(pseudo, nouveau)`, réservées au rôle de service (et à l'éditeur
--    SQL de Supabase). Pendant la suspension : refus JGU01 en file (direct et lente), en défi (créer, rejoindre,
--    défier un ami), en demande d'ami et en message de partie. L'adversaire d'un joueur suspendu lit le refus
--    habituel « Ce joueur n'est pas disponible » (JGB01). Contre l'ordi, leçons, problèmes : rien ne change. Une
--    partie déjà commencée se finit normalement.
--    Contrôle par déclencheurs sur `match_queue`, `file_lente`, `defis`, `games` (sièges), `messages_partie`,
--    `friendships` : aucune fonction d'un autre chantier n'est redéfinie. Ils ne refusent qu'au nom du joueur
--    connecté (`auth.uid()`), jamais dans une tâche planifiée ou la fonction `game-action` (pas de session) : une
--    tâche ne s'arrête jamais à cause d'un compte suspendu. Suspendre retire aussi le joueur des files d'attente.
-- 3. Journal des actions de l'équipe (`journal_moderation`) : suspendre, lever, renommer ; gardé 12 mois.
-- 4. Alerte à l'équipe : `reclamer_resume_signalements()` (rôle de service seulement) rend le nombre de
--    signalements arrivés depuis le dernier résumé, par type, et les joueurs signalés par au moins deux comptes. La
--    fonction serveur `alerte-signalements` l'envoie par e-mail (Resend) chaque matin, sans aucun texte libre ni
--    pseudo, avec un lien vers la vue. Sans e-mail configuré, la table `alertes_moderation` et la vue
--    `moderation_a_faire` suffisent (Supabase → Table Editor).
--
-- Sécurité : RLS sur chaque nouvelle table, aucune politique (accès par fonctions seulement : voulu, voir
-- docs/architecture/securite.md) ; fonctions `security definer` à `search_path` vide ; vues `security_invoker`,
-- fermées à l'app.
-- Données : aucune donnée existante supprimée ni modifiée. Les seuls DELETE : files d'attente du joueur suspendu
-- (une recherche en cours, pas une donnée du joueur) et purges de rétention des tables créées ici.
--
-- Codes d'erreur (lus par src/data/suspension.ts et src/data/username.ts) :
--   JGP02 pseudo refusé (mot interdit)
--   JGU01 ton compte est suspendu (`detail` = fin de la suspension en ISO 8601, vide si sans fin)
--   JGU02 action de modération mal formée (pseudo inconnu, durée, motif)

-- 1. Pseudos interdits -------------------------------------------------------------------------------------------

create table public.mots_interdits (
  mot text primary key check (mot ~ '^[a-z]{2,30}$'),
  portee text not null check (portee in ('partout', 'mot', 'exact')),
  categorie text not null check (categorie in ('insulte', 'haine', 'sexe', 'equipe')),
  -- Le mot sans lettre doublée se compare aussi au pseudo dont les doublons sont réduits (« fuuuck » → « fuck »).
  sans_double boolean generated always as (mot !~ '([a-z])\1') stored
);
comment on table public.mots_interdits is
  'Issue #531 (D8) : mots refusés dans les pseudos, FR et EN. Lue par pseudo_interdit() seulement ; l''équipe ajoute des mots par une migration.';
alter table public.mots_interdits enable row level security;
revoke all on public.mots_interdits from anon, authenticated;

insert into public.mots_interdits (mot, portee, categorie) values
  -- Français : insultes.
  ('connard', 'partout', 'insulte'), ('connasse', 'partout', 'insulte'), ('conasse', 'partout', 'insulte'),
  ('con', 'mot', 'insulte'), ('conne', 'mot', 'insulte'), ('salope', 'partout', 'insulte'),
  ('salaud', 'partout', 'insulte'), ('salopard', 'partout', 'insulte'), ('encule', 'partout', 'insulte'), ('enfoire', 'partout', 'insulte'),
  ('batard', 'partout', 'insulte'), ('pouffiasse', 'partout', 'insulte'), ('petasse', 'partout', 'insulte'),
  ('putain', 'partout', 'insulte'), ('pute', 'mot', 'insulte'), ('putes', 'mot', 'insulte'),
  ('fdp', 'mot', 'insulte'), ('ntm', 'mot', 'insulte'), ('niquetamere', 'partout', 'insulte'),
  ('niquetonpere', 'partout', 'insulte'), ('nique', 'mot', 'insulte'), ('trouduc', 'partout', 'insulte'),
  ('troudecul', 'partout', 'insulte'), ('merde', 'partout', 'insulte'), ('branleur', 'partout', 'insulte'),
  ('branleuse', 'partout', 'insulte'), ('abruti', 'mot', 'insulte'), ('debile', 'mot', 'insulte'),
  -- Français : haine.
  ('negre', 'mot', 'haine'), ('bougnoul', 'partout', 'haine'), ('bougnoule', 'partout', 'haine'),
  ('youpin', 'partout', 'haine'), ('bicot', 'mot', 'haine'), ('tafiole', 'partout', 'haine'),
  ('pedale', 'mot', 'haine'), ('pd', 'mot', 'haine'), ('sale', 'exact', 'haine'),
  -- Français : sexe.
  ('bite', 'mot', 'sexe'), ('couille', 'partout', 'sexe'), ('couilles', 'partout', 'sexe'),
  ('chatte', 'mot', 'sexe'), ('nichon', 'partout', 'sexe'), ('nichons', 'partout', 'sexe'),
  ('suceuse', 'partout', 'sexe'), ('suceur', 'mot', 'sexe'), ('branlette', 'partout', 'sexe'),
  ('pedophile', 'partout', 'sexe'), ('pedo', 'mot', 'sexe'), ('foutre', 'mot', 'sexe'),
  ('sexe', 'mot', 'sexe'), ('porno', 'partout', 'sexe'),
  -- Anglais : insultes.
  ('fuck', 'partout', 'insulte'), ('fucker', 'partout', 'insulte'), ('shit', 'mot', 'insulte'),
  ('bullshit', 'partout', 'insulte'), ('bitch', 'partout', 'insulte'), ('asshole', 'partout', 'insulte'),
  ('cunt', 'mot', 'insulte'), ('dick', 'mot', 'insulte'), ('dickhead', 'partout', 'insulte'),
  ('wanker', 'partout', 'insulte'), ('twat', 'mot', 'insulte'), ('bastard', 'partout', 'insulte'),
  ('moron', 'mot', 'insulte'), ('killyourself', 'partout', 'insulte'), ('kys', 'mot', 'insulte'),
  -- Anglais : haine.
  ('nigger', 'partout', 'haine'), ('nigga', 'partout', 'haine'), ('faggot', 'partout', 'haine'),
  ('fag', 'mot', 'haine'), ('retard', 'exact', 'haine'), ('hitler', 'partout', 'haine'),
  ('nazi', 'mot', 'haine'), ('siegheil', 'partout', 'haine'), ('heilhitler', 'partout', 'haine'),
  ('kukluxklan', 'partout', 'haine'),
  -- Anglais : sexe.
  ('cock', 'mot', 'sexe'), ('pussy', 'partout', 'sexe'), ('whore', 'partout', 'sexe'), ('slut', 'partout', 'sexe'),
  ('porn', 'mot', 'sexe'), ('penis', 'mot', 'sexe'), ('vagina', 'partout', 'sexe'), ('cum', 'mot', 'sexe'),
  ('jizz', 'partout', 'sexe'), ('dildo', 'partout', 'sexe'), ('rape', 'mot', 'sexe'), ('rapist', 'mot', 'sexe'),
  ('sex', 'mot', 'sexe'), ('sexy', 'mot', 'sexe'), ('horny', 'mot', 'sexe'), ('boobs', 'mot', 'sexe'),
  ('tits', 'mot', 'sexe'), ('pedophile', 'partout', 'sexe'), ('paedo', 'mot', 'sexe')
on conflict (mot) do nothing;
-- Usurpation de l'équipe ou de Mochi.
insert into public.mots_interdits (mot, portee, categorie) values
  ('admin', 'mot', 'equipe'), ('administrateur', 'partout', 'equipe'), ('administrator', 'partout', 'equipe'),
  ('moderateur', 'partout', 'equipe'), ('moderatrice', 'partout', 'equipe'), ('moderator', 'partout', 'equipe'),
  ('modo', 'mot', 'equipe'), ('staff', 'mot', 'equipe'), ('support', 'mot', 'equipe'),
  ('officiel', 'mot', 'equipe'), ('official', 'mot', 'equipe'), ('mochigo', 'partout', 'equipe'),
  ('mochi', 'exact', 'equipe'), ('equipe', 'exact', 'equipe'), ('team', 'exact', 'equipe'),
  ('systeme', 'exact', 'equipe'), ('system', 'exact', 'equipe'), ('root', 'exact', 'equipe')
on conflict (mot) do nothing;

-- Formes comparées d'un pseudo : mots (`jetons`) et pseudo collé (`colle`), lettres répétées 3 fois ou plus réduites
-- à deux (`*2`), ou toutes réduites à une (`*1`). Pure, sans lecture de table.
create or replace function public.pseudo_formes(p_pseudo text,
  out jetons2 text[], out colle2 text, out jetons1 text[], out colle1 text)
language plpgsql immutable set search_path = ''
as $$
declare
  v text := coalesce(p_pseudo, '');
begin
  -- Coupure au passage minuscule → majuscule (« GrosCon » → « Gros Con »), puis minuscules.
  v := lower(regexp_replace(v, '([a-z])([A-Z])', '\1 \2', 'g'));
  -- Chiffres qui imitent des lettres (« c0nnard », « 5alope ») ; les autres chiffres restent des séparateurs.
  v := translate(v, '013457', 'oieast');
  v := regexp_replace(v, '([a-z])\1\1+', '\1\1', 'g');
  jetons2 := array_remove(regexp_split_to_array(v, '[^a-z]+'), '');
  colle2 := array_to_string(jetons2, '');
  v := regexp_replace(v, '([a-z])\1+', '\1', 'g');
  jetons1 := array_remove(regexp_split_to_array(v, '[^a-z]+'), '');
  colle1 := array_to_string(jetons1, '');
end;
$$;
comment on function public.pseudo_formes(text) is
  'Issue #531 : formes normalisées d''un pseudo (mots et pseudo collé), pour la comparaison aux mots interdits.';

create or replace function public.pseudo_interdit(p_pseudo text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  f record;
begin
  if p_pseudo is null then return false; end if;
  f := public.pseudo_formes(p_pseudo);
  return exists (
    select 1 from public.mots_interdits m
    where (m.portee = 'partout' and (strpos(f.colle2, m.mot) > 0 or (m.sans_double and strpos(f.colle1, m.mot) > 0)))
       or (m.portee = 'mot' and (m.mot = any(f.jetons2) or m.mot = f.colle2
                                 or (m.sans_double and (m.mot = any(f.jetons1) or m.mot = f.colle1))))
       or (m.portee = 'exact' and (m.mot = f.colle2 or (m.sans_double and m.mot = f.colle1)))
  );
end;
$$;
comment on function public.pseudo_interdit(text) is
  'Issue #531 (D8) : vrai si le pseudo contient un mot interdit (table mots_interdits). Interne.';
revoke execute on function public.pseudo_interdit(text) from public, anon, authenticated;

-- Aide à la saisie (app) : vrai si le pseudo est accepté (format et mots). La disponibilité reste lue à part.
create or replace function public.pseudo_autorise(p_pseudo text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_pseudo is null or btrim(p_pseudo) !~ '^[A-Za-z0-9_-]{3,24}$' then return false; end if;
  return not public.pseudo_interdit(btrim(p_pseudo));
end;
$$;
comment on function public.pseudo_autorise(text) is
  'Issue #531 : aide à la saisie du pseudo (format et mots interdits). Le déclencheur de profiles reste la garantie.';
revoke execute on function public.pseudo_autorise(text) from public, anon;
grant execute on function public.pseudo_autorise(text) to authenticated;

-- Déclencheur : tout nouveau pseudo (création, changement par le joueur, renommage par l'équipe) est vérifié.
create or replace function public.profiles_pseudo_autorise()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.username is not null and new.username is distinct from (case when tg_op = 'UPDATE' then old.username end)
     and public.pseudo_interdit(new.username) then
    raise exception 'Ce pseudo n''est pas accepté' using errcode = 'JGP02';
  end if;
  return new;
end;
$$;
revoke execute on function public.profiles_pseudo_autorise() from public, anon, authenticated;
create trigger profiles_pseudo_autorise
  before insert or update of username on public.profiles
  for each row execute function public.profiles_pseudo_autorise();

-- 2. Suspensions -------------------------------------------------------------------------------------------------

create table public.suspensions (
  id bigint generated always as identity primary key,
  joueur_id uuid not null references public.profiles(id) on delete cascade,
  motif text not null check (char_length(btrim(motif)) between 3 and 500),
  debut timestamptz not null default now(),
  fin timestamptz check (fin is null or fin > debut),
  par text not null default session_user,
  levee_le timestamptz,
  levee_par text
);
comment on table public.suspensions is
  'Issue #531 : suspensions de comptes décidées par l''équipe (fin nulle = jusqu''à nouvel ordre). Écrites par suspendre_joueur et lever_suspension seulement. Effacées 12 mois après leur fin.';
comment on column public.suspensions.motif is 'Motif interne à l''équipe (jamais montré tel quel au joueur ni à un autre joueur).';
create index suspensions_joueur_idx on public.suspensions (joueur_id, fin);
alter table public.suspensions enable row level security;
revoke all on public.suspensions from anon, authenticated;

create table public.journal_moderation (
  id bigint generated always as identity primary key,
  action text not null check (action in ('suspendre', 'lever', 'renommer')),
  joueur_id uuid references public.profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  par text not null default session_user,
  cree_le timestamptz not null default now()
);
comment on table public.journal_moderation is
  'Issue #531 : journal des actions de l''équipe (suspendre, lever, renommer). Écrit par les fonctions de modération seulement. Gardé 12 mois.';
create index journal_moderation_date_idx on public.journal_moderation (cree_le);
alter table public.journal_moderation enable row level security;
revoke all on public.journal_moderation from anon, authenticated;

-- Fin de la suspension en cours : `null` si aucune ; `'infinity'` si elle est sans fin.
create or replace function public.fin_suspension(p_joueur uuid)
returns timestamptz
language sql stable security definer set search_path = ''
as $$
  select max(coalesce(s.fin, 'infinity'::timestamptz))
  from public.suspensions s
  where s.joueur_id = p_joueur and s.levee_le is null and s.debut <= now() and (s.fin is null or s.fin > now());
$$;
comment on function public.fin_suspension(uuid) is 'Issue #531 : fin de la suspension en cours (infinity si sans fin), ou null. Interne.';
revoke execute on function public.fin_suspension(uuid) from public, anon, authenticated;

-- Refus commun : le joueur connecté suspendu lit JGU01 (avec la fin) ; s'il s'agit de l'autre joueur, JGB01 comme
-- un blocage (rien n'est dit de la suspension d'un autre). Sans session (tâche planifiée, game-action) : rien.
create or replace function public.refuser_si_suspendu(p_joueurs uuid[])
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_fin timestamptz;
  v_j uuid;
begin
  if v_uid is null then return; end if;
  if v_uid = any(p_joueurs) then
    v_fin := public.fin_suspension(v_uid);
    if v_fin is not null then
      raise exception 'Ton compte est suspendu' using errcode = 'JGU01',
        detail = case when v_fin = 'infinity' then '' else to_char(v_fin at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end;
    end if;
  end if;
  foreach v_j in array p_joueurs loop
    if v_j is not null and v_j <> v_uid and public.fin_suspension(v_j) is not null then
      raise exception 'Ce joueur n''est pas disponible' using errcode = 'JGB01';
    end if;
  end loop;
end;
$$;
comment on function public.refuser_si_suspendu(uuid[]) is
  'Issue #531 : JGU01 si le joueur connecté est suspendu, JGB01 si un autre joueur de la liste l''est ; rien sans session. Interne.';
revoke execute on function public.refuser_si_suspendu(uuid[]) from public, anon, authenticated;

-- Déclencheurs : un par table, chacun lit ses colonnes.

create or replace function public.suspension_file()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.user_id = auth.uid() then perform public.refuser_si_suspendu(array[new.user_id]); end if;
  return new;
end;
$$;
revoke execute on function public.suspension_file() from public, anon, authenticated;
-- File du direct : à l'entrée et à chaque renouvellement par le joueur (find_match met à jour sa ligne).
create trigger match_queue_suspension
  before insert or update on public.match_queue
  for each row execute function public.suspension_file();
-- File lente : à l'entrée, ou quand le joueur relance une recherche (la tâche planifiée n'a pas de session).
create trigger file_lente_suspension
  before insert or update of size, delai_jours, created_at on public.file_lente
  for each row execute function public.suspension_file();

create or replace function public.suspension_defi()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.refuser_si_suspendu(array[new.createur_id, new.invite_id]);
  return new;
end;
$$;
revoke execute on function public.suspension_defi() from public, anon, authenticated;
create trigger defis_suspension
  before insert on public.defis
  for each row execute function public.suspension_defi();

-- Parties entre humains : à la création avec les deux joueurs, ou quand un siège vide est pris (lien de défi).
create or replace function public.suspension_partie()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.bot_id is null and new.black_id is not null and new.white_id is not null then
    perform public.refuser_si_suspendu(array[new.black_id, new.white_id]);
  end if;
  return new;
end;
$$;
revoke execute on function public.suspension_partie() from public, anon, authenticated;
create trigger games_suspension_creation
  before insert on public.games
  for each row execute function public.suspension_partie();
create trigger games_suspension_siege
  before update of black_id, white_id on public.games
  for each row
  when ((old.black_id is null and new.black_id is not null) or (old.white_id is null and new.white_id is not null))
  execute function public.suspension_partie();

create or replace function public.suspension_message()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.refuser_si_suspendu(array[new.auteur_id]);
  return new;
end;
$$;
revoke execute on function public.suspension_message() from public, anon, authenticated;
create trigger messages_partie_suspension
  before insert on public.messages_partie
  for each row execute function public.suspension_message();

create or replace function public.suspension_amitie()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.refuser_si_suspendu(array[new.requester_id, new.addressee_id]);
  return new;
end;
$$;
revoke execute on function public.suspension_amitie() from public, anon, authenticated;
create trigger friendships_suspension
  before insert on public.friendships
  for each row execute function public.suspension_amitie();

-- Identifiant d'un compte par son pseudo exact (sans casse), pour l'équipe. JGU02 s'il n'existe pas.
create or replace function public.moderation_joueur(p_pseudo text)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  select p.id into v_id from public.profiles p
    where p.username is not null and lower(p.username) = lower(btrim(coalesce(p_pseudo, '')));
  if v_id is null then raise exception 'Aucun joueur avec le pseudo « % »', p_pseudo using errcode = 'JGU02'; end if;
  return v_id;
end;
$$;
revoke execute on function public.moderation_joueur(text) from public, anon, authenticated;

-- Suspendre : `p_jours` de 1 à 3650, ou null (jusqu'à nouvel ordre). Une nouvelle suspension remplace la précédente.
-- Le joueur sort des files d'attente (direct et lente) ; ses parties en cours continuent.
create or replace function public.suspendre_joueur(p_pseudo text, p_jours integer, p_motif text)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := public.moderation_joueur(p_pseudo);
  v_fin timestamptz;
begin
  if p_jours is not null and p_jours not between 1 and 3650 then
    raise exception 'Durée de 1 à 3650 jours, ou null pour une suspension sans fin' using errcode = 'JGU02';
  end if;
  if p_motif is null or char_length(btrim(p_motif)) not between 3 and 500 then
    raise exception 'Motif obligatoire (3 à 500 caractères)' using errcode = 'JGU02';
  end if;
  v_fin := case when p_jours is null then null else now() + make_interval(days => p_jours) end;
  update public.suspensions set levee_le = now(), levee_par = session_user
    where joueur_id = v_id and levee_le is null and (fin is null or fin > now());
  insert into public.suspensions (joueur_id, motif, fin) values (v_id, btrim(p_motif), v_fin);
  delete from public.match_queue where user_id = v_id;
  delete from public.file_lente where user_id = v_id and partie_id is null;
  insert into public.journal_moderation (action, joueur_id, details)
    values ('suspendre', v_id, jsonb_build_object('pseudo', p_pseudo, 'jours', p_jours, 'motif', btrim(p_motif), 'fin', v_fin));
  return coalesce(v_fin, 'infinity'::timestamptz);
end;
$$;
comment on function public.suspendre_joueur(text, integer, text) is
  'Issue #531 : suspend un compte (jours de 1 à 3650, null = sans fin). Refus JGU01 en file, défi, demande d''ami et message. Rôle de service seulement.';
revoke execute on function public.suspendre_joueur(text, integer, text) from public, anon, authenticated;
grant execute on function public.suspendre_joueur(text, integer, text) to service_role;

create or replace function public.lever_suspension(p_pseudo text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := public.moderation_joueur(p_pseudo);
  v_n integer;
begin
  update public.suspensions set levee_le = now(), levee_par = session_user
    where joueur_id = v_id and levee_le is null and (fin is null or fin > now());
  get diagnostics v_n = row_count;
  insert into public.journal_moderation (action, joueur_id, details)
    values ('lever', v_id, jsonb_build_object('pseudo', p_pseudo, 'levees', v_n));
  return v_n;
end;
$$;
comment on function public.lever_suspension(text) is 'Issue #531 : lève la suspension en cours. Rôle de service seulement.';
revoke execute on function public.lever_suspension(text) from public, anon, authenticated;
grant execute on function public.lever_suspension(text) to service_role;

-- Renommer : `p_nouveau` null donne « Joueur-xxxxxx » (6 caractères au hasard). Mêmes règles que le joueur (format,
-- unicité sans casse, mots interdits) : le déclencheur s'applique aussi à l'équipe.
create or replace function public.renommer_pseudo(p_pseudo text, p_nouveau text default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := public.moderation_joueur(p_pseudo);
  v_avant text;
  v_nouveau text := nullif(btrim(coalesce(p_nouveau, '')), '');
begin
  select username into v_avant from public.profiles where id = v_id;
  if v_nouveau is null then
    v_nouveau := 'Joueur-' || substr(translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=', 'xyz'), 1, 6);
  end if;
  if v_nouveau !~ '^[A-Za-z0-9_-]{3,24}$' then
    raise exception 'Pseudo de 3 à 24 caractères : lettres sans accent, chiffres, _ et -' using errcode = 'JGU02';
  end if;
  update public.profiles set username = v_nouveau where id = v_id;
  insert into public.journal_moderation (action, joueur_id, details)
    values ('renommer', v_id, jsonb_build_object('avant', v_avant, 'apres', v_nouveau));
  return v_nouveau;
end;
$$;
comment on function public.renommer_pseudo(text, text) is
  'Issue #531 : change le pseudo d''un joueur (null = Joueur-xxxxxx). Mêmes règles que le joueur. Rôle de service seulement.';
revoke execute on function public.renommer_pseudo(text, text) from public, anon, authenticated;
grant execute on function public.renommer_pseudo(text, text) to service_role;

-- Pseudos déjà pris qui contiennent un mot interdit (créés avant cette migration) : à renommer par l'équipe.
create view public.pseudos_a_revoir with (security_invoker = true) as
  select p.id, p.username as pseudo, p.created_at
  from public.profiles p
  where p.username is not null and public.pseudo_interdit(p.username);
comment on view public.pseudos_a_revoir is 'Issue #531 : pseudos existants qui contiennent un mot interdit. Équipe seulement.';
revoke all on public.pseudos_a_revoir from public, anon, authenticated;

-- Suspensions en cours, pour l'équipe.
create view public.suspensions_en_cours with (security_invoker = true) as
  select s.id, p.username as pseudo, s.motif, s.debut, s.fin, s.par
  from public.suspensions s
  join public.profiles p on p.id = s.joueur_id
  where s.levee_le is null and s.debut <= now() and (s.fin is null or s.fin > now());
comment on view public.suspensions_en_cours is 'Issue #531 : suspensions en cours. Équipe seulement.';
revoke all on public.suspensions_en_cours from public, anon, authenticated;

-- 3. Alerte à l'équipe --------------------------------------------------------------------------------------------

create table public.alertes_moderation (
  id bigint generated always as identity primary key,
  depuis timestamptz not null,
  jusqua timestamptz not null default now(),
  nouveaux integer not null check (nouveaux >= 0),
  resume jsonb not null check (jsonb_typeof(resume) = 'object'),
  cree_le timestamptz not null default now()
);
comment on table public.alertes_moderation is
  'Issue #531 : résumés de signalements préparés pour l''équipe (nombres seulement, jamais de texte libre ni de pseudo). Gardés 12 mois.';
alter table public.alertes_moderation enable row level security;
revoke all on public.alertes_moderation from anon, authenticated;

-- Résumé des signalements arrivés depuis le précédent (ou depuis 24 heures la première fois), puis noté : deux appels
-- rapprochés ne comptent pas deux fois les mêmes signalements.
create or replace function public.reclamer_resume_signalements()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_depuis timestamptz;
  v_resume jsonb;
  v_nouveaux integer;
begin
  -- Un résumé à la fois.
  perform pg_advisory_xact_lock(hashtext('reclamer_resume_signalements'));
  select max(jusqua) into v_depuis from public.alertes_moderation;
  v_depuis := coalesce(v_depuis, now() - interval '24 hours');
  select count(*) into v_nouveaux from public.signalements where cree_le > v_depuis and cree_le <= now();
  select jsonb_build_object(
    'depuis', v_depuis,
    'jusqua', now(),
    'nouveaux', v_nouveaux,
    'par_type', coalesce((select jsonb_object_agg(type, n) from (
        select type, count(*) as n from public.signalements where cree_le > v_depuis and cree_le <= now() group by type) t),
      '{}'::jsonb),
    'joueurs_signales', (select count(distinct cible_joueur_id) from public.signalements
                          where cree_le > v_depuis and cree_le <= now() and cible_joueur_id is not null),
    'a_revoir', (select count(*) from public.signalements_a_revoir),
    'en_attente', (select count(*) from public.signalements where statut = 'nouveau'),
    'pseudos_a_revoir', (select count(*) from public.pseudos_a_revoir)
  ) into v_resume;
  insert into public.alertes_moderation (depuis, nouveaux, resume) values (v_depuis, v_nouveaux, v_resume);
  return v_resume;
end;
$$;
comment on function public.reclamer_resume_signalements() is
  'Issue #531 : nombres de signalements depuis le résumé précédent (par type, joueurs signalés, à revoir). Appelée par la fonction serveur alerte-signalements. Rôle de service seulement.';
revoke execute on function public.reclamer_resume_signalements() from public, anon, authenticated;
grant execute on function public.reclamer_resume_signalements() to service_role;

-- Tableau de bord de l'équipe, sans e-mail : ce qui attend une décision.
create view public.moderation_a_faire with (security_invoker = true) as
  select 'signalements_nouveaux'::text as quoi, count(*)::bigint as nombre from public.signalements where statut = 'nouveau'
  union all select 'joueurs_signales_par_2_comptes', count(*) from public.signalements_a_revoir
  union all select 'pseudos_a_revoir', count(*) from public.pseudos_a_revoir
  union all select 'suspensions_en_cours', count(*) from public.suspensions_en_cours;
comment on view public.moderation_a_faire is 'Issue #531 : ce qui attend l''équipe (nombres). Équipe seulement.';
revoke all on public.moderation_a_faire from public, anon, authenticated;

-- 4. Rétention ----------------------------------------------------------------------------------------------------

create or replace function public.purger_moderation()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.journal_moderation where cree_le < now() - interval '12 months';
  delete from public.alertes_moderation where cree_le < now() - interval '12 months';
  delete from public.suspensions
    where coalesce(levee_le, fin) is not null and coalesce(levee_le, fin) < now() - interval '12 months';
end;
$$;
comment on function public.purger_moderation() is
  'Issue #531 : efface le journal de modération et les résumés de plus de 12 mois, et les suspensions finies depuis plus de 12 mois. Tâche pg_cron quotidienne.';
revoke execute on function public.purger_moderation() from public, anon, authenticated;

do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $s$select cron.schedule('purger-moderation', '53 3 * * *', 'select public.purger_moderation()')$s$;
  end if;
end;
$cron$;
