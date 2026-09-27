# Glossaire du go : français et anglais

Issue #167. Terme retenu dans chaque langue pour l'interface, les leçons et les problèmes.
Sources d'usage : Sensei's Library (senseis.xmp.net), règles et publications de l'AGA (American Go Association),
de la BGA (British Go Association) et de l'EGF (European Go Federation), Fédération française de go (FFG).

Principes :
- On garde le mot japonais quand c'est l'usage établi en anglais comme en français (atari, ko, komi, seki, tesuji, joseki…).
  Première apparition : une explication courte (CLAUDE.md, règle 5).
- Termes anglais en minuscules dans une phrase (« atari », « ko »), sans italique dans l'interface.
- Le tutoiement français devient un « you » simple et chaleureux.

## Matériel et bases

| Français | Anglais retenu | Remarques |
|---|---|---|
| go (le jeu de go) | Go | Majuscule en anglais pour éviter la confusion avec le verbe « go ». |
| goban, plateau | board | « goban » compris des joueurs ; l'interface anglaise dit *board* (réglage : *Board*). |
| pierre | stone | |
| Noir, Blanc (joueurs) | Black, White | Majuscule quand ils désignent le joueur. |
| intersection, point | point | Jamais *square* ni *case*. |
| hoshi (point étoile) | star point | *hoshi* accepté entre joueurs. |
| coup | move | « jouer un coup » : *play a move*. |
| poser une pierre | place a stone / play | |
| trait (« Noir au trait ») | to play (« Black to play ») | Formule standard des problèmes. |
| passer | pass | « Noir passe » : *Black passes*. |
| abandonner | resign | |
| handicap | handicap | Pierres de handicap : *handicap stones*. |
| komi | komi | Points donnés à Blanc qui joue en second (6,5 en japonais, 7,5 en chinois). Décimale : virgule en français, point en anglais (6.5). |
| nigiri | nigiri | Tirage au sort de la couleur. |
| pendule, byo-yomi | clock, byo-yomi | *Canadian overtime*, *Fischer* : termes anglais conservés. |

## Règles

| Français | Anglais retenu | Remarques |
|---|---|---|
| liberté | liberty | Pluriel : *liberties*. |
| chaîne, groupe | chain (règles), group (jeu) | *string* existe aussi ; on préfère *group* dans l'interface. |
| atari | atari | « Mettre en atari » : *put in atari*, *atari!*. Une chaîne à une seule liberté. |
| capturer, prendre | capture | |
| prisonniers | prisoners (captures) | *captures* dans les compteurs d'écran, *prisoners* dans les règles. |
| suicide | suicide | « Coup suicide interdit » : *suicide is not allowed*. |
| ko | ko | Reprise immédiate interdite. « Menace de ko » : *ko threat*. |
| superko | superko | Règles chinoises et AGA. |
| seki | seki | Vie mutuelle : aucun des deux ne peut attaquer. |
| territoire | territory | |
| zone (comptage chinois) | area | *Area scoring* (chinois) / *territory scoring* (japonais). |
| comptage | scoring, counting | *Score* pour le résultat. |
| pierres mortes | dead stones | « Marquer les pierres mortes » : *mark dead stones*. |
| dame, point neutre | dame, neutral point | |
| fin de partie (deux passes) | end of the game (two passes) | |
| règles japonaises, chinoises | Japanese rules, Chinese rules | |
| « Noir gagne de 3,5 points » | « Black wins by 3.5 points » ; notation B+3.5 | Par abandon : B+R. |

## Vie et mort

| Français | Anglais retenu | Remarques |
|---|---|---|
| vie et mort | life and death | *tsumego* pour les problèmes. |
| vivant, mort | alive, dead | |
| œil | eye | « Deux yeux » : *two eyes*. |
| faux œil | false eye | |
| œil véritable | real eye | |
| forme d'œil | eye shape | |
| espace vital | eye space | |
| semeai, course aux libertés | semeai, capturing race | *capturing race* dans l'interface, *semeai* entre joueurs. |
| seki | seki | Voir Règles. |
| problème (de go) | problem, puzzle | Interface : *Puzzles* (onglet). Leçons : *problem*. |
| problème de vie et de mort | tsumego, life-and-death problem | |

