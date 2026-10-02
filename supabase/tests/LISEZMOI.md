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

`abonnements_rappel.test.sql` (issue #36) : visiteur et anonyme refusés (table et fonction), jeton sans utilisateur refusé ; chacun ne lit, ne modifie et ne supprime que ses abonnements ; seuls le moment et la langue se modifient directement ; réinscription sans doublon ; fuseau inconnu remplacé par Paris ; `reclamer_rappels` réservée au serveur, un rappel par jour, à l'heure du moment choisi (rattrapage d'une heure), jamais entre 20 h et 8 h, pas de rappel si un problème est déjà réussi ce jour-là, fuseau et langue du joueur ; appareil repris par un autre compte ; 20 appareils au plus ; suppression en cascade avec le compte.
`amis.test.sql` (issue #359) : sans session, en session anonyme (JGC01) et sans pseudo (JGP01) refusé ; aucune écriture directe dans `friendships` (lecture de ses seules relations par RLS), journal `demandes_ami_journal` fermé à l'app, `joueur_par_pseudo` interne ; pseudo inconnu, mal formé, e-mail, compte anonyme (JGA01) et soi-même (JGA02) refusés ; pseudo exact sans casse ; doublon (JGA04), déjà amis (JGA03), aucune demande à accepter (JGA07) ; `mes_amis` ne renvoie que pseudo, état et date, chacun ne voit que ses relations ; demande croisée = amis ; refus silencieux et pas de relance sous 7 jours (JGA06) ; 20 demandes par 24 heures (JGA05) ; journal effacé après 30 jours ; `defier_ami` seulement entre amis (JGA08), partie 9 × 9 non classée et privée, l'ami a Noir et le délai court, lue par les deux seuls joueurs, 3 défis en cours au plus contre lui (JGA09) ; retirer un ami (idempotent, défis en cours gardés) ; relations et journal effacés avec le compte (`delete_my_account`) ou le profil (cascade) ; droits et `search_path` des fonctions.

Depuis #359, `garde_anonymes.test.sql` passe par `demander_ami` et `repondre_ami` au lieu d'écrire dans `friendships`.

`compte_obligatoire.test.sql` (issue #343) : `creer_defi`, `rejoindre_defi` (nouvel invité), `find_match`, `join_game` refusent avec le code `JGC01` (« Crée ton compte ») sans session, en session anonyme (claim du jeton ou `auth.users`), et avec `JGP01` (« Choisis ton pseudo ») un compte sans pseudo ; une fois le pseudo choisi, tout passe. Partie entre humains créée directement : pseudo exigé (contre l'IA : permis). Parties en cours préservées : un anonyme ou un compte sans pseudo déjà dans un défi le retrouve, y joue (`jouer_coup_defi`), constate le temps et abandonne. `apercu_defi` sans session : pseudo du créateur, taille, état (`libre`, `pris`, `expire`, `fini`), place de l'appelant, rien pour un jeton inconnu ou mal formé. Aucune donnée supprimée, contrôle interne non exposé, RLS active partout.

Depuis #343, les tests plus anciens (`defi_par_lien`, `garde_anonymes`, `places_du_joueur`) donnent un pseudo à leurs comptes, et un anonyme « déjà dans un défi » y est placé directement (comme un défi rejoint avant #343).

`preuve_conditions.test.sql` (D2 de `docs/juridique/compte-obligatoire.md`, suite de #343) : `accepter_conditions` refuse sans session, en session anonyme (claim ou `auth.users`), et une version mal formée ; le client ne peut pas écrire `conditions_version` ni `conditions_acceptees_le` directement (droit de colonne absent, pas d'insertion) ; même version acceptée à nouveau : la première date reste ; nouvelle version : date et version remplacées ; profil d'un autre intact ; les deux colonnes vont ensemble ; droits de la fonction (authenticated seulement).

`rattacher_session_anonyme.test.sql` (suite de #343, #353, #354) : `preparer_rattachement` réservée aux sessions anonymes (claim ou `auth.users`), code de 32 caractères gardé seulement par empreinte SHA-256, 15 minutes, une ligne par anonyme (second tirage : l'ancien code ne vaut plus) ; `rattacher_session_anonyme` refuse sans session ou en session anonyme (JGC01), code inconnu, mal formé, ancien ou expiré (P0002) ; avec le bon code : parties (créateur, Noir, Blanc, proposant des pierres mortes) et défis (créateur, invité) passent au compte, coups, jeton et date limite intacts, le compte lit ses défis par RLS, l'anonyme (profil, compte, code) est supprimé, le code ne sert qu'une fois ; joueur qui s'était défié lui-même : place vidée, pas dédoublée ; session visée devenue un vrai compte : refus ; table fermée à l'app (RLS, aucune politique, aucun droit) ; aucune cote touchée.

`minimisation_profil_google.test.sql` (E18, #354) : nom et photo reçus de Google (`name`, `full_name`, `given_name`, `family_name`, `picture`, `avatar_url`) retirés de `auth.users.raw_user_meta_data` et `auth.identities.identity_data` à la création et à chaque reconnexion ; identifiant, e-mail et indicateurs gardés ; compte sans métadonnées inchangé ; le joueur ne peut plus modifier `avatar_url` ni `country` (42501), le pseudo reste modifiable, profil et classement toujours lisibles.

`parties_perso.test.sql` (#358, « Mes parties » sur le compte) : visiteur refusé (table et fonction) ; anonyme (JGC01), compte sans pseudo (JGP01) et jeton sans utilisateur refusés ; aucune écriture directe (insert, update, delete) ; envoi de 1 à 50 parties, clés rendues ; doublons (renvoi, même clé deux fois dans un envoi) sans nouvelle ligne ; entrées mal formées ignorées sans bloquer les autres (mode `defi`, clé, taille, SGF, date future, adversaire trop long, SGF de plus de 64 Kio) ; chacun ne lit que les siennes, la même clé peut exister chez deux joueurs, jeton anonyme : rien ; plafond de 500 (les plus récentes d'abord, puis refus JGL01, renvoi d'une partie déjà là accepté) ; `delete_my_account` emporte les parties (cascade), celles d'un autre restent ; RLS, droits, `security definer` à `search_path` vide. Les tests `garde_anonymes` et `politiques_anonyme` comptent la nouvelle politique restrictive « Anonyme : pas de parties perso ».

`politiques_anonyme.test.sql` (advisors Supabase, règle `auth_rls_initplan`) : les dix politiques restrictives « Anonyme : … » existent toujours, mêmes commandes, sous la forme `(select auth.jwt())` ; même comportement (anonyme refusé, vrai compte et jeton sans claim acceptés) ; relevé : toute fonction `security definer` a `search_path` vide, seule `apercu_defi` est exécutable par `anon`, les fonctions internes et de cote sont fermées à `authenticated`.

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
