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

`compte_obligatoire.test.sql` (issue #343) : `creer_defi`, `rejoindre_defi` (nouvel invité), `find_match`, `join_game` refusent avec le code `JGC01` (« Crée ton compte ») sans session, en session anonyme (claim du jeton ou `auth.users`), et avec `JGP01` (« Choisis ton pseudo ») un compte sans pseudo ; une fois le pseudo choisi, tout passe. Partie entre humains créée directement : pseudo exigé (contre l'IA : permis). Parties en cours préservées : un anonyme ou un compte sans pseudo déjà dans un défi le retrouve, y joue (`jouer_coup_defi`), constate le temps et abandonne. `apercu_defi` sans session : pseudo du créateur, taille, état (`libre`, `pris`, `expire`, `fini`), place de l'appelant, rien pour un jeton inconnu ou mal formé. Aucune donnée supprimée, contrôle interne non exposé, RLS active partout.

Depuis #343, les tests plus anciens (`defi_par_lien`, `garde_anonymes`, `places_du_joueur`) donnent un pseudo à leurs comptes, et un anonyme « déjà dans un défi » y est placé directement (comme un défi rejoint avant #343).

`cote_a_mesure.test.sql` (issue #284) : sans connexion ou anonyme refusé ; aucune écriture directe dans `cotes_a_mesure` ni `essais_a_mesure` ; résultat inconnu, problème personnel d'un autre ou inexistant refusés ; valeurs Elo exactes (réussite +80, échec −73,85, réussite avec aide +29,54) ; « Rejouer » le même jour ne compte pas ; « aide » seulement sur l'échec du jour noté en dernier, une fois ; un autre jour, un problème réussi ne compte plus, un problème raté compte de nouveau ; chacun ne lit que sa ligne ; reprise de la cote de l'appareil bornée, une seule fois, avant tout essai ; RLS, droits d'anon, suppression en cascade avec le compte.

`defi_par_lien.test.sql` (issue #81) : création (connexion requise), lecture limitée aux deux joueurs, aucune écriture directe, invité en session anonyme, tiers refusé, hors tour refusé, partie périmée refusée, coup mal formé ou hors plateau refusé, écriture des coups hors fonction refusée (même avec la clé service), délai dépassé ⇒ victoire au temps (à la lecture et au coup suivant), lien expiré, parties publiques toujours visibles.

`garde_anonymes.test.sql` (issue #316) : le jeton est simulé par `request.jwt.claims` avec `is_anonymous` à `true`, à `false`, ou absent (traité comme un vrai compte).
- Anonyme refusé : demande et acceptation d'ami, problème personnel, création de partie (contre un humain ou l'IA), badge, progression des leçons, pseudo, `find_match`, `join_game`, `resign_game` hors défi, `record_puzzle_attempt`, `importer_serie_appareil`, plus de 3 défis en attente.
- Anonyme accepté : lecture (profils, problèmes communs, ses relations), `creer_defi` (3 en attente), `rejoindre_defi`, lecture du défi, `victoire_au_temps`, coup par `jouer_coup_defi`, abandon d'un défi.
- Vrai compte : toutes les actions ci-dessus restent permises, 20 défis en attente au plus.
- Structure : les 9 politiques restrictives attendues sont présentes, RLS active sur chaque table.

`purge_anonymes.test.sql` (issue #318) : moins de 60 jours refusé ; fonction inaccessible depuis l'app (anon, authenticated, service_role) ; anonyme inactif depuis 100 jours supprimé avec son profil ; gardés : vrai compte même inactif, session rafraîchie il y a 10 jours, connexion il y a 5 jours, partie modifiée il y a 20 jours, compte créé il y a 30 jours ; partie contre un vrai joueur gardée pour lui (il en devient créateur, la place de l'anonyme est vidée) ; partie sans adversaire supprimée ; second passage sans effet.

`places_du_joueur.test.sql` (revue de sécurité du 29/09, `docs/qa/securite-2026-09-29.md`) : un client ne peut pas inscrire un autre joueur dans une partie qu'il crée ou modifie directement (partie contre l'IA ou à rejoindre) ; restent permis : sa partie contre l'IA, une partie à rejoindre avec une place vide, `rejoindre_defi`.

Rappel : les fonctions `security definer` appartiennent à `postgres`, qui contourne la RLS (vrai aussi en production, `rolbypassrls`). Les politiques restrictives ne bloquent donc pas les fonctions ; celles-ci contrôlent l'anonyme dans leur corps.
