# Économie de progression

Tenu par l'agent `game-designer`. Issues #233 et #529. Dernière mise à jour : 13/10/2026 (#529, section 5).

Cette page fait la carte de tout ce que le joueur gagne : XP, niveaux, thèmes de goban, série, gels, record, badges, paliers. Les sections 1 à 4 datent de #233 (29/09) ; la section 5 dit ce que #529 a changé et donne les chiffres d'aujourd'hui (le contenu a grandi : 35 leçons). Elle dit où ces systèmes se contredisent et ce qu'on corrige. Les chiffres viennent de la simulation `src/app/economie.test.ts` : vraies règles, vrai contenu (8 leçons, 183 problèmes), et depuis le 29/09 le vrai « Continuer » à ta mesure (`coteJoueur.ts`, #284). Lance `npx vitest run src/app/economie.test.ts` pour revoir les chiffres.

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
| Révision du jour finie (séance « Révisions du jour », #469) | +20, une fois par jour (C1) | **oui** (la séance aussi depuis #529) | non | un « Vu » réussi en révision **reste « Vu »** (voir P6) | `RevisionDuJour.tsx`, `revision.ts` |
| Leçon terminée, 1re fois | +30 | **oui** | non (aucun badge de leçon) | chemin des leçons | `Learn.tsx` |
| Leçon rejouée jusqu'au bout | 0 | **oui** | non | non | `Learn.tsx` |
| Partie de découverte (#524) menée jusqu'au comptage, 1re fois | +30 (comme une leçon ; + le bonus « première leçon » s'il n'est pas déjà pris) | non | non | non | `PartieDecouverte.tsx` |
| Partie de découverte rejouée | 0 | non | non | non | `PartieDecouverte.tsx` |
| Série d'entraînement après une leçon (3 problèmes, #200) | +10 par problème neuf | non | comme un problème | compte pour le palier | `SeriePratique.tsx` |
| Course aux problèmes (3 min, 3 erreurs, #287) | **+15**, première course du jour avec au moins un problème juste (#529, `XP_COURSE`, A/B 8.4) ; 0 ensuite | non | « Première course » | meilleur score gardé ; ne touche ni la cote, ni les réussis | `xp.ts` (`crediterCourse`), `CourseProblemes.tsx` |
| « Je sais déjà jouer » : placement en 3 problèmes (#283) | 0 | non | non | cote de départ, adversaires ouverts jusqu'au conseillé, leçon conseillée | `placement.ts` |
| Partie contre l'ordi, perdue ou abandonnée (plus de 10 coups) | +15 | **oui** depuis #529 (`SERIE_UN_DEFI`) | « Première partie », « Goban 13 × 13 / 19 × 19 » | défaite au bilan | `Game.tsx`, `xp.ts` (`gagnerXp`), `bilan.ts` |
| Partie contre l'ordi, gagnée | +40 (15 + 25) | **oui** depuis #529 | « Première partie », « Pomme battue » (**Pomme ou plus fort**, C7), « Trois adversaires » | adversaire suivant ouvert | `Game.tsx`, `bilan.ts`, `vitrine.ts` |
| Partie guidée avec Mochi (#79), gagnée / perdue | +40 / +15 | **oui** depuis #529 | « Première partie » ; **pas** « Pomme battue » (hors bilan) | Mochi ajuste sa force | `App.tsx`, `Game.tsx` |
| Partie de 10 coups ou moins | 0 | non | « Première partie » | — | `xp.ts` (`sourceXpPartie`) |
| Partie à deux sur le même appareil | +15 | **oui** depuis #529 | « Première partie » | — | `Game.tsx` |
| « Rejouer d'ici » depuis la revue | 0 (C6) | non | — | — | `xp.ts` (`sourceXpPartie`) |
| « Rejouer mes erreurs » fini (#428) | +10, une fois par partie (bonus « première fois » des problèmes) | non | — | — | `rejouerErreurs.ts` (`marquerPartie`), `RejouerErreurs.tsx` |
| Quitter pendant le récit du score | XP créditée au départ (C5) | non | — | — | `Game.tsx` |
| Rejouer une erreur (« Tes erreurs », #77), jusqu'à la maîtrise | 0 par essai ; **+10 à la maîtrise** dans la séance de révisions (#529, P12) | non | « Erreur maîtrisée » | calendrier espacé propre | `SeanceRevisions.tsx`, `revisionEspacee.ts` |
| Revue d'une partie, import SGF et analyse KataGo (#286) | 0 | non | « Première revue » (#529) | — | `Revue.tsx`, `ImportSgf.tsx` |
| Partie en ligne finie, non annulée (#529) | 0 (la cote est la récompense, #417) | **oui** au-delà de 10 coups | « Première partie en ligne », « Victoire classée » | — | `xp.ts` (`finirPartieEnLigne`), `Direct.tsx` |
| Premières parties à komi réduit (#160) | comme une partie | — | — | rend la 1re victoire possible, pas l'XP | `equilibrage.ts` |
| Défi par lien (#81, phase 1 : serveur seulement) | pas encore branché | pas encore | — | — | `src/data/defi.ts` |
| Objectif de la semaine atteint (#369) : parties terminées, problèmes réussis, erreurs rejouées | +30 par objectif, une fois par semaine (pas de bonus « première fois ») | non | non | cibles personnelles, voir plus bas | `semaine.ts`, `xp.ts` (`noterActivite`) |

Paliers de niveau (`xp.ts`) : coût `min(1000, 100 × 1,25^(n−1))` arrondi à 5. Seuils cumulés (corrigés le 13/10, #529 : la page donnait 2 100 pour le niveau 9 et la suite décalée) : niveau 2 à 100 XP, 3 à 225, 4 à 380, 5 à 575, 6 à 820, 7 à 1 125, 8 à 1 505, 9 à 1 980, 10 à 2 575, 11 à 3 320, 12 à 4 250, 13 à 5 250, puis +1 000 par niveau (15 à 7 250). Récompenses cosmétiques : Kaya clair (niveau 3), Ardoise (5), Coquillage doré (8), et depuis #529 Cerisier (10), pierres Jade (12), Kaya ancien (15).

Série de l'appareil (`defi.ts`, `gel.ts`, `serieRecord.ts`) : un défi par jour (Go du jour, leçon, révision, et depuis #529 partie terminée de plus de 10 coups). Un gel gagné à chaque multiple de 7 jours, 2 au plus. Un jour manqué consomme un gel ; s'il n'y en a pas assez, la série repart et les gels restent. Le record ne descend jamais. Côté serveur (joueur connecté), la série reste celle du seul Go du jour ; l'écran montre la plus longue des deux.

Badges (`vitrine.ts`) : 23 depuis #729 (21 depuis #529, 7 avant), gardés pour toujours une fois gagnés, mémorisés à l'ouverture du Profil ; cinq se notent au moment où ils sont gagnés (`badgesGagnes.ts`), dont « Parrain » et « Invité » (#729, voir 5.5).

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
9. **P10 (fait par #529). La course aux problèmes ne rapporte rien.** 3 minutes d'effort réel, un problème juste après l'autre : 0 XP, pas de série, et les problèmes justes ne comptent pas comme réussis. C'est le seul mode d'effort sans gain, et c'est le mode le plus « jeu » de l'app. Proposition : une course finie avec au moins un problème juste rapporte **+15, comme une partie**, une fois par jour ; les suivantes rapportent 0 (un record à battre suffit, et on ferme le robinet de la course en boucle). Ajouter `course: 15` à `GAINS` et l'appeler à la fin (`CourseProblemes.tsx`, 2 lignes, périmètre de l'agent problèmes). Pas de série : une course n'est pas le défi commun. Indicateur : `course_terminee` par actif, J7.
10. **P2 (fait par #529). Une partie ne fait pas vivre la série.** C'est l'action principale de l'app et un indicateur de la charte (5 parties terminées par actif et par semaine). Le joueur de club qui ne fait « que » jouer n'a pas de série. Chez chess.com, toute activité compte. Proposition : `'partie'` dans `Defi`, `validerDefi('partie')` au gain d'XP d'une partie de plus de 10 coups (`Game.tsx`, 1 ligne). A/B avec `SERIE_UN_DEFI`. Indicateur : J7, parties terminées par semaine.
11. **P3. Les gels ne protègent pas le joueur irrégulier.** Le joueur « 5 jours sur 7 » n'atteint jamais 7 jours : **jamais de gel ni de badge « 7 jours »** (record 5, 0 gel à J30). Pistes à trancher en A/B : un gel offert au premier Go du jour et `JOURS_PAR_GEL = 5` ; ou 1 jour de grâce (chess.com en donne 2). Aucune ne couvre seule un week-end : la grâce d'un jour plus un gel le couvre. Indicateur : `serie_perdue`, J7 et J30 du segment « moins de 7 jours actifs par semaine ».
12. **P6 (à moitié fait). Un « Vu » réussi en révision reste « Vu ».** Depuis #251, la révision repropose les problèmes « Vu » (bien). Mais les réussir là, du premier coup, ne les compte pas comme réussis : ni XP, ni palier. Le joueur refait l'effort sans que rien ne bouge. Proposition : `RevisionDuJour` reçoit un `onReussi(id)` ; `Puzzles.tsx` y branche `markSolved` et `gagnerXp('probleme')` pour un « Vu » réussi sans aide (5 lignes, agent problèmes). Indicateur : `revision_faite`, badges de palier à J30.
13. **P11 (nouveau). Les badges de palier arrivent par hasard chez le joueur de club.** « Continuer » à ta mesure (#284) ne lui propose jamais les problèmes faciles. « Palier Débutant » tombe à J29, le jour où le Go du jour sert le dernier problème facile qui manquait. Et « Finis le palier Débutant » annonce une fin, contre la règle #137. Proposition : le badge se gagne quand le palier est complet **ou dépassé** (cote cachée au-delà de la borne haute du palier, plus 3 réussites dans le palier suivant) ; condition « Passe le palier Débutant. ». Demande de passer la cote au calcul des badges (`Profil.tsx`, `vitrine.ts` : 5 lignes). Indicateur : badges par actif à J30, segment placé.
14. **P12 (fait par #529 pour la maîtrise). Deux révisions espacées, une seule payée.** La révision du jour rapporte +20 ; « Tes erreurs », qui reprend tes propres fautes jusqu'à la maîtrise (le cœur de la charte, point 3), rapporte 0 et ne compte pas pour la série. Proposition : une erreur **maîtrisée** (dernière étape du calendrier) rapporte +10, comme un problème neuf ; une erreur rejouée du jour compte comme la révision du jour (partage ses +20). `MesErreurs.tsx`, 3 lignes. Indicateur : `erreur_rejouee` par actif, J7.
15. **P7 (fait par #529). Plus rien à débloquer après le niveau 8** (J8 à 30 minutes, J18 à 10 minutes). Proposition : deux ou trois thèmes aux niveaux 10, 12 et 15 (agent design, `boardArt.ts`), et un badge « Chemin des leçons fini » (aucun badge de leçon aujourd'hui, alors que le Profil montre « 3 / 8 leçons »). Indicateur : `niveau_atteint` au-delà de 8, J30.
16. **P8. La leçon rejouée fait vivre la série sans rien rapporter.** Règle proposée : « rejouer une leçon, c'est la révision du jour » : +20 une fois par jour, partagé avec la révision (`Learn.tsx`).
17. **P13 (nouveau). La partie guidée ne compte pas au bilan.** Une victoire contre Mochi guidé rapporte +40 mais ne donne ni « Pomme battue » ni « adversaire battu ». Avec C7, le joueur qui ne joue qu'en guidé n'a toujours pas le badge. À trancher : c'est peut-être voulu (Mochi s'adapte). Proposition minimale : ne rien changer au badge, mais le dire dans la fin de partie guidée (« Prêt pour Pomme ? »). Agent partie.
18. **P14 (nouveau). Le défi par lien arrive sans règle de gain.** Phase 1 livrée côté serveur (#81). À décider avant l'écran : une partie par lien finie rapporte +15 / +40 comme une partie ; jouer un coup dans un défi fait vivre la série (c'est un rendez-vous quotidien naturel, comme chez chess.com en partie par correspondance). Et un mot par objet : « défi » désigne déjà « un défi par jour » (`defi.ts`) ; appeler l'autre « partie par lien » dans l'interface.
19. **P9. Contenu fini face à la courbe.** Les 8 leçons (260 XP, bonus compris) et les 183 problèmes (environ 1 850 XP) valent environ 2 100 XP : le niveau 9. Au-delà, seules les parties font monter. Il faut environ 5 problèmes neufs par jour pour que le joueur de 30 minutes n'en manque pas. À transmettre à l'agent contenu.
20. **Tenu, rien à changer** : l'XP ne descend jamais (testé) ; le record non plus ; un badge gagné reste ; la course et le placement ne touchent ni la série ni l'XP, donc rien ne se perd ; le komi réduit ne change pas l'XP ; « Vu » ne rapporte pas d'XP mais garde la série du Go du jour ; aucun total dans les problèmes, aucune cote affichée ; aucun minuteur pour revenir chercher une récompense ; rien ne s'achète.

## 3 bis. Objectifs de la semaine (#369, 05/10)

Décision de Florian du 05/10 : de l'émulation qui marche dès 2 joueurs, et des objectifs personnels de la semaine.

- **Trois objectifs** par semaine (lundi 0 h à dimanche 24 h, heure de Paris) : **terminer des parties** (contre l'ordi, à deux, guidée ou en ligne ; une partie de 10 coups ou moins ne compte pas, comme pour l'XP ; une partie en ligne annulée non plus), **réussir des problèmes** (problème neuf, Go du jour, révision du jour finie) et **rejouer des erreurs** (chaque erreur rejouée dans la revue, dans « Rejouer mes erreurs » ou dans « Tes erreurs à rejouer »).
- **Cibles** : 3 / 5 / 2 la première semaine. Ensuite, au moins ce que tu as fait la semaine d'avant, sans dépasser 7 / 15 / 5 : la cible suit ton rythme sans devenir une corvée. Après une semaine sans app, retour au départ (rien ne se perd).
- **Gain** : +30 XP par objectif atteint (autant qu'une leçon), une seule fois par objectif et par semaine, soit 90 XP au plus par semaine : moins d'un sixième des ~600 XP d'une semaine à 10 minutes par jour (simulation ci-dessus). Pas de bonus « première fois » sur ce gain, pas de perte, pas de minuteur, pas de rappel insistant : l'objectif se lit dans Profil, « Ta semaine ».
- **Bilan** : au premier passage de la semaine suivante, l'accueil montre une fois ce que tu as fait (et, avec un compte, tes amis battus et ta cote de la semaine, calculés par le serveur). Il ne revient pas avant la semaine d'après.
- **Ce qui compare des joueurs** (Go du jour entre amis, amis battus, records de cote) est calculé par le serveur (`supabase/migrations/20261005230100_emulation_amis.sql`) ; les objectifs, personnels, restent sur l'appareil.

## 4. Suite
- P10, P6, P12 : 2 à 5 lignes chacune dans les écrans des agents problèmes et partie. À prendre dans leur prochaine PR, avec la simulation relancée.
- P2 et P3 changent la règle de série : A/B, comme `SERIE_UN_DEFI`.
- P11 et P14 demandent une décision produit (badge de palier, règle du défi par lien).
- Relancer la simulation à chaque changement de barème : elle doit rester verte (niveau 2 à J1 même avec un « Vu », niveau 3 dans la semaine à 10 minutes, XP et record jamais en baisse, joueur placé avec sa première victoire).

## 5. #529 : chaque effort compte, et il reste à gagner après J14 (13/10)

Indicateurs visés (charte) : **J7** et **J30**, **5 parties terminées par actif et par semaine**, badges par actif à J30. Chiffres : `npx vitest run src/app/economie.test.ts` (bloc « #529 »), règles d'avant (`AVANT`) et d'après (`APRES`) rejouées sur les mêmes joueurs, même graine.

### 5.1 Règles

| Règle | Avant | Après | Interrupteur | Mesure |
|---|---|---|---|---|
| Course aux problèmes finie avec au moins un problème juste | 0 | **+15 XP, une fois par jour** (les suivantes : 0 ; pas de bonus « première fois » ; pas de série) | `XP_COURSE` (`xp.ts`), A/B 8.4 de `docs/data/tableaux-de-bord.md` | `course_terminee` sur deux jours différents la première semaine ; `xp_gagne.sources` contient `course` |
| Partie terminée (ordi, guidée, à deux) de plus de 10 coups | XP seulement | XP **et défi du jour** (série, gel tous les 7 jours) | `SERIE_UN_DEFI` (`defi.ts`), A/B 8.1 | J7 ; `partie_terminee` par actif et par semaine |
| Partie en ligne finie (plus de 10 coups, pas annulée) | rien | défi du jour, badges « Première partie en ligne » et « Victoire classée » ; **pas d'XP** (la cote est la récompense, et l'XP en ligne ouvrirait une ferme à parties) | `SERIE_UN_DEFI` | `partie_en_ligne_terminee` |
| Séance « Révisions du jour » finie (#469) | +20 XP, **sans série** (oubli de #469) | +20 XP et défi du jour, comme l'ancienne carte | — | `revision_seance_terminee` |
| Erreur maîtrisée dans la séance (dernière marche, J+30) | 0 | **+10 XP** (P12) | — | `erreur_maitrisee` |
| Récompenses de niveau | 3, 5, 8 | **+ 10 Cerisier, 12 pierres Jade, 15 Kaya ancien** (contraste lignes et pierres ≥ 3:1, coordonnées ≥ 4,5:1, testés) | — | `niveau_atteint` (niveaux 10, 12, 15) |
| Badges | 7 | **23** (#729), en cinq familles | seuils nommés `SEUILS_BADGES` (`vitrine.ts`) | badges par actif à J30 (à instrumenter : voir 5.4) |

Rien ne se perd, rien ne s'achète, aucun minuteur : la course payée « une fois par jour » n'est jamais annoncée comme une urgence (le texte ne dit pas « reviens demain »). La deuxième course du jour ne montre rien de négatif, seulement le score et le record.

### 5.2 Badges (23)

Ordre de la vitrine = ordre où un joueur type les rencontre ; repliée, elle montre les gagnés et les 4 suivants (« Voir les 23 badges » ouvre le reste) : jamais un mur de 17 sceaux gris.

| Famille (sceau) | Badges | Condition |
|---|---|---|
| Premiers pas (jade rond ; hanko pour la victoire) | Première partie, Premier problème, Première leçon, Pomme battue, Première course | une première fois chacun |
| Régularité (or rond) | 7 jours de série, 30 jours de série, Objectif de la semaine | série (record) ; un objectif de la semaine atteint |
| Maîtrise (or carré) | 10 problèmes, 50 problèmes, Palier Débutant, Palier Novice, Les bases, 5 d'affilée, Erreur maîtrisée, Trois adversaires | caps sans total (#137) ; chapitre « Les bases » fini ; 5 d'affilée dans une série « Par thème » ; une erreur sortie de la révision ; 3 adversaires différents battus |
| Découverte (jade carré) | Goban 13 × 13, Goban 19 × 19, Première revue | une partie terminée sur ce plateau ; une partie revue avec l'analyse |
| Avec les autres (hanko carré) | Première partie en ligne, Victoire classée, Parrain, Invité | notés à la fin de la partie en ligne ; Parrain et Invité (#729) : un ami arrivé par ton lien a joué sa première partie (le serveur décide) |

Tous se déduisent de données déjà gardées sur l'appareil (aucune nouvelle clé, aucune migration) sauf trois, notés au moment où ils sont gagnés dans `go.badges.v1` : Objectif de la semaine, Première partie en ligne, Victoire classée. Les badges restent sur l'appareil, comme avant : la table `achievements` (RLS en place) n'est toujours pas alimentée ; la brancher serait une migration additive, pas utile tant que le Profil d'un autre joueur ne montre pas ses badges.

### 5.3 Équilibrage : XP par semaine, avant et après

Moyenne des 4 premières semaines (XP à J28 ÷ 4). Nouveau joueur type : **joueur de parties** (2 parties par jour, une course, jamais le Go du jour ni la révision, absent le week-end).

| Joueur | XP / semaine avant | après | Écart | Record de série à J30 avant → après | Niveaux 8 / 10 / 12 / 15 (après) | Badges J30 / J90 (sur 21) |
|---|---|---|---|---|---|---|
| 10 min/jour | 589 | 589 | 0 % | 30 → 30 | J18 / J31 / J51 / J87 | 10 / 11 |
| 30 min/jour | 1 333 | 1 333 | 0 % | 30 → 30 | J8 / J14 / J23 / J42 | 11 / 11 |
| 10 min, 5 j/7 | 425 | 425 | 0 % | 5 → 5 | J24 / J39 / J59 / après J90 | 8 / 11 |
| Club, 20 min/jour, une course | 730 | 835 | **+14 %** (la course : 15 × 7) | 30 → 30 | J13 / J22 / J36 / J63 | 8 / 10 |
| Joueur de parties, 5 j/7 | 280 | 355 | **+27 %** (la course) | **0 → 5** | J30 / J45 / J69 / après J90 | 3 / 5 |

Lecture :
- **Rien ne bouge pour qui ne fait pas de course** : la partie qui fait vivre la série ne rapporte pas d'XP en plus, et ceux qui font déjà le Go du jour avaient déjà leur série. Le plafond de la courbe tient (le joueur de 30 minutes reste sous le niveau 15 à J30, testé).
- **La course ajoute au plus 105 XP par semaine** (7 × 15, testé quel que soit le nombre de courses), soit environ 10 % d'un niveau plafonné (1 000 XP). Elle avance d'environ 9 jours le niveau 10 du joueur de club (J31 → J22). C'est le seul gain d'XP de #529, et c'est le montant discutable : il passe en A/B (8.4, bras témoin `XP_COURSE = 0`, variante à tester aussi : 10).
- **Le joueur de parties a enfin une série** : record 0 → 5 à J30 (un week-end sur deux casse encore la série sans gel : c'est P3, jour de grâce, toujours à trancher en A/B).
- **Après J14** : à 10 minutes par jour, il reste des récompenses au deuxième mois (niveau 10 à J31, 12 à J51) et au troisième (15 à J87), et des badges jusqu'à J42 au moins dans la simulation, qui ne compte ni revue, ni série par thème, ni erreur maîtrisée, ni partie en ligne, ni 13 × 13 : ces badges-là s'ajoutent pour le vrai joueur. À 30 minutes, plus rien de neuf entre J42 et J90 hors de ces badges : prochain chantier (P9, contenu).

### 5.4 Reste à faire
- **Mesure des badges** : aucun événement `badge_gagne` n'existe (les badges se notent à l'ouverture du Profil). Pour lire « badges par actif à J30 », il faudra un événement (plan de marquage et politique de confidentialité). Pas fait ici pour ne pas ajouter d'événement sans tableau de bord.
- **P3 (jour de grâce)**, **P6** (« Vu » réussi en révision), **P11** (badge de palier dépassé) : non traités par #529.
- **Migration** `20261013224500_themes_goban_niveaux.sql` (liste blanche des décors synchronisés) : à appliquer avant ou avec la fusion. Sans elle, le décor choisi reste sur l'appareil, sans erreur.

## 5.5 #729 : inviter un ami, cadeaux sans XP

**Aucune source d'XP nouvelle** : l'économie ci-dessus (gains, courbe des niveaux, simulation à 30 jours) ne change pas. Un ami qui joue sa première partie par le lien d'un joueur ouvre, pour les deux, des décors qui existent déjà : le goban Cerisier (niveau 10 d'habitude) ; le parrain reçoit en plus les pierres Jade (niveau 12) à son 3e ami. Un badge chacun : Parrain, Invité (famille « Avec les autres »).

| Règle | Valeur | Où |
|---|---|---|
| Récompense | cosmétique seulement, jamais d'XP, jamais d'avantage de jeu | `src/data/invitation.ts`, `themeDebloque` (`xp.ts`) |
| Plafond | 5 amis validés par parrain ; un cadeau par invité | migration `20261026090000_invitations.sql` |
| Vraie action | partie de 10 coups ou plus (comme `sourceXpPartie`), compte de moins de 30 jours | `valider_invitation` |
| Niveau 10 et 12 | gardent leur sens : le décor déjà reçu n'est plus une récompense de niveau, la fête du niveau reste | `RECOMPENSES` (`xp.ts`) |

Indicateur : `invitation_validee` par `invitation_partagee`. Périmètre game-designer touché par #729 : `vitrine.ts`, `Vitrine.tsx`, ce fichier ; à relire.
