# Leçons sur 13 × 13 et 19 × 19 (#454)

Le lecteur de leçons (`src/app/Lecon.tsx`) et les démonstrations (`src/content/demo.ts`) acceptent des positions de 9,
13 ou 19 lignes, avec un cadrage optionnel sur une zone (un coin) pour rester lisible sur un téléphone. Les leçons
9 × 9 existantes ne changent pas (rendu identique, vérifié par `src/content/grandsPlateaux.test.ts`).

Ce document sert de mode d'emploi pour écrire les leçons d'ouverture 13 × 13 et de joseki.

## Format

Dans `content/lessons.fr.js`, une leçon garde la même forme. Deux champs s'ajoutent, tous deux facultatifs :

| Champ | Où | Valeur | Effet |
| --- | --- | --- | --- |
| `taille` | leçon | `13` ou `19` (9 par défaut) | Taille de toutes les étapes ; écrite dans l'index (`npm run index-lecons`) et annoncée sur le chemin (« 19 × 19 » sous le titre, et dans le nom lu par le lecteur d'écran). |
| `cadre` | étape | voir ci-dessous | Seule cette zone est montrée, touchable et parcourue au clavier. Sans `cadre` : tout le plateau. |

La taille réelle d'une étape est celle de ses `rows` : 13 ou 19 chaînes de 13 ou 19 caractères. Le test refuse une
étape dont les `rows` n'ont pas la `taille` de la leçon.

### Écrire une position : `plateau()`

Écrire 19 lignes à la main est long et fragile. `content/plateau.js` les fabrique depuis les coordonnées affichées :

```js
import { plateau } from './plateau.js';

rows: plateau(19, { X: ['D4', 'C6'], O: ['F3'] }),   // X noir, O blanc
rows: plateau(13, { X: ['D4'], T: ['E4'] }),          // T pierre blanche visée, S pierre noire à sauver
```

Lettres A à T sans I, lignes numérotées depuis le bas, comme partout. Un point hors du plateau ou déjà occupé lève une
erreur au chargement des tests.

### Cadrer une zone : `cadre`

