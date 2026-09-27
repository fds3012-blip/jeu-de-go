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
