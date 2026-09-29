# Recette de nuit du 29/09/2026

Périmètre : `origin/main` à `7468181`, après les fusions depuis 23 h : #294 (« Conseil » de Mochi), #297 (aperçu Open Graph), #299 (« Continuer » à ta mesure), #300 (correctifs de la recette du soir), #301 (langue dans le Profil, anglais automatique), #302 (« Je sais déjà jouer »), #305 (import SGF), lots S (#298) et T (#304). #303 (défi par lien, phase 1 : serveur seulement) est inclus dans le build, sans écran à tester. La PR #306 (course aux problèmes) n'était pas fusionnée au début de la recette : elle n'est pas incluse.

Build `VITE_E2E=1 npm run build`, servi par `vite preview --port 5191 --strictPort` (PID dans `/tmp/qa-nuit-5191.pid`, arrêté par son PID). Chromium de `/opt/pw-browsers`, écran tactile émulé, agent Safari iOS, fuseau Europe/Paris, stockage vide au départ. KataGo est remplacé par l'analyseur factice e2e (`window.__kataGoFactice`, celui de `e2e/import-sgf.spec.ts`) : l'analyse de l'import est déterministe, mais le vrai moteur n'est pas testé ici.

| Config | Taille | Thème | Mouvements |
|---|---|---|---|
| `sombre-390` | 390 × 844 | sombre | normaux |
| `clair-390` | 390 × 844 | clair | normaux |
| `clair-320` | 320 × 640 | clair | réduits |

Chaque configuration est jouée deux fois : locale `fr-FR`, puis `en-US` sans `?lang` (6 passages, 26 à 29 écrans chacun, 165 écrans audités).

Parcours :

1. Premier lancement (consentement), accueil, « Je sais déjà jouer », 3 problèmes de placement réussis, « Tu es environ 8 kyu », « Joue contre Renard », partie, puis « Conseil ». Contre Renard, pas de « Conseil » (N2) : Réglages → Aide de Mochi → « Toujours », nouvelle partie, E5, « Conseil ».
2. Onglet Problèmes, « Problème suivant » (le « Continuer » de #299) 5 fois et plus, jusqu'à un problème du lot T.
3. `fr-FR` : Profil → Réglages → Langue → English, puis Jouer, Apprendre, Problèmes, Profil, import, partie. `en-US` : les mêmes écrans, en anglais sans rien choisir.
4. Profil → « Analyser une partie » → SGF Fox 19 × 19 de 16 coups collé → « Lire la partie » → Noir → « Analyser la partie » → revue.

Sur chaque écran, la fonction d'audit des recettes précédentes mesure : erreurs JS (`pageerror`, `console.error`), débordement horizontal, cibles de moins de 44 px, textes coupés ou hors écran, chevauchements avec un élément fixe, contraste AA sur le fond réel. S'y ajoutent le nombre d'actions principales visibles (`.cta`, `.btn.primary`) et, en anglais, les lignes qui contiennent du français. Chaque signalement a été relu sur la capture. Faux positifs écartés : l'`input` de fichier `.sr-only` de l'import (1 × 1, doublé par son libellé) ; l'explication du verdict des problèmes coupée exprès en 320 px avec « Lire l'explication » (correctif #290).

Gravité (Nielsen) : 1 cosmétique · 2 mineur · 3 majeur (à corriger avant diffusion large) · 4 bloquant.

## Verdict

**Aucun parcours clé cassé : pas de blocage de mise en production.** Les 4 parcours passent dans les 6 passages. Aucune erreur JavaScript, aucun défilement horizontal, aucun contraste sous AA, jamais plus d'une action principale à l'écran. Aucune ligne restée en français en anglais, que l'anglais vienne du Profil ou de l'appareil (`<html lang="en">` dans les deux cas, dès le premier écran pour `en-US`).

Un défaut majeur, trouvé et **corrigé ici** : en 320 px, la barre d'actions de la partie contre Pomme débordait de l'écran depuis l'ajout de « Conseil » (N1).

Ce qui marche comme prévu :

- **#302** : le placement enchaîne 3 problèmes, annonce « Tu es environ 8 kyu », explique le kyu, et propose Renard (10 kyu). La cote de départ est gardée (`go.cote-joueur.v1`), le Profil montre « Niveau estimé · 8 kyu, le 28/09 ».
- **#299** : après le placement, « Problème suivant » part de problèmes de difficulté 1000, puis monte (1050, 1150, 1220, 1300, 1350). Le lot T arrive dans tous les passages : t02 (1150) au 4e problème dans 3 passages, t05 (1350) au 7e ou 8e dans les 6. Aucune cote affichée.
- **#294** : « Conseil » (avec l'aide de Mochi active) écrit « Un coin est encore libre : les coins d'abord. » (« A corner is still free: corners first. ») et entoure une zone de 2 × 2 sur le plateau.
- **#301** : le choix « Français / English » est dans Profil → Réglages. La page se recharge en anglais.
- **#305** : un SGF Fox 19 × 19 est lu, le choix du camp attend un clic, l'analyse montre sa barre, puis la revue s'ouvre : plateau 19 × 19 lisible en 320 px, précision des deux joueurs.
- **#297** : `index.html` sert `og:title`, `og:description`, `og:image` (1200 × 630, avec texte alternatif) et `twitter:card` ; `/apercu.png` répond en 200 (237 Ko).

Validation locale sur la branche `recette-nuit-0929` : `tsc -b` vert ; `eslint .` 0 erreur (9 avertissements existants) ; e2e `petits-ecrans`, `conseil-mochi`, `qui-mene`, `partie`, `recette-corrections` verts. Les deux nouveaux tests N1 étaient rouges avant le correctif et passent après. Les captures régénérées par les e2e ont été remises (`git checkout -- docs/design docs/localisation`).

| # | Défaut | Gravité | Écran | Suite |
|---|---|---|---|---|
| N1 | 320 px, partie contre Pomme : les 6 actions mesurent 342 px ; « Indice » sort de 22 px à gauche, « Passer » de 18 px à droite (2 px de trop en 360 px) | 3 | Partie | **corrigé ici** (`src/ui/partie.css`, tests dans `e2e/petits-ecrans.spec.ts`) |
| N2 | Après « Je sais déjà jouer », la partie contre Renard n'a pas de « Conseil » (l'aide de Mochi ne vise que Pomme et Caillou) | 2 | Partie | #307 (à trancher côté produit) |
| N3 | Après le placement, l'accueil propose « Leçon 1 · Libertés et capture » alors que le placement conseillait « Ouverture sur 9 × 9 » | 2 | Accueil | #308 |
| N4 | « Rejouer contre Renard » alors qu'aucune partie contre Renard n'est finie | 1 | Accueil | #309 |
| N5 | Revue : « Toi 100 %· Soleil 80 % », l'espace avant le point médian est avalé | 1 | Revue | #310 |

