# Passe design sur toute l'app : audit (issue #509, étape 1)

Étape 1 : audit seulement, sans aucun changement du code de l'app. Les corrections viendront par lots, à l'étape 2.

Mode de revue : **DÉGRADÉ, un seul contexte.** La critique d'Impeccable demande deux sous-agents isolés (revue de design, puis détecteur). Aucun outil de sous-agent n'était disponible, et le détecteur `impeccable detect` n'est volontairement pas installé (voir `.claude/skills/impeccable-extraits/SKILL.md`). La revue visuelle a donc été faite d'abord, puis les mesures automatiques, sans que les unes influencent l'autre.

## Synthèse

1. L'identité Encre & Jade tient partout : le goban, le bouton en relief, les sceaux et la fin de partie sont au niveau. Aucun contraste sous AA, aucune cible sous 44 px hors plateau, aucun défilement horizontal, aucune erreur JavaScript, sur 3 configurations × 2 thèmes.
2. Les défauts graves sont des **collisions avec les éléments fixes**. Dans la revue, « Démarrer le bilan » est tranché par le dock. À la fin de « Rejouer mes erreurs », deux montants d'XP se contredisent (+60 et +30), et la pastille d'XP couvre le logo.
3. Le système dérive. On compte 2 rendus de Mochi mêlés sans règle, 3 grammaires d'en-tête, 6 styles de bouton « retour », 225 couleurs hexadécimales et 90 tailles de police écrites en dur hors `tokens.css`, et 47 rayons hors de la grille.
4. Sur 320 × 568, le plateau de partie tombe à 220 px, et le bandeau de consentement cache « Je sais déjà jouer ». Sur 390 × 844, la leçon et les écrans de fin laissent de grands vides sans intention.
5. Six lots indépendants sont proposés, dont un pour les textes et les jetons, à fusionner en premier. Trois points relèvent d'une **décision de Florian**.

## Méthode

- **Captures** : build `VITE_E2E=1` servi par `vite preview` sur le port 4611. Le script Playwright du scratchpad (`audit509/captures.spec.ts`) réutilise en lecture `e2e/fauxSupabase.ts`, `e2e/plateau.ts`, `e2e/revueFactice.ts` et `e2e/mesures.ts`.
  - Configurations : 390 × 844 FR, 320 × 568 FR, 390 × 844 EN, chacune en sombre et en clair, avec les mouvements réduits.
  - Volume : 39 états d'écran, environ 230 captures dans `scratchpad/captures-509/` (nom : `NN-ecran-largeur-theme-langue.jpg`) et une planche de 6 captures, `planche.png`.