## Techniques

| Français | Anglais retenu | Remarques |
|---|---|---|
| échelle | ladder | « Casse-échelle » : *ladder breaker*. |
| filet | net | *geta* accepté. |
| snapback (prise en retour) | snapback | |
| shicho | ladder | Ne pas afficher « shicho » à un débutant. |
| double atari | double atari | |
| connecter, relier | connect | |
| couper, coupe | cut | |
| tesuji | tesuji | Coup habile, technique locale. |
| joseki | joseki | Séquence de coin équilibrée. |
| fuseki | fuseki, opening | *opening* pour un débutant. |
| sente, gote | sente, gote | Garder l'initiative / la perdre. |
| moyo, influence | moyo, framework, influence | |
| invasion | invasion | |
| réduction | reduction | |
| yose | endgame (yose) | *endgame* dans l'interface. |
| mauvaise forme, bonne forme | bad shape, good shape | |
| triangle vide | empty triangle | |
| hane | hane | |
| tobi (saut d'une case) | one-space jump | |
| keima (saut du cavalier) | knight's move | |

## Niveaux et classement

| Français | Anglais retenu | Remarques |
|---|---|---|
| kyu | kyu | 30 kyu (débutant) → 1 kyu. Abréviation : 15k. |
| dan | dan | 1 dan → 9 dan amateur (1d). Pro : 1p → 9p. |
| cote (Elo) | rating | « Cote 1500 » : *Rating 1500*. |
| niveau (progression XP de l'app) | level (Lv.) | Ne pas confondre avec *rank* (kyu/dan). |
| rang | rank | Réservé au kyu/dan. |
| partie classée, amicale | ranked game, unranked (casual) game | |
| série (jours consécutifs) | streak | « Série de 3 jours » : *3-day streak* ; libellé : *Streak: 3 days*. |
| gel (protège la série) | freeze | « Tu gagnes un gel » : *You earned a freeze* (usage des apps grand public). |
| palier (des problèmes) | tier | Débutant, Novice, Apprenti, Joueur de club, Confirmé : *Beginner, Novice, Apprentice, Club player, Advanced*. Pas *level* (réservé à l'XP). |
| cote problèmes | puzzle rating | |
| Go du jour n° 12 | Daily Go #12 | Défi commun du jour. |

## Analyse et IA

| Français | Anglais retenu | Remarques |
|---|---|---|
| analyse | review, analysis | *Game review* pour l'écran, *analysis* pour l'IA. |
| meilleur coup | best move | |
| erreur, grosse erreur | mistake, blunder | |
| taux de victoire | win rate | |
| avance au score | score lead | « Qui mène » : *Who's ahead*. |
| variante | variation | |

## À signaler (textes français ambigus)

- « Confirmer au doigt » (Profil) : traduit par *Confirm moves* ; le sens est « une deuxième touche pose la pierre ». Le libellé français pourrait gagner en clarté.
- « Problèmes » (onglet) : traduit par *Puzzles*, usage des apps grand public (chess.com, OGS). Dans les leçons, *problem* reste possible.
- Noms des adversaires (Pomme, Caillou, Bambou, Renard, Rivière, Tigre, Montagne, Dragon, Sensei) : gardés en français pour l'instant, comme des prénoms. À trancher (Apple, Pebble… ?) avec l'agent design, car les portraits et sceaux les portent.
- « Voir la suite » (Problèmes) : traduit par *Show the answer* ; la « suite » est la séquence de coups qui résout le problème.
- « Plateau 9 × 9, tu as Noir » : *9 × 9 board, you’re Black*.
