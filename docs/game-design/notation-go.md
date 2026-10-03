# Notes des coups, version go (revue v3, #405)

Demande de Florian : « différents niveaux de notations, adaptés au jeu de go ». Modèle : la revue de chess.com
(Brillant, Meilleur, Erreur, Coup manqué, Gaffe…), revue avec la logique de l'enseignement du go.

Code : `src/app/revue.ts` (perte en points, seuils), `src/app/notation.ts` (notes propres au go, coups clés),
`src/app/parcours.ts` (phrases de Mochi). Tests : `src/app/notation.test.ts`, `e2e/revue-bilan.spec.ts`.

## Règle d'or

Aucune note fausse. Dans le doute, on ne note pas, ou on donne la note la plus prudente. Sans KataGo (moteur simple),
l'échelle est réduite : ni Brillant, ni Meilleur coup, ni Excellent, ni Bon, ni Coup manqué. Le bilan le dit en une ligne.

## La mesure : les points perdus

Chaque coup est jugé par les points qu'il perd face au meilleur coup.
- Avec KataGo : perte = avance du premier candidat − avance du coup joué, tirées de la même recherche (32 visites,
  au moins 8 visites par candidat). C'est bien moins bruité que la différence entre deux analyses.
- Sans KataGo : chute de l'estimation du moteur simple, lissée (médiane sur 3 positions), plus petite des deux mesures.

## Seuils selon la taille du plateau

Seuils de base (9 × 9), multipliés par le facteur de taille f = √(taille / 9) : 9 × 9 → 1 ; 13 × 13 → 1,2 ; 19 × 19 → 1,45.
Un coup vaut plus de points sur un grand plateau, mais moins que proportionnellement au côté : un coup d'ouverture
vaut environ 12 points en 9 × 9 et environ 20 en 19 × 19 (rapport proche de 1,5). Un facteur linéaire (2,1 en 19 × 19)
rendrait le grand plateau trop indulgent : une perte de 10 points y serait encore une simple « Erreur ».

| Note | Avec KataGo (9 × 9) | 19 × 19 | Sans KataGo (9 × 9) |
| --- | --- | --- | --- |
| Meilleur ★ | premier choix de KataGo | idem | non |
| Excellent ! | perte ≤ 0,5 | ≤ 0,7 | non |
| Bon ✓ | ≤ 1,5 | ≤ 2,2 | non |
| Solide ✓ | non | non | ≤ 2,5 |
| Imprécision ?! | ≤ 3 | ≤ 4,4 | ≤ 4 |
| Erreur ? | ≤ 6 | ≤ 8,7 | ≤ 8 |
| Gaffe ?? | > 6 | > 8,7 | > 8 |

La précision d'un joueur (pourcentage, jamais une cote) : 100 / (1 + m / 4), où m est sa perte moyenne par coup,
ramenée au 9 × 9 (divisée par f) et plafonnée à 12 points par coup. Elle reste plafonnée par le score final après
une défaite nette (revue honnête, `docs/game-design/revue-honnete.md`).

## Les notes propres au go

Ordre d'application : passe, Brillant, Forcé, Classique, Gaffe par groupe pris, Coup manqué.

- **Classique ≡** (le « coup théorique » des échecs) : dans l'ouverture (8 premiers coups en 9 × 9, 14 en 13 × 13,
  24 en 19 × 19), un coup qui perd peu (≤ seuil Bon avec KataGo, ≤ Solide sans lui) et qui est :
  - un point de coin dans un coin encore vide : 3-3 (san-san), 3-4 (komoku), 4-4 (hoshi), 3-5 (13 × 13 et 19 × 19),
    4-5 (19 × 19), ou le centre (tengen) en 9 × 9 ;
  - une approche (kakari) : une seule pierre adverse dans le coin, aucune à soi, à 2 à 4 lignes d'elle (jamais collée),
    sur la 3e ou la 4e ligne d'un côté, au plus la 6e de l'autre (ex. C6 sur un 4-4 en D4) ;
  - une fermeture (shimari) : une seule pierre à soi dans le coin, aucune adverse, la 2e à 2 à 4 lignes d'elle.
  Mochi explique le point en une phrase et ce qu'est un joseki (une suite de coups connue, juste pour les deux camps).
  Les joseki plus longs ne sont pas reconnus : sans base de joseki vérifiée, on ne prétend pas en voir.
