# Benchmark de la connexion : comment les meilleurs font entrer un joueur (issue #354)

Agent : produit. Rédigé le 1er octobre 2026, sur `main` (après #343, compte obligatoire avec pseudo).
Demande de Florian (01/10) : « pouvoir se connecter via Google, Apple ou autre ».
Recommandation et réglages : `docs/growth/connexion-google-apple.md`.

**Question permanente** : un débutant comprend-il l'écran de compte en 3 secondes, et un joueur de club y retrouve-t-il ses habitudes ?

> **Méthode et limites.** Recherche web du 01/10/2026. Notre réseau bloque les pages de lichess.org, online-go.com, support.chess.com, support.supercell.com, play.google.com et developers.google.com : ces faits viennent des résultats de recherche (extraits des pages officielles) et sont marqués **(recherche)**. Ce qui vient de notre connaissance des apps sans source lisible aujourd'hui est marqué **(à vérifier sur appareil)**. La documentation Supabase a été lue en entier (outil de recherche de la doc Supabase).

## 1. En une phrase

Les apps grand public qui recrutent le plus (Duolingo, chess.com, Spotify) **laissent jouer d'abord**, demandent le compte **pour garder ce qui est gagné**, et proposent **Google + Apple + e-mail** ; les jeux mobiles (Supercell) ont choisi **e-mail + code à 6 chiffres, sans mot de passe** ; les sites de go et d'échecs « de club » (Lichess, OGS) gardent **pseudo + mot de passe**. Notre code par e-mail est déjà au niveau de Supercell ; il nous manque le bouton en un geste (Google) qui fait gagner 20 à 60 % d'inscriptions chez les autres.

## 2. Tableau comparatif

Légende : G = Google, A = Apple, F = Facebook, X = Twitter/X, GH = GitHub, D = Discord, ✓ = proposé, — = absent.

| App | Moyens proposés | Ordre des boutons | Quand le compte est demandé | Pseudo | Récupération | Sans compte |
|---|---|---|---|---|---|---|
| **chess.com** | E-mail + mot de passe, téléphone, G, A, F | Niveau d'abord, puis « Continuer avec e-mail » en grand, les réseaux dessous **(à vérifier sur appareil)** | Pour jouer en ligne et garder sa progression ; on peut jouer contre l'ordi et en invité avant | Choisi à l'inscription, public, définitif sauf exception | Mot de passe oublié par e-mail ; un compte G/A/F peut ajouter un mot de passe ; comptes reliés modifiables dans les réglages | Oui (ordi, invité) |
| **Lichess** | Pseudo + mot de passe + e-mail ; « Se connecter par e-mail » (lien) pour un e-mail confirmé ; double authentification (TOTP). **Aucun** G/A/F **(recherche)** | Formulaire unique | Jamais obligatoire : on joue tout sans compte (classées exceptées) | Choisi à l'inscription, public | Lien par e-mail, ou support si pas d'e-mail | Oui, presque tout |
| **OGS** (online-go.com) | Pseudo + mot de passe, G, F, X, A, GH **(recherche)** | Formulaire en haut, réseaux dessous **(à vérifier sur appareil)** | Pour jouer ; regarder est libre | Choisi à l'inscription, public | Mot de passe oublié par e-mail | Regarder seulement |
| **BadukPop** | Compte pour garder sa progression et le Pro ; lien entre mobile et version web par **QR code** **(recherche)**. Boutons exacts **(à vérifier sur appareil)** : A sur iOS, G sur Android, e-mail | — | Après les premières leçons ; le jeu s'ouvre sans compte | Nom de joueur dans l'app | Par le compte du store ou par e-mail **(à vérifier)** | Oui (leçons, problèmes du jour) |
| **Duolingo** | E-mail + mot de passe, G, F, A (iOS) | « Commencer » (sans compte) en principal, « J'ai déjà un compte » en second ; à la création : G/F/A puis e-mail | **Après la première leçon** : « Crée ton profil pour garder ta progression » (série, XP) | Généré puis modifiable | Mot de passe oublié par e-mail | Oui, toute la première leçon |
| **Supercell ID** (Clash Royale, Brawl Stars…) | **E-mail + code à 6 chiffres, sans mot de passe** ; « Se souvenir de moi sur cet appareil » ; plus de bouton Google Play / Game Center une fois relié **(recherche)** | Un seul champ e-mail | **Jamais imposé** : le jeu tourne sur un compte local ; Supercell ID est proposé pour **sauver** le compte et changer d'appareil | Nom de joueur (en jeu) + identifiant | Code par e-mail ; sinon le support | Oui, tout le jeu |
| **Spotify** | E-mail, téléphone, G, F, A **(recherche)** | « S'inscrire gratuitement » (e-mail) en vert, puis « Continuer avec Google / Facebook / Apple » | Avant d'écouter | Nom d'affichage modifiable | Code ou lien par e-mail | Non |
| **NYT Games** (Wordle) | E-mail, G, A **(recherche)** | Réseaux puis e-mail **(à vérifier)** | Wordle se joue sans compte ; compte pour garder ses statistiques et pour les jeux payants | Non public | Par e-mail | Oui (Wordle, Connections) |

### Ce qui ressort

1. **Personne parmi les leaders grand public ne demande le compte avant la première partie.** Duolingo, Supercell, NYT Games, chess.com et Lichess laissent jouer. Nous aussi (essai de #343 : 3 parties, 3 leçons, Go du jour) : on est dans la norme. Le message « crée ton compte pour **garder** ta série » est celui de Duolingo, c'est le bon.
2. **Le trio Google + Apple + e-mail est la norme des apps grand public** (Duolingo, chess.com, Spotify, NYT). Facebook reste chez les anciens (chess.com, Duolingo, Spotify) pour l'Amérique latine et l'Asie du Sud-Est ; les nouveaux ne l'ajoutent plus.
3. **Les jeux mobiles suppriment le mot de passe** : Supercell = e-mail + code à 6 chiffres, comme nous depuis #343. C'est le meilleur choix pour les navigateurs intégrés (voir 4).
4. **Les sites de go et d'échecs pour joueurs de club** (Lichess, OGS) gardent pseudo + mot de passe. Un joueur de club ne s'étonnera donc pas d'un e-mail ; il ne réclamera pas Google. **Le bouton Google sert le débutant pressé, pas le joueur de club.**
5. **Le pseudo est toujours demandé à part**, après la méthode, jamais tiré du nom Google. Nous faisons pareil (écran « Choisis ton pseudo »).
6. **Discord** n'apparaît dans aucune app grand public du panel. OGS propose GitHub et X : héritage d'une communauté technique.

## 3. Taux de conversion connus

| Source | Chiffre | Fiabilité |
|---|---|---|
| Google, étude de cas **Pinterest** | +47 % d'inscriptions sur le web et le web mobile, +126 % sur Android avec One Tap et le bouton Google | Étude de Google (partiale, mais chiffres précis) |
| Google, étude de cas **Reddit** | +50 à 60 % d'inscriptions avec le bouton Google (ordinateur et Android) ; +90 % avec One Tap sur ordinateur | Étude de Google |
| Synthèses d'éditeurs d'authentification (Auth0, LoginRadius, CIAM Compass) | +20 à 40 % d'inscriptions terminées quand une connexion sociale existe à côté de l'e-mail ; **le gain vient surtout de l'étape « vérifie ton e-mail »**, que Google supprime | Moyenne, sans protocole publié |
| Duolingo (analyses de son parcours) | Repousser le compte après la première leçon : +30 à 50 % de premières sessions terminées chez les apps qui le font | Faible (analyse de tiers) |

**Pour nous** : notre perte se trouve à l'étape « aller chercher le code dans sa boîte mail » (changer d'app, courrier indésirable, délai). Google supprime cette étape. Hypothèse raisonnable : **+20 % de comptes créés** parmi les joueurs qui voient « Crée ton compte », à mesurer (voir la recommandation, section Mesure).

## 4. Le piège des navigateurs intégrés

Le jeu se partage par lien dans Messenger, WhatsApp, Instagram. Ce que voit alors le joueur :

| Où le lien s'ouvre | Navigateur réel | Google (OAuth) | Code par e-mail |
|---|---|---|---|
| Messenger, Facebook, Instagram, TikTok, LINE, Snapchat (iOS et Android) | **WebView** de l'app | **Bloqué** : « Accès bloqué : erreur 403 disallowed_useragent » (règle Google depuis 2017, étendue à toutes les WebView le 30/09/2021) | Marche |
| WhatsApp Android | Le plus souvent un onglet Chrome personnalisé (Custom Tab) **(à vérifier sur appareil)** | Marche en général (Google accepte les Custom Tabs), mais la session reste dans l'onglet | Marche |
| WhatsApp iOS, iMessage, Mail | Safari (ou vue Safari) | Marche | Marche |
| App installée sur l'écran d'accueil iPhone (PWA) | Fenêtre autonome | **Piège** : la page Google part dans une vue Safari séparée ; la session revient dans Safari, pas dans l'app installée (comportement d'iOS, signalé par plusieurs équipes Supabase) | Marche |
| Chrome Android, Safari iOS, ordinateur | Navigateur normal | Marche | Marche |

