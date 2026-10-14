-- Export de mes données (issue #530, reprend #371) : droit d'accès et droit à la portabilité (art. 15 et 20 RGPD).
--
-- Profil › Conditions et confidentialité › « Mes données » › « Télécharger mes données » appelle
-- `exporter_mes_donnees()`, qui renvoie en un seul JSON tout ce que le serveur garde sur le joueur connecté, et
-- seulement sur lui : chaque lecture est filtrée par `auth.uid()`. L'app y ajoute les données de l'appareil.
--
-- Ce qui n'y est pas, volontairement (écrit dans la politique de confidentialité, section 6) :
--   - le jeton d'un défi par lien (il donne la place de l'invité à qui le détient) et les deux clés de chiffrement d'un
--     rappel (secrets techniques) : le fichier peut être copié ou partagé par erreur ;
--   - qui t'a signalé, qui t'a bloqué, et dans tes propres signalements, le joueur ou la partie visés et la note de
--     l'équipe : ce sont des données sur d'autres personnes ou sur leur sécurité (E24) ;
--   - les messages en partie de ton adversaire (seulement les tiens) ;
--   - l'empreinte d'un code de rattachement (15 minutes au plus, sans valeur pour toi).
--
-- Plafond : 3 exports par heure glissante et par compte (JGX01, avec en indice les minutes à attendre), notés dans
-- `exports_donnees` (heure seulement), effacés après 24 heures (à l'export suivant et par une tâche quotidienne), et
-- avec le compte (cascade). Aucune donnée existante n'est modifiée ni supprimée.

-- 1. Journal des exports : l'heure, rien d'autre. Fermé à l'app (RLS sans politique, aucun droit).
create table if not exists public.exports_donnees (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  fait_le timestamptz not null default now()
);
create index if not exists exports_donnees_user_fait_le on public.exports_donnees (user_id, fait_le desc);
alter table public.exports_donnees enable row level security;
revoke all on public.exports_donnees from public, anon, authenticated;
comment on table public.exports_donnees is
  '#530 : heure de chaque export de ses données (plafond de 3 par heure). Effacé après 24 heures et avec le compte. '
  'RLS sans politique, voulu : lu et écrit seulement par exporter_mes_donnees() et purger_exports_donnees().';

-- 2. Pierres de handicap aux points habituels, comme handicapPoints (src/go/rules.ts), en coordonnées SGF.
create or replace function public.sgf_points_handicap(p_taille integer, p_n integer)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  a integer := case when p_taille = 9 then 2 else 3 end;
  z integer := p_taille - 1 - (case when p_taille = 9 then 2 else 3 end);
  m integer := (p_taille - 1) / 2;
  pts integer[];
begin
  if coalesce(p_n, 0) < 1 then return '{}'; end if;
  pts := array[[z, a], [a, z], [z, z], [a, a]];
  if p_n = 5 then pts := pts || array[[m, m]];
  elsif p_n = 6 then pts := pts || array[[a, m], [z, m]];
  elsif p_n = 7 then pts := pts || array[[a, m], [z, m], [m, m]];
  elsif p_n = 8 then pts := pts || array[[a, m], [z, m], [m, a], [m, z]];
  elsif p_n >= 9 then pts := pts || array[[a, m], [z, m], [m, a], [m, z], [m, m]];
  end if;
  return array(select chr(97 + pts[i][1]) || chr(97 + pts[i][2]) from generate_series(1, least(p_n, array_length(pts, 1))) i order by i);
end;
$$;
revoke all on function public.sgf_points_handicap(integer, integer) from public, anon, authenticated;

-- 3. Une partie en ligne au format SGF (FF[4]), comme writeSgf et recordFromOnlineGame (src/go/sgf.ts, server.ts) :
--    pierres de handicap, puis coups en alternance (Blanc commence avec un handicap), `tt` = passe.
create or replace function public.sgf_partie_export(
  p_taille integer, p_komi numeric, p_regles text, p_handicap integer, p_coups text,
  p_noir text, p_blanc text, p_resultat text, p_date date)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_sgf text;
  v_n integer := char_length(coalesce(p_coups, '')) / 2;
  v_hc text[] := public.sgf_points_handicap(p_taille, p_handicap);
  i integer;
begin
  v_sgf := '(;GM[1]FF[4]CA[UTF-8]AP[Mochi Go]SZ[' || p_taille || ']KM[' || trim_scale(coalesce(p_komi, 0)) || ']RU['
    || case when p_regles = 'chinese' then 'Chinese' else 'Japanese' end || ']';
  if coalesce(p_handicap, 0) > 0 then v_sgf := v_sgf || 'HA[' || p_handicap || ']'; end if;
  if p_noir is not null then v_sgf := v_sgf || 'PB[' || replace(replace(p_noir, '\', '\\'), ']', '\]') || ']'; end if;
  if p_blanc is not null then v_sgf := v_sgf || 'PW[' || replace(replace(p_blanc, '\', '\\'), ']', '\]') || ']'; end if;
  if p_resultat is not null then v_sgf := v_sgf || 'RE[' || replace(replace(p_resultat, '\', '\\'), ']', '\]') || ']'; end if;
  if p_date is not null then v_sgf := v_sgf || 'DT[' || to_char(p_date, 'YYYY-MM-DD') || ']'; end if;
  if array_length(v_hc, 1) > 0 then
    v_sgf := v_sgf || 'AB' || (select string_agg('[' || x || ']', '' order by o) from unnest(v_hc) with ordinality u(x, o));
    v_sgf := v_sgf || 'PL[W]';
  end if;
  for i in 0 .. v_n - 1 loop
    v_sgf := v_sgf || ';' || case when (i % 2 = 0) = (array_length(v_hc, 1) is null) then 'B' else 'W' end
      || '[' || substr(p_coups, 2 * i + 1, 2) || ']';
  end loop;
  return v_sgf || ')';
end;
$$;
revoke all on function public.sgf_partie_export(integer, numeric, text, integer, text, text, text, text, date)
  from public, anon, authenticated;

-- 4. L'export.
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

-- 5. Purge quotidienne du journal des exports (24 heures).
create or replace function public.purger_exports_donnees()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.exports_donnees where fait_le < now() - interval '24 hours';
$$;
comment on function public.purger_exports_donnees() is '#530 : efface le journal des exports de plus de 24 heures. Tâche pg_cron quotidienne.';
revoke execute on function public.purger_exports_donnees() from public, anon, authenticated, service_role;

do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $s$select cron.schedule('purger-exports-donnees', '47 3 * * *', 'select public.purger_exports_donnees()')$s$;
  end if;
end;
$cron$;
