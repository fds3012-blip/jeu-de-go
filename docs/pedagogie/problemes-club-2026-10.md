# Problèmes du joueur de club : provenance et preuves (chantier C4, octobre 2026)

Chantier C4 de `docs/produit/constat-2026-10-22.md` : « Problèmes : 300 de plus, prouvés, pour le joueur qui progresse ».
Ce document dit d'où vient chaque problème ajouté, comment il est prouvé et ce que la preuve ne dit pas. Il grandit avec
chaque lot : un lot, une issue, une pull request.

Règle de Florian : aucun conseil de go faux. Un problème n'entre dans la banque que si sa réponse est démontrée avec les
règles de `src/go` (et, quand le sujet s'y prête, contrôlée par KataGo), si chaque mauvais coup est réfuté, et si son texte
existe en français et en anglais.

## Provenance

Tous les problèmes de ces lots sont **construits pour l'exercice** : aucune position n'est copiée d'un recueil, d'un
livre, d'un site ou d'une partie publiée. Aucune licence n'est donc en jeu. Chaque position a été produite par un
programme (énumération de gabarits), puis filtrée par les outils de preuve du projet ; les positions retenues sont celles
qui passent **tous** les filtres, relues ensuite une par une. Les tests de chaque lot interdisent un doublon de position
(rotations, miroirs et échange des couleurs compris) avec la banque et avec les exercices des leçons.

## Les outils de preuve

| Outil | Ce qu'il établit |
|---|---|
| `src/go/refutation-fin.ts` | Minimax exact en règle japonaise (territoire et prisonniers, pierres mortes retirées) sur les points de la frontière : la valeur de chaque coup légal, dans trois modèles de ko (Noir maître, Blanc maître, ko simple). |
| `src/go/preuve-vie-mort.ts` | Recherche complète en zone fermée : une pierre jetée dans un territoire est prise, quoi que joue le propriétaire. |
| `src/go/score.ts` | Le compte des textes (territoire, prisonniers, komi 6,5). |
| `outils/preuvesKataGoProblemes.ts` | Contrôle KataGo (réseau g170 b6c96 du dépôt) : politique brute et recherche dans les 8 symétries du plateau, propriété par point. Figé dans `src/go/preuves-katago-problemes.json`, rejoué sans le réseau par la CI. |

Aucun test ne calcule plus de 30 secondes d'un seul bloc (`outils/boucleLibre.setup.ts`) ; le contrôle KataGo, lui, est calculé
hors ligne : `npm run preuves-katago-problemes -- --lot ac`.

## Lot AC (#733) : Compter, 5 problèmes, de 850 à 1050

Le thème « Compter » n'avait que w07, w08 et w09 (débutants). Le lot AC ajoute cinq fins de partie à compter au demi-point
près, pour le palier Joueur de club. Fichier `src/content/lots/ac-compter.ts`, migration
`supabase/migrations/20261025140000_lot_ac.sql`, preuve `src/go/lot-ac.test.ts`.

Dans chaque position, Noir est devant d'un demi-point (komi 6,5), et un seul coup l'empêche de perdre ce demi-point : le
point de la frontière que Blanc prendrait. Le point voisin devient alors une dame (point neutre) au lieu de devenir du
territoire blanc. Les autres points ouverts sont des dames : les remplir ne change aucun compte.

| Id | Difficulté | Réponse | Ce qu'il apprend à compter | Compte final (Noir contre Blanc, komi compris) |
|---|---|---|---|---|
| ac01 | 850 | E8 | Territoire contre territoire + komi, un demi-point d'avance à défendre | 21 contre 14 + 6,5 = 20,5 |
| ac02 | 900 | E1 | Une pierre blanche morte dans son territoire : un prisonnier pour Noir | 23 + 1 = 24 contre 17 + 6,5 = 23,5 |
| ac03 | 950 | F5 | Une pierre noire morte dans le territoire de Blanc : un prisonnier pour Blanc ; deux dames à ne pas confondre avec le bon point | 23 contre 15 + 1 + 6,5 = 22,5 |
| ac04 | 1000 | E1 | Quatre points ouverts, trois sans valeur : distinguer le point qui compte des dames | 24 contre 17 + 6,5 = 23,5 |
| ac05 | 1050 | F5 | Une pierre morte de chaque couleur, deux dames | 21 + 1 = 22 contre 14 + 1 + 6,5 = 21,5 |

### Ce que `src/go/lot-ac.test.ts` démontre, pour chaque problème

1. **Position légale** : aucun ko, aucune chaîne en atari (sauf les pierres mortes marquées), une seule chaîne vivante par
   couleur, pierres marquées = pierres mortes de l'énoncé, chacune prouvée morte quel que soit le camp au trait.
2. **Fin de partie sûre** : chaque point vide hors de la frontière appartient à un seul camp ; chaque « salle » de territoire
   (de 1 à 12 points) est prouvée sûre par recherche complète : une pierre jetée dedans par l'adversaire est prise, quoi
   qu'il arrive ; chaque camp a au moins deux salles, donc son groupe vit.
3. **Compte net** : toutes les lignes optimales après la réponse mènent au même compte (`score()`), sans prise ni atari ;
   aucun ko dans tout l'arbre de la fin. Les chiffres des textes en viennent.
4. **Solution unique** : la réponse vaut 7 (Noir − Blanc, sans komi) contre un komi de 6,5 ; tout autre coup légal et la passe
   valent 6 au plus, dans les trois modèles de ko.
5. **Erreurs réfutées** : après chaque coup légal autre que la réponse, Blanc joue la réponse et gagne, quoi que Noir joue
   ensuite, même maître du ko ; le point voisin finit chez Blanc (la phrase du texte est vraie pour chaque erreur).
6. **Sélection cohérente** : ces cinq problèmes sont plus durs que w07 à w09, donc la série de la leçon 16 ne change pas ;
   la série du thème Compter les propose ensuite, du plus facile au plus difficile ; « à ta mesure » peut les proposer ; ils
   ne sont pas au Go du jour (voir ci-dessous).

Le fichier `src/go/refutation-fin.test.ts` (liste des 21 problèmes de fin de partie et de comptage) et
`src/go/refutations-locales.gen.ts` (réplique prouvée à chaque coup faux, pour « Comprendre son erreur ») couvrent aussi ces
cinq problèmes.

### Le Go du jour ne grandit pas

Le Go du jour léger de l'accueil (`src/content/goDuJour.gen.ts` : identifiant, titre, position) est dans le **JS initial**, dont
le budget est de 150 Ko gzip (149,9 Ko avant ce lot). Chaque problème de plus y coûte environ 0,04 Ko : cinq problèmes
suffisaient à dépasser le budget (150,1 Ko), et trois cents de plus l'auraient fait exploser. Le calendrier du Go du jour est
donc **figé au lot AB** (291 problèmes, `DERNIER_LOT_DU_JOUR` dans `src/content/puzzles.ts`) : les jours déjà publiés ne
changent pas, et les lots du chantier C4 restent des problèmes à la demande (série par thème, « à ta mesure », « Tous les
problèmes », révisions), chargés avec l'écran des problèmes. L'écran des problèmes et l'accueil lisent la même liste du
jour (`estGoDuJour`), sans quoi les deux n'auraient plus le même problème à partir du jour 292.

### Contrôle KataGo

Réseau g170 b6c96 du dépôt, komi 6,5, règle japonaise, 8 symétries du plateau (rotations et miroirs), 64 visites par symétrie
(`npm run preuves-katago-problemes -- --lot ac`, figé dans `src/go/preuves-katago-problemes.json`, rejoué sans le réseau par
`src/go/preuves-katago-problemes.test.ts`). KataGo est un second avis, indépendant du moteur de règles :

| Id | Réponse | Politique brute du réseau (moyenne des 8 symétries) | Recherche : symétries où la réponse est le premier choix |
|---|---|---|---|
| ac01 | E8 | E8 0,83 ; passe 0,04 ; F8 0,02 | 8 sur 8 |
| ac02 | E1 | E1 0,93 ; passe 0,06 | 8 sur 8 |
| ac03 | F5 | F5 0,66 ; C4 0,12 ; D5 0,09 | 7 sur 8 (une symétrie préfère C4, une dame : 64 visites ne distinguent pas toujours un point neutre du bon point) |
| ac04 | E1 | E1 0,81 ; F6 0,07 ; E4 0,07 | 8 sur 8 |
| ac05 | F5 | F5 0,82 ; F8 0,11 ; G6 0,03 | 8 sur 8 |

Dans les cinq problèmes, la réponse est le premier choix de la politique, et les dames que les textes citent (C4, D5, E4, F6,
F8, G6) viennent juste derrière : le réseau les voit comme des coups plausibles mais sans valeur, ce que le compte confirme.
La propriété par point estimée par le réseau coïncide, point par point, avec le partage du territoire du projet : chaque salle
est à Noir ou à Blanc comme dans le compte, pierres mortes comprises (testé pour les cinq problèmes).

### Limites, dites clairement

- Les positions sont **construites** : ce sont des fins de partie sans combat, utiles pour compter. Elles ne prétendent pas
  représenter une partie réelle.
- Règle japonaise seulement (c'est celle des leçons de comptage). Le même compte en règle chinoise ne donne pas le même
  vainqueur, et l'application le dit ailleurs (leçon 41).
- L'« avance » en points que renvoie KataGo n'est pas utilisée : sur ces positions, elle s'écarte du compte japonais de moins
  d'un point à plus de quatre points (le réseau mêle les règles et compte en pratique les pierres), alors que l'enjeu ici est d'un demi-point. Seuls la
  politique, la recherche et la propriété par point servent de contrôle.
- Le contrôle KataGo ne remplace pas la preuve : un coup que le réseau préfère n'est retenu que si le moteur de règles le
  démontre, et un désaccord du réseau sur un coup démontré serait signalé au lieu d'être ignoré.
