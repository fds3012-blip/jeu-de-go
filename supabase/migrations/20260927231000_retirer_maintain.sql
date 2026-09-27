-- #148 (suite de #135) : retirer MAINTAIN aux rôles anon et authenticated.
--
-- MAINTAIN existe depuis Postgres 17 (production : 17.6). Il permet VACUUM,
-- ANALYZE, CLUSTER, REINDEX, REFRESH MATERIALIZED VIEW et LOCK TABLE : aucun
-- usage côté client, et un joueur pourrait verrouiller ou ralentir une table.
-- SELECT / INSERT / UPDATE / DELETE restent en place : la RLS les encadre.
-- Aucune donnée n'est modifiée ni supprimée par cette migration.

-- 1. Tables et vues existantes du schéma public.
revoke maintain
  on all tables in schema public
  from anon, authenticated;

-- 2. Futures tables créées par postgres (rôle des migrations).
alter default privileges for role postgres in schema public
  revoke maintain on tables
  from anon, authenticated;

-- Note : comme pour #135, les privilèges par défaut de supabase_admin ne sont
-- pas modifiables depuis le rôle postgres.
