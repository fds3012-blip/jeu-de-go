-- Issue #729 (chantier C5, docs/produit/invitation-2026-10.md) : « Inviter un ami », lien personnel et cadeau gratuit
-- pour les deux. Cette migration est la partie serveur. Rien n'est payant : les cadeaux sont des décors (goban Cerisier,
-- pierres Jade) qui existent déjà dans l'app ; aucun XP n'est donné (l'économie de progression ne bouge pas).
--
-- Principe :
-- - chaque joueur avec un compte et un pseudo a UN code d'invitation de 24 octets aléatoires (192 bits, 32 caractères
--   base64url), créé à la première ouverture de « Inviter un ami » ;
-- - l'ami ouvre `mochi-go.app/i#CODE` : le code reste sur son appareil (fragment d'adresse, jamais envoyé au serveur
--   web) jusqu'à ce qu'il ait un compte et ait joué ;
-- - `valider_invitation(code)` n'accorde rien tant que l'ami n'a pas fait une vraie action vérifiée en base : un compte
--   avec pseudo, créé il y a moins de 30 jours, avec une partie de 10 coups ou plus (contre l'ordi ou guidée)
--   synchronisée au compte. Alors les deux reçoivent : l'invité le goban Cerisier et le badge « invite » ; le parrain,
--   à son 1er ami, le goban Cerisier et le badge « parrain », à son 3e, les pierres Jade ;
-- - plafond de 5 amis validés par parrain, une seule récompense par invité (clé primaire), jamais soi-même, jamais
--   en croisé (A invite B puis B invite A).
--
-- Anti-énumération : aucune fonction exécutable sans compte ; les tables `invitation_codes` et `invitations` sont
-- fermées à l'app (RLS active, aucune politique, aucun droit) ; `valider_invitation` répond `invalide` pour un code
-- inconnu, mal formé, à soi, trop tard ou croisé, sans dire lequel. Le parrain ne voit qu'un nombre d'amis arrivés,
-- jamais qui. Aucun e-mail, aucun téléphone, aucune adresse IP, aucun pseudo dans le lien.
--
-- Cette migration ne supprime et ne modifie aucune donnée : trois tables, deux fonctions et un index nouveaux, et
-- `exporter_mes_donnees` redéfinie à l'identique avec une clé de plus (`invitations`).

-- 1. Le code de chaque parrain. Fermé à l'app : lu et écrit seulement par les fonctions ci-dessous.
create table public.invitation_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{32}$'),
  cree_le timestamptz not null default now()
);
alter table public.invitation_codes enable row level security;
revoke all on table public.invitation_codes from public, anon, authenticated;
grant all on table public.invitation_codes to service_role;
comment on table public.invitation_codes is
  '#729 : code d''invitation du joueur (192 bits aléatoires). RLS sans politique, voulu : lu et écrit seulement par mon_invitation() et valider_invitation().';

