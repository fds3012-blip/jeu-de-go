-- Issue #695 (C2) : combien de joueurs sont en ligne ? L'accueil garde l'ordi en action principale tant qu'ils sont
-- moins de 4 (src/app/modes.ts, SEUIL_EN_LIGNE) : « Jouer en ligne » en tête mène sinon à une file vide.
--
-- Lecture seule, un seul nombre, aucun identifiant ni aucune ligne : ouverte aussi aux visiteurs (anon), qui voient
-- l'accueil avant d'avoir un compte. Sont comptés :
--   - les joueurs qui attendent un adversaire en direct (`match_queue`, appel de find_match il y a moins de 30 s : le
--     même délai que la purge des attentes abandonnées) ;
--   - les joueurs d'une partie classée en direct encore active, vus il y a moins de 90 s (`parties_direct`, signe de
--     présence de pendule_direct ou d'un coup joué).
-- Un joueur n'est que dans une de ces deux situations à la fois (find_match sort de la file à l'appariement).
-- Les parties lentes ne comptent pas : on n'y joue pas « maintenant ».
create or replace function public.joueurs_en_ligne()
returns integer
language sql stable security definer set search_path = ''
as $$
  select (
    (select count(*) from public.match_queue where vu_le > now() - interval '30 seconds')
    + (select count(*) from public.parties_direct d join public.games g on g.id = d.partie_id
         where g.status = 'active' and d.noir_vu_le > now() - interval '90 seconds')
    + (select count(*) from public.parties_direct d join public.games g on g.id = d.partie_id
         where g.status = 'active' and d.blanc_vu_le > now() - interval '90 seconds')
  )::integer;
$$;
revoke execute on function public.joueurs_en_ligne() from public;
grant execute on function public.joueurs_en_ligne() to anon, authenticated;
comment on function public.joueurs_en_ligne() is
  'Issue #695 : nombre de joueurs en file ou en partie classée en direct (présence récente). Un nombre, aucun identifiant.';
