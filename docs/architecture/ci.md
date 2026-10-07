# CI (GitHub Actions)

Fichier : `.github/workflows/ci.yml`. Lancée sur chaque PR, sur `main`, et à la main (`workflow_dispatch`, onglet Actions
ou `POST /repos/{owner}/{repo}/actions/workflows/ci.yml/dispatches`).

## Jobs et noms des statuts

| Statut (nom exact du check) | Rôle |
|---|---|
| `Lint, types, tests, build` | ESLint, `tsc -b`, Vitest, build, budget de taille |
| `Playwright, lot 1/4` … `Playwright, lot 4/4` | La suite e2e répartie en 4 lots (`--shard=N/4`) |
| `Playwright (mobile)` | Fusionne les rapports des 4 lots ; **échoue si un lot échoue ou est annulé** |
| `Migrations et tests SQL` | Migrations rejouées sur un Postgres jetable, puis `supabase/tests` |
| `Copie src/go → supabase/functions à jour` | Copie des règles du go côté serveur à jour |

`Playwright (mobile)` garde le nom de l'ancien job unique : les scripts qui attendent la CI et une éventuelle règle de
protection de branche n'ont rien à changer. Il dépend des 4 lots (`needs` + `if: always()`), télécharge leurs rapports
« blob », les fusionne (`playwright merge-reports --reporter=github,html`) : les annotations des tests en échec ou
instables et le résumé apparaissent sur ce check, le rapport HTML est l'artefact `playwright-report`.

Au 07/10, `main` n'a ni protection de branche ni ruleset : aucun statut n'est exigé côté GitHub.

## Durée (#467)

Avant : `Lint, types, tests, build` (3 à 4 min) **puis** Playwright sur une seule machine (10 à 15 min de tests,
plus 1,5 min d'installation) : 15 à 20 min de bout en bout, un passage annulé à la limite de 20 min.

Après : les 4 lots partent en même temps que `Lint, types, tests, build` (plus de `needs`), environ 4 min de tests
chacun ; la fusion prend une demi-minute. Environ 6 min de bout en bout. Le prix : un lot tourne même si le lint
échoue (minutes de CI, pas de temps d'attente).

Délais par job : 20 min (vérifications), 25 min (chaque lot), 10 min (fusion) : quatre à cinq fois la durée normale.

## Caches

- npm : `actions/setup-node` avec `cache: npm` (clé : `package-lock.json`).
- Chromium : `~/.cache/ms-playwright`, clé `ms-playwright-<OS>-<version de @playwright/test lue dans package-lock.json>`.
  Cache trouvé : seules les bibliothèques système s'installent (`playwright install-deps chromium`).

## Tests lents ou instables (#467)

Règles : attendre un état (`expect(...)`, `expect.poll`, `waitForFunction`) plutôt qu'un délai fixe ; mesurer une durée
dans la page (`performance.now()` relevé par un script posé avec `addInitScript`) plutôt qu'avec l'horloge de Playwright,
dont les allers-retours s'allongent sous charge ; pour une attente longue de l'app (25 s), avancer l'horloge de la page
(`page.clock.install()` puis `page.clock.fastForward()`) au lieu d'attendre vraiment. Aucun test retiré ni désactivé.

| Test | Cause | Correction |
|---|---|---|
| `ouverture.spec.ts` (5 tests de durée) | Durées lues par des `page.evaluate` posés après coup ; 0,9 s visé par un minuteur demandé depuis Playwright | Instants (première image, montage, fondu, retrait, fin complète, toucher) relevés dans la page ; bornes relatives à la première image et au montage, avec 250 ms de marge pour un minuteur en retard ; « aussitôt » vérifié dans l'évènement du toucher ; fenêtre CLS sur l'horloge de la page |
| `navigation.spec.ts` « moins de 3 secondes » | `Date.now()` côté Playwright | Apparition de `.cta` relevée dans la page depuis le début de la navigation |
| `file-jamais-vide.spec.ts` (3 tests) | 25 s d'attente réelle par test, au bord du délai sous charge | `page.clock` : ≈31 s → ≈6 s par test ; « rien avant 25 s » vérifié à 24 s (au lieu de 20 s) |
| `partie-guidee.spec.ts` « au-delà du 10e coup » | Le réglage de force suit une estimation (Worker) qui arrivait parfois après les passes | Attente du premier réglage (`go.guidee.v1`) avant de passer |
| `joueur-de-club.spec.ts` « 320 px et hors ligne » | Réseau coupé en plein chargement du menu Profil : clic bloqué | Menu chargé (`networkidle`) et ligne à l'écran avant de couper le réseau |
| `problemes-sans-fin.spec.ts` | Écran du problème chargé à la demande, plus de 5 s sous charge | Délai de 15 s sur cette attente |
| `defi-partie-v3.spec.ts` « abandonner » | Déjà corrigé (#425) : `expect.poll` sur l'appel au serveur | — |

Vitest : la suite tourne dans `Lint, types, tests, build`, hors du chemin critique (les lots Playwright sont plus longs).
Les calculs lourds (lots de problèmes, `lot-n` n18 : ~50 s) ont déjà un délai par test (60 à 300 s). Ajouté :
`passe-fin.test.ts` (délai 30 s pour tout le bloc, ~1 s par test au calme) et `conseil.test.ts` (un appel au-delà de
300 ms est re-mesuré deux fois et le plus court compte : un calcul vraiment lent échoue encore). Pas de projet Vitest
séparé : il ne raccourcirait pas la CI tant que Playwright reste le plus long.

## En local

Comme en CI, un lot : `CI=1 npx playwright test --shard=2/4` (rapport blob dans `blob-report/`), puis
`npx playwright merge-reports --reporter=html ./blob-report`. Sans `CI`, le rapport reste `list`.
