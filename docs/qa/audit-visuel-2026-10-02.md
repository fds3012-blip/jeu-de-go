# Audit visuel et d'usage — 2 octobre 2026

> Captures gardées dans le dépôt : 390 × 844 en français, clair et sombre (`docs/qa/captures/audit-02-10/*-390-*-fr.jpg`). Les autres tailles et langues se régénèrent avec `AUDIT_VISUEL=1 npx playwright test e2e/audit-visuel.spec.ts`.

Périmètre : `origin/main` à `4ebc4e3` (#357, « Continuer avec Google »). Build `VITE_E2E=1`, servi par `vite preview` sur le port 5214, Chromium de `/opt/pw-browsers`, écran tactile. Chaque écran est capturé en **390 × 844** et **320 × 568**, **sombre et clair**, **français et anglais** : 4 configurations × 2 thèmes, 508 captures dans `docs/qa/captures/audit-02-10/` (nom : `NN-ecran-largeur-theme-langue.jpg`). Supabase est simulé (`e2e/fauxSupabase.ts`) pour les écrans de compte et de défi ; le reste tourne sans service de compte, donc sans limite d'essai.

Méthode :
- `e2e/audit-visuel.spec.ts` (nouveau, lancé à la main avec `AUDIT_VISUEL=<dossier> npx playwright test audit-visuel`) parcourt les 60 états d'écran, capture, et **mesure** à chaque fois : défilement horizontal, cibles tactiles sous 44 px, nombre d'actions principales (`.cta`, `.btn.primary`), **contraste de chaque texte visible** (couleur composée avec l'opacité, sur le premier fond opaque trouvé en remontant ; seuil AA 4,5, ou 3 pour les grands textes), textes coupés (`text-overflow: ellipsis` actif, boîte à débordement caché), éléments hors écran, erreurs JavaScript.
- Chaque capture est ensuite relue à l'œil avec `design-critique` (première impression, hiérarchie, une seule action, cohérence) et la checklist `mobile-pro-rules` (icônes, retour tactile, contraste clair et sombre, zones sûres, états vides, erreurs, chargement), contre la direction `docs/design/v2/direction.md`.

Gravité : 🔴 bloque ou fait fuir · 🟠 gêne nette, à corriger avant diffusion large · 🟡 finition.

Note : les captures de partie sont jouées avec `?komi=-100` (paramètre de test) pour finir vite sur une victoire : « Pomme −100 », « de 100 points » et « −100 komi pour Pomme » viennent de là, ce ne sont pas des défauts.

## Les 10 défauts les plus graves

| # | Gravité | Écran | Défaut | Correctif proposé |
|---|---|---|---|---|
| 1 | 🟠 | Leçon, entraînement, problème, Go du jour (`10-`, `11-`, `13-`, `14-` en 390) | Sous le plateau, 450 à 550 px de vide avant la barre de navigation : la moitié basse de l'écran est noire, le regard ne sait pas où va la suite. | Caler le bloc verdict/action sous le plateau (`justify-content: flex-start` + espace réservé de la hauteur du verdict), ou agrandir le plateau jusqu'à la hauteur disponible. |
| 2 | 🟠 | Fin du placement, défi (création), compte (`16c-`, `26-`, `29-`) | Écrans aux deux tiers vides : un titre, une phrase, un bouton, puis rien. Ils font « page d'erreur » plutôt qu'« étape ». | Centrer verticalement ou ajouter l'élément manquant : Mochi et le sceau de l'adversaire conseillé (placement), un état vide « Aucune partie en cours » avec un mini-goban (défis). Fait ici pour le placement (marge haute proportionnelle). |
| 3 | 🟠 | Accueil (`02-accueil-*`), Problèmes en 320 (`12b-problemes-page-320-*`) | La tuile « Go du jour » coupe le titre du problème (« Capturer pour se… ») dans les 8 configurations ; en 320, « Problème suivant · Deux pierres … » est coupé aussi. La seule chose qu'on lit est tronquée. | Titre sur 3 lignes dans la tuile, ou « Go du jour n° 5 » en titre et le thème en légende ; « Problème suivant » sur deux lignes en 320. |
| 4 | 🟠 | Revue (`08-revue-*-clair-*`) | La courbe d'avantage est une bande noire posée sur le papier, sans légende : en mode clair c'est le seul bloc sombre de l'écran, et un débutant ne sait pas ce qu'elle représente. | Une légende d'une ligne au-dessus (« Qui mène, coup par coup : Noir en haut, Blanc en bas ») et un fond kaya ou `--surface` à la place du noir pur. |
| 5 | 🟠 | Choix de l'adversaire (`03-adversaires-*`) | « Taille du plateau » et ses trois choix sont à moitié cachés sous le bouton collant « Joue ta première partie », au premier affichage comme au bout du défilement en 320 px. Déjà relevé le 27/09 (UX-09). | Placer le choix de la taille au-dessus de l'échelle des adversaires, juste sous la vedette, ou réserver sous la liste une marge de la hauteur du bouton. |
| 6 | 🟠 | Mon compte connecté (`29-compte-connecte-*`) | « Cote 1500 » est affichée sous le pseudo, alors que la décision de Florian est « aucune cote affichée » (règle 6). | Retirer la ligne `compte.cote` (texte seul dans `src/app/Account.tsx`) ; l'e-mail suffit. Non fait ici : décision de produit à confirmer. |
| 7 | 🟠 | Comptage (`06-comptage-*`) | La bulle de réplique de Pomme (« À toi de voir. », « Rien à jouer. ») chevauche son nom dans l'en-tête ; en 320 px elle couvre « Pomme » presque entièrement. Déjà relevé le 27/09 (UX-11). | Poser la réplique sous l'en-tête (ligne dédiée) ou dans la bulle de Mochi. |
| 8 | 🟠 | 320 × 568 : accueil (`02-accueil-320-*`), création de compte (`22-creer-compte-320-*`), code (`24-code-320-*`) | L'action principale est sous la ligne de flottaison : le bouton « Joue ta première partie » affleure à 568 px, le champ e-mail et le champ du code arrivent après un écran entier de texte. Sur un iPhone SE, le premier écran ne montre pas quoi faire. | Accueil : plateau de 300 px sous 600 px de haut ; compte : replier la carte « ce qui est gardé » ou la passer après le formulaire en 320. |
| 9 | 🟡 | Fin de leçon (`10c-lecon-fin-*`) | Le bouton principal « Entraîne-toi : 3 problèmes sur ce thème » tient sur 2 lignes en 390 et 320 px, en français comme en anglais : seul bouton de l'app dans ce cas. | « Entraîne-toi » en titre du bouton, « 3 problèmes sur ce thème » en légende dessous, ou « 3 problèmes » tout court. |
| 10 | 🟡 | Création de compte (`22c-creer-compte-erreurs-*`) | L'erreur « Entre une adresse e-mail valide. » s'affiche sous la case d'âge et le lien « Tu as moins de 15 ans ? », à 180 px du champ en faute, parce que le même paragraphe sert aussi à l'erreur de la case. | Deux messages : un sous le champ e-mail, un sous la case. |

Aucun 🔴 : aucun parcours clé n'est cassé, aucun défilement horizontal, aucune erreur JavaScript, aucune cible sous 44 px, jamais plus d'une action principale par écran (voir « Mesures »). Pas de blocage de mise en production.

## Mesures automatiques

Voir la section « Mesures » en fin de document.

## Tableau par écran

Colonnes : captures (préfixe de fichier), ce qui marche, défauts (gravité, capture, correctif). Les défauts communs aux 4 configurations ne sont cités qu'une fois ; « 320 » signale ce qui n'apparaît qu'en 320 × 568.

### Premier lancement et consentement (`01-consentement`)

Ce qui marche : fenêtre claire, Mochi présent, deux choix de même poids (correct pour un consentement), lien « Lire les conditions », fond de l'accueil visible derrière le voile dans les deux thèmes.

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟡 | La fenêtre arrive avant tout contenu (déjà noté le 27/09, UX-05) ; en 320 elle occupe tout l'écran, l'accueil n'est plus deviné derrière. | La montrer après la première partie ou la première leçon. |
| 🟡 | Le paragraphe « Sans ton accord, on compte juste les parties… » est en brume, plus petit que le reste : contraste mesuré conforme (au-dessus de 4,5), mais c'est la phrase qui explique le refus, et c'est la moins lisible. | Le garder en 14 px, couleur texte. |

### Accueil (`02-accueil`, `02b-accueil-page`)

Ce qui marche : le goban est l'image d'accueil, un seul bouton en relief (« Joue ta première partie »), le sceau de Pomme, la phrase de personnage, « Changer » discret, deux tuiles de nature différente, « Je sais déjà jouer » en lien. Clair et sombre cohérents. Le plateau est recadré en 320 (lignes 1 et 9 hors cadre), ce qui est voulu.

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟠 | Titre de la tuile « Go du jour » tronqué (« Capturer pour se… »), 8/8 configurations. | Voir n° 3. |
| 🟡 | « Niveau 3 : le goban « Kaya clair » » sous la barre de niveau : une ligne d'explication en brume avant même le goban, qui parle d'une récompense inconnue au premier lancement. | La montrer à partir du niveau 2, ou la mettre dans le Profil. |
| 🟠 | 320 : le bouton principal est sous la ligne de flottaison (le haut du bouton affleure à 568 px). Voir n° 8. | Réduire le plateau d'accueil à 300 px de haut en dessous de 600 px de hauteur, ou retirer la phrase « Elle apprend comme toi… » en 320. |
| 🟡 | Capture `02b` (page entière) : identique à `02` en 390, car la page tient dans l'écran ; en 320 la page défile de 1,5 écran. | — (constat) |

### Choix de l'adversaire (`03-adversaires`)

Ce qui marche : feuille modale propre, vedette avec sceau et bulle, échelle en trois paliers lisible, cadenas, bouton collant visible.

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟠 | « Taille du plateau » à moitié sous le bouton collant. | Voir n° 5. |
| 🟡 | Libellés de paliers en majuscules (« PREMIERS PAS », « ÇA SE CORSE », « LES MAÎTRES »), contre la direction v2 § 7. **Corrigé ici** (`src/ui/accueil.css`). | — |
| 🟡 | Mode clair : les adversaires verrouillés sont grisés en bloc (portrait et nom) : le nom « Renard » se lit mal sur le washi, même si la mesure (élément désactivé) reste conforme. | Garder le nom en couleur texte et ne griser que le portrait. |
| 🟡 | 320 : « Caillou » (débloqué dès le départ) n'a pas de cadenas mais rien ne dit qu'il est jouable tout de suite, alors que Bambou a un cadenas. | Un mot « Prêt » sous Caillou, ou le même cadre que Pomme en pointillés. |

### Partie contre Pomme (`04-partie-debut`, `05-partie-milieu`)

Ce qui marche : grammaire chess.com respectée (adversaire, liste des coups, goban pleine largeur, « Toi », coach, barre d'actions), pierres avec matière, dernier coup marqué, six actions à 44 px qui tiennent en 320, bulle d'intro sous le plateau sans le recouvrir (M6 tient).

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟡 | 390 : entre le bandeau « Toi » et la bulle de Mochi, 130 px de vide ; la bulle est collée à la barre d'actions. | Monter la bulle juste sous « Toi » (`margin-top: auto` retiré), ou agrandir le plateau. |
| 🟡 | La liste des coups coupe son premier élément au bord gauche (« . C3 », « 3. C7 » en 320) sans fondu. | Un masque en dégradé de 16 px à gauche (`mask-image`). |
| 🟡 | Mode clair : les icônes « Indice » (cercle jade clair) et « Annuler » (gris) sont pâles sur le washi, à l'œil sous les 3:1 demandés aux éléments non textuels (non mesuré par le script, qui ne mesure que les textes). | Épaissir le trait ou assombrir le jade des icônes en clair. |
| 🟡 | Les trois points sous « Indice », « Conseil », « Qui mène ? » ne sont pas expliqués (UX-10 du 27/09). | Chiffre (« 3 ») ou info-bulle de Mochi la première fois. |

### Comptage et score (`06-comptage`, `06b-score`)

Ce qui marche : comptage automatique des pierres mortes, deux boutons « Reprendre » / « Valider le score » dont un seul en relief, récit du score en « Toi / Pomme » avec le plateau territoires, « Voir le résultat » en action principale (UX-01 et UX-02 du 27/09 sont résolus).

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟠 | Bulle de réplique sur le nom de Pomme. | Voir n° 7. |
| 🟡 | Le texte « Toi 0, Pomme −100 (komi compris). Les pierres grisées sont comptées comme mortes. » est à moitié caché par la barre d'actions en 390 et totalement en 320 (il faut défiler). | Le mettre dans la bulle de Mochi (une seule phrase à la fois) ou au-dessus de la barre, dans le dock. |
| 🟡 | « Je cherche les pierres mortes… » reste affiché alors que le comptage est fini et que « Valider le score » est actif. | Remplacer par « Pierres mortes trouvées. Valide, ou touche un groupe pour corriger. » |

### Fin de partie (`07-fin`, `07b-fin-page`)

Ce qui marche : le pic émotionnel est réussi dans les deux thèmes : tampon « BATTUE », « Victoire » en 56 px, bilan en deux phrases, Mochi, « Défier Caillou » avec son sceau, pastille XP. En 320 tout tient sans défiler.

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟡 | La pastille « +60 XP dont +20 première fois » chevauche la ligne 9 du plateau et ses coordonnées. | La poser dans la marge au-dessus du plateau (`top: -14px`) ou la fondre après 3 s (c'est déjà le cas, mais la capture la montre en place : elle masque la ligne 9 pendant 3 s). |
| 🟡 | Mode clair : le voile sur le plateau grise les pierres noires en gris moyen : on ne distingue plus noir et blanc sur la ligne 3. | Voile plus léger en clair (`--voile` à 35 % au lieu de 55 %). |

### Revue (`08-revue`, `08b-revue-page`)

Ce qui marche : en-tête « Coup 1 sur 12 », précision, plateau, liste des coups avec coches, Mochi commente, « Rejouer d'ici », « Analyser une autre partie » en lien.

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟠 | Courbe noire sans légende, choquante en clair. | Voir n° 4. |
| 🟡 | « Précision Toi 100 % · Pomme 50 % » pour une partie de 12 coups (UX-13 du 27/09). | Masquer la précision sous 20 coups. |
| 🟡 | 320 : « Revoir ma partie » passe sur 2 lignes dans l'en-tête, et « Toi 100 % · Pomme 50 % » casse avant le point médian (« · Pomme 50 % » seul sur sa ligne). | Titre « Revue » en 320, précision sur deux lignes propres (« Toi 100 % » / « Pomme 50 % »). |
| 🟡 | Mode clair : les numéros de coups de la liste (« 2 », « 3 »…) sont en brume 14 px sur le washi : 3,5:1 mesuré, sous AA. | Numéros en encre à 70 %. |
| 🟡 | « Rejouer d'ici » en action principale dès le coup 1 : ce n'est pas le but d'une revue. | Action principale « Coup suivant » ou « Voir mon moment clé », « Rejouer d'ici » en secondaire. |

### Apprendre, le chemin (`09-apprendre`, `09b-apprendre-page`)

Ce qui marche : le chemin de pierres est dessiné, « Commencer » en relief sur la leçon en cours, sceaux de leçons, chapitres à venir en pointillés, phrase de synchronisation en bas. Clair et sombre très cohérents.

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟡 | La pierre de la leçon 1 (en cours) est un disque gris uni cerclé de jade : ni une pierre noire ni un sceau, elle paraît « vide ». | Une pierre noire à moitié posée, ou le sceau de la leçon dans le cercle. |
| 🟡 | Page entière : la barre de navigation fixe apparaît au milieu de la capture (artefact de capture, pas un défaut). | — |
| 🟡 | « Sept leçons courtes pour jouer ta première partie. » puis 12 leçons listées dans le chapitre : le compte annoncé ne correspond pas au chemin. | « Sept leçons pour les règles, puis cinq pour jouer mieux. » |

### Une leçon (`10-lecon-debut`, `10b-lecon-etape`, `10c-lecon-fin`)

Ce qui marche : barre de progression en 6 segments, titre de leçon avec sceau, Mochi, geste demandé dès l'étape 1 (UX-08 du 27/09 résolu), « Revoir » et « Continuer », écran de fin avec frise de progression et une seule action en relief.

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟠 | 390 : vide de 500 px sous le plateau avant « Continuer ». | Voir n° 1. |
| 🟡 | La barre de navigation reste visible pendant la leçon (UX-06 du 27/09). | La masquer comme en partie. |
| 🟡 | Bouton de pratique sur deux lignes. | Voir n° 9. |

### Entraînement (`11-entrainement`, `11b-entrainement-verdict`)

Ce qui marche : « Entraînement, 1 sur 3 », difficulté en points, consigne de Mochi, verdict d'erreur explicatif en bas avec « Voir un indice ». 320 : le verdict laisse voir le plateau entier.

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟠 | 390 : vide de 550 px sous le plateau. | Voir n° 1. |
| 🟡 | Le verdict d'erreur est un panneau brun-rouge sombre dont la consigne en brume (« Rejoue directement sur le plateau. ») est la ligne la moins lisible, alors que c'est celle qui dit quoi faire. | Consigne en papier, phrase d'explication en brume. |

### Problèmes (`12-problemes`, `12b-problemes-page`, `12c-problemes-tous`)

Ce qui marche : Go du jour en carte avec miniature du plateau et « Résoudre » en relief, « Problème suivant · Première capture », palier, course, « Tous les problèmes », série. Aucune progression ni total dans les problèmes (décision de Florian respectée) ; « Tous les problèmes » liste par palier sans compteur.

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟡 | « TON PALIER » en majuscules d'étiquette (direction v2 § 7). | « Ton palier » en bas de casse. |
| 🟡 | « 1 jour de série » affiché dès le premier passage, avant tout problème résolu : la série paraît offerte. | Afficher la flamme à partir du premier Go du jour réussi. |
| 🟡 | Deux en-têtes « Problèmes » (en-tête d'app à droite, puis titre de section avec pierre) à 1 écran d'écart. | Retirer le mot de l'en-tête d'app quand la section porte le même titre. |
| 🟡 | 320 : « Problème suivant · Deux pierres … » coupé par des points de suspension. | Voir n° 3. |

### Un problème (`13-probleme`, `13b-probleme-verdict`)

Ce qui marche : titre, difficulté, consigne, pierre marquée en vermillon, verdict d'erreur avec explication nommant l'intersection (E4), « Voir un indice ».

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟠 | 390 : vide de 550 px sous le plateau. | Voir n° 1. |
| 🟡 | La croix d'erreur sur la pierre jouée (A1) est blanche sur noir : bien ; mais la pierre reste posée après l'erreur et rien ne dit qu'on peut rejouer tant qu'on n'a pas lu le petit texte brume. | « Rejoue directement sur le plateau. » en couleur texte. |

### Go du jour (`14-go-du-jour`, `14b-go-du-jour-bravo`)

Ce qui marche : bandeau « Ce Go du jour date d'un autre jour… » quand on ouvre un ancien lien, verdict « Bravo » en jade avec pastille XP, « Go du jour n° 5 » en relief, « Partager », « Voir la suite ». En 320 le plateau reste visible au-dessus du verdict (M5 tient).

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟡 | 320 : le bandeau et la bulle de Mochi (3 lignes) poussent le plateau : seules les lignes 2 à 9 sont visibles au chargement, la ligne 1 est sous la barre de navigation. | Bandeau sur une ligne (« Ancien Go du jour. Celui d'aujourd'hui : n° 5 ») en 320. |
| 🟡 | Deux actions pleines dans le verdict (« Go du jour n° 5 » en relief et « Partager » en bouton plein clair) : la seconde ressemble à une action principale en clair. | « Partager » en contour (`.btn` sans fond), comme la direction le prévoit. |

### Course (`15-course-regles`, `15b-course`)

Ce qui marche : règles en 4 lignes, chrono, « C'est parti » en relief, bandeau de course (temps, 3 vies, score).

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟡 | 390 : 500 px de vide entre les règles et le bouton ; trois niveaux d'en-tête empilés (« Go », « Problèmes », « ‹ Course : 3 minutes »). | Bouton juste sous les règles (non collant), et un seul en-tête. |
| 🟡 | Les règles sont quatre cartes identiques à puce vermillon : le « kit de cartes » que la direction v2 écarte. | Une seule surface, liste à puces. |

### Placement (`16-placement`, `16b-placement-verdict`, `16c-placement-fin`, `16d-placement-fin-page`)

Ce qui marche : « Placement, 1 sur 3 », « Passer » discret, verdict sans jugement (« Ce n'est pas grave, on passe au suivant »), fin avec une seule action (« Commence la leçon 1 » ou « Joue contre Renard »).

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟠 | Fin du placement : écran aux deux tiers vide. **Atténué ici** (marge haute proportionnelle, `src/ui/placement.css`). | Ajouter Mochi et le sceau de l'adversaire conseillé (contenu). |
| 🟡 | La bulle de Mochi fait 6 lignes (deux paragraphes) ; en 320 elle pousse le plateau sous la ligne de flottaison (lignes 1 et 2 hors écran). | Deux étapes : « Trois problèmes pour trouver ton niveau. » seul au 1er problème, puis la consigne. |
| 🟡 | La barre de navigation reste visible pendant le placement : un toucher le quitte sans confirmation. | La masquer comme en partie. |

### Profil (`17-profil`, `17b-profil-page`, `17c-profil-connecte`)

Ce qui marche : carte « Invité » ou pseudo avec initiale, niveau, 4 statistiques, badges sur une ligne (UX-16 du 27/09 résolu), liste de liens avec résumés, « Mon compte · Se connecter ».

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟡 | 320 : les 7 badges passent sur deux lignes (6 + 1), le dernier isolé. | Grille de 4 + 3, ou carrousel. |
| 🟡 | « Refaire le placement » en première ligne du menu pour un joueur qui vient de le rater : l'invitation la plus visible du Profil est de recommencer un test. | Le placer après « Réglages ». |
| 🟡 | « Prochain badge : Première partie. Joue contre l'ordi. » : bon, mais « l'ordi » n'est pas le mot de l'app (Pomme). | « Joue contre Pomme. » |

### Réglages (`18-reglages`, `18b-reglages-page`)

Ce qui marche : une carte, sept lignes, segments, interrupteurs à 44 px, goban avec niveaux requis, texte d'aide sous les interrupteurs. En 320 les segments passent sous leur libellé proprement.

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟡 | « Aide de Mochi : Débutants / Toujours / Jamais » : « Débutants » est ambigu (UX-17 du 27/09). **Corrigé ici** : « Au début » / « At first » (`src/content/i18n`). | — |
| 🟡 | « Son » et « Vibrations » sont deux boutons pleins (papier) : on ne voit pas s'ils sont actifs ou non (les deux ont le même rendu actif/inactif que les segments). | Interrupteurs comme « Confirmer au doigt ». |

### Mon compte (`19-compte-sans-service`, `29-compte-connecte`, `29b-compte-connecte-page`)

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟠 | « Cote 1500 » affichée. | Voir n° 6. |
| 🟡 | « Changer de pseudo » sur deux lignes à côté de « Me déconnecter » sur une (390) ; les deux sur deux lignes en 320. | Empiler les deux boutons en pleine largeur. |
| 🟡 | Écran aux deux tiers vide. | Remonter ici le niveau et la série (ce qui est gardé par le compte). |

### Conditions et confidentialité (`20-conditions`, `20b-conditions-page`)

Ce qui marche : deux interrupteurs explicites en tête, « Pas de pub. Tes données ne sont jamais vendues. », sections repliables, « Ce qu'on garde » ouverte. Rien à signaler de visuel ; texte long mais lisible, contraste AA dans les deux thèmes.

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟡 | Les sections « Pourquoi », « Combien de temps », « Tes droits » sont trois cartes identiques avec chevron (kit de cartes). | Une seule surface, séparateurs. |

### Import SGF (`21-import`, `21b-import-page`, `21c-import-erreur`, `21d-import-couleur`)

Ce qui marche : explication en une phrase, « Choisir un fichier .sgf », zone de texte avec exemple, « Lire la partie » en relief, erreur en vermillon sous le champ avec bordure, écran « Quelle couleur avais-tu ? » avec les deux pseudos et le komi expliqué, action désactivée tant qu'aucune couleur n'est choisie.

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟡 | 390 : 400 px de vide entre la zone de texte et le bouton collant. | Bouton non collant juste sous la zone, ou zone plus haute. |
| 🟡 | « Quelle couleur avais-tu ? » : le bouton désactivé « Analyser la partie » mesure 2,3:1 (texte jade foncé sur jade délavé), dans les deux thèmes. État désactivé, toléré par WCAG, mais on ne lit plus ce qu'on va débloquer en choisissant une couleur. | Texte en encre à 60 % sur jade à 40 %. |

### Crée ton compte, connexion, code, pseudo (`22-` à `25-`)

Ce qui marche : Mochi, titre, raison (« Tu as joué tes 3 parties d'essai »), ce qui est gardé en liste à coches, champ e-mail 48 px, case d'âge jamais cochée, bouton inactif tant que la case n'est pas cochée, « J'ai déjà un compte » / « Créer un compte » en lien, « Plus tard ». Code à 6 chiffres large, renvoi avec compte à rebours, « Changer d'adresse ». Pseudo : règles visibles, statut « est libre » / « déjà pris », bouton désactivé si pris. Pas de barre de navigation : écran plein, une seule action.

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟡 | Erreur e-mail loin du champ. | Voir n° 10. |
| 🟡 | Champ en erreur et au focus : double liseré vert (focus) + rouge (erreur) sur le code faux et le pseudo pris. **Corrigé ici** (`src/ui/compte.css`). | — |
| 🟡 | « Connecte-toi » garde la carte « Tout ce que tu as fait ici est gardé » : pour quelqu'un qui a déjà un compte, c'est hors sujet et ça pousse le champ. | Carte seulement en création. |
| 🟠 | 320 : le champ e-mail est sous la ligne de flottaison ; sur l'écran du code, le champ arrive après un écran entier (titre, raison, carte). Voir n° 8. | Replier la carte « ce qui est gardé » en 320, ou la mettre après le formulaire. |
| 🟡 | Boutons inactifs : « Recevoir mon code » (case non cochée) mesure 2,9:1, « C'est mon pseudo » (pseudo pris) 2,1:1, dans les deux thèmes. | Texte en encre à 60 % sur jade à 40 %, comme ci-dessus. |
| 🟡 | Les liens « conditions d'utilisation » et « politique de confidentialité » dans la phrase de la case mesurent 20 px de haut (liens dans le texte, exemptés par WCAG 2.5.8, mais serrés au doigt). | Les sortir de la phrase : une ligne « Conditions · Confidentialité » à 44 px sous la case. |

### Défi par lien (`26-` à `28-`, `30-`)

Ce qui marche : création en une phrase et un bouton, lien copié dans une boîte, liste « Tes parties contre tes amis » avec état et point jade quand c'est à toi, arrivée « Audit_1 te défie ! » avec le plateau vide et le formulaire de compte, partie en différé avec « Ton ami » / « Toi », délai dans la bulle de Mochi, deux actions seulement, lien abîmé avec message clair.

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟠 | Écran de création aux deux tiers vide (sans partie). | Voir n° 2. |
| 🟡 | Partie en différé : 150 px de vide entre « Toi » et la bulle, puis une phrase de règle en brume sous la bulle (« Chacun a 3 jours… ») qui répète la bulle. | Une seule phrase de Mochi ; la règle dans la bulle de création. |
| 🟡 | Le lien copié est tronqué (« …#defi=Ab3_-xYzQQQQ… ») : normal, mais la boîte ressemble à un champ de saisie. | Style de citation (fond `--surface-2`, pas de bordure). |
| 🟡 | « Partie du 1 oct. » : la date n'identifie pas l'adversaire ; après 3 défis, les lignes sont indistinguables. | « Contre Ami_du_go · 1 oct. » quand le pseudo est connu. |

### Anglais (`*-en.jpg`)

L'interface anglaise est complète sur les 60 états : aucun texte français résiduel, aucun débordement supplémentaire. Les défauts ci-dessus sont les mêmes. Points propres à l'anglais :

| Gravité | Défaut | Correctif |
|---|---|---|
| 🟡 | « Play your first game against Pomme » tient en 390 mais passe sur 2 lignes en 320. | « Play Pomme » en 320. |
| 🟡 | « Practice: 3 puzzles on this theme » sur 2 lignes (comme en français). | Voir n° 9. |

## Ce qui a été corrigé dans cette branche

Uniquement des défauts 🟡 de CSS ou de texte, hors Learn, Game, Puzzles et Profil (écran) :

| Fichier | Correctif |
|---|---|
| `src/ui/accueil.css` | Feuille des adversaires : libellés de paliers en bas de casse (plus de majuscules d'étiquette). |
| `src/ui/compte.css` | Champ en erreur et au focus : un seul liseré rouge. |
| `src/ui/placement.css` | Fin du placement : marge haute proportionnelle à l'écran (`clamp(…, 16vh, 140px)`). |
| `src/content/i18n/fr.ts`, `en.ts`, `e2e/langue.spec.ts`, commentaire dans `src/app/Profil.tsx` | Réglage « Aide de Mochi » : « Débutants » → « Au début », « Beginners » → « At first ». |
| `e2e/audit-visuel.spec.ts` (nouveau) | Le parcours de captures et de mesures, relançable. |

## Mesures

Relevées par `e2e/audit-visuel.spec.ts` sur les 60 états × 2 thèmes × 4 configurations (480 mesures). Les textes réservés aux lecteurs d'écran (« Lire le plateau », « Noir joue E5 », « 0 pierre capturée »…, en 1 × 1 px ou hors écran) sont écartés : ils ne se voient pas.

| Mesure | Résultat |
|---|---|
| Défilement horizontal | **0** écran sur 480. |
| Erreurs JavaScript | **0** (parcours libre, compte, défi, deux téléphones). |
| Actions principales (`.cta`, `.btn.primary`) | **Jamais plus d'une** par écran. |
| Cibles sous 44 px | Seulement les deux liens dans la phrase de la case d'âge (« conditions d'utilisation », « politique de confidentialité », 20 px de haut) : liens dans le texte, exemptés par WCAG 2.5.8. Toutes les autres cibles (boutons, champs, interrupteurs, barre de navigation, barre d'actions à six boutons en 320 px) font au moins 44 × 44. |
| Contraste des textes (AA : 4,5, ou 3 pour les grands textes) | Conforme partout, **sauf** : boutons inactifs ou désactivés « Recevoir mon code » (2,9), « Analyser la partie » (2,3), « C'est mon pseudo » (2,1), identiques en sombre et en clair ; numéros de la liste des coups de la revue en mode clair (brume sur washi, 3,5, 14 px). Les mesures « fond incertain » (texte posé sur le bois du goban, sur un dégradé ou une image) ont été vérifiées à l'œil : conformes. |
| Textes coupés (`text-overflow: ellipsis` actif) | Titre de la tuile « Go du jour » sur l'accueil (8/8) ; « Problème suivant · Deux pierres … » en 320. Les compteurs du Profil (« 0/12 », « 0/9 », « Badges, 0 sur 7 ») sont signalés par le script mais entiers à l'œil : ce sont des libellés d'accessibilité dans une boîte à débordement caché. |
| Éléments hors écran | Les boutons « Retour au chemin », « Retour aux problèmes », « Quitter la course » sont détectés hors écran : ce sont les doublons pour lecteur d'écran, placés à gauche ; la liste des coups de la revue défile à l'horizontale (normal). |
| Mouvements réduits | Toutes les captures sont prises avec `prefers-reduced-motion: reduce` : aucune animation en cours n'a troublé une capture (pas de pierre en vol, pas de confettis), les états finaux s'affichent directement. |

Artefacts de capture à ne pas prendre pour des défauts : dans les captures « page entière » (`*-page-*`), la barre de navigation fixe apparaît au milieu de l'image ; l'audit a enjambé minuit, les captures faites après montrent « Go du jour n° 6 » (« L'échelle ») au lieu du n° 5 (« Capturer pour se sauver »).

## Ce qui reste à faire

- Les 8 défauts 🟠 ci-dessus sont dans Learn, Game, Puzzles, Profil ou demandent une décision (cote, ordre des blocs de la feuille) : à répartir entre les agents de ces écrans.
- Le script d'audit est relançable (`AUDIT_VISUEL=<dossier> PW_PORT=<port> npx playwright test audit-visuel --workers 1`) : à rejouer après les corrections pour des captures « après ». Avec 2 workers, l'étape de partie contre Pomme (passe puis comptage) peut dépasser ses 30 s d'attente : un seul worker, ou relancer les étapes `01,04` avec `AUDIT_ETAPES=01,04`.
- Les mesures de contraste ignorent les éléments non textuels (icônes, bordures, états de focus) : à compléter à la main pour la barre d'actions en mode clair.
