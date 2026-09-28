# Équilibrage de l'échelle des 9 adversaires

Tenu par l'agent `game-designer`. Issue #179. Mesures du 28/09/2026. Voir aussi `boucle.md` (boucle de la semaine).

## En bref

- **L'ordre est bon** : sur 64 parties entre voisins (76 en tout), chaque adversaire bat le précédent (de 61 % à 100 % des parties).
- **Mais les marches ne sont pas régulières.** En bas de l'échelle, il y a un mur. Caillou (moteur simple) perd **toutes** ses parties contre Bambou (premier niveau KataGo), avec 71 points d'écart en moyenne sur 81. Bambou → Renard est aussi très haut (8 sur 8, +27,5 points).
- **En haut, les marches sont faibles** : Dragon → Sensei, 5 sur 8 seulement.
- **Aucune constante de la table ne corrige le mur.** Même réduit à 1 visite et 30 points de tolérance, Bambou gagne 4 sur 4 contre Caillou : le réseau seul est bien plus fort que le Monte-Carlo. Il faut une part de hasard pour les niveaux KataGo, ce qui demande du code. C'est la proposition P1 (mesurée ci-dessous). Aucun réglage n'a été modifié dans cette PR.
- **Mise à jour (mur de Bambou, P1b en place)** : `bestMove` applique maintenant `hasard` aux niveaux KataGo. Le coup est tiré selon la politique du réseau, avec une température. Réglage retenu : Bambou 0,7 (T = 1,5), Renard 0,35 (T = 1,5). Mesures sur 16 à 32 parties par marche : Caillou → Bambou **26 / 32** (81 %, +45 points au lieu de +71), Bambou → Renard **12 / 16** (75 %), Renard → Rivière **13 / 16** (81 %). Le mur est cassé. Détail dans « P1 en place » ci-dessous.
- Mesures brutes (une ligne par partie, avec les réglages essayés) : `equilibrage-mesures.jsonl`.

Indicateurs visés : progression dans l'échelle (part des joueurs qui battent Bambou, Rivière, Sensei), parties terminées par semaine (5, charte), rétention J7 (25 %, charte).

## Méthode

Banc d'essai : `src/engine/echelle.bench.test.ts`, désactivé par défaut (la CI ne le lance pas).

```sh
npm run fetch-model                          # réseau g170-b6c96 dans public/models/
npm i --no-save @tensorflow/tfjs-node        # TensorFlow natif : environ 30 fois plus rapide que le backend CPU
ECHELLE_BENCH=1 ECHELLE_PAIRES=1-2,2-3 ECHELLE_PARTIES=8 npx vitest run src/engine/echelle.bench.test.ts
```

- 9 × 9, komi 6,5, comptage chinois. Pierres mortes retirées selon la propriété de KataGo (16 visites). Fin : deux passes, ou 160 coups.
- Couleurs alternées : chaque paire joue autant de parties avec Noir qu'avec Blanc.
- Graines fixes (179, puis 500 pour la deuxième série). Le moteur simple garde son budget de temps réel (Pomme 150 ms, Caillou 600 ms). La graine fixe donc son hasard, pas son nombre de simulations : deux lancers peuvent un peu différer.
- Les niveaux KataGo jouent comme `bestMove` : recherche, tolérance, style, fermeture des frontières. **Sans** le plafond de 1,8 s par coup : on mesure le réglage prévu, pas un téléphone donné (voir la limite L2).
- `ECHELLE_REGLAGES` essaie d'autres réglages sans toucher `simple.ts`. Exemple : `'{"bambou":{"hasard":0.3}}'`.

## Résultats : marches voisines (réglages actuels)

« Victoires » : parties gagnées par l'adversaire le plus fort. « Écart » : points d'avance moyens du plus fort (négatif si ses défaites sont plus lourdes que ses victoires). Sur 81 points, +74,5 ou +87,5 veut dire que le plus faible n'a plus une pierre vivante.

| Marche | Réglages (plus faible → plus fort) | Victoires | Écart moyen | Lecture |
|---|---|---|---|---|
| Pomme → Caillou | simple 250 sim., 30 % hasard → simple 20 000 sim. | 7 / 8 | +31,9 | Nette. Bien pour les débuts. |
| **Caillou → Bambou** | simple → KataGo 4 visites, tolérance 12 | **4 / 4** | **+71,0** | **Mur.** Caillou est anéanti à chaque partie. |
| **Bambou → Renard** | 4 v., tol. 12 → 8 v., tol. 8 | **8 / 8** | **+27,5** | Trop haute. |
| Renard → Rivière | 8 v., tol. 8 → 16 v., tol. 5 | 6 / 8 | +17,3 | Nette. |
| Rivière → Tigre | 16 v., tol. 5 → 32 v., tol. 3 | 8 / 12 | +6,6 | Juste. La 1re série donnait 1 / 4 ; 8 parties de plus : 7 / 8. |
| Tigre → Montagne | 32 v., tol. 3 → 64 v., tol. 1,5 | 6 / 8 | +16,5 | Nette. |
| Montagne → Dragon | 64 v., tol. 1,5 → 128 v., tol. 0,8 | 6 / 8 | −2,0 | Nette aux victoires. Une défaite lourde fausse l'écart. |
| **Dragon → Sensei** | 128 v., tol. 0,8 → 200 v., tol. 0 | **5 / 8** | −8,5 | **Faible** : pas significatif sur 8 parties. |

