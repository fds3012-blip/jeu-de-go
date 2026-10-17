# Modèle de menace et revue de sécurité (octobre 2026, #578)

Revue menée le 17/10/2026 avec les skills `security-and-hardening` (et ses `references/`) et `debugging-and-error-recovery`. Elle fait suite à la revue du 29/09 (`docs/qa/securite-2026-09-29.md`) et à `docs/architecture/securite.md` (#531).

Règle du projet (CLAUDE.md) : toute règle de sécurité passe par la RLS ou par une fonction serveur, jamais par le client seul. Ce document dit où passe chaque frontière, ce qui la protège, ce qui a été corrigé, et les risques acceptés.

**État de la production au moment de la revue** (lecture seule, connecteur Supabase) : 2 comptes avec pseudo, 6 parties. RLS active sur toutes les tables de `public`. Aucune politique ouverte à `anon` ni à `public`. Toutes les fonctions `security definer` de `public` ont un `search_path` vide. Aucun bucket de stockage.

## 1. Biens à protéger

| Bien | Classe | Où |
|---|---|---|
| Session Supabase (jeton d'accès et de rafraîchissement) | Secret | Navigateur (stockage de supabase-js), fragment `#` au retour du lien e-mail |
| Clé service Supabase | Secret critique | Environnement des fonctions Edge seulement |
| Secrets `RAPPELS_SECRET`, `ALERTE_SECRET`, clés VAPID, `RESEND_API_KEY` | Secret | Secrets des fonctions Edge, Vault (pg_cron) |
| E-mail, moyens de connexion | Donnée personnelle | `auth.users`, `auth.identities` |
| Cote, historique, titres | Intégrité (équité du classement) | `profiles`, `rating_history`, `titres_joueurs` |
| Coups des parties en ligne | Intégrité | `games.moves` |
| Signalements, blocages, messages | Donnée personnelle sensible (mineurs possibles) | `signalements`, `blocages`, `messages_partie` |
| Jetons de défi et de partage | Capacité (qui a le lien peut agir ou lire) | `defis.jeton`, `parties_partagees.jeton` |
| Quotas (e-mails de connexion, avis, compteurs) | Disponibilité | Supabase Auth, `retours`, `compteurs_entonnoir` |

## 2. Frontières de confiance

```
 Navigateur (non fiable)                          Supabase (fiable)                     Tiers
 ┌──────────────────────────┐   anon / jeton   ┌──────────────────────────────┐
 │ App React, KataGo (Worker)│ ───────────────▶ │ PostgREST : RLS + fonctions    │
 │ SGF importés, liens #     │                  │ security definer               │
 │ stockage local            │ ── POST + JWT ──▶ │ Edge game-action (clé service) │
 └──────────────────────────┘                  │ Edge envoyer-rappels ─────────────▶ FCM, Mozilla, Apple, WNS
          │ données nettoyées                   │ Edge alerte-signalements ─────────▶ Resend
          ▼                                     │ pg_cron ── secret Vault ──▶ Edge │
   PostHog, Sentry (nettoyés)                   └──────────────────────────────┘
   Vercel (fichiers statiques, en-têtes)
```

| # | Frontière | Qui écrit la donnée | Contrôle |
|---|---|---|---|
| B1 | Visiteur sans session (rôle `anon`) → PostgREST | N'importe qui sur Internet | 5 fonctions ouvertes seulement (§3) ; aucune lecture de table utile ; **depuis #578, aucun droit d'écriture** |
| B2 | Joueur connecté (`authenticated`, compte ou session anonyme) → PostgREST | Le joueur, avec un client modifié | RLS (politiques par `auth.uid()`), droits de colonne, politiques restrictives « Anonyme : … », fonctions `security definer` qui revérifient tout |
| B3 | Client → fonction Edge `game-action` | Le joueur | JWT vérifié deux fois (plateforme `verify_jwt` et `auth.getUser`) ; partie rejouée par les règles de `src/go` (captures, suicide, ko, superko) ; écriture conditionnelle (coups, comptage, pierres mortes) avec la clé service |
| B4 | pg_cron → `envoyer-rappels`, `alerte-signalements` | Tâche planifiée | `verify_jwt` coupé, secret partagé de 32 caractères au moins comparé en temps constant ; secret dans Vault |
| B5 | `envoyer-rappels` → service de notification | **Le joueur** (l'adresse vient de son navigateur) | **Depuis #578** : liste blanche FCM, Mozilla, Apple, WNS (fonction et contrainte de base) |
| B6 | Clé service | Florian, GitHub Actions | Jamais dans le dépôt ni dans le client (vérifié : aucune clé ni JWT dans le dépôt ni dans l'historique) |
| B7 | Fichier SGF importé, partie OGS | Un tiers (fichier reçu, site externe) | 200 000 octets, 500 coups, 16 384 nœuds, analyse itérative (pas de récursion), noms nettoyés et coupés à 40 caractères, rendu React échappé |
| B8 | Liens partagés (`/defi#…`, `/partie#…`) | Le joueur qui partage | Jeton de 24 octets aléatoires (32 caractères), dans le fragment : jamais envoyé à Vercel, retiré avant PostHog et Sentry (`urlSensible.ts`) |
| B9 | App → PostHog, Sentry | L'app | Sans accord : mesure d'audience exemptée, sans identifiant persistant ; identifiant et Sentry après accord (`analytics.ts`) ; fragment et paramètres sensibles retirés (`urlSensible.ts`), utilisateur Sentry réduit à son identifiant |
| B10 | Vercel → navigateur | Le dépôt | CSP bloquante + balise meta à empreintes SHA-256 des scripts en ligne, HSTS 2 ans, `X-Frame-Options: DENY`, `nosniff`, `Permissions-Policy` |
| B11 | Réseau KataGo (raw.githubusercontent.com ou copie) | Dépôt KataGo | Empreinte SHA-256 vérifiée (`src/engine/katago/loader.ts`) ; des poids ne sont jamais du code |
| B12 | Profil public #560 | Le joueur consulté (pseudo, parties) | `profil_public` : compte avec pseudo, 60 consultations par heure, rien en cas de blocage |
| B13 | Formulaire d'avis #537 | N'importe qui (anon) | `envoyer_retour` : listes fermées, 1 000 caractères, 20 par minute et 500 par jour **pour tout le projet** |
| B14 | Titres mensuels #561 | Serveur seulement | `calculer_titres_mensuels` fermée à l'app ; lit `rating_history`, que seul le serveur écrit |

## 3. STRIDE par frontière

| Frontière | Menace | Défense en place | Reste |
|---|---|---|---|
| B1 anon | **E** écrire dans une table | RLS (aucune politique pour anon) ; **#578 : droits retirés** | — |
| B1 anon | **D** saturer `envoyer_retour` (500 par jour) ou `compter_etape` (20 000 par jour) | Plafonds globaux, refus comptés | Accepté (R3) |
| B1 anon | **I** deviner un jeton de défi ou de partage (`apercu_defi`, `lire_partage`) | 192 bits d'aléa | — |
| B2 joueur | **T** modifier sa cote ou son historique | Aucune écriture directe ; fonctions de cote fermées ; **#578 : droits retirés** | Cote gonflable avec un second compte (S4 du 29/09, accepté) |
| B2 joueur | **T** créer une partie entre humains déjà jouée | `games_guard_insert` remet tout à zéro, komi 6,5 si classée | — |
| B2 joueur | **I** lire les parties et le pseudo d'un joueur qui l'a bloqué | `profil_public` rend NULL | Contournable par lecture directe (R1) |
| B2 joueur | **I** énumérer les pseudos | Plafonds par fonction (amis 20/24 h, profil 60/h, signalement 10/24 h) | `profiles` et `leaderboard` lisibles par tout joueur connecté (R1) |
| B2 joueur | **D** dépasser la limite de défis en attente par appels simultanés | **#578 : verrou du profil** (S2 du 29/09) | — |
| B3 game-action | **T** coup illégal, hors tour, double coup | Partie rejouée, écriture conditionnelle | — |
| B3 game-action | **I** message SQL brut renvoyé et affiché | **#578 : codes traduits, message brut dans les journaux seulement** (S3 du 29/09) | — |
| B3 game-action | **S** CORS `*` | Jeton porteur (pas de cookie) : une autre origine n'agit pas au nom du joueur | Accepté (R4) |
| B4 tâches | **S** appeler la fonction sans la tâche | Secret ≥ 32 caractères, temps constant | — |
| B5 rappels | **SSRF** : POST depuis Supabase vers l'hôte de son choix | **#578 : liste blanche** | — |
| B7 SGF | **D** fichier énorme ou très profond | Plafonds, analyse itérative | — |
| B8 liens | **I** jeton dans les journaux de Vercel, PostHog, Sentry | Fragment, nettoyage | — |
| B10 Vercel | **T** XSS | Aucun `dangerouslySetInnerHTML`, `innerHTML`, `eval` dans `src` ; CSP à empreintes | — |
| Auth | **S** deviner le code à 6 chiffres reçu par e-mail | Limites de vérification de Supabase | Validité d'une heure (F7, à décider) |
| Auth | **D** épuiser le quota de 100 e-mails par heure du projet | Turnstile prêt, **pas encore activé** | F8, à faire par Florian |

## 4. Constats et corrections

Gravité : sur l'état actuel de la production (2 comptes), en tenant compte de ce qui arrive à l'ouverture au public.

| # | Constat | Gravité | Preuve | Suite |
|---|---|---|---|---|
| F1 | **SSRF aveugle par le rappel quotidien** : l'adresse d'abonnement (`abonnements_rappel.endpoint`) n'était contrainte qu'à `https://` ; `envoyer-rappels` envoie un POST chiffré vers cette adresse avec l'infrastructure de Supabase | Moyenne, **latente** (la table n'existe pas encore en production) | `20261001000100_abonnements_rappel.sql:25` ; `envoyer-rappels/logique.ts` | **Corrigé** : `endpointAutorise` (fonction) et contrainte `abonnements_rappel_service_connu` (migration). Tests : `src/data/envoyerRappels.test.ts`, `durcissement_578.test.sql` |
| F2 | **Messages SQL bruts** renvoyés par `game-action` (fin aux points, coup de défi par l'action `move`), affichés tels quels par l'app en français | Faible | S3 du 29/09, toujours ouvert ; `game-action/index.ts` | **Corrigé** : conflit générique ou `refusDepuisSql`, message brut dans les journaux. Test : `src/data/gameActionErreurs.test.ts` |
| F3 | **anon gardait insert, update, delete** sur `achievements`, `games`, `leaderboard`, `lesson_progress`, `match_queue`, `puzzle_attempts`, `puzzles`, `rating_history` (droits par défaut de Supabase) ; seule la RLS bloquait | Faible (défense en profondeur) | Relevé `has_table_privilege` en production | **Corrigé** : retrait, et privilèges par défaut des futures tables |
| F4 | **authenticated gardait des droits sans politique** (écrire `rating_history`, `puzzle_attempts`, `match_queue`, modifier `achievements`, `puzzles`, supprimer `lesson_progress`, écrire `leaderboard`) | Faible (défense en profondeur) | Idem ; aucune fonction `invoker` ni écriture directe de l'app ne s'en sert | **Corrigé** |
| F5 | **Course sur `creer_defi`** : compte des défis en attente sans verrou | Faible | S2 du 29/09, toujours ouvert | **Corrigé** : verrou du profil |
| F6 | **Écart dépôt / production** : `20261001000100_abonnements_rappel.sql` n'est pas appliquée (`reclamer_rappels` absente), alors que `envoyer-rappels` est déployée | Information (pas une faille) | `list_migrations`, `to_regclass` | À appliquer par Florian **avant** la migration de #578, ou la partie 3 de celle-ci est sautée |
| F7 | **Code de connexion valable une heure** (`mailer_otp_exp: 3600`, 6 chiffres) | Faible à moyenne à l'ouverture | `supabase/auth/reglages.json` | À décider : 600 s (10 minutes) suffisent pour un e-mail |
| F8 | **Quota d'e-mails commun** (`rate_limit_email_sent: 100` par heure) sans captcha actif : un script bloque toutes les connexions | Moyenne à l'ouverture (disponibilité) | Idem ; `securite.md` §4 | À faire : activer Turnstile (étapes déjà écrites) |
| F9 | `http://localhost:5173/**` dans les adresses de retour autorisées de la production | Très faible | `uri_allow_list` | À décider : le retirer en production |

Aucune clé ni secret à changer : aucun secret trouvé dans le dépôt ni dans l'historique git.

### Faux positifs écartés

- **`lienChrome(window.location.href)`** (`src/app/navigateurIntegre.ts`) : l'adresse courante entre dans un lien `intent://`. Le fragment est retiré et `URL` encode `#` dans la requête : pas d'injection d'extras d'intent.
- **`games_guard_insert`** : un joueur qui crée une partie entre humains ne peut ni pré-remplir les coups, ni choisir le résultat ou le komi d'une partie classée.
- **Avis Supabase « RLS sans politique »** (14 tables) : voulu, seules des fonctions `security definer` y accèdent (`securite.md` §1).
- **Avis « SECURITY DEFINER exécutable par anon / authenticated »** : liste attendue (5 et 53) ; chaque fonction revérifie session, pseudo et droits. Garde : `politiques_anonyme.test.sql`.
- **Avis « Anonymous Access Policies »** : politiques `to authenticated` lues aussi par les sessions anonymes, voulu (`securite-2026-09-29.md` S7). `cron.job` : objet de Supabase.
- **Vue `leaderboard`** : ses droits d'écriture ne servaient à rien, la vue n'est pas modifiable (fonction de fenêtre `rank()`).
- **Dépendances de production** : `sprintf-js` (modérée) vient de l'outil en ligne de commande de `@tensorflow/tfjs-converter`, absent du bundle.

## 5. Risques acceptés

| # | Risque | Raison | Revoir |
|---|---|---|---|
| R1 | Tout joueur connecté lit le pseudo, la cote et le pays de tous (`profiles`, `leaderboard`) et les parties publiques entre humains (`games`, temps réel compris). Le blocage cache le profil public (#560), pas ces lectures directes. Les plafonds de `profil_public` ne bornent donc pas l'énumération des pseudos | Choix D4 de #530 : un classement public est le cœur du jeu (modèle chess.com) ; défis et parties d'amis sont privés (`prive`) | Si le blocage doit tout cacher : passer `games` et `profiles` par des fonctions, ou filtrer `est_bloque` dans les politiques de lecture |
| R2 | `join_game` et la création directe d'une partie entre humains restent ouverts, alors que l'app ne s'en sert plus (défis, file) | Les fermer touche deux autres chantiers et leurs tests ; aucun gain contre S4 (la file permet la même chose) | Avec la validation des coups côté serveur pour toutes les parties |
| R3 | Avis (500 par jour) et compteurs (20 000 par jour) : plafonds pour tout le projet, qu'un seul script peut remplir | Pas d'IP fiable dans Postgres ; perte bornée (avis du jour, statistiques) ; aucune donnée exposée | Si cela arrive : Turnstile devant l'avis |
| R4 | `game-action` répond `Access-Control-Allow-Origin: *` | Jeton porteur, jamais de cookie ; l'app Capacitor aura une autre origine | À l'arrivée d'un cookie de session |
| R5 | Session supabase-js dans le stockage du navigateur | Fonctionnement standard d'une SPA Supabase ; la CSP à empreintes est la protection contre le vol par XSS | — |
| R6 | Dépendances de développement : `vitest` 3.2.7 (critique : lecture de fichier par un mock), `tinypool` 1.1.1 (critique : pollution de prototype), `source-map-js` 1.2.1 (haute : déni de service) | Jamais dans le bundle ; seuls nos propres tests et nos propres cartes de source les atteignent. La montée de Vitest 3 → 4 est majeure et le fichier de verrouillage est en cours de modification sur une autre branche | 31/12/2026 : passer à `vitest` ≥ 4.1.11 et `source-map-js` ≥ 1.2.2 dans une PR dédiée |
| R7 | Badges (`achievements`) : un client modifié peut s'en donner | Récompenses cosmétiques gagnées hors ligne ; ni cote ni classement | — |
| R8 | Le visiteur garde `select` sur `puzzles` | La RLS ne lui rend aucune ligne ; retirer le droit transformerait une liste vide en erreur pour le client | — |

## 6. À faire par Florian

1. **Appliquer** `supabase/migrations/20261001000100_abonnements_rappel.sql` (rappel #36, absente de la production), **puis** `supabase/migrations/20261017090000_durcissement_578.sql`. Après chaque migration : relancer les avis de sécurité Supabase. Attendu : la même liste qu'avant, aucun nouvel avis.
2. **Activer Turnstile** (F8) : étapes de `docs/architecture/securite.md` §4, avant l'ouverture au public.
3. **Décider** (F7, F9) : `mailer_otp_exp` de 3600 à 600 dans `supabase/auth/reglages.json` ; retirer `http://localhost:5173/**` de `uri_allow_list` en production. Ces deux changements passent par une PR, appliquée par le workflow « Réglages de connexion Supabase ».
4. **Décider** (D3, `securite.md` §5) : couper les connexions anonymes. Elles ne servent plus qu'aux défis commencés avant #343.

## 7. Comment refaire cette revue

1. Avis Supabase (sécurité) et relevé des droits : `has_table_privilege` et `has_function_privilege` pour `anon` et `authenticated` sur `public`, `pg_policies`, `proconfig` des fonctions `security definer`.
2. Comparer `list_migrations` de la production aux fichiers de `supabase/migrations` (par nom).
3. `bash supabase/tests/lancer.sh` (Postgres 16 jetable).
4. `npm audit --omit=dev`, puis `npm audit` : trier par atteignabilité, jamais `npm audit fix --force`.
5. Côté client : chercher `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, et les `href` dynamiques ; relire `urlSensible.ts` à chaque nouveau paramètre d'URL.
