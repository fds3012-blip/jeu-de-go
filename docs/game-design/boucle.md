# Boucle de jeu

Tenu par l'agent `game-designer`. Une page. Chaque écran sert au moins une boucle ; chaque réglage est une constante nommée et testée, avec l'indicateur qu'il doit faire bouger. Indicateurs de la charte : `entreprise/charte.md`. Dernière mise à jour : 28/09/2026 (#160).

## Les quatre boucles

| Boucle | Ce que fait le joueur | Récompense | Écrans | Indicateur visé (mesure) |
|---|---|---|---|---|
| **Minute** | Poser une pierre, voir la réponse, capturer, esquiver un atari | Son, animation, capture qui tombe dans le couvercle, phrase de Mochi | Partie, leçon, problème | Première pierre dans la minute : 90 % (`premiere_pierre`, secondes depuis l'ouverture) |
| **Session** (5 à 15 min) | Finir une partie, une leçon ou quelques problèmes | Récit du score, écran de fin (sceau « BATTUE »), XP, adversaire suivant | Accueil → partie → fin → « Rejouer » ou « Défier » | Parties terminées par actif et par semaine : 5 (`partie_terminee`) ; part des premières parties menées à la fin (`premiere_partie_terminee`) |
| **Jour** | Revenir pour le Go du jour, garder sa série | Flamme de série, gel gagné tous les 7 jours | Accueil (Go du jour), Problèmes | Rétention J1 : 45 % (cohorte PostHog sur `app_ouverte`) ; `go_du_jour_resolu` |
| **Semaine** | Battre l'adversaire suivant de l'échelle, finir le chemin des leçons, monter d'un niveau | Nouvel adversaire ouvert, niveau, thème de goban débloqué | Échelle des 9 adversaires, Apprendre, Profil | Rétention J7 / J30 : 25 % / 12 % ; `niveau_atteint`, `lecon_terminee` |

Règles communes : pas de fausse urgence, pas de perte punitive (la série est protégée par les gels), pas de loot box. Le public inclut des enfants.

## Décision #160 : une première victoire possible et honnête

**Constat** (analyse du 27/09, `docs/ux/analyses/2026-09-27-premier-parcours.md`) : 5 premières parties perdues sur 6, de 0,5 à 5,5 points, surtout à cause du komi de 6,5. La barre d'avantage affichait « Blanc +5,5 » avant le premier coup : le débutant commençait « perdant » sans savoir pourquoi.

**Décision** (constantes dans `src/app/equilibrage.ts`, testées dans `equilibrage.test.ts` et `e2e/premiere-victoire.spec.ts`) :

| Constante | Valeur | Pourquoi |
|---|---|---|
| `KOMI_DEBUTANT` | 0,5 | Blanc garde un petit avantage (le komi existe, on peut l'expliquer) ; la demie évite l'égalité. |
| `PARTIES_KOMI_DEBUTANT` | 3 | Le « camp d'entraînement » de Clash Royale : 3 combats adoucis avant les vraies règles. |
| `PARTIES_SANS_BARRE_AVANTAGE` | 1 | La première partie se joue sans jugement permanent ; « Qui mène ? » reste disponible sur demande. |
| `KOMI_NORMAL` | 6,5 | Komi habituel, à partir de la 4e partie contre l'ordi, et toujours à deux. |

**Honnêteté** : rien n'est caché. Mochi annonce le komi au début de chaque partie adoucie (« Le komi, ce sont des points donnés à Blanc parce que Noir commence. Pour tes premières parties, il est de 0,5. », puis un rappel, puis « Dernière partie avec un komi de 0,5 point »). À la 4e partie, il dit que le komi passe à 6,5. Le récit du score compte exactement le komi annoncé, et l'ordi joue avec ce même komi. Le compteur est celui de l'appareil (`go.parties.v1`, champ `ordi` ; les anciens compteurs sans ce champ utilisent le total des parties).

**Indicateurs** :
- Part des premières parties contre l'ordi gagnées : de 1 sur 6 (script du 27/09) à 1 sur 3 au moins. Mesure : `partie_terminee` (`gagnant`) filtré sur la première `premiere_partie_terminee` de chaque appareil. *À ajouter* : une propriété `komi` sur `partie_terminee` pour séparer les parties adoucies.
- Part des nouveaux joueurs qui lancent une 2e partie dans la même session (boucle de session).
- Rétention J1 : 45 % (charte). Hypothèse : la règle pic-fin (base UX) fait d'une première victoire le souvenir qui fait revenir.

**Garde-fous** : si la victoire devient trop facile (plus de 80 % des 3 premières parties gagnées contre Pomme), on garde 0,5 mais pour 2 parties seulement. Si la 4e partie (retour à 6,5) montre une chute nette des parties terminées, on étudie un komi intermédiaire (3,5) pour les parties 4 à 6.

## Prochains réglages à instruire
- Courbe des 9 adversaires : un nouveau joueur doit battre Pomme dans ses 3 premières parties et Caillou dans sa première semaine.
- XP : le niveau 2 doit tomber pendant la première session (progrès offert, base UX).
- Go du jour : piste « Débutant » les 7 premiers jours (hypothèse de la base UX).