Pour mesurer le mur, deux paires sautent une marche : Pomme → Bambou, 4 / 4 (+81,0) ; Caillou → Renard, 4 / 4 (+74,0). Et Bambou → Rivière, 3 / 4 (+10,5).

### Courbe de force

Écart Elo estimé à partir du taux de victoire, lissé : (v + 0,5) / (n + 1). Pomme vaut 0. Les paires à 100 % sont **sous-estimées** : l'écart aux points montre que Caillou → Bambou est bien plus haut que 380.

```mermaid
xychart-beta
  title "Force estimée (Elo relatif, Pomme = 0)"
  x-axis [Pomme, Caillou, Bambou, Renard, Rivière, Tigre, Montagne, Dragon, Sensei]
  y-axis "Elo" 0 --> 2000
  line [0, 280, 661, 1153, 1319, 1430, 1596, 1762, 1840]
```

| Marche | Taux lissé | Elo de la marche |
|---|---|---|
| Pomme → Caillou | 0,83 | +280 |
| Caillou → Bambou | 0,90 (au moins) | +380 (au moins) |
| Bambou → Renard | 0,94 (au moins) | +490 (au moins) |
| Renard → Rivière | 0,72 | +170 |
| Rivière → Tigre | 0,65 | +110 |
| Tigre → Montagne | 0,72 | +170 |
| Montagne → Dragon | 0,72 | +170 |
| Dragon → Sensei | 0,61 | +80 |

**Écart moyen des marches** : environ +230 Elo. Mais de Pomme à Renard, la moyenne est d'au moins +380. De Renard à Sensei, elle n'est que de +140. La courbe monte trop vite en bas et trop peu en haut. Pour un débutant, c'est l'inverse de ce qu'il faut.

## Conditions de déblocage actuelles

Lues dans `src/app/home.ts` (`echelle`, `OUVERTS_D_OFFICE`), `src/app/bilan.ts` (`battu`) et `src/app/equilibrage.ts`. Affichées par `Accueil.tsx` via `App.tsx`.

- Pomme et Caillou sont ouverts d'office (`OUVERTS_D_OFFICE = 2`).
- Ensuite, **une seule victoire** contre l'adversaire précédent ouvre le suivant (`battu` : `v > 0`, bilan local `go.bilan.v1`). Un adversaire verrouillé indique celui qu'il faut battre d'abord.
- Le joueur a toujours Noir, sans pierre de handicap.
- Komi : 0,5 pour les 3 premières parties contre l'ordi, quel que soit l'adversaire (`KOMI_DEBUTANT`, `PARTIES_KOMI_DEBUTANT`). Ensuite 6,5.
- Aucune condition de niveau d'XP ni de leçon.

Conséquence : un débutant bat Caillou (objectif de `boucle.md` : dans sa première semaine), Bambou s'ouvre, et il tombe sur le mur. Aucune défaite n'y est « juste un peu trop dure » : il perd tout le plateau. C'est le point de la semaine 1 où l'on risque de perdre le plus de joueurs (boucle de la semaine, rétention J7).

## Propositions

### P1. Une part de hasard pour Bambou et Renard (code, à faire dans une issue dédiée)

Le champ `hasard` existe déjà dans la table `OPPONENTS` : « probabilité de jouer un candidat au hasard au lieu du meilleur ». Mais `bestMove` l'ignore pour les niveaux KataGo, et ce champ vaut 0 pour eux. Proposition : que `bestMove` joue, avec la probabilité `hasard`, un coup tiré parmi les candidats du moteur simple (`candidates(pos, false)` : ni œil rempli, ni auto-atari). Environ 5 lignes dans `src/engine/index.ts`, plus un test Vitest avec une graine. Le banc simule déjà cette règle.

Mesures avec le banc (8 parties par paire, graines 179, 700 et 900) :

