# Répertoire d'ouvertures (#591), octobre 2026

Une page « Ouvertures » dans Apprendre : fuseki (début de partie) et joseki (suites de coups dans un coin), pour
débutants. Règle de Florian : aucun conseil de go faux. Chaque coup montré comme bon est prouvé par KataGo, chaque erreur
courante est réfutée par KataGo.

## Sources et méthode

- Contenu : `src/content/ouvertures.ts` (séquences en SGF, erreurs courantes), textes FR et EN dans
  `src/content/i18n/ouvertures.ts`, lecture du SGF dans `src/go/ouvertures.ts`.
- Lignes de départ : les bases classiques enseignées aux débutants (le centre en 9 × 9 ; coins, puis bords, puis centre ;
  approche et invasion du hoshi ; approche du komoku). Chaque ligne a ensuite été passée au crible de KataGo coup par coup ;
  aucune n'est reprise d'un livre sans ce contrôle. Là où KataGo préfère une autre suite que la ligne classique, c'est sa
  suite qui est montrée, ou la ligne est retirée.
- Outil : le même que les leçons d'ouverture l29 à l31 et l47 à l49 (#16, #553), sans second système.
  `outils/preuvesKataGo.ts` a un mode `ouvertures` ; `src/go/preuvesKataGo.ts` dit quoi juger (`positionsDOuverture`).
- Commande : `npm run fetch-model`, puis
  `TFJS_NODE_DIR=<dossier de @tensorflow/tfjs-node> npm run preuves-katago -- ouvertures` (deux processus en parallèle,
  45 minutes sur 4 cœurs). Les preuves sont figées dans `src/go/preuves-ouvertures.json`.
- Réglages (ceux de #553) : réseau g170-b6c96-s175395328-d26788732 (celui de l'appli), komi 6,5, règle japonaise,
  800 visites à la racine, 400 après chaque coup jugé, quatre symétries du plateau analysées chacune à part.
- Contexte : chaque position est jugée sur le plateau entier. En 19 × 19, les joseki se jouent dans le coin bas gauche,
  les autres coins étant déjà occupés (pierres de départ) ; l'écran ne montre que le coin, comme l30 et l31.
- Test : `src/go/ouvertures.test.ts` rejoue le jugement depuis la fixture, sans le modèle (moins d'une seconde, aucun
  bloc synchrone long, #586). Il vérifie aussi la légalité de chaque séquence, erreur et réplique avec `src/go`.

## Seuils

- **Coup de la séquence** (Noir comme Blanc) : il perd au plus **1,5 point** (`TOLERANCE_DEMO`, comme les démonstrations
  des leçons) face au meilleur coup jugé dans la position juste avant lui : le coup lui-même, ses erreurs, et les trois
  premiers coups de la racine dans chaque symétrie. Moyenne des quatre symétries.
- **Erreur courante** : elle perd au moins **2 points** de plus que le coup qu'elle remplace (`MARGE`), et au moins 1 point
  dans chaque symétrie. Le coût affiché est cet écart, arrondi. La réplique montrée est celle de KataGo dans les quatre
  symétries ; si elles ne sont pas d'accord, aucune réplique n'est montrée.
- **« … peut jouer ailleurs »** n'est dit que si la réplique de KataGo après le dernier coup est hors du coin montré,
  dans chaque symétrie.

## Le premier lot : 8 entrées

Pertes : écart au meilleur coup jugé, en points, moyenne des quatre symétries.

| Entrée | Séquence | Perte max | Erreurs courantes (coût, réplique) |
| --- | --- | --- | --- |
| 9 × 9 Le centre d'abord | E5, C5, D4, C4, D6 | 0,22 | B2 au 1er coup (7, F6) ; C3 au 3e (2, D4) ; C6 au 5e (3, D6) |
| 9 × 9 Les quatre coins | D4, F6, F4, D6 | 0,75 | C2 au 1er coup (3, F6) ; E2 au 3e (3, C6) |
| 19 × 19 Les coins d'abord | Q16, D4, Q4, D16 | 0,20 | K10 au 1er coup (4) ; K10 au 3e (3) |
| 19 × 19 Puis les bords | Q10 (les quatre hoshi pris) | 0,70 | K10 (2) |
| Hoshi : l'approche | F3, D6, D2, C3, J3 | 0,86 | F2 au 2e coup (2, E3) |
| Hoshi : l'invasion au 3-3 | C3, C4, D3, E4, F3 | 0,05 | D5 au 2e coup (3, D3) ; C2 au 2e (4, D3) |
| Komoku : le tsuke | C4, E3, D3, E4, D6 | 0,21 | C3 au 3e coup (4) ; E5 au 5e (9, D4 : la coupe) |
| Komoku : le kosumi | C4, E3, D5, H3 | 0,21 | B5 au 3e coup (4) |

Le pire écart d'un coup montré est 0,86 point (l'approche F3 : KataGo préfère l'invasion du coin d'en face, C17). Après
le dernier coup de « l'approche » et de « l'invasion au 3-3 », KataGo joue ailleurs dans les quatre symétries : l'écran
le dit.

## Écarté, et pourquoi

Crible rapide (2 symétries, 400 puis 200 visites) avant les preuves complètes :

- **Le 3-3 comme premier coup en 9 × 9** (C3) : 1,9 point de moins que le meilleur coup. Il ne passe pas le seuil de
  1,5 ; il n'est pas non plus assez mauvais (moins de 2 points de plus que le 4-4) pour être montré comme erreur. Le
  9 × 9 n'enseigne que le centre et le 4-4. Le 3-4 (C4, D3) passe (1,1) mais n'apporte rien de plus au premier lot.
- **Le glissement au 3-3 après l'approche du hoshi** (C3 de Blanc après F3 et D6) : 1,7 point de moins que le meilleur.
  Le glissement montré est celui que KataGo garde : D2, sur la 2e ligne (0,4).
- **Le glissement au 3-3 après une pince** (F3, H3, puis C3) : 1,9 point. La pince n'est pas montrée (la suite que
  KataGo préfère, D3 au contact, est trop riche pour ce lot).
- **La réponse en cavalier à l'approche** (C6) : 1,2 point au crible, dans le seuil mais sans marge ; le saut d'un pas
  D6 (0,7 à la preuve) est montré à sa place.
- **Fermer le coin du komoku en cavalier** (E3, kogeima shimari) : 1,5 point dans la position d'essai, à la limite ;
  non montré. KataGo y préfère le saut d'un pas (E4).
- **Erreur E4 contre l'approche** (collée au hoshi, « Blanc glisse en D2 ») : 1,7 point de plus seulement que D6, sous
  la marge de 2 points. Retirée ; F2 (2,4 points) reste.
- **Erreurs C2, E2 et D3 après le glissement** : entre 1,5 et 1,7 point de plus que C3, sous la marge. Non montrées.
- **Continuer le 3-3 par la coupe moderne** (E3, puis E2 et la coupe D2) : chaque coup passe, mais la suite mène à un
  combat trop long pour un débutant ; la ligne E4, F3 (0,0 partout) est gardée.

## Ce qui reste

- Un lot 2 : la pince du hoshi, le komoku et sa fermeture, le 13 × 13.
- Placer la ligne « Ouvertures » dans le chapitre « L'ouverture » plutôt qu'en bas du chemin, une fois #589 et #590
  fusionnés (ils modifient `Learn.tsx` en parallèle ; l'ajout de #591 y est volontairement réduit à une ligne).
