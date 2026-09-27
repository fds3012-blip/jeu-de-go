-- Pseudo unique sans tenir compte des majuscules : "Florian" et "florian" ne peuvent pas coexister.
-- Le format (3 à 24 caractères, lettres, chiffres, _ et -) est déjà vérifié par la contrainte de profils_joueurs.
-- RLS reste active sur public.profiles (aucune règle d'accès modifiée).
create unique index profiles_username_lower_key on public.profiles (lower(username)) where username is not null;
comment on index public.profiles_username_lower_key is 'Unicité du pseudo sans tenir compte de la casse.';
