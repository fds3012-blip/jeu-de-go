# Audit « impeccable partout » (issues #72 et #85)

Demande de Florian (27/09) : un design propre, cohérent et impeccable partout, au niveau de chess.com.

- Planche avant/après : `audit-coherence.png`.
- Grille de contrôle : skills `design-system` (audit des jetons), `design-critique`, `impeccable-extraits` (`craft-floor.md`, `polish.md`), `mobile-pro-rules` (`pro-rules.md`) et `ux-copy`.
- Hors périmètre : l'écran de revue (`Revue.tsx`, `revue.ts`, `revue.css`), qu'un autre agent modifie en parallèle. Ses défauts sont signalés plus bas, mais ces fichiers n'ont pas été touchés.

## Méthode

1. **Audit statique** : recherche dans `src/` des couleurs, tailles de police, rayons et espacements écrits en dur, des doublons de styles et des textes (tutoiement, espaces fines, vocabulaire).
2. **Audit visuel** : captures Playwright (script node, build `VITE_E2E` servi sur le port 4402) de 13 écrans et états :
   - consentement ;
   - accueil ;
   - choix de l'adversaire ;
   - début de partie ;
   - victoire (`?komi=-100`) et défaite (`?komi=100`) ;
   - chemin Apprendre et leçon ;
   - liste des problèmes et problème ;
   - Profil, Mon compte et Conditions.

   Chaque écran est pris en sombre et en clair, en 390 × 844 et en 375 × 667 (iPhone SE), avec les mouvements réduits : 104 captures en tout.
3. **Espaces insécables** : parcours du DOM rendu de chaque écran, à la recherche d'une espace normale devant `? ! : ; »` ou derrière `«`.