- **Forcé →** : le coup adverse précédent a mis une de tes chaînes d'au moins 2 pierres en atari, et ton coup la
  sauve (elle a au moins 2 libertés ensuite), en prolongeant, en reliant ou en prenant les pierres qui la menaçaient.
  Le coup doit perdre peu. Une pierre seule ne compte pas : l'abandonner est souvent juste. Lu sur le plateau, donc
  fiable aussi sans KataGo.
- **Coup manqué ×** (KataGo seulement) : l'adversaire vient de faire une Erreur ou une Gaffe, et ton coup perd encore
  des points (Imprécision ou Erreur). Mochi dit ce qu'il fallait faire ; si le meilleur coup prenait des pierres,
  il le dit (« En E3, tu prenais 2 pierres »). Une Gaffe reste une Gaffe.
- **Gaffe ??** : perte au-delà du seuil d'Erreur, ou une Erreur suivie de la prise d'au moins 3 de tes pierres
  (un groupe qui meurt).
- **Brillant !!** (KataGo seulement, toujours confirmé par une analyse cinq fois plus longue) :
  - soit un coup hors du top 3 de KataGo qui fait mieux que son premier choix d'au moins 1 point (#71) ;
  - soit le seul bon coup : premier choix de KataGo, le deuxième candidat perd au moins le seuil d'Erreur, la partie
    n'est pas jouée (avance < 15 points ramenés au 9 × 9), et ce n'est pas un coup évident (ni ouverture, ni prise,
    ni réponse forcée). Mochi dit si c'est un sacrifice (le coup se met en atari), un tesuji (il touche une chaîne
    adverse à 2 libertés ou moins) ou un point vital.
- **Passe trop tôt** : une passe qui perd au moins le seuil d'Imprécision. La passe de fin de partie, quand il ne
  reste rien à prendre, n'est jamais notée comme une erreur.

## Les coups clés du parcours

Mochi ne commente pas les 80 coups. Pour toi : Brillant, Erreur, Coup manqué, Gaffe, passe trop tôt, tes 2 premiers
coups Classiques, 3 de tes Meilleurs coups ; pour l'adversaire, ses Gaffes (ce qu'il fallait punir) ; et le moment clé
(#186). Moins de 3 coups clés : tes Imprécisions complètent. Au plus 12 : on retire d'abord les Meilleurs coups, puis
les Classiques, puis les Gaffes adverses, puis les plus petites pertes.

Sur tes Erreurs, Coups manqués et Gaffes rejouables, le bon coup reste caché jusqu'à un essai (« Rejoue cette
erreur ») ou « Voir le bon coup » (#77) : chercher soi-même d'abord.

## Proverbes de l'écran d'attente

Citations réelles, en français et en anglais (`src/content/i18n`, clés `proverbe.*`) :
1. « Le point vital de ton adversaire est ton point vital » : proverbe japonais 敵の急所は我が急所.
2. à 5. Wang Jixin, « Dix règles d'or du go » (圍棋十訣, dynastie Tang, VIIIe siècle) : 不得貪勝 (le joueur avide ne
   gagne pas), 棄子爭先 (sacrifie des pierres pour garder l'initiative), 捨小就大 (laisse le petit, prends le grand),
   攻彼顧我 (attaque l'adversaire, mais regarde d'abord tes pierres).
6. « Coin d'or, bord d'argent, centre d'herbe » : proverbe chinois 金角银边草肚皮.
7. « Apprends les joseki par cœur, tu perds deux pierres de force » : senryū japonais 定石を覚えて二目弱くなり.
8. « Perds tes cinquante premières parties au plus vite » : proverbe des joueurs de go occidentaux (Sensei's Library,
   « Lose your first 50 games as quickly as possible »).
