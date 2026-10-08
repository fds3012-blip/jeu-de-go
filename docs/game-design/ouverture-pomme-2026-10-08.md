# Pomme ne joue plus ses premiers coups au bord (#488)

Tenu par l'agent `game-designer`. Mesures du 08/10/2026. Constat d'origine : #466 (P11). Voir aussi `equilibrage.md`.

## En bref

- **Avant** : sur 9 × 9, le premier coup de Pomme tombait sur la 1re ligne dans **35 %** des parties, et sur la 1re ou la 2e ligne dans **68 %** (240 parties). Sur 13 × 13 : **72 %** de ses 3 premiers coups sur la 1re ligne. Caillou avait le même défaut, en moins fort (13 × 13 : 33 % sur la 1re ligne, 28 % sur la 2e).
- **Après** : **0 %**, sur 9 × 9 comme sur 13 × 13, pour Pomme, Caillou et les deux crans de Mochi plus doux que Pomme.
- **Pomme reste aussi battable** : contre le débutant simulé de sa force, elle gagne **41 %** des parties, contre **44 %** avant (80 parties chacun). Contre les deux débutants plus faibles, elle gagne un peu **moins** qu'avant. La première victoire n'est pas plus dure.
- **Le débutant qui passe tôt ne perd plus rien** (#235) : dans les 3 premières parties, Pomme passe dès que tu passes. Au 40e coup, sa passe coûtait en moyenne 4,3 points avant, 9,3 avec la première version de cette PR ; maintenant **0** (30 parties).
- Réglage : filtre des coups plausibles (`src/engine/ouverture.ts`), Pomme passe de `hasard` 0,3 à **0,65** et ne ferme plus de brèche après ta passe (`fermeBreche: false`), les crans de Mochi passent de 0,7 / 0,5 à **0,9 / 0,8**.

Indicateurs visés :
- **Image du go** (#466, P11) : part des premiers coups de l'ordi sur la 1re ou la 2e ligne. Cible : 0 %. Mesurée par le banc et verrouillée par Vitest.
- **Première victoire préservée** : part des 3 premières parties contre Pomme gagnées par le joueur (`partie_terminee`, `adversaire = pomme`, `gagnant`), abandons de la première partie (`premiere_partie_terminee`, `fin = abandon`), et rétention J1 (45 %, charte). Garde-fou : si la part de victoires baisse de plus de 5 points sur deux semaines après la mise en ligne, on remonte `hasard` de Pomme de 0,05.

## Ce qui change dans le jeu

Le filtre s'applique au moteur simple (Pomme, Caillou, crans de Mochi, repli des niveaux KataGo) et au tirage selon la politique des niveaux KataGo (Bambou, Renard). Ni les simulations ni le hasard ne choisissent un coup hors des coups plausibles.

| Moment | Coups permis | Constante |
|---|---|---|
| Ouverture : les 3 premiers coups de l'ordi (9 × 9), 4 (13 × 13), 6 (19 × 19) | 3e et 4e ligne ; le centre aussi sur 9 × 9 | `COUPS_OUVERTURE`, `ZONE_OUVERTURE` |
| Ensuite | Tout sauf la 1re ligne | — |
| Toujours | Une capture, ou un coup qui sort un groupe de l'atari | `coupsTactiques` |
| Fin de partie (un quart du plateau couvert) | La 1re ligne au contact d'une pierre (bloquer, fermer) | `partieAvancee` |

Si aucun coup n'est plausible, la règle d'après l'ouverture s'applique, puis tous les coups : le filtre ne fait jamais passer l'ordi à tort. Les coups qui ferment une frontière (`coupDeFermeture`, `brecheAFermer`) ne passent pas par le filtre.

Pourquoi Pomme ne ferme plus de brèche après ta passe : voir « Débutant qui passe tôt » plus bas.

Pourquoi `hasard` monte : le filtre retire à Pomme ses pires coups (B1 au premier coup, coups au bord sans raison). Avec le même `hasard` (0,3), elle gagnait 70 % des parties contre le débutant de sa force, au lieu de 44 %. Ses coups au hasard sont maintenant tirés parmi des coups plausibles : il en faut plus pour la même maladresse. Pour le joueur, c'est mieux : Pomme perd parce qu'elle joue des coups faibles mais crédibles, pas parce qu'elle joue n'importe où.

## Méthode

Banc : `src/engine/ouverture.bench.test.ts`, désactivé par défaut.

```sh
OUVERTURE_BENCH=1 npx vitest run src/engine/ouverture.bench.test.ts
# Variables : OUVERTURE_PARTIES, OUVERTURE_GRAINE, OUVERTURE_POMME='{"hasard":0.65}', OUVERTURE_QUAND, OUVERTURE_DEBUTANTS, OUVERTURE_SORTIE
```

- 9 × 9, **komi 0,5** (premières parties, `KOMI_DEBUTANT`), comptage chinois, pierres mortes estimées par les simulations (400). Le débutant a Noir, comme dans l'app. Pomme est **accommodante** (elle passe quand le joueur passe), comme dans les 3 premières parties.
- Pomme joue avec 250 simulations fixes, sans plafond de temps : les séries sont reproductibles.
- Deux séries de 40 parties par proxy, graines 4880 et 9000 : 80 parties par case.
- **Débutants simulés** (le témoin ne change pas entre avant et après : il garde l'ancien moteur, sans filtre) :
  - *au hasard* : un coup légal au hasard, jamais dans ses yeux (même proxy que `passe-debutant.test.ts`) ;
  - *Mochi doux* : l'ancien cran de Mochi plus doux que Pomme (`hasard` 0,5, sans filtre) ;
  - *de la force de l'ancienne Pomme* : l'ancienne Pomme elle-même (`hasard` 0,3, sans filtre). C'est le proxy principal : avant, la partie est un miroir, autour de 50 %.
- Mêmes limites que `equilibrage.md` (L3) : des bots, pas des humains. Le banc dit si Pomme a changé de force ; PostHog dira si les vrais débutants gagnent toujours.

Mesures brutes : `ouverture-pomme-2026-10-08.jsonl` (une ligne par série).

## Résultats : premiers coups de l'ordi

9 × 9, Pomme en Blanc, 240 parties (3 proxys × 80) :

| | 1er coup en 1re ligne | 1er coup en 1re ou 2e ligne | 3 premiers coups en 1re ligne | 3 premiers coups en 1re ou 2e ligne |
|---|---|---|---|---|
| Avant (Pomme 0,3, sans filtre) | 83 / 240 (35 %) | 162 / 240 (68 %) | 224 / 720 (31 %) | 458 / 720 (64 %) |
| Après (Pomme 0,65, filtre) | **0** | **0** | **0** | **0** |

13 × 13, 3 premiers coups, 20 parties contre le débutant au hasard :

| | 1re ligne | 2e ligne | Autres lignes |
|---|---|---|---|
| Pomme avant | 43 / 60 | 10 / 60 | (3e à 5e : 7) |
| Pomme après | **0** | **0** | 3e : 43, 4e : 17 |
| Caillou avant | 20 / 60 | 17 / 60 | (3e et plus : 23) |
| Caillou après | **0** | **0** | 3e : 33, 4e : 27 |

Caillou sur 9 × 9 (en Blanc, 6 parties) : avant, 3 de ses 18 premiers coups sur la 2e ligne ; après, aucun.

## Résultats : force de Pomme

Victoires de **Pomme** contre chaque débutant simulé (80 parties, komi 0,5). « Écart » : avance moyenne de Pomme, en points.

| Débutant simulé | Avant (0,3, sans filtre) | Filtre, 0,3 | Filtre, 0,5 | Filtre, 0,6 | Filtre, 0,65 | **Filtre, 0,65, sans brèche (retenu)** |
|---|---|---|---|---|---|---|
| Au hasard | 71 / 80 (89 %), +25,7 | 40 / 40 (100 %), +35,1 | 36 / 40 (90 %) | 68 / 80 (85 %), +26,1 | 60 / 80 (75 %), +17,8 | **60 / 80 (75 %), +17,8** |
| Mochi doux (0,5) | 55 / 80 (69 %), +7,9 | 33 / 40 (83 %), +12,1 | 26 / 40 (65 %) | 58 / 80 (73 %), +10,1 | 50 / 80 (63 %), +10,6 | **50 / 80 (63 %), +10,6** |
| Force de l'ancienne Pomme | 35 / 80 (44 %), −3,9 | 28 / 40 (70 %), +13,7 | 28 / 40 (70 %) | 43 / 80 (54 %), +10,6 | 34 / 80 (43 %), +0,9 | **33 / 80 (41 %), +0,2** |

Lecture :
- Le filtre seul rend Pomme nettement plus forte (70 % contre le débutant de sa force). Il faut compenser.
- À 0,6, Pomme reste un peu plus forte qu'avant contre le proxy principal (+10 points, à la limite du bruit : environ ± 8 points sur 80 parties).
- À **0,65**, elle est au même niveau contre le proxy principal (43 % contre 44 %) et un peu plus douce contre les deux autres. On choisit le côté doux : la première victoire est l'acquis à préserver.
- L'écart en points contre le débutant au hasard baisse (+26 → +18) : les parties perdues par un débutant très faible sont moins lourdes.
- Sans brèche après ta passe : une seule partie change sur 240 (les débutants simulés passent surtout en fin de partie, quand tout est fermé). Le repère principal passe de 34 à 33 victoires de Pomme sur 80.

Crans de Mochi plus doux que Pomme (`src/engine/guidee.ts`), 40 parties contre l'ancien cran de même rang :

| Nouveau cran (filtre) | Contre l'ancien | Victoires du nouveau | Lecture |
|---|---|---|---|
| 0,75 | ancien 0,5 | 26 / 40 (65 %) | Encore trop fort |
| **0,8** | ancien 0,5 | **21 / 40 (53 %)** | Équivalent |
| 0,75 | ancien 0,7 | 34 / 40 (85 %) | Trop fort |
| **0,9** | ancien 0,7 | **21 / 40 (53 %)** | Équivalent |

L'ordre des crans est gardé : 0,9 < 0,8 < Pomme 0,65 en force.

## Effets de bord mesurés

- **Caillou → Pomme** (proxy de l'échelle, 12 parties, couleurs alternées, Caillou à 600 ms) : 12 / 12 avant et après. L'écart moyen monte de +19,7 à +39,3 points : Caillou profite aussi du filtre. `equilibrage.md` donnait 7 / 8 (+31,9). La marche Pomme → Caillou reste nette ; elle est peut-être un peu plus haute. À confirmer sur 32 parties si les joueurs bloquent sur Caillou (indicateur : part des joueurs qui battent Caillou dans leur première semaine, `boucle.md`).
- **Débutant qui passe tôt** (#235, `passe-debutant.test.ts`). Première version de cette PR : Pomme ne jouait plus la 1re ligne sans raison, donc il restait plus souvent un trou au bord de sa zone. Après la passe du joueur, elle fermait ce trou (exception de #235) et ça lui rapportait plus : jusqu'à 25 points au lieu de 11, et **9,3 points en moyenne au 40e coup au lieu de 4,3**. Exactement le cas que #235 protège : refusé.
  - Cause : 9 des 10 plus gros gains venaient d'un trou en 1re ou 2e ligne. L'ancienne Pomme jouait souvent au bord, au hasard (35 % de ses premiers coups en 1re ligne), et bouchait ces trous sans le vouloir. Ses coups au hasard sont maintenant plausibles, plus au bord.
  - Correction : Pomme ne ferme plus de brèche après ta passe (`fermeBreche: false` dans `OPPONENTS`, lu par `reponseAccommodante`). Dans tes 3 premières parties (komi 0,5), elle passe dès que tu passes, trou ou pas. Le trou reste ouvert au comptage : la zone derrière ne compte pour personne, c'est le plateau tel qu'il est. Caillou et les niveaux KataGo gardent la règle de #235.
  - Mesure (30 parties scriptées : 24, 32 et 40 coups, graines 1 à 10, débutant au hasard qui passe, Pomme accommodante). Gain de Pomme après la passe, en points :

    | | Moyenne | Au 40e coup | Maximum | Parties au-dessus de 12 |
    |---|---|---|---|---|
    | Avant #488 (Pomme 0,3, sans filtre) | 3,4 | 4,3 | 11 | 0 |
    | Filtre, 0,65, ferme la brèche (1re version) | 4,5 | 9,3 | 25 | 3 |
    | Filtre, 0,65, sans brèche (retenu) | −0,1 | −0,4 | 1 | 0 |

    Les petits écarts restants ne sont que du bruit d'estimation des pierres mortes (Pomme ne joue aucun coup).
  - `passe-debutant.test.ts` garde ses bornes d'origine (12 points par partie). Les deux tests qui vérifiaient la fermeture d'une brèche par l'ordi (`passe-debutant.test.ts`, `passe-fin.test.ts`) la vérifient maintenant avec Caillou, et vérifient que Pomme passe.
- **Fin de partie à 0 point de territoire** (`e2e/premieres-minutes.spec.ts`, test 4) : Pomme joue plus près des pierres du joueur, qui subit parfois deux atari. La leçon « atari » passe alors avant « Ton territoire compte 0 » (ordre voulu de `leconMochi`). Le test e2e accepte maintenant ce cas.

## Tests

- `src/engine/ouverture.test.ts` : aucun des 300 premiers coups de Pomme (9 × 9) ni des 120 sur 13 × 13 hors de la zone ; crans de Mochi et Caillou aussi ; témoin sans filtre (plus de 60 coups au bord sur 300) ; chaque coup de Pomme en 1re ligne a une raison ; capture et sauvetage en 1re ligne permis pendant l'ouverture ; repli quand rien n'est plausible ; **16 parties contre l'ancienne Pomme : Pomme en gagne entre 3 et 10** (6 aujourd'hui).
- `src/engine/passe-debutant.test.ts` (bornes d'origine) et `src/engine/passe-fin.test.ts` : la brèche est fermée par Caillou, Pomme passe.
- `src/engine/guidee.test.ts` : Pomme à 0,65.
- Playwright (`--workers=1`) : `premiere-victoire`, `premieres-minutes`, `premiere-pierre`, `ordi`, `passe-debutant`, `frontieres`, `partie-guidee`, `fin-de-partie`, `noms-adversaires`, `partie`, `partie-v3`, `parcours-debutant-v3`, `parcours-214`, `coach-mochi`, `conseil-mochi`, `bilan`, `a11y-annonces-partie`, `clavier`, `accueil-premier-lancement`.

## Comparaison

- **chess.com** : ses bots les plus faibles font des erreurs, mais leurs ouvertures ressemblent à des ouvertures. Même principe ici : l'erreur doit être crédible (déjà le choix de P1b dans `equilibrage.md`).
- **BadukPop** et les bots débutants des serveurs de go : un adversaire faible ouvre dans les coins et sur les bords, puis se trompe en lisant. C'est l'image qu'on donne maintenant.
- **Duolingo** : les premières leçons sont faciles mais justes. Un adversaire qui ouvre en B1 apprend une chose fausse : que n'importe quel coup se vaut.
