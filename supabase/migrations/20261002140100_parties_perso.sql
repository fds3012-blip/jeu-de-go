-- Issue #358 (suite) : « Mes parties » synchronisées. Un joueur avec un compte retrouve sur un nouvel appareil ses
-- parties contre l'ordi, ses parties guidées, ses parties à deux et ses imports.
--
-- Pourquoi une table dédiée plutôt que des lignes dans `games` : `games` porte le jeu en ligne (coups au format
-- serveur limités à 2000 caractères, cotes, file d'attente, lecture publique des parties entre humains, purge des
-- anonymes, rattachement, suppression du compte qui y anonymise). Une partie gardée sur l'appareil est un fichier SGF
-- complet (handicap, import avec commentaires) qui ne doit jamais toucher aux cotes ni être visible d'un autre joueur.
-- Une table à part, lisible seulement par son propriétaire, est plus simple à garder sûre.
--
-- Règles :
-- - RLS active : chaque joueur ne lit que ses parties ; session anonyme refusée (politique restrictive) ;
-- - aucune écriture directe : l'envoi passe par `enregistrer_parties_perso`, qui exige un vrai compte avec pseudo
--   (`exiger_compte_avec_pseudo`, #343 : JGC01 / JGP01) ;
-- - doublons : `cle` est calculée sur l'appareil (SHA-256 de la date ISO et du SGF), unique par joueur ;
--   un renvoi ne crée rien (`on conflict do nothing`) ;
-- - 500 parties au plus par joueur, SGF de 64 Kio au plus, 50 parties au plus par envoi : au-delà, l'envoi est refusé
--   (code JGL01). Rien n'est retiré pour faire de la place ;
-- - suppression du compte : la clé étrangère vers auth.users est en cascade, `delete_my_account` (qui supprime
--   auth.users en dernier) emporte donc ces parties sans changement ;
-- - jamais de cote : aucune fonction de cote ne lit cette table.
--
-- Cette migration ne supprime, ne modifie et ne retire rien d'existant : une table, deux index, des politiques et
-- une fonction nouvelles.

create table public.parties_perso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Empreinte calculée sur l'appareil : SHA-256 (hexadécimal) de « date ISO + saut de ligne + SGF ».
  cle text not null check (cle ~ '^[0-9a-f]{64}$'),
  -- Fin de la partie (ou date de l'import).
  joue_le timestamptz not null,
  sgf text not null check (sgf like '(%' and octet_length(sgf) <= 65536),
  -- Les défis par lien restent dans `games` : ici, seulement les parties de l'appareil.
  mode text not null check (mode in ('ordi', 'guidee', 'deux', 'import')),
  taille smallint not null check (taille between 2 and 19),
  -- Camp du joueur (1 Noir, 2 Blanc) ; null pour une partie à deux sur le même appareil.
  joueur smallint check (joueur in (1, 2)),
  -- Adversaire de l'échelle (`pomme`…) ou nom du fichier importé.
  adversaire text check (char_length(adversaire) between 1 and 40),
  -- Résultat au format SGF (`B+6.5`, `W+R`, `0`).
  resultat text check (char_length(resultat) between 1 and 20),
  cree_le timestamptz not null default now()
);

create unique index parties_perso_user_cle_key on public.parties_perso (user_id, cle);
create index parties_perso_user_joue_le_idx on public.parties_perso (user_id, joue_le desc);

alter table public.parties_perso enable row level security;

-- Droits : rien pour les visiteurs ; un joueur connecté lit seulement (l'écriture passe par la fonction).
revoke all on table public.parties_perso from anon, authenticated;
grant select on table public.parties_perso to authenticated;
grant all on table public.parties_perso to service_role;

create policy "Parties perso : lire les siennes" on public.parties_perso
  for select to authenticated using (user_id = (select auth.uid()));

-- Session anonyme (#316, #343) : rien. Forme `(select auth.jwt())` reconnue par l'analyseur (20261002003100).
create policy "Anonyme : pas de parties perso" on public.parties_perso
  as restrictive for all to authenticated
  using (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true)
  with check (((select auth.jwt()) ->> 'is_anonymous')::boolean is not true);

-- Envoie des parties de l'appareil (1 à 50). Renvoie les clés désormais sur le serveur parmi celles envoyées
-- (ajoutées ou déjà là) : l'appareil sait lesquelles ne sont plus à envoyer. Une entrée mal formée est ignorée.
create function public.enregistrer_parties_perso(p_parties jsonb)
returns setof text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_max constant int := 500;
  v_n int;
  v_nouvelles int;
  v_envoi public.parties_perso[];
begin
  if p_parties is null or jsonb_typeof(p_parties) <> 'array' or jsonb_array_length(p_parties) not between 1 and 50 then
    raise exception 'Envoie entre 1 et 50 parties' using errcode = '22023';
  end if;

  -- Un envoi à la fois par joueur : le plafond ne peut pas être dépassé par deux envois simultanés.
  perform 1 from public.profiles p where p.id = v_uid for update;

  -- Entrées valides seulement (mêmes règles que la table), une par clé.
  select coalesce(array_agg(row(null, v_uid, x.cle, x.joue_le, x.sgf, x.mode, x.taille, x.joueur,
                                nullif(x.adversaire, ''), nullif(x.resultat, ''), now())::public.parties_perso), '{}')
    into v_envoi
  from (
    select distinct on (y.cle) y.*
    from jsonb_to_recordset(p_parties) as y(
      cle text, joue_le timestamptz, sgf text, mode text, taille smallint, joueur smallint, adversaire text, resultat text
    )
    where y.cle ~ '^[0-9a-f]{64}$'
      and y.joue_le between timestamptz '2000-01-01' and now() + interval '1 day'
      and y.sgf like '(%' and octet_length(y.sgf) <= 65536
      and y.mode in ('ordi', 'guidee', 'deux', 'import')
      and y.taille between 2 and 19
      and (y.joueur is null or y.joueur in (1, 2))
      and (y.adversaire is null or char_length(y.adversaire) <= 40)
      and (y.resultat is null or char_length(y.resultat) <= 20)
    order by y.cle
  ) x;

  select count(*) into v_n from public.parties_perso p where p.user_id = v_uid;
  select count(*) into v_nouvelles from unnest(v_envoi) e
    where not exists (select 1 from public.parties_perso p where p.user_id = v_uid and p.cle = e.cle);

  -- Plafond atteint : refusé. Sinon, les plus récentes d'abord, jusqu'au plafond.
  if v_nouvelles > 0 and v_n >= v_max then
    raise exception 'Tu as déjà % parties enregistrées', v_max using errcode = 'JGL01';
  end if;

  insert into public.parties_perso (user_id, cle, joue_le, sgf, mode, taille, joueur, adversaire, resultat)
  select v_uid, e.cle, e.joue_le, e.sgf, e.mode, e.taille, e.joueur, e.adversaire, e.resultat
  from unnest(v_envoi) e
  where not exists (select 1 from public.parties_perso p where p.user_id = v_uid and p.cle = e.cle)
  order by e.joue_le desc
  limit greatest(0, v_max - v_n)
  on conflict (user_id, cle) do nothing;

  return query
    select p.cle from public.parties_perso p
    where p.user_id = v_uid and p.cle in (select e.cle from unnest(v_envoi) e);
end;
$$;

comment on function public.enregistrer_parties_perso(jsonb) is
  'Issue #358 : garde sur le serveur les parties de l''appareil du joueur (compte avec pseudo). Sans doublon, 500 au plus.';

revoke all on function public.enregistrer_parties_perso(jsonb) from public, anon;
grant execute on function public.enregistrer_parties_perso(jsonb) to authenticated;
