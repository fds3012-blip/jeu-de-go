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
- Fin de partie (sente et gote, hane) : minimax exact de `src/go/preuve-fin-de-partie.ts` sur les endroits encore
  ouverts (régions vides qui touchent les deux couleurs). La recherche est bornée ; une ligne coupée vaut −∞ dans une
  passe, +∞ dans l'autre, et la valeur n'est prouvée que si les deux passes donnent le même nombre. Quand une pierre peut
  entrer chez l'adversaire, le meilleur coup est prouvé en comptage par surfaces (une pierre morte s'y prend sans perte,
  `score()` japonais ne retire pas les pierres mortes) ; les chiffres annoncés au joueur sont ensuite recomptés en règle
  japonaise sur la suite prouvée.
- Démonstrations : chaque temps est un coup légal (`src/content/demo.ts`), et chaque test vérifie que l'image finale
  montre ce que dit le texte.
- Tests : `src/go/lessons.test.ts` (forme), `src/go/demos.test.ts` (12 mots, légalité), `src/go/lecons-16.test.ts`
  (l9 à l12), `src/go/lecons-13-16.test.ts`, `src/go/lecons-17-20.test.ts`, `src/go/lecons-21-30.test.ts`,
  `src/content/lessons.en.test.ts`. Les tests qui comptent les leçons n'ont plus de nombre figé.
- KataGo : les positions de leçon sont des formes locales prouvées exactement par le moteur ; KataGo sert aux
  positions d'ouverture et de fin de partie quand une preuve exacte n'est pas possible (lot X, 13 × 13).

## Chargement

Le contenu des leçons n'est plus dans le JS initial : l'accueil lit l'index généré `src/content/leconsIndex.gen.ts`
(titre et nombre d'étapes). Après l'ajout ou la modification d'une leçon : `npm run index-lecons`
(détail : `docs/architecture/chargement-initial.md`).

## Ce qui existe (26 leçons)

| Chapitre | Leçon | Titre | Niveau visé |
| --- | --- | --- | --- |
| 1. Les bases | l1 à l7 | Libertés, atari, techniques de capture, ko, deux yeux, territoire, compter | 30 → 25 kyu |
| 2. Ouverture sur 9 × 9 | l8 | Les premiers coups | 25 → 20 kyu |
| 3. Capturer et sauver | l9 à l11 | Filet, prise en retour, course aux libertés | 20 → 17 kyu |
| | **l26** | **La course avec un œil** : l'œil se remplit en dernier, le dehors d'abord | 14 → 12 kyu |
| 4. Vie et mort | l12, l13, l14 | Faux œil, point vital, seki | 18 → 15 kyu |
| | l17 | Les formes d'yeux : le T, le carré de quatre, la grappe de cinq | 15 → 12 kyu |
| | **l24** | **Agrandir ou réduire** : le point au bord de l'espace (vivre, tuer de l'extérieur) | 13 → 11 kyu |
| | **l25** | **Les groupes du coin** : le point du coin, et le ko (jamais compté comme une vie) | 12 → 10 kyu |
| 5. Fin de partie et comptage | l15, l16 | Finir la partie, compter une partie | 15 kyu |
| | **l22** | **Sente et gote** : le coup qui oblige à répondre ; le sente d'abord | 13 → 11 kyu |
| | **l23** | **Le hane au premier rang** : contourner, relier ; deux points d'écart | 12 → 10 kyu |
| 6. Formes et tesuji | l18 | Les bonnes formes : point de coupe, bouche du tigre, bambou | 14 → 12 kyu |
| | l19 | Les pierres qui coupent : prendre la pierre qui sépare, le diamant (ponnuki) | 13 → 11 kyu |
| | l20 | Relier et mourir (oiotoshi) : quand relier ne sauve rien | 12 → 10 kyu |
| | **l21** | **Le manque de libertés** : boucher la liberté du dehors ; relier met en atari | 11 → 10 kyu |

Les identifiants restent stables (la progression des joueurs y est attachée) ; l'ordre du chemin est celui des
chapitres, et `content/lessons.fr.js` suit cet ordre (l26 est rangée après l11, l24 et l25 après l17, l22 et l23 après
l16).

Preuves du palier 21-30 (`src/go/lecons-21-30.test.ts`) :

| Leçon | Méthode de preuve |
| --- | --- |
| l21 Le manque de libertés | Lecteur exact sans ko : E1 est le seul coup qui prend en trois coups (et aucun en deux) ; après E1, chaque connexion laisse une liberté |
| l22 Sente et gote | Minimax exact (règles japonaise et par surfaces) : E2 seul meilleur coup ; F1 seule réponse (tout autre coup perd au moins 3 points) ; E9 d'abord coûte 2 points |
| l23 Le hane au premier rang | Minimax exact par surfaces (hane seul meilleur coup des deux côtés, suites de la leçon optimales), lecteur avec ko pour « relie », score() japonais : 2 points d'écart, 1 point pour le blocage |
| l24 Agrandir ou réduire | Preuve de vie et mort en zone fermée : un seul coup vit, le même seul coup tue ; chaque placement intérieur échoue |
| l25 Les groupes du coin | Preuve de vie et mort : A2 seul coup qui vit ; si Blanc le prend, personne ne gagne sans ko, et le ko est rejoué (prise, reprise interdite, faux œil) |
| l26 La course avec un œil | Lecteur exact sans ko : seuls les coups du dehors gagnent ; liberté commune et œil mettent Noir en atari ; Blanc au trait gagne |

## La suite prévue (vers 5 kyu, puis le premier dan)

Écartées de ce palier, faute de preuve honnête dans le lecteur actuel :

| Leçon prévue | Pourquoi elle attend | Ce qu'il faut pour la livrer |
| --- | --- | --- |
| Le jeté | La recherche exhaustive d'un jeté qui fait un faux œil (coin, 3 × 4 points) n'a rien trouvé ; les jetés trouvés sur le bord (2 × 6, 2 × 7) et examinés finissent en prise en retour, déjà la leçon 10 | Une forme plus grande (3 × 6) et une recherche plus longue, ou un jeté de course aux libertés prouvé par le lecteur |
| Ouverture sur 13 × 13 | Le lecteur de leçon est en 9 × 9 (`src/app/Lecon.tsx`, `src/content/demo.ts`) | Lecteur à taille variable (autre périmètre), puis preuve KataGo comme le lot X |
| Joseki simples | Un joseki se joue sur un grand plateau ; le lecteur de leçon est en 9 × 9 | Lecteur 13 × 13 ou 19 × 19, puis suites vérifiées par KataGo jusqu'au bout |
| Attaquer et défendre | Jugement de stratégie : seul KataGo peut le mesurer ; aucune position n'a encore été choisie et vérifiée avec assez de visites | Positions choisies avec KataGo à plusieurs centaines de visites, et des marges nettes entre la réponse et les erreurs |

KataGo (`npm run fetch-model`) tourne en local dans ce conteneur (0,3 s par position en 9 × 9 à 1 visite, sans
TensorFlow natif) : il reste disponible pour ces leçons quand le lecteur saura afficher un plus grand plateau.

Palier de l'issue #16 : 26 leçons publiées ; 100 problèmes vérifiés. Prochain palier : 30 leçons (les quatre ci-dessus).
