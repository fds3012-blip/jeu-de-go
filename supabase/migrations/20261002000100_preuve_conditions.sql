-- Preuve d'acceptation des conditions (décision D2 de docs/juridique/compte-obligatoire.md, suite de #343).
-- La case « J'ai 15 ans ou plus, ou un parent est d'accord. J'accepte les conditions et la politique » est cochée
-- partout où un compte naît. Le serveur garde la preuve (art. 5.2 et 7.1 RGPD) : date d'acceptation et version
-- des conditions acceptée, pour pouvoir redemander l'accord quand les conditions changent.
--
-- Cette migration :
-- 1. ajoute `conditions_acceptees_le` et `conditions_version` sur `profiles` ; le client ne peut PAS les écrire
--    directement (le droit `update` d'`authenticated` reste limité à la colonne `username`, voir
--    20260927190210_serie_protegee_gels.sql) ;
-- 2. ajoute `accepter_conditions(p_version)`, seule voie d'écriture : vrai compte (pas de session anonyme) qui
--    accepte pour lui-même, version au format AAAA-MM-JJ (date de la version des CGU, docs/juridique/cgu.md).
--    Même version déjà acceptée : la première date est gardée (c'est elle qui fait preuve). Nouvelle version :
--    date et version remplacées. Renvoie la date gardée.
--
-- Aucune donnée supprimée, aucune politique retirée, RLS inchangée, aucun calcul de cote touché.

alter table public.profiles
  add column conditions_acceptees_le timestamptz,
  add column conditions_version text
    check (conditions_version is null or conditions_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  add constraint profiles_conditions_ensemble
    check ((conditions_acceptees_le is null) = (conditions_version is null));
comment on column public.profiles.conditions_acceptees_le is
  'Date à laquelle le joueur a accepté les conditions (case d''âge et d''acceptation, D2). Écrite par accepter_conditions seule.';
comment on column public.profiles.conditions_version is
  'Version des conditions acceptée (date AAAA-MM-JJ de docs/juridique/cgu.md). Écrite par accepter_conditions seule.';

create or replace function public.accepter_conditions(p_version text)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_date timestamptz;
begin
  if v_uid is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or coalesce((select u.is_anonymous from auth.users u where u.id = v_uid), true) then
    raise exception 'Crée ton compte pour accepter les conditions' using errcode = 'JGC01';
  end if;
  if p_version is null or p_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Version des conditions invalide' using errcode = '22023';
  end if;
  update public.profiles p
    set conditions_acceptees_le = case when p.conditions_version = p_version then p.conditions_acceptees_le else now() end,
        conditions_version = p_version
    where p.id = v_uid
    returning conditions_acceptees_le into v_date;
  if v_date is null then
    raise exception 'Profil introuvable' using errcode = 'P0002';
  end if;
  return v_date;
end;
$$;
comment on function public.accepter_conditions(text) is
  'D2 (#343) : enregistre, pour le compte appelant, la date d''acceptation des conditions et leur version. Vrai compte seulement.';
revoke execute on function public.accepter_conditions(text) from public, anon, service_role;
grant execute on function public.accepter_conditions(text) to authenticated;
