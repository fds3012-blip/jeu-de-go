-- Issue #364 (« partager pour recruter », décision de Florian du 05/10) : lien vers la revue d'une partie, en lecture
-- seule. Le joueur rend publique UNE partie depuis son bilan ; l'ami qui ouvre `mochi-go.app/partie#JETON` la lit sans
-- compte. Rien d'autre n'est public : ni ses autres parties, ni son historique, ni son compte.
--
-- Pourquoi une table dédiée plutôt qu'une colonne `publique` sur `parties_perso` : `parties_perso` ne garde que les
-- parties de l'appareil (pas les défis ni le direct, qui vivent dans `games`), ne se lit que par son propriétaire, et
-- garde le SGF complet (noms, commentaires d'un import). Une partie partagée est une COPIE minimale, faite au moment
-- du partage : coups, taille, komi, handicap, résultat. Effacer la copie ne touche pas à la partie.
--
-- Règles :
-- - RLS active ; lecture directe de la table : seulement ses propres partages (aucune lecture par anon) ;
-- - aucune écriture directe : `partager_partie` (compte avec pseudo exigé, #343 : JGC01 / JGP01) crée le lien ;
-- - lecture publique seulement par le jeton, avec `lire_partie_partagee` (security definer, exécutable par anon) :
--   24 octets aléatoires (192 bits), impossible à deviner ; un jeton inconnu ou mal formé ne renvoie rien ;
-- - données publiques : la partie (SGF minimal, vérifié par `sgf_partageable` : aucune autre propriété SGF, donc ni
--   nom, ni commentaire, ni date, ni lieu), le pseudo du joueur (déjà public : profils lisibles par tous), le nom de
--   l'adversaire de l'échelle ou de l'ami (son pseudo), le coup du moment clé ;
-- - même partie partagée deux fois : même lien (empreinte SHA-256 du SGF, unique par joueur) ;
-- - 20 nouveaux liens par 24 heures (JGS01) et 200 au plus par joueur (JGS02) : contre l'usage comme hébergement ;
-- - `retirer_partie_partagee` : le joueur rend la partie privée ; le lien ne montre plus rien ;
-- - suppression du compte : clé étrangère en cascade vers auth.users (`delete_my_account` l'emporte).
--
-- Cette migration ne supprime, ne modifie et ne retire rien d'existant : une table, deux index, une politique et
-- quatre fonctions nouvelles.

create table public.parties_partagees (
  jeton text primary key check (jeton ~ '^[A-Za-z0-9_-]{32}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- SHA-256 (hexadécimal) du SGF : un second partage de la même partie rend le même lien.
  empreinte text not null check (empreinte ~ '^[0-9a-f]{64}$'),
  sgf text not null check (octet_length(sgf) <= 16384),
  taille smallint not null check (taille between 2 and 19),
  -- Camp du joueur qui partage (1 Noir, 2 Blanc) ; null pour une partie à deux sur le même appareil.
  joueur smallint check (joueur in (1, 2)),
  -- Adversaire de l'échelle (`Tigre`) ou pseudo de l'ami ; jamais un nom de fichier ni un nom réel.
  adversaire text check (adversaire ~ '^[A-Za-z0-9À-ÿ _''’.-]{1,24}$'),
  -- Coup du moment clé (0 : le début), montré d'abord à l'ami.
  coup smallint not null default 0 check (coup between 0 and 1000),
  cree_le timestamptz not null default now()
);

create unique index parties_partagees_user_empreinte_key on public.parties_partagees (user_id, empreinte);
create index parties_partagees_user_cree_le_idx on public.parties_partagees (user_id, cree_le desc);

alter table public.parties_partagees enable row level security;

-- Droits : rien pour les visiteurs ; un joueur connecté lit seulement ses partages (l'écriture passe par les fonctions).
revoke all on table public.parties_partagees from anon, authenticated;
grant select on table public.parties_partagees to authenticated;
grant all on table public.parties_partagees to service_role;

create policy "Parties partagées : lire les siennes" on public.parties_partagees
  for select to authenticated using (user_id = (select auth.uid()));

-- SGF minimal accepté : `(;GM[1]FF[4]CA[UTF-8]SZ[n]KM[x]RU[Japanese]…` puis les coups. Seules ces propriétés, avec des valeurs de
-- forme fixe : aucune place pour un nom, un commentaire ou une date. Interne (appelée par `partager_partie`).
create function public.sgf_partageable(p_sgf text)
returns boolean
language sql immutable set search_path = ''
as $$
  select p_sgf is not null
    and octet_length(p_sgf) <= 16384
    and p_sgf ~ '^\(;'
    and regexp_replace(p_sgf,
      '(GM\[1\]|FF\[4\]|CA\[UTF-8\]|SZ\[[0-9]{1,2}\]|KM\[-?[0-9]{1,3}(\.[0-9]{1,2})?\]|HA\[[0-9]\]|PL\[[BW]\]|RU\[(Japanese|Chinese)\]'
      || '|RE\[([BW]\+([0-9]{1,3}(\.[0-9]{1,2})?|R|T|F)|0|\?)\]|A[BW](\[[a-s]{2}\])+|[BW]\[([a-s]{2})?\]|[BW]\[tt\])',
      '', 'g') ~ '^[();[:space:]]*$';
$$;
comment on function public.sgf_partageable(text) is
  'Issue #364 : vrai si le SGF ne contient que les propriétés d''une partie partagée (coups, taille, komi, règles, handicap, résultat).';
revoke all on function public.sgf_partageable(text) from public, anon, authenticated;

-- Rend publique une partie du joueur : renvoie le jeton du lien (le même si cette partie est déjà partagée).
create function public.partager_partie(p_sgf text, p_taille smallint, p_joueur smallint, p_adversaire text, p_coup smallint)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_empreinte text;
  v_jeton text;
  v_adversaire text := nullif(btrim(p_adversaire), '');
begin
  if not public.sgf_partageable(p_sgf) then
    raise exception 'Partie illisible' using errcode = '22023';
  end if;
  if p_taille is null or p_taille not between 2 and 19 or p_sgf !~ ('SZ\[' || p_taille || '\]')
     or (p_joueur is not null and p_joueur not in (1, 2))
     or (v_adversaire is not null and v_adversaire !~ '^[A-Za-z0-9À-ÿ _''’.-]{1,24}$')
     or p_coup is null or p_coup not between 0 and 1000 then
    raise exception 'Partie illisible' using errcode = '22023';
  end if;
  v_empreinte := encode(extensions.digest(p_sgf, 'sha256'), 'hex');

  -- Un partage à la fois par joueur : les plafonds tiennent même avec deux appels simultanés.
  perform 1 from public.profiles p where p.id = v_uid for update;

  select s.jeton into v_jeton from public.parties_partagees s where s.user_id = v_uid and s.empreinte = v_empreinte;
  if v_jeton is not null then
    update public.parties_partagees s set coup = p_coup, adversaire = v_adversaire, joueur = p_joueur
      where s.jeton = v_jeton;
    return v_jeton;
  end if;

  if (select count(*) from public.parties_partagees s where s.user_id = v_uid and s.cree_le > now() - interval '24 hours') >= 20 then
    raise exception 'Tu as partagé 20 parties aujourd''hui. Reviens demain.' using errcode = 'JGS01';
  end if;
  if (select count(*) from public.parties_partagees s where s.user_id = v_uid) >= 200 then
    raise exception 'Tu as déjà 200 parties partagées.' using errcode = 'JGS02';
  end if;

  v_jeton := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');
  insert into public.parties_partagees (jeton, user_id, empreinte, sgf, taille, joueur, adversaire, coup)
  values (v_jeton, v_uid, v_empreinte, p_sgf, p_taille, p_joueur, v_adversaire, p_coup);
  return v_jeton;
end;
$$;
comment on function public.partager_partie(text, smallint, smallint, text, smallint) is
  'Issue #364 : rend publique une partie du joueur (compte avec pseudo), lisible seulement par son jeton. 20 par jour, 200 au plus.';
revoke all on function public.partager_partie(text, smallint, smallint, text, smallint) from public, anon;
grant execute on function public.partager_partie(text, smallint, smallint, text, smallint) to authenticated;

-- Lecture publique d'une partie partagée, par son seul jeton (sans compte). Rien pour un jeton inconnu ou mal formé.
create function public.lire_partie_partagee(p_jeton text)
returns table (sgf text, taille smallint, joueur smallint, adversaire text, coup smallint, pseudo text, cree_le timestamptz)
language sql stable security definer set search_path = ''
as $$
  select s.sgf, s.taille, s.joueur, s.adversaire, s.coup, p.username, s.cree_le
  from public.parties_partagees s
  left join public.profiles p on p.id = s.user_id
  where p_jeton ~ '^[A-Za-z0-9_-]{32}$' and s.jeton = p_jeton;
$$;
comment on function public.lire_partie_partagee(text) is
  'Issue #364 : partie partagée lue par son jeton, sans compte : SGF minimal, pseudo du joueur, adversaire, moment clé.';
revoke all on function public.lire_partie_partagee(text) from public;
grant execute on function public.lire_partie_partagee(text) to anon, authenticated;

-- Le joueur rend la partie privée : le lien ne montre plus rien. Vrai si un partage a été retiré.
create function public.retirer_partie_partagee(p_jeton text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_n int;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = 'JGC01'; end if;
  delete from public.parties_partagees s where s.jeton = p_jeton and s.user_id = v_uid;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;
comment on function public.retirer_partie_partagee(text) is
  'Issue #364 : le joueur retire le lien d''une de ses parties partagées.';
revoke all on function public.retirer_partie_partagee(text) from public, anon;
grant execute on function public.retirer_partie_partagee(text) to authenticated;
