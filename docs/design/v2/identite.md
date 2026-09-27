# Identité « deux pierres » (issue #51)

Retour de Florian :
- il aime le logo aux deux pierres ;
- il trouve les icônes du bas fades ;
- il veut que chaque élément ait son identité, et que tout soit relié.

Ce document fixe la grammaire qui relie l'app, à partir du logo.

- Planche : `identite.png`, régénérée par `npx vite-node scripts/planche-identite.tsx`.
- Captures 390 × 844 : `captures/nav-*.png`.
- Code :
  - `src/ui/IconesNav.tsx` : icônes et barre ;
  - `src/ui/Reflexion.tsx` : indicateur d'attente ;
  - `src/ui/nav.css` : styles et mouvement ;
  - `src/ui/onglets.ts` : liste des onglets ;
  - jetons `--onglet-*`, `--icone-nav`, `--ease-pose` et `--duree-pose` dans `tokens.css`.

## 1. La cellule de base : le logo

Le logo est fait d'une pierre noire devant et d'une pierre blanche derrière, qui se touchent. C'est la plus petite image du go : deux joueurs, un contact.

Tout le reste se construit avec deux éléments seulement :

| Élément | Dessin |
|---|---|
| **Pierre** | Un disque. La noire est en ardoise, la blanche en coquillage. Le reflet est en haut à gauche : la lampe éclaire toujours du même côté, même quand la pierre tourne. Les dégradés sont ceux du goban (`Board.tsx`). |
| **Trait de grille** | Une ligne du goban. Le bord du plateau fait 1,5 px, une ligne intérieure 1 px à 55 %. |

## 2. Icônes de la barre du bas

Grille de 28 × 28. Les formes pleines touchent presque le bord, pour que les icônes aient du poids, comme celles de chess.com.

| Onglet | Dessin | Pièce d'accent (active) | Pourquoi cette couleur |
|---|---|---|---|
| **Jouer** | Le logo : noire devant, blanche derrière | Une onde jade autour de la noire | Le jade, c'est agir : le bouton principal, et l'onde de la pierre fantôme de l'accueil (« à toi de jouer »). |
| **Apprendre** | Trois pierres sur une route qui serpente et monte, jusqu'à la noire, le but | La route pointillée devient or | L'or marque la progression et les récompenses. La route reprend le chemin des leçons. |
| **Problèmes** | Un coin de goban : la blanche est en atari, entourée de deux noires | Le point vital marqué d'un disque hanko | Le hanko est la couleur de l'adversaire à battre, et des cercles rouges des problèmes. |
| **Profil** | Ta pierre et ton sceau, posé de travers comme un tampon | Le sceau devient indigo | L'indigo est la deuxième encre des sceaux (`Sceau.tsx`). On n'a pas pris le vermillon, pour deux raisons : il est déjà celui de Problèmes, et il est réservé aux adversaires. Ton sceau est à toi. |

### États

| État | Rendu |
|---|---|
| **Inactif** | Encre brume (`--muted`), sans couleur. La pierre noire est pleine, la blanche en contour de 1,5 px, vide de la couleur de la barre. Un liseré de la couleur de la barre sépare deux formes qui se chevauchent. |
| **Actif** | Les pierres prennent leur matière : dégradé, reflet, ombre portée. Sur fond sombre, la noire a un liseré de lune (`--pierre-n-bord`). Une seule pièce d'accent. Le libellé est en gras, couleur texte. Un point de 5 px de la couleur de l'onglet apparaît sous le libellé. |
| **Appui** | L'icône se réduit à 92 % en 100 ms, sans décaler la mise en page. |
| **Activation** | La pierre « tombe » : échelle 1,15 → 1 en 160 ms, avec la courbe de la pose sur le goban (`--ease-pose`, la même que `go-chute`). Le point grandit en même temps. |

### Couleurs par onglet (jetons `--onglet-*`)

