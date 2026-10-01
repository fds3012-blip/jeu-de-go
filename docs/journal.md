# Journal du dirigeant

Chaque livraison : issue traitée, agent, pull request, résultat des vérifications, suites données (boucle d'amélioration de `entreprise/organisation.md`).

## 2026-09-27 : démarrage de la session

- `npm install` et `npm test` : 17 tests verts.
- Ordre de traitement : priorité-haute (#14), jour-1 (#1, #3, #4, #6, #7), jour-2 (#8 à #13), finition (#15), contenu (#16). #2 est ignorée (label « bloqué » : Florian doit relier Vercel).
- Travail en parallèle quand les périmètres ne se chevauchent pas : #14 (moteur-go), #1 (architecte), #4 (moteur-go, `src/go` seulement).

## #1 Socle technique : projet, CI et PWA (architecte)

- Livré : alias `@/`, ESLint + Prettier, Playwright (viewport iPhone 390 × 844) avec un premier test e2e, CI GitHub Actions (lint, types, tests, build, e2e), PWA installable (manifeste, icônes 192 et 512, service worker réseau d'abord).
- Vérifications locales : lint, typecheck, 18 tests Vitest, build, 3 tests Playwright : tout vert. `package-lock.json` versionné pour une CI reproductible.
- Reste : déploiement Vercel (#2, bloqué côté Florian).

## Reprise à 9 h 20 après le redémarrage du conteneur

- Les comptes rendus des sous-agents de #14, #4 et #3 ont été perdus au redémarrage : je vérifie moi-même leurs branches avant chaque PR.
- Florian prolonge la session jusqu'à 10 h 30.

## #14 Jouer contre l'ordi avec le moteur simple (moteur-go)

- Livré : moteur Monte-Carlo dans `src/engine/simple.ts` (captures, sauvetages, pas de remplissage de ses yeux, passe quand il n'y a plus de coup utile), exécuté dans un Web Worker avec repli synchrone. Deux adversaires : Pomme (20 kyu) et Caillou (16 kyu).
- Accueil : l'action principale devient « Jouer contre l'ordi » ; « Jouer à deux » passe en action secondaire. Contre l'ordi, « Annuler » reprend ton coup et sa réponse.
- Vérifications : lint (1 avertissement), typecheck, 25 tests Vitest, build, 4 tests Playwright dont un nouveau test où Pomme répond dans le navigateur.
## #4 Règles du go, comptage et SGF (moteur-go)

- Livré : superko positionnel en option (`playSuperko`), handicap de 2 à 9 pierres, seki compté sans territoire, passes écrites `tt` en SGF, `replay()` qui rejoue une partie en validant chaque coup (base pour la validation serveur de #9), tactiques (échelle).
- Contenu corrigé : la leçon 6 annonçait 45 points de territoire pour Blanc, le bon compte est 36 (quatre colonnes de neuf).
- Vérifications : lint, typecheck, 84 tests Vitest, couverture de `src/go` à 100 % des lignes (98 % des branches), build, e2e : vert.

## #6 Comptes joueurs : connexion par e-mail et pseudo (backend)

- Livré : les 5 migrations de production rapatriées dans `supabase/migrations` ; client Supabase typé (`src/data`, types générés) ; connexion par lien e-mail, choix du pseudo (3 à 24 caractères, unique sans tenir compte des majuscules), déconnexion, session conservée. Sans variables d'environnement, l'app reste utilisable hors connexion.
- Production : nouvelle migration `pseudo_unique_sans_casse` (index unique sur `lower(username)`), appliquée sans suppression de données.
- Vérifications : lint, typecheck, 33 tests, build, e2e : vert.
- Action de Florian : régler `Site URL` et `Redirect URLs` dans Supabase Auth, et ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans Vercel quand #2 sera débloquée.

## Boucle d'amélioration après #14 (produit)

- Constat : le parcours de base marche, mais la fin de partie bloque les débutants (marquage manuel des pierres mortes), rien ne pousse à rejouer après une partie, et l'accueil se contredit (Mochi conseille les leçons, le gros bouton lance une partie).
- Issues créées : pierres mortes proposées par l'ordi, écran de fin de partie avec adversaire suivant, accueil à un message et une action (toutes en priorité-haute).
## #7 Premiers tests de bout en bout (qa)

- Livré : `e2e/plateau.ts` (jouer « D5 » à la souris ou au doigt), `navigation.spec.ts` (accueil en moins de 3 s, onglets, cibles de 44 px) et `regles.spec.ts` (poser, capturer, suicide et ko refusés avec leur message, double touche de confirmation). 14 tests e2e au total, lancés par la CI sur chaque PR.
- Bug bloquant trouvé et corrigé dans `src/ui/Board.tsx` (périmètre frontend) : au doigt, la pierre fantôme s'effaçait juste après la touche, donc la seconde touche ne confirmait jamais le coup. Aucun coup n'était jouable au doigt avec le réglage par défaut.
- Outillage : `PW_PORT` permet de lancer plusieurs suites e2e en parallèle sans collision de port.
## #3 Maquettes des 5 écrans et design tokens (designer)

- Livré : fichier Figma « Jeu de go : Encre & Jade » (https://www.figma.com/design/9Ft0rUVY3lB7cY7pIyjNti) avec tokens, 7 composants et les 5 écrans en 390 × 844, modes sombre et clair ; `src/ui/tokens.css` complet (rôles, typographie, espacements, rayons, tailles de cible, mouvement réduit) ; `app.css` passe par les tokens ; test Vitest du contraste AA dans les deux modes.
- Constat : le vermillon pur n'atteint pas 4,5:1 comme texte, d'où `--danger-texte`.
- Vérifications : lint, typecheck, 57 tests, build, e2e : vert.
- Reste : validation des maquettes par Florian. L'issue reste ouverte avec le label « bloqué ».

## #21 L'ordi propose les pierres mortes (moteur-go)

- Livré : `deadStones` et `ownership` (`src/engine/dead.ts`), calculés par simulations avec décision par groupe entier (un groupe à deux vrais yeux est toujours vivant, un seki reste un seki). Pré-marquage à l'entrée du comptage, contre l'ordi comme à deux, avec la phrase de l'issue. Le moteur passe maintenant en comptant sans les pierres mortes estimées.
- Vérifications : 10 positions de référence (9 × 9 et 13 × 13) justes dans Vitest, moins de 300 ms en 9 × 9 ; test e2e qui va jusqu'au résultat en appuyant seulement sur « Valider le score ». Lint, typecheck, 113 tests, build, 15 tests e2e : vert.
- Limite : positions de référence construites à la main ; KataGo (#8) donnera une estimation plus fiable.
## #23 Accueil en 3 secondes : un message, une action (frontend)

- Livré : pour un nouveau joueur, Mochi et le bouton principal disent la même chose (« Joue ta première partie contre Pomme ») ; adversaire et plateau repliés en « Pomme · 9 × 9 · Changer » ; « Jouer à deux » et « Apprendre » en actions secondaires ; bulle de Mochi qui explique le but au premier coup, une seule fois.
- Retouches du dirigeant : la bulle du but passe dans `Game` (prop `intro`) et disparaît au premier coup, sinon elle poussait les boutons Passer, Annuler et Abandonner hors de l'écran ; test e2e rendu robuste (le message « Tu joues » est vite remplacé par « Pomme réfléchit… »).
- Vérifications : lint, typecheck, 104 tests, build, 6 tests e2e (3 passages) : vert.

## #12 Mesure d'audience, erreurs et onboarding (growth)

- Livré : `src/data/analytics.ts` (PostHog et Sentry chargés à la demande, rien sans consentement ni sans clés) ; événements `app_ouverte`, `premiere_pierre` (avec les secondes depuis l'ouverture), `partie_terminee`, `lecon_terminee`, `inscription`, `lien_connexion_envoye` ; bandeau Refuser / Accepter et section Confidentialité dans Profil.
- Configuré : tableau de bord PostHog « Croissance – jeu de go » (entonnoir, rétention J1/J7/J30, première pierre dans la minute) et projet Sentry `jeu-de-go-web`, sans rien de payant. Seules des clés publiques sont dans `.env.example`.
- Vérifications : lint, typecheck, 165 tests, build, 18 tests e2e (dont « aucune requête de suivi sans consentement ») : vert.
- Reste (Florian) : variables dans Vercel, puis démo de l'entonnoir et erreur de test `#erreur-test`. L'issue reste ouverte avec le label « bloqué ».
## #9 Validation des coups côté serveur et fin aux points (backend)

- Livré : Edge Function `game-action` (déployée en production, JWT exigé) qui rejoue la partie avec les règles de `src/go` et refuse case occupée, suicide, ko (422) et coup hors tour (409) ; fin aux points avec proposition des pierres mortes, acceptation ou reprise, score calculé côté serveur et cotes mises à jour. `play_move` n'est plus appelable par les clients.
- Production : migration `validation_serveur_et_comptage` (colonnes de comptage sur `games`, `finish_game_by_score` réservée au service), sans suppression de données. Advisors : 4 alertes au lieu de 5.
- Essai réel : fait en SQL dans une transaction annulée (droits refusés au client, score W+7,5 et cotes mises à jour). L'appel HTTP n'a pas pu être fait : le réseau du conteneur bloque `*.supabase.co`.
- Suite : brancher `src/data/games.ts` dans l'écran de partie en ligne (#10) ; issue de sécurité créée pour les parties classées déséquilibrées.

## #8 KataGo dans un Web Worker et niveaux (moteur-go)

- Livré : KataGo en TensorFlow.js dans un Web Worker (`src/engine/katago`, adapté de web-katrain sous licence MIT), réseau g170-b6c96 téléchargé à la demande et mis en cache (Cache API), hors du bundle principal ; backends WebGPU, puis WebGL, puis CPU ; API `analyze`, `bestMove`, `ownership` ; repli sur le moteur simple si KataGo ne démarre pas. Échelle complète de 9 adversaires : Pomme, Caillou (moteur simple), puis Bambou, Renard, Rivière, Tigre, Montagne, Dragon et Sensei (KataGo, styles solide, agressif et territorial).
- Mesures : dans Chromium sans GPU du conteneur (WebGL logiciel), Tigre répond en 1,8 à 2,3 s par coup. Le critère « moins de 2 s sur un iPhone récent au niveau moyen » reste à mesurer sur un vrai téléphone.
- Vérifications : lint, typecheck, 220 tests (2 tests du vrai réseau ignorés sans le fichier), build, 18 tests e2e : vert.
## #22 Fin de partie contre l'ordi : bilan et adversaire suivant (frontend)

- Livré : Mochi réagit au résultat ; bilan par adversaire en localStorage (`go.bilan.v1`) ; une seule action principale (« Défier Caillou » après une victoire, « Rejouer contre Pomme » après une défaite), leçon conseillée et Accueil en actions secondaires ; adversaires battus marqués d'un ✓ sur l'accueil.
- Retouche du dirigeant : le paramètre de test `?komi=` n'est lu que dans un build de test (`VITE_E2E`), pour qu'il ne puisse pas fausser un bilan en production.
- Vérifications : lint, typecheck, 191 tests, build, 19 tests e2e (victoire et défaite) : vert.
## #11 Leçons et problèmes branchés sur Supabase (frontend)

- Livré : 4 onglets (Jouer, Apprendre, Problèmes, Profil) comme dans les maquettes ; progression des leçons en localStorage et dans `lesson_progress` une fois connecté, avec fusion à la connexion ; problème du jour et 6 problèmes de base, réponses vérifiées par `src/go`, `record_puzzle_attempt` au premier essai, « Voir la suite » animé (sans animation si mouvements réduits) ; copie locale des problèmes pour jouer sans compte ni réseau ; états chargement, erreur et hors ligne.
- Vérifications : lint, typecheck, 203 tests, build, 18 tests e2e (dont un parcours problèmes complet sans compte) : vert.
- Reste : le critère avec un vrai compte connecté n'est pas testable depuis ce conteneur (réseau vers Supabase bloqué, Vercel non relié) ; besoins côté base (suite des problèmes, lecture sans compte, cote et progression protégées) : issue #29 et commentaire sur #11.

## Boucle d'amélioration après #8, #11, #21, #22 et #23 (produit)

- Constat : le joueur voit son score mais jamais ses erreurs, alors que KataGo sait les analyser ; un débutant perd ses pierres sans alerte ; rien ne le fait revenir le lendemain.
- Issues créées : #34 revue de partie avec KataGo (priorité-haute), #35 alerte d'atari et indice (jour-2), #36 problème du jour et série sur l'accueil avec rappel (jour-2). Également #29 (sécurité côté serveur, priorité-haute) après #9 et #11.
- Retouche : la carte « Bientôt : jouer contre KataGo » du Profil est retirée avec #8. Le comptage chinois en partie est à ajouter au périmètre de #10.

## #2 Déploiement Vercel (architecte, avec Florian)

- Florian a relié le dépôt à Vercel (espace « Florian's projects ») : production sur `https://jeu-de-go.vercel.app` depuis `main`, aperçu pour chaque PR.
- Variables ajoutées pour Production et Preview : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_SENTRY_DSN` (valeurs publiques).
- Supabase Auth : Site URL `https://jeu-de-go.vercel.app`, Redirect URLs de production, des aperçus (`https://*-florians-projects-100ae27d.vercel.app/**`) et de `localhost:5173`.
- Cette PR déclenche le premier déploiement de production.
- Correctif : les 5 variables avaient été créées en type « Secret ». Vercel refuse ce type pour un préfixe public `VITE_`, et l'app déployée n'appelait pas Supabase (aucun compte ni aucune requête dans les journaux). Florian les a recréées en type « Config » ; cette PR relance le déploiement. `.env.example` le précise.

## #50 Consentement en une seule fenêtre et Profil court (frontend)

- Consentement : le bandeau est remplacé par une fenêtre unique au premier lancement.
  - Elle contient « Lire les conditions », puis Accepter (bouton en relief) ou Refuser.
  - Le choix est retenu ; la fenêtre ne revient qu'après Échap, sans choix, au lancement suivant.
  - Elle attend la fin d'une partie en cours avant de s'afficher.
- Nouvelle page « Conditions et confidentialité », avec un interrupteur pour changer d'avis.
- Profil : une carte d'identité, 4 réglages en lignes de 48 px, puis « Mon compte » et « Conditions ». Il tient en 390 × 844 sans défiler, en sombre comme en clair (vérifié par un test e2e).
- Skills appliquées : onboard, animate, mobile-pro-rules.
- Vérifications : 360 tests unitaires et 42 tests e2e verts, lint, types et build OK.
- Suites :
  - ajouter une adresse de contact RGPD dans « Tes droits » (juridique) ;
  - rafraîchir le pseudo de la carte d'identité sans recharger l'app.
## 27/09, 15 h 45 : retours de Florian, deuxième vague de design

**Retours de Florian**
- Ce qui lui plaît : le son est parfait, et il aime le logo aux deux pierres, la partie Jouer et les Problèmes.
- Ce qu'il faut revoir :
  - le Profil est trop long ;
  - le consentement doit être demandé une seule fois, dans une fenêtre qui mène aux conditions ;
  - les icônes du bas sont fades ;
  - chaque élément doit avoir son identité, et tout doit être relié.

**Recherche de skills de design**
- L'agent de recherche a trouvé 10 candidates et les a lues, licence et contenu compris.
- Florian en a validé 4 lots (#52, PR #53) :
  - l'animation d'Emil Kowalski ;
  - des extraits d'impeccable, sans le script qui télécharge un binaire ;
  - la checklist mobile de ui-ux-pro-max ;
  - motion-design de LottieFiles et icon-system.
- Écartées :
  - les skills sans licence, rastian et rknall ;
  - les thèmes pour présentations et la charte Anthropic ;
  - taste-skill, faite pour des pages d'accueil.

**Issues créées et confiées**
- #50 : consentement en fenêtre unique et Profil court (frontend).
- #51 : identité reliée à partir du logo, avec des icônes de navigation en pierres (designer).
- #54 : un chemin Apprendre qui donne envie (designer).

## #51 Identité reliée : tout part du logo aux deux pierres (designer)

- Nouvelles icônes de la barre du bas, dessinées à partir du logo aux deux pierres :
  - Jouer : les deux pierres, avec une onde jade ;
  - Apprendre : un chemin de pierres, en or ;
  - Problèmes : une atari sur un coin de goban, en hanko ;
  - Profil : une pierre et son sceau, en indigo.
- Onglet inactif : encre brume. Onglet actif : la matière des pierres du goban et une seule couleur d'accent.
- La pierre de l'onglet choisi tombe en 160 ms, et rien ne bouge si les mouvements sont réduits.
- Le motif est décliné partout :
  - chargement : le logo qui tourne, pour « l'ordi réfléchit » et le chargement des problèmes ;
  - nouvelle icône d'app, sur fond encre sous la lampe ;
  - ornement devant les titres de section.
- La grammaire est documentée dans `docs/design/v2/identite.md`, avec une planche `identite.png`.
- Skills appliquées : icon-system, animate, mobile-pro-rules.
- Vérifications : 385 tests unitaires et 44 tests e2e verts.
- Suite : le mot « Sombre » est coupé dans le choix du thème du Profil. C'est à corriger dans la boucle d'amélioration.

## #54 Apprendre : un chemin qui donne envie (designer)

- Le chemin est posé sur un goban dessiné à l'encre, chaque leçon étant une pierre sur une intersection :
  - leçon faite : pierre noire pleine ;
  - leçon en cours : pierre claire translucide, cerclée de jade, qui respire ;
  - leçon à venir : pierre fantôme.
- Le tracé parcouru est en or, et chaque leçon a son sceau jade.
- Le bouton en relief est unique, sous la leçon en cours.
- Fin de leçon : le sceau s'imprime, puis la pierre se pose avec le claquement, en moins de 600 ms. Carillon et confettis seulement en fin de chapitre, si les célébrations sont activées.
- Retouche après ma revue : en mode sombre, la pierre « en cours » se confondait avec une leçon faite.
- Vérifications : 389 tests unitaires et 45 tests e2e verts.

## #57 Passe de finition : Profil et fin de partie (designer)

- Critique de chaque écran en sombre et en clair : Accueil, Partie, Fin de partie, Problèmes et Profil.
- Corrigé :
  - le mot « Sombre » coupé dans le choix du thème ;
  - le lien « Ouvrir la leçon » passé à 44 px ;
  - le bilan de défaite, dont la ligne se coupait mal ;
  - l'alignement de l'avatar de Mochi.
- Laissé en l'état, car ce sont des choix voulus ou des changements trop larges :
  - l'espace au-dessus de l'adversaire en partie ;
  - le titre de la barre du haut, qui répète l'onglet ;
  - la bulle de Pomme qui chevauche le plateau.
- Vérifications : 389 tests unitaires et 45 tests e2e verts.

## #60 Audit du mouvement (frontend)

- Audit fait avec les skills `improve-animations` et `review-animations`. Rapport : `docs/design/v2/audit-mouvement.md`.
- Corrigé :
  - les pierres prises et leur glissement vers les couvercles passent d'une courbe qui démarre lentement (ease-in) à une courbe qui démarre vite (ease-out), en 280 ms au lieu de 340 ;
  - la barre d'avantage glisse (translateX) au lieu d'animer sa largeur ;
  - la pulsation du couvercle est plus courte.
- Déjà conforme : les mouvements réduits partout, et des boutons en relief qui ne bougent que par transform.
- Reste, en basse gravité : l'animation de la feuille « Changer », que l'on ne peut pas interrompre, et les confettis encore calculés quand les mouvements sont réduits.

## 27/09, 16 h 30 : bilan de la boucle de design

- **Fusionné** : #52 (skills), #50 (Profil et consentement), #51 (identité), #54 (Apprendre), #57 (finition), #60 (mouvement).
- **À valider par Florian sur iPhone** : les icônes, le chemin Apprendre, la fenêtre de consentement et le glissement des pierres prises.
- **Questions en attente** :
  - l'adresse de contact RGPD ;
  - la fenêtre de consentement : au premier lancement, ou après la première partie ?

## #62 Mouvement : les restes de l'audit (frontend)

- **Feuille « Changer »** : elle entre par une transition qu'on peut interrompre (200 ms) et sort en 160 ms. Avec les mouvements réduits, elle apparaît et disparaît par un simple fondu.
- **Confettis** : ils ne sont plus ni affichés ni calculés quand les mouvements sont réduits.
- **Point de l'onglet** : il part de `scale(.8)`.
- **Vérifications** : 392 tests unitaires et 45 tests e2e verts.
- **Reste à vérifier sur un vrai téléphone** : la courbe des pierres prises qui partent vers les couvercles.

## #65 Barre d'actions de la partie dans l'identité aux deux pierres (designer)

- Florian trouvait les icônes du bas en partie « pas ouf ». Elles sont redessinées avec des pierres :
  - **Indice** : la pierre fantôme dans son halo jade ;
  - **Annuler** : la pierre qui remonte par un chemin de points ;
  - **Passer** : deux pierres restées hors du plateau ;
  - **Abandonner** : une pierre sur le couvercle retourné, le geste traditionnel de l'abandon au go. Le couvercle devient un sceau hanko au moment de « Confirmer ? ».
- Une action désactivée passe à l'encre brume, comme un onglet inactif.
- Vérifications : 405 tests unitaires et 45 tests e2e verts.
## #64 Consentement : un maximum d'accords, dans le respect de la CNIL (juridique)

- Florian a peur que les joueurs refusent. La règle : refuser doit rester aussi simple qu'accepter (CNIL). On ne joue donc pas sur la difficulté de refuser.
- Le vrai levier est l'exemption de la CNIL pour la mesure d'audience. PostHog tourne désormais sans consentement, en mode anonyme :
  - rien n'est écrit sur l'appareil ;
  - aucun profil de joueur ;
  - l'adresse IP n'est pas conservée ;
  - le joueur peut s'y opposer depuis la page Conditions.
- Conséquence : un « Non merci » ne nous rend plus aveugles, on compte toujours les parties.
- La fenêtre ne demande plus que les rapports de bugs (Sentry) et le suivi dans le temps. Le texte est à la voix de Mochi (« Tu m'aides à chasser les bugs ? »), avec deux boutons strictement égaux.
- À faire valider par un avocat : que PostHog relève bien de l'exemption. Analyse et sources : `docs/juridique/consentement.md`.
- Action pour Florian dans PostHog : activer « Discard client IP data » et régler la conservation à 25 mois maximum.
- Vérifications : 397 tests unitaires et 46 tests e2e verts.

## #35 Aide en partie : alerte d'atari de Mochi (frontend)

- Contre Pomme et Caillou, Mochi prévient dès qu'un groupe du joueur n'a plus qu'une liberté. Il explique le mot « atari » la première fois.
- La liberté restante clignote une fois sur le goban, sans animation si les mouvements sont réduits.
- Nouveau réglage « Aide de Mochi en partie » dans le Profil :
  - trois choix : Débutants (par défaut), Toujours, Jamais ;
  - avec « Débutants », l'aide est coupée à partir de Bambou.
- Reste :
  - limiter l'indice à 3 par partie ;
  - mesurer dans PostHog le taux de premières parties terminées.
## #34 Revue de partie (moteur-go) : première version

- À la fin de la partie, « Revoir ma partie » ouvre :
  - le goban coup par coup, avec un curseur ;
  - la courbe d'avantage ;
  - les 3 erreurs de plus d'un point, chacune avec une phrase de Mochi ;
  - « Rejouer d'ici ».
- La partie est gardée en SGF sur le téléphone. L'événement `revue_ouverte` est mesuré.
- Règle posée après ma revue : on ne montre jamais un conseil faux. Le premier jet proposait A9, dans le coin.
  - Le meilleur coup (pierre verte) vient seulement de KataGo, et seulement s'il est déjà chargé ou en cache.
  - Il n'apparaît que s'il est légal, s'il n'est pas sur la première ligne quand le plateau est encore ouvert, et s'il gagne au moins un point.
  - Sinon, Mochi décrit seulement l'erreur.
- Reste :
  - l'enregistrement dans Supabase ;
  - la revue des anciennes parties depuis le Profil ;
  - la vérification du contraste de la courbe en clair.
- Vérifications : 419 tests unitaires et 48 tests e2e verts.

## #35, suite : indices limités et première partie terminée (frontend)

- Contre l'ordi, 3 indices par partie :
  - trois mini-pierres jade à côté de l'icône montrent ce qui reste ;
  - à zéro, le bouton est désactivé et Mochi le dit une fois ;
  - « Rejouer » remet le compteur à 3.
- Nouvel événement `premiere_partie_terminee`, envoyé une seule fois. Il permet de suivre le taux de premières parties terminées.
- À revoir par le designer : les trois points en colonne peuvent se lire comme un menu « plus d'options ».
- Vérifications : 442 tests unitaires et 47 tests e2e verts.

## 27/09, 17 h 40 : bilan de la deuxième boucle

- Fusionné : #64 (consentement exempté par la CNIL), #65 (icônes de la barre d'actions), #34 (revue de partie, première version), #35 (alerte d'atari, indices limités).
- Correction de CI : le test d'égalité des deux boutons de consentement mesurait pendant le zoom d'entrée et échouait parfois. Il est corrigé dans #68.
- Pour Florian :
  - faire valider l'exemption de PostHog par un avocat ;
  - activer « Discard client IP data » dans PostHog ;
  - essayer la revue de partie et l'alerte d'atari sur iPhone.

## #29 Sécurité côté serveur (backend)

- Deux migrations appliquées en production, après des tests SQL joués dans des transactions annulées :
  - **Parties classées** : komi 6,5 et handicap 0 imposés, avec la contrainte `games_rated_standard`.
  - **Problèmes** : seul le premier essai compte pour la cote, et deux essais simultanés ne comptent qu'une fois. Un essai répété et réussi fait quand même avancer la série de jours. Correctif demandé après ma revue : sinon, le Go du jour aurait cassé la série.
  - **Leçons** : la progression ne recule jamais, grâce au trigger `lesson_progress_keep_max`.
- Aucune donnée supprimée, aucune branche Supabase payante créée. Advisors : aucune nouvelle alerte.
## #73 Veille concurrentielle et innovations (produit)

- L'app est comparée à chess.com, BadukPop, OGS, KaTrain, AI Sensei, Tsumego Pro, SmartGo, Fox et Tygem, 101weiqi et Duolingo, sur quatre axes : accueil, rétention, profondeur et social. Document : `docs/produit/veille-2026-09-27.md`.
- Issues créées :
  - #75 : Go du jour partagé, façon Wordle ;
  - #76 : série protégée (gel) ;
  - #77 : rejouer ses erreurs sous forme de problèmes ;
  - #78 : carte de territoire animée ;
  - #79 : partie guidée ;
  - #80 : Mochi coach ;
  - #81 : défier un ami par lien.

## #72 Audit « impeccable partout » (designer)

- Captures : 13 écrans, sombre et clair, en 390 × 844 et sur iPhone SE, soit 104 captures. Rapport : `docs/design/v2/audit-coherence.md`, avec une planche avant/après.
- Corrigé :
  - la tuile grise parasite sous le nom de l'adversaire ;
  - la fin de partie coupée sur iPhone SE ;
  - le choix de la taille du plateau, porté à 44 px ;
  - le Profil écrasé sur SE ;
  - les espaces insécables ;
  - 8 nouveaux jetons et 47 valeurs en dur remplacées.
- Reste, pour une prochaine issue :
  - le plateau des leçons caché sur SE ;
  - les deux sortes d'apostrophes mélangées ;
  - le bouton principal de l'accueil sur deux lignes ;
  - des états pas encore capturés.

## #78 Score raconté (frontend)

- En fin de partie, le goban raconte le score en trois temps (territoires, prisonniers, komi), puis donne le résultat.
- L'animation dure 2,5 s. Un toucher passe directement au résultat, et tout s'affiche d'emblée si les mouvements sont réduits.
- Le komi est expliqué la première fois.
- Les totaux viennent de `score()`, sans aucune règle recalculée.
- Le carillon de victoire attend la fin du récit, pour ne pas dévoiler le résultat trop tôt.
- Reste :
  - le bouton « Qui mène ? » en partie ;
  - la mise en valeur des pierres mortes pendant le récit.
## #75 Go du jour partageable, premier incrément (growth)

- Un défi commun à tous, numéroté en heure de Paris. Le 27/09 est le n° 1.
- Il remplace le « problème du jour », qui variait d'un joueur à l'autre.
- Bouton « Partager » en relief : il ouvre le partage du téléphone, ou copie le texte sinon. Exemple : `Go du jour n° 1 · résolu en 2 essais · série 1 🔥` suivi du lien. La réponse n'est jamais dévoilée.
- Le lien `?go-du-jour=N` ouvre directement le problème, sans compte. La fenêtre de consentement attend la fin du problème.
- Événements suivis : `go_du_jour_resolu`, `go_du_jour_partage` et `arrivee_par_partage`.
- Reste :
  - les trois paliers de difficulté ;
  - une table du défi côté serveur ;
  - la série liée au compte ;
  - l'indicateur dans PostHog.
- Aujourd'hui, le même problème revient tous les 6 jours. Les nouveaux problèmes (#16) allongeront ce cycle.

## #71 Revue : une note pour chaque coup (moteur-go)

- Chaque coup reçoit une note sous forme de sceau posé sur la pierre : !! Brillant, ★ Meilleur, ! Excellent, ✓ Bon ou Solide, ?! Imprécision, ? Erreur, ?? Grosse erreur. Chaque sceau a une couleur et un symbole dont le contraste atteint 4,5:1.
- Le bilan donne la précision du joueur et de l'adversaire en %, le nombre de coups par catégorie et une phrase de Mochi.
- Seuils de perte en points :
  - avec KataGo : 0,5, 1,5, 3 et 6 ;
  - sans KataGo : seuils élargis et courbe lissée, et jamais de note « Meilleur » ni « Brillant ».
- « Brillant » demande une confirmation par une analyse longue. Il faut éviter tout faux positif.
- Correction après ma revue : « Rejouer d'ici » recouvrait la liste des coups. Le Résumé s'affiche maintenant à la place du goban.
- Reste : régler les seuils sur de vraies parties analysées par KataGo.
## #16 12 nouveaux problèmes, prouvés (pedagogie)

- 12 nouveaux problèmes, soit 18 au total :
  - capture : double atari, échelle cassée, filet, snapback ;
  - sauvetage : sortir de l'atari, relier, prendre la pierre qui coupe, relier sur le bord ;
  - vie et mort : faire deux yeux, tuer.
- Chaque problème a une position légale, et sa réponse atteint l'objectif quelle que soit la défense de Blanc.
- Chaque réponse acceptée est la seule qui marche, et ça a été testé sur tous les coups légaux. Seule exception : le filet (c3) accepte 3 coups, tous justes.
- Deux positions fausses ont été corrigées en chemin.
- La migration d'insertion ne modifie aucun problème existant. Elle est appliquée en production après la fusion.
- Reste : une vérification par KataGo.

## 27/09, 18 h 45 à 20 h : vague « 100 problèmes et profondeur de jeu »

**#91 Problèmes**
- On passe de 18 à 74 problèmes. Tous sont prouvés par des tests : position légale, objectif atteint contre toute défense, réponses acceptées égales aux coups gagnants.
- Lots :
  - A, capture et atari, difficulté 300 à 650 : 20 ;
  - B, techniques de capture, 600 à 1050 : 10 ;
  - C, vie et mort, 500 à 1250 : 13 ;
  - D, connexions et courses aux libertés, 600 à 1300 : 13.
- L'objectif de 100 n'est pas atteint. Les agents ont écarté tout problème qu'ils ne pouvaient pas prouver : snapback, pierre jetée, quatre en carré, ko, seki.

**Profondeur de jeu et rétention**
- #93 Paliers de problèmes.
- #94 « Qui mène ? ».
- #77 Rejoue tes erreurs.
- #76 Série protégée.
- #75 Go du jour stable quand un lot s'ajoute.

## 27/09, 20 h à 22 h : vague « visuel, leçons fluides, toute l'équipe »

**Skills** (#105) : 16 skills validés par Florian (pédagogie visuelle, gamification, fin mémorable, audit UX, WCAG, style d'illustration) et une charte maison des personnages (`personnages-go`).

**Leçons** (#101)
- Les 6 leçons sont au format « je montre, on fait ensemble, tu fais seul ». L'image explique, le texte (12 mots au plus) accompagne.
- Démos en miroir de la question, aide verte sur les libertés, ko barré puis permis, question « touche le point ».

**Visuels** (#102, #106, #108)
- 9 adversaires illustrés, 4 couleurs au plus. En partie, leur portrait réagit aux captures.
- Portrait de Mochi (neutre, content, fier, pensif).
- Montagne des paliers et vitrine des badges.

**Problèmes** (#91) : lots E (15) et F (12). **101 problèmes** en production, empreintes md5 identiques au dépôt.

**Jeu**
- #109 XP et niveaux, sur l'appareil. Thèmes de goban annoncés, pas encore appliqués.
- #117 Pierres mortes marquées seules contre l'ordi, avec « Corriger » en secours.
- #118 Score raconté « Toi / Pomme ».
- #120 Conseil pour passer.

**Accessibilité** (#110, #116) : audit UX et accessibilité (6 issues ouvertes). Goban jouable au clavier et au lecteur d'écran.

**Compte et serveur**
- #114 Supprimer mon compte : fonction serveur, parties partagées conservées.
- #76 Gels de série côté serveur.

**Hors produit**
- #111 Confidentialité et CGU : champs légaux à remplir par Florian.
- #112 Dossier marketing.
- Feuille de route d'octobre (`docs/produit/feuille-de-route-2026-10.md`).

**Méthode** : les 9 branches ont d'abord été assemblées et testées ensemble avant fusion. Deux cassures ont été repérées et corrigées avant d'arriver sur main : un sélecteur de plateau (#116) et le test de score avec le comptage automatique (#117).

**Reste**
- #119 accueil à une seule action.
- #121 zoom 200 %.
- Fin de #116 : nom de l'adversaire dans l'annonce, clavier dans les problèmes et les leçons.
- Fin de #120 : bouton Passer mis en évidence.
- Thèmes de goban.
- Retrait des droits TRUNCATE sur `profiles`.

## 27/09, 22 h à 23 h : dernière vague

**Retour de Florian sur les problèmes** (#137) : la montagne, la barre et les « 0 / 33 » montraient une fin. Ils sont retirés. Chaque palier dit seulement « N réussis » : les problèmes doivent sembler sans fin.

**Livré**
- #119 Accueil à une seule action principale. Le goban devient une illustration, et Pomme parle sous le plateau.
- #109 Thèmes de goban appliqués (Kaya clair, Ardoise, Coquillage doré), choisis dans le Profil selon le niveau.
- #120 Le bouton Passer passe en jade quand Mochi conseille de passer.
- #116 Au lecteur d'écran : « Pomme a joué C3 » et l'atari annoncé. Problèmes et leçons testés au clavier.
- #121 Zoom 200 % et 320 px sans défilement horizontal, avec un test dédié.
- #135 Les droits TRUNCATE, REFERENCES et TRIGGER sont retirés à `anon` et `authenticated`, en production.
- #136 Lot G, 5 problèmes « relier ». **106 problèmes** en production, empreintes vérifiées.

**Appris** : l'assemblage des branches avant fusion a encore repéré une cassure. L'annonce « Pomme joue C3 » doublait le message visible, et 7 tests e2e cassaient. La formulation est devenue « Pomme a joué ».

**Reste**
- #121 : le chemin de pierres d'Apprendre et l'en-tête du Profil à 195 px, la bulle de Pomme.
- #136 : « relier sous une pierre » et la vie et mort de haut de courbe.
- Droit MAINTAIN des privilèges par défaut.
- Champs légaux (#111).

## 27/09, 23 h à 23 h 30

- #147 Problèmes sans fin : « Continuer » et « Problème suivant » proposent toujours un problème. Quand tout est résolu, c'est un problème déjà réussi, tiré au hasard, jamais deux fois le même de suite.
- #116 Le lecteur d'écran dit « appuie encore pour choisir ce point » sur les questions « touche le point ».
- #148 Droit MAINTAIN retiré à `anon` et `authenticated`, en production.
- #136 Lot H : 1 problème « relier » prouvé (6 positions écartées). **107 problèmes** en production.
- #121 Non fait : Apprendre et Profil débordent encore à 195 px (détail dans l'issue).

## Nuit du 27 au 28/09 (23 h 30 à 8 h)

**Équipe** : 5 rôles ajoutés (#164) : UX jeux mobiles (base de connaissances `docs/ux/base-de-connaissances.md`), game designer, son et haptique, data, localisation.

**Fusionné sur main (CI verte)**
- Jeu : komi 0,5 (#171), fin de partie par la passe (#190), écran des frontières (#174, #188), sensation de partie (#203), mur de Bambou (#216), sons v2 (#180).
- Apprendre : leçons 7 et 8 (#193, #231), leçons aux gestes (#202), leçon puis pratique (#220), solution vue (#210).
- Problèmes : un seul bouton « Continuer », sans montagne ni total (#137, #204). Révision du jour (#219). Lots I, J, N (#175, #205, #230) : **147 problèmes** en production, empreintes md5 vérifiées lot par lot.
- Motivation : XP visible (#172), série sans compte (#181, #184), record (#217), flamme (#221), Profil « Ton parcours » (#224), invitation à installer (#189).
- Anglais en 4 étapes (#173, #191, #209, #229), seulement avec `?lang=en` tant que les contenus ne sont pas traduits.
- Données et droit : plan de marquage (#170), entonnoirs (#226), rapport juridique (#225), GeoIP coupée et effacement des traces (#227).
- Études : analyses UX (#183, #201, #215), revue honnête (#192), équilibrage (#194), fiches stores (#211), recette de nuit (#206, #218).

**Bloqué à 4 h 50** : GitHub Actions ne démarre plus (« recent account payments have failed or your spending limit needs to be increased »). Aucune dépense faite. Plus aucune fusion depuis : la règle est « CI verte avant fusion ».

**En attente de CI** : tout est intégré dans `assemblage-nuit` (PR #246), validé en local (`tsc`, lint, Vitest 7 093 tests, Playwright 198 passés). Il contient #234, #238, #239, #242 à #245, le vocabulaire du design, le lot O (#248, 12 problèmes, migration pas encore appliquée) la recette du matin (#249) et les correctifs #252 à #257.

**Recette du matin** (#247, PR #249) : 4 parcours × 4 configurations, rien de bloquant. M1 corrigé sur place.

**Vagues de 6 h à 7 h 30** (toutes dans l'assemblage, validées en local)
- #252 (#250) : en 320 px, le plateau reste visible sous le verdict et sous la bulle de Mochi ; les liens du verdict tiennent sur une ligne ; la fête de niveau quitte le chemin.
- #253 (#251) : une défaite au komi sur un plateau presque vide est expliquée, sans « perdu de peu ». Un Go du jour vu avec la réponse revient le lendemain en révision.
- #254 (#236, N2) : une seule fête à la fois en fin de pratique ; « Niveau 2 ! » a son propre écran.
- #255 (#232) : la barre de partie à 320 px garde ses libellés entiers ; le chemin en police doublée est vérifié.
- #256 (#250) : la bulle de Mochi tient sous le plateau en 320 × 568.
- #257 (#251) : une partie finie sur un plateau presque vide ne consomme plus une des 3 parties à komi réduit.
- Dernier état vérifié : Vitest 7 106 tests, Playwright 214 passés.

**Appris**
- Assembler toutes les branches en local avant de fusionner a évité plusieurs cassures croisées (profil « 2/7 » devenu « 2/8 », textes i18n).
- `pkill -f` avec le motif dans sa propre commande tue le shell : on arrête les serveurs par PID.
- Le disque s'est rempli à 2 h : les agents lient `node_modules` au lieu de l'installer.

## 28/09, 8 h 40 à 9 h 30

- #259 Skills design proposées par Florian : `web-design-guidelines`, `redesign-skill` et `taste-skill` ajoutées ; `image-to-code`, `awesome-design-md`, 21st Magic et Playwright CLI écartés (raisons dans `.claude/skills/README.md`).
- #265 Premier audit avec `web-design-guidelines` (partie et problèmes). Points 3 et 4 corrigés : « Abandonner » et « Qui mène ? » annoncés au lecteur d'écran. Reste : confirmer avant de quitter une partie, nom accessible de « Continuer », `scroll-padding` sous le verdict.
- #261 (#233) Le Go du jour rapporte chaque jour ; l'XP d'une partie n'est plus perdue si on ferme pendant le score ; « Rejouer d'ici » ne rapporte plus d'XP.
- #262 (#136) Lot P : 3 problèmes prouvés, migration non appliquée.
- #263 (#258) Test de passe robuste sous charge (la cause était le test). Deux autres specs instables : #260.
- #264 (#237, N6) Après une erreur, on rejoue directement sur le plateau.
- Assemblage vérifié en local : Vitest 7 343 tests, Playwright 218 passés. CI GitHub toujours bloquée par la facturation.

## 28/09 au soir : CI débloquée, tout fusionné

**Déblocage**
- Cause du blocage : les 2 000 minutes gratuites d'Actions du mois étaient épuisées. Le dépôt était privé, sans moyen de paiement, et le quota était partagé avec `flightle`.
- Décision de Florian : passer le dépôt en public.
  - Avant de le faire, j'ai vérifié tout l'historique (gitleaks, 571 commits) : aucun secret, seulement des clés publiques par nature.
  - La licence « tous droits réservés » est ajoutée (#266, #267).
- #246 est fusionnée après la CI verte. Les 21 PR qu'elle contenait sont fermées.
- Les lots O, P et Q sont appliqués en production, avec des empreintes md5 identiques : **165 problèmes**.
- Vercel limite le nombre de déploiements par jour (plan gratuit) et reste bloqué pendant 24 h. Deux projets Vercel pointent vers le même dépôt : c'est à Florian de décider lequel supprimer. Les déploiements reprendront quand Florian le décidera.

**Fusionné (CI verte)**
- #270 (#268) : confirmation avant de quitter une partie en cours ; nom accessible de « Problème suivant » ; la feuille de verdict ne cache plus le focus.
- #271 (#136) : outil de preuve de vie et mort (`src/go/preuve-vie-mort.ts`, yeux de Benson ; un ko ou un seki donne « non résolu ») et lot Q.
- #272 (#260) : deux specs rendues robustes sous charge.
- #269 et #273 (#167) : les 8 leçons en anglais avec `?lang=en`, relues par l'agent pédagogie.
- #274 (#75) : Go du jour partageable ; un lien ancien ouvre ce défi-là ; « Partager » devient une action secondaire.
- #275 (#77) : « Rejoue cette erreur » depuis la revue, avec révision espacée jusqu'à la maîtrise.

**Appris**
- Les passages en public se préparent : scan de tout l'historique, licence, liste de ce qui devient visible.
- La CI annule les exécutions de main quand une autre fusion arrive. Seule la dernière exécution fait foi.
- Un agent a recréé une branche dont le nom existait déjà sur GitHub. Elle a été poussée sous un autre nom (`rejoue-erreurs-77`) pour ne pas écraser l'historique.

## Nuit du 28 au 29/09 (jusqu'à 3 h)

**Fusionné (CI verte à chaque fois)**
- Contenu :
  - #281 : relecture pédagogique des problèmes en anglais (17 corrections), lot R traduit.
  - #296 (#282) : 10 textes français ambigus corrigés, avec une migration qui ne fait que des mises à jour. Appliquée en production, empreintes md5 identiques.
  - #298 et #304 : lots S (tesuji de capture, 900 à 1250) et T (difficiles, 1100 à 1500). Appliqués en production : **183 problèmes**.
- Jeu :
  - #294 (#80) : bouton « Conseil » de Mochi. 5 phrases prouvées sur 342 positions ; Mochi se tait s'il n'est pas sûr.
  - #299 (#284) : « Continuer » à ta mesure. Une cote cachée du joueur vise 85 % de réussite, sans jamais afficher de total.
  - #302 (#283) : placement « Je sais déjà jouer ». 3 problèmes donnent un niveau estimé en kyu et l'adversaire conseillé.
  - #305 (#286) : import d'une partie SGF (OGS, Fox, KGS) et analyse avec KataGo, avec « Rejoue cette erreur ».
  - #306 (#287) : course aux problèmes. 3 minutes, 3 erreurs, meilleur score à partager.
- Monde :
  - #301 (#167) : choix de la langue dans le Profil ; un appareil en anglais ouvre l'app en anglais.
  - #297 (#285) : aperçu riche du lien partagé (Open Graph, image 1200 × 630). Le domaine reste à confirmer par Florian.
- Qualité :
  - #295 : recette du soir, 360 écrans, et correction de la partie guidée (Mochi s'affichait comme Pomme).
  - #300 (#290 à #293) : 4 défauts d'affichage corrigés.
  - #311 : recette de nuit, 165 écrans en `fr-FR` et en `en-US`, sans blocage. La barre d'actions à 320 px est tenue : libellés de 11 px, car à 12 px la CI débordait de 3 px.
  - #312 (#308 à #310) : l'accueil suit le chapitre conseillé par le placement, « Jouer » ou « Rejouer » selon le cas, espace rétablie dans la revue.
  - Ouvert pour Florian : #307, le conseil de Mochi contre les adversaires au-delà de Caillou.
- Produit :
  - #288 : veille face à chess.com, BadukPop, OGS et KaTrain. Nouvelles issues #283 à #287.
- Backend :
  - #303 (#81) : défi par lien, phase 1. Schéma avec RLS, fonctions `security definer`, tests SQL. **Migration non appliquée** : il faut d'abord la décision de Florian sur les connexions anonymes.

**Appris**
- Deux PR vertes chacune peuvent casser ensemble. Exemple : un import `PortraitMochi` en double après #294 et #295. Avant de fusionner la seconde, je ramène main dans sa branche et je relance le typecheck. Il faut aussi lire le code de sortie du typecheck, pas la dernière ligne d'un tube.
- Chromium bloque certains ports, comme 5060 et 5061 (`ERR_UNSAFE_PORT`) : on les évite pour les e2e.
- Plusieurs agents partageaient le même fichier `/tmp/*.pid` : chaque agent prend maintenant son propre fichier.

## 29/09 au soir : réglages de Florian et #318 (backend)

- Vercel : Florian a supprimé le projet en double `jeu-de-go-1y5y` (son seul domaine était `jeu-de-go-1y5y.vercel.app`). Reste `jeu-de-go` → `jeu-de-go.vercel.app`.
- Supabase (projet `jeu-de-go`, Paris) : connexions anonymes et liaison manuelle activées par Florian, limite 30 connexions anonymes par heure et par IP. Captcha laissé coupé : l'app ne l'envoie pas encore (à faire avec Cloudflare Turnstile, gratuit, avant de l'activer).
- #318 → PR #319, CI verte, fusionnée ; migration `purge_anonymes` appliquée en production. Décision de Florian : sessions sans compte effacées après **60 jours** sans activité, chaque nuit (pg_cron, 03:17 UTC). Mêmes règles que « Supprimer mon compte » : parties partagées gardées pour l'autre joueur, anonymisées. Tests SQL (8 cas, mutation vérifiée) et Vitest. Politique de confidentialité : E13 corrigé. 0 anonyme en production aujourd'hui.

## Nuit du 29 au 30/09 : toute l'équipe sur l'amélioration de l'app

Mandat de Florian : « fais bosser toute la team d'agents », jusqu'à 8 h, autant d'agents que nécessaire. 17 agents lancés (frontend ×2, backend ×2, qa ×2, moteur-go ×3, pedagogie ×3, growth ×2, produit, designer, juridique, architecte), chacun dans son worktree, avec des périmètres séparés.

**Fusionné (CI verte avant chaque fusion) — 18 PR :**
- #321 politique de confidentialité et CGU réalignées (#223, #111) ; nouvel écart E14 trouvé : jetons de session envoyés à PostHog/Sentry dans l'adresse.
- #336 E14 corrigé : fragment `#` et paramètres sensibles retirés avant tout envoi (fuite confirmée par un essai, puis prouvée fermée par un e2e).
- #322 et #328 « Continuer à ta mesure » (#284) ; plus aucune cote affichée dans les Problèmes.
- #326 import SGF : lien OGS, erreurs lisibles (#286).
- #327 action `defi_coup` dans `game-action` + faille corrigée (on pouvait nommer un tiers dans une partie) ; #338 écrans du défi par lien (#81).
- #330 CI rouge depuis minuit (#329) : le titre du Go du jour n° 4 rognait le goban d'accueil ; tuiles resserrées.
- #331 lot U (15 problèmes relier/couper/vie et mort) ; #341 leçons 9 à 12 (filet, prise en retour, course aux libertés, faux œil).
- #332 arrivée par lien : premier coup guidé, « Apprends à jouer en 2 minutes » (#285).
- #333 économie de progression (#233) + veille du 29/09 ; #334 score raconté (#78) ; #335 goban au clavier (#116) ; #337 conseil de Mochi, 9 modèles (#80) ; #339 série fêtée à 3/7/30 jours, Profil sans cote (#214) ; #340 performance et PWA (#323 : JS initial −17 %, hors ligne fiable, budget en CI).

**Production Supabase :** migrations `places_du_joueur`, `cote_a_mesure`, `lot_u` appliquées (lot U : empreinte md5 identique au dépôt). 198 problèmes communs. Rien supprimé. Aucun déploiement Vercel ni de fonction.

**Issues fermées avec rapport :** #284, #286, #287, #78, #214, #233, #136, #329. Points d'étape sur #81, #116, #80, #285.

**Incidents :** le conteneur a redémarré deux fois (vers 1 h 20 et 1 h 30). Le second redémarrage a arrêté 5 agents pour le reste de la nuit : lot V de problèmes, recette complète, rappel quotidien (#36), suite perf (#325, #324, travail partiel non commité) — à relancer.

**À décider par Florian :** déployer `game-action` (le défi par lien n'est jouable qu'après) ; propositions de l'économie (XP de la course, révision « Vu », gels) ; titres d'aperçu par numéro (fonction Vercel) ; modèles d'e-mail Supabase en `TokenHash` ; purge dans PostHog des évènements reçus avec un jeton.

## 30/09 soir → 01/10 : défi réparé, compte obligatoire, nouvelle vague d'agents

- **Bug signalé par Florian (22 h 55)** : dans un défi, l'ami ne pouvait poser aucune pierre (« Ce coup n'a pas pu être lu »). Cause : la fonction serveur `game-action` en production datait du 27/09 et ignorait `defi_coup` (#327 fusionné mais jamais déployé). Redéployée (v2), contenu vérifié identique au dépôt. #344 : déploiement automatique des fonctions par la CI (#345, actif après ajout du secret), test de contrat client-serveur (#348).
- **Décision de Florian** : compte obligatoire avec pseudo, essai limité sans compte, défi = compte avant le premier coup (#343). Livré : #345 serveur (migration `compte_obligatoire` appliquée), #346 app (essai, connexion par code à 6 chiffres, pseudo obligatoire, défi avec compte), #347 juridique (âge 15 ans, politique, CGU, décisions D1–D8).
- **Autres fusions (CI verte)** : #340 perf PWA, #341 leçons 9 à 12, #348 recette (Pomme stable après une passe sur téléphone lent, badge clarifié), #349 anglais chargé à la demande (JS initial 230 Ko), #350 lot V (16 problèmes, appliqué en production, md5 identique ; 214 problèmes communs), #351 rappel quotidien (prêt, désactivé).
- **Incidents** : 2 redémarrages du processus ; tous les agents repris depuis leur dernier commit, rien perdu de commité.
- **À faire par Florian** : modèles d'e-mail avec code (`docs/growth/connexion-code.md`), couper les connexions anonymes, secret `SUPABASE_ACCESS_TOKEN` (`docs/architecture/deploiement-fonctions.md`), activation du rappel (`docs/growth/rappel-quotidien.md`), décisions juridiques D1–D8.
