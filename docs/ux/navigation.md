# Navigation : quand montrer l'en-tête et la barre du bas

Règle fixée par #465 (constat de #460 : en passant de « En direct » à « Partie lente », l'en-tête « Mochi Go » et la barre du bas apparaissaient puis disparaissaient).

## La règle

1. **Écrans de choix et d'attente : en-tête et barre du bas, comme l'accueil.** Le joueur choisit, règle ou attend. Il doit pouvoir partir ailleurs d'un toucher, et savoir où il est (l'onglet actif, le titre).
2. **Écrans de partie et activités : plein écran.** Ni en-tête ni barre du bas, comme chez chess.com et Duolingo. Le plateau prend la place. Le bilan de fin et la revue d'une partie restent en plein écran : ils en font partie.
   **Depuis #646 (lot N2, décision F3 de Florian), toutes les activités suivent cette règle** : leçon (et sa série de 3 problèmes), problème (Go du jour, suivant, série par thème, grille), course, partie de découverte, introduction des règles, placement (« Ton niveau de départ ») et séance de révisions. Une activité a **une seule sortie** : « ‹ » en haut à gauche (`BoutonRetour`), qui ramène à l'écran d'origine, défilement et focus compris ; le retour du système (`src/app/retourSysteme.ts`) touche ce même bouton. Un onglet ne peut plus être touché par erreur pendant une leçon ou un problème : rien ne se perd. Confirmation seulement là où quitter ferait perdre quelque chose (la partie) ; ailleurs, la progression est déjà gardée (étape de la leçon, moment de la découverte, essai noté).
3. **Écrans de tâche : barre « ‹ titre », barre du bas.** Depuis #509 (lot L2) : jouer en ligne (direct, lentes), défier un ami, revue d'une partie passée, sous-vues du Profil. La barre « ‹ titre » (`EnteteEcran`, `src/ui/BoutonRetour.tsx`) remplace le logo « Mochi Go » à l'écran ; la barre du bas reste. Hors accueil, l'en-tête ne répète plus le nom de l'onglet : la barre du bas le dit déjà.
   *Avant #646*, la règle 3 valait aussi pour les lecteurs de leçon et de problème (« exercices courts, la barre reste ») : un onglet touché par erreur les abandonnait sans rien dire. Elle est inversée par la règle 2.
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
| Placement (« Ton niveau de départ ») et son résultat : « ‹ », et « Passer » pendant les problèmes | non | non |
| Partie contre l'ordi, à deux, guidée, et leur fin | non | non |
| Partie en direct, son bilan et sa revue | non | non |
| Partie d'un défi ou partie lente | non | non |
| Leçon, problème, série de problèmes, course | barre du lecteur (« ‹ ») | non |
| Partie de découverte, introduction des règles, séance de révisions | barre du lecteur (« ‹ ») | non |
| « Crée ton compte », « Choisis ton pseudo » | non | non |

## Dans le code

- `src/app/App.tsx` : `enPartie` et `activite` décident du plein écran (`plein`). Le direct n'y entre que pour la partie (`directPlein`), que l'écran du direct signale avec `onPlein` (`src/app/Direct.tsx`), avant la peinture pour éviter un clignement. Problèmes signale de même un problème ou une course ouverts (`onActivite`, `src/app/Puzzles.tsx`).
- Sortie d'une activité (#646) : `par(maison, rendre, a)` pose l'activité sur l'écran d'origine, gardé monté et caché, même dans le même onglet (`a`) ; sa sortie le retrouve tel quel. Le focus va au titre de l'activité à l'entrée (`src/ui/titreFocus.ts`) et revient à ce qui l'a ouverte à la sortie. Dans Problèmes, la liste est remontée : défilement et bouton d'origine sont retrouvés par `Puzzles.tsx`.
- Sans en-tête, un `h1` « Mochi Go » reste pour les lecteurs d'écran (#461). Avec une barre « ‹ titre » (`.ecran-tete`, `.revue-tete`, `.lecteur-tete`, `.tous-tete`), `src/ui/app.css` masque l'en-tête à l'écran seulement : son `h1` reste lu.
- Bouton retour : un seul composant (`BoutonRetour`) et un seul style (`.retour` dans `src/ui/app.css`) : rond de 44 px, chevron de 24 px en encre pleine, aligné sur la gouttière.
- Le titre de l'onglet du navigateur suit l'écran (`src/app/titreEcran.ts`, WCAG 2.4.2) : « Partie lente · Mochi Go », « Partie contre Pomme · Mochi Go ». L'accueil garde « Mochi Go : apprendre et jouer au go ».
- Test : `e2e/navigation.spec.ts` (direct et lentes : en-tête et barre présents au choix et à l'attente, absents en partie ; activités sans barre du bas, sortie vers l'origine). Les parcours qui changent d'onglet après une activité passent par l'aide `onglet()` de `e2e/onglet.ts`, qui sort d'abord de l'activité par « ‹ ».

## Barre du bas au zoom 200 %

Quand un onglet est trop étroit pour son nom entier (zoom 200 %, texte agrandi), il montre un libellé court : « Appr. » et « Probl. » (« Puzz. » en anglais). Le libellé court commence comme le nom entier, pour que ce qu'on lit reste dans le nom accessible (WCAG 2.5.3), et le lecteur d'écran entend toujours le nom entier. La bascule se mesure sur l'onglet, en em (`@container` dans `src/ui/nav.css`) : elle suit aussi bien la largeur de l'écran que la taille du texte.
