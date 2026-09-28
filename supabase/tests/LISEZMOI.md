# Tests SQL

Tests rejouables des fonctions serveur. Chaque fichier `*.test.sql` s'exécute dans une transaction **annulée à la fin** : aucune donnée ne reste.

## Lancer en local, sans Supabase ni Docker

```sh
bash supabase/tests/lancer.sh
```

Le script crée un Postgres jetable dans un dossier temporaire, charge `supabase_minimal.sql` (rôles `anon`, `authenticated`, `service_role`, schéma `auth` avec `auth.uid()` lu dans les claims du jeton, `pgcrypto` dans `extensions`), applique **toutes** les migrations dans l'ordre, puis lance chaque test. Il faut les binaires Postgres (`initdb`, `pg_ctl`, `psql`) ; `PG_BIN` et `PG_PORT` permettent de les choisir. En Postgres 16, la migration qui retire le privilège MAINTAIN (Postgres 17) est ignorée.

## Lancer contre une base Supabase locale ou une branche

```sh
supabase start   # ou une branche Supabase, jamais la production
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/defi_par_lien.test.sql
```

Ne pas charger `supabase_minimal.sql` sur une vraie base Supabase : ces objets y existent déjà.

## Cas couverts

`defi_par_lien.test.sql` (issue #81) : création (connexion requise), lecture limitée aux deux joueurs, aucune écriture directe, invité en session anonyme, tiers refusé, hors tour refusé, partie périmée refusée, coup mal formé ou hors plateau refusé, écriture des coups hors fonction refusée (même avec la clé service), délai dépassé ⇒ victoire au temps (à la lecture et au coup suivant), lien expiré, parties publiques toujours visibles.
