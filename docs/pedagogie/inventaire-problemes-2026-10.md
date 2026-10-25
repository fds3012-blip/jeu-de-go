# Inventaire des problèmes (#548 et #557, 14 et 16 octobre 2026)

État de la banque de problèmes de Mochi Go sur `main` avant #548, les trous qu'elle laisse, ce que le lot AA y
ajoute, puis ce que le lot AB (#557) y ajoute pour le joueur de club. Chiffres comptés par script sur `ALL_PUZZLES` (`src/content/puzzles.ts` : les 6 problèmes de base, les 12 de
#16 et tous les lots de `src/content/lots`), thème de `src/content/themes.ts`.

Difficulté = cote Elo du problème. Les paliers de l'écran des problèmes (`src/app/paliers.ts`) la traduisent en grades :
moins de 450, Débutant (30 à 25 kyu) ; 450 à 649, Novice (24 à 20 kyu) ; 650 à 849, Apprenti (19 à 15 kyu) ; 850 à
1049, Joueur de club (14 à 10 kyu) ; 1050 et plus, Confirmé (9 kyu et plus). Le lot Z place ses problèmes de 1200 à
1600 « vers 5 kyu ». « Entre 15 et 5 kyu » correspond donc à peu près à la plage 850 à 1450.

## Avant #548 : 250 problèmes

| Thème | < 450 | 450-649 | 650-849 | 850-1049 | 1050-1249 | 1250-1449 | 1450-1649 | Total |
|---|---|---|---|---|---|---|---|---|
| capture | 14 | 3 | 0 | 0 | 0 | 0 | 0 | 17 |
| atari | 6 | 14 | 4 | 0 | 0 | 0 | 0 | 24 |
| double-atari | 0 | 7 | 3 | 1 | 0 | 0 | 0 | 11 |
| bord | 1 | 11 | 6 | 1 | 1 | 0 | 0 | 20 |
| echelle | 0 | 2 | 4 | 5 | 1 | 0 | 0 | 12 |
| filet | 0 | 1 | 5 | 5 | 1 | 1 | 0 | 13 |
| relier-couper | 0 | 4 | 19 | 7 | 2 | 0 | 0 | 32 |
| vie-mort | 0 | 5 | 13 | 10 | 17 | 15 | 4 | 64 |
| semeai | 0 | 0 | 5 | 8 | 3 | 5 | 3 | 24 |
| prise-en-retour | 0 | 0 | 7 | 1 | 1 | 0 | 0 | 9 |
| seki | 0 | 2 | 1 | 0 | 0 | 0 | 0 | 3 |
| fin-de-partie | 0 | 2 | 5 | 0 | 0 | 2 | 1 | 10 |
| comptage | 1 | 0 | 2 | 0 | 0 | 0 | 0 | 3 |
| ko | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 3 |
| ouverture | 2 | 3 | 0 | 0 | 0 | 0 | 0 | 5 |
| **Total** | **25** | **56** | **74** | **38** | **26** | **23** | **8** | **250** |

Taille du plateau : 245 problèmes en 9 × 9, 5 en 13 × 13 (les ouvertures du lot X), aucun en 19 × 19. Difficulté de 300
à 1600. Chaque problème a un thème, et un seul.

## Les trous

1. **Le milieu de l'échelle est mince.** 155 problèmes sous 850, 95 au-dessus. Entre 850 et 1449 (de 14 à 5 kyu
   environ), il y en a 87, dont 42 de vie et mort et 16 de course aux libertés : les autres thèmes n'y ont presque rien.
2. **Ko : 3 problèmes, tous sous 650.** Le ko n'existe que comme règle (le prendre, ne pas le reprendre). Aucun problème
   ne montre un ko comme issue d'une lecture (vivre ou tuer par un ko), ni le ko de la fin de partie.
3. **Seki : 3 problèmes, tous sous 850.** Ce sont des seki d'un coup (relier, sauver une pierre). Rien sur le seki
   qu'on obtient en lisant, au bord ou contre des pierres blanches à l'intérieur.
4. **Prise en retour : 9 problèmes, dont 2 au-dessus de 850.** Le thème des leçons 10 et 36 n'a presque pas de suite au
   niveau club.
