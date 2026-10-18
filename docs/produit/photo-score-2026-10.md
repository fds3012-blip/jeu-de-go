# Compter une photo (#655), octobre 2026

Demande de Florian : « prendre une photo du plateau dans la vie réelle et calculer le score selon les critères choisis
(japonais ou chinois) ». Entrée provisoire dans le Profil (« Compter une photo »), à raccorder au sommaire « Plus » (#654).

## Parcours

Une étape à la fois, une action principale chacune :

1. **Photo** : « Prendre une photo » (`capture="environment"`) ou « Choisir dans la galerie ». La phrase sur
   l'appareil photo est dite avant le bouton qui le demande.
2. **Coins** : la grille verte projetée sur la photo, 4 coins de 44 px à déplacer au doigt (le coin suit le glissement,
   il ne se cache pas sous le doigt), à la souris ou au clavier (flèches, Maj × 10), avec une loupe. Taille 9, 13 ou
   19 (19 par défaut). Les coins sont **proposés** d'emblée (voir plus bas) ; le joueur les ajuste.
3. **Pierres** : le plateau lu, sur le goban de l'app. Un toucher fait vide → noire → blanche → vide. Les points
   incertains sont marqués en rouge (cercle pointillé sur une pierre, point sur un vide) et comptés.
4. **Pierres mortes** : la proposition du comptage de fin de partie (`proposeComptage`, src/engine), présentée comme à
   vérifier (« il peut se tromper ») ; un toucher retire ou rend un groupe. Jamais plus de 8 s d'attente.
5. **Règle** : japonaise (territoire + prisonniers saisis + pierres mortes) ou chinoise (territoire + pierres), komi
   6,5 ou 7,5 par défaut (pas de 0,5), prisonniers saisis en japonais seulement.
6. **Score** : « Blanc gagne de 14,5 points », puis un tableau terme par terme (territoire, prisonniers ou pierres,
   komi, total) et, s'il y a lieu, les pierres mortes comptées, le seki et les points neutres (dame), expliqués.

« ‹ » (et le retour du système) remonte d'une étape ; depuis la première, retour au Profil.

## Méthode

Tout se fait sur l'appareil, sans bibliothèque (ni OpenCV.js) : canvas et maths, dans un Web Worker.

- **Image** : décodée par le navigateur (`createImageBitmap`, orientation de l'appareil), réduite à 1 600 px de côté.
- **Perspective** : homographie des 4 coins de la grille (`src/go/photo/homographie.ts`, système 8 × 8 résolu par Gauss).
  On ne redresse pas toute l'image : on projette seulement les points à lire.
- **Bois de référence** : au centre de chaque case, là où une pierre ne va jamais. Pour chaque intersection, la médiane
  des cases voisines (4 × 4, plus si besoin), en écartant les cases pâles (pierre qui déborde, reflet). Le seuil suit
  donc l'éclairage local.
- **Lecture** : 12 points sur les diagonales autour de chaque intersection (les lignes de la grille sont évitées),
  comparés au bois voisin. Noire : luminance sous 0,55 fois celle du bois. Blanche : rapport bleu / rouge au-dessus de
  1,3 fois celui du bois, ou saturation sous 0,45 fois (le bois est jaune, la pierre blanche prend la couleur de la
  lumière : comparer au bois annule la teinte d'une lampe). Chaque point vote ; la confiance est l'avance du gagnant.
- **Affinage** : chaque coin bouge d'au plus 0,3 case si la lecture devient plus nette (les pierres comptent plus que
  le bois, pour ne jamais glisser d'une demi-case), puis un petit décalage global compense le débord des pierres vues
  de biais.
- **Reflet** : une case pâle et plus claire que le bois rend « incertaine » toute lecture blanche ou vide autour d'elle.
- **Coins proposés** (`src/go/photo/coins.ts`) : la zone de bois qui contient le centre de la photo (même teinte que le
  centre, pas plus sombre : la tranche et la table sont écartées), ses 4 points extrêmes en diagonale, puis la marge
  usuelle bois → première ligne (0,62 case). Sinon, un rectangle à 12 % des bords.
- **Comptage** : `src/go/comptagePhoto.ts`, qui ne fait qu'appeler `score` (src/go/score.ts), celui de la fin de partie :
  seki (en japonais, ni les yeux ni les libertés partagées ne comptent), dame, pierres mortes.

## Précision mesurée

Sur des photos synthétiques (`src/go/photo/synthese.ts`) : bois veiné, grille et hoshi, pierres en relief (reflet,
ombre portée, débord vers l'objectif jusqu'à 0,25 case), perspective, éclairage inégal (jusqu'à un côté deux fois plus
sombre), lumière orangée ou bleutée, flou, bruit. Coins posés « au doigt » : décalés au hasard de la vraie grille.
`npx vite-node outils/photosSynthetiques.ts mesure`, 60 images par lot (20 par taille), 12 220 intersections :

| Lot | Précision par intersection | Fautes | dont non signalées | Points incertains |
|---|---|---|---|---|
| Coins à ±0,15 case (cas courant) | **100,00 %** | 0 | 0 | 0 |
| Coins à ±0,3 case (posés sans soin) | **99,99 %** | 1 | 1 | 8 |
| Reflet de lampe sur le bois | **98,58 %** | 174 | 18 | 872 |

Photos de test figées (`src/go/__fixtures__/photos/`, 6 images, vérité dans `verite.json`) : 100 % sur les 5 images
courantes, avec coins exacts et coins à ±0,15 case ; sur l'image avec reflet, 98,8 % (coins exacts) et 97,5 %
(coins au doigt), chaque faute étant signalée parmi 14 points incertains. Le test Vitest
exige 99 % au moins sur l'ensemble et aucune faute non signalée sur un lot varié de 9 images.

Coins proposés : à 0,39 case de la grille en médiane (30 photos synthétiques) ; après l'affinage, 29 photos sur 30
sont lues à 100 %. Le test exige « à moins d'une case » pour 4 photos sur 5.

Temps : 150 à 230 ms par photo dans Node sur la machine des agents ; compter 3 à 5 fois plus sur un téléphone d'entrée de
gamme, d'où le worker (l'écran reste fluide, `Reflexion` tourne).

**Pas de vraie photo** dans le lot : Wikimedia Commons et les banques d'images ne sont pas joignables depuis la machine
des agents. Le test lit toute image ajoutée au dossier avec sa ligne dans `verite.json` (coins, plateau, source,
licence) : quelques photos de Florian, prises sur un vrai goban, donneraient le premier chiffre réel.

## Limites

- **Reflets** : un goban verni sous une lampe donne des taches pâles prises pour des pierres blanches. Elles sont
  signalées (98,6 % justes, 0,15 % de fautes non signalées), pas corrigées.
- **Pierres qui débordent** : vue très de biais (au-delà de 0,25 case de débord), les pierres d'une ligne recouvrent
  la suivante ; le décalage global ne suffit plus. Conseil à l'écran : photo « d'assez haut ».
- **Plateaux non standard** : la marge bois → grille est supposée de 0,62 case pour proposer les coins ; un plateau
  pliant, en tissu, en papier ou en vinyle (sans bois jaune) n'a pas de coins proposés, et un plateau très pâle
  rapproche le bois du blanc des pierres. Les pierres en verre ou en plastique très brillant n'ont pas été mesurées.
- **Photo partielle** : le plateau doit être entier sur la photo ; pas de lecture d'un coin seul.
- **Prisonniers et handicap** : la photo ne voit pas les couvercles ; le joueur les saisit. Le handicap n'est pas
  demandé (en chinois, Blanc reçoit d'ordinaire 1 point par pierre de handicap : à ajouter au komi).
- **Pierres mortes** : la proposition vient du comptage de fin de partie (simulations, KataGo s'il est déjà chargé) ;
  sur une position photographiée, sans historique, elle peut se tromper dans les semeai et les seki. Elle est toujours
  à vérifier.

## Pistes

- Quelques vraies photos annotées (Florian, club) dans `src/go/__fixtures__/photos/`, pour un chiffre réel.
- Détecter la grille elle-même (lignes sombres) pour affiner les coins au-delà de 0,3 case et proposer des coins sur un
  plateau sans bois.
- Repérer les reflets à la prise de vue (« Penche un peu le téléphone ») plutôt qu'à la lecture.
- Reprendre la position lue dans « Étudier une position » ou l'analyse KataGo, et la garder dans « Mes parties » si le
  joueur le demande (aujourd'hui, rien n'est gardé, par choix : RGPD et mineurs).
- Mesure d'usage anonyme (une ligne `photo_compte` : taille, règle, nombre de corrections), à ajouter à la politique.
