# Audit « impeccable partout » (issue #72)

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

Le délai a été ramené en cours de route. Les états suivants n'ont pas été capturés : capture de pierres, atari, indice, comptage avec pierres mortes, réussite et échec d'un problème, fin de leçon, erreurs réseau. Ils restent à passer à la même grille.

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
| 4 | P1 | Leçon (SE) | Le bouton flottant « Continuer » cache les rangées 1 et 2 du plateau, là où se trouve justement la pierre du coin qu'explique la leçon. | **Non corrigé.** Il faut dimensionner le plateau de la leçon selon la hauteur disponible, comme en partie (`cadrage.ts`) : c'est un changement de mise en page, pas une retouche. À faire dans une issue dédiée. |
| 5 | P2 | Profil (SE) | Le libellé « Aide de Mochi en partie » était écrasé sur trois lignes par le choix segmenté. | **Corrigé** : `.ligne-choix` passe à la ligne. Le libellé garde au moins 6 em, et les segments passent dessous, alignés à droite, quand ils ne tiennent pas à côté. |
| 6 | P2 | Consentement, Conditions, Mon compte | **Espaces fines insécables absentes** devant `? :` et dans « », alors que le reste de l'app passe par `fr()`. Un « ? » pouvait partir seul à la ligne, comme dans le titre « Tu m'aides à chasser les bugs ? ». | **Corrigé** : 8 textes passent par `FINE` (`src/ui/typo.ts`). Les `aria-label` gardent l'espace normale, car les tests e2e s'appuient dessus et les lecteurs d'écran n'en ont pas besoin. |
| 7 | P2 | Accueil, choix de l'adversaire | Le bouton principal « Joue ta première partie contre Pomme » passe sur deux lignes en 390 comme sur SE. Chez chess.com, le bouton principal tient sur une ligne. La direction v2 prévoit « Jouer contre Pomme ». | **Non corrigé** : c'est une décision produit de l'issue #23, verrouillée par `home.test.ts` et trois tests e2e. **Proposition** : « Ta première partie » en bouton, avec « contre Pomme » porté par le sceau et le nom juste au-dessus. |
| 8 | P2 | Toute l'app | **Apostrophes mélangées.** On trouve la droite `'` (« L'échelle », « qu'une liberté », « Caillou t'attend ») et la typographique `’` (« Tu m’aides », « L’ordi »), parfois sur le même écran. | **Non corrigé** : les textes viennent de `content/`, de Supabase et de `repliques.ts`, et des tests e2e cherchent l'apostrophe droite. **Proposition** : faire convertir l'apostrophe par `fr()`, puis mettre à jour les tests, dans une PR dédiée. |
| 9 | P3 | Toute l'app | **Matière des pierres copiée 8 fois.** Les dégradés noir et blanc étaient recopiés dans `app.css`, `fin.css`, `nav.css` et `partie.css`. | **Corrigé** : nouveaux jetons `--matiere-noire` et `--matiere-blanche`. |
| 10 | P3 | Accueil, fin de partie, barres | **Encre et papier du tampon** (`#B23520`, `#F7E9DA`) écrits en dur 9 fois. | **Corrigé** : jetons `--tampon-encre` et `--tampon-papier`. |
| 11 | P3 | Feuille « Changer », consentement | **Deux voiles de fond** en `rgba` écrits en dur. | **Corrigé** : jetons `--voile` (feuille) et `--voile-fort` (fenêtre qui attend une réponse). |
| 12 | P3 | Toute l'app | **Plus de 20 tailles de police différentes** hors jetons (15 px, .95rem, 13 px, .8rem, 14 px…). | **En partie corrigé** : 35 valeurs remplacées, avec deux nouveaux jetons justifiés par l'usage : `--fs-legende` (13 px, 8 emplois) et `--fs-corps-s` (15 px, 14 emplois). **Restent 15 tailles d'affichage** propres à un élément : titre de victoire 56 px, chiffre de fin de leçon, tampon, initiales. Il faudrait des jetons `--fs-display-*`. |
| 13 | P3 | `Account.tsx` | Treize styles en ligne (`margin`, `fontSize: '1.2rem'`, `color: var(--vermillon)`) au lieu de classes. `--vermillon` est un alias v1. | **Non corrigé** : l'écran Mon compte devrait passer au modèle `.lignes` du Profil. Voir aussi le point 14. |
| 14 | P3 | Mon compte | Le titre d'écran « Mon compte » est suivi d'une carte titrée « Ton compte » : la même idée apparaît deux fois, et l'on a une carte dans l'écran. | **Non corrigé** : à reprendre avec le point 13. |
| 15 | P3 | Conditions | Les sections sont des cartes séparées de 4 px (le « kit de cartes » que la direction v2 écarte). Les réglages juste au-dessus, eux, utilisent `.lignes` avec des filets. | **Non corrigé** : il suffirait d'un seul bloc `.lignes`, avec des titres de section. |
| 16 | P3 | Accueil (SE) | La tuile « Problème du jour » coupe son surtitre sur deux lignes (« Problème du / jour »). | **Non corrigé** : il faudrait raccourcir le texte (« Du jour ») ou réduire la miniature à 40 px. À arbitrer. |
| 17 | P3 | En-têtes | Le sous-titre en haut à droite (« Profil », « Problèmes ») répète l'onglet actif de la barre du bas. | **Non corrigé** : on peut le garder comme repère, mais il n'apporte rien sur un téléphone. À discuter. |
| 18 | P3 | Leçon | Au premier pas, les trois segments de progression sont vides : on ne voit pas qu'on a commencé. | **Non corrigé.** |
| 19 | P3 | `apprendre.css`, `partie.css` | 38 lignes contiennent encore des couleurs en dur : pierres de la leçon (variante avec reflet), couvercle en bois, bulle de réplique `#2a211a`, barre d'avantage `#F3EDE3` / `#0f0e0d`, ombres. | **Non corrigé** : elles relèvent de la matière du goban, pas des rôles d'interface. Il faudrait des jetons `--bois-*` et `--matiere-*-reflet`, à ajouter avec l'agent du goban. |
| 20 | P3 | Rayons | 20 rayons en px hors jetons (6, 7, 9, 11, 14, 20, 22 px). | **Non corrigé** : il faudrait ajouter `--radius-feuille` (20 à 22 px, feuilles et fenêtres), puis ramener les autres à la grille 12 / 16. |

### Écran de revue (hors périmètre, pour l'autre agent)
- `revue.css` : 7 tailles de police en px (14, 15, 20, 28 px) et `#221E1A` en dur. Les jetons `--fs-s`, `--fs-corps-s`, `--fs-xl` et `--matiere-noire` existent désormais pour les remplacer.

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
| Contenu non caché par une barre fixe | **Non** pour la leçon sur SE (point 4) |
| Rythme 4/8 px | En grande partie. Il reste des 6, 9, 10 et 14 px. |
| Testé sur 375 px | OK (cet audit) |
| Mouvements réduits | OK (captures faites avec `reducedMotion: reduce`) |
