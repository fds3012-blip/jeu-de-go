# Chargement initial : ce que le téléphone télécharge avant l'accueil

Budget vérifié en CI par `scripts/budget-bundle.mjs` (`npm run build && npm run budget`) : JS initial ≤ 175 Ko gzip,
CSS initial ≤ 26 Ko gzip, polices ≤ 80 Ko, chaque écran chargé à la demande ≤ 60 Ko. Relever un budget est une
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

Pour trouver les suivants : un plugin `generateBundle` temporaire (hors du dépôt) qui écrit `chunk.modules` (taille
rendue de chaque module par morceau), puis, pour chaque module du JS initial, les noms importés par des modules qui
n'y sont pas. Restent candidats (10/10) : `src/ui/sound.ts` (objet `synth` entier), `src/ui/Portrait.tsx`,
`src/app/revisionEspacee.ts`, `src/app/rappel.ts`, `src/app/xp.ts`, `src/app/semaine.ts`.

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