-- 2. Les invitations validées : un invité, un seul parrain, une seule fois (clé primaire sur l'invité).
create table public.invitations (
  invite_id uuid primary key references auth.users (id) on delete cascade,
  parrain_id uuid not null references auth.users (id) on delete cascade,
  -- Rang de cet ami chez le parrain, de 1 à 5 : le plafond est dans le type, et l'unicité (parrain, rang) refuse
  -- un 6e ami même si le verrou de la fonction était contourné.
  rang smallint not null check (rang between 1 and 5),
  validee_le timestamptz not null default now(),
  constraint invitations_pas_soi_meme check (invite_id <> parrain_id)
);
create unique index invitations_parrain_rang_key on public.invitations (parrain_id, rang);
alter table public.invitations enable row level security;
revoke all on table public.invitations from public, anon, authenticated;
grant all on table public.invitations to service_role;
comment on table public.invitations is
  '#729 : invitation validée (invité, parrain, rang de 1 à 5). RLS sans politique, voulu : le parrain ne doit jamais voir QUI est arrivé.';

-- 3. Les cadeaux reçus. Chacun lit les siens ; personne n'écrit (les fonctions seules accordent).
create table public.cadeaux (
  user_id uuid not null references auth.users (id) on delete cascade,
  cadeau text not null check (cadeau in ('cerisier', 'jade')),
  origine text not null check (origine in ('parrain', 'invite')),
  obtenu_le timestamptz not null default now(),
  primary key (user_id, cadeau)
);
alter table public.cadeaux enable row level security;
revoke all on table public.cadeaux from public, anon, authenticated;
grant select on table public.cadeaux to authenticated;
grant all on table public.cadeaux to service_role;
create policy "Cadeaux : lire les siens" on public.cadeaux
  for select to authenticated using (user_id = (select auth.uid()));
comment on table public.cadeaux is
  '#729 : cadeaux cosmétiques gagnés en invitant ou en étant invité (cerisier : goban, jade : pierres). Aucune écriture par l''app.';

-- 4. Les cadeaux d'un joueur, dans l'ordre d'obtention. Interne.
create function public.cadeaux_de(p_uid uuid)
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(c.cadeau order by c.obtenu_le, c.cadeau), '{}'::text[])
  from public.cadeaux c where c.user_id = p_uid;
$$;
revoke all on function public.cadeaux_de(uuid) from public, anon, authenticated;

-- 5. L'écran « Inviter un ami » : mon code (créé à la première demande), les amis arrivés, le plafond, mes cadeaux.
create function public.mon_invitation()
returns table (code text, amis integer, plafond integer, cadeaux text[])
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_code text;
begin
  select c.code into v_code from public.invitation_codes c where c.user_id = v_uid;
  if v_code is null then
    insert into public.invitation_codes (user_id, code)
    values (v_uid, translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'))
    on conflict (user_id) do nothing;
    select c.code into v_code from public.invitation_codes c where c.user_id = v_uid;
  end if;
  return query select v_code,
    (select count(*)::integer from public.invitations i where i.parrain_id = v_uid),
    5,
    public.cadeaux_de(v_uid);
end;
$$;
comment on function public.mon_invitation() is
  '#729 : mon code d''invitation (créé à la première demande), le nombre d''amis arrivés, le plafond (5) et mes cadeaux. Compte avec pseudo exigé (JGC01, JGP01).';
revoke all on function public.mon_invitation() from public, anon;
grant execute on function public.mon_invitation() to authenticated;

-- 6. Valider l'invitation d'un ami. Statuts : `validee` (les deux reçoivent), `deja` (cet invité a déjà été validé ;
--    ses cadeaux sont rendus), `attente` (pas encore de vraie action : le code est gardé, on réessaiera), `complet`
--    (le parrain a déjà 5 amis), `invalide` (inconnu, mal formé, soi-même, croisé, compte de plus de 30 jours).
create function public.valider_invitation(p_code text)
returns table (statut text, cadeaux text[])
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exiger_compte_avec_pseudo();
  v_parrain uuid;
  v_cree timestamptz;
  v_rang integer;
begin
  -- Le verrou sur la ligne du code met les validations d'un même parrain à la queue : le plafond tient même avec
  -- deux appels simultanés (et un double toucher du même invité ne tombe pas sur la clé primaire).
  if p_code ~ '^[A-Za-z0-9_-]{32}$' then
    select c.user_id into v_parrain from public.invitation_codes c where c.code = p_code for update;
  end if;

  -- Déjà validé : on rend ses cadeaux, quel que soit le code envoyé.
  if exists (select 1 from public.invitations i where i.invite_id = v_uid) then
    return query select 'deja'::text, public.cadeaux_de(v_uid);
    return;
  end if;

  select u.created_at into v_cree from auth.users u where u.id = v_uid;
  if v_parrain is null or v_parrain = v_uid
     or v_cree is null or v_cree < now() - interval '30 days'
     or exists (select 1 from public.invitations i where i.invite_id = v_parrain and i.parrain_id = v_uid) then
    return query select 'invalide'::text, '{}'::text[];
    return;
  end if;

  -- Premier rang libre de 1 à 5 chez ce parrain (un ami dont le compte a été supprimé libère sa place).
  select min(r) into v_rang from generate_series(1, 5) r
    where not exists (select 1 from public.invitations i where i.parrain_id = v_parrain and i.rang = r);
  if v_rang is null then
    return query select 'complet'::text, '{}'::text[];
    return;
  end if;

  -- La vraie action : une partie de 10 coups ou plus, contre l'ordi ou guidée, synchronisée au compte (les parties à
  -- deux sur le même appareil et les imports ne comptent pas).
  if not exists (
    select 1 from public.parties_perso g
    where g.user_id = v_uid and g.mode in ('ordi', 'guidee') and regexp_count(g.sgf, ';[BW]\[') >= 10
  ) then
    return query select 'attente'::text, '{}'::text[];
    return;
  end if;

  insert into public.invitations (invite_id, parrain_id, rang) values (v_uid, v_parrain, v_rang);

  -- Les deux reçoivent ; un cadeau déjà possédé n'est pas donné deux fois.
  insert into public.cadeaux (user_id, cadeau, origine) values (v_uid, 'cerisier', 'invite') on conflict do nothing;
  insert into public.achievements (user_id, badge_id) values (v_uid, 'invite') on conflict do nothing;
  if v_rang = 1 then
    insert into public.cadeaux (user_id, cadeau, origine) values (v_parrain, 'cerisier', 'parrain') on conflict do nothing;
    insert into public.achievements (user_id, badge_id) values (v_parrain, 'parrain') on conflict do nothing;
  elsif v_rang = 3 then
    insert into public.cadeaux (user_id, cadeau, origine) values (v_parrain, 'jade', 'parrain') on conflict do nothing;
  end if;

  return query select 'validee'::text, public.cadeaux_de(v_uid);
