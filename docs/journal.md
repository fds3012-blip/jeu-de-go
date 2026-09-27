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

## #3 Maquettes des 5 écrans et design tokens (designer)

- Livré : fichier Figma « Jeu de go : Encre & Jade » (https://www.figma.com/design/9Ft0rUVY3lB7cY7pIyjNti) avec tokens, 7 composants et les 5 écrans en 390 × 844, modes sombre et clair ; `src/ui/tokens.css` complet (rôles, typographie, espacements, rayons, tailles de cible, mouvement réduit) ; `app.css` passe par les tokens ; test Vitest du contraste AA dans les deux modes.
- Constat : le vermillon pur n'atteint pas 4,5:1 comme texte, d'où `--danger-texte`.
- Vérifications : lint, typecheck, 57 tests, build, e2e : vert.
- Reste : validation des maquettes par Florian. L'issue reste ouverte avec le label « bloqué ».