5. **Fin de partie : 10 problèmes, aucun entre 850 et 1249.** La série saute de 800 (lot Y) à 1250 (lot Z).
6. **Vie et mort en plusieurs coups.** Les 28 problèmes de vie et mort entre 450 et 1049 se lisent surtout en un coup :
   le point vital, le faux œil, l'œil à prendre (lecture des explications). Peu montrent la suite, c'est-à-dire la
   réponse à chaque défense (les points miai) ou le coup qui agrandit l'espace avant de faire les yeux.
7. **Tesuji.** Ce n'est pas un thème de `themes.ts` : les problèmes du lot S (« tesuji ») sont rangés sous le bord, le
   filet, l'échelle ou relier et couper. La prise en retour et le manque de libertés en tiennent lieu.
8. **Filet et échelle.** 25 problèmes, dont 13 entre 850 et 1449 : correct, mais rien au-dessus de 1450.
9. **Comptage (3) et ouverture (5).** Petits thèmes, tous sous 850. Le comptage se prouve mal en problème à un coup ;
   l'ouverture demande KataGo (lot X). Hors du champ de ce lot.
10. **Grands plateaux.** Rien en 19 × 19, et seulement l'ouverture en 13 × 13.

## Le lot AA (#548) : 20 problèmes, de 850 à 1250

`src/content/lots/aa-entre-deux.ts`, prouvé par `src/go/lot-aa.test.ts`, migration
`supabase/migrations/20261014160000_lot_aa.sql`. Priorité aux trous 2 à 6, au niveau club (lecture de 3 à 5 coups).

| Id | Thème | Difficulté | Idée |
|---|---|---|---|
| aa01 | ko | 850 | Fermer le ko avant de jouer la dame : sinon Blanc prend, relie, et tu perds 1 point. |
| aa02 | prise-en-retour | 900 | Se mettre en atari exprès en C1 : si Blanc prend, tu reprends six pierres. |
| aa03 | fin-de-partie | 900 | Le hane au premier rang vaut un point de plus que bloquer ; les dames ne valent rien. |
| aa04 | seki | 950 | Dans le coin, le coup qui laisse deux libertés partagées : seki. |
| aa05 | vie-mort | 950 | Agrandir l'espace au premier rang pour faire le deuxième œil. |
| aa06 | vie-mort | 950 | Le point clé d'un espace de sept points, puis deux points miai. |
| aa07 | prise-en-retour | 1000 | Se jeter entre les pierres blanches (H3) : si Blanc prend en J3, la reprise prend cinq pierres. |
| aa08 | vie-mort | 1000 | Mettre en atari la pierre blanche du milieu pour en faire un œil. |
| aa09 | seki | 1050 | Menacer d'abord, pour que Blanc doive répondre ; puis seki au bord. |
| aa10 | vie-mort | 1050 | Tuer par le point vital au milieu du bord, puis les réponses miai. |
| aa11 | vie-mort | 1100 | Après le hane blanc, le point vital de l'espace, puis les réponses miai. |
| aa12 | ko | 1100 | Vivre sans ko est impossible : l'atari qui donne au moins un ko. |
| aa13 | vie-mort | 1100 | Le point vital du coin, qui touche trois points de l'espace. |
| aa14 | seki | 1150 | Contre un carré blanc, prendre la liberté du dehors : toutes les libertés sont partagées. |
| aa15 | vie-mort | 1150 | Enfermer la pierre blanche jouée dans ton espace avant qu'elle s'agrandisse. |
| aa16 | vie-mort | 1200 | Un coup qui crée deux paires de points miai. |
| aa17 | ko | 1200 | Tuer sans ko est impossible : le coup qui force au moins un ko. |
| aa18 | vie-mort | 1200 | Cinq pierres sur la deuxième ligne : soutenir la pierre déjà entrée, puis miai. |
| aa19 | vie-mort | 1250 | Le point vital sous un groupe au bord, puis miai. |
| aa20 | ko | 1250 | Le placement au milieu de l'espace du coin donne un ko. |

Comment chaque problème est prouvé :

