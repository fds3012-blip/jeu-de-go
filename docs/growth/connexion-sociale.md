# Connexion avec Google, Apple et Facebook : réglages pas à pas (#411)

Pour Florian. Rédigé le 3 octobre 2026 par l'agent croissance. Pourquoi ces trois-là, et pas Discord, X ou les passkeys : `docs/produit/benchmark-connexion.md`, section 0. Google seul (#354, plus détaillé sur l'écran de consentement) : `docs/growth/connexion-google-apple.md`, section 7.

**Ce qui est déjà dans l'app** (livré, caché) : un bouton par fournisseur, à la charte de chaque marque, toujours dans le même ordre (**Google, Apple, Facebook**, puis « ou », puis le code par e-mail) sur « Crée ton compte », « J'ai déjà un compte », l'arrivée par un lien de défi, et **Profil, Mon compte** (relier un moyen de plus, ou en retirer un s'il en reste un autre). Chaque bouton n'apparaît que si **sa** variable Vercel vaut `1`. Rien ne change pour les joueurs tant que tu n'as pas fait l'étape Vercel.

**Règle d'or** : les **secrets** (code secret Google, clé secrète Facebook, fichier `.p8` d'Apple) vont **seulement** dans Supabase. Jamais dans le dépôt, un message, un document, ni dans Vercel.

## 0. Les adresses à copier

| À quoi ça sert | Adresse exacte |
|---|---|
| Retour des fournisseurs vers Supabase (« Callback URL ») | `https://xjvsalkvpgcjrznznxoi.supabase.co/auth/v1/callback` |
| Domaine Supabase | `xjvsalkvpgcjrznznxoi.supabase.co` |
| Le jeu (production) | `https://jeu-de-go.vercel.app` |
| Domaine du jeu | `jeu-de-go.vercel.app` |
| Politique de confidentialité publique | `https://jeu-de-go.vercel.app/confidentialite` |
| Supabase, fournisseurs | https://supabase.com/dashboard/project/xjvsalkvpgcjrznznxoi/auth/providers |
| Supabase, adresses de retour | https://supabase.com/dashboard/project/xjvsalkvpgcjrznznxoi/auth/url-configuration |

## 1. Ordre conseillé

