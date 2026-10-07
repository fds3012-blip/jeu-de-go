# Les 5 premières minutes d'un débutant complet — 7 octobre 2026 (#466)

Auteur : agent `ux-jeux-mobiles`. Build : `main` à `ae5e3d0` (#465 compris), build de test (`VITE_E2E=1`, Supabase simulé par `e2e/fauxSupabase.ts`, donc **avec** l'essai limité). Chromium de `/opt/pw-browsers`, 390 × 844, `fr-FR`, écran tactile, stockage vide (appareil neuf, sans compte), sombre et clair à chaque écran. Le test avec 5 débutants n'a pas encore eu lieu : c'est une évaluation experte, à confirmer par ce test.

Parcours joué : ouverture → consentement « Non merci » → « Joue ta première partie » → première pierre **au doigt** → 7 coups → passe → comptage → fin de partie → accueil → Apprendre → leçon 1 → 3 parties abandonnées → 4e partie : « Crée ton compte » → code → pseudo.

## 1. Ce que disent les chiffres

### Compteurs anonymes de l'entonnoir (#437, lecture seule)

`select * from compteurs_entonnoir order by jour desc` (projet `xjvsalkvpgcjrznznxoi`, lu le 7/10 à 22 h) :

| Jour | `premier_ecran` | `premiere_pierre` | `premiere_partie_finie` | `limite_essai` | `compte_cree` |
|---|---|---|---|---|---|
| 07/10 | 14 | 0 | 0 | 0 | 0 |
| 06/10 | 19 | 0 | 0 | 0 | 0 |
| 05/10 | 6 | 0 | 0 | 0 | 0 |

`compteurs_entonnoir_fenetre` : seule l'étape `premier_ecran` a déjà été appelée, **aucun refus**. Aucun appareil n'a donc jamais envoyé `premiere_pierre` : ce n'est pas le plafond qui l'a bloqué.

**PostHog, 7 derniers jours** (surtout les joueurs qui ont accepté la mesure) : `app_ouverte` 281 (239 personnes), `partie_commencee` 11 (3), `premiere_pierre` 2 (2), `partie_terminee` 11 (3), `essai_limite_atteinte` 27 (4).

Lecture prudente :
- **0 première pierre sur 39 nouveaux appareils en 3 jours.** C'est le signal le plus fort de l'entonnoir. Il colle avec le constat P1 ci-dessous (au doigt, le premier toucher ne pose pas de pierre et rien ne dit de toucher encore).
- **Hypothèse concurrente** : une partie des 39 « premiers écrans » viennent de robots qui exécutent le JavaScript (moteurs de recherche, aperçus de liens) avec un stockage vide à chaque visite. Ils ne poseront jamais de pierre. À vérifier : comparer avec `premier_ecran_vu` dans PostHog et les journaux Vercel (agents utilisateurs).
- Les 4 personnes de `essai_limite_atteinte` (27 fois) sont sans doute l'équipe et des appareils d'avant #437.

**Mesure de réussite des corrections** : `premiere_pierre / premier_ecran` (compteurs anonymes) doit passer de 0 à plus de 60 % dans la semaine qui suit la mise en ligne. Si elle reste à 0, le problème est ailleurs (robots, ou envoi du compteur) et il faut l'instruire en priorité.

### Mesures du parcours (script)

| Mesure | Avant (`ae5e3d0`) | Après (#466) |
|---|---|---|
| Mots dans la bulle de Mochi avant la première pierre | 44 | **36**, et le geste en premier |
| Ce que dit Mochi après le premier toucher | la même bulle d'intro (but, libertés, komi) | **« Touche encore pour poser ta pierre en E5. »** |
| La pierre fantôme | fixe, à 50 % | **respire** (0,45 ↔ 0,8, 900 ms), fixe en mouvements réduits |
| Taps de l'ouverture à la première pierre | 4 (consentement, bouton, 2 touchers) | 4, mais le 4e est demandé |
| Comptage sans pierre grisée | « Les pierres grisées sont mortes… » ×2 | « Je ne suis pas sûr pour certains groupes… », ligne du score sans « grisées » |
| Fin de partie à 0 point de territoire | « Perdu de peu. La prochaine fois sera la bonne ! » | **« Ton territoire compte 0 : tes pierres ne fermaient aucun espace. Avant de passer, relie-les jusqu'aux bords. »** |
| Écran « Crée ton compte » (3 parties jouées) | « … pour continuer à jouer. » | « … pour jouer encore. Sans compte, les leçons 1 à 3 et le Go du jour restent ouverts. » |
| Cibles de moins de 44 px / textes sous AA | 0 / 0 (sauf le « 2 » des libertés en leçon, sombre, voir P13) | 0 / 0 |
| Erreurs JavaScript | 0 | 0 |

## 2. Comparaison sur le même moment du parcours

| Moment | Nous | Duolingo | chess.com | BadukPop |
|---|---|---|---|---|
| Ouverture | Fenêtre de consentement par-dessus l'accueil, puis 8 choix et 4 onglets | Une question à la fois (langue, objectif), puis la première leçon tout de suite ; le compte après ([teardown Appcues](https://goodux.appcues.com/blog/duolingo-user-onboarding)) | Choix du niveau, puis partie contre un bot ou leçon ; l'inscription peut attendre | Tutoriel interactif des règles « en quelques minutes » ([App Store](https://apps.apple.com/us/app/badukpop-go/id1472684271)) |
| Premier geste | 2 touchers au doigt (confirmation), consigne absente avant #466 | Un toucher sur une carte, retour immédiat (son, couleur) | Glisser ou toucher, coup joué tout de suite ; la confirmation est un réglage à activer ([aide chess.com](https://support.chess.com/en/articles/8609803-how-do-i-turn-on-confirm-move-mobile)) | Un toucher pose la pierre |
| Fin de partie | Comptage parfois manuel : le débutant doit juger les pierres mortes | — | Résultat, puis « Game Review » qui explique les moments clés | **Comptage entièrement automatique**, « pas besoin de marquer les pierres » ([App Store](https://apps.apple.com/us/app/badukpop-go/id1472684271)) |
| Ce qu'on propose ensuite | « Rejouer contre Pomme », puis à l'accueil « Jouer en ligne » (partie classée) | La leçon suivante, une seule action | Rejouer, revoir, ou nouveau bot | Leçon ou problème suivant |
| Mur du compte | Après 3 parties, ou au premier « Jouer en ligne » | Après la première leçon (+20 % d'usage le lendemain, test A/B rapporté, voir base de connaissances) | Avant le jeu en ligne | Compte facultatif pour jouer contre l'IA |

## 3. Constats, classés par gravité

Gravité (Nielsen, 0 à 4) : 4 = empêche le premier plaisir ; 3 = fait perdre le joueur ou le fait douter ; 2 = gêne ; 1 = finition.
Indicateurs de `entreprise/charte.md` visés : entonnoir de la première session (première pierre, première partie finie), J1, conversion essai → compte.

| # | Constat | Gravité | Heuristique | Indicateur | Effort | Statut |
|---|---|---|---|---|---|---|
| P1 | Au doigt, le premier toucher ne pose qu'une pierre fantôme ; Mochi garde sa bulle d'intro, rien ne dit de toucher encore. Un débutant croit sa pierre refusée. Déjà noté le 27/09 (C4) et le 28/09 (« = »). Cohérent avec 0 `premiere_pierre` sur 39. | **4** | Visibilité de l'état, aide en contexte | première pierre / premier écran | S | **Corrigé** |
| P2 | Bulle d’entrée de 44 mots : but, définition des libertés entre parenthèses, komi. Aucun mot ne dit **quoi faire**. | **3** | Charge cognitive, reconnaissance | première pierre, temps avant la pierre | S | **Corrigé** |
| P3 | Fin de partie à 0 point : « Aucun territoire », défaite de 0,5, et Mochi dit « Perdu de peu. La prochaine fois sera la bonne ! ». Le débutant ne sait pas **pourquoi** il a 0. C'est la fin du tout premier souvenir (règle pic-fin). | **3** | Aide à comprendre l'erreur | J1, 2e partie lancée | S | **Corrigé** |
| P4 | Comptage manuel : « Les pierres grisées sont mortes… » alors qu'aucune n'est grisée, et la ligne du score le redit. Le joueur cherche des pierres grises qui n'existent pas. | **3** | Cohérence texte / écran | partie finie, `comptage_manuel` | XS | **Corrigé** |
| P5 | « Crée ton compte » après 3 parties : « … pour continuer à jouer », sans dire que leçons 1 à 3 et Go du jour restent ouverts. « Plus tard » ressemble à une impasse. | **3** | Liberté et contrôle, pas de perte punitive | conversion, J1 des non-inscrits | XS | **Corrigé** |
| P6 | Après la première partie (perdue), l'action principale de l'accueil devient « Jouer en ligne · Partie classée · contre un humain de ton niveau » ; la leçon 1 est sous la ligne de flottaison (884 px pour 844). Le débutant qui ne sait pas pourquoi il a perdu est envoyé vers le classement… et vers le mur du compte. | 3 | Correspondance avec le niveau du joueur | J1, conversion | M | **Non corrigé : décision de Florian (#432)**. À rediscuter avec ces chiffres (voir propositions). |
| P7 | Le débutant doit juger la vie et la mort (« Touche un groupe s'il est mort… ») quand le moteur doute. BadukPop compte toujours seul. | 3 | Prévention des erreurs | partie finie | M | À faire (proposition R2) |
| P8 | Premier écran : fenêtre de consentement de 60 mots par-dessus l'accueil (déjà UX-05 du 27/09). | 2 | Charge, temps avant le plaisir | première pierre | M | Hors périmètre (juridique) |
| P9 | Premier écran : 8 choix (Changer, le bouton, « Je sais déjà jouer », En ligne, Un ami, Plus, Go du jour, Leçon 1) et 4 onglets. Le bouton reste net, mais « En ligne · Partie classée » à un joueur qui n'a jamais posé de pierre est une promesse prématurée. | 2 | Loi de Hick, une seule action | première pierre | S | À faire (R3), touche aux décisions #429 et #432 |
| P10 | En partie, au coup 0, le seul bouton plein de la barre est « Passer » (règle v3 « Passer en bouton plein »). L'œil du débutant tombe sur l'action qui finit la partie. | 2 | Hiérarchie visuelle | passes trop tôt | S | À faire (R4) |
| P11 | La première réponse de Pomme est parfois au bord (B1, A9) : un modèle étrange pour qui apprend. | 1 | — | — | M | À voir avec le moteur |
| P12 | Tuile du Go du jour coupée au premier lancement (« Remonte vers le… »). | 1 | Finition | — | XS | Zone de #465 (`accueil.css`) : signalé, pas touché |
| P13 | Leçon 1 en sombre : le compteur de libertés « 2 » sur le bois mesure 2,48:1 (texte de 12 px). Probablement un fond mal détecté par la mesure (fond incertain) ; à vérifier à l'œil. | 1 | Contraste | — | XS | À vérifier |

Ce qui va bien et qu'il faut garder : un seul bouton en relief à chaque écran ; la leçon 1 fait poser une pierre dès son premier écran ; Mochi prévient avant une passe trop tôt (« Il reste de la place à prendre. Tu passes quand même ? ») avec « Jouer encore » en action principale ; l'écran de fin a un vrai pic (sceau, XP « dont +20 première fois ») ; la création de compte tient en 3 écrans courts, sans mot de passe ; aucune cible sous 44 px.

## 4. Les 5 corrections

Chaque correction a son test Playwright dans `e2e/premieres-minutes.spec.ts` (un test par correction), plus des tests Vitest pour la logique.

### C1 (P1). La pierre fantôme dit « Touche encore »

- **Avant** : premier toucher en E5 → pierre à 50 %, fixe ; la bulle garde « Le but : entourer… Le komi, ce sont… ». Rien ne bouge pendant que le joueur attend Pomme.
- **Après** : Mochi dit « Touche encore pour poser ta pierre en E5. » (zone `aria-live`, donc lu au lecteur d'écran) pendant les 6 premiers coups de la partie ; la pierre fantôme respire doucement, et reste fixe en mouvements réduits. Toucher ailleurs déplace la consigne (« … en D4. »). Au-delà des premiers coups, le geste est appris : la phrase du coup reste.
- Code : `src/ui/Board.tsx` (`onFantome`, `data-confirmer`, classe `fantome-attend`), `src/ui/board.css` (`go-attend`, sous `prefers-reduced-motion: no-preference`), `src/app/Game.tsx` (`COUPS_AIDE_FANTOME`).
- Test : `1. premier toucher…` (consigne, pas de pierre, animation `go-attend` puis `none` en mouvements réduits, consigne qui suit le doigt puis s'efface, plus de consigne après 6 coups).
- Indicateur : `premiere_pierre / premier_ecran` (compteurs anonymes).
- Capture : `captures-466/1-fantome-sombre.jpg`.

### C2 (P2). La bulle d'entrée commence par le geste

- **Avant** (44 mots) : « Le but : entourer plus de territoire que Pomme, et capturer ses pierres en leur retirant leurs libertés (les cases vides qui les touchent). Le komi, ce sont des points donnés à Blanc parce que Noir commence. Pour tes premières parties, il est de 0,5. »
- **Après** (36 mots, dont 17 avant le komi) : « Touche un croisement des lignes pour poser ta pierre. Le but : entourer plus de territoire que Pomme. Le komi : des points donnés à Blanc, qui joue en second. Pour tes premières parties, il est de 0,5. »
- Les libertés ne sont plus définies avant la première pierre : le mot n'y apparaît plus. Il est expliqué au premier atari et dans la leçon 1. Le komi reste expliqué à sa première apparition (règle de CLAUDE.md).
- Code : `accueil.introBut` et `komi.premiere` (fr, en). Tests mis à jour : `home.test.ts`, `ecrans.test.ts`, `equilibrage.test.ts`, `partie.test.ts`, `premiere-victoire`, `petits-ecrans`, `recette-corrections`, `langue`.
- Test : `2. bulle d'entrée…` (commence par le geste, 36 mots au plus).
- Capture : `captures-466/2-bulle-entree-clair.jpg`.

### C3 (P3). Un territoire à 0 est expliqué

- **Avant** : défaite de 0,5 avec « Aucun territoire », Mochi : « Perdu de peu. La prochaine fois sera la bonne ! ».
- **Après** : « Ton territoire compte 0 : tes pierres ne fermaient aucun espace. Avant de passer, relie-les jusqu'aux bords. » La fin reste gentille, mais elle dit quoi changer : c'est la dernière phrase de la première partie, celle dont on se souvient.
- Code : `StatsPartie.territoire` (`src/app/bilan.ts`, rempli par `Game.tsx` au comptage), phrase `lecon.territoireZero`.
- Tests : Vitest `bilan.test.ts` (cas sans hasard) ; Playwright `4. fin de partie…` (la partie varie : la phrase attendue suit le territoire lu dans le récit ; 3 essais sur 3 sont tombés sur le cas « 0 »).
- Indicateur : part des débutants qui lancent une 2e partie après une défaite (`partie_commencee` n° 2 / `premiere_partie_terminee`).
- Capture : `captures-466/3-fin-territoire-sombre.jpg`.

### C4 (P4). Le comptage ne parle plus de pierres grisées absentes

- **Avant** : « Les pierres grisées sont mortes : elles ne peuvent plus vivre… Je ne suis pas sûr pour certains groupes… » et, sous le plateau, « Toi 0, Pomme 0,5 (komi compris). Les pierres grisées sont comptées comme mortes. » Aucune pierre grisée à l'écran.
- **Après** : sans pierre grisée, Mochi dit seulement « Je ne suis pas sûr pour certains groupes. Touche un groupe s'il est mort, touche-le encore s'il est vivant. » et la ligne devient « Toi 0, Pomme 0,5 (komi compris). »
- Code : `messageComptage` (`src/app/partie.ts`), `partie.comptageSansMortes`.
- Tests : Vitest `partie.test.ts` ; Playwright `3. comptage…` (partie à deux, comptage sans pierre morte).
- Capture : `captures-466/4-comptage-clair.jpg`.

### C5 (P5). La limite de l'essai dit ce qui reste ouvert

- **Avant** : « Tu as joué tes 3 parties d'essai. Bravo ! Crée ton compte pour continuer à jouer. »
- **Après** : « … Crée ton compte pour jouer encore. Sans compte, les leçons 1 à 3 et le Go du jour restent ouverts. » Pas de fausse urgence, pas de perte : le joueur sait que « Plus tard » mène quelque part.
- Code : `creer.raison.parties` (fr, en).
- Test : `5. limite de l'essai…` (la phrase est là, et c'est vrai : après « Plus tard », la leçon 1 s'ouvre sans compte).
- Indicateur : retour des non-inscrits le lendemain (J1 sans compte) et `compte_cree / limite_essai` (ne doit pas baisser).
- Capture : `captures-466/5-limite-essai-clair.jpg`.

Captures : chaque fichier de `captures-466/` (dossier de travail de l'agent, non versionné) montre l'écran **avant | après** côte à côte, au même moment du parcours (scripts `04-premier-toucher`, `03-partie-debut`, `10-fin-de-partie`, `08-comptage-manuel`, `17-limite-essai`) ; `6-fantome-clair.jpg` montre C1 en clair. Les parties diffèrent (Pomme tire au hasard parmi ses coups), le moment est le même. Pour les refaire : `CAPTURES_466=<dossier> npx playwright test premieres-minutes` sur `main` puis sur cette branche.

## 5. Propositions qui restent (pour le dirigeant)

| # | Proposition | Constat | Indicateur qui doit bouger | Effort |
|---|---|---|---|---|
| R1 | Vérifier que les 39 « premiers écrans » sont des humains : `premier_ecran_vu` (PostHog) et agents utilisateurs Vercel du 5 au 7/10. Si ce sont des robots, ne compter `premier_ecran` qu'après une interaction (toucher, défilement). | données | fiabilité de l'entonnoir | S |
| R2 | Première partie : comptage toujours automatique (pas de « Touche un groupe s'il est mort »), comme BadukPop. Le doute se tranche en faveur du débutant. | P7 | `comptage_manuel` → 0 dans les 3 premières parties | M |
| R3 | Tout premier lancement : montrer le bouton et la leçon 1, cacher les tuiles de modes jusqu'à la première pierre. | P9 | `premiere_pierre / premier_ecran` | S |
| R4 | « Passer » sans fond plein tant que la partie n'est pas avancée (`partieAvancee`) et que Mochi ne le conseille pas ; même place pour ne rien faire bouger. | P10 | passes avant le coup 10 | S |
| R5 | Rediscuter #432 pour les débutants : tant que le joueur n'a ni gagné contre Pomme ni fini la leçon 1, l'action principale reste « Rejouer contre Pomme » (ou la leçon 1 après une défaite à 0 point), « Jouer en ligne » en tuile. | P6 | J1, `limite_essai` → `compte_cree` | M |
| R6 | Usability test avec 5 débutants (prévu) : chronométrer la première pierre, compter les doubles touchers spontanés, noter ce que chacun dit de la fin de la première partie. | tous | — | M |

## 6. Recouvrements

- #465 (fusionnée pendant ce travail) a touché `App.tsx`, `accueil.css`, `fr.ts` et `en.ts`. Cette branche est rebasée sur `ae5e3d0` ; elle modifie seulement des clés de `fr.ts` et `en.ts` qui ne sont pas celles de #465. `accueil.css` et la barre du bas ne sont pas touchés (P12 signalé seulement).
- #467 (CI) : rien de commun.
- `src/ui/Board.tsx` est partagé (partie, problèmes, leçons, revue) : la nouvelle prop `onFantome` est facultative ; l'animation de la pierre fantôme qui attend vaut partout où la confirmation au doigt est active, ce qui est voulu.
