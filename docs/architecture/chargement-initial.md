# Chargement initial : ce que le téléphone télécharge avant l'accueil

Budget vérifié en CI par `scripts/budget-bundle.mjs` (`npm run build && npm run budget`) : JS initial ≤ 150 Ko gzip,
CSS initial ≤ 22 Ko gzip (#563, 16/10), polices ≤ 80 Ko, chaque écran chargé à la demande ≤ 60 Ko. Relever un budget est une
décision : dis pourquoi dans la PR.

## Ce qui est dans le chargement initial

- `lib-react` (React, React DOM) : ≈ 67 Ko gzip, empreinte stable d'un déploiement à l'autre.
- `index` : l'accueil, la barre de navigation, le plateau, les règles du go, le moteur simple de l'échelle, le
  catalogue de textes **de l'accueil** (`src/content/i18n/fr.ts`), l'**index léger des leçons**
  (`src/content/leconsIndex.gen.ts` : titre et nombre d'étapes, pour la carte « Leçon » et le chemin conseillé) et le
  **Go du jour léger** (`src/content/goDuJour.gen.ts`).
- La feuille de style principale : tokens, accueil, navigation, et les styles des écrans importés par `src/main.tsx`.

## Ce qui arrive après le premier affichage

| Quoi | Où | Quand |
| --- | --- | --- |
| Écrans (partie, leçons, problèmes, Profil, défis…) | `src/app/ecrans.ts` (`React.lazy`) | au premier affichage de l'écran ; tous préchargés après l'accueil (`prechargerEcrans`), la partie tout de suite (`prechargerPartie`) |
| Textes des écrans secondaires (≈ 1 000 clés, ≈ 18 Ko gzip) | `src/content/i18n/frEcrans.ts`, morceau `secondaires` | avec le premier écran qui les importe |
| Leçons complètes (positions, démonstrations, consignes : ≈ 9 Ko gzip, #16) | `src/content/lessons.ts`, `content/lessons.fr.js` | avec les écrans Apprendre, leçon, placement et aide |
| Problèmes complets (consignes, explications : ≈ 26 Ko gzip) | `src/content/puzzles.ts`, `src/content/problemesLocaux.ts` | avec l'écran des problèmes, le placement, la série de fin de leçon |
| `apprendre.css` (≈ 5 Ko gzip) | importée par `Learn.tsx`, `Puzzles.tsx`, `ui/Lecteur.tsx` | avec ces écrans |
| `import.css` (≈ 1 Ko gzip, #538) | importée par `ImportSgf.tsx` (morceau du Profil) | avec le Profil ; le style des tuiles grisées hors ligne est en ligne dans `Accueil.tsx` |
| `profil-ecran.css`, `amis.css` (#563) | `Profil.tsx` (en tête), `Account.tsx`, `Amis.tsx`, `ReglageIA.tsx`, `Vitrine.tsx`, `IconesReglages.tsx` | avec le Profil ; `profil.css` garde les lignes, Conditions et le bandeau de consentement |
| `course-ecran.css`, `defis-ecran.css`, `conseil.css`, `comptage.css` (#563) | `Puzzles.tsx`, `CourseProblemes.tsx` ; `Defis`, `Direct`, `Lentes` ; `BulleCoach`, `ConseilMochi` ; `Game.tsx` | avec leurs écrans |
| Synthèse des sons (`src/ui/sound.ts`, #563) | écrans qui jouent un son ; `Niveau.tsx` par `import()` | `sonContexte.ts` (déverrouillage au premier geste, réglage « Sons ») reste dans le JS initial |
| Page Conditions (`src/app/Conditions.tsx` et ses 41 textes, #563) | `Profil.tsx` | avec le Profil ; le bandeau de consentement reste dans `Confidentialite.tsx` |
| Série de fin de leçon (`src/content/themes.ts`, `redites.ts`, #563) | `App.tsx`, dans le `Promise.all` de « S'entraîner » | au toucher, avec les problèmes et les leçons complètes (déjà chargés là) |
| supabase-js (`lib-donnees`) | `src/data/client.ts` | après le premier écran, ou tout de suite si la session l'exige (#401) |
| PostHog, Sentry | `src/data/analytics.ts` | après le premier écran (#325) |
| Textes anglais | `src/content/anglaisContenu.ts` | avant l'accueil, seulement pour un joueur en anglais (#325) |

Le service worker (`public/sw.js`, liste calculée par `outils/pwa.ts`) met tous ces morceaux en cache après la première
visite : le hors-ligne ne dépend pas de l'ordre de navigation.

## Règles pour garder la marge

### Textes : `t` de l'accueil ou `t` des écrans secondaires

- `src/content/i18n/fr.ts` : les textes que l'accueil (ou un module du JS initial) affiche.
- `src/content/i18n/frEcrans.ts` : tous les autres.
- Un module qui affiche un texte de `frEcrans.ts` importe `t` (ou `traduire`, `Cle`) de
  `src/content/i18n/secondaires` au lieu de `src/content/i18n`. L'import ajoute les textes au catalogue avant que le
  module ne s'exécute. Le typage l'impose : `t` de `src/content/i18n` refuse une clé de `frEcrans.ts`.
- `en.ts` reste un seul catalogue (toutes les clés), chargé d'un bloc pour un joueur en anglais.
- Si un module du JS initial importe `secondaires`, les textes reviennent dans le JS initial : le budget le signale.
- Nouvelle clé lue par l'accueil : dans `fr.ts`. Sinon : dans `frEcrans.ts`.

### Go du jour léger

`src/content/goDuJour.gen.ts` est généré depuis `src/content/puzzles.ts` (id, titre français, position) par
`outils/goDuJour.ts`. Après l'ajout ou la modification d'un lot de problèmes : `npm run go-du-jour`.
`outils/goDuJour.test.ts` échoue tant que le fichier est en retard, et vérifie que l'accueil montre le même problème
(numéro, titre, position, en français et en anglais) qu'avec la liste complète.

### Index léger des leçons

`src/content/leconsIndex.gen.ts` est généré depuis `content/lessons.fr.js` (id, titre, description, nombre d'étapes,
chapitres) par `outils/leconsIndex.ts`. Après l'ajout ou la modification d'une leçon : `npm run index-lecons`.
`outils/leconsIndex.test.ts` échoue tant que le fichier est en retard, et vérifie que l'accueil voit les mêmes leçons
et chapitres (français et anglais) qu'avec le contenu complet. L'accueil (`src/app/App.tsx`) importe
`src/content/leconsResume.ts`, jamais `src/content/lessons.ts` ; le lecteur de leçon retrouve la leçon complète par son
identifiant.

### Styles des écrans

Les styles importés par `src/main.tsx` restent dans la feuille principale, à leur place : l'ordre de la cascade ne
change pas. Une feuille chargée avec son écran arrive **après** la feuille principale : à spécificité égale, ses
règles l'emportent désormais sur celles qui la suivaient. Avant de sortir une feuille de `src/main.tsx` :

1. Mettre dans une feuille partagée, importée à sa place par `src/main.tsx`, les règles qui servent hors de ses
   écrans (exemple : `apprendre-partage.css`, le mini goban de l'accueil et la vignette du carrousel).
2. Comparer les styles calculés avant et après sur toute la suite e2e (états finaux de chaque test) ; corriger
   chaque écart par une règle explicite, commentée `#433` (exemple : `.btn.continuer` dans `apprendre.css`).

### Modules partagés entre l'accueil et un écran (#513)

Rollup garde dans le JS initial **tout ce qu'un écran utilise** d'un module que l'accueil importe aussi, même si
l'accueil n'en lit qu'une constante. Exemple du 10/10 : `OPPONENTS` (dans `src/engine/simple.ts`) tirait tout le
moteur simple (Monte-Carlo, filtre d'ouverture, pierres mortes) dans le JS initial ; `compteDe` (dans
`src/data/defi.ts`) tirait les RPC des défis et le temps réel. Règle : quand l'accueil n'a besoin que d'une petite
partie d'un module lourd, mets cette partie dans un module à part, sans les imports lourds, et importe-la depuis là
dans l'accueil. Le module d'origine la réexporte : les écrans ne changent pas.

| Partie légère (JS initial) | Module lourd (avec ses écrans) |
| --- | --- |
| `src/engine/adversaires.ts` (`OPPONENTS`, `opponent`, types) | `src/engine/simple.ts` (+ `sim`, `dead`, `ouverture`, `go/score`) |
| `src/data/defiLien.ts` (`compteDe`, `estAnonyme`, liens de défi) | `src/data/defi.ts` (+ `tempsReel`, `i18n/refus`) |
| `src/data/lectureProfil.ts` (`fetchProfile`, `fetchStreak`, `fetchGels`) | `src/data/account.ts` (+ `username`) |
| `src/app/aideMochi.ts` (`aideActive`, `ReglageAide`) | `src/app/partie.ts` (coach, comptage, indices ; + `go/frontieres`) |
| `src/ui/sonContexte.ts` (contexte audio, déverrouillage, réglage, #563) | `src/ui/sound.ts` (synthèse) |
| `src/app/rappelEtat.ts` (`etatRappel`, `estArriveeRappel`, #563) | `src/app/rappel.ts` (proposition, abonnement) |
| `src/app/coteEtat.ts` (`COTE_KEY`, `nettoyerCote`, #563) | `src/app/coteJoueur.ts` (Elo, choix du problème) |
| `src/content/themesLecons.ts` (`THEMES_DE_LECON`, #563) | `src/content/themes.ts` (thème de chaque problème, `serieDeLecon`) |
| `src/data/lectureProfil.ts` (`liveStreak`, #563) | `src/data/puzzles.ts` |

Pour trouver les suivants : un plugin `generateBundle` temporaire (hors du dépôt) qui écrit `chunk.modules` (taille
rendue de chaque module par morceau), puis, pour chaque module du JS initial, les noms importés par des modules qui
n'y sont pas. Restent candidats (16/10, après #563) : `src/data/analytics.ts` (réglages des SDK et
`src/data/urlSensible.ts`, que `robustesse.ts` garde aussi), `src/app/revisionEspacee.ts` (≈ 0,4 Ko : `compterDus` en
utilise l'essentiel), `src/app/xp.ts`, `src/app/semaine.ts`. `src/ui/Portrait.tsx` et `src/ui/Board.tsx` servent au
premier affichage (portrait de l'adversaire, goban de l'accueil) ; `goDuJour.gen.ts` aussi (un encodage plus court des
positions ne gagnerait que ≈ 0,3 Ko).

## Mesures (04/10, #433)

| | avant | après |
| --- | --- | --- |
| JS initial (gzip) | 199,4 Ko (`index` 132,0 + `lib-react` 67,3) | 156,0 Ko (`index` 88,6 + `lib-react` 67,3) |
| CSS initial (gzip) | 29,0 Ko | 24,2 Ko |
| Morceau `secondaires` (textes des écrans) | dans `index` | 18,4 Ko, à la demande |
| Morceau `puzzles` (problèmes complets) | dans `index` | 31,1 Ko, à la demande |
| `Lecteur-*.css` (apprendre.css) | dans la feuille principale | 6,1 Ko, à la demande |
| Accueil, première visite (`npm run perf`, médiane de 5) | 2,94 s | 2,72 s |
| Accueil, retour et hors ligne | ≈ 0,3-0,4 s | inchangé (bruit de mesure) |

Téléphone émulé : CPU 4× plus lent, 4G lente (`scripts/mesurer-perf.mjs`).

## Mesures (05/10, #16)

| | avant | après |
| --- | --- | --- |
| JS initial (gzip) | 157,0 Ko (16 leçons dans `index`) | 151,1 Ko avec 20 leçons (`index` 83,7 + `lib-react` 67,3) |
| Morceau `lessons` (contenu complet des leçons) | dans `index` | 8,8 Ko, à la demande |
| Palier 21-30 (06/10) : 26 leçons | main : 155,0 Ko | 154,8 Ko ; morceau `lessons` 10,5 Ko, à la demande |
| Leçon 27 (07/10) : 27 leçons | main : 154,8 Ko (26 leçons) | 155,3 Ko |

## Mesures (10/10, #513)

| | avant | après |
| --- | --- | --- |
| JS initial (gzip), `npm run build` (celui de la CI) | 161,4 Ko (`index` 94,0 + `lib-react` 67,3) | 151,0 Ko (`index` 83,7 + `lib-react` 67,3) |
| JS initial (gzip), `VITE_E2E=1 npm run build` | 171,0 Ko | 165,9 Ko |

Les ≈ 171 Ko signalés dans #513 venaient d'un build e2e (`VITE_E2E=1`) : `src/main.tsx` y expose le moteur et les
règles aux tests (`__moteurE2E`), ce qui ajoute ≈ 10 Ko. Le budget se lit sur le build normal, comme en CI.

## Mesure du 16/10 (#563)

Build normal (`npm run build`, celui de la CI), main du 16/10 (`533d5ad`). Poids gzip.

### JS initial avant : 159,3 Ko (`index` 91,9 + `lib-react` 67,3)

Les 15 plus gros contributeurs. Contribution marginale : gzip du morceau sans le module, code de chaque module minifié
(esbuild) ; la somme dépasse un peu le total, gzip partageant les répétitions entre modules.

| Module | Ko |
| --- | --- |
| `react-dom-client` (`lib-react`) | 62,9 |
| `src/app/App.tsx` | 10,5 |
| `src/content/i18n/fr.ts` | 10,0 |
| `src/content/goDuJour.gen.ts` | 7,4 |
| `src/app/Accueil.tsx` | 4,7 |
| `src/ui/Board.tsx` | 4,7 |
| `src/ui/Portrait.tsx` | 3,8 |
| `src/data/analytics.ts` | 3,8 |
| `src/ui/sound.ts` | 2,7 |
| `react` (`lib-react`) | 2,5 |
| `src/ui/boardArt.ts` | 2,1 |
| `src/content/themes.ts` | 1,5 |
| `src/ui/Sceau.tsx` | 1,5 |
| `src/content/leconsIndex.gen.ts` | 1,4 |
| `src/ui/IconesNav.tsx` | 1,4 |

### CSS initial avant : 25,5 Ko (une feuille, `index-*.css`)

Feuilles sources de la feuille principale, chacune compressée seule (la feuille entière se compresse mieux), dans
l'ordre de la cascade : `board` 1,1 · `partie` 5,0 · `comptage` 0,3 · `fin` 2,3 · `installation` 0,8 · `conseil` 0,5 ·
`revue` 2,6 · `apprendre-partage` 0,2 · `gel` 0,7 · `pastille-xp` 0,6 · `course` 1,6 · `niveau` 1,2 · `placement` 1,4 ·
`defis` 1,2 · `compte` 2,2 · `amis` 1,6 · `robustesse` 0,6 · `fonts` 0,3 · `tokens` 1,6 · `accueil` 4,1 · `nav` 1,4 ·
`profil` 3,9 · `app` 2,5.

### Ce qui a quitté le chargement initial

| | avant | après |
| --- | --- | --- |
| JS initial | 159,3 Ko | 149,3 Ko (`index` 81,6 + `lib-react` 67,3) |
| CSS initial | 25,5 Ko | 21,4 Ko |
| Plus gros écran à la demande (`Profil-*.js`) | 24,5 Ko | 25,1 Ko (+ la page Conditions) |
| Textes des écrans (`secondaires-*.js`) | 24,3 Ko | 27,1 Ko (+ 109 textes) |
| Feuille du Profil (`Profil-*.css`) | 3,5 Ko | 4,4 Ko |

JS, par étape : synthèse des sons (−1,9 Ko), page Conditions et ses textes (−2,4), `liveStreak` (−1,0), état du rappel
(−0,8), 68 textes des écrans (−1,7), série de fin de leçon (−1,5), état de la cote (−0,7).

CSS : `profil.css` et `course.css` gardent ce que le JS initial peut afficher, le reste passe dans `profil-ecran.css` et
`course-ecran.css` ; `defis.css` pareil (`defis-ecran.css`), sauf `.defi-point` et `.defi-comptage` ; `amis.css`,
`conseil.css` et `comptage.css` sortent entières ; règles mortes supprimées (`.strip`, `.caps`, `.coach-sceau`,
`.relecture-titre`).

### Méthode pour les feuilles (rendu identique)

1. Une règle ne part que si son sélecteur exige une classe qu'aucun module du JS initial ne produit (recherche dans le
   code des modules du morceau `index`, commentaires exclus) : avant le chargement de l'écran, elle ne pouvait rien
   toucher.
2. Une règle qui part passe après la feuille principale, et dans un ordre variable par rapport aux autres feuilles à la
   demande. Les conflits possibles ont été listés (même spécificité, propriétés communes, éléments qui peuvent porter les
   deux classes, d'après les `className` du code) puis vérifiés à la main ; les vrais restent dans la feuille principale
   (commentés `#563` dans `defis.css`, `course.css`, `profil-ecran.css`).
3. Comparaison des deux builds de production : 13 états (accueil, accueil avec le bandeau, Apprendre, Problèmes, Course,
   Profil, Réglages, Mon compte, Conditions depuis le Profil et depuis le bandeau, feuille « Changer », une partie, une
   leçon), en 390 × 844 et 320 × 568, clair et sombre : 52 captures pleine page identiques au pixel près, et style
   calculé identique pour chaque élément affiché (pseudo-éléments compris). L'accueil avec la seule feuille initiale
   (les autres refusées) est identique aussi. Tirages (`Math.random`) fixés, propriétés triées avant comparaison
   (Chromium énumère les propriétés personnalisées dans un ordre variable).