end;
$$;
comment on function public.valider_invitation(text) is
  '#729 : valide l''invitation d''un ami après sa vraie action (partie de 10 coups ou plus synchronisée, compte de moins de 30 jours). Statuts : validee, deja, attente, complet, invalide. Plafond de 5 amis par parrain.';
revoke all on function public.valider_invitation(text) from public, anon;
grant execute on function public.valider_invitation(text) to authenticated;

-- 7. « Mes données » (art. 15 et 20 RGPD) : même fonction qu'en #530, une clé de plus (`invitations`).
create or replace function public.exporter_mes_donnees()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_recents integer;
  v_premier timestamptz;
  v_attente integer;
  v_resultat jsonb;
begin
  if v_uid is null or not exists (select 1 from auth.users u where u.id = v_uid) then
    raise exception using errcode = 'JGC01', message = 'Connecte-toi pour télécharger tes données.';
  end if;

  -- Plafond : 3 exports par heure glissante.
  delete from public.exports_donnees e where e.user_id = v_uid and e.fait_le < now() - interval '24 hours';
  select count(*), min(e.fait_le) into v_recents, v_premier
    from public.exports_donnees e where e.user_id = v_uid and e.fait_le > now() - interval '1 hour';
  if v_recents >= 3 then
    v_attente := greatest(1, ceil(extract(epoch from (v_premier + interval '1 hour' - now())) / 60)::integer);
    raise exception using errcode = 'JGX01',
      message = 'Tu as déjà téléchargé tes données 3 fois en une heure. Réessaie un peu plus tard.',
      hint = v_attente::text;
  end if;
  insert into public.exports_donnees (user_id) values (v_uid);

  select jsonb_build_object(
    'format', 'mochi-go.mes-donnees',
    'version', 1,
    'genere_le', now(),

    -- Compte de connexion (Supabase Auth) : e-mail, dates, moyens de connexion reliés.
    'compte', (
      select jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'sans_compte', u.is_anonymous,
        'cree_le', u.created_at,
        'derniere_connexion', u.last_sign_in_at,
        'moyens_de_connexion', coalesce((
          select jsonb_agg(jsonb_build_object('service', i.provider, 'email', i.identity_data ->> 'email', 'relie_le', i.created_at)
                           order by i.created_at)
          from auth.identities i where i.user_id = v_uid), '[]'::jsonb))
      from auth.users u where u.id = v_uid),

    -- Profil complet : pseudo, cotes, série, gels, dates, point de départ de la cote, preuve d'accord aux conditions.
    'profil', (select to_jsonb(p) - 'id' from public.profiles p where p.id = v_uid),

    'reglages', (select jsonb_build_object('reglages', r.reglages, 'modifies_le', r.modifie_le)
                 from public.reglages_compte r where r.user_id = v_uid),

    'historique_de_cote', coalesce((
      select jsonb_agg(jsonb_build_object('genre', h.kind, 'cote', h.rating, 'ecart_de_confiance', h.rd, 'points', h.ecart,
                                          'partie', h.game_id, 'le', h.created_at) order by h.created_at)
      from public.rating_history h where h.user_id = v_uid), '[]'::jsonb),

    'progression', jsonb_build_object(
      'lecons', coalesce((
        select jsonb_agg(jsonb_build_object('lecon', l.lesson_id, 'etapes_faites', l.steps_done, 'le', l.updated_at) order by l.lesson_id)
        from public.lesson_progress l where l.user_id = v_uid), '[]'::jsonb),
      'essais_de_problemes', coalesce((
        select jsonb_agg(jsonb_build_object('probleme', a.puzzle_id, 'reussi', a.solved, 'cote_apres', a.rating_after, 'le', a.created_at)
                         order by a.created_at)
        from public.puzzle_attempts a where a.user_id = v_uid), '[]'::jsonb),
      'problemes_a_ta_mesure', (select to_jsonb(c) - 'user_id' from public.cotes_a_mesure c where c.user_id = v_uid),
      'essais_a_ta_mesure', coalesce((
        select jsonb_agg(to_jsonb(e) - 'user_id' order by e.cree_le) from public.essais_a_mesure e where e.user_id = v_uid), '[]'::jsonb),
      'badges', coalesce((
        select jsonb_agg(jsonb_build_object('badge', b.badge_id, 'gagne_le', b.earned_at) order by b.earned_at)
        from public.achievements b where b.user_id = v_uid), '[]'::jsonb),
      'go_du_jour', coalesce((
        select jsonb_agg(to_jsonb(g) - 'user_id' order by g.numero) from public.go_du_jour_resultats g where g.user_id = v_uid), '[]'::jsonb),
      'revisions', coalesce((
        select jsonb_agg(to_jsonb(r) - 'user_id' order by r.cree_le) from public.revisions r where r.user_id = v_uid), '[]'::jsonb),
      'problemes_crees', coalesce((
        select jsonb_agg(to_jsonb(q) - 'owner_id' order by q.created_at) from public.puzzles q where q.owner_id = v_uid), '[]'::jsonb)),

    -- Parties en ligne (direct, parties lentes, défis, contre l'IA sur le serveur), chacune en SGF.
    'parties_en_ligne', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'commencee_le', g.created_at,
        'mise_a_jour_le', g.updated_at,
        'etat', g.status,
        'ton_camp', case when g.black_id = v_uid then 'noir' when g.white_id = v_uid then 'blanc' end,
        'adversaire', case
          when g.bot_id is not null then jsonb_build_object('ordinateur', g.bot_id)
          else jsonb_build_object('pseudo', (select p.username from public.profiles p
                                             where p.id = case when g.black_id = v_uid then g.white_id else g.black_id end)) end,
        'taille', g.size, 'regles', g.rules, 'komi', g.komi, 'handicap', g.handicap,
        'classee', g.rated, 'privee', g.prive, 'resultat', g.result,
        'score_noir', g.score_black, 'score_blanc', g.score_white,
        'coups', char_length(g.moves) / 2,
        'sgf', public.sgf_partie_export(g.size, g.komi, g.rules, g.handicap, g.moves,
          case when g.black_id is null and g.bot_id is null then null
               else coalesce((select p.username from public.profiles p where p.id = g.black_id), g.bot_id) end,
          case when g.white_id is null and g.bot_id is null then null
               else coalesce((select p.username from public.profiles p where p.id = g.white_id), g.bot_id) end,
          g.result, g.created_at::date),
        'analyse', g.analysis,
        'defi', (select jsonb_build_object('role', case when d.createur_id = v_uid then 'createur' else 'invite' end,
                   'cree_le', d.cree_le, 'delai_par_coup', d.delai_coup::text, 'date_limite_du_coup', d.date_limite,
                   'lien_valable_jusqu_au', d.lien_expire_le)
                 from public.defis d where d.partie_id = g.id),
        'pendule', (select to_jsonb(pd) - 'partie_id' from public.parties_direct pd where pd.partie_id = g.id),
        'tes_messages', coalesce((
          select jsonb_agg(jsonb_build_object('message', m.code, 'le', m.envoye_le) order by m.envoye_le)
          from public.messages_partie m where m.partie_id = g.id and m.auteur_id = v_uid), '[]'::jsonb))
        order by g.created_at desc)
      from public.games g
      where g.black_id = v_uid or g.white_id = v_uid or g.created_by = v_uid), '[]'::jsonb),

    'parties_enregistrees', coalesce((
      select jsonb_agg(to_jsonb(pp) - 'user_id' - 'id' order by pp.joue_le desc)
      from public.parties_perso pp where pp.user_id = v_uid), '[]'::jsonb),

    'parties_partagees', coalesce((
      select jsonb_agg(jsonb_build_object('jeton', s.jeton, 'objet', s.objet, 'taille', s.taille, 'ton_camp', s.joueur,
                                          'adversaire', s.adversaire, 'coup_montre', s.coup, 'sgf', s.sgf, 'partage_le', s.cree_le)
                       order by s.cree_le desc)
      from public.parties_partagees s where s.user_id = v_uid), '[]'::jsonb),

    'amis', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pseudo', (select p.username from public.profiles p
                   where p.id = case when f.requester_id = v_uid then f.addressee_id else f.requester_id end),
        'etat', f.status, 'demande', case when f.requester_id = v_uid then 'envoyee' else 'recue' end, 'depuis', f.created_at)
        order by f.created_at)
      from public.friendships f where f.requester_id = v_uid or f.addressee_id = v_uid), '[]'::jsonb),

    'demandes_ami_envoyees', coalesce((
      select jsonb_agg(jsonb_build_object('a', (select p.username from public.profiles p where p.id = j.destinataire_id),
                                          'le', j.envoyee_le) order by j.envoyee_le)
      from public.demandes_ami_journal j where j.demandeur_id = v_uid), '[]'::jsonb),

    'rappels_go_du_jour', jsonb_build_object(
      'envoyes', coalesce((
        select jsonb_agg(jsonb_build_object('a', (select p.username from public.profiles p where p.id = r.destinataire_id),
                                            'go_du_jour', r.numero, 'le', r.envoye_le) order by r.envoye_le)
        from public.rappels_go_du_jour r where r.expediteur_id = v_uid), '[]'::jsonb),
      'recus', coalesce((
        select jsonb_agg(jsonb_build_object('de', (select p.username from public.profiles p where p.id = r.expediteur_id),
                                            'go_du_jour', r.numero, 'le', r.envoye_le) order by r.envoye_le)
        from public.rappels_go_du_jour r where r.destinataire_id = v_uid), '[]'::jsonb)),

    'joueurs_bloques', coalesce((
      select jsonb_agg(jsonb_build_object('pseudo', (select p.username from public.profiles p where p.id = b.bloque_id),
                                          'depuis', b.cree_le) order by b.cree_le)
      from public.blocages b where b.bloqueur_id = v_uid), '[]'::jsonb),

    -- Signalements et « Nous écrire » envoyés : sans le joueur ni la partie visés, sans la note de l'équipe.
    'signalements_envoyes', coalesce((
      select jsonb_agg(jsonb_build_object('type', s.type, 'motif', s.motif, 'message', s.texte, 'probleme', s.probleme_id,
                                          'version_app', s.version_app, 'contexte', s.contexte, 'etat', s.statut,
                                          'envoye_le', s.cree_le, 'traite_le', s.traite_le) order by s.cree_le)
      from public.signalements s where s.auteur_id = v_uid), '[]'::jsonb),

    'notifications', coalesce((
      select jsonb_agg(jsonb_build_object('type', n.type, 'partie', n.partie_id, 'creee_le', n.creee_le, 'lue_le', n.lue_le)
                       order by n.creee_le)
      from public.notifications n where n.destinataire_id = v_uid), '[]'::jsonb),

    'parties_quittees', coalesce((
      select jsonb_agg(jsonb_build_object('partie', a.partie_id, 'file', a.file, 'motif', a.motif, 'le', a.cree_le) order by a.cree_le)
      from public.abandons a where a.joueur_id = v_uid), '[]'::jsonb),

    'recherche_d_adversaire', jsonb_build_object(
      'en_direct', (select to_jsonb(q) - 'user_id' from public.match_queue q where q.user_id = v_uid),
      'partie_lente', (select to_jsonb(l) - 'user_id' from public.file_lente l where l.user_id = v_uid)),

    -- Rappel du Go du jour : sans l'adresse complète ni les clés de chiffrement (secrets techniques).
    'rappel_du_go_du_jour', coalesce((
      select jsonb_agg(jsonb_build_object('service', substring(r.endpoint from '^https://[^/]+'), 'moment', r.moment,
                                          'fuseau', r.fuseau, 'langue', r.langue, 'dernier_envoi', r.dernier_envoi,
                                          'inscrit_le', r.cree_le) order by r.cree_le)
      from public.abonnements_rappel r where r.user_id = v_uid), '[]'::jsonb),

    -- #729 : invitations. Le nombre d'amis arrivés (jamais qui), la date d'arrivée de l'invité, les cadeaux. Sans le code.
    'invitations', jsonb_build_object(
      'amis_arrives', (select count(*) from public.invitations i where i.parrain_id = v_uid),
      'invite_le', (select i.validee_le from public.invitations i where i.invite_id = v_uid),
      'cadeaux', coalesce((
        select jsonb_agg(jsonb_build_object('cadeau', c.cadeau, 'origine', c.origine, 'obtenu_le', c.obtenu_le) order by c.obtenu_le, c.cadeau)
        from public.cadeaux c where c.user_id = v_uid), '[]'::jsonb)),

    'exports_recents', coalesce((
      select jsonb_agg(e.fait_le order by e.fait_le) from public.exports_donnees e where e.user_id = v_uid), '[]'::jsonb)
  ) into v_resultat;

  return v_resultat;
end;
$$;
comment on function public.exporter_mes_donnees() is
  '#530 (art. 15 et 20 RGPD) : tout ce que le serveur garde sur le joueur connecté, et sur lui seul, en un JSON '
  '(parties en SGF). 3 exports par heure (JGX01, indice : minutes à attendre). Sans session : JGC01.';
revoke all on function public.exporter_mes_donnees() from public, anon;
grant execute on function public.exporter_mes_donnees() to authenticated;
