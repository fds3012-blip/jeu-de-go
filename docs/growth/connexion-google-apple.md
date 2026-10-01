# Connexion avec Google (et Apple plus tard) : recommandation et réglages (#354)

Pour Florian et l'équipe. Rédigé le 1er octobre 2026 par l'agent produit. Benchmark complet et sources : `docs/produit/benchmark-connexion.md`. Suite de `docs/growth/connexion-code.md` (code à 6 chiffres, #343).

## 1. La recommandation en 5 lignes

1. **Maintenant (0 €)** : ajouter **« Continuer avec Google »** au-dessus du code par e-mail, via Supabase Auth ; le code par e-mail reste et marche partout.
2. **Dans Messenger, Instagram, Facebook, TikTok** (Google y est bloqué, erreur `disallowed_useragent`) et dans l'app installée sur iPhone : **cacher Google**, garder le code comme action principale, proposer d'ouvrir le jeu dans Chrome ou Safari.
3. **Ensuite (0 €)** : bouton Google officiel + **One Tap** (sans redirection) sur Chrome et Android, une fois le premier gain mesuré.
4. **Apple : pas maintenant.** Il exige l'Apple Developer Program, **99 € (99 $) par an : décision de Florian**. Il deviendra nécessaire à la sortie sur l'App Store (règle 4.8), pas avant.
5. **Ni Facebook, ni Discord, ni SMS** : peu utiles pour notre public, un bouton de plus brouille l'écran.

## 2. Ce que ça coûte

| Élément | Coût | Décision |
|---|---|---|
| Google (Google Cloud, écran de consentement, client OAuth) | **0 €** (portées de base `openid`, `email`, `profile` : pas de vérification Google) | Peut se faire tout de suite |
| Supabase, fournisseur Google ou Apple | 0 € (offre gratuite) | — |
| Vérification de la marque chez Google (nom et logo sur l'écran Google) | 0 €, quelques jours ouvrés | Conseillée ; demande une page de politique de confidentialité publique (voir 6.4) |
| **Apple Developer Program** | **99 € (99 $) par an** | **Accord de Florian obligatoire.** Rien n'est engagé |
| Domaine propre (`jeudego.fr`, par exemple) | environ 10 € par an | **Accord de Florian.** Optionnel ; aide la confiance et la vérification de la marque |
| Domaine personnalisé Supabase (`auth.<domaine>` au lieu de `xjvsalkvpgcjrznznxoi.supabase.co` sur l'écran Google) | Offre payante Supabase + module | **Pas recommandé** : la phase 2 (bouton Google officiel) affiche déjà notre adresse |

## 3. Pourquoi cet ordre

- Le code par e-mail est notre force (même choix que Supercell) : il marche dans Messenger, ce que Google ne fait pas. Mais il fait sortir le joueur du jeu pour lire sa boîte mail, et c'est là qu'on le perd.
- Google supprime cette étape. Chez Pinterest et Reddit, le bouton Google a apporté **+47 à +60 %** d'inscriptions sur le web ; les synthèses du secteur donnent **+20 à 40 %**. Il est gratuit et se règle en 20 minutes.
- Apple n'apporte rien sur Android ni sur ordinateur ; sur iPhone, Safari remplit déjà l'e-mail et iOS propose le code reçu au-dessus du clavier. Son coût (99 €/an, clé à renouveler tous les 6 mois) se justifie à la sortie App Store, où il devient quasi obligatoire.

## 4. L'écran cible « Crée ton compte »

**Une action principale** : le premier bouton. Il change selon l'endroit où le joueur se trouve.

### 4.1 Navigateur normal (Chrome Android, Safari iOS, ordinateur)

```
┌──────────────────────────────────────┐
│  Crée ton compte                     │
│  Tu as joué tes 3 parties d'essai.   │  ← raison (déjà dans l'app)
│  Bravo ! Crée ton compte pour        │
│  continuer à jouer.                  │
│                                      │
│  ✓ ta progression  ✓ ta série  …     │  ← ce qui est gardé (déjà)
│                                      │
│  ☐ J'ai 15 ans ou plus, ou un parent │  ← case âge (déjà, #343)
│    est d'accord. J'accepte …         │
│                                      │
│  [ G  Continuer avec Google        ] │  ← ACTION PRINCIPALE
│                                      │
│  ──────────── ou ────────────        │
│  Ton e-mail  [________________]      │
│  [   Recevoir mon code            ]  │  ← bouton secondaire (contour)
│                                      │
│  Pas de mot de passe.                │
│  Plus tard                           │
└──────────────────────────────────────┘
```

Règles :
- La **case d'âge reste au-dessus des deux moyens** et vaut pour les deux. Toucher Google sans la case affiche « Coche la case pour créer ton compte. » (comme aujourd'hui pour le code).
- Le bouton Google suit la charte de Google : fond blanc (ou sombre en mode sombre), « G » en couleurs, texte « Continuer avec Google ». Hauteur 48 px (cible tactile ≥ 44 px), pleine largeur, mêmes coins que nos boutons.
- Le champ e-mail reste visible (pas caché derrière « Autre moyen ») : le joueur de club qui n'aime pas Google voit tout de suite son chemin.
- **Après Google** : écran « Choisis ton pseudo » (déjà en place). **Ne jamais pré-remplir le pseudo avec le nom Google** : le pseudo est public et la règle est « évite ton vrai nom ».
- Si le compte existe déjà (même e-mail, venu du code) : connexion directe, pas d'écran de pseudo.

### 4.2 Navigateur intégré (Messenger, Facebook, Instagram, TikTok, LINE, Snapchat)

- **Pas de bouton Google** (il mènerait à « Accès bloqué »).
- Action principale : **Recevoir mon code** (bouton plein).
- Sous le bouton, un lien discret :
  - Android : « Tu préfères Google ? Ouvre le jeu dans Chrome » → lien `intent://` vers Chrome, avec repli sur la même page.
  - iOS : « Tu préfères Google ? Touche ⋯ puis « Ouvrir dans le navigateur ». »
- Détection : agent utilisateur contenant `FBAN`, `FBAV`, `FB_IAB`, `MessengerForiOS`, `Orca-Android`, `Instagram`, `Line/`, `Snapchat`, `TikTok`, `musical_ly` (base déjà dans `src/app/installation.ts`). En cas de doute, montrer Google : le code reste à côté.

### 4.3 App installée sur l'écran d'accueil iPhone (PWA autonome)

- Phase 1 : **pas de bouton Google** (la session reviendrait dans Safari, pas dans l'app) ; code par e-mail en principal.
- Phase 2 : bouton Google officiel (fenêtre surgissante, `signInWithIdToken`) : il marche aussi ici, on le réaffiche.

### 4.4 Plus tard, app iOS (Capacitor), si Florian accepte Apple

Ordre : **Continuer avec Apple**, **Continuer avec Google**, puis e-mail + code. Apple demande que son bouton soit au moins aussi visible que les autres. Sur Android : Google, puis e-mail ; Apple n'est pas montré.

### 4.5 Textes (catalogue `src/content/i18n`)

Noms de clés proposés ; le front choisit les noms définitifs. Tutoiement, phrases courtes.

| Clé proposée | Français | English |
|---|---|---|
| `connexion.google` | Continuer avec Google | Continue with Google |
| `connexion.apple` (plus tard) | Continuer avec Apple | Continue with Apple |
| `connexion.ou` | ou | or |
| `connexion.emailSecondaire` | Recevoir mon code | Get my code |
| `connexion.google.attente` | Connexion avec Google… | Signing in with Google… |
| `connexion.google.annule` | Connexion annulée. Réessaie, ou reçois un code par e-mail. | Sign-in cancelled. Try again, or get a code by email. |
| `connexion.google.erreur` | Google n'a pas répondu. Reçois plutôt un code par e-mail. | Google didn't respond. Get a code by email instead. |
| `connexion.integre.android` | Tu préfères Google ? Ouvre le jeu dans Chrome. | Prefer Google? Open the game in Chrome. |
| `connexion.integre.ios` | Tu préfères Google ? Touche ⋯ puis « Ouvrir dans le navigateur ». | Prefer Google? Tap ⋯ then "Open in browser". |
| `creer.gratuit` (à mettre à jour) | C'est gratuit. Pas de mot de passe. | It's free. No password. |
| `profil.connexions.titre` | Connexion | Sign-in |
| `profil.connexions.google` | Google relié ({email}) | Google linked ({email}) |
| `profil.connexions.code` | Code par e-mail ({email}) | Email code ({email}) |
| `profil.connexions.googleRevoquer` | Pour retirer l'accès de Google, va dans ton compte Google, rubrique « Applications tierces ». | To remove Google access, open your Google account, "Third-party apps". |

## 5. Comment ça marche avec Supabase (pour le front et le backend)

### 5.1 Phase 1 : Google par redirection

- Appel : `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + <chemin de retour> } })`.
- Notre client est en flux `implicit` (`src/data/supabase.ts`) : la session revient dans l'adresse et `detectSessionInUrl` la lit. Le flux PKCE serait plus sûr pour OAuth, mais casserait le lien magique ouvert dans un autre navigateur (la raison du choix #343). **Garder `implicit`** ; à revoir si le lien magique disparaît.
- Avant de partir chez Google, **garder sur l'appareil** ce que le joueur voulait faire (la raison de l'écran : défi, partie, leçon) pour l'y renvoyer au retour. La case d'âge cochée doit être enregistrée au retour (même preuve que pour le code : date et version des conditions, D2 de `docs/juridique/compte-obligatoire.md`).
- Le service worker (`public/sw.js`) ne doit pas mettre en cache le retour de Google.

### 5.2 Phase 2 : bouton Google officiel et One Tap

- Bibliothèque Google Identity Services, chargée **seulement à l'ouverture de l'écran de compte**, puis `supabase.auth.signInWithIdToken({ provider: 'google', token, nonce })` (nonce brut à Supabase, haché SHA-256 à Google).
- Avantages : pas de redirection (marche dans l'app installée sur iPhone), l'écran Google affiche **notre adresse** au lieu de `xjvsalkvpgcjrznznxoi.supabase.co`, One Tap sur Chrome et Android.
- Limites : FedCM absent de Safari (One Tap réduit) ; jamais dans les WebView.

### 5.3 Liaison de comptes

- **Même e-mail** : Supabase relie **automatiquement** l'identité Google au compte existant créé par code (e-mail vérifié des deux côtés). Le joueur retrouve son pseudo, sa série, ses parties. Rien à coder.
- Un compte créé par Google peut **aussi** se connecter par code avec la même adresse : c'est le même compte.
- **E-mail différent** (Google personnel, code avec l'adresse du travail) : deux comptes distincts. La liaison manuelle (`linkIdentity`) existe mais doit être activée dans Supabase ; **on ne l'active pas en phase 1**. À prévoir dans le Profil seulement si des joueurs le demandent.
- **Anciennes sessions sans compte** (défis d'avant #343) : elles gardent le code par e-mail (`updateUser` + `email_change`). Pas de Google pour elles (il faudrait `linkIdentity`).
- **Apple « Cacher mon adresse »** : adresse relais `…@privaterelay.appleid.com`, donc **jamais** reliée au compte du code. Prévenir sur l'écran Apple : « Si tu as déjà un compte, utilise la même adresse. »

### 5.4 Suppression du compte

- `delete_my_account()` (#114) efface l'utilisateur Supabase, donc aussi ses identités Google ou Apple. Rien à changer pour Google : nous ne gardons aucun jeton Google.
- Le texte de confirmation peut ajouter : « Tu peux aussi retirer l'accès dans ton compte Google. »
- **Apple** (plus tard) : l'App Store exige, à la suppression d'un compte « Sign in with Apple », de **révoquer le jeton** auprès d'Apple (API REST `revoke`). Supabase ne le fait pas : il faudra une fonction serveur. À inscrire dans l'issue Apple.

### 5.5 Mesure (agent data)

- Deux événements sans donnée personnelle : `compte_methode` `{ methode: 'google' | 'code', navigateur_integre: bool }` au toucher, et la propriété `methode` sur l'événement de compte créé.
- Indicateur : part des joueurs qui voient « Crée ton compte » et créent leur compte. **Cible : +20 % en deux semaines** après la phase 1. Si Google dépasse 50 % des créations, passer à la phase 2 (One Tap).
- Chaque nouvel événement doit être cité dans la politique, section 3.3, et dans `docs/data/plan-de-marquage.md` (sinon les tests de cohérence échouent).

## 6. RGPD, mineurs, politique à mettre à jour (agent juridique)

### 6.1 Données reçues de Google

À la connexion, Supabase reçoit et garde (`auth.identities`, `raw_user_meta_data`) : identifiant Google (`sub`), e-mail et « e-mail vérifié », **nom complet** et **adresse de la photo de profil**. Nous n'utilisons que l'e-mail. Minimisation :
- ne jamais afficher ni copier le nom ou la photo Google dans `profiles` ;
- piste backend (nouvelle migration) : effacer `full_name`, `name`, `avatar_url`, `picture` de `raw_user_meta_data` à la création par un déclencheur ; **à valider** avec le juridique (Supabase peut les réécrire à chaque connexion).

### 6.2 Données reçues d'Apple (plus tard)

Identifiant Apple, e-mail (réel ou relais), nom à la première connexion seulement (et pas du tout par le flux web). Même règle : on garde l'e-mail.

### 6.3 Ce que Google et Apple apprennent

Google (ou Apple) sait que le joueur s'est connecté au jeu, et quand. C'est leur propre traitement (responsables distincts), pas un sous-traitant. La politique doit le dire.

### 6.4 Politique de confidentialité : changements à faire

- Section « Compte joueur » : ajouter « connexion avec Google (et Apple) : identifiant du compte, e-mail, nom et photo transmis par Google, que nous n'utilisons pas » et la source (art. 14 RGPD).
- Section destinataires : Google (et Apple) comme services de connexion choisis par le joueur.
- Comment retirer l'accès : myaccount.google.com, « Applications tierces » ; réglages de l'identifiant Apple.
- Publier la politique à une **adresse publique** (par exemple `https://jeu-de-go.vercel.app/confidentialite`) : Google la demande pour l'écran de consentement et la vérification de la marque. Aujourd'hui elle n'existe que dans l'app (`src/app/Confidentialite.tsx`) : **tâche front**.

### 6.5 Mineurs

- La case « 15 ans ou plus, ou un parent est d'accord » vaut **avant** Google comme avant le code (déjà la règle de #343).
- Les comptes Google d'enfants (Family Link, moins de 13 ans) ont des connexions tierces limitées par Google : rien à faire de notre côté, le code reste possible avec l'accord du parent.
- Aucune donnée d'âge n'est lue chez Google (pas de portée « date de naissance »).

## 7. Étapes pour Florian : Google (environ 25 minutes, 0 €)

Pré-requis : le compte Google avec lequel tu veux gérer le projet. Adresse de production : `https://jeu-de-go.vercel.app`. Projet Supabase : `jeu-de-go` (réf. `xjvsalkvpgcjrznznxoi`).

**Ne fais les étapes 7.4 et 7.5 (activer Google dans Supabase) qu'une fois le bouton livré par le front** : sinon rien ne change pour les joueurs, mais c'est sans risque.

### 7.1 Créer le projet Google Cloud

1. Ouvre https://console.cloud.google.com et accepte les conditions si demandé. **N'active pas d'essai gratuit ni de facturation** : rien ici ne demande de carte bancaire.
2. En haut, menu des projets, **Nouveau projet**. Nom : `Jeu de go`. **Créer**, puis sélectionne-le.

### 7.2 Écran de consentement (Google Auth Platform)

1. Ouvre https://console.cloud.google.com/auth/overview, **Commencer** (Get started).
2. **Informations sur l'application** : nom `Jeu de go` ; e-mail d'assistance : ton adresse.
3. **Audience** : **Externe** (External).
4. **Coordonnées** : ton adresse. Accepte le règlement des données utilisateur. **Créer**.
5. **Branding** (https://console.cloud.google.com/auth/branding) :
   - Logo : `public/icon-512.png` réduit à 120 × 120 px (facultatif ; un logo déclenche la vérification de la marque, gratuite, quelques jours).
   - Page d'accueil : `https://jeu-de-go.vercel.app`.
   - Règles de confidentialité et conditions : l'adresse publique de la politique quand le front l'aura publiée (6.4).
   - **Domaines autorisés** : `jeu-de-go.vercel.app` et `xjvsalkvpgcjrznznxoi.supabase.co`. Si la console en refuse un, note le message et envoie-le-moi.
   - **Enregistrer**.
6. **Accès aux données** (https://console.cloud.google.com/auth/scopes) : **Ajouter ou supprimer des champs d'application**, coche `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. **Rien d'autre** (sinon Google exige une vérification longue). **Mettre à jour**, puis **Enregistrer**.

### 7.3 Créer le client OAuth

1. Ouvre https://console.cloud.google.com/auth/clients, **Créer un client**.
2. Type : **Application Web**. Nom : `Jeu de go web`.
3. **Origines JavaScript autorisées** : `https://jeu-de-go.vercel.app` (et `http://localhost:5173` pour les tests locaux).
4. **URI de redirection autorisés** : `https://xjvsalkvpgcjrznznxoi.supabase.co/auth/v1/callback` (copie-la plutôt depuis Supabase, étape 7.4, champ « Callback URL »).
5. **Créer**. Copie l'**ID client** et le **code secret du client**. Le code secret ne va **que** dans Supabase : jamais dans le dépôt, un message ou un document.

### 7.4 Publier l'application

https://console.cloud.google.com/auth/audience : **Publier l'application**, puis confirme **En production**. Sans cette étape, seuls 100 testeurs listés peuvent se connecter. Avec les seules portées de base, Google ne demande pas de vérification.

### 7.5 Activer Google dans Supabase

1. Tableau de bord Supabase, projet `jeu-de-go`, **Authentication**, **Sign In / Providers**, **Google**.
2. **Enable Sign in with Google** : activé.
3. **Client IDs** : l'ID client (7.3). **Client Secret** : le code secret (7.3).
4. **Skip nonce check** : **désactivé**. **Save**.
5. **Authentication**, **URL Configuration** : **Site URL** `https://jeu-de-go.vercel.app` (déjà fait pour le code). Dans **Redirect URLs**, ajoute `https://jeu-de-go.vercel.app/**`.
6. **Authentication**, **Sign In / Providers** : laisse **Manual linking** désactivé (5.3).

### 7.6 Vérifier (5 minutes, après la livraison du front)

1. Sur Chrome Android ou Safari iPhone, ouvre le jeu, joue jusqu'à « Crée ton compte », coche la case, touche **Continuer avec Google**.
2. Choisis ton compte Google : tu reviens dans le jeu, sur **Choisis ton pseudo** (si l'adresse est nouvelle) ou directement connecté (si tu as déjà un compte avec cette adresse : ton pseudo et ta série sont là).
3. Envoie-toi le lien dans **Messenger** et ouvre-le depuis Messenger : le bouton Google **n'apparaît pas**, le code marche.
4. Profil, **Supprimer mon compte** sur un compte de test Google : le compte disparaît ; une nouvelle connexion Google recrée un compte neuf.

## 8. Étapes pour Florian : Apple (seulement après ta décision, 99 € par an)

**Rien à faire tant que tu n'as pas décidé.** Quand tu le décides (au plus tard avant de soumettre l'app iOS) :

1. Adhère à l'**Apple Developer Program** (https://developer.apple.com/programs/, 99 € par an), en individuel ou au nom d'une société (une société demande un numéro D-U-N-S, gratuit, quelques jours).
2. **Certificates, Identifiers & Profiles**, **Identifiers** : crée un **App ID** (par exemple `fr.jeudego.app`), coche **Sign in with Apple**.
3. Crée un **Services ID** (par exemple `fr.jeudego.web`), active **Sign in with Apple**, **Configure** : domaine `xjvsalkvpgcjrznznxoi.supabase.co`, adresse de retour `https://xjvsalkvpgcjrznznxoi.supabase.co/auth/v1/callback`.
4. **Keys** : crée une clé avec **Sign in with Apple**, télécharge le fichier `AuthKey_XXXXXXXXXX.p8` (une seule fois possible). Range-le hors du dépôt, dans ton gestionnaire de mots de passe.
5. **Services**, **Sign in with Apple for Email Communication** : déclare le domaine et l'adresse d'envoi de nos e-mails (sinon les adresses relais Apple ne reçoivent pas nos codes).
6. Supabase, **Authentication**, **Sign In / Providers**, **Apple** : active ; **Client IDs** : le Services ID (et plus tard l'App ID pour l'app iOS) ; **Secret Key** : à générer avec l'outil de la page Supabase à partir du `.p8`, du Team ID et du Key ID (dans Chrome ou Firefox, pas Safari).
7. **Rappel tous les 5 mois** dans ton agenda : régénérer la clé secrète (elle expire à 6 mois) et la recoller dans Supabase. Sinon la connexion Apple tombe sans prévenir.

## 9. Issues à créer après accord

| Issue proposée | Agent | Contenu |
|---|---|---|
| Bouton « Continuer avec Google » (phase 1) | front | Écran 4.1 à 4.3, textes 4.5, détection des navigateurs intégrés, retour vers l'action demandée, tests Vitest (détection, choix du bouton) et Playwright (écran sans Google dans un agent utilisateur Messenger) |
| Preuve de la case d'âge pour Google | backend | Même enregistrement que pour le code (D2) |
| Données Google minimisées | backend + juridique | Déclencheur qui efface nom et photo (6.1), à valider |
| Politique publique et mise à jour | juridique + front | 6.4 |
| Mesure de la méthode de connexion | data | 5.5 |
| One Tap (phase 2) | front | 5.2, après mesure |
| Sign in with Apple | front + backend | **Bloquée par la décision de Florian (99 €/an)** ; révocation du jeton à la suppression (5.4) |
