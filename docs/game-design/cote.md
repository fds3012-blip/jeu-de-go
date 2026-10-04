# Cote Mochi : cote de jeu et grades (issue #417)

Étape 1 : une cote visible, calculée par le serveur, traduite en grade kyu/dan. Étape 2 (plus tard, issue séparée) : des titres mensuels.

## Règles

- **Ce qui compte** : seulement les **parties classées entre humains** (`games.rated` et `bot_id is null`). Les parties contre les IA ne comptent pas (décision de Florian, 04/10). Les défis par lien, les défis entre amis, les problèmes et les leçons non plus.
- **Une seule cote** pour 9 × 9, 13 × 13 et 19 × 19.
- **Calculée par le serveur**, jamais par le client : `apply_game_rating` (fonction `security definer`, `search_path` vide, fermée à l'app), appelée par `resign_game` (abandon) et `finish_game_by_score` (fin aux points, via la fonction serveur `game-action`). Une partie ne compte qu'une fois. Le client ne peut écrire ni la cote ni son historique (droits de colonnes et RLS).
- **Provisoire** : affichée « 1200 ? » tant que l'écart de confiance (RD) dépasse 110, soit environ 10 premières parties classées (8 à 13 selon les adversaires).
- **Départ** choisi par le joueur (compte avec pseudo), une seule fois : modifiable jusqu'à sa première partie classée comptée, puis figé par le serveur (`choisir_depart_cote`, refus `JGR01`). Refusé aussi pendant une partie classée en cours (`JGR03`). Sans choix, le départ est 800.

| Choix | Cote de départ | Grade |
|---|---|---|
| Je découvre | 300 | 27ᵉ kyu |
| Je connais les règles | 800 | 22ᵉ kyu |
| Je joue en club | 3000 − 100 × kyu, du 25ᵉ kyu (500) au 1ᵉʳ dan (3000) | grade choisi |

Le départ ne change pas l'écart de confiance : RD 350, volatilité 0,06. Une erreur de départ se corrige donc vite.

- **Problèmes et leçons** : inchangés. Aucune cote affichée (décision #137, `src/app/sansCote.test.ts`). `puzzle_rating` et `cotes_a_mesure` ne bougent pas.

## Barème

100 points = 1 grade. **cote = 3000 − 100 × kyu.** Chaque grade couvre 100 points, borne basse comprise.

| Cote | Grade |
|---|---|
| 0 à 99 (et moins) | 30ᵉ kyu |
| 300 | 27ᵉ kyu |
| 800 | 22ᵉ kyu |
| 1500 à 1599 | 15ᵉ kyu |
| 2900 à 2999 | 1ᵉʳ kyu |
| 3000 à 3099 | 1ᵉʳ dan |
| 3800 et plus | 9ᵉ dan (plafond affiché) |

Fonction pure : `gradeDe` dans `src/go/cote.ts` (tests : `src/go/cote.test.ts`).

## Glicko-2

Glickman, « Example of the Glicko-2 system » (2013). Chaque partie est une période de classement : chaque joueur est mis à jour contre la cote et le RD **d'avant-partie** de l'autre (victoire 1, défaite 0 ; une partie classée ne peut pas être nulle avec un komi de 6,5).

| Constante | Valeur | Rôle |
|---|---|---|
| Échelle | 173,7178 (= 400 / ln 10) | passage cote ↔ échelle Glicko-2 |
| RD de départ, et plafond | 350 | joueur inconnu |
| RD minimal | 50 | la cote garde du mouvement |
| Volatilité de départ | 0,06 | |
| τ | 0,5 | contrainte sur la volatilité |
| ε (Illinois) | 0,000001 | précision du calcul de la volatilité |
| Seuil de provisoire | RD > 110 | « 1200 ? » |
| Absence | +1 période tous les 30 jours sans partie classée | RD = √(RD² + n·σ²), plafond 350 |
| Bornes de la cote | 0 à 4000 | |

Arrondis du serveur, repris à l'identique par `partieClassee` (`src/go/cote.ts`) : cote entière, RD au centième, volatilité au millionième. Valeurs de référence vérifiées des deux côtés (`src/go/cote.test.ts` et `supabase/tests/cote_glicko.test.sql`) :

- exemple de Glickman : 1500 / RD 200 → 1464,05 / RD 151,52 / σ 0,05999 ;
- deux nouveaux (800, RD 350) : le gagnant passe à 962, le perdant à 638, RD 290,32 (± 162) ;
- joueur sûr (1500, RD 80) contre provisoire (962, RD 290) : 1503 (+3) et 942 (−20).

**Joueurs déjà classés avant #417** (ancienne cote Elo, K = 32) : leur cote est gardée comme point de départ, avec RD = max(110, 350 − 25 × parties classées). Rien n'est supprimé.

## Appariement

`find_match` apparie par la cote Glicko-2 : écart accepté = 100 + √(RD₁² + RD₂²) / 2 + 10 par seconde d'attente ; le plus proche en cote d'abord, puis le plus ancien dans la file. Deux nouveaux : environ 350 points ; deux joueurs sûrs (RD 60) : environ 140 points.

Depuis #360 (`docs/game-design/partie-en-direct.md`, migration `20261004180100_partie_en_direct.sql`), `find_match` apparie aussi par taille, temps de jeu et comptage, compte l'attente la plus longue des deux, et crée la partie classée en direct avec sa pendule tenue par le serveur. La perte au temps compte comme une défaite (`apply_game_rating`) ; une partie annulée avant que chacun ait joué ne compte pas.

## Affichage

- **Profil** : ligne « Ta cote » (grade et cote, ou « Choisis ton départ »), à côté du placement. Sous-vue : la cote en grand, le grade, « ? » expliqué, la courbe des 30 derniers jours (parties classées et départ), le choix du départ tant qu'il est possible. Kyu et dan expliqués la première fois en une phrase (`go.cote-vocabulaire.v1`).
- **Fin de partie classée** : « +14 » qui défile (fixe avec les mouvements réduits), la nouvelle cote et le grade. Au changement de grade : « Tu passes 14ᵉ kyu ! », avec des confettis si les célébrations sont activées et les mouvements non réduits. En descente : « Tu repasses 15ᵉ kyu. Ça remonte vite. », sans drame.
- **Carte de l'adversaire** (partie classée) : son grade et sa cote sous son nom.
- Textes : `src/content/i18n/cote.ts` (FR, EN), chargés avec le Profil et l'écran de partie, hors du JS initial.

## Étape 2 : titres mensuels (issue séparée, plus tard)

Chaque mois, un titre selon le rang en pourcentage parmi les joueurs actifs du mois (au moins 10 parties classées), avec les 9 grades historiques du go, du plus haut au plus bas :

| Rang | Titre |
|---|---|
| 9 | Nyūshin (入神) |
| 8 | Zashō (坐照) |
| 7 | Gutai (具体) |
| 6 | Tsūyū (通幽) |
| 5 | Yōchi (用智) |
| 4 | Shōkō (小巧) |
| 3 | Tōryoku (闘力) |
| 2 | Jakugu (若愚) |
| 1 | Shusetsu (守拙) |

Affichés seulement à partir d'environ **200 joueurs actifs** : en dessous, un top % n'a pas de sens. Les seuils de pourcentage restent à fixer (à mesurer sur la distribution réelle des cotes).
