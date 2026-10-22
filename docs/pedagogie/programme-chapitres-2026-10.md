# Chapitres 2 à 7 : complets ou pas ? (#686, chantier C12, étape 1)

Demande : chaque chapitre du chemin doit former un tout cohérent pour un débutant, puis passer à `complet: true` (fête
de fin de chapitre, phrase `fin`). Règle absolue : aucun conseil de go faux. N'écrire une leçon que si elle est
indispensable.

Question posée pour chaque chapitre : un joueur qui a fait toutes ses leçons a-t-il vu ce que le titre et l'intro
promettent, sans trou qui le mettrait en échec dans ses parties au niveau visé ? Un enrichissement utile n'est pas
un trou. Relecture faite en professeur 2 dan exigeant ; repères : `docs/pedagogie/programme-2026-10.md` (audit #547),
`docs/produit/programme-apprentissage.md` (#16), `docs/pedagogie/ouvertures-celebres-2026-10.md` (#672).

## Verdict : les six chapitres sont complets, aucune leçon n'est ajoutée

| Chapitre | Leçons | Ce qu'il couvre | Verdict | Phrase de fin (FR / EN) |
| --- | --- | --- | --- | --- |
| c2 L'ouverture | 9 | Coins, bords, centre (9 × 9, 13 × 13) ; handicap ; san-san ; 3-4 et approche ; mur ; couper et relier ; envahir ou réduire ; attaquer et défendre | Complet | Tu sais où jouer en début de partie. / You know where to play early in the game. |
| c3 Capturer et sauver | 7 | Filet ; lire l'échelle (courir ou laisser) ; prise en retour ; courses aux libertés (sans œil, avec un œil, libertés communes, yeux des deux côtés) | Complet | Tu connais les pièges de capture et les courses aux libertés. / You know capturing traps and capturing races. |
| c4 Vie et mort | 8 | Faux œil ; point vital ; seki ; formes d'yeux ; agrandir ou réduire ; deuxième rang ; groupes du coin et ko ; points miai | Complet | Tu sais quand un groupe vit, et quand il meurt. / You know when a group lives, and when it dies. |
| c5 Fin de partie et comptage | 9 | Finir la partie ; compter (japonais, chinois) ; sente et gote ; hane au premier rang ; valeur d'un coup ; le sente d'abord ; jouer ailleurs ; menaces de ko | Complet | Tu sais finir une partie, puis la compter juste. / You can finish a game, then count it right. |
| c6 Formes et tesuji | 8 | Bonnes formes ; triangle vide ; pierres qui coupent ; relier et mourir ; manque de libertés ; relier, couper et reprendre au premier rang | Complet | Tu reconnais les bonnes formes et les coups malins. / You know good shapes and clever moves. |
| c7 Les ouvertures célèbres | 7 | Nirensei, sanrensei, shin-fuseki, chinois, kosumi de Shusaku, approche du hoshi, san-san d'AlphaGo | Complet (premier lot) | Tu connais des ouvertures de grands joueurs. / You know openings played by great players. |

Pourquoi aucune leçon n'est indispensable :

- **c2** : les trois temps de l'ouverture (coins, bords, centre), les deux coins de base (hoshi envahi, 3-4 approché) et
  les trois décisions du début de milieu de partie (mur, coupe, invasion) sont là. Le seul trou connu, l'extension
  depuis une pierre seule, n'a pas de position où KataGo départage net (`programme-2026-10.md`, partie 4) : l'enseigner
  serait affirmer plus que la preuve.
- **c3** : l'intro promet des pièges pour prendre plus de pierres. Les quatre pièges du débutant y sont (double atari,
  bord et échelle sont au chapitre 1 ; filet, prise en retour ici), plus « sauver » : ne pas courir dans une échelle qui
  marche. Les courses vont jusqu'aux libertés communes et aux yeux.
- **c4** : deux yeux (c1), faux œil, point vital, formes d'yeux mortes et vivantes, seki, bord et coin, ko : tout ce
  qu'un 12 kyu doit lire. Le placement (oki) est la grappe de cinq ou le point vital de trois (recherche de #539) ; il
  reste en problème (z15).
- **c5** : finir, compter dans les deux règles de l'appli, puis l'ordre des coups (sente, valeur, tenuki) et le ko.
  Rien dans une partie de débutant ne reste sans réponse.
- **c6** : formes solides et faibles, coupes, tesuji de capture (oiotoshi, manque de libertés) et du premier rang.
- **c7** : un lot fermé de sept ouvertures, chacune complète en elle-même. Le lot 2 (Kobayashi, mini-chinois) ajoutera
  des leçons ; il ne comble pas un trou.

Phrases de fin : ajoutées après la phrase de la dernière leçon (`.fin-acquis`), elles disent ce que le chapitre
entier apporte, au tutoiement, sans redire « terminé » (le titre le dit). Aucune ne promet un niveau. c7 dit « des
ouvertures », pas « les » : le chapitre n'est pas un catalogue. Vérifié par `src/app/apprendre.test.ts` (FR et EN,
moins de 70 signes).

