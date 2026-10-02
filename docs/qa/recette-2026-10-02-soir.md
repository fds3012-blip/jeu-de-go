# Recette du soir du 02/10/2026 : parcours débutant après la vague v3

Périmètre : `origin/main` à `63fac28` (puis `189c4f7`, journal seul), après la vague v3 du 02/10 : #376 accueil v3, #377 lecteur de leçon v3, #379 Problèmes et Profil v3, #380 leçons 13 à 16, #383 robustesse, #384 écran de partie v3, #385 chemin Apprendre v3, #386 Mes parties, #387 lot W, #388 défauts 🟠 de l'audit, #390 aide et glossaire. Branche : `recette-02-10-soir`.

Build `VITE_E2E=1`, servi par `vite preview --port 5188`. Chromium de `/opt/pw-browsers`, écran tactile, fuseau Europe/Paris, mouvements réduits, stockage vide au départ. Supabase simulé par `e2e/fauxSupabase.ts` : l'essai sans compte est donc **limité** (#343), comme en production.

Gravité : 🔴 bloque ou fait fuir · 🟠 gêne nette, à corriger avant diffusion large · 🟡 finition.

## Verdict

**Aucun parcours clé cassé : pas de blocage de mise en production.** Les 10 parcours demandés passent de bout en bout dans les 4 configurations (390 × 844 et 320 × 568, français et anglais), chaque écran vu en clair et en sombre. Aucune erreur JavaScript, aucun défilement de côté, jamais plus d'une action principale, aucun texte sous AA hors une exception (L10), aucune cible sous 44 px hors les liens dans une phrase (L11).

7 défauts corrigés ici (4 🟠, 3 🟡), chacun avec son test. 14 défauts restent, avec un propriétaire proposé (1 🟠 de cohérence : l'écran de partie du défi est resté à l'ancien style).

## Méthode

1. **Parcours débutant v3** (`e2e/parcours-debutant-v3.spec.ts`, nouveau) : un seul téléphone, du premier lancement au défi. Deux raccourcis seulement : `?komi=-100` (paramètre de test) pour gagner la première partie en passant, et les leçons 2 et 3 posées sur l'appareil avant la leçon 4. Par défaut (CI) : 390 × 844 en français, sans capture, environ 25 s. Avec `RECETTE_SOIR=<dossier>` : les 4 configurations, chaque écran capturé en sombre et en clair, avec les mesures de `e2e/mesures.ts`. 27 écrans × 2 thèmes × 4 configurations = **216 écrans mesurés**.
2. **Audit visuel du matin rejoué** (`AUDIT_VISUEL=… npx playwright test audit-visuel`) : les 65 états d'écran de l'app (placement, course, réglages, import, compte connecté…) dans les mêmes 4 configurations, **520 écrans mesurés**, avant et après les correctifs.
3. **Lecture à l'œil** de chaque capture avec `design-critique` et la checklist `mobile-pro-rules`, contre `docs/design/v2/direction.md` : une seule action, texte coupé, ce qui reste de l'ancien style, même Mochi, même ton.

