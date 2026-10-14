-- Issue #537 (prérequis P7 du plan d'acquisition, docs/marketing/analyse-marche-acquisition-2026-10.md) : formulaire
-- de retours en 3 questions, ouvert à tous, avec ou sans compte (aide de l'app, fiche « Questions »).
--
-- Les 3 questions (src/content/i18n/retours.ts) :
--   1. « Tu conseillerais Mochi Go à un ami ? » : `oui`, `peut_etre`, `non` (obligatoire) ;
--   2. « Qu'est-ce qu'on devrait améliorer en premier ? » : texte libre, 1 000 caractères au plus (facultatif) ;
--   3. « Comment as-tu connu Mochi Go ? » : `ami`, `reseau`, `club`, `recherche`, `autre` (facultatif).
-- Plus la langue de l'interface (`fr`, `en`). Rien d'autre : ni compte, ni appareil, ni IP, ni version.
--
-- Minimisation : la fonction ignore la session ; l'app l'appelle avec la seule clé publique, jamais avec le jeton du
-- joueur (src/data/retours.ts). Un retour n'est donc lié à aucun compte. Le texte libre peut contenir ce que le joueur y
-- écrit : l'app lui demande de n'y mettre ni nom ni e-mail. Rétention : 12 mois (tâche pg_cron `purger-retours`).
--
-- Abus : l'appel est ouvert (anon), donc falsifiable. Deux plafonds globaux, comme `compter_etape` (#437) :
-- - 20 retours par minute (fenêtre simple, table `retours_fenetre`) ;
-- - 500 par jour (heure de Paris).
-- Au-delà, la fonction rend `false` sans rien écrire, et le refus est compté (`refus`) : une journée de pollution se voit.
-- Entrée mal formée : refus 22023, rien d'écrit.
--
-- Sécurité : RLS sur les deux tables, aucune politique, aucun droit pour anon ni authenticated : seule la fonction
-- écrit, seule la clé service (éditeur SQL de Supabase) lit. Fonction `security definer` à `search_path` vide.
-- Rien n'est modifié ni supprimé dans les tables existantes.

create table public.retours (
  id bigint generated always as identity primary key,
  cree_le timestamptz not null default now(),
  conseil text not null check (conseil in ('oui', 'peut_etre', 'non')),
  ameliorer text check (ameliorer is null or char_length(ameliorer) between 1 and 1000),
  source text check (source is null or source in ('ami', 'reseau', 'club', 'recherche', 'autre')),
  langue text not null check (langue in ('fr', 'en'))
);
comment on table public.retours is
  'Retours des joueurs en 3 questions (#537), sans lien avec un compte. Écrite seulement par envoyer_retour ; lue par l''équipe (clé service). Gardés 12 mois.';
create index retours_cree_le on public.retours (cree_le);

alter table public.retours enable row level security;
revoke all on public.retours from anon, authenticated;

-- Fenêtre d'une minute (limitation de fréquence), nombre du jour et refus du jour. Une seule ligne (id = 1).
create table public.retours_fenetre (
  id smallint primary key check (id = 1),
  debut timestamptz not null,
  n integer not null default 0 check (n >= 0),
  jour date not null,
  n_jour integer not null default 0 check (n_jour >= 0),
  refus integer not null default 0 check (refus >= 0)
);
comment on table public.retours_fenetre is
  'Limitation de fréquence de envoyer_retour (#537) : appels de la minute, retours et refus du jour. Aucune donnée personnelle.';

alter table public.retours_fenetre enable row level security;
revoke all on public.retours_fenetre from anon, authenticated;

create or replace function public.envoyer_retour(p_conseil text, p_ameliorer text, p_source text, p_langue text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  v_par_minute constant integer := 20;
  v_par_jour constant integer := 500;
  v_texte text := nullif(btrim(coalesce(p_ameliorer, '')), '');
  v_f public.retours_fenetre;
begin
  if p_conseil is null or p_conseil not in ('oui', 'peut_etre', 'non') then
    raise exception 'Réponse inconnue' using errcode = '22023';
  end if;
  if p_source is not null and p_source not in ('ami', 'reseau', 'club', 'recherche', 'autre') then
    raise exception 'Source inconnue' using errcode = '22023';
  end if;
  if p_langue is null or p_langue not in ('fr', 'en') then
    raise exception 'Langue inconnue' using errcode = '22023';
  end if;
  if v_texte is not null and char_length(v_texte) > 1000 then
    raise exception 'Texte trop long' using errcode = '22023';
  end if;

  -- Fenêtre d'une minute et compteur du jour, remis à zéro quand ils sont passés (verrou de ligne : incrément atomique).
  insert into public.retours_fenetre as f (id, debut, n, jour, n_jour)
  values (1, now(), 1, v_jour, 1)
  on conflict (id) do update
    set debut = case when f.debut < now() - interval '1 minute' then now() else f.debut end,
        n = case when f.debut < now() - interval '1 minute' then 1 else f.n + 1 end,
        refus = case when f.jour = v_jour then f.refus else 0 end,
        n_jour = case when f.jour = v_jour then f.n_jour + 1 else 1 end,
        jour = v_jour
  returning f.* into v_f;

  if v_f.n > v_par_minute or v_f.n_jour > v_par_jour then
    -- Refus : l'appel ne compte pas dans le jour, il compte comme refus.
    update public.retours_fenetre set refus = refus + 1, n_jour = n_jour - 1 where id = 1;
    return false;
  end if;

  insert into public.retours (conseil, ameliorer, source, langue) values (p_conseil, v_texte, p_source, p_langue);
  return true;
end;
$$;
comment on function public.envoyer_retour(text, text, text, text) is
  'Enregistre un retour en 3 questions (#537), sans rien savoir de l''appelant. Plafonds globaux : 20 par minute, 500 par jour. Rend false au-delà.';

revoke execute on function public.envoyer_retour(text, text, text, text) from public;
grant execute on function public.envoyer_retour(text, text, text, text) to anon, authenticated;

-- Rétention : 12 mois.
create or replace function public.purger_retours()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.retours where cree_le < now() - interval '12 months';
end;
$$;
comment on function public.purger_retours() is 'Issue #537 : efface les retours de plus de 12 mois. Tâche pg_cron quotidienne.';
revoke execute on function public.purger_retours() from public, anon, authenticated;

do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $s$select cron.schedule('purger-retours', '57 3 * * *', 'select public.purger_retours()')$s$;
  end if;
end;
$cron$;
