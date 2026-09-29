-- #284 « Continuer » à ta mesure : cote interne du joueur pour un compte connecté.
--
-- Même modèle que src/app/coteJoueur.ts (Elo à K dégressif), calculé ici par le serveur : le client dit seulement
-- quel problème et quel résultat (premier essai réussi, raté, ou raté puis trouvé seul), jamais la cote (cf. #29).
-- La cote n'est jamais affichée (décision #137) : les fonctions répondent vrai ou faux, sans chiffre.
-- Elle est distincte de profiles.puzzle_rating (cote des problèmes classés, #40), qui reste inchangée.
--
-- Constantes (identiques à coteJoueur.ts) : départ 400, K = max(24, 160 × 12 / (12 + essais)), pas borné à ±200,
-- cote bornée à [0, 3000], score 1 (premier), 0,2 (aide), 0 (raté).
-- Règles : un problème compte une fois par jour (« Rejouer » ne compte pas) et plus jamais après une réussite ;
-- « aide » requalifie seulement l'échec du jour sur ce même problème, s'il est le dernier noté.
-- Le Go du jour et la Révision restent hors de ce calcul : c'est le client qui choisit d'appeler la fonction ;
-- s'il appelait à tort, le seul effet serait sur sa propre cote interne, jamais affichée ni classée.

create table public.cotes_a_mesure (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  cote double precision not null default 400 check (cote between 0 and 3000),
  essais integer not null default 0 check (essais >= 0),
  serie integer not null default 0 check (serie >= 0),
  dernier_probleme text,
  dernier_resultat text check (dernier_resultat in ('premier', 'aide', 'rate')),
  dernier_k double precision,
  dernier_attendu double precision,
  maj_le timestamptz not null default now()
);
alter table public.cotes_a_mesure enable row level security;
create policy "Voir sa propre cote à ta mesure" on public.cotes_a_mesure
  for select to authenticated using (user_id = (select auth.uid()));

create table public.essais_a_mesure (
  user_id uuid not null references public.profiles(id) on delete cascade,
  puzzle_id text not null references public.puzzles(id) on delete cascade,
  jour date not null,
  resultat text not null check (resultat in ('premier', 'aide', 'rate')),
  cote_avant double precision not null,
  cote_apres double precision not null,
  cree_le timestamptz not null default now(),
  primary key (user_id, puzzle_id, jour)
);
create index essais_a_mesure_puzzle_idx on public.essais_a_mesure (puzzle_id);
alter table public.essais_a_mesure enable row level security;
create policy "Voir ses propres essais à ta mesure" on public.essais_a_mesure
  for select to authenticated using (user_id = (select auth.uid()));

-- Aucune écriture directe : seules les fonctions ci-dessous écrivent (security definer).
revoke all on public.cotes_a_mesure, public.essais_a_mesure from anon;
revoke insert, update, delete, truncate, references, trigger on public.cotes_a_mesure, public.essais_a_mesure from authenticated;

-- Note le premier essai d'un problème (p_resultat 'premier' ou 'rate'), ou requalifie l'échec du jour en réussite
-- avec aide (p_resultat 'aide'). Vrai si la cote a été notée, faux si l'essai ne compte pas (déjà noté).
create or replace function public.noter_a_mesure(p_puzzle text, p_resultat text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  v_diff integer;
  v_owner uuid;
  e public.cotes_a_mesure%rowtype;
  v_k double precision;
  v_att double precision;
  v_new double precision;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Crée un compte pour garder ta cote' using errcode = '42501';
  end if;
  if p_resultat is null or p_resultat not in ('premier', 'aide', 'rate') then
    raise exception 'Résultat inconnu' using errcode = '22023';
  end if;
  select difficulty, owner_id into v_diff, v_owner from public.puzzles where id = p_puzzle;
  if not found or (v_owner is not null and v_owner <> v_uid) then raise exception 'Problème introuvable'; end if;

  -- Le verrou sur la ligne du joueur sérialise ses essais : deux appels simultanés ne comptent qu'une fois.
  insert into public.cotes_a_mesure (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into e from public.cotes_a_mesure where user_id = v_uid for update;

  if p_resultat = 'aide' then
    -- Raté au premier essai aujourd'hui, puis trouvé seul : on rend la part de cote, avec le K et la chance du premier essai.
    if e.dernier_probleme is distinct from p_puzzle or e.dernier_resultat is distinct from 'rate'
      or not exists (select 1 from public.essais_a_mesure
                     where user_id = v_uid and puzzle_id = p_puzzle and jour = v_jour and resultat = 'rate') then
      return false;
    end if;
    v_new := least(3000, greatest(0, e.cote
      + least(200, greatest(-200, e.dernier_k * (0.2 - e.dernier_attendu)))
      - least(200, greatest(-200, e.dernier_k * (0 - e.dernier_attendu)))));
    update public.cotes_a_mesure set cote = v_new, dernier_resultat = 'aide', maj_le = now() where user_id = v_uid;
    update public.essais_a_mesure set resultat = 'aide', cote_apres = v_new
      where user_id = v_uid and puzzle_id = p_puzzle and jour = v_jour;
    return true;
  end if;

  -- Premier essai : une fois par jour (« Rejouer » ne compte pas), plus jamais après une réussite.
  if exists (select 1 from public.essais_a_mesure
             where user_id = v_uid and puzzle_id = p_puzzle and (jour = v_jour or resultat in ('premier', 'aide'))) then
    return false;
  end if;
  v_k := greatest(24, 160.0 * 12 / (12 + e.essais));
  v_att := 1 / (1 + power(10::double precision, (v_diff - e.cote) / 400));
  v_new := least(3000, greatest(0, e.cote
    + least(200, greatest(-200, v_k * ((case when p_resultat = 'premier' then 1 else 0 end) - v_att)))));
  insert into public.essais_a_mesure (user_id, puzzle_id, jour, resultat, cote_avant, cote_apres)
    values (v_uid, p_puzzle, v_jour, p_resultat, e.cote, v_new);
  update public.cotes_a_mesure set
    cote = v_new,
    essais = e.essais + 1,
    serie = case when p_resultat = 'premier' then e.serie + 1 else 0 end,
    dernier_probleme = p_puzzle,
    dernier_resultat = p_resultat,
    dernier_k = v_k,
    dernier_attendu = v_att,
    maj_le = now()
  where user_id = v_uid;
  return true;
end;
$$;

-- Cote de l'appareil (ou du placement, #283) reprise à la création du compte : une seule fois, tant que le serveur
-- n'a noté aucun essai. Sans enjeu de triche : la cote n'est ni affichée ni classée ; bornes identiques à l'appareil.
create or replace function public.importer_cote_appareil(p_cote double precision, p_essais integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e public.cotes_a_mesure%rowtype;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Crée un compte pour garder ta cote' using errcode = '42501';
  end if;
  if p_cote is null or p_cote = 'NaN'::double precision or p_essais is null then
    raise exception 'Cote invalide' using errcode = '22023';
  end if;
  insert into public.cotes_a_mesure (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into e from public.cotes_a_mesure where user_id = v_uid for update;
  if e.essais > 0 then return false; end if;
  update public.cotes_a_mesure set
    cote = least(3000, greatest(0, p_cote)),
    essais = least(1000, greatest(0, p_essais)),
    serie = 0,
    maj_le = now()
  where user_id = v_uid;
  return true;
end;
$$;

revoke execute on function public.noter_a_mesure(text, text), public.importer_cote_appareil(double precision, integer) from public, anon;
grant execute on function public.noter_a_mesure(text, text), public.importer_cote_appareil(double precision, integer) to authenticated;
