# Programme d'apprentissage : audit d'octobre 2026 (#547)

Demande de Florian : approfondir l'apprentissage. Règle absolue : aucun conseil de go faux. Chaque affirmation d'une
leçon est prouvée par le moteur du dépôt (`src/go`) ou par des positions KataGo figées. Ce document classe les leçons
existantes par étape, liste les trous, et dit ce que l'issue ajoute, dans l'ordre de priorité.

Repères de niveau : ceux des paliers de l'appli (`src/app/paliers.ts`) et des leçons
(`docs/produit/programme-apprentissage.md`). Comparaison avec les cursus de référence : les manuels pour débutants
(la suite « Learn to Play Go », « Graded Go Problems for Beginners », les fiches de la FFG) et le parcours de BadukPop
couvrent, avant 15 kyu, les mêmes blocs : règles et captures, ko, deux yeux, comptage, échelle et filet, formes de
connexion, courses aux libertés, formes d'yeux, fin de partie de base. Rien n'en est copié : seules les notions
servent de liste de contrôle.

## 1. Les leçons au début de l'audit (39 leçons)

Le brief parle de 40 leçons : il y en a 39. L'identifiant `l28` n'a jamais été publié ; il reste réservé au jeté
(voir « La suite prévue » dans `docs/produit/programme-apprentissage.md`).

### Découverte (premiers pas, 30 → 25 kyu)

| Leçon | Notion |
| --- | --- |
| l1 Libertés et capture | libertés, capture, groupe |
| l2 Atari | mettre en atari, se sauver, prendre pour sauver |
| l3 Techniques de capture | double atari, bord, échelle |
| l4 Le ko | la reprise immédiate interdite |
| l5 Vivre et mourir | les deux yeux |
| l6 Territoire et ouverture | territoire, komi, premier coup |
| l7 Compter les points | fermer, passer, compter (japonais) |

### Débutant (jusqu'à environ 20 kyu)

| Leçon | Notion |
| --- | --- |
| l8 Les premiers coups | coins, bords, centre ; 3-3 et 3-4 |
| l9 Le filet | geta |
| l10 La prise en retour | snapback |
| l11 La course aux libertés | semeai sans œil |
| l12 Le faux œil | |
| l13 Le point vital | trois en ligne, quatre, deux |
| l14 Le seki | |
| l15 Finir la partie | dame, frontières, pierres mortes |
| l16 Compter une partie | mortes, prisonniers, komi |
| l29 L'ouverture en 13 × 13 | coins, bords, grand point |

### Vers 15 kyu

| Leçon | Notion |
| --- | --- |
| l17 Les formes d'yeux | T, carré, grappe de cinq |
| l18 Les bonnes formes | point de coupe, bouche du tigre, bambou |
| l19 Les pierres qui coupent | ponnuki |
| l20 Relier et mourir | oiotoshi |
| l21 Le manque de libertés | |
| l22 Sente et gote | |
| l23 Le hane au premier rang | |
| l24 Agrandir ou réduire | le point au bord de l'espace |
| l26 La course avec un œil | |
| l30 Le san-san | (19 × 19) |
| l31 Le 3-4 et l'approche | (19 × 19) |

### Joueur de club (12 kyu et au-delà)

| Leçon | Notion |
| --- | --- |
| l25 Les groupes du coin | le point du coin, le ko |
| l27 Attaquer et défendre | la route du centre (KataGo) |
| l32 La valeur d'un coup | compter les deux suites |
| l33 Le sente avant le gote | |
| l34 Relier par en dessous | watari |
| l35 Couper par en dessous | |
| l36 Couper, puis reprendre | |
| l37 Les points miai | |
| l38 Jouer ailleurs | tenuki |
| l39 Les libertés communes | |
| l40 Les yeux dans la course | |

## 2. Les trous

Classés du plus utile au moins utile pour un débutant qui progresse. « Prouvable » dit si une preuve exacte existe avec
les outils du dépôt.

