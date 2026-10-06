# Programme d'apprentissage : du premier coup au premier dan (#16)

Décision de Florian du 05/10 : le programme continue vers le niveau dan. Objectif de l'issue : 60 leçons à terme,
en 6 chapitres. Ce document dit ce qui existe, comment chaque leçon est vérifiée, et ce qui vient ensuite.

## Règles d'écriture (toutes les leçons)

- 3 à 6 étapes, environ deux minutes. Une idée par étape, consigne de 12 mots au plus.
- Montrer, puis guider, puis laisser faire : démonstration animée, puis geste guidé (« pose au point vert »), puis
  exercice seul. Au plus une étape sans geste par leçon.
- L'image explique, le texte appuie. Concret d'abord (la pierre posée), puis le nom de la forme, puis la règle.
- Chaque mot du go est expliqué à sa première apparition (entre parenthèses ou par une définition courte) et a sa
  fiche dans le glossaire (`src/content/aide.ts`).
- Chaque erreur courante reçoit sa réfutation (`refus`), rejouée par les tests.
- Français dans `content/lessons.fr.js` (positions et réponses font foi), anglais dans `content/lessons.en.js`
  (textes seulement, même nombre d'étapes).

## Vérification

- Captures : lecteur exact (`src/go/lecteurs-lot-n.ts`), sans ko. Les réponses acceptées sont exactement les coups
  qui prennent dans le nombre de coups annoncé.
- Vie et mort : preuve exhaustive en zone fermée (`src/go/preuve-vie-mort.ts`, zone contrôlée par `defautsDeZone`).
  Un ko n'est jamais compté comme une preuve.
- Comptage : `score()` de `src/go/score.ts` (règle japonaise, komi 6,5).
- Démonstrations : chaque temps est un coup légal (`src/content/demo.ts`), et chaque test vérifie que l'image finale
  montre ce que dit le texte.
- Tests : `src/go/lessons.test.ts` (forme), `src/go/demos.test.ts` (12 mots, légalité), `src/go/lecons-16.test.ts`
  (l9 à l12), `src/go/lecons-13-16.test.ts`, `src/go/lecons-17-20.test.ts`, `src/content/lessons.en.test.ts`.
- KataGo : les positions de leçon sont des formes locales prouvées exactement par le moteur ; KataGo sert aux
  positions d'ouverture et de fin de partie quand une preuve exacte n'est pas possible (lot X, 13 × 13).

## Chargement

Le contenu des leçons n'est plus dans le JS initial : l'accueil lit l'index généré `src/content/leconsIndex.gen.ts`
(titre et nombre d'étapes). Après l'ajout ou la modification d'une leçon : `npm run index-lecons`
(détail : `docs/architecture/chargement-initial.md`).

## Ce qui existe (20 leçons)

| Chapitre | Leçon | Titre | Niveau visé |
| --- | --- | --- | --- |
| 1. Les bases | l1 à l7 | Libertés, atari, techniques de capture, ko, deux yeux, territoire, compter | 30 → 25 kyu |
| 2. Ouverture sur 9 × 9 | l8 | Les premiers coups | 25 → 20 kyu |
| 3. Capturer et sauver | l9 à l11 | Filet, prise en retour, course aux libertés | 20 → 17 kyu |
| 4. Vie et mort | l12, l13, l14 | Faux œil, point vital, seki | 18 → 15 kyu |
| | **l17** | **Les formes d'yeux** : le T, le carré de quatre, la grappe de cinq | 15 → 12 kyu |
| 5. Fin de partie et comptage | l15, l16 | Finir la partie, compter une partie | 15 kyu |
| 6. Formes et tesuji | **l18** | **Les bonnes formes** : point de coupe, bouche du tigre, bambou | 14 → 12 kyu |
| | **l19** | **Les pierres qui coupent** : prendre la pierre qui sépare, le diamant (ponnuki) | 13 → 11 kyu |
| | **l20** | **Relier et mourir** (oiotoshi) : quand relier ne sauve rien | 12 → 10 kyu |

Les identifiants restent stables (la progression des joueurs y est attachée) ; l'ordre du chemin est celui des
chapitres, et `content/lessons.fr.js` suit cet ordre (l17 est rangée après l14).

## La suite prévue (vers 5 kyu, puis le premier dan)

Lot suivant, dans cet ordre (chaque leçon avec ses tests de preuve et sa série de pratique) :

| Leçon prévue | Chapitre | Contenu | Vérification |
| --- | --- | --- | --- |
| Le jeté | Formes et tesuji | Sacrifier une pierre dans la forme adverse : faux œil, manque de libertés | Preuve de vie et mort, lecteur de capture |
| Le manque de libertés | Formes et tesuji | Blanc ne peut pas relier sans se mettre en atari | Lecteur de capture |
| Sente et gote | Fin de partie et comptage | Le coup qui oblige à répondre ; jouer d'abord les coups sente | Minimax sur les points de frontière, `score()` |
| Le hane au premier rang | Fin de partie et comptage | Hane et connexion, valeur en points | `score()` sur les deux suites |
| Agrandir ou réduire l'espace | Vie et mort | Vivre en s'étendant, tuer en réduisant de l'extérieur | Preuve de vie et mort |
| Les groupes du coin | Vie et mort | Formes classiques du coin (L, J, six en rangée), ko compris | Preuve de vie et mort ; ko signalé, jamais compté comme vie |
| Ouverture sur 13 × 13 | Ouverture | Coins, extensions, approche | KataGo (comme le lot X) |
| Joseki simples | Ouverture | 3-3 sous le 4-4, approche et extension | KataGo, suites jouées jusqu'au bout |
| Attaquer et défendre | Stratégie | Groupes faibles, épaisseur, ne pas jouer près de l'épaisseur | KataGo |
| Lire une course avec œil | Capturer et sauver | Œil contre pas d'œil, libertés partagées | Lecteur de capture |

Palier de l'issue #16 : 20 leçons publiées (atteint avec ce lot) ; 100 problèmes vérifiés. Prochain palier : 30 leçons.
