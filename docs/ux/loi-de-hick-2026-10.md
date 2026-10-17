# Loi de Hick sur toute l'app : 16 octobre 2026 (#571)

Auteur : agent `ux-jeux-mobiles`. Demande de Florian : appliquer la loi de Hick partout. Le temps de décision croît avec le nombre de choix montrés en même temps (Hick 1952, Hyman 1953 ; [Laws of UX, Hick's Law](https://lawsofux.com/hicks-law/)). Le brief le dit déjà : chaque écran compris en 3 secondes, une seule action principale (modèle : chess.com).

Build : `main` à `35c6778` (#563 compris), build de test (`VITE_E2E=1`, Supabase simulé par `e2e/fauxSupabase.ts`). Chromium de `/opt/pw-browsers`, 390 × 844, `fr-FR`, écran tactile, mouvements réduits. Mesure refaite à l'identique avant et après : `HICK=<dossier> npx playwright test loi-de-hick --workers 1` (`e2e/loi-de-hick.spec.ts`, lancement manuel seulement).

## 1. Méthode de comptage

- **Un choix** : tout ce qui se touche et fait quelque chose (bouton, lien, onglet, puce, tuile, interrupteur, champ, plateau jouable). Un élément touchable dans un autre compte une fois. Un bouton désactivé (adversaire verrouillé, par exemple) ne compte pas : ce n'est pas un choix.
- **Au premier regard** : visible sans défiler, au-dessus de la barre de navigation du bas. **Page** : tout l'écran, en défilant. Sous une feuille modale ouverte, seule la feuille compte.
- **Poids** : P = action principale (en relief) ; S = choix secondaires de même poids ; L = liens discrets ; N = les 4 onglets du bas (toujours les mêmes, appris une fois) ; G = le plateau.
- **Seuil retenu** : plus de 4 ou 5 choix **de même poids et dans le même groupe**. Un écran peut avoir 12 choix et rester simple s'ils sont rangés en groupes courts sous une seule action principale ; c'est ce que mesure la colonne « plus grand groupe ».
- **Nos chiffres d'usage** : PostHog, 30 derniers jours (lu le 16/10) : 12 `mode_choisi` et 9 `conseil_demande` en tout, pour 2 à 13 personnes. C'est trop peu pour décider ce qui est rare ou fréquent : les choix ci-dessous viennent de l'évaluation experte, pas de l'usage. L'événement `plus_ouvert` (section 4) servira à vérifier.

## 2. Avant : choix par écran (390 × 844)

| Écran | Au premier regard (P / S / L / N / G) | Page entière | Plus grand groupe de même poids | Verdict |
|---|---|---|---|---|
| « Tu connais le go ? » (tout premier lancement) | 8 (0 / 3 / 1 / 4 / 0) | 8 | 3 réponses | Bien |
| Accueil, premier lancement (avant la 1re pierre) | 8 (1 / 0 / 2 / 4 / 1) | 8 | 1 | Bien (#487) |
| Accueil, après la 1re pierre | 13 (1 / 5 / 2 / 4 / 1) | 13 | 3 modes, puis 2 tuiles du jour | Limite, voir P4 |
| Accueil, habitué avec compte | 12 (1 / 5 / 1 / 4 / 1) | 12 | 3 modes, puis 2 tuiles du jour | Bien |
| Feuille « Changer » (adversaire, taille) | 7 (1 / 5 / 1 / 0 / 0) | 8 | 3 tailles ; 9 adversaires en 3 rangs de 3 | Bien |
| … avec « Réglages de la partie » ouverts | 8 | 15 | 3 | Bien (replié par défaut, #528) |
| Feuille « Plus » de l'accueil | 4 (0 / 3 / 1 / 0 / 0) | 4 | 3 | Bien |
| Apprendre | 11 (1 / 6 / 0 / 4 / 0) | 55 | chemin en chapitres, 1 leçon « Commencer » | Bien |
| Problèmes | 5 (1 / 0 / 0 / 4 / 0) | 14 | 1 | Bien |
| Profil | 23 (0 / 19 / 0 / 4 / 0) | 23 | **10 lignes** en une grille | **Trop** (P3) |
| Réglages | 14 (0 / 10 / 0 / 4 / 0) | 30 | 3 par réglage, 6 groupes titrés | Bien (liste longue mais rangée) |
| Partie contre l'ordi | 8 (0 / 7 / 0 / 0 / 1) | 8 | **5** (Indice, Conseil, Qui mène ?, Passer, Plus) | Limite, voir P5 |
| … menu « Plus » de la partie | 13 | 13 | 2 actions + 3 interrupteurs | Bien |
| Aide | 5 (0 / 4 / 1 / 0 / 0) | 5 | 4 onglets | Bien |
| Fin de partie | 3 (1 / 0 / 2 / 0 / 0) | 3 | 1 | Très bien |
| En ligne, « En direct » | 16 (1 / 11 / 0 / 4 / 0) | 16 | **3 décisions, 8 options** + 2 onglets | **Trop** (P1) |
| En ligne, « Partie lente » | 14 (1 / 9 / 0 / 4 / 0) | 14 | **2 décisions, 6 options** + 2 onglets | **Trop** (P2) |
| Défier un ami | 6 (1 / 1 / 0 / 4 / 0) | 6 | 1 | Très bien |
| Revue (bilan) | 7 (1 / 2 / 0 / 4 / 0) | 8 | 1 | Bien |
| Feuille « Partager ta partie » | 5 (0 / 4 / 1 / 0 / 0) | 5 | 4 | Bien (à la limite) |

Ce qui va bien et qu'on ne touche pas : l'accueil épuré avant la première pierre (#487), la feuille « Changer » qui range les 9 adversaires en 3 rangs et replie les réglages avancés (#528), la fin de partie (une action, deux liens), Problèmes (une action au premier regard), « Défier un ami ».

## 3. Problèmes, classés par impact sur un nouveau joueur

| # | Constat | Impact nouveau joueur | Indicateur (charte) | Effort | Décision |
|---|---|---|---|---|---|
| P1 | **En direct** : avant de jouer, 3 décisions (taille, temps de jeu, comptage), 8 options de même poids, plus « En direct / Partie lente ». Un débutant ne sait pas choisir entre « Japonais » et « Chinois », ni entre 3 cadences. Les valeurs par défaut sont déjà sûres (9 × 9, Normal, japonais) : on fait choisir pour rien. | Fort : c'est l'action principale de l'accueil dès la 1re partie finie (#432) | parties en ligne lancées / `mode_choisi` en ligne ; temps avant la recherche | S | **Changé** (C1) |
| P2 | **Partie lente** : même chose, 2 décisions (taille, délai), 6 options. | Moyen | parties lentes lancées | S | **Changé** (C1) |
| P3 | **Profil** : 10 lignes de même poids dans une seule grille (parties, amis, cote, placement, semaine, statistiques, réglages, compte, nous écrire, conditions). Réglages et Conditions se cherchent au milieu de la progression. | Faible (on y vient chercher quelque chose de précis) | temps pour trouver Réglages (test) | XS | **Changé** (C2) |
| P4 | **Accueil après la 1re pierre, sans partie finie** : 3 tuiles de modes (dont « En ligne · Partie classée », une promesse prématurée) et 2 tuiles du jour, sous le bouton. Chaque groupe reste à 3, mais un débutant voit 5 portes à côté de « Joue ta première partie ». | Moyen | `premiere_partie_terminee / premiere_pierre` | M | **Laissé** : voir section 5 |
| P5 | **Partie** : 5 boutons de même poids dans la barre ; trois servent à se faire aider (Indice, Conseil, Qui mène ?). La différence entre « Indice » et « Conseil » n'est pas évidente. | Moyen | `conseil_demande`, indices pris | M | **Laissé** : voir section 5 |
| P6 | **Partager ta partie** : 4 options de même poids. À la limite, mais c'est une feuille ouverte exprès, et chaque option a sa phrase. | Faible | `partie_partagee` | — | Laissé |

## 4. Ce qui change

### C1 (P1, P2). En ligne : les réglages repliés derrière leur résumé

- **Avant** : « Taille du plateau » (9, 13, 19), « Temps de jeu » (Rapide, Normal, Long), « Comptage » (Japonais, Chinois), puis « Trouver un adversaire ». En partie lente : taille, puis « Temps par coup » (1, 2, 3 jours).
- **Après** : une ligne dit ce qui sera joué, avec « Changer » à droite :
  - en direct : « 9 × 9 · Normal, 10 min + 3 × 30 s · comptage japonais » ;
  - en partie lente : « 9 × 9 · 1 jour par coup ».
  Sous la ligne, la phrase qui explique le temps reste lue (le byo-yomi, ou le délai par coup) : le mot est toujours expliqué là où il apparaît. « Changer » ouvre les mêmes choix qu'avant, à la même place ; « Masquer » les replie. Le choix fait est gardé, comme avant, et le résumé le dit.
- **Pourquoi** : révélation progressive ([NN/g, Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)) avec des valeurs par défaut sûres. Un débutant n'a plus qu'une action ; un joueur de club change en un toucher de plus.
- **Comptage** : en direct, 16 → **9** choix au premier regard, 11 → 3 secondaires (Retour et les 2 onglets), 0 décision avant le bouton. En partie lente, 14 → **9**.
- **Comparaison** :
  - *Observé*, chess.com (app, onglet « Jouer ») : une seule cadence affichée (« 10 min ») dans un bouton qui ouvre la liste, puis un gros bouton vert « Jouer ». Les autres cadences et options attendent derrière ce bouton de cadence.
  - *Observé*, Lichess (accueil web) : une grille de 12 cadences de même poids (« 1+0 », « 3+2 »…). Elle convient à des habitués qui savent ce qu'ils veulent, pas à un débutant : c'est le contre-modèle pour nous.
- **Code** : `src/ui/ReglagesReplies.tsx` (nouveau, chargé avec les écrans en ligne, à la demande), `src/app/Direct.tsx`, `src/app/Lentes.tsx`, styles dans `src/ui/direct.css` (déjà chargée à la demande). Textes : `direct.reglages.*` et `lente.reglages.*` (fr et en).
- **Mesure** : `plus_ouvert` { `ecran` : `direct` ou `lente` } à chaque « Changer ». Si plus de 30 % des joueurs qui voient l'écran changent avant de chercher, les valeurs par défaut sont à revoir. Plan de marquage et politique de confidentialité (§ 3.3) mis à jour.
- **Tests** : `e2e/partie-en-direct.spec.ts`, `e2e/parties-lentes.spec.ts` et `e2e/file-jamais-vide.spec.ts` mis à jour **exprès** (le parcours change) : ils lisent le résumé, touchent « Changer » avant de choisir 13 × 13 ou Rapide, et vérifient que le choix reste dans le résumé au retour. Les vérifications d'accessibilité (44 px, aucun débord à 195 px et à 200 % de texte, une seule action principale) restent toutes là.

### C2 (P3). Profil : les lignes rangées en deux blocs

- **Avant** : une grille de 10 lignes d'un seul tenant.
- **Après** : deux blocs séparés. En haut, ta progression : Mes parties, Mes amis, Ta cote, Placement (ou Titre du mois), Ta semaine, Statistiques (6). En bas, l'app et ton compte : Réglages, Mon compte, Nous écrire, Conditions et confidentialité, et le rappel ou l'installation quand ils existent (4 à 6). Le bloc du bas est un groupe nommé pour le lecteur d'écran (« L'app et ton compte »).
- **Pourquoi** : on trouve plus vite dans des groupes courts (Hick s'applique à chaque groupe, pas à la liste entière). Rien ne bouge de place, rien n'est caché.
- **Pas de titre visible** : le Profil doit tenir sans défiler en 390 × 844 (#50, vérifié par 7 fichiers de tests). Il restait 3 px. L'écart entre les blocs (6 px) est pris sur la marge au-dessus des badges (12 → 9 px). Un titre visible coûtait 33 px : refusé.
- **Comptage** : 23 choix au premier regard, inchangé ; plus grand groupe 10 → **6**.
- **Code** : `src/app/Profil.tsx`, `src/ui/profil-ecran.css` (chargée à la demande), texte `profil.groupe.app` (fr et en, `src/content/i18n/club.ts`).

### Captures

Dans `docs/ux/captures/hick/` (15 JPEG, 376 Ko) : `avant-14-en-ligne-choix`, `avant-14c-partie-lente` et `avant-09-profil` (390 × 844, sombre), puis `apres-en-direct`, `apres-partie-lente` et `apres-profil`, chacun en 390 × 844 et 320 × 568, sombre et clair. En 320 px, « 10 min » et « 30 s » ne se coupent plus (espaces insécables dans le résumé). Pour les refaire : `HICK=<dossier> HICK_DOCS=docs/ux/captures/hick npx playwright test loi-de-hick --workers 1`.

## 5. Avant / après

| Écran | Au premier regard avant | Après | Plus grand groupe avant | Après |
|---|---|---|---|---|
| En ligne, « En direct » | 16 | **9** | 3 décisions, 8 options | **0 décision** (1 lien « Changer ») |
| En ligne, « Partie lente » | 14 | **9** | 2 décisions, 6 options | **0 décision** |
| Profil | 23 | 23 | 10 lignes | **6 + 4** |
| Tous les autres écrans du tableau 2 | — | inchangés | — | inchangés |

## 6. Ce qui est laissé, et pourquoi

- **P4, accueil après la 1re pierre.** Chaque groupe a 3 éléments au plus, l'action principale reste seule en relief, et Florian a décidé que tous les modes sont à 1 toucher, ou 2 par « Plus » (#429, #432). Cacher les tuiles de modes jusqu'à la première partie finie (proposition R3 du 07/10) toucherait une décision de Florian, l'accueil (JS initial, budget à 0,7 Ko près) et une quinzaine de parcours de test. **Proposition pour le dirigeant** : tant qu'aucune partie n'est finie, ranger les 3 modes derrière un lien « Autres façons de jouer » ; indicateur `premiere_partie_terminee / premiere_pierre`.
- **P5, barre de la partie.** 5 boutons, c'est la limite haute, pas au-delà. Fusionner « Indice » et « Conseil » demande de savoir lequel sert : il n'y a que 9 `conseil_demande` en 30 jours, et l'indice n'a pas d'événement. **Proposition** : mesurer l'indice (`indice_demande`), puis décider en 30 jours ; la barre et ses nombreux tests changeraient d'un bloc.
- **Réglages** : 30 choix, mais en 6 groupes titrés de 1 à 3 lignes. C'est une liste qu'on parcourt pour trouver un réglage précis, pas une décision : la loi de Hick y pèse peu.
- **Apprendre** : 55 choix sur la page, mais le chemin est rangé en chapitres et l'écran s'ouvre sur la prochaine leçon et son seul « Commencer ».
- **Feuille de partage** : 4 options, chacune avec sa phrase ; ouverte exprès.

## 7. Contrôles

- Budget (build de production) : JS initial 149,3 / 150 Ko, CSS initial 21,4 / 22 Ko, inchangés : tout le nouveau code et les nouveaux styles sont dans des écrans chargés à la demande (en ligne, Profil). Seul ajout au JS initial : le nom de l'événement `plus_ouvert` dans `EVENTS`.
- Mochi : aucun écran ne change de visage (`src/ui/mochiRegle.test.ts` non touché).
- Accessibilité : « Changer » et « Masquer » font 44 px, avec `aria-expanded` et `aria-controls` ; le résumé est un texte, lu avant le bouton ; contrastes des jetons existants (texte sur `--surface`) ; aucun mouvement ajouté.
