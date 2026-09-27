# Direction artistique v2 : « le goban sous la lampe »

Demande de Florian (27/09) : un design plus profond, qui donne envie, au niveau de chess.com. Ce document fixe la direction. Les maquettes de référence sont `maquettes-v2.png`, et le prototype interactif `prototype.html` (à ouvrir dans un navigateur).

Méthode suivie, avec les skills du projet :
1. `design-critique` sur les écrans actuels (planche `avant-sombre.png`).
2. Étude de chess.com, OGS, KaTrain, BadukPop et Duolingo, faite par l'agent de recherche et appuyée sur le code open source d'OGS et de KaTrain.
3. `frontend-design` en deux passes : un plan, puis une revue contre les rendus génériques.

## 1. Diagnostic de la v1

| Constat | Pourquoi c'est un problème |
|---|---|
| Fond bleu nuit froid, avec un seul accent vert vif | C'est le rendu par défaut des interfaces générées (skill `frontend-design`, trait n° 2), et il n'a rien à voir avec le go. |
| En mode clair : fond crème et titres en serif | Même problème (trait n° 1). |
| Le même type de carte arrondie grise partout, avec des libellés « A · B » | C'est le « kit de cartes SaaS » (traits n° 4 et 5) : rien ne hiérarchise l'écran. |
| Accueil vide à 60 %, sans image | Rien ne donne envie de jouer. Chez chess.com, le plateau est l'image d'accueil. |
| Plateau en dégradé plat, pierres sans matière, anneau rouge pour le dernier coup | Ce qui rend chess.com et Tygem désirables est **sensoriel** : la matière, le son, le toucher. |
| Adversaires sans visage, liste qui déborde | Les bots de chess.com ont un portrait, une bio et des répliques. |
| Aucun son, aucune célébration | Chess.com a 12 sons, OGS a 5 claquements par couleur et des captures qui tombent sur le tas. |

## 2. L'idée

On joue la nuit, sous une lampe, sur un vrai goban. Le fond est de l'encre chaude, le plateau en kaya est la seule chose éclairée, les pierres ont leur matière (ardoise, coquillage) et claquent. Les adversaires sont des personnages signés d'un sceau (hanko) vermillon.

**La seule audace : le goban.** Il est l'image d'accueil, il occupe toute la largeur en partie, et il a une matière, un son et un toucher. Tout le reste reste calme et discipliné.

## 3. Jetons

### Couleurs (mode sombre, par défaut)

| Nom | Hex | Rôle |
|---|---|---|
| Sumi (encre chaude) | `#1C1916` | Fond, avec un halo de lampe doré tout en haut |
| Surface | `#27221E` | Tuiles, barre du coach |
| Surface 2 | `#332D28` | Coup courant, avatar |
| Papier | `#F3EDE3` | Texte, bulles |
| Brume chaude | `#A99F92` | Texte secondaire |
| Jade | `#3CC48E`, bord `#1E8A5F` | Action principale, en relief (ombre dure de 5 px) |
| Or | `#EFB84A` | Série, récompenses, bilan |
| Hanko | `#D2432C` | Sceaux des adversaires, tampon « BATTUE » |
| Kaya | `#EDC27A` → `#C58D42` | Plateau, avec un veinage procédural |

Le mode clair (« Papier ») reprend les mêmes rôles sur un fond de washi `#EFE8DC`, avec des titres en sans-serif et non plus en serif.

### Typographie
- **Titres et chiffres** : Bricolage Grotesque, graisses 700 et 800, interlettrage −0,02 em. Elle est chaleureuse, franche et joueuse, dans l'esprit de « Chess Sans » en 800, et reste loin des serifs par défaut.
- **Texte** : Zen Kaku Gothic New, 400, 500 et 700 (déjà en place).
- Les deux polices sont servies par l'app elle-même via `@fontsource`, et non plus par Google Fonts. Elles marchent ainsi hors ligne dans la PWA, et plus rien ne part vers un tiers (RGPD).
- Espaces insécables avant `? ! :`.

