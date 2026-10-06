-- Issue #449 : partager une étude (goban libre de #372) comme une partie (#364). Même lien `mochi-go.app/partie#JETON`,
-- même aperçu, même table : l'ami qui l'ouvre voit la position posée et sa variante, sans compte, puis une seule action
-- « Étudie-la avec Mochi » (une copie s'ouvre dans son écran d'étude).
--
-- Pourquoi la même table : une étude partagée est, comme une partie, une copie minimale en SGF (`sgf_partageable` : ni
-- nom, ni commentaire, ni date), lue par son seul jeton, retirée par `retirer_partie_partagee`, effacée avec le compte.
-- Il manquait seulement de savoir ce que le lien montre : la colonne `objet` (`partie` par défaut : lignes existantes
-- inchangées) le dit.
--
-- Règles (comme #364) :
-- - `partager_etude` (security definer) : compte avec pseudo exigé (JGC01 / JGP01) ; SGF minimal vérifié ; 9, 13 ou
--   19 lignes ; au moins une pierre posée ou un coup ; aucun résultat (une étude n'est pas une partie finie) ;
-- - même étude partagée deux fois : même lien (empreinte SHA-256 de `etude:` + SGF, distincte de la même suite de coups
--   partagée comme partie) ;
-- - plafonds communs avec les parties (la même table) : 20 nouveaux liens par 24 heures (JGS01), 200 au plus (JGS02) ;
-- - `lire_partage` (security definer, exécutable par anon) : comme `lire_partie_partagee`, avec `objet` en plus. Rien
--   pour un jeton inconnu ou mal formé. `lire_partie_partagee` reste telle quelle (applis déjà installées : elles
--   montrent une étude comme une partie à revoir, sans erreur).
--
-- Cette migration ne supprime, ne modifie et ne retire rien d'existant : une colonne avec valeur par défaut (lignes
-- existantes : `partie`) et deux fonctions nouvelles.

alter table public.parties_partagees
  add column objet text not null default 'partie' check (objet in ('partie', 'etude'));
comment on column public.parties_partagees.objet is
  'Issue #449 : ce que le lien montre : une partie (#364) ou une étude, position posée et variante (#372).';

-- Rend publique une étude du joueur : renvoie le jeton du lien (le même si cette étude est déjà partagée).
create function public.partager_etude(p_sgf text, p_taille smallint, p_coup smallint)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_empreinte text;
  v_jeton text;
begin
  if not public.sgf_partageable(p_sgf) then
    raise exception 'Étude illisible' using errcode = '22023';
  end if;
  if p_taille is null or p_taille not in (9, 13, 19) or p_sgf !~ ('SZ\[' || p_taille || '\]')
     -- Au moins une pierre posée (AB, AW) ou un coup de la variante ; aucun résultat.
     or p_sgf !~ '(A[BW]\[[a-s]{2}\]|;[BW]\[)' or p_sgf ~ 'RE\['
     or p_coup is null or p_coup not between 0 and 1000 then
    raise exception 'Étude illisible' using errcode = '22023';
  end if;
  v_empreinte := encode(extensions.digest('etude:' || p_sgf, 'sha256'), 'hex');

  -- Un partage à la fois par joueur : les plafonds tiennent même avec deux appels simultanés.
  perform 1 from public.profiles p where p.id = v_uid for update;

  select s.jeton into v_jeton from public.parties_partagees s where s.user_id = v_uid and s.empreinte = v_empreinte;
  if v_jeton is not null then
    update public.parties_partagees s set coup = p_coup where s.jeton = v_jeton;
    return v_jeton;
  end if;

  if (select count(*) from public.parties_partagees s where s.user_id = v_uid and s.cree_le > now() - interval '24 hours') >= 20 then
    raise exception 'Tu as partagé 20 liens aujourd''hui. Reviens demain.' using errcode = 'JGS01';
  end if;
  if (select count(*) from public.parties_partagees s where s.user_id = v_uid) >= 200 then
    raise exception 'Tu as déjà 200 liens partagés.' using errcode = 'JGS02';
  end if;

  v_jeton := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');
  insert into public.parties_partagees (jeton, user_id, empreinte, sgf, taille, joueur, adversaire, coup, objet)
  values (v_jeton, v_uid, v_empreinte, p_sgf, p_taille, null, null, p_coup, 'etude');
  return v_jeton;
end;
$$;
comment on function public.partager_etude(text, smallint, smallint) is
  'Issue #449 : rend publique une étude du joueur (compte avec pseudo), lisible seulement par son jeton. Plafonds communs avec partager_partie.';
revoke all on function public.partager_etude(text, smallint, smallint) from public, anon;
grant execute on function public.partager_etude(text, smallint, smallint) to authenticated;

-- Lecture publique d'un partage (partie ou étude), par son seul jeton (sans compte). Rien pour un jeton inconnu.
create function public.lire_partage(p_jeton text)
returns table (objet text, sgf text, taille smallint, joueur smallint, adversaire text, coup smallint, pseudo text, cree_le timestamptz)
language sql stable security definer set search_path = ''
as $$
  select s.objet, s.sgf, s.taille, s.joueur, s.adversaire, s.coup, p.username, s.cree_le
  from public.parties_partagees s
  left join public.profiles p on p.id = s.user_id
  where p_jeton ~ '^[A-Za-z0-9_-]{32}$' and s.jeton = p_jeton;
$$;
comment on function public.lire_partage(text) is
  'Issue #449 : partage lu par son jeton, sans compte : objet (partie ou étude), SGF minimal, pseudo, adversaire, moment clé.';
revoke all on function public.lire_partage(text) from public;
grant execute on function public.lire_partage(text) to anon, authenticated;
