# Audit d'accessibilité WCAG 2.1 AA — octobre 2026 (issue #461)

Périmètre : parcours principaux. Première ouverture, accueil et modes, partie contre l'ordi et fin de partie, revue, Apprendre et leçons, problèmes et Go du jour, Profil, Réglages, compte et connexion. Les écrans récents (statistiques, étude, parties lentes, direct, semaine, partage, signaler, rejouer mes erreurs, réglages du plateau) relèvent de #460.

Conditions : build `VITE_E2E=1` de la branche `a11y-461`, Chromium, 390 × 844 (projet Playwright `iphone`), `fr-FR`, thème « auto » en sombre puis en clair. Gravité : 4 bloquant · 3 majeur · 2 mineur · 1 cosmétique.

## Méthode

- **Outil** : axe-core 4.13 via `@axe-core/playwright` (devDependency). Règles `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`. Le test passe sur 25 états d'écran, en sombre et en clair : `e2e/a11y-axe.spec.ts`. Licence MPL-2.0 : c'est un copyleft par fichier, qui ne s'applique qu'aux fichiers d'axe eux-mêmes. Il est acceptable pour un outil de test qui n'est pas distribué : axe n'est importé que par `e2e/` et n'est pas dans le bundle (vérifié dans `dist/`).
- **Limite d'axe corrigée dans le test** : le fond de page est un dégradé (le halo de lampe). axe classait donc presque tous les contrastes en « à revoir », sans les vérifier. Pendant la mesure, le halo est remplacé par sa couleur la plus forte à l'écran, en aplat : c'est le pire cas. Les coordonnées du plateau (texte SVG posé sur l'image du bois) sont mesurées au pixel dans un test à part.
- **Revue manuelle**, avec des scripts Playwright jetables : ordre du Tab et focus visible sur 12 écrans, feuilles et menus au clavier (focus, Échap, retour du focus), titres et repères, annonces du plateau, cibles sous 44 px, animations actives sous `prefers-reduced-motion: reduce`, zoom 200 % (fenêtre CSS de 195 × 422 px, polices web bloquées) et espacement du texte WCAG 1.4.12.
- **Limites** : pas de VoiceOver ni de TalkBack réels. Le lecteur d'écran est évalué à partir de l'arbre d'accessibilité et du code. Pas de test avec des joueurs.

## Trouvé et corrigé