| Réglage essayé | Caillou → Bambou | Bambou → Renard | Renard → Rivière |
|---|---|---|---|
| Actuel (hasard 0 partout) | 4 / 4, +71,0 | 8 / 8, +27,5 | 6 / 8, +17,3 |
| Bambou 1 visite, tolérance 30 (sans hasard) | 4 / 4, +70,0 | — | — |
| Bambou 0,5 | 0 / 4, −3,5 | — | — |
| Bambou 0,3 | 2 / 4, +14,0 | — | — |
| Bambou 0,2 ; Renard 0,1 | 6 / 8, +43,0 | 7 / 8, +32,8 | — |
| Bambou 0,25 ; Renard 0,12 ; Rivière 0,05 (graine 700) | 6 / 8, +31,5 | 8 / 8, +39,8 | 3 / 8, −3,8 |
| Bambou 0,25 ; Renard 0,08 (graine 1100) | 2 / 8, −8,0 | 8 / 8, +41,5 | 7 / 8, +18,8 |
| Bambou 0,3 ; Renard 0,15 (graine 900) | 2 / 8, +1,8 | 6 / 8, +28,8 | **8 / 8, +44,3** |

Lecture :
- Le hasard casse bien le mur : dès 0,2, Caillou gagne des parties contre Bambou.
- Mais c'est un bouton **très raide et très bruité**. Bambou à 0,25 fait 6 / 8 avec une graine, 2 / 8 avec une autre (8 / 16 en tout : autant que Caillou). Un seul coup tiré au hasard parmi tous les coups légaux peut perdre la partie sur 9 × 9.
- Déplacer le hasard vers Renard **déplace le mur** : Renard à 0,15 perd 8 / 8 contre Rivière (+44 points).
- Rivière n'a pas besoin de hasard.

**Proposition** : Bambou **0,2**, Renard **0,1**, les autres à 0. Cible par marche : **65 à 80 %** de victoires pour le plus fort. Le joueur sent la marche, mais peut la franchir en progressant. À valider sur **16 parties par paire** avant la mise en production.

**Variante plus douce, à essayer d'abord (P1b)** : au lieu d'un coup uniforme, tirer le coup au hasard **selon la politique du réseau**, avec une température (par exemple T = 1,5 pour Bambou, 1 pour Renard). Les erreurs restent des coups « humains » : plausibles, pas absurdes. La force baisse de façon continue, et un débutant peut comprendre pourquoi il gagne. Même principe que les niveaux faibles des bots de chess.com.

Indicateur : part des joueurs qui battent Bambou dans les 7 jours après avoir battu Caillou (`partie_terminee` avec `adversaire` et `gagnant`), puis rétention J7. Garde-fou : si plus de 60 % des joueurs battent Bambou dès la 1re partie, on baisse le hasard de 0,05.

### P1 en place : tirage selon la politique (branche `mur-bambou`)

