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

`garde_anonymes.test.sql` (issue #316) : le jeton est simulé par `request.jwt.claims` avec `is_anonymous` à `true`, à `false`, ou absent (traité comme un vrai compte).
- Anonyme refusé : demande et acceptation d'ami, problème personnel, création de partie (contre un humain ou l'IA), badge, progression des leçons, pseudo, `find_match`, `join_game`, `resign_game` hors défi, `record_puzzle_attempt`, `importer_serie_appareil`, plus de 3 défis en attente.
- Anonyme accepté : lecture (profils, problèmes communs, ses relations), `creer_defi` (3 en attente), `rejoindre_defi`, lecture du défi, `victoire_au_temps`, coup par `jouer_coup_defi`, abandon d'un défi.
- Vrai compte : toutes les actions ci-dessus restent permises, 20 défis en attente au plus.
- Structure : les 9 politiques restrictives attendues sont présentes, RLS active sur chaque table.

Rappel : les fonctions `security definer` appartiennent à `postgres`, qui contourne la RLS (vrai aussi en production, `rolbypassrls`). Les politiques restrictives ne bloquent donc pas les fonctions ; celles-ci contrôlent l'anonyme dans leur corps.