| Valeur | Zone montrée |
| --- | --- |
| `'bas-gauche'`, `'bas-droite'`, `'haut-gauche'`, `'haut-droite'` | Le coin, sur 10 lignes en 19 × 19 (jusqu'aux hoshi du bord : D10, K4…), 8 en 13 × 13 |
| `{ coin: 'bas-gauche', cote: 9 }` | Le même coin, sur `cote` lignes (5 au moins) |
| `{ hautGauche: 'F14', cote: 7 }` | Un carré de `cote` lignes dont l'intersection en haut à gauche est F14 (un bord, le centre) |

Ce que le lecteur fait d'un cadre :
- les coordonnées et les hoshi sont ceux du vrai plateau (D4 reste D4, Q16 reste Q16) ; seules les lettres et les
  lignes de la zone sont écrites, dans une bande hors du bois ;
- les bords réels du plateau gardent leur trait épais ; sur un côté coupé, les lignes continuent jusqu'au bord de la
  vue et une pierre voisine apparaît coupée : on voit que le plateau continue ;
- un toucher hors de la zone ne fait rien ; le curseur clavier reste dans la zone ;
- les pierres hors de la zone existent (captures, libertés, comptage justes) mais ne se voient pas.

Un test refuse toute étape dont un point nommé (`accept`, `libs`, `aide`, `refus`, `geste`, temps de `demo`) est hors
de la zone montrée.

### Lisibilité et cibles tactiles

| Vue | Écart entre deux intersections (iPhone 390 px) | Seconde touche |
| --- | --- | --- |
| 9 × 9 entier | 36 px | selon le réglage « Confirmer au doigt » |
| Coin de 9 lignes | 36 px | selon le réglage |
| Coin de 10 lignes (défaut en 19 × 19) | 32 px | toujours |
| 13 × 13 entier | 26 px | toujours |
| 19 × 19 entier | 18 px | toujours ; à réserver aux images sans geste |

Au-delà de 9 lignes visibles (`LIGNES_CONFORT`, `src/content/cadreLecon.ts`), la confirmation au doigt est forcée :
le premier toucher pose une pierre fantôme, le second la joue. À la souris et au clavier, rien ne change.

Conseils :
- une étape où l'élève touche ou pose une pierre en 19 × 19 est **toujours cadrée** (un coin de 9 ou 10 lignes) ;
- le 13 × 13 entier convient aux gestes simples (un coin libre, un point loin des autres) ;
- le 19 × 19 entier sert pour une image d'ensemble (les quatre coins, un moyo), sans geste ;
- garder le même cadre d'une étape à l'autre d'une même séquence : changer de zone désoriente.

## Leçons d'essai

`content/lessons.essai.js` contient deux leçons internes, hors du chemin et de l'index :
- `essai-13` : 13 × 13 entier (geste, coup libre), puis un coin cadré (touche le hoshi) ;
- `essai-19` : 19 × 19 cadré sur le coin bas gauche (geste, touche, coup, question sur les hoshi), le coin haut droit
  (démonstration des libertés), puis le plateau entier.

Elles ne s'ouvrent que dans un build de test (`VITE_E2E=1`) ou de développement, avec `?lecon-essai=13` ou
`?lecon-essai=19`. En production, ce code et ce contenu ne sont pas dans le bundle. Parcours vérifiés par
`e2e/lecons-grands-plateaux.spec.ts` (390 et 320 px, clair et sombre, zoom 200 %, texte doublé, polices web bloquées).

## Pour publier une leçon 13 × 13 ou 19 × 19

1. Écrire la leçon dans `content/lessons.fr.js` avec `taille` et, pour chaque étape jouable en 19 × 19, un `cadre`.
2. L'ajouter à un chapitre, puis `npm run index-lecons`.
3. Ajouter son motif de vignette dans `src/ui/vignettes.ts` (grille 4 × 4 ; `coin: true` et `hoshi` pour un coin).
4. Traduire dans `content/lessons.en.js` (mêmes étapes, textes seulement).
5. Prouver les réponses : les tests de forme passent d'eux-mêmes (`src/content/grandsPlateaux.test.ts`) ; le jugement
   (meilleur coup d'ouverture, suite de joseki) se vérifie avec KataGo, comme les leçons 9 × 9.

## Preuves KataGo (#16)

Les leçons publiées sur grand plateau (l29 l'ouverture en 13 × 13, l30 le san-san, l31 le 3-4 et l'approche) sont
jugées par KataGo, une fois, puis le jugement est rejoué en CI sans le modèle :

- `src/go/preuvesKataGo.ts` : quoi juger (`CONTROLES` : démonstrations, exercices, questions « lequel »), les réglages
  (réseau g170 b6c96, komi 6,5, règle japonaise, 800 visites à la racine et 400 après chaque coup, 4 symétries) et les
  seuils (`TOLERANCE`, `MARGE`, `TOLERANCE_DEMO`). La recherche est déterministe : les symétries du plateau (rotation,
  miroir) servent de graines, comme dans KataGo ;
- `npm run preuves-katago [-- l30]` (`outils/preuvesKataGo.ts`) : calcule et fige `src/go/preuves-katago.json`.
  Réseau : `npm run fetch-model`. TensorFlow natif conseillé (`TFJS_NODE_DIR`, un dossier où `@tensorflow/tfjs-node`
  est installé) : environ une heure pour les trois leçons, sinon des heures ;
- `src/go/lecons-ouverture.test.ts` : rejoue le jugement. Une position de leçon modifiée sans nouvelle analyse fait
  échouer le test (la position n'est plus dans la fixture).

Non prévu pour l'instant : un cadre rectangulaire (un bord entier), et un passage animé d'une zone à l'autre.