Mesures (`e2e/mesures.ts`, extraites de l'audit du matin et affinées ici) : défilement horizontal, cibles sous 44 px, actions principales visibles (`.cta`, `.btn.primary`), contraste WCAG de chaque texte visible sur son vrai fond, textes coupés, éléments hors écran, erreurs JS. Affinage : le texte réservé aux lecteurs d'écran (`.sr-only`) et les commandes désactivées (exemptées par WCAG 1.4.3) ne sont plus mesurés. Avant, ils produisaient la moitié des signalements (« Lire le plateau » 1 × 1 px, « Recevoir mon code » grisé tant que la case n'est pas cochée).

Faux positifs écartés après relecture des captures : « Retour au chemin » et « Retour aux problèmes » commencent à −2 px (marge négative voulue, cible entière) ; la liste des coups de la revue déborde à droite (bandeau qui défile) ; le « ✓ » posé sur le plateau de la revue (marque décorative sur le bois).

Parcours joués (tous dans les 4 configurations) :

| # | Parcours | Résultat |
|---|---|---|
| 1 | Premier lancement (consentement « Non merci ») → accueil → première pierre (E5) | OK |
| 2 | Partie contre Pomme jusqu'au bout : passes, comptage, score raconté, écran de fin, revue | OK (S3 corrigé) |
| 3 | Leçon 1 entière depuis Apprendre (6 étapes, erreurs comprises), fin de leçon, retour à l'accueil | OK (S4 corrigé) |
| 4 | Go du jour : tuile de l'accueil, puis lien partagé `?go-du-jour=1` résolu | OK (S7 corrigé) |
| 5 | Limite d'essai : 3 parties menées à terme, la 4e demande un compte (sans barre du bas) | OK (S1 corrigé) |
| 6 | Limite d'essai : la leçon 4 demande un compte (leçons 2 et 3 posées sur l'appareil) | OK |
| 7 | Création de compte depuis la leçon 4 : e-mail, case d'âge, code, pseudo, puis la leçon 4 s'ouvre | OK (S5 corrigé) |
| 8 | Un problème (« Tous les problèmes ») et son verdict | OK |
| 9 | Mes parties : liste, puis revue d'une partie | OK (L3) |
| 10 | Aide depuis une partie : « ? », onglet Mots, recherche « atari », fermer, partie intacte | OK (S6 corrigé) |
| 11 | Défi par lien : lien copié, l'ami (2e téléphone) voit qui le défie, crée son compte, joue E5 ; le créateur retrouve la partie | OK (L1) |
| 12 | Hors ligne : rechargement sans réseau, accueil, Apprendre, Profil | OK |

## Défauts corrigés ici

| # | Gravité | Écran | Défaut | Correctif | Test |
|---|---|---|---|---|---|
| S1 | 🟠 | Essai sans compte | Une partie finie sur un plateau presque vide (#251) ne devait pas consommer l'essai, mais le bilan contre l'ordi l'enregistre et le compteur prenait le plus grand des deux : elle était comptée. Étapes : premier lancement, « Joue ta première partie », E5, passer jusqu'au score (victoire) ; puis 2 parties abandonnées ; la 4e partie demande déjà un compte (`go.essai.v1` = 2, bilan = 3). | `src/app/essai.ts` : `noterFinDePartie` part du total déjà connu (bilan d'avant #343 compris), puis le compteur fait foi (`suivi`). `src/app/App.tsx` l'appelle à chaque fin de partie. | `src/app/essai.test.ts` (2 cas) ; parcours débutant v3, étape 5 |
| S2 | 🟠 | Mon compte (connecté) | « Cote 1500 » sous le pseudo, contre la décision « aucune cote affichée » (déjà relevé le matin, n° 6). Capture `06-avant-compte-cote`. | Ligne retirée de `src/app/Account.tsx`, clé `compte.cote` retirée (FR et EN). | `src/app/sansCote.test.ts` : Account.tsx ne lit plus `.rating`, la clé n'existe plus |
| S3 | 🟠 | Partie, comptage manuel | Mochi disait encore « Je cherche les pierres mortes… » alors que « Valider le score » attendait le joueur : il ne savait pas qu'il pouvait toucher un groupe pour corriger. Étapes : partie contre Pomme, E5, passer jusqu'à la fin, quand Pomme n'est pas sûre des pierres mortes ; ou toute partie à deux. Capture `01-avant-comptage-manuel`, puis `02-apres`. | `src/app/Game.tsx` : la phrase de Mochi (`messageComptage`, déjà écrite pour ce cas) s'affiche aussi en comptage manuel. | `e2e/recette-02-10-soir.spec.ts`, R-S3 ; parcours débutant v3, étape 2 |
| S4 | 🟡 | Fin de leçon | « Entraîne-toi : 3 problèmes sur ce thème » sur deux lignes, seul bouton de l'app dans ce cas, en 390 et 320, FR et EN (matin, n° 9). Capture `03-avant`, `04-apres`. | Libellé visible « Entraîne-toi : 3 problèmes » / « Practice: 3 puzzles » ; le nom accessible garde le thème. | R-S4 (FR et EN, 320 px) |
| S5 | 🟡 | Création de compte | « Tu as moins de 15 ans ? » décalé de 22 px à gauche du texte de la case : `.lien` (app.css, chargé après) écrasait l'alignement. Capture `11-apres`. | `src/ui/compte.css` : sélecteur plus précis. | R-S5 |
| S6 | 🟡 | Aide | En 320 px, l'onglet « Questions » est coupé (« Questi… »). | `src/ui/aide.css` : chaque onglet part de la largeur de son mot. Capture `05-apres`. | R-S6 (FR et EN, chaque onglet sélectionné) |
| S7 | 🟠 | Accueil → Go du jour | La tuile « Go du jour n° 6 · À faire » menait à l'onglet Problèmes, où il fallait encore toucher « Résoudre » : un toucher de plus sur la boucle du jour, et le joueur ne retrouvait pas ce qu'il avait touché. | `src/app/App.tsx` : à faire, la tuile ouvre le problème (comme un lien partagé ou un rappel) ; fait, elle mène à l'onglet. | R-S7 ; `accueil-v2.spec.ts` et `flamme-du-jour.spec.ts` ajustés |

## Défauts restants (propriétaire proposé)

| # | Gravité | Écran (capture) | Défaut et étapes | Correctif proposé | Propriétaire |
|---|---|---|---|---|---|
| L1 | 🟠 | Partie de défi (`07-defi-partie-ancien-style`) | Dernier écran de l'ancien style. Défi par lien, l'ami crée son compte : barre du bas « Abandonner » et « Passer » (l'écran de partie v3 range « Abandonner » dans « Plus » et a trois aides), pas de « ? » d'aide dans l'en-tête, adversaire « Ton ami » avec une pierre blanche au lieu de son pseudo, Mochi collé en bas loin du plateau, 200 px de vide entre « Toi » et Mochi. | Réutiliser `src/ui/Partie.tsx` (bandeaux, « Plus », « ? ») dans `src/app/Defis.tsx`, avec le pseudo de l'adversaire. | Agent jeu en ligne / défi (#327) |
| L2 | 🟠 | Problèmes (`08-problemes-suivant-coupe`) | « Problème suivant · Deux pierres d'un c… » coupé en 390 px aussi (le matin : seulement en 320). C'est la seule information sur le prochain problème. | Décision #247 gardée (le verbe sur une ligne) : le titre passe sur une deuxième ligne, en légende sous le verbe, au lieu des points de suspension. | Agent Problèmes (#379) |
| L3 | 🟡 | Mes parties (`09-mes-parties-abandons`) | 3 parties abandonnées sans coup → une seule ligne : `ajouterPartie` écarte une partie dont le SGF est identique à une autre. Deux vraies parties identiques (même abandon au même coup) se confondent aussi. | Dédoublonner par identifiant seulement ; ne pas garder les parties sans aucun coup. | Agent Mes parties (#386) |
| L4 | 🟡 | Revue, clair (`10-revue-courbe-noire`) | La courbe « Qui mène » est toujours une bande noire sur le papier (légende ajoutée depuis le matin, fond inchangé). | Fond `--surface` ou kaya en mode clair. | Agent revue |
| L5 | 🟡 | Fin de partie (`14-fin-xp-sur-plateau`) | La pastille « +60 XP dont +20 première fois » est posée sur la ligne des lettres du plateau (B à G cachées). | La poser sous le sceau de l'adversaire, ou au-dessus du plateau. | Agent partie (#384) |
| L6 | 🟡 | Partie en 320 × 568 (`13-partie-320`) | Le plateau ne fait que 220 px de large sur 320 (choix de #388 pour que tout tienne sans défiler) ; les coordonnées deviennent minuscules (9 px). | Réduire d'abord la bulle de Mochi et les bandeaux en dessous de 600 px de haut. | Agent partie (#384) |
| L7 | 🟡 | Score raconté | « − 100 komi pour Pomme » : l'espace entre le signe et le nombre fait lire un tiret long (« — 100 ») ; les grands chiffres écrivent « -100 » avec un trait d'union. Vu avec `?komi=-100`, mais le gabarit est le même pour « + 6,5 komi ». | `recit.komi` : « +6,5 komi » sans espace ; « − » (U+2212) dans les grands chiffres. | Agent score |
| L8 | 🟡 | Problèmes, sans compte | « Connecte-toi pour garder ta série » et « Me connecter », alors que depuis #343 tout le reste dit « Crée ton compte ». | « Crée ton compte pour garder ta série », lien « Créer mon compte ». | Agent Problèmes (#379) |
| L9 | 🟡 | Accueil, premier jour | Le Go du jour commun du 02/10 (n° 6, « L'échelle ») est marqué « Difficile » ; c'est la tuile mise en avant d'un débutant qui vient d'installer l'app. | Pour un débutant sans leçon 3, proposer la leçon en premier ce jour-là, ou caler le calendrier pour ne pas mettre un « Difficile » dans la première semaine. | Produit (calendrier #75) |
| L10 | 🟡 | Profil, clair | Les chiffres « 10 » et « 7 » dessinés dans les badges verrouillés : contraste 4,29:1, sous 4,5. | Encre un ton plus foncé dans les sceaux verrouillés en clair. | Agent Profil (#379) |
| L11 | 🟡 | Création de compte, défi | Les liens « conditions d'utilisation » et « politique de confidentialité » font 20 px de haut. Conforme à WCAG 2.5.8 (lien dans une phrase), sous la règle de 44 px du projet. | Les doubler par un lien « Lire les conditions » de 44 px sous la case, ou interligne plus grand. | Agent compte (#343) |
| L12 | 🟡 | Comptage, clair (`02-apres-comptage-manuel`) | La pierre de « Toi » est grisée pendant le comptage : on dirait que tu n'as plus la main, alors que c'est à toi de valider. | Pierre pleine pendant le comptage. | Agent partie (#384) |
| L13 | 🟡 | Arrivée par un défi | « Florian te défie ! » en titre de taille moyenne, sans Mochi, alors que l'écran « Crée ton compte » (même geste) a Mochi et un grand titre : deux styles pour la même étape. | Reprendre l'en-tête de `CreerCompte.tsx`. | Agent défi (#327) |
| L14 | 🟡 | Fin de leçon | « Prochain pas : Atari » et le lien « Leçon suivante » disent la même chose deux fois sous le bouton principal. | Garder le lien seul : « Leçon suivante : Atari ». | Agent lecteur de leçon (#377) |

Pas d'issue GitHub ouverte depuis cette branche : les propriétaires et les étapes sont ici, à reprendre par le dirigeant.

## Cohérence entre les écrans v3

- **Boutons** : une seule action en relief (jade) sur chaque écran mesuré, liens secondaires soulignés jade partout. Exception d'ancien style : la barre de la partie de défi (L1).
- **Mochi** : même portrait carré, même bulle claire en clair et sombre, présent sur l'accueil (premier lancement), le lecteur de leçon, la partie, le comptage, la fin, la revue, « Crée ton compte », Mes parties (vide). Absent de l'arrivée par défi (L13).
- **Ton** : tutoiement partout, phrases courtes ; « atari », « komi » et « territoire » expliqués à leur première apparition (leçon 1, récit du score, glossaire). Anglais complet sur les 27 écrans du parcours, aucune ligne française vue.
- **Problèmes sans total ni cote** : aucun total, aucune cote dans Problèmes, le Go du jour ou un problème. La cote de « Mon compte » est retirée (S2).
- **320 × 568** : rien ne défile de côté, aucun texte coupé après S4 et S6, hors L2.

## Mesures

| Passage | Écrans mesurés | Erreurs JS | Défilement de côté | > 1 action principale | Textes sous AA | Cibles < 44 px |
|---|---|---|---|---|---|---|
| Parcours débutant v3, 4 configurations, après correctifs | 216 | 0 | 0 | 0 | 2 chiffres de badges (L10) | liens dans une phrase (L11) |
| Audit visuel du matin rejoué, 4 configurations, après correctifs | 520 | 0 | 0 | 0 | 2 chiffres de badges (L10) | liens dans une phrase (L11) |

### Audit rejoué

65 états d'écran × 2 thèmes × 4 configurations, sur cette branche. Il ne reste que des signalements déjà classés : « Deux pierres d'un coup » coupé dans « Problème suivant » en 390 px français (L2), les chiffres des badges du Profil en clair (L10), les deux liens de la case d'âge (L11), et les faux positifs écartés plus haut (revue, boutons retour). Les 8 parcours de l'audit passent, aucune étape échouée.

Par rapport au matin (`docs/qa/audit-visuel-2026-10-02.md`) : n° 3 (Go du jour coupé dans la tuile), n° 5 (taille du plateau sous le bouton collant), n° 6 (cote, corrigé ici en S2) et n° 9 (fin de leçon sur deux lignes, S4) sont réglés ; n° 4 (courbe noire en clair) reste en L4.

## Tests

Sur la branche, après `git merge origin/main` :

| Suite | Résultat |
|---|---|
| `npx tsc -b` | code de sortie 0 |
| `npx eslint .` | 0 erreur (4 avertissements existants, `Portrait.tsx` et `ProposerInstallation.tsx`) |
| Vitest complet | 167 fichiers verts, 2 sautés ; 16 332 tests verts, 3 sautés (3 min) |
| Playwright complet (4 workers) | 401 verts, 36 sautés (captures à la demande), 1 rouge : `compte-obligatoire.spec.ts` lisait le stockage de l'essai mot pour mot ; ajusté au nouveau champ `suivi`, puis vert (3/3) |
| `e2e/parcours-debutant-v3.spec.ts` | vert par défaut (390 × 844, français, 25 s) et avec `RECETTE_SOIR` (4 configurations, 1,5 min) |
| `e2e/recette-02-10-soir.spec.ts` | 7 tests verts |
| `e2e/audit-visuel.spec.ts` (`AUDIT_VISUEL`) | 8 parcours verts, 4,5 min |

Les e2e réécrivent toujours des captures d'autres specs (`docs/design`, `docs/localisation`) ; remises avec `git checkout`.

## Fichiers touchés hors du périmètre QA

- `src/app/essai.ts`, `src/app/App.tsx` (S1, S7) : compte et accueil.
- `src/app/Game.tsx` (S3) : écran de partie.
- `src/app/Account.tsx`, `src/content/i18n/fr.ts`, `src/content/i18n/en.ts` (S2, S4) : compte et catalogue.
- `src/ui/compte.css`, `src/ui/aide.css` (S5, S6).
- `e2e/audit-visuel.spec.ts` : sa fonction de mesure est déplacée dans `e2e/mesures.ts`, partagée.
- `e2e/accueil-v2.spec.ts`, `e2e/flamme-du-jour.spec.ts` : la tuile ouvre maintenant le Go du jour (S7) ; `e2e/compte-obligatoire.spec.ts` : champ `suivi` de l'essai (S1).
- Tests : `src/app/essai.test.ts`, `src/app/sansCote.test.ts`, `src/content/i18n/fin-interface.test.ts` (clé `compte.cote` retirée).

## Captures

`docs/qa/captures/recette-02-10-soir/` : 14 JPEG, 744 Ko. Les « avant » viennent de `main` à `63fac28`, les « après » de cette branche. Les 1 400 autres captures (4 configurations, clair et sombre) restent hors du dépôt ; elles se régénèrent avec `RECETTE_SOIR=<dossier> npx playwright test parcours-debutant-v3` et `AUDIT_VISUEL=<dossier> npx playwright test audit-visuel`.