Code (`src/engine/katago/choose.ts`, `choisirCoup` et `coupSelonPolitique`) :
- Avec la probabilité `hasard`, le niveau ne prend pas le coup de la recherche. Il tire un coup selon la politique brute du réseau (nouveau champ `policy` de l'analyse), élevée à la puissance 1 / `temperature`.
- Garde-fous : jamais la passe, jamais dans ses propres yeux, jamais en auto-atari sans capture (`candidates`), jamais un coup que le réseau juge absurde (politique sous 0,1 %). Pas de hasard quand l'adversaire vient de passer ou quand la recherche conseille de passer : la fin de partie reste propre.
- `bestMove(pos, niveau, { seed })` est reproductible : même graine, même coup. Sans graine, vrai hasard.
- Le repli sur le moteur simple (KataGo absent) garde sa pleine force : `hasard` ne l'affaiblit pas.
- Le banc joue exactement ce code (`choisirCoup`), plus la simulation d'avant.
- Test rapide, sans réseau (faux moteur) : `src/engine/hasard.test.ts`.

Pourquoi ces valeurs sont plus hautes que le 0,2 proposé plus haut : un coup tiré selon la politique est **bien moins coûteux** qu'un coup tiré uniformément. C'est souvent un coup plausible, juste pas le meilleur. Il faut donc en jouer beaucoup plus pour la même baisse de force. En échange, le bouton est **bien plus doux** : de 0,5 à 0,8, le taux baisse par paliers, sans le saut de 100 % à 25 % du tirage uniforme.

Mesures (banc, 9 × 9, komi 6,5, couleurs alternées ; graines entre parenthèses) :

| Réglage essayé | Caillou → Bambou | Bambou → Renard | Renard → Rivière |
|---|---|---|---|
| Actuel (hasard 0 partout) | 4 / 4, +71,0 | 8 / 8, +27,5 | 6 / 8, +17,3 |
| Bambou 0,5, T = 1 (179) | 8 / 8, +55,0 | — | — |
| Bambou 0,8, T = 1,5 (179) | 5 / 8, +19,8 | — | — |
| Bambou 0,7, T = 1,5 (500) | 12 / 16, +42,1 | — | — |
| Bambou 0,7, T = 1,5 (2100) | 14 / 16, +48,2 | — | — |
| **Bambou 0,7, T = 1,5 (les deux séries)** | **26 / 32, +45,2** | — | — |
| Bambou 0,6, T = 2 (2100) | 10 / 16, +26,2 | — | — |
| Bambou 0,7 ; Renard 0,4, T = 1,5 (500) | — | 5 / 8, +11,5 | 6 / 8, +26,3 |
| Bambou 0,7 ; Renard 0,3, T = 1,5 (900) | — | 14 / 16, +34,8 | 13 / 16, +17,1 |
| **Bambou 0,7 ; Renard 0,35, T = 1,5** (1300) | — | **12 / 16, +31,9** | **13 / 16, +19,8** |

Lecture :
- Les trois marches du bas sont autour de la cible : 81 %, 75 %, 81 %. Plus de mur : Caillou gagne 6 parties sur 32.
- **Piste suivante** : Bambou 0,6 avec T = 2 donne 10 / 16 et un écart bien plus faible (+26). Une température plus haute rend les erreurs plus fréquentes mais moins lourdes. Un réglage intermédiaire (0,65, T = 2) viserait 70 % avec un écart d'environ 30 points. Pas mesuré ici faute de temps (machine chargée) : à mesurer sur 32 parties avant de changer.
- **L'écart moyen reste grand** (+32 à +42 points) : les parties sont bimodales. Quand Bambou gagne, il gagne souvent tout le plateau ; quand il perd, c'est de peu. Sur 9 × 9, un débutant qui perd un groupe perd la partie. L'écart moyen a baissé de 71 à 45 points contre Caillou, mais ce n'est pas encore une marche douce aux points.
- Renard 0,3 ou 0,4 : 5 / 8 et 14 / 16. Le bruit sur 8 à 16 parties reste de l'ordre de ± 12 points de pourcentage. Les réglages sont à confirmer par PostHog (indicateur ci-dessus).
- **Limite de cette série** : la machine de mesure était très chargée (autres agents, charge 30 sur 4 cœurs). Caillou joue avec un budget de temps (600 ms) : sous charge, il fait moins de simulations et joue plus faiblement. Les taux Caillou → Bambou sont donc plutôt **surestimés** pour Bambou. Sur un téléphone récent, Caillou est probablement un peu plus fort qu'ici.

Rangs affichés (P3) : pas changés. Bambou et Renard se sont rapprochés de Caillou ; « 13 kyu » et « 10 kyu » restent plausibles, à recaler avec la courbe complète.

### P2. Resserrer le haut de l'échelle (constantes, après P1)

Dragon → Sensei (5 / 8) est la marche la plus faible. Or Sensei est le « dernier défi » : le battre doit être un vrai événement. Pistes à mesurer sur 16 parties avant de changer quoi que ce soit : Dragon à 96 visites et tolérance 1, ou Sensei à 256 visites (le test `katago.test.ts` plafonne à 256). Ce n'est pas changé ici : 8 parties ne suffisent pas à trancher, et la limite L2 peut effacer l'écart sur téléphone.

### P3. Rangs affichés

Caillou est affiché à « 16 kyu », Bambou à « 13 kyu ». Or la mesure montre un écart bien plus grand que 3 pierres. Après P1, recaler les rangs sur la courbe mesurée. Environ 1 kyu ≈ 1 pierre de handicap, soit à peu près 100 Elo à ce niveau (ordre de grandeur, à vérifier). À faire dans la même issue que P1, puisque P1 change les forces.

### P4. Mesurer le vrai temps de réflexion (instrumentation)

Ajouter à `partie_terminee` le nombre moyen de visites atteintes par coup, pour les niveaux KataGo. On saura alors si Dragon et Sensei atteignent leurs 128 et 200 visites en 1,8 s sur les téléphones réels (limite L2).

## Limites

- **L1. Peu de parties** : 4 à 12 par paire. Suffisant pour voir un mur (100 %, +70 points) ou une inversion nette. Pas pour départager 60 % et 75 %. Le banc se relance avec plus de parties (`ECHELLE_PARTIES`).
- **L2. Plafond de 1,8 s par coup** (`bestMove`) : le banc ne l'applique pas. Sur un téléphone lent, Dragon et Sensei peuvent n'atteindre qu'une partie de leurs visites, et le haut de l'échelle se tasse encore. Repère : sur la machine de mesure, TensorFlow natif, environ 15 ms par évaluation (Sensei : environ 3 s par coup).
- **L3. Bots contre bots**, pas des humains. Un débutant ne joue ni comme Pomme ni comme Caillou. Le banc dit si les marches sont régulières. Il ne dit pas si Pomme est battable par un vrai débutant : ça, c'est PostHog (`premiere_partie_terminee`).
- **L4. 9 × 9 seulement.** Sur 13 × 13 et 19 × 19, le moteur simple est encore plus faible par rapport à KataGo : le mur y est sans doute plus haut.
