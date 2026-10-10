-- Issue #519 : mesure du lancement, trois étapes de plus pour l'entonnoir anonyme de la première session (#437).
--
-- Rapport #499 (docs/data/mesure-lancement-2026-10.md) : environ 87 % des « premiers écrans » comptés étaient des robots,
-- et rien ne disait où le joueur s'arrêtait entre l'écran et la première pierre. L'app ajoute :
-- - `premier_geste` : première interaction réelle (toucher, clic, touche du clavier) sur un appareil neuf. Dénominateur
--   humain de l'entonnoir (un robot charge la page mais ne touche rien) ;
-- - `partie_ouverte` : écran de partie ouvert ;
-- - `premier_toucher_plateau` : premier toucher d'un point vide du plateau (pierre fantôme ou pierre posée).
--
-- Rien d'autre ne change : même table, mêmes plafonds (60 par minute et 20 000 par jour, par étape), même fonction
-- `security definer` à `search_path` vide, mêmes droits (anon et authenticated exécutent, personne ne lit). La contrainte
-- `check` est remplacée par une liste plus large : les lignes existantes y entrent toutes, aucune donnée n'est touchée.
-- Toujours aucune donnée personnelle : le nom de l'étape seulement, gardé en (jour, étape, total).

alter table public.compteurs_entonnoir drop constraint compteurs_entonnoir_etape_check;
alter table public.compteurs_entonnoir add constraint compteurs_entonnoir_etape_check
  check (etape in ('premier_ecran', 'premiere_pierre', 'premiere_partie_finie', 'limite_essai', 'compte_cree',
                   'premiere_partie_en_ligne', 'premier_geste', 'partie_ouverte', 'premier_toucher_plateau'));

-- RLS inchangé (rappel explicite : la migration ne doit jamais l'affaiblir).
alter table public.compteurs_entonnoir enable row level security;
alter table public.compteurs_entonnoir_fenetre enable row level security;

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
                                        'compte_cree', 'premiere_partie_en_ligne', 'premier_geste', 'partie_ouverte',
                                        'premier_toucher_plateau') then
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
  'Compte une étape de l''entonnoir (#437, #519), sans rien savoir de l''appelant. Plafonds : 60 par minute et 20 000 par jour, par étape.';

revoke execute on function public.compter_etape(text) from public;
grant execute on function public.compter_etape(text) to anon, authenticated;
