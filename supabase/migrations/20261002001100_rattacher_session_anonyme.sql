-- Rattacher une session sans compte au compte connecté (suite de #343, #353, #354).
--
-- Cas : un joueur a ouvert un défi par lien avant #343 (session anonyme, parties en cours), puis crée ou retrouve
-- son compte. Deux chemins existaient :
--   - relier un e-mail NEUF à la session anonyme (`updateUser`, type `email_change`) : même identifiant, rien à
--     déplacer ;
--   - l'adresse a DÉJÀ un compte (#353, `email_exists`) ou le joueur passe par Google (#354) : la nouvelle session a un
--     autre identifiant, et les parties de la session anonyme restaient orphelines jusqu'à la purge à 60 jours.
--
-- Risque : l'identifiant d'une session anonyme n'est PAS un secret (l'adversaire d'un défi le lit dans `games` et
-- `defis`). Une fonction `rattacher(ancien_id)` laisserait n'importe qui s'approprier les parties d'un anonyme.
-- Seule preuve sûre que l'appelant contrôlait la session anonyme : un code tiré PENDANT que cette session est
-- encore valide, par une fonction qui lit `auth.uid()` anonyme, puis présenté par le nouveau compte.
--
-- Mécanisme (deux fonctions, un code à usage unique) :
-- 1. `preparer_rattachement()` : appelée par la session ANONYME, juste avant « J'ai déjà un compte » ou
--    « Continuer avec Google ». Tire 24 octets aléatoires (code base64url de 32 caractères), garde seulement son
--    empreinte SHA-256 avec une expiration de 15 minutes (une ligne par anonyme, remplacée à chaque appel), et rend
--    le code au client, qui le garde sur l'appareil (stockage de session, `go.rattachement.v1`).
-- 2. `rattacher_session_anonyme(p_code)` : appelée par le VRAI compte une fois sa session ouverte. Vérifie l'empreinte,
--    l'expiration, que la session visée est encore anonyme, puis déplace vers le compte : parties (`games` :
--    créateur, Noir, Blanc, proposant des pierres mortes) et défis (`defis` : créateur, invité). Les défis en cours
--    suivent donc, avec leur date limite et leur jeton. Si le compte est déjà l'autre joueur de la partie (un joueur
--    qui s'était défié lui-même), la place de l'anonyme est vidée (comme à la purge), jamais dédoublée.
--    Puis la session anonyme est supprimée (profil et compte d'authentification), comme à la purge : le code est
--    consommé avec elle. Renvoie le nombre de parties déplacées.
--
-- Ce qui n'est pas déplacé : rien d'autre n'existe pour un anonyme (pas de cote, de badge, de leçon, d'ami, de
-- rappel : refusés par les politiques de 20260929100100_garde_anonymes.sql). Aucun calcul de cote (défis non classés).
-- Table `rattachements_anonymes` : RLS active, aucune politique, aucun droit pour l'app (lue et écrite par les deux
-- fonctions seules).

create table public.rattachements_anonymes (
  anonyme_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  expire_le timestamptz not null,
  cree_le timestamptz not null default now()
);
comment on table public.rattachements_anonymes is
  'Code à usage unique (empreinte SHA-256, 15 minutes) prouvant qu''un compte contrôlait une session anonyme. Écrit par preparer_rattachement, consommé par rattacher_session_anonyme.';
alter table public.rattachements_anonymes enable row level security;
revoke all on public.rattachements_anonymes from public, anon, authenticated, service_role;

-- 1. Côté session anonyme : tirer le code.
create or replace function public.preparer_rattachement()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  -- Réservé aux sessions anonymes : un vrai compte n'a rien à rattacher (source de vérité : auth.users).
  if not coalesce((select u.is_anonymous from auth.users u where u.id = v_uid), false) then
    raise exception 'Réservé aux sessions sans compte' using errcode = '42501';
  end if;
  v_code := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');
  insert into public.rattachements_anonymes (anonyme_id, code_hash, expire_le)
    values (v_uid, encode(extensions.digest(v_code, 'sha256'), 'hex'), now() + interval '15 minutes')
    on conflict (anonyme_id) do update
      set code_hash = excluded.code_hash, expire_le = excluded.expire_le, cree_le = now();
  return v_code;
end;
$$;
comment on function public.preparer_rattachement() is
  'Session anonyme : tire un code à usage unique (15 minutes) à présenter ensuite au compte pour récupérer ses parties.';
revoke execute on function public.preparer_rattachement() from public, anon, service_role;
grant execute on function public.preparer_rattachement() to authenticated;

-- 2. Côté vrai compte : présenter le code, récupérer parties et défis.
create or replace function public.rattacher_session_anonyme(p_code text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_anon uuid;
  v_parties integer := 0;
begin
  if v_uid is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or coalesce((select u.is_anonymous from auth.users u where u.id = v_uid), true) then
    raise exception 'Crée ton compte pour garder tes parties' using errcode = 'JGC01';
  end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{32}$' then
    raise exception 'Code de rattachement inconnu ou expiré' using errcode = 'P0002';
  end if;
  select r.anonyme_id into v_anon
    from public.rattachements_anonymes r
    where r.code_hash = encode(extensions.digest(p_code, 'sha256'), 'hex')
      and r.expire_le > now()
    for update;
  if v_anon is null then
    raise exception 'Code de rattachement inconnu ou expiré' using errcode = 'P0002';
  end if;
  -- La session visée doit être encore anonyme (un e-mail relié entre-temps en fait un vrai compte : rien à déplacer).
  -- (Le code reste inutilisable et expire de lui-même : une exception annule toute écriture de la fonction.)
  if v_anon = v_uid or not coalesce((select u.is_anonymous from auth.users u where u.id = v_anon), false) then
    raise exception 'Code de rattachement inconnu ou expiré' using errcode = 'P0002';
  end if;

  -- Parties : chaque place de l'anonyme passe au compte ; si le compte occupe déjà l'autre place, la place est vidée.
  update public.games g
    set created_by = case when g.created_by = v_anon then v_uid else g.created_by end,
        black_id = case when g.black_id = v_anon then (case when g.white_id = v_uid then null else v_uid end) else g.black_id end,
        white_id = case when g.white_id = v_anon then (case when g.black_id = v_uid then null else v_uid end) else g.white_id end,
        dead_proposed_by = case when g.dead_proposed_by = v_anon then v_uid else g.dead_proposed_by end
    where v_anon in (g.created_by, g.black_id, g.white_id, g.dead_proposed_by);
  get diagnostics v_parties = row_count;

  -- Défis : même règle (créateur, invité) ; la contrainte « invité distinct du créateur » reste vraie.
  update public.defis d
    set createur_id = case when d.createur_id = v_anon then (case when d.invite_id = v_uid then null else v_uid end) else d.createur_id end,
        invite_id = case when d.invite_id = v_anon then (case when d.createur_id = v_uid then null else v_uid end) else d.invite_id end
    where v_anon in (d.createur_id, d.invite_id);

  -- La session anonyme n'a plus rien : supprimée comme à la purge (#318). Le code part avec elle (cascade).
  delete from public.profiles where id = v_anon;
  delete from auth.users where id = v_anon and is_anonymous is true;
  return v_parties;
end;
$$;
comment on function public.rattacher_session_anonyme(text) is
  'Vrai compte : présente le code tiré par preparer_rattachement ; parties et défis de la session anonyme passent au compte, la session anonyme est supprimée. Renvoie le nombre de parties déplacées.';
revoke execute on function public.rattacher_session_anonyme(text) from public, anon, service_role;
grant execute on function public.rattacher_session_anonyme(text) to authenticated;
