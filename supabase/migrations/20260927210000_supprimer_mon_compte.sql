-- Issue #114 : « Supprimer mon compte » depuis l'app (Apple 5.1.1(v), Google Play).
-- Une seule fonction serveur, appelable par `authenticated`, qui n'agit que sur auth.uid().
--
-- Ce qui est supprimé : profil, progression des leçons, essais et problèmes personnels,
-- historique de cote, badges, amitiés, file d'attente, parties contre l'IA, parties
-- en attente sans adversaire, puis l'utilisateur dans auth.users (identités et sessions
-- partent en cascade côté Auth).
-- Ce qui reste, anonymisé : les parties jouées contre un autre joueur. La place du joueur
-- supprimé devient null (« joueur supprimé » à l'affichage) ; si c'était lui qui avait
-- créé la partie, elle est rattachée à l'adversaire (created_by est non nul et en cascade :
-- sans cela, la partie de l'adversaire disparaîtrait).
--
-- Pourquoi pas d'Edge Function : la fonction appartient à `postgres`, qui peut supprimer
-- dans auth.users. Tout se fait dans une seule transaction (tout ou rien), sans clé
-- service à stocker ni à faire circuler.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;

  -- Parties contre l'IA et parties sans adversaire humain : données personnelles, supprimées.
  delete from public.games g
  where g.created_by = v_uid
    and (g.bot_id is not null
         or coalesce(nullif(g.black_id, v_uid), nullif(g.white_id, v_uid)) is null);

  -- Parties partagées : l'adversaire devient créateur si besoin, puis le joueur est effacé.
  update public.games g
  set created_by = coalesce(nullif(g.black_id, v_uid), nullif(g.white_id, v_uid))
  where g.created_by = v_uid;

  update public.games g
  set black_id = nullif(g.black_id, v_uid),
      white_id = nullif(g.white_id, v_uid),
      dead_proposed_by = nullif(g.dead_proposed_by, v_uid)
  where v_uid in (g.black_id, g.white_id, g.dead_proposed_by);

  -- Données personnelles (explicites, même si les clés étrangères cascadent déjà).
  delete from public.lesson_progress where user_id = v_uid;
  delete from public.puzzle_attempts where user_id = v_uid;
  delete from public.rating_history  where user_id = v_uid;
  delete from public.achievements    where user_id = v_uid;
  delete from public.friendships     where v_uid in (requester_id, addressee_id);
  delete from public.match_queue     where user_id = v_uid;
  delete from public.puzzles         where owner_id = v_uid;
  delete from public.profiles        where id = v_uid;

  -- Enfin, le compte d'authentification.
  delete from auth.users where id = v_uid;
end;
$$;

comment on function public.delete_my_account() is
  'Supprime le compte du joueur connecté (auth.uid() seulement) et anonymise ses parties partagées. Issue #114.';

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