La première passe (#72) n'avait pas capturé tous les états. La deuxième passe (#85, section plus bas) ajoute capture, atari, indice, comptage, réussite et échec d'un problème, verdicts et fin de leçon. Il reste les pierres mortes proposées par l'ordi et les erreurs réseau.

## Défauts, par gravité

Gravité :
- **P1** : visible par tout le monde, ou bloque l'accessibilité ;
- **P2** : incohérence visible ;
- **P3** : dette du système, invisible pour le joueur.

| # | Gravité | Écran | Défaut | Statut |
|---|---|---|---|---|
| 1 | P1 | Accueil | **Collision de classes.** Le bloc « Pomme 20 kyu » et la carte du Profil utilisent tous deux `.identite`. Le style de la carte (fond `--surface`, marges, rayon) s'appliquait donc au nom de l'adversaire : on voyait une tuile grise sans raison, contraire à la direction (« nom de l'adversaire en grand »). | **Corrigé** : la classe devient `.adversaire-identite` dans `Accueil.tsx` et `accueil.css`. |
| 2 | P1 | Fin de partie (SE) | « Revoir ma partie » et « Accueil » étaient coupés en bas de l'écran sur un iPhone SE. | **Corrigé** : `@media (max-height: 700px)` dans `fin.css`. Le sceau passe à 78 %, le titre à 44 px et les marges sont resserrées. Tout tient sans défiler. |
| 3 | P1 | Choix de l'adversaire, fenêtre de consentement | **Cible tactile trop petite.** Les segments `.seg` (« 9 × 9 / 13 × 13 / 19 × 19 ») faisaient 38 px de haut, sous le minimum de 44 px (CLAUDE.md, règle 6). | **Corrigé** : `.seg button { min-height: var(--cible-min) }`. |
| 4 | P1 | Leçon (SE) | Le bouton flottant « Continuer » cache les rangées 1 et 2 du plateau, là où se trouve justement la pierre du coin qu'explique la leçon. | **Corrigé en #85.** Le plateau de la leçon s'adapte à la hauteur disponible. |
| 5 | P2 | Profil (SE) | Le libellé « Aide de Mochi en partie » était écrasé sur trois lignes par le choix segmenté. | **Corrigé** : `.ligne-choix` passe à la ligne. Le libellé garde au moins 6 em, et les segments passent dessous, alignés à droite, quand ils ne tiennent pas à côté. |
| 6 | P2 | Consentement, Conditions, Mon compte | **Espaces fines insécables absentes** devant `? :` et dans « », alors que le reste de l'app passe par `fr()`. Un « ? » pouvait partir seul à la ligne, comme dans le titre « Tu m'aides à chasser les bugs ? ». | **Corrigé** : 8 textes passent par `FINE` (`src/ui/typo.ts`). Les `aria-label` gardent l'espace normale, car les tests e2e s'appuient dessus et les lecteurs d'écran n'en ont pas besoin. |
| 7 | P2 | Accueil, choix de l'adversaire | Le bouton principal « Joue ta première partie contre Pomme » passe sur deux lignes en 390 comme sur SE. Chez chess.com, le bouton principal tient sur une ligne. La direction v2 prévoit « Jouer contre Pomme ». | **Corrigé en #85.** |
| 8 | P2 | Toute l'app | **Apostrophes mélangées.** On trouve la droite `'` (« L'échelle », « qu'une liberté », « Caillou t'attend ») et la typographique `’` (« Tu m’aides », « L’ordi »), parfois sur le même écran. | **Non corrigé.** Voir la deuxième passe, point 8. |
| 9 | P3 | Toute l'app | **Matière des pierres copiée 8 fois.** Les dégradés noir et blanc étaient recopiés dans `app.css`, `fin.css`, `nav.css` et `partie.css`. | **Corrigé** : nouveaux jetons `--matiere-noire` et `--matiere-blanche`. |
| 10 | P3 | Accueil, fin de partie, barres | **Encre et papier du tampon** (`#B23520`, `#F7E9DA`) écrits en dur 9 fois. | **Corrigé** : jetons `--tampon-encre` et `--tampon-papier`. |
| 11 | P3 | Feuille « Changer », consentement | **Deux voiles de fond** en `rgba` écrits en dur. | **Corrigé** : jetons `--voile` (feuille) et `--voile-fort` (fenêtre qui attend une réponse). |
| 12 | P3 | Toute l'app | **Plus de 20 tailles de police différentes** hors jetons (15 px, .95rem, 13 px, .8rem, 14 px…). | **En partie corrigé** : 35 valeurs remplacées, avec deux nouveaux jetons justifiés par l'usage : `--fs-legende` (13 px, 8 emplois) et `--fs-corps-s` (15 px, 14 emplois). **Restent 15 tailles d'affichage** propres à un élément : titre de victoire 56 px, chiffre de fin de leçon, tampon, initiales. Il faudrait des jetons `--fs-display-*`. |
| 13 | P3 | `Account.tsx` | Treize styles en ligne (`margin`, `fontSize: '1.2rem'`, `color: var(--vermillon)`) au lieu de classes. `--vermillon` est un alias v1. | **Non corrigé** : l'écran Mon compte devrait passer au modèle `.lignes` du Profil. Voir aussi le point 14. |
| 14 | P3 | Mon compte | Le titre d'écran « Mon compte » est suivi d'une carte titrée « Ton compte » : la même idée apparaît deux fois, et l'on a une carte dans l'écran. | **Non corrigé** : à reprendre avec le point 13. |
| 15 | P3 | Conditions | Les sections sont des cartes séparées de 4 px (le « kit de cartes » que la direction v2 écarte). Les réglages juste au-dessus, eux, utilisent `.lignes` avec des filets. | **Non corrigé** : il suffirait d'un seul bloc `.lignes`, avec des titres de section. |
| 16 | P3 | Accueil (SE) | La tuile « Problème du jour » coupe son surtitre sur deux lignes (« Problème du / jour »). | **Réglé par #75** : le surtitre devient « Go du jour n° 1 » et tient sur une ligne sur SE (vérifié après la fusion). |
| 17 | P3 | En-têtes | Le sous-titre en haut à droite (« Profil », « Problèmes ») répète l'onglet actif de la barre du bas. | **Non corrigé** : on peut le garder comme repère, mais il n'apporte rien sur un téléphone. À discuter. |
| 18 | P3 | Leçon | Au premier pas, les trois segments de progression sont vides : on ne voit pas qu'on a commencé. | **Non corrigé.** |
| 19 | P3 | `apprendre.css`, `partie.css` | 38 lignes contiennent encore des couleurs en dur : pierres de la leçon (variante avec reflet), couvercle en bois, bulle de réplique `#2a211a`, barre d'avantage `#F3EDE3` / `#0f0e0d`, ombres. | **Non corrigé** : elles relèvent de la matière du goban, pas des rôles d'interface. Il faudrait des jetons `--bois-*` et `--matiere-*-reflet`, à ajouter avec l'agent du goban. |
| 20 | P3 | Rayons | 20 rayons en px hors jetons (6, 7, 9, 11, 14, 20, 22 px). | **Non corrigé** : il faudrait ajouter `--radius-feuille` (20 à 22 px, feuilles et fenêtres), puis ramener les autres à la grille 12 / 16. |

### Écran de revue (hors périmètre, pour l'autre agent)
- `revue.css` : 7 tailles de police en px (14, 15, 20, 28 px) et `#221E1A` en dur. Les jetons `--fs-s`, `--fs-corps-s`, `--fs-xl` et `--matiere-noire` existent désormais pour les remplacer.

## Deuxième passe (issue #85)

États capturés en sombre et en clair, en 390 × 844 et sur iPhone SE, avec les mouvements réduits (44 captures) :
- en partie : atari, capture, indice, comptage (partie à deux, puis deux passes) ;
- leçon : premier pas, bonne réponse, erreur, fin de leçon ;
- problème : réussite, échec.

| # | Gravité | Écran | Défaut | Statut |
|---|---|---|---|---|
| 1 | P1 | Leçon (SE) | « Continuer » cachait les rangées 1 et 2 du plateau (point 4 de la première passe). | **Corrigé.** Le lecteur de leçon (`.lecteur-lecon`) tient dans l'écran, au-dessus du bouton. Le plateau est placé dans une zone souple (`.lecteur-plateau`) et prend un carré de côté min(largeur, hauteur libre), grâce à une requête de conteneur. Plancher de 220 px. En 390 × 844, rien ne change. Le lecteur de problème (`Puzzles.tsx`, autre agent) n'est pas touché. |
| 2 | P1 | Partie (SE) : comptage, indice | La barre d'actions coupait le texte du coach. Or c'est lui qui explique quoi faire (« Si un groupe est mort, touche-le pour le retirer », « Regarde dans le cercle vert »). | **Corrigé.** Sous 700 px de haut, le plateau passe de 367 à 327 px (plancher de 280 px), et le texte du coach tient en entier. Seul `partie.css` change (`.partie > .partie-plateau`). |
| 3 | P2 | Accueil, choix de l'adversaire | « Joue ta première partie contre Pomme » passait sur deux lignes (point 7 de la première passe). | **Corrigé.** Le bouton affiche le sceau de l'adversaire et « Joue ta première partie », sur une seule ligne, comme « Défier Caillou » en fin de partie. Pomme est déjà nommé en grand juste au-dessus. Le nom accessible reste « Joue ta première partie contre Pomme », via `ctaNom` dans `home.ts` ; il contient le libellé visible (WCAG 2.5.3). Tests adaptés : `home.test.ts`, `accueil-v2.spec.ts`, `premiere-pierre.spec.ts` (2) et `ordi.spec.ts`. |
| 4 | P2 | Leçon et problème (SE) : verdict | La feuille de verdict, plus haute que le bouton seul, couvre les rangées 1 à 3. Les pierres utiles restent visibles dans les leçons et problèmes de base, et le plateau n'est plus jouable à ce moment-là. | **Non corrigé.** Réduire le plateau quand le verdict apparaît le ferait sauter. Mieux vaut une feuille plus basse : une ligne de texte, avec le bouton à côté. |
| 5 | P2 | Partie (390 × 844) | Le bloc adversaire, plateau et toi est centré verticalement. Il reste donc environ 90 px vides en haut et un trou avant le coach. Chez chess.com, le plateau est collé sous l'adversaire, en haut. | **Non corrigé.** Le centrage est voulu (commentaire dans `partie.css`). À trancher avec Florian : on pourrait donner cette place au plateau ou au coach. |
| 6 | P2 | Problème : échec | « Voir la suite » et « Réessayer » ont le même poids. Après une erreur, l'action principale est de réessayer, et « Voir la suite » révèle la solution trop facilement. | **Signalé** à l'agent des problèmes (#16 et #75). `Puzzles.tsx` n'a pas été modifié. |
| 7 | P3 | Partie : atari | Dans une partie à deux, l'atari d'une pierre adverse n'est pas signalé au joueur qui a le trait. Seule l'alerte de Mochi signale ton propre groupe (#35). Le coach se contente de « Noir joue. Dernier coup : A2. » : c'est une occasion d'apprendre manquée. | **Non corrigé.** C'est un changement de logique de jeu, pas de design. On pourrait proposer : « La pierre blanche en E5 est en atari. » |
| 8 | P3 | Toute l'app | **Apostrophes.** On voit « n'a plus qu'une » (droite) juste au-dessus de « c’est le bon coup » (courbe), sur le même écran de problème. | **Non corrigé.** Ce n'est pas sûr dans le délai : les textes des problèmes sont dans la table `puzzles` de Supabase, en production, et il faudrait une migration. Ceux des leçons sont dans `content/lessons.fr.js` (contenu vérifié). Il faudrait aussi reprendre plus de 20 sélecteurs e2e et unitaires. **Plan** : faire convertir `'` en `’` par `fr()` à l'affichage (une seule fonction, aucune donnée touchée), puis adapter les tests dans une PR dédiée. |
| 9 | P3 | Fin de leçon | Beaucoup de vide au-dessus du sceau en 390 × 844. La colonne est centrée, et c'est cohérent avec la fin de partie. | Rien à faire. |
| 10 | — | Fin de partie (#78, autre agent) | Aucun nouvel écran capturé dans cette passe. Les défauts de la première passe (points 2 et 12) restent valables. | **Signalé.** |

## Ce qui est déjà au niveau

- **Tutoiement** partout. Aucun « vous ». Le vocabulaire est cohérent : on dit « l'ordi », jamais « IA », et « partie », jamais « match ».
- **Une seule action principale en relief par écran**, sur tous les écrans capturés.
- **Icônes** : barre du bas et barre d'actions suivent la grammaire aux deux pierres. Aucun emoji ni aucune icône de bibliothèque.
- **Mode clair et mode sombre** : les rôles sont respectés. Le contraste est vérifié par `tokens.test.ts`.
- **Zones sûres** : la barre du bas, le bouton flottant et la fin de partie tiennent compte de `env(safe-area-inset-*)`.

## Liste `mobile-pro-rules` (pro-rules.md)

| Point | État |
|---|---|
| Aucun emoji en guise d'icône | OK |
| Une seule famille d'icônes | OK (deux pierres) |
| L'appui ne décale pas la mise en page | OK (transform seulement) |
| Jetons sémantiques, pas de couleur en dur par écran | En progrès (points 9 à 12 et 19) |
| Retour visuel à l'appui | OK |
| Cibles de 44 px | OK après le point 3 |
| Désactivé lisible | OK (barre d'actions) |
| Contraste AA en sombre et en clair | OK (`tokens.test.ts`) |
| Zones sûres | OK |
| Contenu non caché par une barre fixe | OK après #85 (leçon, coach en partie), sauf la feuille de verdict sur SE (deuxième passe, point 4) |
| Rythme 4/8 px | En grande partie. Il reste des 6, 9, 10 et 14 px. |
| Testé sur 375 px | OK (cet audit) |
| Mouvements réduits | OK (captures faites avec `reducedMotion: reduce`) |