## Détail

### N1. La barre d'actions déborde en 320 px (gravité 3, corrigé)

Étapes : stockage vide, 320 × 640, accueil, action principale (partie contre Pomme), jouer E5.

Constaté : contre Pomme, l'aide de Mochi est active par défaut. La barre a six actions depuis #294 : Indice, Conseil, Qui mène ?, Annuler, Abandonner, Passer. Chaque bouton a un plancher (libellé + 2 × 4 px, #250), et la somme fait 342 px. La barre est centrée et n'a pas de défilement : « Indice » commence à −22 px, « Passer » finit à 338 px. Il reste 22 px visibles d'« Indice » et 36 px de « Passer », l'action qui finit la partie. C'est le parcours du débutant, sur la plus petite largeur prise en charge. En 360 px, « Indice » dépasse encore de 2 px ; à partir de 375 px, tout tient.

Correctif : entre 300 et 374 px, les libellés de la barre passent à 12 px, l'air autour de chaque libellé passe à 2 px, et le plancher de chaque cible reste à 44 px (40 px de libellé plus 2 × 2 px). Mesuré après le correctif : 320 px, de 0 à 318 px en français et en anglais ; 360 px, de 0 à 358 px ; 375 et 390 px inchangés. Les deux tests `N1` de `e2e/petits-ecrans.spec.ts` (320 et 360 px : six boutons dans l'écran, 44 px au moins chacun) étaient rouges avant et passent après.

Hors périmètre : `src/ui/partie.css` appartient à l'agent de la partie (#236, #250).

Capture après correctif : `03-barre-six-actions-320-corrigee-clair-320.jpg`.

### N2. Pas de « Conseil » après le placement (gravité 2) : #307

`aideActive()` (`src/app/partie.ts`) réserve l'aide de Mochi à Pomme et Caillou tant que le réglage est « Débutants ». C'est cohérent avec #35, mais le joueur qui arrive par « Je sais déjà jouer » ne voit jamais « Conseil » dans sa première partie. À trancher : c'est peut-être voulu pour un joueur de 8 kyu.

Capture : `n2-renard-sans-conseil-clair-390.jpg`.

### N3. La carte « Leçon » ignore le placement (gravité 2) : #308

Le placement dit « Leçons conseillées : Ouverture sur 9 × 9 » ; l'accueil, une minute après, propose « Leçon 1 sur 8 · Libertés et capture ».

Capture : `n3-n4-accueil-apres-placement-clair-390.jpg`.

### N4. « Rejouer » sans partie finie (gravité 1) : #309

Après une partie commencée puis laissée, l'action principale dit « Rejouer contre Renard » (« Play Renard again »).

### N5. Espace avalée dans la précision (gravité 1) : #310

`Revue.tsx`, ligne 302 : le texte ` · Soleil 80 %` commence par une espace, qui disparaît au rendu.

Capture : `n5-precision-sans-espace-clair-320.jpg`.

### Remarques sans défaut

- Tous les problèmes proposés après le placement sont marqués « Difficile » : l'étiquette est absolue (difficulté du problème), pas relative au joueur. C'est juste, mais un joueur placé à 8 kyu voit « Difficile » sur chaque problème.
- La fin du placement dit « on commence vers 30 kyu », alors que la table de `placement.ts` part de 25 kyu. Les deux se défendent (30 kyu est l'usage courant).

## 6 captures pour Florian

Dans `docs/qa/captures/recette-nuit/` :

1. `01-placement-8-kyu-renard-clair-390.jpg` : fin du placement, niveau expliqué et adversaire proposé (#302).
2. `02-conseil-de-mochi-sombre-390.jpg` : le conseil de Mochi en partie, avec la zone entourée (#294).
3. `03-barre-six-actions-320-corrigee-clair-320.jpg` : les six actions tiennent en 320 px (correctif N1).
4. `04-continuer-lot-t-t05-sombre-390.jpg` : « Problème suivant » amène un problème du lot T (#299, #304).
5. `05-anglais-automatique-en-us-sombre-390.jpg` : un appareil `en-US` est en anglais sans rien choisir (#301).
6. `06-import-sgf-19-revue-clair-390.jpg` : la revue d'une partie Fox 19 × 19 importée (#305).

Captures des défauts : `n2-*`, `n3-n4-*` et `n5-*` dans le même dossier.

## Outils

Script de recette hors dépôt : parcours 1 à 4, 6 passages en parallèle, fonction d'audit reprise des recettes précédentes, analyseur factice injecté par `addInitScript`. Serveur arrêté par son PID.