**Conséquence** : le code par e-mail (#343) reste **le seul moyen qui marche partout**. Google vient **en plus**, et seulement là où il marche. Détection simple par l'agent utilisateur (déjà amorcée dans `src/app/installation.ts` : `FBAN|FBAV|Instagram|Line/|Snapchat|TikTok`), à compléter par `FB_IAB`, `MessengerForiOS`, `Orca-Android`.

Sortir d'un navigateur intégré :
- **Android** : un lien `intent://…#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=…;end` ouvre la page dans Chrome. Fiable.
- **iOS** : aucun moyen fiable d'ouvrir Safari depuis une WebView. Seule consigne honnête : « Touche ⋯ puis Ouvrir dans le navigateur ».

## 5. Google One Tap

- Bandeau « Continuer en tant que Camille » sans quitter la page. Les meilleurs chiffres de la section 3 (Pinterest, Reddit) viennent de One Tap.
- Supabase le prend en charge : `signInWithIdToken({ provider: 'google', token, nonce })`, avec la bibliothèque Google Identity Services. **Pas de redirection** : la session reste dans la page, y compris dans l'app installée sur iPhone.
- Limites : One Tap passe par FedCM sur Chrome et Edge ; **Safari ne prend pas en charge FedCM** (One Tap y est réduit et se ferme seul) ; rien dans les WebView. Google a rendu FedCM obligatoire pour le bouton en août 2025.
- Le script Google se charge depuis `accounts.google.com` : il ne doit l'être **que sur l'écran de compte**, jamais à l'accueil (vie privée : Google voit la visite).

## 6. Apple

- **App Store, règle 4.8** (texte lu le 01/10/2026) : une app qui utilise une connexion tierce (Google, Facebook…) pour le compte principal doit **aussi** proposer une connexion équivalente qui (1) ne collecte que le nom et l'e-mail, (2) permet de **cacher son e-mail**, (3) ne suit pas le joueur pour la publicité sans accord. « Sign in with Apple » remplit ces trois conditions. Une connexion par e-mail de l'éditeur peut suffire selon certains développeurs, mais les relecteurs d'Apple l'acceptent ou la refusent **sans constance** : la voie sûre est Apple.
- **Règle 5.1.1(v)** : sans fonctions qui dépendent vraiment d'un compte, l'app doit être utilisable sans connexion ; et tout compte créé doit pouvoir être **supprimé dans l'app** (fait : #114).
- Apple ne donne le nom qu'**à la première connexion**, et le joueur peut choisir une adresse relais (`…@privaterelay.appleid.com`). Pour le web, la clé secrète (JWT signé avec le fichier `.p8`) **expire tous les 6 mois** : à renouveler, sinon la connexion Apple tombe sans prévenir.
- **Tout passe par l'Apple Developer Program : 99 € par an.** Aucune dépense sans l'accord de Florian.

## 7. Autres fournisseurs

| Fournisseur | Pour notre public (adultes curieux, joueurs d'échecs, France) | Verdict |
|---|---|---|
| **Facebook** | Public plus âgé, utile en Amérique latine et en Asie du Sud-Est ; mal vu côté vie privée en France ; demande une app Meta, une URL de suppression des données et un passage « Live » ; n'apporte presque rien que Google n'apporte déjà | **Non** au lancement |
| **Discord** | 18-24 ans et joueurs de jeux vidéo ; les serveurs Discord de go existent mais restent une niche ; un bouton de plus brouille l'écran | **Non** ; à revoir si une communauté Discord du jeu se forme |
| **X, GitHub** | Héritage OGS, public technique | **Non** |
| **Téléphone (SMS)** | Coûte à chaque SMS, risque de fraude | **Non** (dépense) |
| **Passkeys** | Pas encore pris en charge comme moyen de connexion par Supabase Auth pour les utilisateurs finaux à la date de rédaction **(à vérifier)** | Plus tard |

## 8. Sources

- chess.com, « How do I create a Chess.com account? » : https://support.chess.com/en/articles/8584217-how-do-i-create-a-chess-com-account ; comptes reliés : https://support.chess.com/en/articles/8609484-how-do-i-change-my-connected-accounts-like-facebook-or-google
- Lichess, connexion : https://lichess.org/login ; forum « I can't log in by email » : https://lichess.org/forum/lichess-feedback/i-cant-log-in-by-email-i-did-not-get-the-mail-link
- OGS, connexion : https://online-go.com/sign-in
- BadukPop, fiche Google Play : https://play.google.com/store/apps/details?id=com.coreplane.badukpop.prod
- Duolingo, analyse du parcours : https://gummble.com/blog/duolingo-onboarding-flow-analysis ; connexion sociale de Duolingo, Spotify, Pinterest : https://www.appypie.com/blog/social-login-for-apps
- Supercell ID : https://support.supercell.com/mo-co/en/articles/saving-your-account-to-supercell-id.html ; « The Google button is gone » : https://support.supercell.com/clash-royale/en/articles/the-google-button-is-gone-where-are-my-accounts.html ; https://clashroyale.fandom.com/wiki/Supercell_ID
- Spotify : https://support.spotify.com/us/article/getting-started/
- NYT Games : https://denison.libanswers.com/faq/403898
- Google, études de cas : https://developers.google.com/identity/sign-in/case-studies/pinterest et https://developers.google.com/identity/sign-in/case-studies/reddit
- Synthèses de conversion : https://guptadeepak.com/ciam-compass/guides/social-login/ ; https://auth0.com/blog/how-to-use-social-login-to-drive-your-apps-growth/
- Blocage Google dans les WebView : https://auth0.com/blog/google-blocks-oauth-requests-from-embedded-browsers/ ; agents utilisateurs des navigateurs intégrés : https://useragent.in/in-app-browser-user-agents ; sortie par `intent://` : https://plugwith.me/blog/what-escapes-instagram-in-app-browser-in-2026/
- PWA iPhone et OAuth : https://developer.apple.com/forums/thread/649699 ; https://github.com/orgs/supabase/discussions/33014
- One Tap et FedCM : https://developers.google.com/identity/gsi/web/guides/supported-browsers ; https://www.corbado.com/blog/fedcm-federated-credential-management-api
- Apple, règles de l'App Store (4.8, 5.1.1(v)) : https://developer.apple.com/app-store/review/guidelines/
- Supabase : « Login with Google » https://supabase.com/docs/guides/auth/social-login/auth-google ; « Login with Apple » https://supabase.com/docs/guides/auth/social-login/auth-apple ; « Identity Linking » https://supabase.com/docs/guides/auth/auth-identity-linking
- Google Auth Platform, audience et publication : https://support.google.com/cloud/answer/15549945
