-- Minimisation des données du profil et de celles reçues de Google (suite de #354 ; écart E18 de
-- docs/juridique/politique-confidentialite.md ; docs/growth/connexion-google-apple.md, 6.1).
--
-- 1. E18 : `avatar_url` et `country` n'ont jamais été utilisées par l'app (aucun écran ne les lit ni ne les écrit),
--    mais chaque joueur pouvait les modifier par l'API : adresse d'une image non modérée lisible par tous. Le droit
--    de mise à jour est retiré ; seul le pseudo reste modifiable par le joueur. Les colonnes restent (la vue
--    `leaderboard` lit `country`) et toujours lisibles ; elles ne contiennent rien d'écrit par l'app.
-- 2. Google envoie, à chaque connexion, le nom complet et l'adresse de la photo de profil. Supabase les garde dans
--    `auth.users.raw_user_meta_data` et `auth.identities.identity_data`, et les réécrit à chaque connexion. L'app
--    n'en fait rien : un déclencheur BEFORE INSERT OR UPDATE les retire à chaque écriture, sur les deux tables.
--    Gardés : identifiant du fournisseur (`sub`, `provider_id`, `iss`), e-mail et `email_verified`, `phone_verified`.
--    Retirés : `name`, `full_name`, `given_name`, `family_name`, `avatar_url`, `picture`.
--    Le pseudo n'est donc jamais pré-rempli avec le nom Google (il ne l'était pas : `handle_new_user` ne lit rien).
--
-- Le déclencheur sur `auth.identities` est posé dans un bloc qui tolère un refus de droit : sur Supabase, `postgres`
-- a le droit TRIGGER sur `auth.users` (déclencheur `on_auth_user_created`, en place depuis le début) ; s'il manquait
-- sur `auth.identities`, la migration passe quand même et le dit par un NOTICE (à vérifier sur une branche Supabase).
-- Aucune donnée de l'app supprimée, aucune politique retirée, RLS inchangée, aucun calcul de cote touché.

-- 1. Profil : seul le pseudo reste modifiable par le joueur.
revoke update (avatar_url, country) on public.profiles from authenticated;
comment on column public.profiles.avatar_url is
  'Non utilisée par l''app, non modifiable par le client (E18). À retirer si aucun écran ne l''adopte.';
comment on column public.profiles.country is
  'Non utilisée par l''app, non modifiable par le client (E18). Lue par la vue leaderboard.';

-- 2. Données reçues de Google : nom et photo retirés à chaque écriture.
create or replace function public.retirer_nom_et_photo(p_donnees jsonb)
returns jsonb
language sql immutable set search_path = ''
as $$
  select case when p_donnees is null then null
              else p_donnees - array['name', 'full_name', 'given_name', 'family_name', 'avatar_url', 'picture'] end;
$$;
comment on function public.retirer_nom_et_photo(jsonb) is
  'Minimisation (#354) : retire nom et photo transmis par Google ; garde identifiant, e-mail et indicateurs de vérification.';
revoke execute on function public.retirer_nom_et_photo(jsonb) from public, anon, authenticated, service_role;

create or replace function public.auth_users_minimiser()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.raw_user_meta_data := public.retirer_nom_et_photo(new.raw_user_meta_data);
  return new;
end;
$$;
revoke execute on function public.auth_users_minimiser() from public, anon, authenticated, service_role;
create trigger auth_users_minimiser before insert or update of raw_user_meta_data on auth.users
  for each row execute function public.auth_users_minimiser();

create or replace function public.auth_identities_minimiser()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.identity_data := public.retirer_nom_et_photo(new.identity_data);
  return new;
end;
$$;
revoke execute on function public.auth_identities_minimiser() from public, anon, authenticated, service_role;
do $trigger$
begin
  execute 'create trigger auth_identities_minimiser before insert or update of identity_data on auth.identities
             for each row execute function public.auth_identities_minimiser()';
exception when insufficient_privilege or undefined_table then
  raise notice 'Déclencheur auth_identities_minimiser non posé (%) : à poser depuis le tableau de bord Supabase.', sqlerrm;
end;
$trigger$;

-- Données déjà reçues avant cette migration : nettoyées une fois.
update auth.users set raw_user_meta_data = public.retirer_nom_et_photo(raw_user_meta_data)
  where raw_user_meta_data ?| array['name', 'full_name', 'given_name', 'family_name', 'avatar_url', 'picture'];
do $nettoyage$
begin
  execute $u$update auth.identities set identity_data = public.retirer_nom_et_photo(identity_data)
             where identity_data ?| array['name', 'full_name', 'given_name', 'family_name', 'avatar_url', 'picture']$u$;
exception when insufficient_privilege or undefined_table then
  raise notice 'auth.identities non nettoyée (%) : à faire depuis le tableau de bord Supabase.', sqlerrm;
end;
$nettoyage$;
