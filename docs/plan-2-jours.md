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
- [ ] Glisse : écran d'erreur si un écran ne se charge pas (frontend) ; Supabase hors du premier écran, reporté après #343 (compte obligatoire : l'accueil a besoin de la session). `vercel.json` (cache `immutable` de `/assets/*`) : à valider.
