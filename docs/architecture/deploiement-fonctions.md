# Déploiement des fonctions serveur Supabase

Issue #344. Le 30/09, le défi par lien était cassé en production : la fonction `game-action` n'avait pas été redéployée après #81. Elle ne connaissait pas l'action `defi_coup`, et chaque coup de l'ami revenait « Ce coup n'a pas pu être lu ».

Deux protections empêchent que ça se reproduise :

1. **Déploiement automatique** : le workflow GitHub Actions `.github/workflows/deployer-fonctions.yml` déploie les fonctions dès qu'elles changent sur `main`.
2. **Version du contrat** : la fonction renvoie sa version (`CONTRAT_GAME_ACTION`, dans `src/go/contrat.ts`). Si le serveur est plus ancien que l'app, le joueur lit « Mise à jour du serveur en cours » au lieu d'une erreur incompréhensible.

Aucun secret dans le dépôt. Aucune dépense : les minutes GitHub Actions et le déploiement des fonctions sont gratuits à ce volume.

## Ce que Florian doit faire (une seule fois, 5 minutes)

Tant que ces étapes ne sont pas faites, le workflow tourne, affiche « Déploiement des fonctions ignoré » et s'arrête sans erreur. Rien ne casse.

### 1. Créer un jeton d'accès Supabase

1. Ouvre https://supabase.com/dashboard/account/tokens (Account → Access Tokens).
2. Clique **Generate new token**.
3. Nom : `github-actions-jeu-de-go`. Durée : la plus longue proposée, puis note la date d'expiration dans ton agenda.
4. Copie le jeton (il commence par `sbp_`). Il ne s'affiche qu'une fois. Ne le colle nulle part ailleurs qu'à l'étape 2.

Ce jeton agit en ton nom sur tous tes projets Supabase. Il vit seulement dans les secrets GitHub, chiffré, et n'apparaît jamais dans les journaux.

### 2. L'ajouter dans GitHub

1. Ouvre https://github.com/fds3012-blip/jeu-de-go/settings/secrets/actions.
2. **New repository secret**.
3. Name : `SUPABASE_ACCESS_TOKEN`. Secret : le jeton copié. **Add secret**.

Mets-le bien dans les secrets **du dépôt** (Repository secrets), pas dans un environnement.

### 3. (Facultatif) Vérification après chaque déploiement

Pour que le workflow vérifie que la bonne version répond vraiment en production :

1. Ouvre https://github.com/fds3012-blip/jeu-de-go/settings/variables/actions.
2. **New repository variable** (onglet Variables, pas Secrets).
3. Name : `SUPABASE_PUBLISHABLE_KEY`. Value : la clé publique du projet (Supabase → Project Settings → API Keys → `publishable`, ou l'ancienne clé `anon`). C'est la même clé que celle déjà utilisée par l'app : elle est publique.

Ne mets **jamais** la clé `service_role` (ou `secret`) dans GitHub.

### 4. Premier déploiement, pour vérifier

1. Ouvre https://github.com/fds3012-blip/jeu-de-go/actions/workflows/deployer-fonctions.yml.
2. **Run workflow** → branche `main` → **Run workflow**.
3. Au bout d'une à deux minutes, le job « Déployer les fonctions » doit être vert. Dans Supabase → Edge Functions → `game-action`, la version augmente de 1.

## Comment ça marche

- **Déclencheur** : un push sur `main` qui touche `supabase/functions/**`, `src/go/**` (les règles du go sont copiées dans la fonction), `scripts/sync-functions.mjs` ou le workflow lui-même. Aussi à la main (Run workflow).
- **Job « Secret présent ? »** : regarde si `SUPABASE_ACCESS_TOKEN` existe. Sinon, le job de déploiement est sauté (gris, pas rouge).
- **Job « Déployer les fonctions »** :
  1. refait la copie `src/go` → `supabase/functions/game-action/go` et échoue si elle diffère du dépôt (on ne déploie que ce que la CI a testé) ;
  2. installe la CLI Supabase et lance `supabase functions deploy <nom> --project-ref xjvsalkvpgcjrznznxoi` pour chaque dossier de `supabase/functions` (sauf ceux qui commencent par `_`) ;
  3. si la variable `SUPABASE_PUBLISHABLE_KEY` existe, appelle `game-action` avec `{ "action": "version" }` et vérifie que le contrat renvoyé est celui du dépôt.
- La vérification du jeton (`verify_jwt`) reste active, comme aujourd'hui en production.
- Deux fusions rapprochées : les déploiements passent l'un après l'autre, aucun n'est annulé.

Les **migrations SQL ne sont pas déployées** par ce workflow : elles restent appliquées à la main, après relecture.

## Version du contrat (`CONTRAT_GAME_ACTION`)

- Définie dans `src/go/contrat.ts`, copiée dans la fonction par `npm run sync:functions`.
- `POST game-action { "action": "version" }` → `{ "ok": true, "contrat": 3 }`, sans connexion ni lecture de la base.
- Historique : 1 = parties en ligne (27/09) ; 2 = `defi_coup` (#81) ; 3 = action `version` (#344).
- **Règle** : augmente-la de 1 à chaque changement de la fonction que l'app ne peut pas utiliser sur un serveur plus ancien (nouvelle action, nouveau champ obligatoire, nouveau code de refus).

Côté app, `src/data/versionServeur.ts` :

- `lireContratServeur(db)` : la version déployée ; `0` si la fonction ne connaît pas l'action `version` (serveur antérieur au contrat 3) ; `null` si le réseau ne répond pas.
- `verifierServeur(db)` : `a-jour`, `ancien` ou `injoignable`.
- `messageSiServeurAncien(db, corpsDuRefus)` : à appeler quand un coup est refusé avec le code `format` (ce que répond un serveur qui ne connaît pas l'action). Renvoie « Mise à jour du serveur en cours. Réessaie dans quelques minutes. » si le serveur est plus ancien que l'app, sinon `null`. Aucun appel en plus quand tout va bien.

Branchement dans l'écran du défi (`src/data/defi.ts`, périmètre frontend) : dans `jouerCoupDefi`, avant `messageRefus(corps)`, essayer `await messageSiServeurAncien(db, corps)`.

## Si un déploiement échoue

1. Ouvre le job rouge dans l'onglet Actions et lis la dernière étape.
2. « Copie périmée » : lance `npm run sync:functions`, committe, pousse.
3. « Unauthorized » ou « Invalid access token » : le jeton a expiré ou a été révoqué ; refais les étapes 1 et 2.
4. En urgence, sans attendre la CI : Supabase → Edge Functions → `game-action` → redéployer depuis le dépôt, ou `supabase functions deploy game-action --project-ref xjvsalkvpgcjrznznxoi` depuis un poste où la CLI est connectée.
