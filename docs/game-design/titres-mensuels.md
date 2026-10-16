# Titres mensuels (issue #561)

Étape 2 de la cote (`docs/game-design/cote.md`). Chaque mois, les meilleurs joueurs actifs reçoivent un titre. Calcul au serveur, jamais au client.

## Règles

- **Joueur actif du mois** : au moins **10 parties classées en ligne finies** dans le mois civil de Paris (du 1er à 0 h au 1er du mois suivant à 0 h, heure de Paris). Ce sont les lignes `rating_history` de type `game`, écrites par `apply_game_rating` seulement : parties classées entre humains. Les défis, les parties contre les IA, les problèmes et les leçons ne comptent pas. Un compte sans pseudo ne compte pas.
- **Mesure (une seule)** : la **cote Glicko-2 de fin de mois**, c'est-à-dire la cote après la dernière partie classée du mois.
- **Titres**, par pourcentage de la distribution réelle du mois :

| Titre | Code | Part des joueurs actifs | Sceau |
|---|---|---|---|
| Maître du mois | `maitre` | top 1 % | noir et or, 3 pierres |
| Expert du mois | `expert` | top 5 % | indigo, 2 pierres |
| Habitué du mois | `habitue` | top 20 % | vermillon, 1 pierre |

- **Seuils calculés, pas écrits en dur.** Les joueurs actifs sont rangés par cote décroissante (`rank()` : les ex æquo partagent le rang). Rangs gardés : `ceil(1 %)`, `ceil(5 %)` et `ceil(20 %)` du nombre d'actifs. Les cotes de coupure de chaque mois sont gardées dans `titres_mois` (`seuil_maitre`, `seuil_expert`, `seuil_habitue`) avec les effectifs. Exemple du test SQL : 261 actifs donnent les rangs 3, 14 et 53, donc 4 maîtres (deux ex æquo au 3e rang), 10 experts et 39 habitués.
- **Garde-fou** : sous **200 joueurs actifs** dans le mois, rien n'est attribué. La fonction écrit seulement le nombre d'actifs dans `titres_mois` (`publie = false`), sans seuil ni titre. Avec moins de 200 joueurs, le top 1 % ferait 1 ou 2 personnes et le titre ne voudrait rien dire.
- **Quand** : tâche pg_cron `titres-mensuels`, le 1er du mois à 1 h 17 UTC (2 h 17 ou 3 h 17 à Paris). La fonction prend elle-même le mois de Paris qui vient de finir. Elle refuse un mois pas encore fini. Elle est rejouable : le mois est réécrit, pas complété.

## Pourquoi la cote de fin de mois, et pas le gain du mois

- **Elle ne se truque pas par le départ.** Le départ se choisit (`choisir_depart_cote` : 300 pour « Je découvre »). Avec le gain, un joueur parti à 300 prendrait 400 points en dix parties faciles et passerait devant tous les joueurs installés. Un nouveau compte ferait pareil, puisque sa cote est provisoire et bouge vite.
- **Elle ne punit pas les forts.** Un joueur à 2500 avec un RD de 60 gagne peu de points par partie. Avec le gain, il ne serait jamais titré.
- **Elle se comprend en 3 secondes** : « tu étais dans les 5 % les plus forts du mois ». Le seuil d'activité (10 parties) garde l'idée de « joueur du mois » : la cote seule ne suffit pas, il faut avoir joué.
- **La fin du mois plutôt que la meilleure du mois** : la meilleure récompenserait un pic suivi d'une série de défaites. La fin de mois dit où tu en es.

## Ce qu'un joueur voit

- **Son titre** : dans le Profil (compte complet), le « Titre du mois dernier » : le sceau du titre, son nom (« Expert du mois ») et le mois (« Septembre »). Il n'existe que si le joueur a un titre le mois dernier : rien sous le garde-fou, rien sans titre. Le Profil tient sans défiler en 390 × 844 : le titre est une **demi-ligne** qui partage la ligne de « Ta cote », à la place de « Placement » (un joueur titré a au moins 10 parties classées : l'estimation du placement n'a plus d'objet ; elle revient le mois où il n'a pas de titre). Le toucher ouvre « Ta cote ». Libellé court pour garder 48 px de haut ; le nom accessible commence par « Titre du mois dernier : » et finit par « Top 5 % des joueurs actifs. ».
- **Une fête discrète, une fois** : à l'ouverture de l'app, une carte en haut de l'écran (« Nouveau titre : Expert du mois ! Top 5 % des joueurs de septembre. »), 5 s ou un toucher. Elle passe par la file des fêtes (`src/ui/fileFetes.ts`, genre `titre`) : jamais sur une consigne, après l'XP et le niveau. Immobile avec les mouvements réduits ou sans célébrations. Le repère `go.titre-fete.v1` (le mois fêté) l'empêche de revenir sur cet appareil.
- **Les titres des autres** : seulement sur leur profil public (#560), par `titres_du_joueur(p_profile_id)` : mois et titre, mois publiés seulement, rien si l'un a bloqué l'autre. Pas de classement nominatif public : ni liste des titrés, ni rang, ni cote du mois.
- Le sceau est un **sceau**, pas un portrait (règle Mochi #527) : ce n'est pas Mochi qui parle.

## Données

| Table | Contenu | Accès |
|---|---|---|
| `titres_joueurs` | mois, joueur, titre, cote de fin de mois, parties du mois | RLS : chacun lit ses lignes ; écrite par `calculer_titres_mensuels` seule ; effacée avec le compte |
| `titres_mois` | mois, actifs, publié ou non, cotes de coupure, effectifs | Table d'équipe : RLS sans politique, clé service seulement |

Mesure : `titre_obtenu` (le niveau seulement), `docs/data/plan-de-marquage.md`.

## Fichiers

- Serveur : `supabase/migrations/20261016150000_titres_mensuels.sql`, test `supabase/tests/titres_mensuels.test.sql`.
- App : `src/app/titres.ts` (logique pure), `src/data/titres.ts` (lecture), `src/ui/LigneTitre.tsx` (demi-ligne), `src/ui/FeteTitre.tsx` (chargée à la demande), `src/ui/SceauTitre.tsx`, `src/ui/titres.css` (feuille à la demande), `src/content/i18n/titres.ts`.
- Tests : `src/app/titres.test.ts`, `e2e/titres-mensuels.spec.ts`.
