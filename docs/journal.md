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