| # | Écran | Défaut | WCAG | G | Correction |
|---|---|---|---|---|---|
| 1 | Tous les plateaux | Coordonnées (A–J, 1–9) en encre à 70 % : de 2,35 à 3,2:1 sur le bord vignetté du kaya (mesuré au pixel), 2,5:1 sur l'ardoise. Le test unitaire mesurait l'encre pleine sur le bois du centre. | 1.4.3 | 3 | Encre pleine et plus foncée sur les bois clairs (kaya et coquillage ≥ 5,1:1, kaya clair ≥ 6,9:1). Sur l'ardoise, ni le noir ni le blanc n'atteignent 4,5:1 : liseré clair sous les lettres (`coordLisere`, 7,9:1). Le schéma de l'aide n'atténue plus l'encre. Test au pixel pour chaque bois, test unitaire contre le bois du bord. `src/ui/boardArt.ts`, `src/ui/Board.tsx`, `src/ui/aide.css`. |
| 2 | Partie, zoom 200 % | Barre d'actions sur une ligne en 195 px : libellés superposés, « Indice » coupé à gauche, cibles d'environ 22 px. | 1.4.10, 2.5.5 | 3 | Sous 300 px : deux rangées (les aides, puis « Passer » et « Plus »), toutes les cibles à 44 px ou plus, hauteur réservée en bas de page. `src/ui/partie.css`. |
| 3 | Partie, zoom 200 % | Noms coupés (« T… », « Pom… ») et rang coupé dans les bandeaux. | 1.4.10 | 2 | Sous 300 px : le mot « prisonniers » (déjà caché aux lecteurs d'écran) disparaît, le couvercle passe sous le nom s'il le faut, le rang va à la ligne. `src/ui/partie.css`. |
| 4 | Revue (parcours) | Flèches « Coup précédent / suivant » : triangles noirs pleins sans trait, invisibles en sombre (relevé par l'agent de #460). | 1.4.11 | 3 | Chevrons au trait, de la couleur du texte. `src/ui/revue.css`. |
| 5 | Revue (parcours) | Pastille d'avance « +5 » : la phrase « Après ce coup, tu mènes de 5 points » était un `aria-label` sur un `<span>` sans rôle (signalé par axe : `aria-prohibited-attr`). Les lecteurs d'écran ne la lisent pas de façon fiable. | 4.1.2 | 2 | Texte visible `aria-hidden` et phrase en `.sr-only`. `src/app/Revue.tsx`. |
| 6 | Problèmes, Apprendre (« Tes erreurs à rejouer ») | Même défaut sur le compteur « 1 à rejouer ». | 4.1.2 | 1 | Même correction. `src/ui/MesErreurs.tsx`. |
| 7 | Partie, fin de partie, écrans de compte | Aucun titre `h1` (l'en-tête est masqué). L'écran de partie n'avait aucun titre (déjà signalé le 27/09). | 1.3.1, 2.4.6 | 2 | `h1` « Mochi Go » masqué visuellement quand l'en-tête est caché. `h2` masqué « Partie contre Pomme » (ou « Partie à deux ») sur l'écran de partie. `src/app/App.tsx`, `src/app/Game.tsx`, i18n FR et EN. |
| 8 | Profil, zoom 200 %, polices de secours | Le bouton « Aide » de l'en-tête sortait de 10 px à droite (retrait de −14 px). Relevé par l'agent de #460. | 1.4.10 | 2 | Sous 300 px : plus de retrait, le titre et « Aide » peuvent passer l'un sous l'autre. `src/ui/profil.css`. |
| 9 | Réglages › Apparence | Étiquettes « Niv. 3 / 5 / 8 » sous les gobans en 10 px. Relevé par l'agent de #460. | 1.4.4 (lisibilité) | 1 | 12 px gras. `src/ui/profil.css`. |

## Vérifié conforme (aucun défaut)

- **axe-core** : 0 violation sur les 25 états d'écran, en clair et en sombre, une fois les points 1 à 7 corrigés. Avant les corrections, on comptait 3 contrastes (voir « Reste », point A) et 1 `aria-prohibited-attr`.
- **Clavier** : chaque écran se parcourt au Tab dans l'ordre visuel, et la barre de navigation vient en dernier. Le focus est visible partout (contour de 3 px). Le plateau est une grille focalisable (flèches, puis Entrée pour poser), et « Lire le plateau » est atteignable. Feuilles « Ton adversaire », « Plus » des modes et Aide : le focus y entre, Échap ferme la feuille et le focus revient au bouton d'origine. Le menu « Plus » de la partie se comporte de même. Une partie complète se joue au clavier (`e2e/clavier.spec.ts`).
- **Lecteur d'écran** : les coups sont annoncés par une zone `aria-live` du plateau (« Pomme a joué C3 »), avec les prises (« … et prend 2 pierres ») et l'atari expliqué (`src/ui/boardA11y.ts`, tests unitaires). Mochi parle en `aria-live="polite"`, et « Qui mène ? » et « Abandonner » ont leurs zones `status`. Les coups de la revue sont des boutons nommés (« Coup 6, E7, Gaffe »).
- **Contrastes** : textes des écrans à 4,5:1 ou plus dans les deux thèmes, mesurés par axe (halo en aplat) et par `e2e/mesures.ts`.
- **Cibles** : aucune cible sous 44 × 44 px en 390 px sur les 12 écrans mesurés.
- **Mouvements réduits** : aucune animation en cours sous `prefers-reduced-motion: reduce`, sur tous les écrans mesurés.
- **Zoom 200 %** : aucun défilement horizontal, sur aucun écran.

## Reste

| # | Écran | Point | WCAG | G | Pourquoi pas maintenant |
|---|---|---|---|---|---|
| A | Accueil, pseudo, fin de partie (clair) | `--accent-texte` (#17744D) et `--recompense-texte` (#8A5A00) tombent à 4,50 et 4,63:1 sur le haut du halo, en clair. C'est conforme, mais sans marge. | 1.4.3 | 1 | Ce sont des jetons partagés par toute l'app : à foncer d'un cran dans une PR de design, avec un nouveau contrôle des captures. Le test axe protège déjà le seuil. |
| B | Barre de navigation, zoom 200 % | « Apprendre » et « Problèmes » sont tronqués (« App… »). L'icône reste, le nom accessible est entier. | 1.4.10 | 2 | Troncature choisie dans #121. Une vraie solution demande un libellé court ou une barre sans libellé au zoom : c'est une décision de design. |
| C | Accueil, Profil (espacement 1.4.12) | Avec l'espacement de texte forcé, deux sous-titres sont coupés par des points de suspension : « Remonte vers le centre » (tuile Go du jour) et « Précision, erreurs, bilan » (Profil). | 1.4.12 | 1 | Ce sont des sous-titres secondaires : le nom accessible de la tuile reste complet. |
| D | Toute l'app | `document.title` ne change pas d'un écran à l'autre (« Mochi Go : apprendre et jouer au go »). | 2.4.2 | 1 | C'est conforme pour une app d'une seule page. Un titre par écran aiderait à la navigation, mais demande de toucher `App.tsx` sur tous les écrans, y compris ceux de #460. |
| E | Leçon, problème, zoom 200 % | Le retrait optique du bouton « Retour » (−8 px, profil.css) le sort de 2 px à gauche de l'écran : 42 px de cible restent visibles. | 2.5.5 | 1 | Ce retrait aligne l'en-tête du lecteur. Le supprimer fait déborder l'en-tête de 4 px (e2e/zoom.spec.ts) : à revoir avec la mise en page de l'en-tête. |
| F | Feuilles modales | Le Tab sort de la feuille vers l'interface du navigateur avant d'y revenir. C'est le comportement natif de `<dialog>` en modal : rien n'est atteignable sous la feuille. | 2.4.3 | 0 | Pas un défaut. |
| G | Tous | VoiceOver (iOS) et TalkBack (Android) réels non testés, en particulier la lecture du plateau-grille et le débit des annonces pendant une partie rapide. | 4.1.2, 4.1.3 | — | Demande un appareil. À faire lors de la recette Capacitor. |

## Tests ajoutés

- `e2e/a11y-axe.spec.ts` (15 tests, environ 40 s) : axe sur les écrans clés en clair et en sombre ; coordonnées lisibles sur les 4 bois (au pixel) ; partie et Profil/Réglages à 195 px avec les polices web bloquées ; flèches de la revue. `AXE_INCOMPLETS=1` affiche aussi ce qu'axe ne sait pas trancher.
- `src/ui/themesGoban.test.ts` : l'encre des coordonnées est mesurée contre le bois du bord, ou contre le liseré.

## Composants partagés modifiés (signalé à #460)

`src/ui/Board.tsx` et `src/ui/boardArt.ts` (encre des coordonnées : visible sur tous les plateaux, y compris l'aperçu des réglages du plateau). `src/ui/partie.css` (barre d'actions et bandeaux sous 300 px : la partie en direct utilise la même barre). `src/app/App.tsx` (`h1` masqué). `src/ui/profil.css` (en-tête « Ton parcours » et `.pastille-niveau`). #460 a de son côté changé `.sous-vue h2` dans le même fichier : à garder en tête à la fusion.
