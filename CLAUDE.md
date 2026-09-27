# Brief projet : jeu de go grand public

## Objectif
Attirer un très grand nombre de joueurs, débutants compris. Chaque écran doit être compris en 3 secondes, avec une seule action principale bien visible (modèle : chess.com). Langue de l'interface : français d'abord, puis anglais.

## Ce qui existe déjà
- Un prototype complet (une page HTML) : règles, comptage, IA KataGo dans le navigateur, analyse coup par coup, leçons, problèmes, échelle de 9 adversaires, badges, parties en ligne. Il sert de référence fonctionnelle.
- Contenu vérifié : `content/lessons.fr.js` (6 leçons interactives). Les 6 problèmes de base sont dans la table `puzzles` de Supabase.
- Base Supabase en production : projet `jeu-de-go` (réf. `xjvsalkvpgcjrznznxoi`, région Paris). Schéma versionné dans `supabase/migrations`.

## Stack
- Front : Vite, React, TypeScript, PWA installable. Plus tard Capacitor pour l'App Store et Google Play.
- IA : KataGo en TensorFlow.js dans un Web Worker, en réutilisant le moteur du projet open source web-katrain (licence MIT, https://github.com/Sir-Teo/web-katrain) et le réseau `g170-b6c96-s175395328-d26788732.bin.gz` du dépôt KataGo. L'IA tourne sur l'appareil du joueur : pas de coût serveur.
- Backend : Supabase (auth, Postgres, temps réel, fonctions). Toute règle de sécurité passe par RLS ou par une fonction serveur, jamais par le client seul.
- Hébergement : Vercel. Suivi : PostHog (usage), Sentry (erreurs).

## Règles de travail (tous les agents)
1. Une issue GitHub = une branche = une pull request. Le titre de la PR reprend le numéro de l'issue.
2. Tests obligatoires : Vitest pour la logique, Playwright pour les parcours clés. La CI doit être verte avant de fusionner.
3. Aucun secret dans le dépôt : variables dans `.env.local` et dans Vercel. La clé publique Supabase (anon/publishable) peut aller côté client, jamais la clé service.
4. Base de données : toute modification passe par une nouvelle migration dans `supabase/migrations`, avec RLS activé sur chaque table.
5. Textes d'interface : phrases courtes, tutoiement, vocabulaire du go expliqué la première fois (atari, ko, komi).
6. Accessibilité : cibles tactiles de 44 px minimum, contraste AA, mode sombre et clair, mouvements réduits respectés.
7. Ne modifie pas le périmètre d'un autre agent sans le signaler dans ta PR.

## Conventions de code
- Coordonnées internes : index `y * N + x` (y depuis le haut). Coordonnées affichées : lettres A à T sans I, lignes numérotées depuis le bas. Stockage des coups : SGF (2 lettres, `tt` = passe).
- Dossiers : `src/app` (écrans), `src/ui` (composants), `src/go` (règles, SGF, comptage), `src/engine` (KataGo), `src/data` (Supabase), `src/content` (leçons).
