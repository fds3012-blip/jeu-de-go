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
