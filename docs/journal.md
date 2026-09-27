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