| Étape | Durée | Coût | Quand |
|---|---|---|---|
| 2. Supabase : adresses de retour et liaison manuelle | 3 min | 0 € | Tout de suite |
| 3. Google | 25 min | 0 € | Tout de suite (si pas déjà fait pour #354) |
| 4. Facebook | 30 min | 0 € | Tout de suite |
| 5. Apple | 40 min | **99 € par an** | **Seulement après ta décision** |
| 6. Vercel : allumer les boutons | 5 min | 0 € | Après chaque fournisseur réglé |
| 7. Vérifier sur ton téléphone | 10 min | 0 € | Après l'étape 6 |

## 2. Supabase : adresses de retour et liaison manuelle (une fois pour toutes)

1. Ouvre https://supabase.com/dashboard/project/xjvsalkvpgcjrznznxoi/auth/url-configuration
   - **Site URL** : `https://jeu-de-go.vercel.app` (normalement déjà en place).
   - **Redirect URLs** : vérifie que `https://jeu-de-go.vercel.app/**` y est. Sinon : **Add URL**, colle-la, **Save**.
   - Pour tester sur un déploiement Preview de Vercel : ajoute aussi l'adresse de ce Preview suivie de `/**` (par exemple `https://jeu-de-go-git-connexion-sociale-<ton-equipe>.vercel.app/**`).
2. Ouvre https://supabase.com/dashboard/project/xjvsalkvpgcjrznznxoi/auth/providers
   - En haut de la page, **Allow manual linking** (« liaison manuelle ») : **active-le**, puis **Save**.
   - Pourquoi : c'est ce qui permet (a) à un joueur de **relier** Google, Apple ou Facebook à son compte depuis Mon compte, et (b) à une ancienne session sans compte (défi d'avant #343) de devenir un compte **sans perdre sa partie**. Un joueur ne peut relier un moyen qu'à **son** compte, une fois connecté : aucun risque pour les autres comptes.
   - Si tu le laisses éteint : rien ne casse. Mon compte affiche « Relier un autre moyen n'est pas encore possible », et l'ancienne session sans compte passe par une connexion classique avec rattachement de sa partie (#355 ; la migration `rattacher_session_anonyme` doit être appliquée pour que la partie suive).
   - Note : `docs/growth/connexion-google-apple.md` (7.5, point 6) disait de laisser ce réglage éteint ; ce guide le remplace.

## 3. Google (0 €)

Si tu l'as déjà fait pour #354, passe à l'étape 4. Sinon, suis `docs/growth/connexion-google-apple.md`, sections **7.1 à 7.5**. En bref :

1. https://console.cloud.google.com : **Nouveau projet** `Jeu de go`. **N'active aucune facturation.**
2. **Écran de consentement** : https://console.cloud.google.com/auth/overview, **Commencer** ; nom `Jeu de go` ; audience **Externe**.
   - **Branding** (https://console.cloud.google.com/auth/branding) : page d'accueil `https://jeu-de-go.vercel.app`, règles de confidentialité `https://jeu-de-go.vercel.app/confidentialite`, **domaines autorisés** `jeu-de-go.vercel.app` et `xjvsalkvpgcjrznznxoi.supabase.co`.
   - **Accès aux données** (https://console.cloud.google.com/auth/scopes) : seulement `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
3. **Identifiants** (https://console.cloud.google.com/auth/clients) : **Créer un client**, type **Application Web**, nom `Jeu de go web`.
   - **Origines JavaScript autorisées** : `https://jeu-de-go.vercel.app`
   - **URI de redirection autorisés** : `https://xjvsalkvpgcjrznznxoi.supabase.co/auth/v1/callback`
   - **Créer**. Note l'**ID client** et le **code secret** (le secret ne va que dans Supabase).
4. **Publier** : https://console.cloud.google.com/auth/audience, **Publier l'application**, **En production**.
5. **Supabase** : https://supabase.com/dashboard/project/xjvsalkvpgcjrznznxoi/auth/providers, **Google** :
   - **Enable Sign in with Google** : activé.
   - **Client IDs** : l'ID client. **Client Secret (for OAuth)** : le code secret.
   - **Skip nonce check** : désactivé.
   - **Save**.

## 4. Facebook (0 €)

Il faut un compte Facebook personnel (le tien) ; l'app Meta est gratuite.

### 4.1 Créer l'app Meta

1. Ouvre https://developers.facebook.com/apps et connecte-toi. Si on te le demande, **inscris-toi comme développeur** (gratuit : confirmation par SMS ou e-mail).
2. **Créer une app**.
   - **Nom de l'app** : `Jeu de go`. **E-mail de contact** : ton adresse.
   - **Cas d'utilisation** : choisis **« Authentifier et demander des données aux utilisateurs avec Facebook Login »** (Authenticate and request data from users with Facebook Login).
   - **Entreprise** : « Je ne veux pas associer de portefeuille d'entreprise pour l'instant ». Pas besoin de vérification d'entreprise pour la connexion.
   - **Créer l'app** (Meta peut redemander ton mot de passe Facebook).

### 4.2 Permissions : e-mail obligatoire

1. Menu de gauche : **Cas d'utilisation** (Use cases), puis **Personnaliser** (Customize) sur « Authentification et création de compte ».
2. Vérifie que **`public_profile`** et **`email`** sont là, avec l'état **Prêt pour les tests** (Ready for testing). Si `email` manque : **Ajouter**.
3. **Rien d'autre.** Sans `email`, Facebook ne donne pas l'adresse et la connexion échoue.

### 4.3 Adresse de retour (Valid OAuth Redirect URIs)

1. Toujours dans **Cas d'utilisation**, **Personnaliser**, onglet ou lien **Paramètres** de Facebook Login (Facebook Login → Settings).
2. **URI de redirection OAuth valides** (Valid OAuth Redirect URIs) : colle exactement
   `https://xjvsalkvpgcjrznznxoi.supabase.co/auth/v1/callback`
   (sans barre oblique finale ni espace).
3. Laisse **Connexion OAuth cliente** et **Connexion OAuth Web** activés ; **Forcer HTTPS** activé ; **Connexion depuis des appareils** désactivée.
4. **Enregistrer les modifications**.

### 4.4 Paramètres de base (obligatoires pour passer en « Live »)

**Paramètres de l'app** → **Général** (Settings → Basic) :

| Champ | Valeur |
|---|---|
| Domaines de l'app (App Domains) | `jeu-de-go.vercel.app` |
| URL de la politique de confidentialité | `https://jeu-de-go.vercel.app/confidentialite` |
| URL des conditions de service | `https://jeu-de-go.vercel.app/confidentialite` (même page : conditions et confidentialité) |
| Instructions de suppression des données (User data deletion → Data deletion instructions URL) | `https://jeu-de-go.vercel.app/confidentialite` (la page explique : Profil, Mon compte, Supprimer mon compte ; ou retirer Facebook dans Mon compte) |
| Icône de l'app (1024 × 1024) | `public/icon-512.png` agrandi, ou l'icône du jeu en 1024 px |
| Catégorie | **Jeux** (Games) |

**Enregistrer**. Note l'**ID de l'app** (en haut) et, sous **Clé secrète** (App Secret), clique **Afficher** : c'est le secret, il ne va que dans Supabase.

### 4.5 Passer l'app en « Live »

1. En haut de la page de l'app : **Mode de l'app : Développement** → bascule sur **Live** (ou menu **Publier**).
2. Meta vérifie que les champs de 4.4 sont remplis. Avec seulement `public_profile` et `email`, **pas d'examen détaillé** (« App Review ») en général. Si Meta en demande un : décris « Connexion au jeu de go ; on utilise seulement l'e-mail pour créer le compte ; le nom et la photo ne sont pas gardés », et envoie-moi la demande exacte.
3. Tant que l'app est en **Développement**, seuls toi et les testeurs ajoutés (**Rôles de l'app** → **Rôles**) peuvent se connecter ; les autres voient « App non configurée ». Pratique pour tester avant l'étape 6.

### 4.6 Activer Facebook dans Supabase

1. https://supabase.com/dashboard/project/xjvsalkvpgcjrznznxoi/auth/providers, **Facebook**.
2. **Facebook enabled** : activé.
3. **Facebook client ID** : l'ID de l'app (4.4). **Facebook secret** : la clé secrète (4.4).
4. Vérifie que la **Callback URL** affichée est bien `https://xjvsalkvpgcjrznznxoi.supabase.co/auth/v1/callback` (la même qu'en 4.3).
5. **Save**.

## 5. Apple (99 € par an : seulement après ta décision)

**Rien à faire tant que tu n'as pas décidé.** Sur le web, Apple sert les joueurs sur iPhone ; pour l'app iOS (Capacitor), la règle 4.8 de l'App Store le rend en pratique obligatoire dès qu'on propose Google ou Facebook (voir le benchmark, 0.3).

1. **Apple Developer Program** : https://developer.apple.com/programs/enroll/ (99 € par an). En individuel (plus rapide) ou au nom d'une société (numéro D-U-N-S gratuit, quelques jours).
2. **App ID** : https://developer.apple.com/account/resources/identifiers/list → **+** → **App IDs** → **App**.
   - Description `Jeu de go`. Bundle ID explicite, par exemple `app.jeudego` (le même servira à l'app iOS).
   - Coche **Sign In with Apple**. **Continue**, **Register**.
3. **Services ID** (pour le web) : https://developer.apple.com/account/resources/identifiers/list/serviceId → **+** → **Services IDs**.
   - Description `Jeu de go web`. Identifier `app.jeudego.web`. **Register**.
   - Ouvre-le, coche **Sign In with Apple**, **Configure** :
     - **Primary App ID** : celui de l'étape 2.
     - **Domains and Subdomains** : `xjvsalkvpgcjrznznxoi.supabase.co`
     - **Return URLs** : `https://xjvsalkvpgcjrznznxoi.supabase.co/auth/v1/callback`
   - **Next**, **Done**, **Continue**, **Save**.
4. **Clé** : https://developer.apple.com/account/resources/authkeys/list → **+**.
   - Nom `Jeu de go Sign in with Apple`, coche **Sign in with Apple**, **Configure** → Primary App ID de l'étape 2 → **Save**, **Continue**, **Register**.
   - **Download** : le fichier `AuthKey_XXXXXXXXXX.p8` ne se télécharge **qu'une fois**. Range-le dans ton gestionnaire de mots de passe, **jamais** dans le dépôt.
   - Note le **Key ID** (10 caractères) et ton **Team ID** (en haut à droite du compte développeur).
5. **E-mails vers les adresses relais** (sinon les joueurs qui cachent leur adresse ne reçoivent pas nos codes) : https://developer.apple.com/account/resources/services/configure → **Sign in with Apple for Email Communication** → **+** : ajoute le domaine et l'adresse d'envoi de nos e-mails (ceux du SMTP de `docs/growth/connexion-code.md`, étape 4).
6. **Supabase** : https://supabase.com/dashboard/project/xjvsalkvpgcjrznznxoi/auth/providers, **Apple** :
   - **Enable Sign in with Apple** : activé.
   - **Client IDs** : `app.jeudego.web` (le Services ID ; plus tard, ajoute le Bundle ID de l'app iOS, séparé par une virgule).
   - **Secret Key (for OAuth)** : utilise l'outil de génération proposé sur cette page Supabase (dans **Chrome ou Firefox**, pas Safari) avec le `.p8`, le Key ID, le Team ID et le Services ID. Colle le résultat. **Save**.
7. **Rappel dans ton agenda, tous les 5 mois** : cette clé secrète **expire au bout de 6 mois**. Regénère-la (étape 6) et recolle-la, sinon « Continuer avec Apple » tombe sans prévenir.
8. **À faire avant l'app iOS** (issue à ouvrir, front + backend) : à la suppression d'un compte Apple, révoquer le jeton auprès d'Apple (exigence de l'App Store) ; Supabase ne le fait pas seul.

## 6. Vercel : allumer les boutons

Un bouton n'apparaît que si sa variable vaut `1`. **Allume un fournisseur seulement après l'avoir réglé dans Supabase** (sinon le bouton mènerait à une erreur).

1. Vercel, projet du jeu, **Settings** → **Environment Variables**.
2. Ajoute, selon ce que tu as réglé, en type normal (pas « Secret » : ces valeurs sont publiques, ce sont juste des interrupteurs), pour **Production** (et **Preview** si tu veux tester avant) :

| Variable | Valeur | Après |
|---|---|---|
| `VITE_AUTH_GOOGLE` | `1` | Étape 3 |
| `VITE_AUTH_FACEBOOK` | `1` | Étape 4 (app Meta en Live) |
| `VITE_AUTH_APPLE` | `1` | Étape 5 |

3. **Deployments** → le dernier déploiement → **⋯** → **Redeploy** (les variables `VITE_` sont lues à la construction).
4. Pour retirer un bouton : supprime sa variable (ou vide-la), puis **Redeploy**. Les comptes déjà créés avec ce moyen gardent le code par e-mail (même adresse).

## 7. Vérifier (10 minutes, sur ton téléphone)

1. **Chrome Android ou Safari iPhone**, fenêtre privée : ouvre `https://jeu-de-go.vercel.app`, joue jusqu'à « Crée ton compte ». Tu vois, dans l'ordre : la case d'âge, **Continuer avec Google**, **Continuer avec Apple** (si allumé), **Continuer avec Facebook**, « ou », ton e-mail, **Recevoir mon code**.
2. Coche la case, touche **Continuer avec Facebook**, accepte chez Facebook : tu reviens sur **Choisis ton pseudo**, champ **vide** (jamais ton nom Facebook). Choisis-le : la partie démarre.
3. **Profil → Mon compte** : la carte **Tes moyens de connexion** montre Facebook. Touche **Continuer avec Google** : Google est relié au **même** compte. **Retirer** Google : il disparaît ; le dernier moyen n'a pas de bouton « Retirer ».
4. Recommence avec **Annuler** chez Facebook : retour sur « Crée ton compte » avec « Connexion annulée. Réessaie, ou reçois un code par e-mail. »
5. Envoie-toi le lien du jeu dans **Messenger** et ouvre-le là : **aucun** bouton Google, Apple ou Facebook ; le code marche, avec « Tu préfères Google ou Facebook ? Ouvre le jeu dans Chrome. » (Android) ou la consigne Safari (iPhone).
6. Dans Supabase, **Authentication → Users** : ton compte de test a l'e-mail, mais **pas** ton nom ni ta photo (effacés à l'arrivée, migrations `minimisation_*`, à appliquer par l'agent backend si ce n'est pas fait).

## 8. Ce que l'app fait dans chaque cas (pour répondre aux joueurs)

| Situation | Ce que voit le joueur |
|---|---|
| Il annule chez le fournisseur | « Connexion annulée. Réessaie, ou reçois un code par e-mail. » |
| Le fournisseur ne répond pas | « Google n'a pas répondu. Reçois plutôt un code par e-mail. » (avec le bon nom) |
| Même e-mail vérifié qu'un compte existant | Connexion directe à ce compte (liaison automatique de Supabase), pas d'écran de pseudo |
| Ce compte Google (Apple, Facebook) est **déjà relié à un autre compte** du jeu | Encadré : « Ce compte Google est déjà relié à un autre compte du jeu. », un avertissement (sa partie commencée sans compte risque de ne pas le suivre, ou il quittera son compte actuel), et **Se connecter à ce compte** |
| L'adresse a déjà un compte, créé avec un autre moyen, et Supabase refuse de les relier | « Ton adresse a déjà un compte, créé avec un autre moyen. Connecte-toi avec un code par e-mail. Tu pourras ajouter Google ensuite, dans Profil. » ; l'écran passe en « Connecte-toi » |
| Facebook n'a pas vérifié l'adresse | « Facebook n'a pas confirmé ton adresse. On t'a envoyé un e-mail : touche son lien, puis reviens ici. » |
| Il veut retirer son dernier moyen | Impossible : pas de bouton « Retirer » (« Garde au moins un moyen pour te connecter. ») |

## 9. Mesure (PostHog)

- `compte_methode` : `methode` = `google`, `apple`, `facebook` ou `code`, et `navigateur_integre`. Touché sur l'écran de compte ou dans Mon compte.
- `compte_cree` : `moyen` = `code`, `lien`, `google`, `apple` ou `facebook`.
- **Indicateur** : part des écrans « Crée ton compte » (`essai_limite_atteinte`) qui finissent avec un pseudo (`pseudo_choisi`), 14 jours avant et après chaque activation. Cible : +20 % avec Google, +5 points de plus avec Apple et Facebook. Rétention J7 par moyen de création.