- vie et mort : recherche complète de `src/go/preuve-vie-mort.ts` en zone fermée ; chaque erreur est prouvée par
  `src/go/preuve-ko.ts` (nouveau) : l'erreur échoue même si l'adversaire gagne tous les ko ;
- ko : le camp qui gagne tous les ko obtient ce qu'il veut, et la recherche sans ko ne tranche pas ; après une erreur,
  Noir échoue même s'il gagne tous les ko ;
- seki : le groupe ne peut plus être pris, même si Blanc gagne tous les ko, et ne fait pas deux yeux, même si Noir les
  gagne tous ; les libertés partagées sont vérifiées ;
- prise en retour : lecteur exact du lot N, avec et sans ko ;
- fin de partie : minimax exact (surfaces), chiffres des textes recomptés en règle japonaise.

## Après #548 : 270 problèmes

| Thème | < 450 | 450-649 | 650-849 | 850-1049 | 1050-1249 | 1250-1449 | 1450-1649 | Total |
|---|---|---|---|---|---|---|---|---|
| capture | 14 | 3 | 0 | 0 | 0 | 0 | 0 | 17 |
| atari | 6 | 14 | 4 | 0 | 0 | 0 | 0 | 24 |
| double-atari | 0 | 7 | 3 | 1 | 0 | 0 | 0 | 11 |
| bord | 1 | 11 | 6 | 1 | 1 | 0 | 0 | 20 |
| echelle | 0 | 2 | 4 | 5 | 1 | 0 | 0 | 12 |
| filet | 0 | 1 | 5 | 5 | 1 | 1 | 0 | 13 |
| relier-couper | 0 | 4 | 19 | 7 | 2 | 0 | 0 | 32 |
| vie-mort | 0 | 5 | 13 | 13 | 23 | 16 | 4 | 74 |
| semeai | 0 | 0 | 5 | 8 | 3 | 5 | 3 | 24 |
| prise-en-retour | 0 | 0 | 7 | 3 | 1 | 0 | 0 | 11 |
| seki | 0 | 2 | 1 | 1 | 2 | 0 | 0 | 6 |
| fin-de-partie | 0 | 2 | 5 | 1 | 0 | 2 | 1 | 11 |
| comptage | 1 | 0 | 2 | 0 | 0 | 0 | 0 | 3 |
| ko | 1 | 2 | 0 | 1 | 2 | 1 | 0 | 7 |
| ouverture | 2 | 3 | 0 | 0 | 0 | 0 | 0 | 5 |
| **Total** | **25** | **56** | **74** | **46** | **36** | **25** | **8** | **270** |

Taille du plateau : 265 en 9 × 9, 5 en 13 × 13.

## Le lot AB (#557) : 21 problèmes, de 1250 à 1700

