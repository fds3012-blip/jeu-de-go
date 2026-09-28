# Recette du soir du 28/09/2026

Périmètre : `origin/main` à `c4814c6`, après les fusions du soir : #270 (quitter une partie), #269, #273 et #278 (leçons et problèmes en anglais), #274 (Go du jour partageable), #275 et #277 (« Rejoue cette erreur », révision espacée), #279 (partie guidée contre Mochi), #271 et #280 (vie et mort, lots Q et R), #272 (tests robustes).

Build `VITE_E2E=1 npm run build`, servi par `vite preview --port 5051 --strictPort`. Chromium de `/opt/pw-browsers`, écran tactile émulé, agent Safari iOS, fuseau Europe/Paris, stockage vide au départ. KataGo est remplacé par l'analyseur factice e2e (`window.__kataGoFactice`, celui de `e2e/rejoue-erreur.spec.ts`), et le komi par `?komi=-100` : la revue a une erreur connue au coup 1 (E5), et la fin est déterministe. `navigator.share` est retiré pour tester la copie.

| Config | Taille | Thème | Mouvements |
|---|---|---|---|
| `sombre-390` | 390 × 844 | sombre | normaux |
| `clair-390` | 390 × 844 | clair | normaux |
| `clair-320` | 320 × 640 | clair | normaux |
| `sombre-320` | 320 × 640 | sombre | réduits |

Horloge simulée : 28/09 20 h 30 (jour 1) ; 29/09 9 h 10 (lendemain) ; 01/10 19 h (J+3) ; 08/03/2027 et 11/03/2027 (Go du jour n° 163 = q01 et n° 166 = r01, les paliers de vie et mort étant verrouillés pour un nouveau joueur).

Parcours joués de bout en bout, dans les 4 configurations, en français **et** avec `?lang=en` (8 passages, 45 écrans chacun, 360 écrans audités) :

1. Premier lancement (consentement), accueil, partie contre Pomme (E5), sortie demandée puis « Jouer encore », passes jusqu'au score (avec l'avertissement de Mochi), récit, fin, revue, erreur du coup 1 (bon coup caché), « Rejoue cette erreur », C5 refusé, F4 accepté, retour à la revue. Le lendemain, « Tes erreurs à rejouer » (1), F4 réussi ; à J+3, rien de dû (prochaine le 02/10).
2. Partie guidée contre Mochi (« Changer », puis « Partie guidée contre Mochi »), 12 coups et plus, passes, fin.
3. Quitter une partie en cours : la bulle « Tu quittes la partie ? Elle sera perdue. » avec « Quitter » et « Jouer encore ».
4. Go du jour n° 2 : A1 raté, E3 réussi, « Partager » (texte copié : `Go du jour n° 2 · résolu en 2 essais · série 1 🔥` puis le lien `?go-du-jour=2`), puis l'ancien défi `?go-du-jour=1`.
5. `?lang=en` : les 6 parcours, avec relevé des lignes visibles contenant du français.
6. Vie et mort : q01 (« Rends ton œil vrai », A2 raté puis D2) et r01 (« Six points dans le coin », A2 raté puis B2).