### Relief et forme
- **Un seul élément en relief par écran** : le bouton principal, avec une ombre `0 5px 0` qui s'enfonce à l'appui. Même principe chez chess.com (`#45753C` sous `#81B64C`) et Duolingo.
- Les tuiles n'ont pas de bordure. Une tuile secondaire « à faire plus tard » a une bordure en pointillés.
- Rayons : 16 px pour les boutons et tuiles, 10 px pour le plateau, 999 px pour les pastilles.

## 4. Le goban (priorité n° 1)

- **Bois** : kaya, avec un veinage fin et un veinage large (deux couches de bruit fractal), un vignettage, un chanfrein clair, une tranche foncée et une ombre portée sur la table.
- **Pierres noires** : ardoise mate, reflet discret en haut à gauche, rayon plus grand de 0,7 % (les vraies pierres noires sont plus larges de 0,3 mm).
- **Pierres blanches** : coquillage avec stries. **10 variantes** tirées selon l'intersection, pour qu'aucune pierre ne ressemble à sa voisine (comme OGS).
- **Irrégularité** : chaque pierre est légèrement décalée (jusqu'à 1 px) selon l'intersection, comme sur un vrai goban.
- **Ombre portée** : floue, décalée vers le bas à droite.
- **Dernier coup** : un anneau clair sur une pierre noire, foncé sur une pierre blanche (comme OGS). Plus de vermillon.
- **Coordonnées** : petites, brun à 55 %, en haut et à gauche.
- **Performance** : le bois est rendu une seule fois (image mise en cache). Les pierres utilisent des symboles SVG réutilisés, sans filtre recalculé à chaque coup.

## 5. Son, toucher, mouvement

| Moment | Son | Mouvement | Vibration (Android ; iOS avec Capacitor) |
|---|---|---|---|
| Poser une pierre | Claquement boisé, 4 variantes aléatoires, hauteur ±3 %, légèrement placé à gauche ou à droite selon la colonne | La pierre « tombe » : échelle 1,12 → 1 et ombre qui grandit, 140 ms, `cubic-bezier(.2,.8,.3,1.2)` | 12 ms |
| Coup de l'adversaire | Claquement plus sourd, pour savoir sans regarder que c'est à toi | Idem | — |
| Capture | Pierre qui tombe sur le tas, un son par taille (1, 2, 3 et plus) | Les pierres prises s'effacent et partent vers le couvercle, 30 ms de décalage entre elles ; le couvercle pulse | `[20, 40, 20]` |
| Atari sur ton groupe | Ton d'alerte doux | Les libertés restantes clignotent une fois | — |
| Coup interdit (ko, suicide) | « Tok » sourd | La pierre fantôme tremble (3 × 4 px) | 30 ms |
| Victoire | Petit carillon | Confettis de 1,5 s (jade, or, hanko, papier), tampon « BATTUE » qui s'imprime, chiffres qui défilent en 600 ms | `[30, 60, 30]` |
| Problème réussi ou raté | Deux notes montantes, ou une note descendante | Coche qui se dessine | — |

**Choix techniques :**
- Les sons sont **synthétisés en Web Audio** (bruit filtré et résonance courte, comme web-katrain). Il n'y a pas de fichier sous licence à gérer.
- Le contexte audio démarre au premier toucher.
- Un réglage « Sons » et un réglage « Célébrations » se trouvent dans Profil.
- Avec `prefers-reduced-motion`, il n'y a ni confettis ni chute de pierre : l'état final s'affiche directement.

## 6. Écrans

### Accueil
- **Plateau recadré** : il sert d'image d'accueil. Une pierre fantôme pulse au centre, et un toucher sur le plateau lance la partie.
- **Sceau et bulle** : le sceau de l'adversaire et sa bulle (« Touche le centre pour poser ta première pierre ! »).
- **Nom** de l'adversaire en grand, avec une phrase de personnage.
- **Réglage** : « Plateau 9 × 9, tu as Noir », puis « Changer ».
- **Bouton en relief** « Jouer contre Pomme ».
- **Deux tuiles de nature différente** :
  - le problème du jour, avec une miniature ;
  - la leçon suivante, en pointillés.
- La **flamme de série** est en haut à droite.

### Partie (grammaire de chess.com)
- **Adversaire** : sceau, nom, rang et bulle de réplique, avec les pierres capturées dans un couvercle en bois.
- **Liste des coups** qui défile (8. D6, 9. G6…), coup courant en surbrillance.
- **Barre d'avantage** noir/blanc, avec son libellé (« Noir +3,5 »), alimentée par KataGo.
- **Goban** sur toute la largeur.
- **Toi** : initiale, cote, couvercle.
- **Coach Mochi** : une phrase à la fois, qui remplace la ligne de message grise.
- **Barre d'actions** avec icônes : Indice, Annuler, Passer, Abandonner.

### Fin de partie
- **Fond** : le plateau final avec les territoires, sous un voile.
- **Sceau** de l'adversaire, avec le tampon « BATTUE » qui s'imprime.
- **« Victoire »** en Bricolage 800, 56 px.
- **Bilan en une phrase**.
- **Mochi** tire la leçon de la partie en une phrase.
- **Bouton en relief** « Défier Caillou », avec le sceau de Caillou.
- **Lien** « Revoir ma partie » (#34).

### Adversaires : 9 sceaux
Chaque adversaire a un sceau vermillon avec son pictogramme dessiné à l'encre :

| Adversaire | Pictogramme |
|---|---|
| Pomme | Pomme |
| Caillou | Galet |
| Bambou | Tiges |
| Renard | Oreilles et museau |
| Rivière | Vagues |
| Tigre | Rayures |
| Montagne | Sommets |
| Dragon | Écaille et griffe |
| Sensei | Éventail |

Le sceau porte une texture de tampon. Sélection :
- un carrousel horizontal remplace les boutons qui débordaient ;
- l'adversaire suivant est verrouillé tant que le précédent n'est pas battu, mais reste visible, en grisé avec un cadenas ;
- un adversaire battu porte un tampon « BATTU ».

Mochi garde son sceau jade. Il encourage et explique, il ne joue pas.

## 7. Revue contre les défauts génériques

| Risque | Décision |
|---|---|
| Fond sombre avec un accent unique | Le fond est une **encre chaude** (brun, pas bleu) éclairée par un halo de lampe. Trois couleurs ont chacune un sens : le jade pour agir, l'or pour les récompenses, le hanko pour les adversaires. Le sujet (bois, pierre, sceau) porte l'identité, pas l'accent. |
| Serif de prestige | Abandonné pour Bricolage Grotesque, plus joueuse. |
| Kit de cartes identiques | Supprimé : tuiles de nature différente, bilan en phrase, barres sans cadre. |
| Libellés « A · B », majuscules d'étiquette, flèches → | Supprimés. Seule exception : « BATTUE » en majuscules, parce que c'est le texte d'un tampon. |
| Animations partout | Il n'y a de mouvement qu'en réponse à un geste (poser, capturer), plus un seul moment orchestré : la victoire. |

## 8. Plan de livraison

Une PR par phase. Chaque PR a son aperçu Vercel, à tester sur iPhone avant fusion.

1. **Goban v2** : bois, pierres, ombres, dernier coup, chute de pierre, captures, sons et vibration, réglage Sons.
2. **Jetons v2** : palette sumi, polices auto-hébergées, bouton en relief, halo de lampe, mode Papier.
3. **Écran de partie** : sceaux, couvercles, liste des coups, barre d'avantage, coach, barre d'actions.
4. **Accueil et carrousel des adversaires** : 9 sceaux, verrouillage, plateau d'accueil qui se touche.
5. **Fin de partie et célébrations** : tampon, confettis, compteurs, réglage Célébrations.
6. **Apprendre et Problèmes** : chemin de pierres dessiné, problème du jour mis en scène.
