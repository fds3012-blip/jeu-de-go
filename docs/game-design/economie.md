# Économie de progression

Tenu par l'agent `game-designer`. Issue #233. Dernière mise à jour : 28/09/2026.

Cette page fait la carte de tout ce que le joueur gagne : XP, niveaux, thèmes de goban, série, gels, record, badges, paliers. Elle dit où ces systèmes se contredisent et ce qu'on corrige. Les chiffres viennent de la simulation `src/app/economie.test.ts` (vraies règles, vrai contenu : 8 leçons, 147 problèmes). Lance `npx vitest run src/app/economie.test.ts` pour les revoir.

Règles communes, jamais négociées : pas de perte punitive, pas de fausse urgence, pas de loot box. Le public inclut des enfants.

## 1. Carte : chaque action et ce qu'elle rapporte

| Action du joueur | XP | Bonus « première fois » (une fois par appareil) | Série du jour (appareil) | Badge | Palier / autre | Où c'est décidé |
|---|---|---|---|---|---|---|
| Problème réussi (1re réussite, sans voir la réponse) | +10 | +10 (catégorie problème) | non | « 1er problème », « 10 problèmes », paliers | compte pour le palier (ouverture à 60 %, badge à 100 %) | `Puzzles.tsx`, `aide.ts`, `xp.ts` |
| Problème résolu après avoir vu la réponse (« Vu », #197) | 0 | 0 | non | non | ne compte pas ; il revient dans la grille | `aide.ts` (`recompense`) |
| Problème déjà réussi, refait | 0 | 0 | non | non | non | `Puzzles.tsx` (`!solved.has`) |
| Go du jour réussi | +20 **seulement s'il n'était pas déjà réussi** | +10 (problème) | **oui** (+ gel tous les 7 jours, 2 au plus) | via problèmes et « 7 jours de série » | compte pour le palier | `Puzzles.tsx`, `defiAppareil.ts`, `gel.ts` |
| Go du jour « Vu » | 0 | 0 | **oui** (l'effort du jour compte) | non | non | `aide.ts` |
| Révision du jour finie (3 problèmes déjà réussis, #199) | **+20 (depuis #233, 0 avant)** | +10 si jamais pris (cas rare) | **oui** | non | calendrier J+1, J+3, J+7 | `RevisionDuJour.tsx`, `revision.ts` |
| Leçon terminée, 1re fois | +30 | +20 (leçon) | **oui** | non (aucun badge de leçon) | chemin des leçons | `Learn.tsx` |
| Leçon rejouée jusqu'au bout | 0 | 0 | **oui** | non | non | `Learn.tsx` |
| Série d'entraînement après une leçon (3 problèmes, #200) | +10 par problème neuf | comme un problème | non | comme un problème | compte pour le palier | `SeriePratique.tsx` |
| Partie contre l'ordi, perdue (plus de 10 coups) | +15 | +20 (partie) | **non** | « 1re partie » | adversaire suivant non ouvert | `Game.tsx` |
| Partie contre l'ordi, gagnée | +40 (15 + 25) | +20 (partie) | **non** | « 1re partie », « Victoire contre Pomme » | adversaire suivant ouvert | `Game.tsx`, `bilan.ts` |
| Partie abandonnée par le joueur (plus de 10 coups) | +15 | +20 | non | « 1re partie » | défaite au bilan | `Game.tsx` |
| Partie de 10 coups ou moins (score ou abandon) | 0 | 0 | non | « 1re partie » | — | `Game.tsx` |
| Partie à deux sur le même appareil | +15 | +20 | non | « 1re partie » | — | `Game.tsx` |
| « Rejouer d'ici » depuis la revue, puis fin de partie | +15 ou +40, **à chaque fois** | — | non | — | — | `Game.tsx` |
| Quitter pendant le récit du score | **0** (le gain attend la fin du récit) | — | non | — | — | `Game.tsx` (`recitFini`) |
| Rejouer une erreur (« Tes erreurs », #77) | 0 | 0 | non | non | — | `MesErreurs.tsx` |
| Revue d'une partie | 0 | 0 | non | non | — | `Revue.tsx` |
| Premières parties contre l'ordi (komi 0,5, #160) | comme une partie | — | — | — | les 3 premières ; rend la 1re victoire possible, pas l'XP | `equilibrage.ts` |

Paliers de niveau (`xp.ts`) : coût `min(1000, 100 × 1,25^(n−1))` arrondi à 5. Seuils cumulés : niveau 2 à 100 XP, 3 à 225, 4 à 380, 5 à 575, 6 à 820, 7 à 1 125, 8 à 1 505, 9 à 2 100, 10 à 2 845, 11 à 3 775, 12 à 4 775, puis +1 000 par niveau. Récompenses cosmétiques : Kaya clair (niveau 3), Ardoise (5), Coquillage doré (8). Rien après le niveau 8.

Série de l'appareil (`defi.ts`, `gel.ts`, `serieRecord.ts`) : un défi par jour (Go du jour, leçon ou révision). Un gel gagné à chaque multiple de 7 jours, 2 au plus. Un jour manqué consomme un gel ; s'il n'y en a pas assez, la série repart et les gels restent. Le record ne descend jamais. Côté serveur (joueur connecté), la série reste celle du seul Go du jour ; l'écran montre la plus longue des deux.

Badges (`vitrine.ts`) : 7, gardés pour toujours une fois gagnés. Ils sont mémorisés à l'ouverture du Profil.

Contenu fini : les 8 leçons rapportent 260 XP au plus (bonus compris), les 147 problèmes environ 1 480 XP. Sans les parties, le contenu s'arrête vers le niveau 8. Les parties, sans limite, sont le seul robinet ouvert à l'infini.

## 2. Simulation sur 30 jours

Trois joueurs types, chaque jour (détail dans `src/app/economie.test.ts`) :
- **10 min/jour** : Go du jour, révision du jour, 2 nouveaux problèmes, puis une leçon un jour sur deux (tant qu'il en reste), sinon une partie. Une partie sur 3 gagnée.
- **30 min/jour** : Go du jour, révision, 6 problèmes, une leçon et sa série d'entraînement, 2 parties. Une sur 2 gagnée.
- **10 min, 5 jours sur 7** : comme le premier, absent le week-end.

Un problème neuf sur 5 est « Vu » (aide jusqu'à la réponse). Hypothèse optimiste : tous les paliers sont à la portée du joueur.

| Joueur | J1 | J7 | J14 | J30 | Récompenses (niv. 3 / 5 / 8) | Dernier badge |
|---|---|---|---|---|---|---|
| 10 min/jour | niv. 2 (100 XP), 1 badge | niv. 5 (645), 5 badges, série 7 | niv. 7 (1 220) | **niv. 9** (2 320), 5 badges | J3 / J7 / J18 | **J7** |
| 30 min/jour | niv. 3 (235), 3 badges | niv. 7 (1 415), 7 leçons | niv. 9 (2 420), 8/8 leçons | **niv. 11** (4 110), 7 badges, 147/147 problèmes | J1 / J3 / J8 | J23 |
| 10 min, 5 j/7 | niv. 2 (100) | niv. 4 (465), **série 0** | niv. 6 (875), série 0 | niv. 8 (1 755), **record 5 jours, 0 gel** | J3 / J9 / J25 | **J4** |

Avant #233 (révision sans XP), les mêmes joueurs finissaient à 1 740 XP (niv. 8) et 3 530 XP (niv. 10) : la révision est la source d'XP la plus régulière du joueur de 10 minutes (580 XP sur 30 jours, contre 500 pour les problèmes neufs).

Lecture :
- **Session** : le niveau 2 tombe dès le premier jour pour tous (objectif de #162 tenu).
- **Semaine** : la première récompense (niveau 3) arrive à J3 à 10 minutes, dès J1 à 30 minutes. Bon rythme.
- **Mois** : le joueur de 30 minutes a tout débloqué à J8 (dernier thème) et fini le contenu à J30. Il reste 22 jours sans rien de nouveau à gagner, sauf des niveaux sans récompense. C'est le trou le plus grand pour J30.

## 3. Incohérences et trous

Classés du plus net au moins net. **C** = corrigé dans cette PR ; **P** = proposé.

1. **C1. La révision du jour faisait vivre la série sans rien rapporter.** Même effort que le Go du jour (3 problèmes au lieu d'un), même rôle pour la série, 0 XP. Le joueur apprenait que la révision « ne compte pas ». Corrigé : `GAINS.revision = 20`, égal au Go du jour, une fois par jour, à la fin de la révision (`xp.ts`, `RevisionDuJour.tsx`). Pour le bonus « première fois », c'est un problème (pas de second bonus). Règle posée : **tout défi du jour qui fait vivre la série rapporte au moins autant que le Go du jour** (testé dans `xp.test.ts`). Indicateur : `revision_faite` par actif (doit monter), rétention J7.
2. **C2. Le badge « 7 jours de série » disait « Fais 7 Go du jour de suite. »** alors que, depuis #199, une leçon ou la révision comptent aussi. Un joueur qui fait une leçon par jour gagnait un badge dont la condition lui semblait fausse. Corrigé : « Un défi 7 jours de suite. » (anglais : « 7 days of challenges. »), aussi court que possible (la vitrine coupe à 2 lignes).
3. **C3. Commentaire faux dans `xp.ts`** : « niveau 2 : environ 7 problèmes ». Il en faut 9 (100 XP, bonus compris). Corrigé, avec un renvoi vers cette page.
4. **P1. Le Go du jour ne rapporte rien s'il était déjà réussi.** Le calendrier suit l'ordre d'arrivée des problèmes, la grille l'ordre des paliers : le joueur tombe souvent sur un problème déjà fait. Simulation : 9 jours sur 30 sans XP à 10 minutes, **18 sur 30** à 30 minutes. Le défi commun du jour, mis en avant sur l'accueil, rapporte donc moins au joueur le plus assidu. Proposition : le Go du jour rapporte toujours ses 20 XP, une fois par numéro (garde `!solved.has(open.id)` remplacée par « pas encore réussi aujourd'hui » dans `Puzzles.tsx`, 1 ligne ; repère déjà là : `goDuJourFaitAppareil`). À faire par le propriétaire de `Puzzles.tsx`. Indicateur : `go_du_jour_resolu` par actif, J7.
5. **P2. Une partie ne fait pas vivre la série.** C'est pourtant l'action principale de l'app et un indicateur de la charte (5 parties terminées par actif et par semaine). Un joueur qui ne fait « que » jouer n'a jamais de série. Chez chess.com, toute activité compte. Proposition : ajouter `'partie'` à `Defi` (`defi.ts`) et appeler `validerDefi('partie')` au même endroit que le gain d'XP (`Game.tsx`, 1 ligne), pour une partie de plus de 10 coups. À tester en A/B avec `SERIE_UN_DEFI` (`docs/data/tableaux-de-bord.md`). Indicateur : J7, parties terminées par semaine.
6. **P3. Les gels ne protègent pas le joueur irrégulier.** Un gel se gagne à 7 jours de série. Le joueur « 5 jours sur 7 » perd sa série chaque week-end, n'atteint jamais 7 jours, donc n'a **jamais** de gel ni le badge « 7 jours » (simulation : record de 5 jours, 0 gel en 30 jours). Ce sont les joueurs qui en ont le plus besoin. Pistes, à trancher en A/B : un gel offert au premier Go du jour (progrès offert) et `JOURS_PAR_GEL = 5` ; ou 1 jour de grâce comme chess.com (2 jours). Aucune ne suffit seule pour un week-end complet : la grâce d'un jour plus un gel le couvre. Indicateur : `serie_perdue` (jours, gels), J7 et J30 du segment « moins de 7 jours actifs par semaine ».
7. **P4. L'XP est perdue si on quitte pendant le récit du score.** Le gain attend `recitFini` (pour ne pas dévoiler la victoire). Si le joueur touche « ‹ » pendant les 2,5 s du récit, `Game` est démonté et rien n'est crédité. Proposition (`Game.tsx`) : créditer au moment où la partie se termine, mais n'afficher la pastille qu'à la fin du récit ; ou créditer au démontage si la partie était finie. Indicateur : écart entre `partie_terminee` et `xp_gagne` (sources `partie`, `victoire`).
8. **P5. « Rejouer d'ici » permet de regagner l'XP d'une partie en boucle.** Depuis la revue, on reprend une position de plus de 10 coups, on finit (même par abandon) : +15, ou +40 si c'est gagné. Pas grave (aucune triche entre joueurs), mais le niveau perd son sens. Proposition (`Game.tsx`) : l'XP d'une partie reprise demande au moins 10 coups joués **depuis la reprise**, et pas de bonus de victoire sur une reprise. Indicateur : `xp_gagne` par partie jouée.
9. **P6. Le badge des paliers se bloque à cause des « Vu ».** « Continuer » mène au palier ouvert le plus avancé ; les problèmes « Vu » d'un palier plus bas n'y reviennent pas. Le badge demande 100 % du palier. Simulation : le joueur de 10 minutes gagne son 5e badge à J7, puis **plus rien jusqu'à J30**. Proposition : la révision du jour reprend aussi les problèmes « Vu » (c'est exactement ce qu'il faut revoir), et une réussite en révision compte comme réussite (XP et palier). Côté `RevisionDuJour.tsx` et `Puzzles.tsx`. Indicateur : badges gagnés par actif à J30.
10. **P7. Plus rien à débloquer après le niveau 8.** Le joueur de 30 minutes l'atteint à J8, celui de 10 minutes à J18. Proposition : deux ou trois thèmes de plus aux niveaux 10, 12 et 15 (goban « Nuit », pierres « Ardoise et coquillage » ; à dessiner par l'agent design dans `boardArt.ts`), et un badge par tranche de leçons (« Chemin des leçons fini ») : les leçons n'ont aucun badge alors que le Profil montre « 3 / 8 leçons ». Indicateur : `niveau_atteint` au-delà de 8, J30.
11. **P8. La leçon rejouée fait vivre la série sans rien rapporter** (après C1, c'est le seul défi dans ce cas). C'est acceptable (rejouer une leçon est une révision), mais la règle devient : « rejouer une leçon, c'est la révision du jour » : +20 XP une fois par jour, partagé avec la révision. À faire dans `Learn.tsx`. Indicateur : `lecon_terminee` sur leçons déjà finies.
12. **P9. Contenu fini face à la courbe.** Toutes les leçons et tous les problèmes valent environ 1 740 XP : niveau 8. Au-delà, seules les parties font monter. Le joueur de 30 minutes finit les 147 problèmes vers J30 (hypothèse optimiste : en réalité, les paliers Club et Confirmé l'arrêteront avant). Ce n'est pas une incohérence de l'XP, c'est un rythme d'écriture : **environ 5 problèmes neufs par jour** pour que le joueur de 30 minutes n'en manque pas. À transmettre à l'agent contenu.
13. **Tenu, rien à changer** : l'XP ne descend jamais (testé) ; le record non plus ; un badge gagné reste ; le komi réduit ne change pas l'XP (seulement la chance de gagner) ; « Vu » ne rapporte pas d'XP mais garde la série du Go du jour (pas de punition). Partie abandonnée : +15 après 10 coups, c'est voulu (l'effort compte, abandonner n'est pas une faute). Une partie de 10 coups ou moins ne rapporte rien : c'est le seul seuil, il empêche le gain sans effort.

## 4. Suite
- Les propositions P1, P2, P4, P5 et P8 touchent `Game.tsx`, `Learn.tsx` ou `Puzzles.tsx` : chacune fait 1 à 5 lignes, à prendre dans la PR suivante de leur propriétaire.
- P3 (gels) et P2 (partie = défi) changent la règle de série : A/B, comme `SERIE_UN_DEFI`.
- Relancer la simulation à chaque changement de barème : elle doit rester verte (niveau 2 à J1, niveau 3 dans la semaine à 10 minutes, XP et record jamais en baisse).