Sur chaque écran, le script de la recette du matin (`recette.mjs`, fonction d'audit reprise telle quelle) mesure : erreurs JS (`pageerror`, `console.error`), débordement horizontal, cibles de moins de 44 px, textes coupés, chevauchements avec un élément fixe, contraste AA sur le fond réel. S'y ajoutent le nombre de fêtes visibles en même temps et, en anglais, les restes de français. Chaque signalement a été relu sur la capture. Faux positifs écartés : les éléments de l'onglet Problèmes restés sous l'écran plein d'un problème ouvert (`.cta`, `.bubble` et plateau « sous » la vue) ; « Problème suivant · Première cap… », tronqué exprès (correctif M1 du matin) ; « Rivière », nom propre, en anglais.

Gravité (Nielsen) : 1 cosmétique · 2 mineur · 3 majeur (à corriger avant diffusion large) · 4 bloquant.

## Verdict

**Aucun parcours clé cassé : pas de blocage de mise en production.** Les 6 parcours passent dans les 8 passages. Aucune erreur JavaScript, aucun débordement horizontal, aucune cible sous 44 px, jamais deux fêtes en même temps (les confettis de victoire seuls). La confirmation de sortie, le bon coup caché avant l'essai, le seuil de 1 point, la révision (J+1, puis reprogrammée au 02/10 après réussite), la copie du partage et l'ancien lien marchent comme prévu.

Un défaut majeur, trouvé et **corrigé ici** : la partie guidée montrait Pomme au lieu de Mochi (S1).

Validation locale sur la branche `recette-soir` : `tsc -b` vert ; `eslint .` 0 erreur (9 avertissements existants) ; Vitest : 8 990 tests verts sur une passe complète, avec une erreur RPC du runner (« Timeout calling onTaskUpdate ») due à la charge de la machine. Une seconde passe, lancée pendant la recette, a eu 2 délais dépassés sur des preuves lourdes (`lot-i`, `lot-n`), verts une fois relancés seuls (1 459 tests). Playwright complet vert : 237 passés, 18 ignorés. Le nouveau test de `e2e/partie-guidee.spec.ts` passe ; il était rouge avant le correctif S1. Le 18e ignoré est le saut conditionnel de `revue.spec.ts:148`, quand Pomme ne laisse pas de moment clé : relancé seul, il passe. Les captures régénérées par les e2e (`docs/design`, `docs/localisation`) ont été remises.

| # | Défaut | Gravité | Écran | Suite |
|---|---|---|---|---|
| S1 | Partie guidée : portrait et rang de Pomme sous le nom « Mochi », puis Pomme « BATTUE » à la fin, alors que la partie ne compte pas | 3 | Partie guidée, fin | **corrigé ici** (`src/app/Game.tsx`, test dans `e2e/partie-guidee.spec.ts`) |
| S2 | `?lang=en` : les 6 problèmes du lot R (r01 à r06) restent en français (titre, consigne, réfutation, explication) | 2 | Problème, Go du jour | #289 |
| S3 | 320 px : le verdict des problèmes de vie et mort (7 lignes) cache les lignes 1 à 4 du plateau, dont le coup gagnant | 2 | Problème | #290 |
| S4 | Tampon « BATTUE » / « BEATEN » de 9 px à 3,85:1 (seuil AA 4,5:1) | 2 | Feuille des adversaires | #291 |
| S6 | Le lendemain, « Tes erreurs à rejouer » est la dernière section de Problèmes (2 à 3 écrans plus bas), rien sur le premier écran de l'accueil | 2 | Problèmes, J+1 | #293 |
| S5 | Après « Partager », la ligne « Copié ! » agrandit le verdict, qui mord le plateau de 13 px | 1 | Go du jour | #292 |
| S7 | Feuille des adversaires : le choix « 9 × 9 » passe sous le bouton collant « Rejouer contre Pomme » tant qu'on n'a pas défilé | 1 | Feuille des adversaires | pas d'issue (défilement, comportement voulu par #102) |

## Détail

### S1. Partie guidée : Mochi a le visage de Pomme (gravité 3, corrigé)

Étapes : accueil, « Changer », « Partie guidée contre Mochi », jouer jusqu'au score.

Constaté : `niveauGuide()` (`src/engine/guidee.ts`) renvoie l'adversaire de l'échelle dont Mochi emprunte la force, renommé « Mochi ». `Game.tsx` affichait le portrait par `ai.id` : le bandeau montrait Pomme, « Mochi, 20 kyu ». L'écran de fin montrait Pomme avec le tampon « BATTUE », juste au-dessus de « Partie guidée : elle ne compte pas dans ton bilan. » : deux messages contraires, au moment où le débutant découvre le mode.

Correctif : en partie guidée, le bandeau et l'écran de fin prennent `PortraitMochi`, et il n'y a plus de tampon. Le test `e2e/partie-guidee.spec.ts` (« le portrait est celui de Mochi, sans tampon ») était rouge avant le correctif et passe après.

Restes, hors correctif : les répliques du bandeau (`choisirReplique(ai.id)`) et l'adversaire noté dans la revue gardée (`go.revue`) sont encore ceux de l'adversaire emprunté. Ce n'est pas visible dans ce parcours ; à voir avec l'agent de #79.

Capture après correctif : `07-fin-partie-guidee-sombre-390.jpg`.

### S2. Lot R non traduit (gravité 2) : #289

#278 (165 problèmes en anglais) a été fusionné avant #280 (lot R). Sous `?lang=en`, r01 affiche « Daily Go #166 · Six points dans le coin », puis « Noir joue et vit… You play Black. ». q01 (lot Q) est bien traduit. Le test `problemes.en.test.ts` n'exige pas une traduction pour chaque problème du calendrier.

Capture : `s2-anglais-r01-en-francais-sombre-390.jpg`.

### S3. Le verdict cache le plateau en 320 px (gravité 2) : #290

Même famille que M5 (matin) et #250 : les explications de vie et mort sont plus longues (7 lignes), le panneau monte jusqu'à la ligne 5. D2 (q01) et B2 (r01) sont cachés au moment où on explique les deux yeux.

Capture : `s3-verdict-couvre-plateau-clair-320.jpg`.

### S4. Contraste du petit tampon (gravité 2) : #291

`.vignette-tampon` (`src/ui/accueil.css`) : `#D2432C` sur papier, 9 px, 3,85:1. Mesuré identique dans les 4 configurations et en anglais. Pas corrigé ici : le choix du rouge touche l'identité des tampons (design).

Capture : `s4-tampon-battue-contraste-clair-390.jpg`.

### S5. « Copié ! » (gravité 1) : #292

Le texte copié est juste et ne révèle pas la réponse. La ligne de confirmation ajoute une rangée au verdict, qui mord le bas du plateau et pousse le titre hors de l'écran.

Capture : `s5-copie-verdict-sur-plateau-clair-320.jpg`.

### S6. Les erreurs à rejouer sont loin (gravité 2) : #293

La logique est juste (`go.erreurs.v1` : `prochain` 29/09 après l'échec, puis 02/10 après la réussite du 29/09, `reussites: 1`). Mais l'entrée est au bas de l'onglet Problèmes, et le premier écran de l'accueil n'en parle pas.

Capture : `s6-lendemain-erreurs-hors-ecran-clair-320.jpg`.

### Remarques sans défaut

- Un lien vers un Go du jour futur (`?go-du-jour=166` le 28/09) ouvre le problème du jour : comportement attendu, pas de fuite des défis à venir.
- En partie guidée, la bulle « Atari ! Ton groupe n'a plus qu'une liberté… Atari : il ne reste qu'une liberté… » répète le mot avec sa définition : c'est la règle 5 (vocabulaire expliqué la première fois), mais la phrase gagnerait à être raccourcie.

## 10 captures pour Florian

Dans `docs/qa/captures/recette-soir/` :

1. `01-quitter-la-partie-sombre-390.jpg` : Mochi demande avant de perdre la partie (#270).
2. `02-revue-bon-coup-cache-clair-390.jpg` : la revue décrit l'erreur sans donner la réponse (#277).
3. `03-rejoue-erreur-refuse-sombre-390.jpg` : un coup à 1,5 point est refusé, « Cherche encore » (#275).
4. `04-rejoue-erreur-reussi-clair-390.jpg` : F4 accepté, la position reviendra dans Problèmes.
5. `05-lendemain-erreurs-a-rejouer-sombre-390.jpg` : le lendemain, l'erreur revient en révision.
6. `06-partie-guidee-mochi-clair-390.jpg` : la partie guidée contre Mochi (#279).
7. `07-fin-partie-guidee-sombre-390.jpg` : la fin de partie guidée, avec Mochi (correctif S1).
8. `08-go-du-jour-partage-copie-clair-390.jpg` : Go du jour réussi, partage copié (#274).
9. `09-vie-et-mort-q01-reussi-sombre-390.jpg` : un problème de vie et mort du lot Q (#271).
10. `10-anglais-revue-clair-390.jpg` : la revue en anglais avec `?lang=en` (#269, #273, #278).

Captures des défauts : `s2-*` à `s6-*` dans le même dossier.

## Outils

Script de recette hors dépôt : parcours 1 à 6, 8 passages en parallèle, fonction d'audit reprise du script du matin, horloge `page.clock.setFixedTime`, analyseur factice injecté par `addInitScript`. Serveur arrêté par son PID.