| Jeton | Sombre (Encre) | Clair (Papier) | Contraste sur la barre (sombre / clair) |
|---|---|---|---|
| `--onglet-jouer` | jade `#3CC48E` | jade foncé `#1E8A5F` | 8,3 / 3,9 |
| `--onglet-apprendre` | or `#EFB84A` | or brûlé `#A0680A` | 10,2 / 4,2 |
| `--onglet-problemes` | hanko `#D2432C` | hanko `#D2432C` | 4,0 / 4,1 |
| `--onglet-profil` | indigo éclairé `#8FA6E6` | indigo `#2F4B8A` | 7,7 / 7,6 |

Tous dépassent 3:1 (WCAG 1.4.11, élément graphique) : c'est vérifié par `tokens.test.ts`.

Le fond du sceau reste `#2F4B8A` dans les deux modes. Sur la barre sombre, son cadre papier le détache.

### Accessibilité

- Les boutons gardent leur libellé visible (Jouer, Apprendre, Problèmes, Profil). L'icône et le point sont `aria-hidden`.
- L'onglet courant porte `aria-current="page"`. L'état ne repose pas que sur la couleur : il se lit aussi au libellé en gras, aux pierres en matière et au point.
- Chaque bouton fait 60 px de haut et au moins 44 px de large.
- Mouvements réduits : pas de chute, pas d'enfoncement. L'état actif s'affiche directement.

## 3. Déclinaisons

| Où | Quoi |
|---|---|
| **Attente** (`Reflexion`) | Le logo qui tourne : la noire et la blanche, qui se touchent, tournent l'une autour de l'autre (un tour en 1,1 s, linéaire). Chaque pierre tourne aussi sur elle-même, en sens inverse, pour garder son reflet en haut à gauche. En mouvements réduits, rien ne tourne : les deux pierres s'allument l'une après l'autre (fondu). On le voit dans la barre du coach quand l'adversaire réfléchit (« Pomme réfléchit… »), et pendant le chargement des problèmes. |
| **Icône de l'app et favicon** (`public/icon.svg`, `icon-192.png`, `icon-512.png`) | Le logo en grand sur l'encre, sous le halo de la lampe, avec une grille de kaya à peine visible. L'ancienne icône verte de la v1 est remplacée. Les pierres restent dans la zone sûre des icônes masquables (cercle de 80 %). Pour régénérer les PNG : `npm run icons`. |
| **Ornement de titre** (`.titre-pierres`) | Le logo en petit (11 px) devant les titres de section : Problème du jour, Les bases, Bientôt. Il relie les écrans à l'en-tête. |
| **États vides** | Il n'y en a pas de vrai aujourd'hui : les problèmes de base sont toujours là, hors ligne compris, et l'accueil a toujours une action. Le jour où il y en aura (aucune partie en ligne, par exemple), on posera une pierre blanche seule sur un coin de grille. |

## 4. Règles d'usage

1. **Une seule pièce d'accent par icône.** L'accent dit ce que fait l'onglet, il ne décore pas.
2. **Le libellé actif reste en couleur texte.** Seuls la pièce d'accent et le point prennent la couleur de l'onglet : la barre ne devient pas un arc-en-ciel.
3. **Les pierres gardent leur matière partout** : barre, attente, icône de l'app, ornement. Ce sont les dégradés du goban, jamais une teinte plate colorée.
4. **Le reflet est toujours en haut à gauche**, même en mouvement.
5. **Le mouvement répond à un geste** (toucher un onglet) ou signale une attente. Rien ne bouge tout seul sans raison.
6. **Tailles** : 28 px dans la barre (`--icone-nav`), 22 px pour l'attente dans une ligne de texte (`--icone-attente`), 32 px pour l'attente d'un bloc.

## 5. Ce qu'on ne fait pas

- Pas de pastille ou de fond coloré derrière l'icône active (style Material). La matière des pierres suffit à marquer l'état.
- Pas d'icônes d'une bibliothèque (Lucide, Material) à côté de celles-ci : même famille, dessinée à la main.
- Pas de rouge vermillon pour le Profil : il appartient aux adversaires et aux problèmes.
- Pas de chute de pierre ni de rotation quand l'utilisateur a choisi les mouvements réduits.
- Pas de logo en ornement devant le titre principal d'un écran : l'en-tête le porte déjà.
- Pas de rond de chargement générique : toute attente utilise `Reflexion`.
