# Économie de progression

Tenu par l'agent `game-designer`. Issue #233. Dernière mise à jour : 29/09/2026 (soir).

Cette page fait la carte de tout ce que le joueur gagne : XP, niveaux, thèmes de goban, série, gels, record, badges, paliers. Elle dit où ces systèmes se contredisent et ce qu'on corrige. Les chiffres viennent de la simulation `src/app/economie.test.ts` : vraies règles, vrai contenu (8 leçons, 183 problèmes), et depuis le 29/09 le vrai « Continuer » à ta mesure (`coteJoueur.ts`, #284). Lance `npx vitest run src/app/economie.test.ts` pour revoir les chiffres.

Règles communes, jamais négociées : pas de perte punitive, pas de fausse urgence, pas de loot box. Le public inclut des enfants. Décision de Florian (#137) : aucune progression visible ni total dans les problèmes (ils doivent sembler infinis), aucune cote affichée.

## 1. Carte : chaque action et ce qu'elle rapporte

Bonus « première fois » : +20 une fois par appareil, pour chacune des trois catégories (problème, leçon, partie). Depuis le 29/09 (C8), c'est le même montant pour les trois.

| Action du joueur | XP | Série du jour (appareil) | Badge | Palier / autre | Où c'est décidé |
|---|---|---|---|---|---|
| Problème réussi (1re réussite, sans voir la réponse, avec ou sans indice) | +10 | non | « Premier problème », « 10 problèmes », paliers | compte pour le palier ; fait monter la cote cachée | `Puzzles.tsx`, `aide.ts`, `xp.ts`, `coteJoueur.ts` |
| Problème résolu après avoir vu la réponse (« Vu », #197) | 0 | non | non | ne compte pas ; revient par « Continuer » et par la révision (#251) | `aide.ts` (`recompense`) |
| Problème déjà réussi, refait (hors Go du jour) | 0 | non | non | non | `xp.ts` (`sourceXpProbleme`) |
| Go du jour réussi | +20, une fois par jour, même déjà réussi dans la grille (C4) | **oui** (+ un gel tous les 7 jours, 2 au plus) | via problèmes et « 7 jours de série » | compte pour le palier | `xp.ts`, `Puzzles.tsx`, `defiAppareil.ts`, `gel.ts` |
| Go du jour « Vu » | 0 | **oui** (l'effort du jour compte) | non | non | `aide.ts` |
| Révision du jour finie (3 problèmes réussis ou « Vu », J+1, J+3, J+7) | +20, une fois par jour (C1) | **oui** | non | un « Vu » réussi en révision **reste « Vu »** (voir P6) | `RevisionDuJour.tsx`, `revision.ts` |
| Leçon terminée, 1re fois | +30 | **oui** | non (aucun badge de leçon) | chemin des leçons | `Learn.tsx` |
| Leçon rejouée jusqu'au bout | 0 | **oui** | non | non | `Learn.tsx` |
| Série d'entraînement après une leçon (3 problèmes, #200) | +10 par problème neuf | non | comme un problème | compte pour le palier | `SeriePratique.tsx` |
| Course aux problèmes (3 min, 3 erreurs, #287) | **0** | **non** | non | meilleur score gardé ; ne touche ni la cote, ni les réussis | `course.ts`, `CourseProblemes.tsx` |
| « Je sais déjà jouer » : placement en 3 problèmes (#283) | 0 | non | non | cote de départ, adversaires ouverts jusqu'au conseillé, leçon conseillée | `placement.ts` |
| Partie contre l'ordi, perdue ou abandonnée (plus de 10 coups) | +15 | **non** | « Première partie » | défaite au bilan | `Game.tsx`, `bilan.ts` |
| Partie contre l'ordi, gagnée | +40 (15 + 25) | **non** | « Première partie », « Pomme battue » (**Pomme ou plus fort**, C7) | adversaire suivant ouvert | `Game.tsx`, `bilan.ts`, `vitrine.ts` |
| Partie guidée avec Mochi (#79), gagnée / perdue | +40 / +15 | non | « Première partie » ; **pas** « Pomme battue » (hors bilan) | Mochi ajuste sa force | `App.tsx`, `Game.tsx` |
| Partie de 10 coups ou moins | 0 | non | « Première partie » | — | `xp.ts` (`sourceXpPartie`) |
| Partie à deux sur le même appareil | +15 | non | « Première partie » | — | `Game.tsx` |
| « Rejouer d'ici » depuis la revue | 0 (C6) | non | — | — | `xp.ts` (`sourceXpPartie`) |
| Quitter pendant le récit du score | XP créditée au départ (C5) | non | — | — | `Game.tsx` |
| Rejouer une erreur (« Tes erreurs », #77), jusqu'à la maîtrise | **0** | non | non | calendrier espacé propre | `MesErreurs.tsx`, `redite*.ts` |
| Revue d'une partie, import SGF et analyse KataGo (#286) | 0 | non | non | — | `Revue.tsx`, `ImportSgf.tsx` |
| Premières parties à komi réduit (#160) | comme une partie | — | — | rend la 1re victoire possible, pas l'XP | `equilibrage.ts` |
| Défi par lien (#81, phase 1 : serveur seulement) | pas encore branché | pas encore | — | — | `src/data/defi.ts` |

Paliers de niveau (`xp.ts`) : coût `min(1000, 100 × 1,25^(n−1))` arrondi à 5. Seuils cumulés : niveau 2 à 100 XP, 3 à 225, 4 à 380, 5 à 575, 6 à 820, 7 à 1 125, 8 à 1 505, 9 à 2 100, 10 à 2 845, 11 à 3 775, 12 à 4 775, puis +1 000 par niveau. Récompenses cosmétiques : Kaya clair (niveau 3), Ardoise (5), Coquillage doré (8). Rien après le niveau 8.

Série de l'appareil (`defi.ts`, `gel.ts`, `serieRecord.ts`) : un défi par jour (Go du jour, leçon ou révision). Un gel gagné à chaque multiple de 7 jours, 2 au plus. Un jour manqué consomme un gel ; s'il n'y en a pas assez, la série repart et les gels restent. Le record ne descend jamais. Côté serveur (joueur connecté), la série reste celle du seul Go du jour ; l'écran montre la plus longue des deux.

Badges (`vitrine.ts`) : 7, gardés pour toujours une fois gagnés, mémorisés à l'ouverture du Profil.

## 2. Simulation sur 30 jours

Quatre joueurs types, chaque jour (détail dans `src/app/economie.test.ts`) :
- **10 min/jour** : Go du jour, révision, 2 problèmes « Continuer », une leçon un jour sur deux (tant qu'il en reste), sinon une partie contre Pomme (une sur 3 gagnée). Force réelle 350, +10 par jour.
- **30 min/jour** : Go du jour, révision, 6 problèmes, une leçon et sa série d'entraînement, 2 parties (une sur 2 gagnée). Force 350, +18 par jour.
- **10 min, 5 j/7** : comme le premier, absent le week-end.
- **Club, 20 min/jour** (nouveau) : placé à 10 kyu par « Je sais déjà jouer » (cote de départ 950). Pas de leçon, Go du jour, révision, 4 problèmes, une partie contre Renard (une sur 2 gagnée). Force 1 000.

« Continuer » choisit comme l'écran (`choisirProbleme`). Chaque problème est réussi du premier coup avec la chance prévue par l'écart entre la force du joueur et sa difficulté ; sinon, une fois sur deux, il est trouvé avec l'aide (réussi), l'autre fois « Vu ». Le tirage est fixé (graine 233) : les chiffres sont reproductibles.

| Joueur | J1 | J7 | J30 | Récompenses (niv. 3 / 5 / 8) |
|---|---|---|---|---|
| 10 min/jour | niv. 2 (100 XP), 1 badge | niv. 5 (635), 5 badges, série 7 | **niv. 9** (2 470), 6 badges | J3 / J7 / J18 |
| 30 min/jour | niv. 3 (225), 3 badges | niv. 7 (1 345), 6 badges | **niv. 12** (4 560), 7 badges | J1 / J3 / J8 |
| 10 min, 5 j/7 | niv. 2 (100), 1 badge | niv. 4 (455), 4 badges, série 0 | niv. 8 (1 835), 5 badges, **record 5, 0 gel** | J3 / J9 / J24 |
| Club, 20 min/jour | niv. 2 (115), 2 badges | niv. 5 (730), 5 badges | niv. 10 (3 135), 7 badges | J2 / J6 / J15 |

Jour de chaque badge :
- 10 min : « Premier problème » J1, « Première partie » J2, « Pomme battue » et « 10 problèmes » J4, « 7 jours » J7, « Palier Débutant » J13. « Palier Novice » jamais.
- 30 min : trois badges J1, « 10 problèmes » J2, « Palier Débutant » J5, « 7 jours » J7, « Palier Novice » J14.
- 5 j/7 : même début, « Palier Débutant » J16. « 7 jours » et « Palier Novice » jamais.
- Club : « Pomme battue » J2 (**jamais avant C7**), « Palier Novice » J26, « Palier Débutant » **J29**.

Lecture :
- **Session** : le niveau 2 tombe dès le premier jour pour tous, y compris le joueur de 10 minutes qui a un problème « Vu » dès J1. Avant C8, il finissait à 90 XP sur 100.
- **Semaine** : le niveau 3 arrive à J3 à 10 minutes, dès J1 à 30 minutes. 4 à 6 badges à J7. Bon rythme.
- **Mois** : le joueur de 30 minutes a tout débloqué à J8 (dernier thème) et ses 7 badges à J14. Ensuite, plus rien de nouveau à gagner que des niveaux sans récompense. Le joueur de club gagne ses badges de palier par hasard, le jour où le Go du jour lui tend enfin les derniers problèmes faciles.
- Le Go du jour (620 XP) et la révision (580) restent les sources les plus régulières à 10 minutes, devant les problèmes neufs (460).

## 3. Incohérences et trous

Classés du plus net au moins net. **C** = corrigé ; **P** = proposé. C1 à C6 datent du 28/09 (PR #239, #261) ; C7 et C8 du 29/09.

### Corrigées
1. **C7. Le badge « Pomme battue » restait grisé pour toujours chez le joueur placé.** « Je sais déjà jouer » (#283) ouvre l'échelle jusqu'à l'adversaire conseillé ; un joueur de club joue Renard ou Tigre, jamais Pomme. Or ce badge vise la première victoire. Simulation avant : le joueur de club finit J30 à 6 badges sur 7, avec un badge impossible sous les yeux, alors que c'est le second cercle de la charte. Corrigé (`vitrine.ts`, 1 ligne) : une victoire contre **n'importe quel** adversaire de l'échelle le donne (ils sont tous plus forts que Pomme). Texte : « Bats Pomme ou plus fort. » (EN : « Beat Pomme or anyone stronger. »). Nom et icône inchangés. Testé dans `vitrine.test.ts` et la simulation. Indicateur : badges par actif à J7 chez les joueurs placés.
2. **C8. Le niveau 2 du premier jour tenait à 0 XP près.** Le joueur de 10 minutes finissait J1 à 100 XP pile : un seul problème « Vu » (le cas normal d'un débutant) et le niveau 2 ne tombait pas (simulation réaliste : 90 XP). Et le bonus « première fois » valait +20 pour une partie ou une leçon, mais +10 pour un problème, sans raison. Corrigé (`xp.ts`, une constante) : `BONUS_PREMIERE.probleme = 20`. Règle simple : « chaque première fois rapporte +20 ». Le premier Go du jour affiche « +40 XP, dont +20 première fois ». Testé dans `xp.test.ts`, la simulation et `e2e/xp.spec.ts`. Indicateur : `niveau_atteint` (niveau 2) le jour de l'installation.
3. C1 : la révision finie rapporte +20, comme le Go du jour. Règle : **tout défi qui fait vivre la série rapporte au moins autant que le Go du jour**.
4. C2 : la condition du badge « 7 jours » parle d'un défi, plus du seul Go du jour.
5. C3 : commentaire de `xp.ts` sur le niveau 2 corrigé (encore précisé le 29/09).
6. C4 : le Go du jour rapporte chaque jour, même déjà réussi dans la grille.
7. C5 : l'XP d'une partie est acquise même si on quitte pendant le récit du score.
8. C6 : « Rejouer d'ici » ne rapporte pas d'XP (sinon, boucle infinie).

### Proposées (hors des modules de logique, ou décision produit)
9. **P10 (nouveau). La course aux problèmes ne rapporte rien.** 3 minutes d'effort réel, un problème juste après l'autre : 0 XP, pas de série, et les problèmes justes ne comptent pas comme réussis. C'est le seul mode d'effort sans gain, et c'est le mode le plus « jeu » de l'app. Proposition : une course finie avec au moins un problème juste rapporte **+15, comme une partie**, une fois par jour ; les suivantes rapportent 0 (un record à battre suffit, et on ferme le robinet de la course en boucle). Ajouter `course: 15` à `GAINS` et l'appeler à la fin (`CourseProblemes.tsx`, 2 lignes, périmètre de l'agent problèmes). Pas de série : une course n'est pas le défi commun. Indicateur : `course_terminee` par actif, J7.
10. **P2. Une partie ne fait pas vivre la série.** C'est l'action principale de l'app et un indicateur de la charte (5 parties terminées par actif et par semaine). Le joueur de club qui ne fait « que » jouer n'a pas de série. Chez chess.com, toute activité compte. Proposition : `'partie'` dans `Defi`, `validerDefi('partie')` au gain d'XP d'une partie de plus de 10 coups (`Game.tsx`, 1 ligne). A/B avec `SERIE_UN_DEFI`. Indicateur : J7, parties terminées par semaine.
11. **P3. Les gels ne protègent pas le joueur irrégulier.** Le joueur « 5 jours sur 7 » n'atteint jamais 7 jours : **jamais de gel ni de badge « 7 jours »** (record 5, 0 gel à J30). Pistes à trancher en A/B : un gel offert au premier Go du jour et `JOURS_PAR_GEL = 5` ; ou 1 jour de grâce (chess.com en donne 2). Aucune ne couvre seule un week-end : la grâce d'un jour plus un gel le couvre. Indicateur : `serie_perdue`, J7 et J30 du segment « moins de 7 jours actifs par semaine ».
12. **P6 (à moitié fait). Un « Vu » réussi en révision reste « Vu ».** Depuis #251, la révision repropose les problèmes « Vu » (bien). Mais les réussir là, du premier coup, ne les compte pas comme réussis : ni XP, ni palier. Le joueur refait l'effort sans que rien ne bouge. Proposition : `RevisionDuJour` reçoit un `onReussi(id)` ; `Puzzles.tsx` y branche `markSolved` et `gagnerXp('probleme')` pour un « Vu » réussi sans aide (5 lignes, agent problèmes). Indicateur : `revision_faite`, badges de palier à J30.
13. **P11 (nouveau). Les badges de palier arrivent par hasard chez le joueur de club.** « Continuer » à ta mesure (#284) ne lui propose jamais les problèmes faciles. « Palier Débutant » tombe à J29, le jour où le Go du jour sert le dernier problème facile qui manquait. Et « Finis le palier Débutant » annonce une fin, contre la règle #137. Proposition : le badge se gagne quand le palier est complet **ou dépassé** (cote cachée au-delà de la borne haute du palier, plus 3 réussites dans le palier suivant) ; condition « Passe le palier Débutant. ». Demande de passer la cote au calcul des badges (`Profil.tsx`, `vitrine.ts` : 5 lignes). Indicateur : badges par actif à J30, segment placé.
14. **P12 (nouveau). Deux révisions espacées, une seule payée.** La révision du jour rapporte +20 ; « Tes erreurs », qui reprend tes propres fautes jusqu'à la maîtrise (le cœur de la charte, point 3), rapporte 0 et ne compte pas pour la série. Proposition : une erreur **maîtrisée** (dernière étape du calendrier) rapporte +10, comme un problème neuf ; une erreur rejouée du jour compte comme la révision du jour (partage ses +20). `MesErreurs.tsx`, 3 lignes. Indicateur : `erreur_rejouee` par actif, J7.
15. **P7. Plus rien à débloquer après le niveau 8** (J8 à 30 minutes, J18 à 10 minutes). Proposition : deux ou trois thèmes aux niveaux 10, 12 et 15 (agent design, `boardArt.ts`), et un badge « Chemin des leçons fini » (aucun badge de leçon aujourd'hui, alors que le Profil montre « 3 / 8 leçons »). Indicateur : `niveau_atteint` au-delà de 8, J30.
16. **P8. La leçon rejouée fait vivre la série sans rien rapporter.** Règle proposée : « rejouer une leçon, c'est la révision du jour » : +20 une fois par jour, partagé avec la révision (`Learn.tsx`).
17. **P13 (nouveau). La partie guidée ne compte pas au bilan.** Une victoire contre Mochi guidé rapporte +40 mais ne donne ni « Pomme battue » ni « adversaire battu ». Avec C7, le joueur qui ne joue qu'en guidé n'a toujours pas le badge. À trancher : c'est peut-être voulu (Mochi s'adapte). Proposition minimale : ne rien changer au badge, mais le dire dans la fin de partie guidée (« Prêt pour Pomme ? »). Agent partie.
18. **P14 (nouveau). Le défi par lien arrive sans règle de gain.** Phase 1 livrée côté serveur (#81). À décider avant l'écran : une partie par lien finie rapporte +15 / +40 comme une partie ; jouer un coup dans un défi fait vivre la série (c'est un rendez-vous quotidien naturel, comme chez chess.com en partie par correspondance). Et un mot par objet : « défi » désigne déjà « un défi par jour » (`defi.ts`) ; appeler l'autre « partie par lien » dans l'interface.
19. **P9. Contenu fini face à la courbe.** Les 8 leçons (260 XP, bonus compris) et les 183 problèmes (environ 1 850 XP) valent environ 2 100 XP : le niveau 9. Au-delà, seules les parties font monter. Il faut environ 5 problèmes neufs par jour pour que le joueur de 30 minutes n'en manque pas. À transmettre à l'agent contenu.
20. **Tenu, rien à changer** : l'XP ne descend jamais (testé) ; le record non plus ; un badge gagné reste ; la course et le placement ne touchent ni la série ni l'XP, donc rien ne se perd ; le komi réduit ne change pas l'XP ; « Vu » ne rapporte pas d'XP mais garde la série du Go du jour ; aucun total dans les problèmes, aucune cote affichée ; aucun minuteur pour revenir chercher une récompense ; rien ne s'achète.

## 4. Suite
- P10, P6, P12 : 2 à 5 lignes chacune dans les écrans des agents problèmes et partie. À prendre dans leur prochaine PR, avec la simulation relancée.
- P2 et P3 changent la règle de série : A/B, comme `SERIE_UN_DEFI`.
- P11 et P14 demandent une décision produit (badge de palier, règle du défi par lien).
- Relancer la simulation à chaque changement de barème : elle doit rester verte (niveau 2 à J1 même avec un « Vu », niveau 3 dans la semaine à 10 minutes, XP et record jamais en baisse, joueur placé avec sa première victoire).