| Trou | Pourquoi il compte | Prouvable ? |
| --- | --- | --- |
| Les menaces de ko | l4 enseigne la règle, l25 dit qu'un ko n'est pas une vie, mais rien n'apprend à **gagner** un ko. Tous les cursus l'abordent avant 15 kyu. | Oui : minimax exact de fin de partie (ko simple du moteur) sur une partie presque finie, deux comptes. |
| Lire l'échelle avant de courir | l3 montre l'échelle, l9 une échelle cassée ; rien ne dit « ne cours pas dans une échelle qui marche », l'erreur la plus coûteuse des débutants. | Oui : lecteur d'échelle de `src/go/tactics.ts`. |
| Compter en règle chinoise | L'appli propose la règle chinoise (parties à deux, en ligne, contre l'ordi) ; aucune leçon ne dit que les pierres comptent, ni qu'il faut remplir les dames. | Oui : `score()` (les deux règles). |
| Le triangle vide (formes faibles) | l18 enseigne les formes solides ; la forme faible la plus courante manque. | Oui, pour ce qui se compte : les libertés. |
| Le deuxième rang (« six meurent, huit vivent ») | Vie et mort sur le bord, notion classique vers 15 kyu ; le chapitre « Vie et mort » n'a que des formes de coin et d'yeux. | Oui : preuve de vie et mort en zone fermée, sur 13 × 13. |
| Le handicap | L'appli propose 2 à 9 pierres ; aucune leçon ne dit où elles vont, qui commence, quel komi. | Oui : `handicapPoints`, `newPosition`, réglages de l'appli. |
| L'extension depuis une pierre ou un mur | Notion d'ouverture centrale (deux pierres : saut de trois ; mur : ne pas s'étendre trop près). | Le mur : oui, par positions KataGo figées (#553, l47, voir 5). Depuis une pierre seule : aucune position nette trouvée (voir 4). |
| L'invasion et la réduction simples | Notion de milieu de partie. | Oui, par positions KataGo figées (#553, l49). |
| Couper et relier dans l'ouverture | Quand couper vaut la peine dépend de toute la position. | Oui, par positions KataGo figées (#553, l48). |
| Le jeté (`l28`) | | Recherches de #16 sans forme lisible ; toujours en attente. |
| Le double sente, le sente inverse | Fin de partie de club. | Recherches de #16 et #539 sans écart net. |

## 3. Ce que l'issue ajoute (six leçons, par ordre de priorité)

Chaque leçon suit le format des leçons existantes : 4 ou 5 étapes, une idée par étape (cognitive-load), consigne de
12 mots au plus, montrer puis guider puis laisser faire (worked example fading), concret d'abord (la pierre posée, les
libertés qui s'allument), puis le nom, puis la règle (CPA). Chaque mot du go est expliqué à sa première apparition.
Textes en français et en anglais. Preuves : `src/go/lecons-41-plus.test.ts`.

| Priorité | Leçon | Place | Niveau | Idée | Preuve |
| --- | --- | --- | --- | --- | --- |
| 1 | **l45 Les menaces de ko** | fin de « Fin de partie », après l38 | 12 → 10 kyu | Blanc prend le ko : on ne reprend pas tout de suite ; on joue d'abord une menace (un atari sur quatre pierres) qui oblige Blanc à répondre, puis on reprend ; quand Blanc n'a plus de menace, on ferme le ko. | Minimax exact (`preuve-fin-de-partie.ts`, ko simple, bornes égales), comptage par surfaces et japonais ; la position est rejouée depuis la prise (interdit du ko compris). La menace, la réponse, la reprise et la connexion sont chacune le seul meilleur coup ; fermer le ko au lieu de répondre coûte plus à Blanc dans les deux comptes. Zone : tous les points vides sauf les yeux d'un point (vérifié). |
| 2 | **l42 Lire l'échelle** | « Capturer et sauver », après le filet | 22 → 18 kyu | Courir dans une échelle qui marche perd huit pierres ; une pierre amie sur le chemin la casse ; sans casseur, on laisse la pierre ; trouver la pierre qui casse son échelle. | `ladderWorks` et `canEscape` (`src/go/tactics.ts`) : la pierre en atari ne sort pas, l'échelle blanche marche après la fuite ; avec F2 elle sort ; seule G2 casse l'échelle de l'exercice (J3, à côté, non). |
| 3 | **l41 Compter en règle chinoise** | « Fin de partie », après l16 | 18 → 15 kyu | Territoire plus pierres (45 contre 43,5, komi 7,5) ; les prisonniers ne comptent pas ; remplir une dame rapporte un point en chinois, rien en japonais. | `score()` règles chinoise et japonaise ; minimax exact : la dame seul meilleur coup en chinois, à égalité avec la passe en japonais. |
| 4 | **l43 Le triangle vide** | « Formes et tesuji », après l18 | 20 → 16 kyu | Trois pierres en coin, le coin vide : sept libertés au lieu de huit en ligne ; le coin vide était déjà une liberté. Exercices : garder le plus de libertés. | Libertés comptées par le moteur pour chaque prolongement ; réponses = le maximum, refus = chaque triangle vide, une liberté de moins. |
| 5 | **l44 Le deuxième rang** | « Vie et mort », après l24 (13 × 13 cadré) | 15 → 12 kyu | Bouts fermés : six meurent, sept vivent si l'on joue d'abord, huit vivent ; tuer sept pierres par le bout. | Preuve exhaustive de vie et mort en zone fermée (`preuve-vie-mort.ts`, `defautsDeZone`) ; coups qui vivent et coups qui tuent exactement listés ; un ko n'est jamais une preuve. |
| 6 | **l46 Le handicap** | « L'ouverture », après l8 | 25 → 20 kyu | Les pierres d'avance vont sur les hoshi (G7, C3, puis les autres coins, puis le centre) ; Blanc joue ensuite ; komi 0,5. | `handicapPoints` et `newPosition` (`src/go/rules.ts`), `KOMI_HANDICAP` et `komiDeLaPartie` (`src/app/reglagesPartie.ts`). |

Chaque leçon a sa série de pratique (thèmes existants : `ko`, `echelle`, `comptage`, `relier-couper`, `vie-mort`,
`ouverture`), sa phrase de fin, sa vignette et son sceau. Aucun problème n'est ajouté ici : le lot AA (#548) est
écrit en parallèle.

Pratique de rappel : la série de fin de leçon reprend chaque thème avec des problèmes différents des exercices de la
leçon (`serieDeLecon`, `redites.ts`). La révision espacée (`src/app/revisionEspacee.ts`, J+1 à J+30) porte sur les
erreurs de partie et les problèmes ratés ; cette issue n'y change rien. Piste suivante : faire revenir les exercices
d'une leçon ratés à J+1, J+3, J+7 (retrieval practice + spaced practice), sans nouveau texte de go à prouver.

## 4. Ce qui reste, et ce qu'il faut pour le faire

| Leçon | Ce qui manque |
| --- | --- |
| L'extension depuis une pierre seule | Faite en #553 pour le mur (l47). Depuis une pierre seule, en 13 × 13, KataGo ne départage pas net les distances d'extension (écarts de moins d'un point, ou coups de coin préférés) : pas de leçon tant qu'aucune position ne donne MARGE. |
| Une fausse menace de ko (menace trop petite) | Recherche menée pour l45 : aucune forme trouvée dans le temps imparti où un petit atari est ignoré dans les deux comptes, sans créer un second ko. |
| Le triangle vide dans une course | Recherche aléatoire de courses où seul le prolongement droit gagne : trop lente dans le temps imparti ; la leçon s'en tient aux libertés, qui se comptent exactement. |
| Le jeté, le double sente, le sente inverse | Voir `docs/produit/programme-apprentissage.md`. |

## 5. Leçons 47 à 49 : l'ouverture prouvée par KataGo (#553)

Ces notions ne se prouvent pas par une lecture exacte. La preuve passe par des positions KataGo figées, avec la méthode
et l'outil des leçons 29 à 31 (#16) :

- commande : `npm run fetch-model`, puis `TFJS_NODE_DIR=<dossier de @tensorflow/tfjs-node> npm run preuves-katago -- l47 l48 l49`
  (`outils/preuvesKataGo.ts`, un seul processus, TensorFlow natif sur CPU, 40 minutes) ;
- réseau : g170-b6c96-s175395328-d26788732, celui de l'appli (`public/reseaux/`) ; komi 6,5, règle japonaise ;
  800 visites à la racine, 400 après chaque coup jugé ; quatre symétries du plateau analysées chacune à part ;
- fixture : `src/go/preuves-katago.json` (10 positions ajoutées, les 18 anciennes inchangées) ;
- seuils (`src/go/preuvesKataGo.ts`) : une réponse acceptée est à 1 point au plus du meilleur coup ; un coup refusé perd
  au moins 2 points de plus que la moins bonne réponse (1 point dans chaque symétrie) ; une démonstration, 1,5 point ;
- tests : le jugement commun est rejoué par `src/go/lecons-ouverture.test.ts` ; chaque affirmation propre aux textes
  (« bien plus », « trop près », « sous le hoshi », « coupe », « séparées », « sur la 2e ligne ») par
  `src/go/lecons-47-plus.test.ts`. Parcours : `e2e/lecons-47-plus.spec.ts` (l48 jouée en entier).

Pendant la recherche (crible rapide : 2 symétries, 400 et 200 visites), plusieurs idées « évidentes » ont été
rejetées par KataGo et ne sont pas enseignées : relier
tout de suite après un regard sur une forme 3-4 (C1 : une autre réponse vaut 5 points de plus), couper un saut en
diagonale (C2 : perd 3 points), réduire au centre un camp aux coins fermés (les épaules et les contacts valent plus),
s'étendre de deux depuis une pierre seule sur le bord (les coups de coin valent 2 à 4 points de plus).

Écarts : moyenne des quatre symétries, en points, par rapport au meilleur coup du plateau entier.

| Leçon | Place | Idée | Preuve |
| --- | --- | --- | --- |
| **l47 Le mur** | « L'ouverture », après l31 | Avec un mur, on ne joue pas collé à lui : on joue loin, ici sous le hoshi blanc. | Démo K3 à 0,30 du meilleur (E11, hors du cadre). Question : K11 à 0,48, E11 (contre le mur) à 6,66, soit 6,2 de moins que K11 (au moins 5,7 dans chaque symétrie). Exercice en miroir : D3 (0,48) et C3 (0,42) acceptés ; refusés J3 −6,66, H3 −3,76, H4 −4,06, tous à deux pas du mur au plus. |
| **l48 Couper et relier** | après l47 | Blanc vise le dernier point de liaison d'un keima (C5) : le prendre avant lui ; à l'envers, couper. | Relier : C5 et L5 sont chacun le meilleur coup ; refusés K4 −16,88 et J6 −10,77, réplique L5 de KataGo dans les quatre symétries (« Blanc coupe en L5 »), après laquelle il ne reste aucun point de liaison. Couper : C5 et L5 meilleurs ; refusés K4 −12,21 et J6 −6,42, réplique L5 partout. |
| **l49 Envahir ou réduire** | après l48 | Un hoshi seul, coin vide : entrer dans le coin (san-san). Coins fermés : réduire par-dessus, pas dessous. | Invasion : C3 à 0,57 du meilleur (C4) ; exercice dans l'autre coin, L4 (0,03), L3 (0,62), K3 (0,64) acceptés, G2 (2e ligne, au milieu) −2,94, soit 2,3 de moins que K3. Réduction : G4 meilleur coup ; question en quart de tour, D7 meilleur, B8 (2e ligne) −4,45. |

Rappel et révision : chaque leçon a sa série de pratique (`ouverture` pour l47 et l49, `relier-couper` pour l48) ;
la révision espacée n'est pas changée. Le glossaire gagne quatre mots, reliés à leur leçon : mur, couper et relier,
invasion, réduction.