`src/content/lots/ab-club.ts`, prouvé par `src/go/lot-ab.test.ts`, migration
`supabase/migrations/20261016090000_lot_ab.sql`. Joueurs de club, de 5 kyu vers le dan, lecture de 5 à 8 coups : tesuji
(jeté, relier et mourir, coupe par en dessous), vie et mort qui demande une lecture complète (placement après réduction,
point vital entre plusieurs parties de l'espace), ko et seki décisifs, prise en retour, fin de partie. Tout en 9 × 9 : le
dépôt n'a pas de problèmes cadrés sur un coin de 13 × 13 ou 19 × 19 (le lot X, ouverture, est en 13 × 13 entier, vérifié par
KataGo ; le plateau cadré du `Board`, #454, n'est pas branché sur les problèmes).

| Id | Thème | Difficulté | Taille | Idée |
|---|---|---|---|---|
| ab01 | fin-de-partie | 1250 | 9 × 9 | Bloquer la glissade au premier rang au contact (C1), pas un pas plus loin ; le hane du haut vaut moins. |
| ab02 | vie-mort | 1250 | 9 × 9 | Espace de sept points en L : faire l'œil du coin d'abord, puis deux points miai. |
| ab03 | vie-mort | 1300 | 9 × 9 | Placement au premier rang (B1) qui touche les trois points d'yeux de Blanc. |
| ab04 | prise-en-retour | 1300 | 9 × 9 | Deux jetés possibles dans un anneau blanc : la prise en retour prend 9 pierres. |
| ab05 | fin-de-partie | 1300 | 9 × 9 | L'atari qui bloque le hane au premier rang (D2) ; bloquer plus loin rapporte moins. |
| ab06 | vie-mort | 1350 | 9 × 9 | Le point vital du bord (A2) contre des pierres qui ont de la place des deux côtés. |
| ab07 | seki | 1350 | 9 × 9 | Enfermer deux pierres blanches sans les prendre : seki. |
| ab08 | ko | 1400 | 9 × 9 | Vivre sans ko est impossible avec deux pierres blanches dedans : le coup qui force le ko. |
| ab09 | capture | 1400 | 9 × 9 | Relier et mourir : le jeté du bon côté (E3) laisse une liberté à la pierre et une seule à l'anneau. |
| ab10 | vie-mort | 1400 | 9 × 9 | Six points coupés par ta pierre : un œil de chaque côté, puis miai. |
| ab11 | vie-mort | 1450 | 9 × 9 | Le point du coin (A1) qui casse deux yeux à la fois. |
| ab12 | vie-mort | 1450 | 9 × 9 | Élargir au premier rang (D1) : un œil fait, l'autre en miai. |
| ab13 | seki | 1500 | 9 × 9 | Trois pierres blanches dedans : la liberté à prendre sans se mettre en atari. |
| ab14 | ko | 1500 | 9 × 9 | Tuer sans ko est impossible : prolonger la pierre déjà dedans pour forcer le ko. |
| ab15 | relier-couper | 1500 | 9 × 9 | Couper par en dessous (E1) : la liberté dont Blanc aurait besoin pour relier, enlevée d'avance ; prise en trois coups. |
| ab16 | vie-mort | 1550 | 9 × 9 | Se glisser sous deux pierres (C1) : un espace partagé entre gauche et droite ne donne plus deux yeux. |
| ab17 | vie-mort | 1600 | 9 × 9 | Un coup qui fait un vrai œil et garde le deuxième en miai, dans un espace en deux parties. |
| ab18 | ko | 1600 | 9 × 9 | Séparer deux pierres blanches dedans : le seul coup qui force le ko pour vivre. |
| ab19 | vie-mort | 1650 | 9 × 9 | Le point entre deux parties de l'espace (E1). |
| ab20 | vie-mort | 1650 | 9 × 9 | Le point du milieu (D1) qui reliait trois parties de l'espace. |
| ab21 | vie-mort | 1700 | 9 × 9 | Neuf points sur deux rangs avec une pierre blanche dedans : un seul coup tue. |

Comment chaque problème est prouvé (mêmes outils que le lot AA) :

- vie et mort : recherche complète de `src/go/preuve-vie-mort.ts` en zone fermée ; chaque erreur est prouvée par
  `src/go/preuve-ko.ts` : l'erreur échoue même si l'adversaire gagne tous les ko, et la réplique citée le confirme ;
- ko : le camp qui gagne tous les ko obtient ce qu'il veut, la recherche sans ko ne tranche pas, et aucun coup ne
  tranchait sans ko ; après une erreur, Noir échoue même s'il gagne tous les ko ;
- seki : le groupe ne peut plus être pris, même si Blanc gagne tous les ko, et ne fait pas deux yeux, même si Noir les
  gagne tous ; sans la réponse, Blanc tue ;
- capture en deux ou trois coups : lecteur exact du lot N, avec et sans ko ; aucune prise plus rapide ;
- fin de partie : minimax exact (surfaces), toute erreur perd au moins 2 points et la réplique citée le confirme ;
- chaque suite citée par une explication (« si Blanc joue X, tu réponds Y ») est rejouée.

Les positions ont été cherchées par énumération de gabarits (mur noir ou blanc, cases variables), puis filtrées par ces
mêmes outils : un seul coup gagnant, position légale, zone fermée, chaque erreur prouvée. Les candidats de course aux
libertés trouvés ainsi n'étaient que des variantes du lot Z (z13, le bon côté) : aucun n'a été retenu. Deux seki et un
ko dont une erreur n'était pas réfutable (elle menait elle-même à un ko) ont été jetés.

## Après #557 : 291 problèmes

| Thème | < 450 | 450-649 | 650-849 | 850-1049 | 1050-1249 | 1250-1449 | 1450-1649 | 1650-1849 | Total |
|---|---|---|---|---|---|---|---|---|---|
| capture | 14 | 3 | 0 | 0 | 0 | 1 | 0 | 0 | 18 |
| atari | 6 | 14 | 4 | 0 | 0 | 0 | 0 | 0 | 24 |
| double-atari | 0 | 7 | 3 | 1 | 0 | 0 | 0 | 0 | 11 |
| bord | 1 | 11 | 6 | 1 | 1 | 0 | 0 | 0 | 20 |
| echelle | 0 | 2 | 4 | 5 | 1 | 0 | 0 | 0 | 12 |
| filet | 0 | 1 | 5 | 5 | 1 | 1 | 0 | 0 | 13 |
| relier-couper | 0 | 4 | 19 | 7 | 2 | 0 | 1 | 0 | 33 |
| vie-mort | 0 | 5 | 13 | 13 | 23 | 20 | 8 | 3 | 85 |
| semeai | 0 | 0 | 5 | 8 | 3 | 5 | 3 | 0 | 24 |
| prise-en-retour | 0 | 0 | 7 | 3 | 1 | 1 | 0 | 0 | 12 |
| seki | 0 | 2 | 1 | 1 | 2 | 1 | 1 | 0 | 8 |
| fin-de-partie | 0 | 2 | 5 | 1 | 0 | 4 | 1 | 0 | 13 |
| comptage | 1 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 3 |
| ko | 1 | 2 | 0 | 1 | 2 | 2 | 2 | 0 | 10 |
| ouverture | 2 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 5 |
| **Total** | **25** | **56** | **74** | **46** | **36** | **35** | **16** | **3** | **291** |

Taille du plateau : 286 en 9 × 9, 5 en 13 × 13. Difficulté de 300 à 1700.

## Ce qui reste à faire

- **Fin de partie entre 850 et 1249** : toujours un seul problème (aa03), plus le ko de fin de partie (aa01). Le lot AB
  en ajoute deux à 1250 et 1300 (bloquer la glissade, l'atari qui bloque) ; le contre-sente et la valeur des coups
  demandent plusieurs endroits ouverts, et le minimax exact reste lent au-delà de huit points.
- **Course aux libertés avec coup d'approche** : les gabarits essayés ne donnent que des variantes du lot Z. Il faudrait
  des positions dessinées à la main, avec une chaîne extérieure que la pierre de remplissage doit d'abord approcher.
- **Prise en retour au-dessus de 1300** et **manque de libertés** (relier et mourir) : un seul problème chacun (ab04,
  ab09) ; le gabarit des anneaux en donnerait d'autres.
- **Filet et échelle au-dessus de 1450**, **comptage**, **13 × 13 et 19 × 19 cadrés** : hors de ces lots. Les problèmes
  cadrés sur un coin demanderaient de brancher le plateau cadré (#454) sur l'écran des problèmes.
- **Thème « tesuji »** : à créer dans `themes.ts` seulement avec l'écran des problèmes, qui affiche les thèmes ; en
  attendant, ab09 est rangé sous « capture » (relier et mourir, leçons 20 et 21) et ab15 sous « relier et couper ».

## Après #733 (lot AC, chantier C4) : 296 problèmes

Le thème « Compter » passe de 3 à 8 problèmes : le lot AC (`src/content/lots/ac-compter.ts`, ac01 à ac05, de 850 à 1050)
ajoute quatre problèmes au palier 850-1049 et un au palier 1050-1249. Provenance, preuves et limites :
`docs/pedagogie/problemes-club-2026-10.md`.

| Thème | < 450 | 450-649 | 650-849 | 850-1049 | 1050-1249 | 1250-1449 | 1450-1649 | 1650-1849 | Total |
|---|---|---|---|---|---|---|---|---|---|
| comptage | 1 | 0 | 2 | 4 | 1 | 0 | 0 | 0 | 8 |
