-- #135 : retirer TRUNCATE, REFERENCES et TRIGGER aux rôles anon et authenticated.
--
-- Ces droits ne servent à rien côté client et TRUNCATE contourne la RLS :
-- un joueur connecté pouvait vider une table entière (profiles, games, puzzles...).
-- SELECT / INSERT / UPDATE / DELETE restent en place : la RLS les encadre.
-- Aucune donnée n'est modifiée ni supprimée par cette migration.

-- 1. Tables et vues existantes du schéma public.
revoke truncate, references, trigger
  on all tables in schema public
  from anon, authenticated;

-- 2. Futures tables créées par postgres (rôle des migrations).
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables
  from anon, authenticated;

-- Note : les privilèges par défaut de supabase_admin (plateforme) ne sont pas
-- modifiables depuis le rôle postgres (42501). Nos migrations créent leurs
-- tables avec postgres ; toute nouvelle table reste couverte par le point 2.
