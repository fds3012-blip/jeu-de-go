-- Issue #704 : revue des fonctions de `public` exécutables sans compte (rôle anon). Deux correctifs, rien d'autre.
--
-- Relevé en production (24 octobre 2026) : sept fonctions exécutables par anon. Six sont voulues et déjà gardées
-- (security definer, search_path vide, jeton de 192 bits ou plafonds globaux) : apercu_defi, compter_etape,
-- envoyer_retour, joueurs_en_ligne, lire_partage, lire_partie_partagee. La septième ne l'est pas :
--
-- 1. `pseudo_formes(text)` (#531) est un assistant interne de `pseudo_interdit` (security definer, qui reste
--    exécutable par son propriétaire). Elle n'avait pas été fermée : Postgres donne EXECUTE à PUBLIC par défaut et
--    Supabase à anon et authenticated, donc `/rest/v1/rpc/pseudo_formes` l'ouvrait à tout le monde, avec un texte
--    sans limite de taille passé à plusieurs expressions régulières (coût de calcul au gré de l'appelant). Les
--    advisors ne la signalent pas, car elle n'est pas security definer. Aucun appel du client ni d'autre fonction
--    exécutée avec les droits de l'appelant : fermée à PUBLIC, anon et authenticated.
--
-- 2. `joueurs_en_ligne()` (#695) est appelée à chaque affichage de l'accueil, sans compte, et compte deux fois
--    `parties_direct` (toutes les parties en direct, finies comprises) sans index sur les colonnes de présence : le
--    coût de chaque appel anonyme grandit avec l'historique. Deux index partiels sur les colonnes `*_vu_le` bornent
--    le travail aux parties récemment vues. Aucune donnée touchée, aucun droit changé.
--
-- Inchangés, volontairement (voir la PR) : les plafonds globaux de compter_etape et envoyer_retour (un abus peut les
-- épuiser, mais aucune donnée n'est exposée ni modifiée au-delà), les jetons de apercu_defi, lire_partage et
-- lire_partie_partagee (24 octets aléatoires). RLS inchangé.

revoke execute on function public.pseudo_formes(text) from public, anon, authenticated;

create index if not exists parties_direct_noir_vu_le on public.parties_direct (noir_vu_le) where noir_vu_le is not null;
create index if not exists parties_direct_blanc_vu_le on public.parties_direct (blanc_vu_le) where blanc_vu_le is not null;
