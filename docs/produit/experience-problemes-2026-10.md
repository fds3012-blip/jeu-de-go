# Problèmes : de la collection à l'entraînement — audit du 14 octobre 2026 (#549)

Auteur : agent game design. Build : branche `exp-problemes-549`, partie de `main` à `6eb0831`, `VITE_E2E=1 vite build`,
`vite preview` (port 4749), Chromium 390 × 844, clair et sombre. Lecture du code de `src/app/Puzzles.tsx` et de tout
ce qu'il ouvre ; mesures sur la banque complète (250 problèmes, `ALL_PUZZLES`) avec un test jetable.

## 1. Ce qui existe (et marche)

| Brique | Où | État |
|---|---|---|
| Go du jour commun, partageable, série, gels | `goDuJour.ts`, `defiAppareil.ts` | Solide. Une seule action en relief. |
| « Continuer » à ta mesure (cote invisible, 85 % de réussite visée) | `coteJoueur.ts`, `problemes.ts` | Solide. |
| Aide graduée : indice, « Voir pourquoi », réponse ; « Vu » n'est pas « Réussi » | `aide.ts` (#197) | Bonne règle, mais voir 2.1. |
| Réponse de l'adversaire après une erreur, puis retour seul | `Puzzles.tsx` (#237) | Voir 2.1. |
| Séries par thème (6), réussites d'affilée, record | `seriesThemes.ts` (#471) | Pas de progression vers un but (2.3). |
| Course aux problèmes (3 min, 3 erreurs) | `course.ts` (#287) | Bien. |
| Révision du jour (J+1, J+3, J+7) et révisions espacées des ratés (Leitner) | `revision.ts`, `revisionEspacee.ts` (#199, #469) | Solide, c'est notre avance sur BadukPop. |
| « Tes erreurs à rejouer », « Rejouer mes erreurs » (après une partie) | `MesErreurs.tsx`, `RejouerErreurs.tsx` | Bien ; leur « pourquoi » est déjà calculé (#492, #497). |
| Lien leçon → problèmes : 3 problèmes du thème en fin de leçon | `SeriePratique.tsx` (#200) | **Existe déjà.** Rien à ajouter. |

## 2. Ce qui manque, classé par impact

Indicateurs de la charte visés : réussite au premier essai (`probleme_termine`), réponses vues (`solution_vue`),
J7 des joueurs de problèmes, problèmes par session.

### 2.1 Comprendre son erreur — impact fort (apprentissage, puis rétention)

- Après un coup faux, l'adversaire jouait **toujours la première bonne réponse** (« le point clé de ton adversaire est
  ton point clé ») : une règle de pouce, pas une lecture. Rien ne vérifiait que ce coup sauve ou prenne quoi que ce
  soit ; quand ce point est déjà inutile (coup faux qui ne menace rien, ou réponse déjà occupée), le plateau montrait
  une « réponse » sans rapport avec l'erreur.
- La phrase était le texte du problème (un par problème, écrit pour l'erreur la plus courante) ou « Pas tout à fait.
  Essaie encore. » pour les 6 problèmes de base. Rien ne reliait la phrase à **ce** coup faux.
- Capture « Deux chemins dans le coin » (n06) : le texte dit « Blanc s'allonge en B1 », le plateau jouait A2.
- Comparaison : Lichess et chess.com jouent la réfutation du moteur et laissent rejouer ; BadukPop dit seulement
  « faux ». La méta-analyse Van der Kleij et al. (2015) donne l'avantage au retour **qui explique**.

### 2.2 Voir la solution complète — impact fort (apprentissage)

- « Voir la réponse » ne jouait **qu'un coup** : la colonne `solution` n'existe pas, `line` vaut `[answers[0]]` pour les
  250 problèmes. Pour une échelle (b6, c2) ou un « pousse vers le bord » en 3 temps, le débutant voit le premier coup et
  doit deviner la suite, c'est-à-dire la défense de Blanc, qui est justement ce qu'il n'a pas vu.
- chess.com et Lichess montrent la ligne entière, coup par coup, avec la défense ; on avance à son rythme.

### 2.3 Progression par thème — impact moyen (rétention)

- Les séries ont un record d'affilée, mais aucun **but** : on ne sait pas quand un thème est « su », ni quoi faire
  ensuite. Lichess a un tableau de bord par thème ; Duolingo une barre par unité et « unité suivante ».
- Contrainte : décision #137, jamais de total visible. Une barre vers un **objectif fixe** (6 problèmes réussis), plus
  petit que toutes les séries, la respecte.

### 2.4 Autres manques, plus faibles ou plus coûteux

| Manque | Impact | Pourquoi plus tard |
|---|---|---|
| Vie et mort, fin de partie : pas de réponse prouvée au coup faux (pas de pierres marquées, zone à fournir) | Moyen | Le lecteur de vie et mort (`preuve-vie-mort.ts`) a besoin d'une zone par problème : c'est du contenu (lots). |
| Événements par problème ouvert (`probleme_ouvert`) : l'entonnoir ouvert → résolu se lit mal | Moyen (pilotage) | Instrumentation à part. |
| Cote par thème visible (Lichess) | Faible ici | Décision #137 : la cote reste invisible. |
| « Voir la solution » avant tout essai | Faible | On garde la règle « essaie d'abord » (#197) ; elle fait la valeur du « Réussi ». |
| Les liens partagés n'ouvrent que le Go du jour | Faible | Hors du sujet entraînement. |

## 3. Ce qui est livré (#549)

1. **Réponse prouvée au coup faux.** Nouveau lecteur exact de capture, `src/go/lecture-capture.ts` (le lecteur des
   preuves du lot A, généralisé aux deux couleurs, borné à 20 000 coups et 40 ms ; une borne atteinte ne dit jamais rien).
   Pour un problème de prise ou de sauvetage (pierres marquées, 221 problèmes sur 250), l'adversaire joue un coup
   **prouvé** : après lui, tu ne peux plus prendre dans le nombre de coups de la solution, ou ta pierre est perdue quoi
   que tu fasses. Ordre d'essai : le point que nomme le texte relu du problème, puis la bonne réponse, puis le reste.
   Une phrase de faits s'affiche quand la pierre se pose : « Blanc se relie en B1. Le groupe marqué a 2 libertés. »,
   « Blanc répond en D4 et prend ta pierre marquée. ». Sans réponse prouvée, le coup faux reste seul et le texte du
   problème aussi. Les autres problèmes gardent le comportement de #237.
2. **Solution complète, coup par coup.** Bon coup, défense qui tient le plus longtemps, ton coup qui prend le plus vite…
   jusqu'à la prise ; « Coup précédent » / « Coup suivant » au rythme du joueur (rien ne bouge seul : mouvements
   réduits respectés d'office). Chaque légende est lue sur le plateau (« Noir joue F2 : atari. La pierre marquée n'a plus
   qu'une liberté. »). Quand l'adversaire n'a plus aucun coup utile, la suite le dit (« Blanc ne peut plus sauver ses
   pierres marquées. ») au lieu d'inventer un coup.
3. **Maîtrise par thème.** Barre fine au pied de chaque vignette (objectif `MAITRISE_CIBLE` = 6 problèmes différents
   réussis sans voir la réponse), « Maîtrisé » ensuite. Au moment où la série est maîtrisée : « Capturer : thème
   maîtrisé ! », « Thème suivant : Sauver » en relief, « Rester sur Capturer » en lien.

### Couverture mesurée sur la banque (250 problèmes, chaque coup faux légal joué)

| Mesure | Valeur |
|---|---|
| Coups faux avec une réponse prouvée | **10 700 sur 14 720 (73 %)** |
| — série Capturer / Sauver | 99,8 % / 99,9 % |
| — série Tesuji / Relier et couper / Vie et mort | 84 % / 88 % / 37 % |
| — Fin de partie (pas de pierres marquées) | 0 % (comportement d'avant) |
| Problèmes de prise avec une solution complète (2 coups ou plus) | **112 sur 164** (3 coups : 66 ; 5 : 32 ; 7 à 15 : 14) |
| Temps de lecture d'une réfutation (ordinateur chargé) | médiane 0,1 ms, 95 % sous 44 ms |
| Temps de la solution complète (au toucher) | médiane 0,2 ms, 95 % sous 124 ms |

Sûreté : `src/app/comprendreErreur.test.ts` revérifie chaque réponse montrée avec le lecteur **indépendant** du lot A, et
chaque coup noir de la solution (« Blanc ne peut plus sauver ses pierres dans la suite restante »).

## 4. Mesures (PostHog) et cibles

| Proposition | Indicateur | Mesure | Cible à 4 semaines |
|---|---|---|---|
| Réponse prouvée | Réussite au 2e essai après une erreur | `probleme_termine` raté puis `probleme_resolu` sans `solution_vue`, par problème, avant/après | + 10 points |
| Réponse prouvée | Réponses vues | `solution_vue` / problèmes ouverts | − 15 % |
| Solution complète | Rétention de la leçon du problème | réussite des révisions J+1 (`revision_element`) des problèmes vus en `solution_complete` contre les autres | + 10 points |
| Maîtrise | Passage à un 2e thème | `theme_suivant` / `theme_maitrise` | 50 % |
| Maîtrise | J7 des joueurs de problèmes | J7 de qui a un `theme_maitrise` contre les autres (corrélation, pas causalité) | à suivre |

## 5. Suite proposée

1. Zone de lecture par problème de vie et mort (dans les lots, par l'équipe contenu), pour étendre la réponse prouvée
   à cette série (37 % aujourd'hui).
2. `probleme_ouvert`, pour lire l'entonnoir ouvert → premier essai → résolu.
3. Une semaine après la mise en ligne : relire `theme_suivant` / `theme_maitrise` ; si moins de 30 %, essayer
   `MAITRISE_CIBLE` = 5.

## 6. Vie et mort, seki et course aux libertés (#554)

Suite de 2.4 et de 5.1 : la réponse prouvée au coup faux s'étend à toute la série « Vie et mort » (thèmes vie et mort,
seki, course aux libertés). Aucune zone n'a été écrite à la main pour la vie et la mort : elle se déduit du plateau.

### Comment c'est prouvé

- **Zone** (`src/go/refutation-locale.ts`) : l'espace du groupe marqué, fermé par des pierres solides (deux libertés
  dehors au moins) ou par le bord ; les pierres adverses enfermées en font partie. Une zone n'est utilisée que si elle
  est fermée : chaînes du défenseur avec toutes leurs libertés dedans, aucun point vide qui touche le dehors, chaque
  pierre qui peut être prise dans la zone. Course : les libertés des deux chaînes. Seules données déclarées : la chaîne
  du joueur dans 17 courses où seule la chaîne blanche est marquée (`src/go/zones-problemes.ts`).
- **Preuves**, après la réponse de l'adversaire, quoi que tu joues. Le ko ne compte jamais pour l'adversaire : soit
  toute ligne qui crée un ko est coupée, soit c'est toi qui gagnes tous les ko. Une coupure (profondeur, répétition)
  n'est jamais une preuve.

| Preuve | Outil | Phrase (après le geste) |
|---|---|---|
| mort | `evaluer` = -1, ou `evaluerMaitre` = -1 (toi maître du ko) | « Ton groupe ne peut plus vivre : il sera pris. » |
| sansYeux | `pasDeVie` (toi maître du ko), jamais en seki | « Ton groupe ne peut plus faire deux yeux. » |
| vit | `evaluer` = +1, ou `evaluerMaitre` = +1 | « Son groupe vivra, quoi que tu joues. » ou, s'il a déjà deux yeux (Benson), « Son groupe a deux yeux : il est vivant. » |
| imprenable | `survit` (toi maître du ko) | « Tu ne peux plus prendre son groupe. » |
| course | `evaluerCourse` = -1 (ko coupé) | « Tu perds la course aux libertés : ton groupe sera pris. » |
| prendre / sauver | lecteur de capture de #549, hors ligne, sans borne de temps, toi maître du ko, réponses au contact seulement | phrases de #549 (« Son groupe marqué a 2 libertés. » quand les deux camps sont marqués) |

- **Geste**, lu sur le plateau : la prise (« Blanc prend 2 pierres en C1. »), le faux œil créé (une chaîne voisine
  de l'œil n'a plus que lui pour liberté : « C1 devient un faux œil : Blanc peut y prendre tes pierres. »), le point
  que tu devais jouer (la réponse est une des bonnes réponses), sinon « Blanc joue en D2. ».
- **Texte relu** : la réplique qu'il nomme est essayée en premier, et celle qu'il réserve à une erreur (« ou D1 si tu
  as joué E1 ») avant tout, pour cette erreur ; elle est jouée si elle est prouvée.

### Performance

La recherche complète prend jusqu'à 3 s par coup faux (u15) : elle est faite hors ligne (`npm run refutations-locales`,
40 s) et figée dans `src/go/refutations-locales.gen.ts` (7 Ko, 1,9 Ko gzip), chargé avec l'écran des problèmes. Dans
l'app, il ne reste qu'une lecture de faits sur le plateau. `outils/refutationsLocales.test.ts` vérifie l'empreinte des
entrées (problèmes, lecteurs, zones, générateur) et revérifie chaque réplique sur la vraie position (25 s).

### Couverture (chaque coup faux légal joué, `npx vite-node outils/couvertureRefutations.ts`)

| | Avant (#549) | Après (#554) |
|---|---|---|
| Série Vie et mort | 2 008 / 6 181 (32,5 %) | **6 170 / 6 181 (99,8 %)** |
| — thème vie et mort | 1 131 / 4 544 (24,9 %) | 4 536 / 4 544 (99,8 %) |
| — thème course aux libertés | 569 / 1 269 (44,8 %) | 1 266 / 1 269 (99,8 %) |
| — thème seki | 308 / 368 (83,7 %) | 368 / 368 (100 %) |
| Temps d'une réfutation, série Vie et mort (95ᵉ centile) | 44,8 ms | 0,10 ms (max 8,4 ms) |
| Toute la banque | 10 744 / 18 224 (59,0 %) | 14 906 / 18 224 (81,8 %) |

Les 11 coups faux restants n'ont pas de réfutation sans ko, ou ouvrent la zone (un coup dehors qui menace un mur :
aa05 H3 et J2) : le texte du problème reste seul. Les autres séries ne changent pas (lecture en direct de #549).

## 7. Fin de partie, comptage et ko (#558)

Suite de la section 6 : la réponse prouvée au coup faux couvre la série « Fin de partie » (thèmes fin de partie et
comptage, 14 problèmes des lots W, Y, Z et AA) et les 7 problèmes de ko, qui gardaient le « point clé » de #237 sans
phrase prouvée (décision #549). Toujours la même règle : rien d'affirmé qui ne soit prouvé.

### Fin de partie et comptage : la preuve est un compte de points (`src/go/refutation-fin.ts`)

- **Zone** : les points encore ouverts (régions vides qui touchent les deux couleurs, pierres mortes retirées d'abord),
  ou, quand la frontière ouvre sur tout un territoire (lot W), les points de frontière de la preuve du lot, déclarés dans
  `src/go/zones-problemes.ts` avec les pierres mortes des énoncés (A9 de w06, J9 de w08, prouvées mortes par
  `preuve-vie-mort.ts` quel que soit le camp au trait). Hors de la zone, chaque point vide est à quelqu'un, et chaque
  chaîne a deux libertés (vérifié, sinon rien n'est lu).
- **Recherche** : minimax exact (alpha-bêta, bornes basse et haute égales, sinon rien) à la manière du lot W : un camp ne
  joue dans la zone que sur un point encore ouvert, pour prendre, ou pour sauver une chaîne en atari ; deux passes, on
  compte en **règle japonaise** (celle des textes des problèmes). Une pierre jouée hors de la zone chez l'adversaire est
  prisonnière, chez soi elle coûte son point, comme dans les lots. Le joueur est **maître du ko** : il reprend aussitôt,
  menaces sans fin ; la perte prouvée tient donc quelle que soit la gestion des menaces.
- **Phrase** : le geste (« Blanc prend 2 pierres en E9. », « Blanc joue en D1, le point que tu devais jouer. »), le fait
  sur ton coup, lu sur le plateau de départ (« Ta pierre en A9 est dans ton territoire : elle te coûte un point. »,
  « … est dans le territoire de Blanc. », « E7 est une dame (point neutre) : elle ne vaut rien. » seulement si le coup
  vaut exactement la passe, « La pierre A9 était déjà morte : la prendre ne rapportait rien. »), puis la perte :
  « Tu perds au moins N points par rapport au bon coup. », N étant l'écart exact du minimax avec le bon coup (y01 C1 :
  1 ; y04 E7 : 2 ; w06 A8 : 2 ; z12 D1 : 5 ; w09 B2 : 9). Les chiffres recoupent ceux des textes des lots.
- Les pierres marquées d'un problème de fin de partie (A9, J9) sont des pierres mortes à laisser, plus des cibles :
  `butDe` ne lit plus ces problèmes comme des captures (avant, w06 avait une « solution complète » qui prenait A9).

### Ko (`src/go/preuve-ko.ts`, lecture de capture, compte de points)

| Problème | Preuve | Phrase |
|---|---|---|
| aa12 (vivre par un ko) | `mort` : `evaluerMaitre` = −1, toi maître du ko | « Blanc joue en B2, le point que tu devais jouer. Ton groupe ne peut plus vivre : il sera pris. » |
| aa17, aa20 (tuer par un ko) | `vit` : `evaluerMaitre` = +1, toi maître du ko | « … Son groupe vivra, quoi que tu joues. » |
| x01 (prendre le ko) | lecture de capture hors ligne, toi maître du ko | « Blanc se relie en C1. Le groupe marqué a 3 libertés. » |
| x03 (le ko qui sauve) | lecture de capture : ta pierre est prise quoi que tu fasses, toi maître du ko | « Blanc répond en F5. Ta pierre marquée ne peut plus être sauvée. » |
| x02 (fermer le ko) | la prise a lieu, et le moteur note le ko | « Blanc prend ta pierre en E9 : c'est un ko. Pour la reprendre, il te faut une menace ailleurs. » |
| aa01 (fermer un ko en fin de partie) | toi maître du ko, E9 vaudrait **mieux** que E3 : rien de prouvé ainsi ; en ko simple pour les deux camps, E3 prend le ko et Noir perd | la même phrase factuelle, **sans chiffre** : la lecture sans menace finit la partie à la deuxième passe, ko pendant, et compterait un point de trop (2 au lieu de 1) |

Les menaces de ko hors de la zone ne sont pas lues : dès qu'une affirmation en dépendrait, la phrase ne dit que le
fait et la règle. **Aucun problème de ko ne reste à l'ancien comportement** : les 472 coups faux des 7 problèmes ont une
réplique prouvée (celle que nomme le texte, à chaque fois).

### Performance

Tout est calculé hors ligne et figé dans `src/go/refutations-locales.gen.ts` (13 Ko, 3,1 Ko gzip ; `npm run
refutations-locales`, 2 min) : la recherche de fin de partie prend jusqu'à 27 s par problème (y03). Dans l'app, il ne
reste qu'une lecture de codes et de faits sur le plateau. `outils/refutationsLocales.test.ts` vérifie l'empreinte des
entrées et revérifie chaque réplique (perte et fait compris) sur la vraie position ; `src/go/refutation-fin.test.ts`
recoupe les chiffres des lots. L'événement `erreur_comprise` porte `but` = `points` pour ces répliques.

### Couverture (chaque coup faux légal joué, `npx vite-node outils/couvertureRefutations.ts`)

| | Avant (#554) | Après (#558) |
|---|---|---|
| Thème fin de partie | 0 / 588 (0 %) | **588 / 588 (100 %)** |
| Thème comptage | 0 / 166 (0 %) | **166 / 166 (100 %)** |
| Thème ko | 0 / 472 (0 %) | **472 / 472 (100 %)** |
| Série Fin de partie, temps d'une réfutation (95ᵉ centile) | — | 0,09 ms (max 38 ms) |
| Toute la banque | 14 907 / 18 224 (81,8 %) | **16 175 / 18 224 (88,8 %)** |

Reste à 0 % le thème ouverture (807 coups faux, 5 problèmes en 13 × 13) : jugé par KataGo, hors de portée d'une preuve
exacte. Les séries lues en direct (Capturer, Tesuji, Relier et couper) ne changent pas, à la mesure près (lecture bornée
à 40 ms : quelques coups de plus ou de moins selon la charge de la machine).
