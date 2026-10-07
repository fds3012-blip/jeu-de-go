# Plan des 2 premiers jours

Objectif à la fin du jour 2 : une application web installable, en ligne sur Vercel, où l'on peut créer un compte, jouer contre KataGo, faire les leçons et les problèmes, et jouer une partie en ligne entre deux comptes.

## Jour 1 : fondations

| Créneau | Agent | Livrable |
|---|---|---|
| Matin | architecte | Projet Vite + React + TS, CI GitHub Actions (lint, tests, build), déploiement Vercel de chaque PR |
| Matin | designer | Tokens Encre & Jade dans le code, maquettes Figma : accueil, partie, problèmes, leçons, profil |
| Matin | moteur-go | Règles du go en TypeScript (captures, ko, suicide, comptage japonais et chinois, SGF) avec tests |
| Après-midi | frontend | Coquille de l'appli : navigation en bas (Jouer, Apprendre, Progrès, Profil), composant plateau tactile |
| Après-midi | backend | Connexion par e-mail, écran de choix du pseudo, types TypeScript générés depuis Supabase |
| Après-midi | qa | Premiers tests Playwright (ouverture, navigation, poser une pierre) |

## Jour 2 : jouer

| Créneau | Agent | Livrable |
|---|---|---|
| Matin | moteur-go | KataGo dans un Web Worker, niveaux de l'échelle des défis |
| Matin | backend | Fonction serveur qui valide chaque coup (captures, ko) et fin de partie aux points avec accord des deux joueurs |
| Matin | frontend | Partie contre l'IA de bout en bout, écran de fin de partie |
| Après-midi | frontend + backend | Partie en ligne : invitation par code, recherche d'adversaire, coups en temps réel |
| Après-midi | frontend | Leçons et problèmes branchés sur Supabase (progression sauvegardée) |
| Après-midi | growth | PostHog (inscription, première partie, rétention J1) et Sentry |
| Fin de journée | qa | Tests des parcours clés, audit accessibilité, démo déployée |

## Hors périmètre de ces 2 jours
Analyse coup par coup avec KataGo, badges, mascotte animée, publication sur les stores, abonnement Premium. Ils viennent juste après, le prototype sert de référence.

## Suivi (tenu par l'architecte)

- [x] Jour 1, architecte : socle Vite + React + TS, alias `@/`, ESLint + Prettier, Vitest, Playwright (viewport 390 x 844), CI GitHub Actions (lint, types, tests, build, e2e), PWA installable (manifeste, icônes, service worker). Issue #1, branche `issue-1-socle`.
- [x] Jour 1, architecte : déploiement Vercel de chaque PR (#2) : production sur https://jeu-de-go.vercel.app, aperçu par PR.
- [x] 29/09 soir, architecte : perf et fiabilité de la PWA (#323, branche `perf-pwa-29`). Écrans à la demande (JS initial 306 → 254 Ko gzip, accueil 3,5 → 3,1 s sur téléphone lent en 4G lente), service worker qui met toute l'app en cache (la réouverture hors ligne ne dépend plus du hasard), budget de taille en CI (`npm run budget`). Mesures : `docs/qa/perf-2026-09-29.md`.
- [x] 30/09 soir, architecte : textes anglais à la demande et PostHog après le premier écran (#325), règle `.pastille-ok` rétablie (#324), branche `perf-325`. JS initial 269 → 230 Ko gzip, budget abaissé à 250 Ko ; accueil 3,5 → 3,0 s en français, 3,46 → 3,26 s en anglais (téléphone lent, 4G lente). Mesures : `docs/qa/perf-2026-09-29.md`, section du 30/09.
- [x] 02/10 soir, tech lead : supabase-js chargé à la demande (#401, branche `budget-js-marge`). JS initial 249 → 193 Ko gzip, budget abaissé à 200 Ko ; accueil 3,2 → 2,8 s (téléphone lent, 4G lente), écran identique, hors ligne inchangé. Erreurs du démarrage gardées en file jusqu'à Sentry. Mesures : `docs/qa/perf-2026-09-29.md`, section du 02/10.
- [x] 02/10 nuit, architecte : robustesse (#325, point 4 ; branche `robustesse-02-10`). Écran d'erreur avec Mochi (« Réessayer », retour à l'accueil) à la place d'un écran blanc, limite d'erreur autour de chaque écran et autour de l'app, erreurs envoyées à Sentry avec leur catégorie (`chargement`, `reseau`, `rendu`) sans donnée personnelle ; bandeau « Tu es hors ligne » sur les écrans qui ont besoin du réseau ; invite « Mise à jour prête » quand une nouvelle version arrive, jamais en partie. CI : job des tests SQL (`bash supabase/tests/lancer.sh` sur un Postgres jetable) et job qui vérifie que la copie src/go → supabase/functions est à jour.
- [x] 04/10 nuit, tech lead : chargement initial allégé (#433, branche `alleger-433`). Go du jour léger sur l'accueil (problèmes complets à la demande), textes des écrans secondaires à part (`src/content/i18n/secondaires`), `apprendre.css` avec ses écrans. JS initial 199,4 → 156,0 Ko gzip (budget 175 Ko), CSS 29,0 → 24,2 Ko (budget 26 Ko) ; accueil 2,94 → 2,72 s en première visite (téléphone lent, 4G lente), styles calculés identiques sur toute la suite e2e. Règles : `docs/architecture/chargement-initial.md`.
- [x] 07/10 nuit, tech lead : CI plus rapide et plus stable (#467, branche `ci-rapide-467`). Playwright en 4 lots parallèles dans l'image officielle, lancés avec les vérifications, rapport fusionné sur le check `Playwright (mobile)` (nom inchangé) ; cache npm. 15 à 20 min → 6 min de bout en bout. 12 tests lents ou instables fiabilisés (durées mesurées dans la page, horloge simulée pour les 25 s de la file, attentes explicites), aucun retiré. Règles : `docs/architecture/ci.md`.
- [ ] Glisse : Supabase hors du premier écran, reporté après #343 (compte obligatoire : l'accueil a besoin de la session). `vercel.json` (cache `immutable` de `/assets/*`) : à valider.
