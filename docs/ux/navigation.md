# Navigation : quand montrer l'en-tête et la barre du bas

Règle fixée par #465 (constat de #460 : en passant de « En direct » à « Partie lente », l'en-tête « Mochi Go » et la barre du bas apparaissaient puis disparaissaient).

## La règle

1. **Écrans de choix et d'attente : en-tête et barre du bas, comme l'accueil.** Le joueur choisit, règle ou attend. Il doit pouvoir partir ailleurs d'un toucher, et savoir où il est (l'onglet actif, le titre).
2. **Écrans de partie : plein écran.** Ni en-tête ni barre du bas, comme chez chess.com. Le plateau prend la place, et le bouton « ‹ » du bandeau ramène à l'accueil. Le bilan de fin et la revue de cette partie restent en plein écran : ils en font partie.
3. **Lecteurs de leçon et de problème** : leur barre (retour, étapes) remplace l'en-tête, et la barre du bas reste. Ce sont des exercices courts, pas une partie.
   **Depuis #509 (lot L2), la même règle vaut pour tout écran de tâche** qui a sa barre « ‹ titre » : jouer en ligne (direct, lentes), défier un ami, revue, « Rejouer mes erreurs », révisions, course, sous-vues du Profil. La barre « ‹ titre » (`EnteteEcran`, `src/ui/BoutonRetour.tsx`) remplace le logo « Mochi Go » à l'écran ; la barre du bas reste. Hors accueil, l'en-tête ne répète plus le nom de l'onglet : la barre du bas le dit déjà.
4. **Écrans de compte bloquants** (« Crée ton compte », « Choisis ton pseudo ») : plein écran, une seule action.

Deux écrans de la même famille suivent toujours la même règle. Une bascule entre eux (« En direct » / « Partie lente ») ne change donc ni l'en-tête ni la barre.

## Écran par écran

| Écran | En-tête | Barre du bas |
|---|---|---|
| Accueil, Apprendre (chemin), Problèmes (liste), Profil | oui | oui |
| Sous-vues du Profil (Réglages, Mon compte, Mes parties…) | barre « ‹ titre » | oui |
| Jouer en ligne, « En direct » : choix, attente, attente après des parties quittées | barre « ‹ titre » | oui |
| Jouer en ligne, « Partie lente » : choix, recherche, liste | barre « ‹ titre » | oui |
| Défier un ami : liste | barre « ‹ titre » | oui |
| Défier un ami : arrivée par un lien | oui | oui |
| Partie partagée (lecture seule, revue) | barre « ‹ titre » | oui |
| Placement | oui | oui |
| Partie contre l'ordi, à deux, guidée, et leur fin | non | non |
| Partie en direct, son bilan et sa revue | non | non |
| Partie d'un défi ou partie lente | non | non |
| Leçon, problème, série de problèmes | barre du lecteur | oui |
| « Crée ton compte », « Choisis ton pseudo » | non | non |

## Dans le code

- `src/app/App.tsx` : `enPartie` décide du plein écran. Le direct n'y entre que pour la partie (`directPlein`), que l'écran du direct signale avec `onPlein` (`src/app/Direct.tsx`), avant la peinture pour éviter un clignement.
- Sans en-tête, un `h1` « Mochi Go » reste pour les lecteurs d'écran (#461). Avec une barre « ‹ titre » (`.ecran-tete`, `.revue-tete`, `.lecteur-tete`, `.tous-tete`), `src/ui/app.css` masque l'en-tête à l'écran seulement : son `h1` reste lu.
- Bouton retour : un seul composant (`BoutonRetour`) et un seul style (`.retour` dans `src/ui/app.css`) : rond de 44 px, chevron de 24 px en encre pleine, aligné sur la gouttière.
- Le titre de l'onglet du navigateur suit l'écran (`src/app/titreEcran.ts`, WCAG 2.4.2) : « Partie lente · Mochi Go », « Partie contre Pomme · Mochi Go ». L'accueil garde « Mochi Go : apprendre et jouer au go ».
- Test : `e2e/navigation.spec.ts` (direct et lentes : en-tête et barre présents au choix et à l'attente, absents en partie).

## Barre du bas au zoom 200 %

Quand un onglet est trop étroit pour son nom entier (zoom 200 %, texte agrandi), il montre un libellé court : « Appr. » et « Probl. » (« Puzz. » en anglais). Le libellé court commence comme le nom entier, pour que ce qu'on lit reste dans le nom accessible (WCAG 2.5.3), et le lecteur d'écran entend toujours le nom entier. La bascule se mesure sur l'onglet, en em (`@container` dans `src/ui/nav.css`) : elle suit aussi bien la largeur de l'écran que la taille du texte.