## Effets à connaître

- **Fêtes rétroactives** : un joueur qui avait déjà fini toutes les leçons d'un chapitre voit sa fête à sa prochaine
  visite d'Apprendre, une par visite (`chapitresAFeter` prend le premier chapitre non fêté), comme pour « Les bases ».
- **Fin de chapitre** : la dernière leçon de c2 à c7 affiche « Chapitre terminé », la phrase du chapitre et, en action
  principale, « Joue contre Pomme » (`App.tsx`, `OPPONENTS[0]`), comme à la fin des bases. Pomme (20 kyu) est un choix
  faible après « Formes et tesuji » ou les ouvertures en 19 × 19 : voir la liste ci-dessous (périmètre de l'écran,
  pas de cette PR).

## Pour une PR suivante

Par ordre d'utilité. « Preuve » dit ce qui manque pour écrire la leçon sans rien affirmer de faux.

| Sujet | Chapitre | Pourquoi | Preuve |
| --- | --- | --- | --- |
| Adversaire de fin de chapitre | tous (écran) | Proposer l'adversaire choisi du joueur (`adv` d'`App.tsx`, déjà calculé pour l'accueil) plutôt que toujours Pomme. | Aucune (pas de go). Agent écrans ; e2e de fin de chapitre à reprendre (`apprendre.spec.ts`, `lecon-pratique.spec.ts`, `lecons-41-plus.spec.ts`). |
| Ordre de c2 | c2 | l27 « Attaquer et défendre » (12 → 10 kyu) vient avant l29 (20 → 16 kyu). La placer après l49 suit la difficulté. | Aucune (ordre seulement ; les identifiants restent, la progression suit). Tests d'ordre : `apprendre.test.ts`, `lecons-21-30.test.ts`. |
| Le seki en règle chinoise | c5 (après l41) | l14 dit vrai (les libertés partagées ne comptent pour personne) ; mais en règle chinoise les pierres en seki comptent, et un œil en seki compte pour son propriétaire, pas en japonais. L'appli propose les deux règles. | `score()` dans les deux règles sur une position de seki avec un œil ; à vérifier d'abord sur le moteur (traitement des yeux en seki en japonais). |
| Le jeté (`l28`, horikomi) | c3 ou c6 | Le tesuji le plus courant qui manque ; mène au faux œil et à l'oiotoshi. | Recherches de #16 sans forme lisible où un seul coup gagne. Piste : lecteur exact de capture sur des formes de bord d'oiotoshi. |
| La coupe en croix | c6 | Forme de combat fréquente (« à la coupe en croix, prolonge »). | Le proverbe ne vaut pas partout : positions KataGo figées, seuils de #553 (MARGE 2 points). |
| Le hane en tête de deux pierres | c6 | Proverbe de forme classique. | KataGo figé (#553), 13 × 13. |
| Fausse menace de ko | c5 | La menace trop petite qu'on ignore. | Recherche de l45 sans forme dans les deux comptes sans second ko. |
| Extension depuis une pierre seule | c2 | Notion d'ouverture centrale. | KataGo ne départage pas net en 13 × 13 (écarts sous 1 point). |
| Kobayashi, mini-chinois | c7 | Lot 2 des ouvertures célèbres. | Coordonnées à vérifier sur un diagramme sourcé, puis KataGo (`preuves-katago -- ouvertures`). |
| Double sente, sente inverse | c5 | Fin de partie de club. | Recherches de #16 et #539 sans écart net entre les règles. |
| Un chapitre « Vers le dan » | nouveau (c8) | Les chapitres 2 à 6 mènent vers 6 kyu ; rien encore sur la direction du jeu, l'épaisseur, l'aji. | Jugements de stratégie : positions KataGo figées, comme l27 et l47 à l49. Décision de Florian : un chapitre de plus, ou des leçons dans c2. |

Un chapitre qui reçoit une leçon reste `complet: true` : la fête a eu lieu, la nouvelle leçon apparaît dans son thème
et sur le chemin. Si un chapitre entier devait être réécrit, repasser à `complet: false` le temps de l'écrire.
