-- Minimisation des données reçues d'Apple et de Facebook (#411, suite de 20261002002100_minimisation_profil_google.sql).
--
-- Facebook envoie, en plus du nom et de la photo déjà retirés pour Google, un surnom (`nickname`) et parfois un
-- identifiant de profil (`slug`, `user_name`, `preferred_username` chez certains fournisseurs). Apple n'envoie le nom
-- qu'à la première connexion (`name`, `full_name`, déjà retirés). L'app n'utilise que l'e-mail : la fonction de
-- nettoyage, appelée par les déclencheurs `auth_users_minimiser` et `auth_identities_minimiser`, retire désormais aussi
-- ces champs. Gardés : identifiant chez le fournisseur (`sub`, `provider_id`, `iss`), e-mail, `email_verified`,
-- `phone_verified`, et `is_private_email` d'Apple (adresse relais : utile au support).
-- Aucune table créée (RLS inchangée), aucun droit ajouté : la fonction reste fermée à l'app.

create or replace function public.retirer_nom_et_photo(p_donnees jsonb)
returns jsonb
language sql immutable set search_path = ''
as $$
  select case when p_donnees is null then null
              else p_donnees - array['name', 'full_name', 'given_name', 'family_name', 'avatar_url', 'picture',
                                     'nickname', 'slug', 'user_name', 'preferred_username'] end;
$$;
comment on function public.retirer_nom_et_photo(jsonb) is
  'Minimisation (#354, #411) : retire nom, photo et surnom transmis par Google, Apple ou Facebook ; garde identifiant, e-mail et indicateurs de vérification.';
revoke execute on function public.retirer_nom_et_photo(jsonb) from public, anon, authenticated, service_role;

-- Données déjà reçues : nettoyées une fois (les déclencheurs font le reste à chaque écriture).
update auth.users set raw_user_meta_data = public.retirer_nom_et_photo(raw_user_meta_data)
  where raw_user_meta_data ?| array['nickname', 'slug', 'user_name', 'preferred_username'];
do $nettoyage$
begin
  execute $u$update auth.identities set identity_data = public.retirer_nom_et_photo(identity_data)
             where identity_data ?| array['nickname', 'slug', 'user_name', 'preferred_username']$u$;
exception when insufficient_privilege or undefined_table then
  raise notice 'auth.identities non nettoyée (%) : à faire depuis le tableau de bord Supabase.', sqlerrm;
end;
$nettoyage$;
