# Recette du matin du 28/09/2026 (issue #247)

Périmètre : l'app telle qu'elle sera après la fusion de la nuit, branche `origin/assemblage-nuit` à `6689579` (#235, #237, #228, #232, #241, #167…). **Build de production** (`vite build`, sans `VITE_E2E`), servi par `vite preview` sur le port 4802 ; Chromium de `/opt/pw-browsers`, locale `fr-FR`, fuseau Europe/Paris, écran tactile émulé, agent Safari iOS. Aucun paramètre de test : Pomme joue à son vrai rythme, le komi est le vrai (0,5), le Go du jour est celui du jour.

| Config | Taille | Thème | Mouvements |
|---|---|---|---|
| `sombre-390` | 390 × 844 | sombre | normaux |
| `clair-390` | 390 × 844 | clair | normaux |
| `clair-320` | 320 × 640 | clair | réduits |
| `sombre-320` | 320 × 640 | sombre | réduits |

Horloge simulée : 28/09 7 h 40 (jour 1), 29/09 8 h 10 (lendemain), 02/10 19 h (retour après 3 jours sans ouvrir l'app).

Parcours joués de bout en bout, dans les 4 configurations, stockage vide au départ :

- **A. Parcours principal** : premier lancement (fenêtre de consentement), accueil, première partie contre Pomme (16 coups puis passes, avec l'avertissement de Mochi) jusqu'au récit du score, écran de fin, revue ; leçon 1 (geste faux, réponse fausse, capture) puis pratique (3 problèmes) ; Go du jour raté puis aide (indice, « Voir pourquoi », « Voir la réponse ») ; ancien lien `?go-du-jour=1` ; Profil et Réglages ; lendemain ; retour après 3 jours.
- **B. Passes précoces** : 2 coups puis « Passer » (avertissement, puis « Passer » dans la bulle), score, fin, revue ; Go du jour réussi du premier coup ; « Problème suivant » réussi ; le lendemain, Révision du jour.
- **C. Leçon 8** (bases finies) : chemin avec le chapitre 2, les 6 étapes avec les trois réfutations, fin de leçon, chemin « tout est fait ».
- **D. `?lang=en`** : premier lancement, accueil, partie, Apprendre, leçon 1, Problèmes, Profil, Réglages.

Sur chaque écran (192 captures), un script mesure : débordement horizontal, cibles de moins de 44 px (hors intersections du plateau), textes coupés ou hors écran, chevauchements avec un élément fixe, fêtes affichées en même temps (confettis, fête de niveau, pastille XP, glaçon, dialogues), contraste AA du texte sur son fond réel, restes d'anglais et vouvoiement, erreurs JavaScript (`pageerror` et `console.error`). Chaque signalement a été relu sur la capture ; les faux positifs (texte réservé aux lecteurs d'écran, listes qui défilent à l'horizontale, fenêtre modale de consentement, « Continue ! » qui est du français) sont écartés.

Gravité (Nielsen) : 1 cosmétique · 2 mineur · 3 majeur (à corriger avant diffusion large) · 4 bloquant.

## Verdict

**Aucun parcours clé cassé : pas de blocage de mise en production.** Les 4 parcours passent dans les 4 configurations. Aucune erreur JavaScript, aucun débordement horizontal, aucune cible sous 44 px, aucun contraste sous AA, jamais deux fêtes en même temps. Un seul chevauchement réel (M9, cosmétique). Chargement à froid : 1,1 à 1,2 s.

Validation locale (la CI GitHub est bloquée par le quota, elle fait foi ici) : `tsc -b` vert, `eslint .` 0 erreur (9 avertissements existants), Vitest complet 6 184 tests verts, Playwright complet vert : 198 tests passés, 16 ignorés (dont les 2 nouveaux de `e2e/recette-matin.spec.ts`, rouges avant le correctif M1).

| # | Défaut | Gravité | Écran | Qui corrige |
|---|---|---|---|---|
| M1 | Go du jour fait : le bouton flottant « Problème suivant » passait sur deux lignes, titre coupé à côté (« Premi… ») | 2 | Problèmes | **corrigé ici** (`src/ui/apprendre.css`, test `e2e/recette-matin.spec.ts`) |
| M2 | Pas de Révision du jour le lendemain pour le débutant type (leçon 1, pratique, Go du jour) | 2 | Problèmes, J+1 | `revision.ts` / `rediteAppareil.ts` (agent de #237) |
| M3 | Un Go du jour qui reprend une étape de leçon est compté comme redite même si le joueur n'a jamais fait la leçon | 2 | Révision J+1 | `Puzzles.tsx` ligne 204 (agent de #237) |
| M4 | Passes précoces : après 2 coups chacun, la partie finit en « Défaite de 0,5 point · Perdu de peu. La prochaine fois sera la bonne ! » | 2 | Fin de partie | `Game.tsx` / textes de fin (agent de #235) |
| M5 | 320 px : le verdict « Bravo » du Go du jour couvre le bas du plateau, la pierre gagnante (E3) est cachée | 2 | Go du jour | `apprendre.css` (verdict) + design |
| M6 | 320 px : la bulle de Mochi (but et komi) recouvre les lignes 1 et 2 du plateau au début de la première partie | 1 | Partie | `partie.css` (suite de R1) |
| M7 | `?lang=en` : les contenus (leçons, titres des problèmes, chemin) restent en français sous une interface anglaise | 2 | Apprendre, leçon, Problèmes | contenu (#167) ; garder `DETECTION_APPAREIL = false` |
| M9 | Fin de la pratique, « Retour au chemin » : la carte « Niveau 2 ! » couvre le titre « Les bases » pendant environ 3 s (mouvements normaux) | 1 | Apprendre | `Niveau.tsx` (suite de R6, #207) |
| M8 | 320 px : dans le verdict, le lien « Problème suivant » passe sur deux lignes à côté de « Voir la suite » | 1 | Go du jour, problème | `apprendre.css` |

Déjà connus et confirmés : le comptage manuel « Valider le score » apparaît encore à la fin des parties contre Pomme (captures A07, B03) ; l'ancien lien `?go-du-jour=1` renvoie au Go du jour d'aujourd'hui avec « Le Go du jour a changé » (voulu).

Vérifié sans défaut : avertissement de passe (#235) au-dessus de la barre d'actions dans les 4 configs, « Jouer encore » et « Passer » à 44 px et plus ; pas de « Réessayer » en leçon ni en problème (#237 N6), l'indice est un lien ; aide par marches (indice, « Voir pourquoi », réponse) ; leçon 8 complète avec ses trois réfutations, sans confettis ni pratique, « Tout est fait. La suite arrive bientôt. » ; chemin sans chevauchement (#232) en 320 et 390 ; Profil « 1/8 leçon » (#241) ; Réglages lisibles en 320 ; retour après 3 jours : « Te revoilà ! On reprend en douceur ? », rien de perdu, pas de reproche ; une seule pastille XP à la fois, jamais en même temps qu'une fête de niveau.

## Détail des défauts

### M1. « Problème suivant » sur deux lignes une fois le Go du jour fait (gravité 2, corrigé)

Étapes : 390 × 844, résoudre le Go du jour, revenir aux problèmes.

Constaté : le bouton devient l'action principale flottante (`.cta.continuer`, police plus grande). « Problème suivant » passait sur deux lignes et le titre, à côté, était coupé (« · Premi… »). Le verbe de l'action principale était le moins lisible de l'écran.

Correctif : `white-space: nowrap` sur `.continuer`. Le verbe reste sur une ligne, seul le titre s'abrège (le nom accessible garde le titre complet). Test : `e2e/recette-matin.spec.ts` (390 et 320 px), rouge avant le correctif, vert après.

Capture (après correctif, en 320 px, cas le plus serré) : `captures/recette-matin/m1-apres-probleme-suivant-une-ligne-clair-320.jpg`.

### M2. Pas de révision le lendemain pour le débutant type (gravité 2)

Étapes : jour 1, leçon 1, « Entraîne-toi » (3 problèmes réussis), Go du jour vu avec la réponse. Jour 2 (29/09), Problèmes.

Constaté : pas de carte « Révision du jour ». Les 3 problèmes de pratique sont des « redites » (#237 N3) et sautent J+1 ; le Go du jour vu avec l'aide n'est pas « réussi ». La première révision arrive au jour 4 (« Capture au bord », capture `a43`). Le parcours du 2e jour, le plus fragile pour la rétention, n'a donc que le Go du jour (n° 3, « Double atari », Moyen) et la leçon 2.

Attendu : au moins un exercice facile à revoir à J+1. Piste : ne sauter J+1 que si le joueur a au moins un autre problème à revoir ; sinon, proposer la redite. À trancher par le design (#237).

Capture : `m2-lendemain-sans-revision-sombre-390.jpg`.

### M3. Go du jour compté comme redite sans la leçon (gravité 2)

Étapes : stockage vide, ne pas ouvrir de leçon, résoudre le Go du jour n° 2 « Vers le bord » (E3) du premier coup. Le lendemain, Problèmes.

Constaté : « Vers le bord » ne revient pas en révision. `Puzzles.tsx` (ligne 204) appelle `noterRediteAppareil` dès que le problème reprend une étape de n'importe quelle leçon (`repriseDeLecon`), que le joueur ait fait cette leçon ou non. Pour lui, ce n'était pas une redite.

Attendu : ne noter la redite que si la leçon concernée est commencée (`go.lecons.v1`).

### M4. Passes précoces : « Défaite de 0,5 point, perdu de peu » (gravité 2)

Étapes : première partie, jouer 2 coups, « Passer », puis « Passer » dans la bulle de Mochi.

Constaté : Pomme passe aussitôt (#235), le comptage manuel s'affiche (« Toi 0, Pomme 0,5 »), puis « Défaite de 0,5 point sur 9 × 9 » et Mochi dit « Perdu de peu. La prochaine fois sera la bonne ! ». Le débutant qui a passé par erreur ou par curiosité perd sa première partie sur le komi, qu'il n'a pas eu le temps de comprendre, et le message le félicite presque.

Attendu : pour une partie de moins de 10 coups, un texte qui explique (« La partie s'arrête quand vous passez tous les deux. Le plateau était vide : le komi a fait la différence. ») et propose de rejouer. Idéalement, ne pas compter cette partie dans le bilan contre Pomme.

Capture : `m4-passes-precoces-defaite-sombre-390.jpg`.

### M5. Le verdict du Go du jour cache la pierre gagnante en 320 px (gravité 2)

Étapes : 320 × 640, Go du jour n° 2, jouer E3.

Constaté : le panneau « Bravo, c'est le bon coup ! » (+30 XP, Partager, Voir la suite, Problème suivant) monte jusqu'à la ligne 5 : E3 et la pierre blanche en E2 sont dessous. Le joueur ne voit pas ce qu'il vient de réussir, au moment de la récompense. En 390 × 844, tout est visible.

Piste : sur les écrans bas, plateau plus petit pendant le verdict, ou verdict compact (une ligne + boutons) qui laisse les 4 dernières lignes visibles.

Capture : `m5-verdict-cache-la-pierre-clair-320.jpg`.

### M6. La bulle de Mochi recouvre le bas du plateau au premier coup en 320 px (gravité 1)

Étapes : 320 × 640, premier lancement, « Joue ta première partie ».

Constaté : suite du correctif R1 (#207), l'annonce du but et du komi se lit sans défiler, mais elle flotte sur les lignes 1 et 2. Le premier coup se joue au centre, donc rien n'est bloqué ; c'est le premier écran de jeu d'un débutant sur un petit téléphone.

Capture : `m6-mochi-sur-le-plateau-clair-320.jpg`.

### M7. `?lang=en` : interface anglaise, contenus français (gravité 2)

Constaté : barre du bas, accueil, Problèmes, Profil, Réglages et boutons sont en anglais ; le chemin (« Les bases », « Sept leçons courtes… »), les titres des leçons et des problèmes (« Vers le bord », « Libertés et capture ») et les consignes de leçon (« Pose ta pierre au point vert ») restent en français. Ce n'est pas une régression (la détection de la langue de l'appareil est coupée, `?lang=en` n'est qu'un aperçu), mais il ne faut pas l'activer avant la traduction des contenus.

Capture : `m7-anglais-lecon-en-francais-clair-320.jpg`.

### M8. « Problème suivant » sur deux lignes dans le verdict en 320 px (gravité 1)

Même famille que M1, dans le verdict d'un problème : les deux liens « Voir la suite » et « Problème suivant » se partagent 288 px, le second passe sur deux lignes. Pas corrigé ici : un `nowrap` ferait déborder la rangée ; il faut les empiler sous 360 px.

### M9. « Niveau 2 ! » sur le titre du chemin après la pratique (gravité 1)

Étapes : 390 × 844, mouvements normaux, stockage vide. Première partie, leçon 1, « Entraîne-toi », 3 problèmes, « Retour au chemin ».

Constaté : le passage au niveau 2 (pris pendant la pratique) est fêté à l'arrivée sur le chemin ; la carte couvre « Go » et « Les bases » environ 3 s. R6 (#207) a réglé le cas du problème isolé (la fête attend la fin du problème et se ferme au changement d'écran), pas celui de la fin d'une série de pratique. Rien n'est bloqué ; elle a disparu 3,5 s plus tard.

Capture : `m9-fete-niveau-sur-le-chemin-sombre-390.jpg`.

## 10 captures pour Florian

Les écrans qui montrent le mieux le travail de la nuit, dans `docs/qa/captures/recette-matin/` :

1. `01-accueil-premier-lancement-sombre-390.jpg` : l'accueil d'un nouveau joueur, une seule action.
2. `02-partie-avertissement-passe-sombre-390.jpg` : Mochi prévient avant une passe trop tôt (#235).
3. `03-fin-de-partie-victoire-clair-390.jpg` : la victoire contre Pomme et la suite (« Défier Caillou »).
4. `04-revue-sombre-390.jpg` : la revue coup par coup, avec le moment clé.
5. `05-lecon1-libertes-clair-390.jpg` : la leçon 1, on pose sa pierre dès le premier écran (#198).
6. `06-fin-lecon-entraine-toi-sombre-390.jpg` : fin de leçon, la pratique en action principale (#237).
7. `07-chemin-chapitre-2-clair-390.jpg` : le chemin avec le chapitre 2 et la leçon 8 (#228, #232).
8. `08-lecon8-refutation-sombre-390.jpg` : une réfutation de la leçon 8 (« Collée à Blanc »).
9. `09-go-du-jour-indice-clair-390.jpg` : l'aide par marches du Go du jour, l'indice entouré.
10. `10-revision-du-lendemain-sombre-390.jpg` : la Révision du jour au 2e jour (#199, #237).

Captures des défauts : `m1-*` à `m9-*` dans le même dossier (M3 et M8 sans capture).

## Outils

Script de recette : un script Playwright hors dépôt (parcours A à D, contrôles automatiques dans la page, captures JPEG). Build de production dans un dossier temporaire, `vite preview --port 4802`. Build `VITE_E2E=1` pour la suite Playwright, `vite preview --port 4801`, `PW_PORT=4801`.
