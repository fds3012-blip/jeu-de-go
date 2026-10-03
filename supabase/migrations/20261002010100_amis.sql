-- Issue #359 : amis. Trouver un joueur par son pseudo exact, lui envoyer une demande, l'accepter ou la refuser,
-- retirer un ami, et défier un ami directement (sans lien).
--
-- La table `friendships` existe depuis 20260926235244_amis_et_recherche_adversaire.sql (RLS active, chacun ne lit que
-- ses relations). Cette migration :
-- 1. ferme l'écriture directe dans `friendships` : demandes, réponses et retraits passent par des fonctions
--    `security definer` (search_path vide) qui appliquent les règles anti-spam ; la lecture directe reste limitée par
--    la RLS à ses propres relations ;
-- 2. ajoute `demandes_ami_journal`, journal des demandes envoyées (qui, à qui, quand), fermé à l'app (RLS sans
--    politique, aucun droit), gardé 30 jours, effacé avec le compte (cascade) ;
-- 3. ajoute les fonctions `demander_ami`, `repondre_ami`, `retirer_ami`, `mes_amis` et `defier_ami`.
--
-- Règles (toutes côté serveur) :
-- - compte avec pseudo exigé (`exiger_compte_avec_pseudo`, codes JGC01 et JGP01 de #343) ;
-- - joueur visé trouvé par son pseudo exact, sans tenir compte des majuscules, et seulement s'il a un vrai compte ;
-- - pas de demande à soi-même, pas de doublon (une seule relation par paire, déjà garantie par friendships_pair_idx) ;
-- - 20 demandes par 24 heures au plus ; pas de nouvelle demande au même joueur pendant 7 jours (après un refus ou un
--   retrait) ;
-- - si l'autre t'a déjà envoyé une demande, la tienne l'accepte : vous êtes amis ;
-- - défier un ami : seulement un ami accepté, 3 défis en cours au plus contre lui.
--
-- Rien n'expose d'e-mail ni d'identifiant : les fonctions prennent et renvoient des pseudos. Aucune cote touchée
-- (le défi entre amis est non classé, comme le défi par lien). Aucune donnée supprimée.
--
-- Codes d'erreur (lus par src/data/amis.ts) :
--   JGA01 aucun joueur avec ce pseudo        JGA02 c'est ton propre pseudo
--   JGA03 vous êtes déjà amis                JGA04 demande déjà envoyée
--   JGA05 20 demandes en 24 heures           JGA06 demande à ce joueur il y a moins de 7 jours
--   JGA07 aucune demande de ce joueur        JGA08 ce joueur n'est pas ton ami
--   JGA09 déjà 3 défis en cours contre lui

-- 1. Écriture directe fermée : tout passe par les fonctions ci-dessous. Les politiques existantes restent (sans effet
--    sans le droit correspondant) ; la lecture de ses propres relations est inchangée.
revoke insert, update, delete on public.friendships from anon, authenticated;
revoke all on public.friendships from anon;

-- 2. Journal anti-spam
create table public.demandes_ami_journal (
  id bigint generated always as identity primary key,
  demandeur_id uuid not null references public.profiles(id) on delete cascade,
  destinataire_id uuid not null references public.profiles(id) on delete cascade,
  envoyee_le timestamptz not null default now()
);
comment on table public.demandes_ami_journal is
  'Demandes d''ami envoyées (issue #359) : limite de 20 par 24 heures, pas de relance du même joueur pendant 7 jours. Gardé 30 jours. Écrit par demander_ami seulement.';
create index demandes_ami_journal_demandeur_idx on public.demandes_ami_journal (demandeur_id, envoyee_le);
create index demandes_ami_journal_destinataire_idx on public.demandes_ami_journal (destinataire_id);
create index demandes_ami_journal_date_idx on public.demandes_ami_journal (envoyee_le);
alter table public.demandes_ami_journal enable row level security;
revoke all on public.demandes_ami_journal from anon, authenticated;

-- 3. Joueur par son pseudo exact (interne). Seulement un vrai compte avec pseudo.
create or replace function public.joueur_par_pseudo(p_pseudo text)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_pseudo text := btrim(coalesce(p_pseudo, ''));
  v_id uuid;
begin
  if v_pseudo !~ '^[A-Za-z0-9_-]{3,24}$' then
    raise exception 'Aucun joueur avec ce pseudo' using errcode = 'JGA01';
  end if;
  select p.id into v_id
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.username is not null and lower(p.username) = lower(v_pseudo)
      and coalesce(u.is_anonymous, false) = false;
  if v_id is null then
    raise exception 'Aucun joueur avec ce pseudo' using errcode = 'JGA01';
  end if;
  return v_id;
end;
$$;
comment on function public.joueur_par_pseudo(text) is 'Issue #359 : identifiant d''un vrai compte par son pseudo exact (sans casse). Interne.';
revoke execute on function public.joueur_par_pseudo(text) from public, anon, authenticated, service_role;

-- 4. Envoyer une demande. Renvoie 'envoyee', ou 'amis' si l'autre avait déjà demandé.
create or replace function public.demander_ami(p_pseudo text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_ami uuid := public.joueur_par_pseudo(p_pseudo);
  v_rel public.friendships%rowtype;
begin
  if v_ami = v_uid then
    raise exception 'C''est ton propre pseudo' using errcode = 'JGA02';
  end if;
  -- Une demande à la fois par joueur : les limites ci-dessous ne se contournent pas en parallèle.
  perform 1 from public.profiles where id = v_uid for update;

  select * into v_rel from public.friendships
    where (requester_id = v_uid and addressee_id = v_ami) or (requester_id = v_ami and addressee_id = v_uid)
    for update;
  if found then
    if v_rel.status = 'accepted' then
      raise exception 'Vous êtes déjà amis' using errcode = 'JGA03';
    end if;
    if v_rel.requester_id = v_uid then
      raise exception 'Demande déjà envoyée' using errcode = 'JGA04';
    end if;
    -- L'autre t'avait déjà demandé : ta demande vaut acceptation.
    update public.friendships set status = 'accepted'
      where requester_id = v_ami and addressee_id = v_uid;
    return 'amis';
  end if;

  delete from public.demandes_ami_journal where envoyee_le < now() - interval '30 days';
  if (select count(*) from public.demandes_ami_journal
      where demandeur_id = v_uid and envoyee_le > now() - interval '24 hours') >= 20 then
    raise exception 'Tu as envoyé 20 demandes aujourd''hui' using errcode = 'JGA05';
  end if;
  if exists (select 1 from public.demandes_ami_journal
      where demandeur_id = v_uid and destinataire_id = v_ami and envoyee_le > now() - interval '7 days') then
    raise exception 'Tu as déjà invité ce joueur cette semaine' using errcode = 'JGA06';
  end if;

  insert into public.friendships (requester_id, addressee_id, status) values (v_uid, v_ami, 'pending');
  insert into public.demandes_ami_journal (demandeur_id, destinataire_id) values (v_uid, v_ami);
  return 'envoyee';
end;
$$;

-- 5. Répondre à une demande reçue. Renvoie 'amis' ou 'refusee'. Un refus n'est pas annoncé à l'autre joueur.
create or replace function public.repondre_ami(p_pseudo text, p_accepter boolean)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_ami uuid := public.joueur_par_pseudo(p_pseudo);
begin
  perform 1 from public.friendships
    where requester_id = v_ami and addressee_id = v_uid and status = 'pending'
    for update;
  if not found then
    raise exception 'Aucune demande de ce joueur' using errcode = 'JGA07';
  end if;
  if coalesce(p_accepter, false) then
    update public.friendships set status = 'accepted' where requester_id = v_ami and addressee_id = v_uid;
    return 'amis';
  end if;
  delete from public.friendships where requester_id = v_ami and addressee_id = v_uid;
  return 'refusee';
end;
$$;

-- 6. Retirer un ami, ou annuler sa demande. Sans effet s'il n'y a pas de relation. Les défis en cours continuent.
create or replace function public.retirer_ami(p_pseudo text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_ami uuid := public.joueur_par_pseudo(p_pseudo);
begin
  delete from public.friendships
    where (requester_id = v_uid and addressee_id = v_ami) or (requester_id = v_ami and addressee_id = v_uid);
end;
$$;

-- 7. Mes amis et mes demandes : pseudo, état ('ami', 'recue', 'envoyee'), date de la demande.
--    Jamais d'identifiant ni d'e-mail.
create or replace function public.mes_amis()
returns table (pseudo text, etat text, depuis timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
begin
  return query
    select p.username,
           case when f.status = 'accepted' then 'ami' when f.requester_id = v_uid then 'envoyee' else 'recue' end,
           f.created_at
    from public.friendships f
    join public.profiles p on p.id = case when f.requester_id = v_uid then f.addressee_id else f.requester_id end
    where v_uid in (f.requester_id, f.addressee_id) and p.username is not null
    order by 2, lower(p.username)
    limit 500;
end;
$$;

-- 8. Défier un ami sans lien : la partie (9 × 9, non classée, privée) commence tout de suite. L'ami a Noir et joue
--    le premier coup, 3 jours par coup, comme un défi par lien rejoint. Il la trouve dans ses défis.
create or replace function public.defier_ami(p_pseudo text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_ami uuid := public.joueur_par_pseudo(p_pseudo);
  v_partie uuid;
  v_jeton text;
begin
  if not exists (select 1 from public.friendships
      where status = 'accepted'
        and ((requester_id = v_uid and addressee_id = v_ami) or (requester_id = v_ami and addressee_id = v_uid))) then
    raise exception 'Ce joueur n''est pas dans tes amis' using errcode = 'JGA08';
  end if;
  perform 1 from public.profiles where id = v_uid for update;
  if (select count(*) from public.defis d join public.games g on g.id = d.partie_id
      where d.createur_id = v_uid and d.invite_id = v_ami and g.status in ('waiting', 'active')) >= 3 then
    raise exception 'Tu as déjà 3 défis en cours contre ce joueur' using errcode = 'JGA09';
  end if;
  -- Le jeton n'est pas partagé (le lien ne sert à rien : l'invité est déjà placé) ; la colonne l'exige.
  v_jeton := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');
  insert into public.games (black_id, white_id, created_by, size, rules, komi, status, rated, prive)
    values (v_ami, v_uid, v_uid, 9, 'japanese', 6.5, 'active', false, true)
    returning id into v_partie;
  insert into public.defis (partie_id, jeton, createur_id, invite_id, date_limite, lien_expire_le)
    values (v_partie, v_jeton, v_uid, v_ami, now() + interval '3 days', now());
  return v_partie;
end;
$$;

comment on function public.demander_ami(text) is 'Issue #359 : demande d''ami par pseudo exact (20 par 24 h, pas de relance sous 7 jours).';
comment on function public.repondre_ami(text, boolean) is 'Issue #359 : accepter ou refuser une demande reçue.';
comment on function public.retirer_ami(text) is 'Issue #359 : retirer un ami ou annuler sa demande.';
comment on function public.mes_amis() is 'Issue #359 : amis et demandes du joueur, par pseudo seulement.';
comment on function public.defier_ami(text) is 'Issue #359 : défi direct à un ami accepté (non classé), 3 en cours au plus contre lui.';

revoke execute on function public.demander_ami(text), public.repondre_ami(text, boolean), public.retirer_ami(text),
  public.mes_amis(), public.defier_ami(text) from public, anon;
grant execute on function public.demander_ami(text), public.repondre_ami(text, boolean), public.retirer_ami(text),
  public.mes_amis(), public.defier_ami(text) to authenticated;