- **Mesures** sur chaque capture (sauf les pages entières) : défilement horizontal, cibles sous 44 px, nombre d'actions principales, contraste de chaque texte, textes coupés, éléments hors écran, erreurs JavaScript.
- **Grilles** : `impeccable-extraits` (craft-floor, operate, critique, audit, polish, harden, clarify, layout, typeset, adapt), Nielsen, `mobile-pro-rules`, `break-ui`, `redesign-skill` (rendu générique), `emil-design-eng` et `find-animation-opportunities` (mouvement). Recherche par `grep` dans `src/ui/*.css` pour la cohérence du système.
- **Non capturé** : la feuille « Autres façons de jouer », qui n'existe pas dans l'état semé (l'accueil complet n'affiche que « À deux » et « Guidée »), la carte « Réviser » (absente avec l'état semé), « Partie lente » en anglais (le libellé diffère), le placement et la fin de course. Ces écrans ont déjà été vus dans l'audit du 02/10 (`docs/qa/audit-visuel-2026-10-02.md`).
- **Note sur les données** : les parties sont jouées avec `?komi=-100` (paramètre de test). « −100 » et « 100 points » en viennent : ce ne sont pas des défauts.

## Mesures automatiques

| Mesure | 390 FR | 320 FR | 390 EN |
|---|---|---|---|
| Défilement horizontal | 0 | 0 | 0 |
| Cibles sous 44 px (hors intersections du plateau) | 0 | 0 | 0 |
| Plus d'une action principale à l'écran | 0 | 0 | 0 |
| Textes sous le contraste AA | 1 (icône « ≡ » de la revue, 2,48:1, sombre) | idem | idem |
| Textes coupés | 0 | 1 (pseudo de 24 caractères, Profil) | 0 |
| Erreurs JavaScript | 0 | 0 | 0 |

Les intersections du plateau des pages SEO mesurent 38 px, comme prévu par la base de connaissances (cible WCAG 2.5.8 respectée, confirmation au doigt).

## Score de l'audit technique (Impeccable, `audit.md`)

| # | Dimension | Note | Constat principal |
|---|---|---|---|
| 1 | Accessibilité | 3 | AA tenu partout. Les actions secondaires passent sous le dock fixe (revue) ou sous le bandeau (320) : WCAG 2.4.11. |
| 2 | Performance | 3 | La barre de niveau anime `width` et `left` (500 ms, `niveau.css`). Le reste anime `transform` et `opacity`. |
| 3 | Thèmes | 2 | Les jetons existent et le mode clair est soigné. Mais on compte 225 hex et 90 tailles de police en dur, et la bulle de la vedette a 4 couleurs en dur. |
| 4 | Responsive | 3 | Pas de débordement. Plateau à 220 px en 320 × 568, et vides sans intention en 390 × 844. |
| 5 | Intégrité | 3 | Le système est propre à l'app. Il dérive sur Mochi, sur les en-têtes et sur le bouton retour. |
| **Total** | | **14/20** | **Bon** : il faut renforcer les thèmes et la cohérence. |

## Critique notée par écran

Note de 0 à 4 pour la critique (4 = excellent). Une seule action principale a été vérifiée sur chaque écran : la règle d'or tient partout.

| Écran (capture) | Note | Ce qui marche | Ce qui gêne |
|---|---|---|---|
| Premier lancement (`01-bandeau-consentement`) | 3 | Bandeau non modal, action visible en 390, choix de même poids. | En 320, le bandeau couvre « Je sais déjà jouer ». |
| Accueil épuré (`02-accueil-epure`) | 4 | Une promesse, le goban, une action. Compris en 3 s. | Libellé « ton premier adversaire · 9 × 9 » (format « A · B », écarté par la direction ; en 320, le « · » reste seul en fin de ligne). |
| Accueil complet (`11-accueil-complet`) | 3 | Une action en relief, « Aujourd'hui » hiérarchisé. | 8 blocs à l'écran. La barre de niveau a l'air d'un curseur réglable. « 9 × 9 » est dit deux fois. |
| Choix de l'adversaire (`12-adversaires`) | 3 | Vedette avec bulle, verrous lisibles, BATTUE. | « kyu » partout, jamais expliqué. |
| Partie, début et milieu (`04`, `05`) | 3 | Grammaire de chess.com, coach en une phrase, barre d'actions claire. | Mochi est dessiné en sceau au début, puis en portrait. En 320, le plateau fait 220 px. |
| Partie, coach (`08-partie-coach`) | 2 | La phrase est juste et ne cache pas le plateau. | Le calque trace une capsule verte sur E5 et E4, qui délave la pierre blanche : on ne sait pas quoi regarder. |
| Comptage, récit, fin (`06`, `06b`, `07`) | 4 | C'est le pic du parcours : tampon, XP, Mochi tire la leçon. | « -100 » avec un tiret simple, au lieu du signe moins (−) ailleurs. En 320, « Revoir ma partie » est sous la ligne de flottaison. |
| Revue, bilan (`09-revue-bilan`) | 2 | Mochi ouvre sur le moment clé, la précision est lisible. | « Démarrer le bilan » est tranché par le dock. Le tableau a 9 catégories (calque de chess.com) : lourd pour un débutant. La courbe forme un bloc brun-noir en mode clair. |
| Revue, parcours (`09c`) | 3 | Bulle en une phrase, bande de coups. | Le bouton « Suivant » coupe la courbe sans fondu. |
| Rejouer mes erreurs (`10`, `10b`, `10c`) | 2 | Consigne claire, « Montre-moi le coup » en lien. | En fin : +60 XP dans la pastille, +30 XP dans la carte. La pastille couvre le logo. La carte est dans une carte, avec 330 px de vide dessous. |
| Apprendre, chemin (`14`) | 3 | Chemin dessiné, reprise en évidence, Mochi qui parle. | La page entière montre les 35 leçons (choix assumé). |
| Leçon (`15-lecon`) | 2 | Plateau large, consigne d'un geste. | 150 px de vide entre le plateau et Mochi. Le titre passe sur 2 lignes en brume. C'est un troisième rendu de Mochi. |
| Problèmes (`16-problemes`) | 3 | Go du jour mis en scène, thèmes, course. | Grille de 6 tuiles identiques (kit de cartes). Chevrons « › » sur « Course » et « Tous les problèmes ». |
| Série par thème et verdict (`17`, `17b`) | 2 | Réfutation jouée et expliquée. | Le titre dit « Deux pierres d'un coup », Mochi dit « la pierre marquée » (une seule est marquée). L'en-tête est serré sur 2 lignes. |
| Go du jour (`19`, `19b`) | 3 | En-tête clair, consigne, indice en lien. | Le verdict d'échec est un grand aplat rosé avec beaucoup de vide. |
| Course (`20`, `20b`) | 3 | Chrono, vies, score lisibles. | Le logo « Mochi Go » prend 120 px pendant une épreuve chronométrée. |
| Profil et réglages (`21`, `22`) | 3 | Lignes groupées, interrupteurs, aperçu du goban. | « Son / Vibrations » : deux bascules indépendantes déguisées en choix segmenté (les deux semblent choisies). Libellé « 2 jours, ton record » ambigu. |
| Mes parties vide (`23`, `32`) | 4 | État vide qui enseigne, avec Mochi et une action. | Rien. |
| Création de compte, connexion (`26`) | 3 | Ce qui est gardé, pas de mot de passe. | Le bouton désactivé reste presque aussi vert que l'actif. « Plus tard » est sous la ligne de flottaison. |
| Jouer en ligne, parties lentes, défi (`27`, `28`, `29`) | 3 | Choix par défaut, byo-yomi expliqué. | Le retour « ‹ » est fin, gris et mal aligné. L'écran du défi est vide aux deux tiers. |
| Pages SEO (`25a`, `25b`) | 3 | Mode lecture, démo jouable, FAQ. | Rien de bloquant. Longueur assumée. |

### Heuristiques de Nielsen (app entière)

| # | Heuristique | Note | Constat principal |
|---|---|---|---|
| 1 | Visibilité de l'état | 3 | XP contradictoires à la fin du rejeu. |
| 2 | Correspondance avec le monde réel | 3 | « kyu » jamais expliqué. Les 9 catégories de coups viennent des échecs. |
| 3 | Contrôle et liberté | 3 | Le retour existe partout, mais en 6 styles. |
| 4 | Cohérence et standards | 2 | Mochi en deux rendus. Trois en-têtes. Des bascules qui ressemblent à un choix segmenté. |
| 5 | Prévention des erreurs | 3 | Confirmation au doigt, avertissement avant une passe. |
| 6 | Reconnaître plutôt que se souvenir | 3 | Coordonnées et coups listés. Calque du coach ambigu. |
| 7 | Souplesse et efficacité | 3 | Clavier complet, réglages d'aide. |
| 8 | Esthétique et minimalisme | 3 | Une action par écran. Quelques vides et un tableau lourd. |
| 9 | Récupération après erreur | 3 | Réfutation expliquée, « Rejoue directement sur le plateau ». |
| 10 | Aide et documentation | 3 | Aide « ? » sur chaque écran de jeu, glossaire. |
| **Total** | | **29/40** | **Bon** |

## Tableau priorisé

Gravité : 4 bloque · 3 majeur, gêne nette · 2 mineur, incohérence visible · 1 finition · 0 note. La preuve est le préfixe de capture dans `scratchpad/captures-509/` : ajoute `-390-sombre-fr.jpg`, ou la variante indiquée. La colonne « Lot » renvoie à la section suivante.

| # | G | Écran | Constat | Preuve | Correctif proposé | Lot |
|---|---|---|---|---|---|---|
| 1 | 3 | Revue, bilan | « Démarrer le bilan » et « Partager » passent sous le dock fixe : on voit une ligne de texte tranchée entre le bouton jade et la barre du bas. On dirait un bug. | `09-revue-bilan` (sombre et clair), `09b-revue-bilan-page` | `src/ui/revue.css` : voile sous le dock, `.revue-dock::before { content:""; position:absolute; inset:-28px -16px calc(-74px - env(safe-area-inset-bottom,0px)); background:linear-gradient(to bottom, transparent, var(--bg) 28px); z-index:-1; pointer-events:none; }`, et `.revue-bilan, .revue-parcours, .revue-rejeu { padding-bottom: calc(74px + var(--cible-cta) + var(--relief) + var(--space-6) + env(safe-area-inset-bottom,0px)); }`, pour réserver la hauteur réelle du dock et de la barre. | L1 |
| 2 | 3 | Rejouer mes erreurs, fin | Deux montants d'XP sur le même écran : la pastille globale dit « +60 XP dont +20 première fois », la carte dit « +30 XP ». En plus, la pastille couvre le logo « Mochi Go ». | `10c-rejouer-fin` | `src/app/RejouerErreurs.tsx`, l. 182 : la carte affiche le **total** renvoyé par le gain (bonus compris), et le gain est annoncé sans pastille globale quand la carte le montre (même règle que #236 pour les exercices). `src/ui/pastille-xp.css` : sur un écran avec en-tête, `.annonce-xp { top: calc(72px + env(safe-area-inset-top,0px)); }`. | L1 |
| 3 | 2 | Partie, coach | Le calque de conseil trace un rectangle arrondi vert sur E5 et E4, plus un anneau : on lit une « capsule » qui délave la pierre blanche E5. Le point à jouer (E4) ne ressort pas. | `08-partie-coach` (sombre et clair) | `src/ui/conseilCalque.ts` et `src/ui/conseil.css` : seulement un anneau en tirets sur le point à jouer (même grammaire que la cible des problèmes, `stroke-dasharray`), et un halo doux de 2 px sur la pierre en atari. Plus de rectangle, plus de remplissage sur une pierre. | L3 |
| 4 | 2 | Partie 320 × 568 | Le plateau tombe à son plancher de 220 px (environ 24 px par intersection, à la limite WCAG 2.5.8). Les bandeaux « prisonniers » et la bulle prennent la hauteur. | `05-partie-milieu-320-sombre-fr` | `src/ui/partie.css` : `@media (max-height:600px)`, masquer `.couvercle-legende` (le nombre reste, le mot est déjà lu par le lecteur d'écran), ramener `.joueur` à 44 px, coach sur 2 lignes. Plancher à 256 px au lieu de 220 px (`.partie > .partie-plateau`, l. 143). **Décision de Florian** : faut-il rogner la bulle de Mochi sur l'iPhone SE de 1re génération ? | L3 |
| 5 | 2 | Partie, revue, rejeu, leçon, problèmes | **Mochi a deux rendus sans règle.** Le sceau jade (`<Mochi>`) apparaît dans la bulle d'intro de partie, la revue, le rejeu et la création de compte. Le portrait (`<PortraitMochi>`, avec humeurs) apparaît dans le coach, la leçon, les problèmes et Mes parties. Dans une même partie, Mochi change de visage entre le premier coup et le second. | `04-partie-debut` contre `05-partie-milieu`, `09-revue-bilan`, `15-lecon` | Règle à fixer, puis à appliquer : **le portrait quand Mochi parle** (toute bulle), **le sceau comme signature** (moins de 32 px, logo, fin de carte). Fichiers : `src/ui/Mochi.tsx` (`Bubble`), `src/app/Revue.tsx` (l. 342, 415, 492), `src/app/RejouerErreurs.tsx` (l. 213), `src/app/Accueil.tsx` (l. 135). **Décision de Florian** (usage des personnages, charte `personnages-go`) : la direction dit « Mochi garde son sceau jade ». | L3 (partie), L1 (revue) |
| 6 | 2 | Course, revue, rejeu, en ligne, défi, sous-écrans du Profil | **Trois grammaires d'en-tête.** (a) Logo « Mochi Go » de 120 px, avec à droite le nom de l'onglet, qui répète la barre du bas, puis un « ‹ titre ». (b) Barre « ‹ titre » seule (leçon, problème). (c) Rien (partie). Pendant une course chronométrée ou un rejeu, le logo prend 15 % de l'écran. | `20b-course`, `09c-revue-parcours`, `27-direct-choix`, `15-lecon` | `src/app/App.tsx`, l. 958 : `ecranPlein` vrai pour les écrans de tâche (course, revue, rejeu, direct, lentes, défi). Seule la barre « ‹ titre » reste, comme en leçon. `src/ui/app.css` (`.top`) : retirer le libellé d'onglet à droite (déjà relevé en #72, point 17). | L2 |
| 7 | 2 | Tous les sous-écrans | **Six styles de bouton retour** : `.retour` est défini dans `apprendre.css` (5 fois), `direct.css`, `partie.css`, `profil.css` et `revue.css`. On y trouve des marges de −6 à −14 px, « ‹ » en texte de 30 px gris, ou un SVG de 20 px avec « Retour ». Sur `27-direct-choix`, le chevron est fin, gris et 4 px plus bas que le titre. | `27-direct-choix`, `22-reglages`, `09-revue-bilan`, `15-lecon` | Nouveau composant `src/ui/BoutonRetour.tsx`, avec la règle `.retour-ecran` dans `src/ui/app.css` : 44 × 44 px, chevron SVG de 24 px, trait de 2 px, `color: var(--text)`, `margin-left: -10px`, `:active { background: var(--surface) }`. Remplacé d'abord dans Direct, Lentes, Defis et Profil. Revue, leçon et partie suivent avec leurs lots. | L2 |
| 8 | 2 | Réglages | « Sons : Son / Vibrations » sont deux bascules indépendantes (`LigneBascules`) dessinées comme un choix segmenté : quand les deux sont actives, les deux segments sont noirs et on croit à un bug du choix unique. | `22b-reglages-page-390-clair-fr` | `src/app/Profil.tsx`, l. 362 : deux `LigneInterrupteur` (« Sons », « Vibrations »), comme « Célébrations ». `LigneBascules` (`src/ui/Reglage.tsx`) n'a alors plus d'usage : à retirer. | L2 |
| 9 | 2 | Leçon | 150 px de vide entre le plateau et la bulle de Mochi : la consigne flotte au milieu du bas de l'écran. Le titre « Libertés et capture » passe sur 2 lignes, en brume, à côté de la progression. | `15-lecon` (sombre et clair) | `src/ui/apprendre.css` (`.lecteur`) : la bulle suit le plateau (`margin-top: var(--space-3)`), et l'espace libre passe sous la bulle (même principe que `.partie-souffle`). `.lecteur-tete` : titre sur une ligne, `text-overflow: ellipsis`, couleur `var(--text)`. | L5 |
| 10 | 2 | Accueil, adversaires, partie, Problèmes | « 20 kyu », « 16 kyu », « 30 à 25 kyu » s'affichent dès le premier écran, sans explication (CLAUDE.md, règle 5). | `11-accueil-complet`, `12-adversaires`, `16-problemes` | `src/app/Accueil.tsx` (feuille « Ton adversaire ») : une ligne sous la taille du plateau, « Le kyu, c'est le niveau : plus le nombre est petit, plus c'est fort. » Clés FR et EN dans `src/content/i18n/frEcrans.ts` et `en.ts`. | L4 |
| 11 | 2 | Système | **Jetons contournés** : 225 couleurs hex et 90 tailles de police en dur hors `tokens.css` (`revue.css` 21 tailles, `fin.css` 14, `apprendre.css` 39 hex, `accueil.css` 27, `profil.css` 26, `partie.css` 25), et 47 rayons hors de la grille (6, 7, 8, 9, 10, 11, 14, 18, 20, 22 px). | `grep` dans `src/ui/*.css` | `src/ui/tokens.css` : ajouter `--bois-tranche: #7A4A1C` (5 mini-gobans), `--sur-papier`, `--sur-papier-doux`, `--sur-papier-alerte` (bulle de la vedette, `accueil.css` l. 241 à 247), `--fs-display-s` (22 px), `--fs-display-m` (28 px), `--fs-display-l` (44 px), `--fs-display-xl` (56 px), `--radius-feuille: 22px`. Puis chaque lot remplace dans ses propres fichiers. Corriger aussi l'indentation du bloc `:root[data-theme="light"]` (l. 168 à 171), qui duplique le bloc `@media` : à factoriser. | L6, puis chaque lot |
| 12 | 2 | Premier lancement 320 | Le bandeau de consentement couvre « Je sais déjà jouer » (on n'en voit que les points de soulignement). | `01-bandeau-consentement-320-clair-fr` | `src/ui/accueil.css`, l. 299 à 302 : `.app-home:has(.accord)` réserve `--accord-h`, mais le lien reste dessous en 568 px. Sous `max-height:600px`, mettre « Je sais déjà jouer » sur la même ligne que « Changer », ou réduire le goban d'accueil de 40 px tant que le bandeau est là. | L4 |
| 13 | 2 | Série par thème | Le titre dit « Deux pierres d'un coup », Mochi dit « Capture la pierre marquée », et une seule pierre est marquée. | `17b-serie-theme-verdict` | **À signaler à l'agent du contenu** (règle d'or : aucun conseil faux). Pas de lot design. | — |
| 14 | 2 | Revue, bilan | Le tableau a 9 catégories de coups (Brillant à Gaffe), la grille de chess.com : 9 lignes pour un débutant de 3 parties. | `09b-revue-bilan-page` | `src/app/Revue.tsx` : pendant les 10 premières parties, 3 lignes (« Bons coups », « Imprécisions », « Erreurs »), puis « Tout voir ». **Décision de Florian** (ce choix reprend chess.com). | L1 |
| 15 | 1 | Revue, mode clair | La courbe « Qui mène » forme un bloc brun-noir (`--courbe-noir: #3A332D`) : c'est le seul aplat sombre de l'écran. | `09-revue-bilan-390-clair-fr` | `src/ui/tokens.css`, mode clair : `--courbe-noir: color-mix(in srgb, var(--text) 55%, var(--surface))`, à vérifier par `tokens.test.ts`. | L6 |
| 16 | 1 | Accueil, Profil | La barre de niveau a un bouton rond (pierre) qui ressemble à un curseur réglable. Elle anime `width` et `left` en 500 ms (propriétés de mise en page). | `11-accueil-complet`, `30-profil-connecte-pseudo-long` (la pierre touche « XP ») | `src/ui/niveau.css`, l. 26 à 28 : `.niveau-plein` à pleine largeur, avec `transform: scaleX(var(--p)); transform-origin: left; transition: transform 500ms var(--ease)`, et pierre en `translateX`. Pierre de 10 px, sans liseré or. | L4 |
| 17 | 1 | Accueil épuré | « ton premier adversaire · 9 × 9 » reprend le format « A · B » écarté par la direction (§ 7). En 320, le « · » finit seul sur sa ligne. | `02-accueil-epure`, `01-bandeau-consentement-320-clair-fr` | Texte : « Ton premier adversaire, sur 9 × 9 ». Clé i18n de l'accueil (FR et EN). | L6 |
| 18 | 1 | Toute l'app | Apostrophes mêlées (« t'a », « t'attend » contre « j’aide », « c’est ») : environ 125 apostrophes droites restent dans `fr.ts` et `frEcrans.ts`, contre environ 300 typographiques. | `09-revue-bilan`, `07-fin-bilan` | `src/content/i18n/*.ts` : remplacer `'` par `’` dans les chaînes françaises. Ajouter un test dans `vocabulaire.test.ts` : aucune apostrophe droite entre deux lettres dans une valeur FR. | L6 |
| 19 | 1 | Comptage | « Toi 0, Pomme -100 » : tiret simple. Le récit écrit « −100 » (signe moins). | `06-comptage` | Formateur de score (`src/ui/score.ts`) : signe moins U+2212. | L3 |
| 20 | 1 | Rejouer, fin | La carte du résultat est une carte dans une carte (Mochi dans un rond sur une surface), avec 330 px de vide dessous. Les pastilles « – » des coups ratés ressemblent à des boutons désactivés. | `10c-rejouer-fin` | `src/ui/rejouer-erreurs.css` : retirer le fond de `.rejeu-fin-carte` (garder le halo), centrer la colonne verticalement, et rendre `.ratee` en simple point creux de 12 px. | L1 |
| 21 | 1 | Partie | Point « à toi de jouer » : une onde infinie toutes les 2 s, pendant toute la partie (`.au-trait::after`), donc un mouvement perpétuel sur un écran qu'on regarde 10 minutes. | lecture du code, `partie.css` l. 48 à 51 | Trois ondes au changement de trait, puis plus rien (`animation-iteration-count: 3`), comme `.actions button.pulse`. | L3 |
| 22 | 1 | Accueil | Le portrait de la vedette rebondit (420 ms, dépassement de 1,56) **à chaque** affichage de l'accueil : un écran vu des dizaines de fois par jour. | `accueil.css` l. 248 à 250 | Garder l'entrée pour un changement d'adversaire seulement (`[data-nouveau]`), sinon aucun mouvement. | L4 |
| 23 | 1 | Profil (pire cas) | « 1284 » sans espace des milliers (en français, « 1 284 »). Le pseudo de 24 caractères se coupe au milieu du mot dans « Mon compte » (« Maximilien_Wellingt / on_XV »). Le libellé « 2 jours, ton record » est ambigu : est-ce la série actuelle ou le record ? | `31b-pire-profil`, `30-profil-connecte-pseudo-long` | `src/app/Profil.tsx` : `Intl.NumberFormat(langue)` pour la série, le niveau et les parties. Sous-titre de « Mon compte » : `text-overflow: ellipsis` sur une ligne (le pseudo entier est déjà en titre). Libellé : « jours de suite », avec le record dessous (« record : 7 »). | L2 |
| 24 | 1 | Création de compte | Le bouton « Recevoir mon code » désactivé reste d'un vert soutenu, proche de l'actif. « Plus tard » est sous la ligne de flottaison. | `26-creer-compte` | `src/ui/app.css`, `.cta:disabled` : `background: var(--surface-2); color: var(--muted); box-shadow: none`. Attention : `app.css` appartient au lot L2. | L2 |
| 25 | 1 | Défi, parties lentes | Écrans vides aux deux tiers. Sur le défi, pas de titre d'écran, seulement le libellé « Défier un ami » en haut à droite. | `29-defi-creer`, `28-parties-lentes` | Avec le correctif 6 : le titre « Défier un ami » dans la barre « ‹ titre ». La colonne commence plus bas (`justify-content: center` sous 700 px de contenu). | L2 |
| 26 | 0 | Revue, parcours | L'icône « ≡ » (coup classique) est à 2,48:1 sur le fond brun en sombre. Elle double un texte, donc elle n'est pas bloquante. | mesures, `09c-revue-parcours` | `--note-classique` plus clair en sombre (`revue.css`). | L1 |

## Lots de correction

Les fichiers sont disjoints d'un lot à l'autre, sauf `tokens.css`, qui n'est touché que par L6. **Ordre** : L6 d'abord (jetons et textes), puis L1 à L5 en parallèle. Une issue et une PR par lot, avec des captures avant et après en 390 et 320, sombre et clair.

| Lot | Titre | Points | Fichiers (à l'exclusion des autres lots) |
|---|---|---|---|
| **L6** | Jetons et textes (en premier) | 11 (création des jetons), 15, 17, 18 | `src/ui/tokens.css`, `src/ui/tokens.test.ts`, `src/content/i18n/*.ts` (sauf les nouvelles clés de L4), `src/content/i18n/vocabulaire.test.ts` |
| **L1** | Revue et « Rejouer mes erreurs » | 1, 2, 5 (partie revue), 14, 20, 26 | `src/app/Revue.tsx`, `src/app/RejouerErreurs.tsx`, `src/app/SeanceRevisions.tsx`, `src/ui/revue.css`, `src/ui/rejouer-erreurs.css`, `src/ui/pastille-xp.css`, `src/ui/seance-revisions.css` |
| **L2** | Navigation, en-têtes, Profil | 6, 7, 8, 23, 24, 25 | `src/app/App.tsx`, `src/ui/app.css`, `src/ui/BoutonRetour.tsx` (nouveau), `src/app/Direct.tsx`, `src/app/Lentes.tsx`, `src/app/Defis.tsx`, `src/app/Profil.tsx`, `src/ui/Reglage.tsx`, `src/ui/direct.css`, `src/ui/defis.css`, `src/ui/profil.css` |
| **L3** | Écran de partie et coach | 3, 4, 5 (partie), 19, 21 | `src/app/Game.tsx`, `src/ui/Mochi.tsx`, `src/ui/partie.css`, `src/ui/conseil.css`, `src/ui/conseilCalque.ts`, `src/ui/comptage.css`, `src/ui/score.ts` |
| **L4** | Accueil et premier lancement | 10, 12, 16, 22, remplacement des jetons de la vedette (11) | `src/app/Accueil.tsx`, `src/ui/accueil.css`, `src/ui/niveau.css`, `src/ui/Niveau.tsx`, et les 2 clés i18n du kyu (à ajouter après L6) |
| **L5** | Apprendre et Problèmes | 9, remplacement de `#7A4A1C` et des rayons (11), en-tête des problèmes sur 2 lignes (tableau par écran) | `src/app/Lecon.tsx`, `src/app/Learn.tsx`, `src/app/Puzzles.tsx`, `src/ui/apprendre.css`, `src/ui/lecon.css`, `src/ui/apprendre-partage.css`, `src/ui/themes.css`, `src/ui/course.css` |

Le point 13 (énoncé de problème) va à l'agent du contenu. Les points 4, 5 et 14 attendent une décision de Florian avant d'être livrés : le reste de leur lot peut avancer.

## Rendu générique (`redesign-skill`, craft-floor)

- **Pas de rendu générique sur l'identité** : fond encre chaude, trois accents qui ont chacun un sens, goban en matière, sceaux dessinés. On ne trouve ni dégradé violet, ni texte en dégradé, ni verre décoratif, ni surtitre au-dessus des titres.
- **À surveiller** :
  - La grille de 6 tuiles « Par thème » (icône, puis libellé, toutes de même taille) et la grille de 10 tuiles du Profil connecté glissent vers le « kit de cartes ».
  - Les 4 anneaux de statistiques du Profil sont des « progress rings » décoratifs : le chiffre seul suffit.
  - Les chevrons « › » de « Course » et de « Tous les problèmes » sont des flèches de liste, que la direction a écartées (§ 7).
  - Rien de tout cela n'est urgent. À reprendre si une passe « Profil v4 » est ouverte.
- **Ombres dures hors du bouton principal** : les mini-gobans (`0 3px 0 #7A4A1C`) et le goban (`board.css`) ont une tranche dure. C'est de la **matière de bois**, pas un second relief d'action. La règle « un seul relief » reste tenue. À garder, mais en jeton (point 11).

## Mouvement (`emil-design-eng`, `find-animation-opportunities`)

Ce qui bouge mal : points 16 (largeur animée), 21 (onde infinie) et 22 (rebond à chaque visite). Le reste est conforme à l'audit #60 : `transform` et `opacity`, sortie en ease-out, mouvements réduits respectés.

Ce qui devrait bouger (filtré par la fréquence, le but et la durée) :

| # | Où | Aujourd'hui | But | Fréquence | Mouvement proposé |
|---|---|---|---|---|---|
| 1 | `.revue-dock`, au changement de coup (`revue.css`) | Le contenu glisse sous le dock et se coupe net. | Éviter une coupure brutale | Fréquent | Pas d'animation : un voile fixe (point 1), qui vaut mieux qu'un mouvement. |
| 2 | Choix segmentés (Direct, Lentes, Réglages, taille du plateau) | Le segment choisi saute d'une case à l'autre. | Rendre l'état lisible | Occasionnel | Une pastille commune qui glisse en `transform: translateX`, 180 ms `var(--ease)`. En mouvements réduits, un fondu de couleur de 120 ms. |
| 3 | Fin du rejeu et fin des révisions (`rejouer-erreurs.css`) | Le score se pose, puis les pastilles, puis l'XP. | Plaisir (moment rare) | Rare | Garder. Ajouter que la pastille « trouvée » se dessine (coche en `stroke-dashoffset`, 240 ms), comme la réussite d'un problème. |

Écartés :
- La pierre fantôme de la partie : centaines de fois par partie, aucun mouvement.
- Les onglets de la barre du bas : déjà à 160 ms, ne rien ajouter.
- La courbe « Qui mène » de la revue : c'est une donnée que l'on lit, pas de tracé animé.

## Ce qu'il ne faut PAS toucher

- **Le goban** : bois, pierres, ombres, sons, pose, captures, coordonnées au pixel (audit #461). Toute retouche passe par l'agent du goban.
- **Le bouton principal en relief** et la règle « un seul relief par écran ». Elle est tenue sur les 39 états mesurés.
- **La palette, les polices** (Bricolage Grotesque et Zen Kaku Gothic New) **et les personnages** (dessins des 9 adversaires et de Mochi) : identité, **décision de Florian**. Ce rapport ne propose de changer que l'**usage** des deux rendus de Mochi (point 5), et le signale comme décision.
- **La fin de partie** (tampon BATTUE, XP, Mochi qui tire la leçon) et le récit du score : c'est le pic du parcours, il est réussi.
- **Le bandeau de consentement** : texte et choix de même poids, cadre juridique (#485). Seule sa place en 320 est en cause (point 12).
- **La barre de navigation**, les libellés courts sous zoom (#465) et les jetons de contraste vérifiés par `tokens.test.ts`. Toute nouvelle couleur passe par ce test.
- **Les mouvements réduits** : rien à retirer, tout est déjà sous `prefers-reduced-motion: no-preference`.

## Reproduire

Le script de capture et la planche restent dans le scratchpad de la session, hors dépôt : `audit509/captures.spec.ts`, `audit509/playwright.config.ts` et `audit509/planche.mjs`.

1. Construire et servir l'app :
   ```
   VITE_E2E=1 npm run build
   npm run preview -- --port 4611 --strictPort
   ```
2. Lancer les captures avec `CFG=390-fr|320-fr|390-en npx playwright test -c audit509/playwright.config.ts`. Le filtre `ETAPES=09,10` limite le parcours à quelques étapes. Les mesures sont écrites dans `audit509/mesures/`.
3. Pour vérifier un lot, comparer les mêmes noms de capture avant et après.
