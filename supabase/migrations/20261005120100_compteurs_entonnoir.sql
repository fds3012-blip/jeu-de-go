-- Issue #437 : mesurer la première session et le mur du compte avec des compteurs agrégés anonymes.
--
-- Sans accord, PostHog ne reçoit pas assez pour suivre la première session (24 « limite de l'essai » pour 2 comptes sur
-- 30 jours, sans le reste de l'entonnoir). Ces compteurs disent seulement « combien d'appareils ont franchi telle étape
-- tel jour » : une ligne par jour et par étape, un nombre. Rien d'autre n'est gardé.
--
-- Conformité (docs/juridique/politique-confidentialite.md, docs/juridique/consentement.md) : mesure d'audience
-- strictement anonyme, exemptée de consentement (CNIL, lignes directrices du 17 septembre 2020, art. 5) :
-- - aucune donnée personnelle : ni identifiant, ni compte, ni IP, ni appareil, ni heure (le jour seulement, à Paris) ;
-- - la fonction ignore la session : appelée par l'app avec la seule clé publique, jamais avec le jeton du joueur ;
-- - l'agrégat ne permet pas de suivre un joueur d'une étape à l'autre.
--
-- Abus : l'appel est ouvert (anon), donc falsifiable. Deux plafonds bornent ce qu'un tiers peut faire :
-- - 60 appels par minute et par étape (fenêtre glissante simple, table `compteurs_entonnoir_fenetre`) ;
-- - 20 000 par jour et par étape (au-delà, le jour est plafonné : n s'arrête).
-- Les appels refusés sont comptés (`refus`) : un jour pollué se voit. Plafonds à relever par migration si l'audience
-- les approche (ordre de grandeur actuel : quelques dizaines par jour).
--
-- Sécurité : RLS sur les deux tables, aucune politique, aucun droit pour anon ni authenticated : seule la fonction
-- écrit, seule la clé service (tableau de bord SQL) lit. Fonction `security definer` à `search_path` vide.
-- Données : rien n'est supprimé.

create table public.compteurs_entonnoir (
  jour date not null,
  etape text not null check (etape in ('premier_ecran', 'premiere_pierre', 'premiere_partie_finie', 'limite_essai',
                                       'compte_cree', 'premiere_partie_en_ligne')),
  n integer not null default 0 check (n >= 0),
  primary key (jour, etape)
);
comment on table public.compteurs_entonnoir is
  'Entonnoir de la première session (#437) : appareils ayant franchi chaque étape, par jour (Europe/Paris). Anonyme, agrégé. Écrite seulement par compter_etape.';

alter table public.compteurs_entonnoir enable row level security;
revoke all on public.compteurs_entonnoir from anon, authenticated;

-- Fenêtre d'une minute par étape (limitation de fréquence) et refus cumulés par jour.
create table public.compteurs_entonnoir_fenetre (
  etape text primary key,
  debut timestamptz not null,
  n integer not null default 0 check (n >= 0),
  refus_jour date,
  refus integer not null default 0 check (refus >= 0)
);
comment on table public.compteurs_entonnoir_fenetre is
  'Limitation de fréquence de compter_etape (#437) : appels de la minute en cours, refus du jour. Aucune donnée personnelle.';

alter table public.compteurs_entonnoir_fenetre enable row level security;
revoke all on public.compteurs_entonnoir_fenetre from anon, authenticated;

create or replace function public.compter_etape(p_etape text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  v_par_minute constant integer := 60;
  v_par_jour constant integer := 20000;
  v_n integer;
begin
  if p_etape is null or p_etape not in ('premier_ecran', 'premiere_pierre', 'premiere_partie_finie', 'limite_essai',
                                        'compte_cree', 'premiere_partie_en_ligne') then
    raise exception 'Étape inconnue' using errcode = '22023';
  end if;

  -- Fenêtre d'une minute : remise à zéro si elle est passée, sinon +1 (verrou de ligne : incrément atomique).
  insert into public.compteurs_entonnoir_fenetre as f (etape, debut, n)
  values (p_etape, now(), 1)
  on conflict (etape) do update
    set debut = case when f.debut < now() - interval '1 minute' then now() else f.debut end,
        n = case when f.debut < now() - interval '1 minute' then 1 else f.n + 1 end
  returning f.n into v_n;

  if v_n > v_par_minute then
    update public.compteurs_entonnoir_fenetre
      set refus = case when refus_jour = v_jour then refus + 1 else 1 end, refus_jour = v_jour
      where etape = p_etape;
    return false;
  end if;

  insert into public.compteurs_entonnoir as c (jour, etape, n)
  values (v_jour, p_etape, 1)
  on conflict (jour, etape) do update
    set n = c.n + 1
    where c.n < v_par_jour
  returning c.n into v_n;

  if v_n is null then
    update public.compteurs_entonnoir_fenetre
      set refus = case when refus_jour = v_jour then refus + 1 else 1 end, refus_jour = v_jour
      where etape = p_etape;
    return false;
  end if;
  return true;
end;
$$;
comment on function public.compter_etape(text) is
  'Compte une étape de l''entonnoir (#437), sans rien savoir de l''appelant. Plafonds : 60 par minute et 20 000 par jour, par étape.';

revoke execute on function public.compter_etape(text) from public;
grant execute on function public.compter_etape(text) to anon, authenticated;
