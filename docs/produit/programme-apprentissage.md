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
  `src/go/lecons-27-30.test.ts`, `src/content/lessons.en.test.ts`. Les tests qui comptent les leçons n'ont plus de nombre figé.
- KataGo : les positions de leçon sont des formes locales prouvées exactement par le moteur ; KataGo sert aux
  positions d'ouverture et de fin de partie quand une preuve exacte n'est pas possible (lot X, 13 × 13), et aux
  jugements de stratégie (l27). Pour une leçon : réseau g170 b6c96, komi 6,5, règle japonaise, huit graines (les huit
  symétries du plateau ; la recherche est déterministe), 800 visites ou plus à la racine, chaque coup candidat joué puis
  évalué (400 visites, 1 600 pour les coups serrés). Une réponse acceptée est le premier choix dans les huit graines, ou à
  moins d'un point du meilleur coup dans les huit ; un coup refusé avec une explication perd au moins 3 points dans
  chaque graine, et la réponse adverse qu'annonce l'explication est le premier choix dans chaque graine. Les résultats
  sont figés (`src/go/attaque-defense.fixture.ts`) et rejoués par les tests sans le modèle ; `KATAGO_L27=1` relance le
  réseau.

## Chargement

Le contenu des leçons n'est plus dans le JS initial : l'accueil lit l'index généré `src/content/leconsIndex.gen.ts`
(titre et nombre d'étapes). Après l'ajout ou la modification d'une leçon : `npm run index-lecons`
(détail : `docs/architecture/chargement-initial.md`).

## Ce qui existe (27 leçons)

| Chapitre | Leçon | Titre | Niveau visé |
| --- | --- | --- | --- |
| 1. Les bases | l1 à l7 | Libertés, atari, techniques de capture, ko, deux yeux, territoire, compter | 30 → 25 kyu |
| 2. Ouverture sur 9 × 9 | l8 | Les premiers coups | 25 → 20 kyu |
| | **l27** | **Attaquer et défendre** : fermer le centre à une pierre faible ; sortir la sienne vers le centre | 12 → 10 kyu |
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
chapitres, et `content/lessons.fr.js` suit cet ordre (l27 est rangée après l8, l26 après l11, l24 et l25 après l17, l22 et l23 après
l16).

Preuves du palier 21-30 (`src/go/lecons-21-30.test.ts`) :

| Leçon | Méthode de preuve |
| --- | --- |
| l21 Le manque de libertés | Lecteur exact sans ko : E1 est le seul coup qui prend en trois coups (et aucun en deux) ; après E1, chaque connexion laisse une liberté |
| l22 Sente et gote | Minimax exact (règles japonaise et par surfaces) : E2 seul meilleur coup ; F1 seule réponse (tout autre coup perd au moins 3 points) ; E9 d'abord coûte 2 points |
| l23 Le hane au premier rang | Minimax exact par surfaces (hane seul meilleur coup des deux côtés, suites de la leçon optimales), lecteur avec ko pour « relie », score() japonais : 2 points d'écart, 1 point pour le blocage |
| l24 Agrandir ou réduire | Preuve de vie et mort en zone fermée : un seul coup vit, le même seul coup tue ; chaque placement intérieur échoue |
| l25 Les groupes du coin | Preuve de vie et mort : A2 seul coup qui vit ; si Blanc le prend, personne ne gagne sans ko, et le ko est rejoué (prise, reprise interdite, faux œil) |
| l27 Attaquer et défendre | KataGo figé (`src/go/lecons-27-30.test.ts`) : F4 premier choix dans les huit graines (attaque, côté) ; Blanc au trait, F4 meilleur coup évalué dans les huit graines (premier choix dans sept, la recherche ne départage pas la huitième) ; défense : F4 et D4 exactement ; refus (G5, E3, F2) à au moins 3 points |
| l26 La course avec un œil | Lecteur exact sans ko : seuls les coups du dehors gagnent ; liberté commune et œil mettent Noir en atari ; Blanc au trait gagne |

## La suite prévue (vers 5 kyu, puis le premier dan)

Écartées de ce palier, faute de preuve honnête ou de position lisible :

| Leçon prévue | Pourquoi elle attend | Ce qu'il faut pour la livrer |
| --- | --- | --- |
| Le jeté | Deuxième recherche (07/10), plus large, sans résultat lisible. Jeté strict : une pierre seule, sans voisine noire, une liberté, que Blanc prend sans ko ; seul coup gagnant avec et sans ko ; pas de prise en retour. Course aux libertés sur le gabarit de la leçon 11 (énumération complète, 59 049 positions) : 25 trouvées, toutes où le jeté met aussi une autre pierre en atari, avec des pierres blanches éparses ; sans le critère strict, les 43 trouvées dépendaient d'un ko interdit. Course dans le coin (19 683 positions) et course tirée au hasard sur 3 × 8 (vingt minutes de tirages) : aucune. Jeté au bord menant à l'oiotoshi (3 × 7, tirages au hasard, une heure de calcul) : 3, dont une prise en retour et deux de 26 pierres, illisibles. Jeté puis échelle ou filet au centre (trois pierres en ligne, deux pierres, bouche du tigre ; plus d'un million de tirages) : aucune | Une forme choisie à la main dans un recueil (nid de grue sur un plus grand plateau), prouvée par le lecteur ; ou un lecteur de leçon 13 × 13 |
| Ouverture sur 13 × 13 | Le lecteur de leçon est en 9 × 9 (`src/app/Lecon.tsx`, `src/content/demo.ts`) | Lecteur à taille variable (autre périmètre), puis preuve KataGo comme le lot X |
| Joseki simples | Un joseki se joue sur un grand plateau ; le lecteur de leçon est en 9 × 9 | Lecteur 13 × 13 ou 19 × 19, puis suites vérifiées par KataGo jusqu'au bout |

KataGo (`npm run fetch-model`) tourne en local dans ce conteneur : 0,5 s par visite en 9 × 9 sur le processeur seul,
22 ms avec TensorFlow natif (`@tensorflow/tfjs-node`, installé hors du dépôt pour la leçon 27). Il reste disponible pour
ces leçons quand le lecteur saura afficher un plus grand plateau.

Palier de l'issue #16 : 27 leçons publiées ; 100 problèmes vérifiés. Prochain palier : 30 leçons (les trois ci-dessus).
