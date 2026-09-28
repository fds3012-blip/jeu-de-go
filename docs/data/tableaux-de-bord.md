# Tableaux de bord des indicateurs

Issue #166. Une requête HogQL par indicateur de la charte (`entreprise/charte.md`). À coller dans PostHog (SQL) ; rien n'est encore créé dans PostHog.

## Conventions

- **Fuseau** : le projet PostHog est en UTC. Les jours et semaines se calculent en heure de Paris : `toTimeZone(timestamp, 'Europe/Paris')`. Semaine du lundi : `toStartOfWeek(…, 1)`.
- **Production seulement** : `properties.environnement = 'production'` (écarte les previews Vercel et le développement local).
- **Niveau de mesure** : `properties.mesure` vaut `anonyme` ou `complet` (ajouté par #166). Les indicateurs qui suivent une personne dans le temps (nouveaux joueurs, rétention, parties par joueur) ne sont justes que sur `complet`. Les événements envoyés avant le déploiement de #166 n'ont pas cette propriété : ils mélangent les deux niveaux.
- **Joueur actif** : une personne avec au moins un événement de l'app (hors événements `$…` de PostHog) dans la période.
- **Personne** : `person_id`, jamais `distinct_id`.
- Sans accord, l'identifiant change à chaque chargement de page : en `anonyme`, une « personne » PostHog est une visite, pas un joueur.

## 1. Nouveaux joueurs par semaine (cible : 10 000)

Mesure fiable seulement sur les joueurs qui ont accepté. Première apparition dans la fenêtre de 26 semaines : lire les 8 dernières semaines seulement (les premières semaines de la fenêtre comptent aussi des anciens).

```sql
SELECT
    toStartOfWeek(premier, 1) AS semaine,
    count() AS nouveaux_joueurs_consentants
FROM (
    SELECT person_id, min(toTimeZone(timestamp, 'Europe/Paris')) AS premier
    FROM events
    WHERE timestamp >= now() - INTERVAL 26 WEEK
      AND NOT startsWith(event, '$')
      AND properties.environnement = 'production'
      AND properties.mesure = 'complet'
    GROUP BY person_id
)
WHERE premier >= now() - INTERVAL 8 WEEK
GROUP BY semaine
ORDER BY semaine DESC
```

Plafond, tous niveaux confondus (des visites, pas des joueurs) :

```sql
SELECT
    toStartOfWeek(toTimeZone(timestamp, 'Europe/Paris'), 1) AS semaine,
    count() AS ouvertures,
    uniq(properties.$session_id) AS sessions,
    countIf(properties.mesure = 'complet') AS ouvertures_complet
FROM events
WHERE timestamp >= now() - INTERVAL 8 WEEK
  AND event = 'app_ouverte'
  AND properties.environnement = 'production'
GROUP BY semaine
ORDER BY semaine DESC
```

## 2. Part qui pose une première pierre dans la minute (cible : 90 %)

Lecture simple, tous niveaux : parmi les premières pierres, la part posée en 60 secondes au plus (`secondes` compte depuis l'ouverture de la page).

```sql
SELECT
    toStartOfWeek(toTimeZone(timestamp, 'Europe/Paris'), 1) AS semaine,
    count() AS premieres_pierres,
    countIf(toFloat(properties.secondes) <= 60) AS dans_la_minute,
    round(100 * dans_la_minute / premieres_pierres, 1) AS part_pct,
    quantile(0.5)(toFloat(properties.secondes)) AS mediane_secondes
FROM events
WHERE timestamp >= now() - INTERVAL 8 WEEK
  AND event = 'premiere_pierre'
  AND properties.environnement = 'production'
GROUP BY semaine
ORDER BY semaine DESC
```

Lecture stricte, la bonne pour la charte : parmi les **nouveaux** joueurs (consentants), la part qui a posé sa première pierre dans la minute. Le dénominateur inclut ceux qui n'ont jamais joué.

```sql
SELECT
    toStartOfWeek(premier, 1) AS semaine,
    count() AS nouveaux,
    countIf(pierre_minute) AS dans_la_minute,
    round(100 * dans_la_minute / nouveaux, 1) AS part_pct
FROM (
    SELECT
        person_id,
        min(toTimeZone(timestamp, 'Europe/Paris')) AS premier,
        countIf(event = 'premiere_pierre' AND toFloat(properties.secondes) <= 60) > 0 AS pierre_minute
    FROM events
    WHERE timestamp >= now() - INTERVAL 26 WEEK
      AND NOT startsWith(event, '$')
      AND properties.environnement = 'production'
      AND properties.mesure = 'complet'
    GROUP BY person_id
)
WHERE premier >= now() - INTERVAL 8 WEEK
GROUP BY semaine
ORDER BY semaine DESC
```

Biais connus : sans accord, `premiere_pierre` repart à chaque session (des joueurs qui reviennent entrent dans la lecture simple). La lecture stricte ne voit que les joueurs qui ont dit « Oui », souvent plus motivés.

## 3. Rétention J1 / J7 / J30 (cibles : 45 % / 25 % / 12 %)

Seulement avec accord. Définition : le joueur revient **le jour N exact** après son premier jour (J0). Une cohorte ne compte dans J_N que si elle a au moins N jours.

```sql
SELECT
    toStartOfWeek(j0, 1) AS cohorte,
    count() AS joueurs,
    round(100 * countIf(has(jours, addDays(j0, 1))) / nullIf(countIf(j0 <= today() - 1), 0), 1) AS j1_pct,
    round(100 * countIf(has(jours, addDays(j0, 7))) / nullIf(countIf(j0 <= today() - 7), 0), 1) AS j7_pct,
    round(100 * countIf(has(jours, addDays(j0, 30))) / nullIf(countIf(j0 <= today() - 30), 0), 1) AS j30_pct
FROM (
    SELECT
        person_id,
        min(toDate(toTimeZone(timestamp, 'Europe/Paris'))) AS j0,
        groupUniqArray(toDate(toTimeZone(timestamp, 'Europe/Paris'))) AS jours
    FROM events
    WHERE timestamp >= now() - INTERVAL 120 DAY
      AND NOT startsWith(event, '$')
      AND properties.environnement = 'production'
      AND properties.mesure = 'complet'
    GROUP BY person_id
)
WHERE j0 >= today() - 90
GROUP BY cohorte
ORDER BY cohorte DESC
```

Variante à garder en tête : « revient le jour N ou après » (rétention non bornée), plus haute. On garde le jour exact, standard du marché mobile.

### Série : un défi par jour (hypothèse à tester en A/B, #199)

**Hypothèse** (base de connaissances UX, section Rétention) : si le Go du jour, une leçon terminée **ou** la Révision du jour font vivre la série, J7 monte, sans changer l'action proposée. Chez Duolingo, n'importe quelle leçon entretient la série ; chez nous, avant #199, seul le Go du jour comptait.

- **Protocole complet** (taille d'échantillon, garde-fous, durée) : section 8.1.
- **Interrupteur** : constante `SERIE_UN_DEFI` dans `src/app/defi.ts` (vraie aujourd'hui, pour tout le monde). Fausse, on revient à l'ancienne règle (seul le Go du jour compte). Il n'y a pas encore de tirage A/B : pour le vrai test, brancher la constante sur un drapeau PostHog (50/50 sur les nouveaux joueurs, population `complet`) et comparer J7 (requête ci-dessus, filtrée par variante).
- **Limite** : c'est la série de l'appareil. Côté serveur, la série d'un joueur connecté reste celle du Go du jour (aucune migration dans #199) ; l'écran montre la plus longue des deux. Mais à la connexion, l'import de la série de l'appareil (`importer_serie_appareil`, #176) peut relever la série du serveur avec des jours de leçon ou de révision.
- **Critère** : J7 de la variante « un défi » au moins 2 points au-dessus du témoin, sans baisse de `go_du_jour_resolu` par joueur actif (le Go du jour ne doit pas être délaissé pour une leçon déjà faite).

Défis relevés par jour et par type (qui fait vivre la série, et par quoi) :

```sql
SELECT
    toDate(toTimeZone(timestamp, 'Europe/Paris')) AS jour,
    uniqIf(person_id, event = 'go_du_jour_resolu') AS go_du_jour,
    uniqIf(person_id, event = 'lecon_terminee') AS lecon,
    uniqIf(person_id, event = 'revision_faite') AS revision,
    uniq(person_id) AS joueurs_avec_un_defi
FROM events
WHERE event IN ('go_du_jour_resolu', 'lecon_terminee', 'revision_faite')
  AND timestamp >= now() - INTERVAL 30 DAY
  AND properties.environnement = 'production'
GROUP BY jour
ORDER BY jour DESC
```

Réussite des révisions (indicateur d'appui) : `sum(du_premier_coup) / sum(exercices)` sur `revision_faite`.

## 4. Parties terminées par joueur actif et par semaine (cible : 5)

```sql
SELECT
    toStartOfWeek(toTimeZone(timestamp, 'Europe/Paris'), 1) AS semaine,
    countIf(event = 'partie_terminee') AS parties_terminees,
    uniq(person_id) AS joueurs_actifs,
    round(parties_terminees / joueurs_actifs, 2) AS parties_par_actif
FROM events
WHERE timestamp >= now() - INTERVAL 8 WEEK
  AND NOT startsWith(event, '$')
  AND properties.environnement = 'production'
  AND properties.mesure = 'complet'
GROUP BY semaine
ORDER BY semaine DESC
```

Répartition (une moyenne cache souvent quelques gros joueurs) : part des actifs qui atteignent 5 parties.

```sql
SELECT
    semaine,
    count() AS joueurs_actifs,
    countIf(parties >= 5) AS actifs_5_parties,
    round(100 * actifs_5_parties / joueurs_actifs, 1) AS part_pct,
    quantile(0.5)(parties) AS mediane_parties
FROM (
    SELECT
        toStartOfWeek(toTimeZone(timestamp, 'Europe/Paris'), 1) AS semaine,
        person_id,
        countIf(event = 'partie_terminee') AS parties
    FROM events
    WHERE timestamp >= now() - INTERVAL 8 WEEK
      AND NOT startsWith(event, '$')
      AND properties.environnement = 'production'
      AND properties.mesure = 'complet'
    GROUP BY semaine, person_id
)
GROUP BY semaine
ORDER BY semaine DESC
```

### Indicateurs d'appui (#159 et fin de partie)

Taux de parties finies et part des fins en comptage manuel, par mode (à deux, le comptage est toujours manuel). Tous niveaux : ce sont des taux par partie, pas par joueur.

```sql
SELECT
    toStartOfWeek(toTimeZone(timestamp, 'Europe/Paris'), 1) AS semaine,
    properties.mode AS mode,
    countIf(event = 'partie_commencee') AS commencees,
    countIf(event = 'partie_terminee') AS terminees,
    round(100 * terminees / nullIf(commencees, 0), 1) AS finies_pct,
    countIf(event = 'partie_terminee' AND properties.fin = 'score') AS terminees_au_score,
    countIf(event = 'comptage_manuel') AS comptages_manuels,
    round(100 * comptages_manuels / nullIf(terminees_au_score, 0), 1) AS comptage_manuel_pct
FROM events
WHERE timestamp >= now() - INTERVAL 8 WEEK
  AND event IN ('partie_commencee', 'partie_terminee', 'comptage_manuel')
  AND properties.environnement = 'production'
GROUP BY semaine, mode
ORDER BY semaine DESC, mode
```

`comptage_manuel_pct` est une approximation : un comptage manuel suivi d'une reprise de partie compte aussi. Cible de #159 : faire baisser cette part contre l'ordi.

Entonnoir d'activation par session (tous niveaux) :

```sql
SELECT
    count() AS sessions,
    countIf(ouverte) AS ouvertes,
    countIf(ouverte AND pierre) AS avec_premiere_pierre,
    countIf(ouverte AND pierre AND partie) AS avec_partie_finie
FROM (
    SELECT
        properties.$session_id AS session,
        countIf(event = 'app_ouverte') > 0 AS ouverte,
        countIf(event = 'premiere_pierre') > 0 AS pierre,
        countIf(event = 'partie_terminee') > 0 AS partie
    FROM events
    WHERE timestamp >= now() - INTERVAL 7 DAY
      AND event IN ('app_ouverte', 'premiere_pierre', 'partie_terminee')
      AND properties.environnement = 'production'
    GROUP BY session
)
```

## 5. Conversion en Premium (cible : 3 % des actifs mensuels)

**Non mesurable aujourd'hui** : l'offre Premium n'existe pas, aucun événement ne la trace. Requête prête pour l'événement proposé `premium_achat` (voir `plan-de-marquage.md`) ; elle renverra 0 tant qu'il n'existe pas.

```sql
SELECT
    toStartOfMonth(toTimeZone(timestamp, 'Europe/Paris')) AS mois,
    uniq(person_id) AS actifs_mensuels,
    uniqIf(person_id, event = 'premium_achat') AS acheteurs,
    round(100 * acheteurs / actifs_mensuels, 2) AS conversion_pct
FROM events
WHERE timestamp >= now() - INTERVAL 6 MONTH
  AND NOT startsWith(event, '$')
  AND properties.environnement = 'production'
  AND properties.mesure = 'complet'
GROUP BY mois
ORDER BY mois DESC
```

Le chiffre juste viendra du prestataire de paiement (ou des stores), pas de PostHog : PostHog sert à l'entonnoir (vu → essai → achat).

## 6. Note moyenne sur les stores (cible : 4,7)

**Hors PostHog.** L'app n'est pas encore publiée. La note se lira dans App Store Connect et Google Play Console.

## 7. Entonnoirs et lectures après la nuit du 28/09 (#222)

Huit lectures pour voir ce que la nuit du 27 au 28/09 a changé. Pour chacune : l'indicateur de la charte qu'elle sert et la décision qu'elle éclaire. Mêmes conventions qu'en tête de fichier (heure de Paris, production, `person_id`).

**Avant de lire un chiffre** (lecture PostHog du 28/09 vers 03 h 30, en lecture seule, rien créé) : sur 14 jours, 23 `app_ouverte` pour 16 « personnes », aucun événement avec la propriété `mesure` (donc aucune personne `complet` identifiable), rien après le 28/09 à 00 h 06. Aucun des événements ajoutés cette nuit n'a encore été reçu. **Les requêtes ci-dessous renverront des tables vides ou minuscules tant qu'il n'y a pas de trafic réel.** Elles sont prêtes, pas lues.

**Ce que la nuit mélange.** Komi 0,5 (#160), ordi qui passe quand tu passes (#185), barre d'avantage cachée (#160), Pomme qui respire (#187), niveaux KataGo revus (#179) et leçon 7 (#177) sont partis la même nuit. Une comparaison avant / après mesure le **paquet**, pas une mesure isolée : c'est une corrélation. Seuls les tests A/B de la section 8 isolent une cause.

### 7.1 Entonnoir d'activation : ouverture → première pierre → partie finie → leçon ouverte → leçon finie → Go du jour

- **Indicateur servi** : première pierre dans la minute (étape 2), parties terminées par actif (étape 3), J1 (les étapes 4 à 6 sont les habitudes qui font revenir).
- **Décision éclairée** : quelle marche perd le plus de nouveaux joueurs, donc quel écran reprendre en premier (accueil, première partie, chemin des leçons, Go du jour). Si la marche 3 → 4 est faible, proposer la leçon juste après la première partie ; si 5 → 6 est faible, montrer le Go du jour dès la fin de la leçon.

Par joueur (population `complet`), sur ses 7 premiers jours. Les étapes sont **cumulées sans ordre imposé** : un joueur peut ouvrir une leçon avant de finir une partie. Pour un ordre strict, faire le même entonnoir dans PostHog (insight « Funnel », ordre séquentiel, fenêtre de 7 jours).

```sql
SELECT
    toStartOfWeek(j0, 1) AS cohorte,
    countIf(ouverte) AS e1_ouverte,
    countIf(ouverte AND pierre) AS e2_premiere_pierre,
    countIf(ouverte AND pierre AND partie) AS e3_partie_terminee,
    countIf(ouverte AND pierre AND partie AND lecon_ouverte) AS e4_lecon_commencee,
    countIf(ouverte AND pierre AND partie AND lecon_ouverte AND lecon_finie) AS e5_lecon_terminee,
    countIf(ouverte AND pierre AND partie AND lecon_ouverte AND lecon_finie AND go_du_jour) AS e6_go_du_jour,
    round(100 * e2_premiere_pierre / nullIf(e1_ouverte, 0), 1) AS e2_pct,
    round(100 * e3_partie_terminee / nullIf(e2_premiere_pierre, 0), 1) AS e3_pct,
    round(100 * e4_lecon_commencee / nullIf(e3_partie_terminee, 0), 1) AS e4_pct,
    round(100 * e5_lecon_terminee / nullIf(e4_lecon_commencee, 0), 1) AS e5_pct,
    round(100 * e6_go_du_jour / nullIf(e5_lecon_terminee, 0), 1) AS e6_pct
FROM (
    SELECT
        person_id,
        toDate(any(debut)) AS j0,
        countIf(event = 'app_ouverte') > 0 AS ouverte,
        countIf(event = 'premiere_pierre') > 0 AS pierre,
        countIf(event = 'partie_terminee') > 0 AS partie,
        countIf(event = 'lecon_commencee') > 0 AS lecon_ouverte,
        countIf(event = 'lecon_terminee') > 0 AS lecon_finie,
        countIf(event = 'go_du_jour_resolu') > 0 AS go_du_jour
    FROM (
        SELECT
            person_id,
            event,
            toTimeZone(timestamp, 'Europe/Paris') AS t,
            min(toTimeZone(timestamp, 'Europe/Paris')) OVER (PARTITION BY person_id) AS debut
        FROM events
        WHERE timestamp >= now() - INTERVAL 90 DAY
          AND NOT startsWith(event, '$')
          AND properties.environnement = 'production'
          AND properties.mesure = 'complet'
    )
    WHERE t < debut + INTERVAL 7 DAY -- les 7 premiers jours du joueur
    GROUP BY person_id
)
WHERE j0 >= today() - 60
  AND j0 <= today() - 7 -- seulement les cohortes qui ont eu leurs 7 jours
GROUP BY cohorte
ORDER BY cohorte DESC
```

Même entonnoir **par visite**, tous niveaux (la seule lecture possible sans accord ; une visite n'est pas un joueur) :

```sql
SELECT
    count() AS visites,
    countIf(pierre) AS avec_premiere_pierre,
    countIf(pierre AND partie) AS avec_partie_terminee,
    countIf(pierre AND partie AND lecon_ouverte) AS avec_lecon_commencee,
    countIf(pierre AND partie AND lecon_ouverte AND lecon_finie) AS avec_lecon_terminee,
    countIf(pierre AND partie AND lecon_ouverte AND lecon_finie AND go_du_jour) AS avec_go_du_jour
FROM (
    SELECT
        properties.$session_id AS session,
        countIf(event = 'app_ouverte') > 0 AS ouverte,
        countIf(event = 'premiere_pierre') > 0 AS pierre,
        countIf(event = 'partie_terminee') > 0 AS partie,
        countIf(event = 'lecon_commencee') > 0 AS lecon_ouverte,
        countIf(event = 'lecon_terminee') > 0 AS lecon_finie,
        countIf(event = 'go_du_jour_resolu') > 0 AS go_du_jour
    FROM events
    WHERE timestamp >= now() - INTERVAL 7 DAY
      AND event IN ('app_ouverte', 'premiere_pierre', 'partie_terminee', 'lecon_commencee', 'lecon_terminee', 'go_du_jour_resolu')
      AND properties.environnement = 'production'
    GROUP BY session
)
WHERE ouverte
```

Limites : `lecon_commencee` n'existe que depuis #198 (28/09) ; avant, l'étape 4 vaut zéro. Sans accord, `premiere_pierre` repart à chaque session (voir section 2).

### 7.2 Impact du komi 0,5 : victoires des 3 premières parties contre l'ordi

- **Indicateur servi** : J1 (le komi 0,5 vise une première victoire, qui doit faire revenir le lendemain) ; parties terminées par actif.
- **Décision éclairée** : garder 3 parties à komi 0,5, en changer le nombre, ou revenir au komi normal. Signal d'alerte : une chute des victoires ou une hausse des abandons à la **4e** partie, quand le komi repasse à 6,5 (effet « falaise »).

Le joueur a toujours Noir contre l'ordi (`src/app/Game.tsx`) : une victoire est `gagnant = 'noir'`. Le rang est celui de la partie **terminée** parmi celles du joueur (population `complet`).

```sql
SELECT
    periode,
    rang,
    count() AS parties,
    countIf(gagnant = 'noir') AS victoires,
    round(100 * victoires / parties, 1) AS victoires_pct,
    countIf(fin = 'abandon') AS abandons,
    round(100 * abandons / parties, 1) AS abandons_pct
FROM (
    SELECT
        person_id,
        properties.gagnant AS gagnant,
        properties.fin AS fin,
        row_number() OVER (PARTITION BY person_id ORDER BY timestamp) AS rang,
        -- #160 déployé le 28/09 vers 00 h 45 à Paris (22 h 45 UTC) : ajuster à l'heure réelle (propriété `version`)
        if(min(timestamp) OVER (PARTITION BY person_id) >= toDateTime('2026-09-27 22:45:00'), 'komi_0_5', 'avant') AS periode
    FROM events
    WHERE timestamp >= now() - INTERVAL 60 DAY
      AND event = 'partie_terminee'
      AND properties.mode = 'ordi'
      AND properties.environnement = 'production'
      AND properties.mesure = 'complet'
)
WHERE rang <= 4
GROUP BY periode, rang
ORDER BY periode, rang
```

Limites, à redire à chaque lecture :

- **Le rang n'est pas exact.** Le komi dépend des parties contre l'ordi **lancées** sur l'appareil (compteur `go.parties.v1`), pas des parties terminées. Une partie lancée puis quittée décale tout. `partie_terminee` ne porte ni `komi` ni `rang` : à ajouter (voir `plan-de-marquage.md`, « Propriétés à ajouter pour les tests A/B »).
- **Avant / après n'est pas une cause** : #185 (l'ordi passe quand tu passes) touche les mêmes 3 premières parties, la même nuit.
- Le script du 27/09 donnait 1 victoire sur 6 premières parties : c'était un script, pas des joueurs. Ne pas s'en servir comme point de départ chiffré.

### 7.3 Taux de comptage manuel

- **Indicateur servi** : parties terminées par actif (un comptage qui perd le joueur gâche la fin de partie) ; première partie terminée.
- **Décision éclairée** : poursuivre ou non #159 (comptage automatique plus souvent, Mochi qui montre les frontières). Si la part reste haute contre l'ordi malgré #185, investir dans le comptage ; si elle devient faible, passer à autre chose.

Part des fins au score qui passent par le comptage manuel, **contre l'ordi**, par adversaire (à deux, le comptage est toujours manuel : on l'écarte).

```sql
SELECT
    toStartOfWeek(toTimeZone(timestamp, 'Europe/Paris'), 1) AS semaine,
    properties.adversaire AS adversaire,
    countIf(event = 'partie_terminee' AND properties.fin = 'score') AS fins_au_score,
    countIf(event = 'comptage_manuel') AS comptages_manuels,
    round(100 * comptages_manuels / nullIf(fins_au_score, 0), 1) AS comptage_manuel_pct,
    round(avgIf(toFloat(properties.mortes), event = 'comptage_manuel'), 1) AS mortes_moyennes,
    round(avgIf(toFloat(properties.incertains), event = 'comptage_manuel'), 1) AS incertains_moyens
FROM events
WHERE timestamp >= now() - INTERVAL 8 WEEK
  AND event IN ('partie_terminee', 'comptage_manuel')
  AND properties.mode = 'ordi'
  AND properties.environnement = 'production'
GROUP BY semaine, adversaire
ORDER BY semaine DESC, adversaire
```

Taux par partie, tous niveaux. Approximation : un comptage manuel suivi d'une reprise de partie compte aussi (voulu, voir `plan-de-marquage.md`) ; le taux peut donc dépasser 100 % sur de petits volumes.

### 7.4 Aide aux problèmes : réponses vues et problèmes résolus

- **Indicateur servi** : rétention J7 (des problèmes trop durs découragent) ; distinction n° 3 de la charte (« chaque erreur devient une leçon »).
- **Décision éclairée** : quels problèmes sont trop durs (à déplacer plus loin, à réécrire, ou à doter d'un meilleur indice) ; le Go du jour est-il réglé à la bonne difficulté.

Par semaine, tous niveaux :

```sql
SELECT
    toStartOfWeek(toTimeZone(timestamp, 'Europe/Paris'), 1) AS semaine,
    countIf(event = 'probleme_resolu') AS resolus_sans_aide,
    countIf(event = 'solution_vue') AS solutions_vues,
    round(100 * solutions_vues / nullIf(resolus_sans_aide + solutions_vues, 0), 1) AS solution_vue_pct,
    countIf(event = 'go_du_jour_resolu') AS go_du_jour,
    countIf(event = 'go_du_jour_resolu' AND properties.vu = true) AS go_du_jour_vu,
    round(100 * go_du_jour_vu / nullIf(go_du_jour, 0), 1) AS go_du_jour_vu_pct
FROM events
WHERE timestamp >= now() - INTERVAL 8 WEEK
  AND event IN ('probleme_resolu', 'solution_vue', 'go_du_jour_resolu')
  AND properties.environnement = 'production'
GROUP BY semaine
ORDER BY semaine DESC
```

Problèmes les plus « vus » (à revoir en premier) :

```sql
SELECT
    properties.probleme AS probleme,
    countIf(event = 'solution_vue') AS solutions_vues,
    countIf(event = 'probleme_resolu') AS resolus_sans_aide,
    round(100 * solutions_vues / nullIf(solutions_vues + resolus_sans_aide, 0), 1) AS solution_vue_pct,
    round(avgIf(toFloat(properties.essais), event = 'solution_vue'), 1) AS essais_avant_reponse
FROM events
WHERE timestamp >= now() - INTERVAL 28 DAY
  AND event IN ('probleme_resolu', 'solution_vue')
  AND properties.environnement = 'production'
GROUP BY probleme
HAVING solutions_vues + resolus_sans_aide >= 30 -- en dessous, trop peu pour classer
ORDER BY solution_vue_pct DESC
LIMIT 20
```

Limites : `probleme_resolu` ne part qu'à la **première** réussite sur l'appareil, `solution_vue` à chaque « Voir la réponse ». Il n'y a pas d'événement `probleme_ouvert` : `solution_vue_pct` est une part des issues connues, pas des tentatives. `vu` sur `go_du_jour_resolu` n'existe que depuis #197.

### 7.5 Révision du jour

- **Indicateur servi** : J7 et J30 (la révision espacée est pensée pour faire revenir, analyse UX du 28/09, A5).
- **Décision éclairée** : garder 3 exercices par jour ou en changer ; garder la révision comme défi qui fait vivre la série (test 8.1) ; ajuster les intervalles J+1, J+3, J+7 si la réussite du premier coup est très haute (trop facile) ou très basse.

```sql
SELECT
    toDate(toTimeZone(timestamp, 'Europe/Paris')) AS jour,
    count() AS revisions_faites,
    uniq(person_id) AS joueurs,
    sum(toFloat(properties.exercices)) AS exercices,
    sum(toFloat(properties.du_premier_coup)) AS du_premier_coup,
    round(100 * du_premier_coup / nullIf(exercices, 0), 1) AS reussite_premier_coup_pct,
    countIf(properties.compte_serie = true) AS comptees_dans_la_serie
FROM events
WHERE timestamp >= now() - INTERVAL 30 DAY
  AND event = 'revision_faite'
  AND properties.environnement = 'production'
GROUP BY jour
ORDER BY jour DESC
```

Part des joueurs actifs (`complet`) qui font la révision, par semaine :

```sql
SELECT
    toStartOfWeek(toTimeZone(timestamp, 'Europe/Paris'), 1) AS semaine,
    uniq(person_id) AS actifs,
    uniqIf(person_id, event = 'revision_faite') AS reviseurs,
    round(100 * reviseurs / nullIf(actifs, 0), 1) AS reviseurs_pct
FROM events
WHERE timestamp >= now() - INTERVAL 8 WEEK
  AND NOT startsWith(event, '$')
  AND properties.environnement = 'production'
  AND properties.mesure = 'complet'
GROUP BY semaine
ORDER BY semaine DESC
```

Attention : comparer le J7 des « réviseurs » à celui des autres serait une **corrélation** (ceux qui révisent sont déjà les plus assidus). Pour une cause, passer par le test 8.1.

### 7.6 Installation de l'app

- **Indicateur servi** : J7 et J30 (sur iPhone, seule une app installée pourra recevoir un rappel quotidien) ; plus tard, note sur les stores.
- **Décision éclairée** : garder les deux moments de proposition (première victoire, Go du jour réussi) ou passer à un retour J2-J3 (base de connaissances UX, 28/09) ; ajouter une ligne « Installer l'app » au Profil.

Taux d'acceptation par plateforme et par moment (tous niveaux) :

```sql
SELECT
    properties.plateforme AS plateforme,
    properties.moment AS moment,
    countIf(event = 'installation_proposee') AS proposees,
    countIf(event = 'installation_acceptee') AS acceptees,
    round(100 * acceptees / nullIf(proposees, 0), 1) AS acceptees_pct
FROM events
WHERE timestamp >= now() - INTERVAL 28 DAY
  AND event IN ('installation_proposee', 'installation_acceptee')
  AND properties.environnement = 'production'
GROUP BY plateforme, moment
ORDER BY plateforme, moment
```

Part des ouvertures depuis l'app installée (seule mesure possible sur iPhone, où Safari ne dit pas si l'ajout a été fait) :

```sql
SELECT
    toStartOfWeek(toTimeZone(timestamp, 'Europe/Paris'), 1) AS semaine,
    count() AS ouvertures,
    countIf(properties.installee = true) AS depuis_l_app,
    round(100 * depuis_l_app / ouvertures, 1) AS depuis_l_app_pct,
    uniqIf(person_id, properties.mesure = 'complet') AS joueurs_complet,
    uniqIf(person_id, properties.mesure = 'complet' AND properties.installee = true) AS joueurs_complet_installes
FROM events
WHERE timestamp >= now() - INTERVAL 8 WEEK
  AND event = 'app_ouverte'
  AND properties.environnement = 'production'
GROUP BY semaine
ORDER BY semaine DESC
```

Limite : sur iPhone, `installation_acceptee` n'existe pas. Un J7 plus haut chez ceux qui ont installé ne prouve pas que l'installation fait revenir : les plus motivés installent.

### 7.7 Séries perdues et retours

- **Indicateur servi** : J7 et J30.
- **Décision éclairée** : construire ou non « Rattrape ta série » (regagner une série perdue par l'effort, base de connaissances UX, section Rétention) ; garder le record de série et les badges gagnés ; adapter l'accueil d'un retour après absence (analyse UX du 28/09, retour et Profil).

**Séries perdues** (population `complet`). Il n'y a pas d'événement « série perdue » : on la voit quand un défi repart à `serie = 1` alors que le défi précédent du même joueur avait une série d'au moins 2. Les gels (`gel_utilise`) sont les séries sauvées.

```sql
SELECT
    toStartOfWeek(jour, 1) AS semaine,
    countIf(serie = 1 AND precedente >= 2) AS series_perdues,
    countIf(serie = 1 AND precedente >= 7) AS series_de_7_jours_ou_plus_perdues,
    round(avgIf(precedente, serie = 1 AND precedente >= 2), 1) AS longueur_moyenne_perdue
FROM (
    SELECT
        person_id,
        toDate(toTimeZone(timestamp, 'Europe/Paris')) AS jour,
        toInt(properties.serie) AS serie,
        lagInFrame(toInt(properties.serie), 1, 0) OVER (
            PARTITION BY person_id ORDER BY timestamp
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
        ) AS precedente
    FROM events
    WHERE timestamp >= now() - INTERVAL 120 DAY
      AND event IN ('go_du_jour_resolu', 'revision_faite')
      AND properties.environnement = 'production'
      AND properties.mesure = 'complet'
)
WHERE jour >= today() - 56
GROUP BY semaine
ORDER BY semaine DESC
```

Séries sauvées par un gel, pour comparer :

```sql
SELECT
    toStartOfWeek(toTimeZone(timestamp, 'Europe/Paris'), 1) AS semaine,
    count() AS gels_utilises,
    round(avg(toFloat(properties.serie)), 1) AS serie_moyenne_sauvee
FROM events
WHERE timestamp >= now() - INTERVAL 8 WEEK
  AND event = 'gel_utilise'
  AND properties.environnement = 'production'
GROUP BY semaine
ORDER BY semaine DESC
```

**Retours après absence** (population `complet`) : un jour actif qui suit au moins 3 jours sans rien.

```sql
SELECT
    toStartOfWeek(jour, 1) AS semaine,
    countIf(ecart >= 3 AND ecart < 7) AS retours_apres_3_a_6_jours,
    countIf(ecart >= 7 AND ecart < 30) AS retours_apres_7_a_29_jours,
    countIf(ecart >= 30) AS retours_apres_30_jours_ou_plus
FROM (
    SELECT
        person_id,
        jour,
        dateDiff('day', lagInFrame(jour) OVER (
            PARTITION BY person_id ORDER BY jour
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
        ), jour) AS ecart,
        row_number() OVER (PARTITION BY person_id ORDER BY jour) AS n
    FROM (
        SELECT person_id, toDate(toTimeZone(timestamp, 'Europe/Paris')) AS jour
        FROM events
        WHERE timestamp >= now() - INTERVAL 120 DAY
          AND NOT startsWith(event, '$')
          AND properties.environnement = 'production'
          AND properties.mesure = 'complet'
        GROUP BY person_id, jour
    )
)
WHERE n > 1 -- le premier jour d'un joueur n'est pas un retour
  AND jour >= today() - 56
GROUP BY semaine
ORDER BY semaine DESC
```

**Dormants** : joueurs dont le dernier jour actif date de 7 à 30 jours. Ils ne sont pas (encore) revenus ; ceux qui avaient une série sont la cible de « Rattrape ta série ».

```sql
SELECT
    countIf(dernier BETWEEN today() - 30 AND today() - 7) AS dormants_7_a_30_jours,
    countIf(dernier BETWEEN today() - 30 AND today() - 7 AND meilleure_serie >= 3) AS dormants_avec_une_serie_de_3_ou_plus
FROM (
    SELECT
        person_id,
        max(toDate(toTimeZone(timestamp, 'Europe/Paris'))) AS dernier,
        maxIf(toInt(properties.serie), event IN ('go_du_jour_resolu', 'revision_faite')) AS meilleure_serie
    FROM events
    WHERE timestamp >= now() - INTERVAL 120 DAY
      AND NOT startsWith(event, '$')
      AND properties.environnement = 'production'
      AND properties.mesure = 'complet'
    GROUP BY person_id
)
```

Limites : une série perdue n'est visible **que si le joueur revient** faire un défi ; celles des joueurs partis pour de bon restent invisibles (d'où les dormants). `lecon_terminee` ne porte pas `serie` : une série reprise par une leçon ne se voit pas ici. Depuis #199, `serie` est la série de l'appareil (Go du jour, leçon ou révision), pas celle du serveur.

## 8. Tests A/B prêts à lancer (#222)

Trois changements de la nuit ont un interrupteur dans le code. Ils sont aujourd'hui **allumés pour tout le monde** : le bras « témoin » de chaque test rend l'ancien comportement.

### Ce qui vaut pour les trois

**Trafic actuel : aucun test ne peut conclure.** Lecture PostHog du 28/09 vers 03 h 30 (lecture seule, rien créé) : 23 `app_ouverte` et 16 « personnes » en 14 jours, très probablement l'équipe (note du 28/09) ; aucune personne `complet` identifiable (la propriété `mesure` n'a encore été reçue sur aucun événement). Le trafic de nouveaux joueurs consentants est donc de **zéro par semaine** à ce jour. Les durées ci-dessous sont données pour des scénarios de trafic, pas pour le trafic actuel. Premier travail : attendre du trafic réel et lire la part des joueurs qui acceptent la mesure complète.

**Prérequis techniques** (hors périmètre de #222, à faire dans une issue d'instrumentation) :

1. **Tirage.** Les drapeaux PostHog sont coupés (`advanced_disable_feature_flags: true` dans `POSTHOG_ANONYME` et `POSTHOG_COMPLET`, `src/data/analytics.ts`). Il faut soit les activer au niveau `complet`, soit un tirage local. Garder une variante sur l'appareil demande l'accord : les tests 8.1 et 8.3 portent donc **sur la population `complet` seulement**. Le test 8.2 peut se tirer à chaque partie, en mémoire, sans rien écrire.
2. **Variante dans les événements** : une propriété `variante` sur chaque événement concerné, sinon on ne sépare pas les bras.
3. **Propriétés manquantes** : `komi`, `rang` et `respire` sur `partie_commencee` et `partie_terminee` (voir `plan-de-marquage.md`).

**Règles de lecture.** Risque α = 5 % (bilatéral), puissance 80 %. Taille par bras pour deux proportions (approximation normale) :
`n = (1,96 × √(2 p̄ (1 − p̄)) + 0,84 × √(p₁(1 − p₁) + p₂(1 − p₂)))² / (p₂ − p₁)²`, avec `p̄ = (p₁ + p₂) / 2`.
Une seule métrique principale par test, fixée avant le lancement. Durée fixée à l'avance, en semaines entières (le lundi ne ressemble pas au samedi), **sans regarder le résultat en cours de route** pour s'arrêter plus tôt. On n'arrête avant la fin que si un garde-fou se dégrade nettement (bug, chute des parties finies).

**Valeurs de départ.** Aucune n'est mesurée aujourd'hui. Les tailles partent d'hypothèses **dites comme telles** (souvent la cible de la charte) ; à recalculer avec la vraie valeur après 2 semaines de trafic réel.

**Un test à la fois sur les premières parties.** Le komi (8.3) et Pomme (8.2) touchent tous deux les premières parties ; la série (8.1) touche J7. Ordre conseillé : 8.3 (le plus proche de J1, effet attendu le plus grand), puis 8.1. 8.2 peut tourner en même temps que 8.1 : tirages indépendants, métriques différentes.

### 8.1 `SERIE_UN_DEFI` : un défi par jour fait vivre la série

- **Interrupteur** : `SERIE_UN_DEFI` dans `src/app/defi.ts` (vrai : Go du jour, leçon terminée ou Révision du jour ; faux : seul le Go du jour, règle d'avant #199).
- **Hypothèse** : si n'importe quel défi du jour fait vivre la série, plus de nouveaux joueurs reviennent à J7, sans changer l'action proposée (chez Duolingo, n'importe quelle leçon entretient la série).
- **Population et unité** : nouveaux joueurs `complet`, tirés 50/50 à leur premier jour, par appareil.
- **Métrique principale** : J7, jour exact (requête de la section 3, filtrée par variante).
- **Garde-fous** : `go_du_jour_resolu` par joueur actif (pas plus de 10 % de baisse : le Go du jour ne doit pas être délaissé) ; J1 ; séries perdues (7.7) ; taux de leçons finies (`lecon_terminee` / `lecon_commencee`).
- **Taille** (valeur de départ supposée : J7 = 25 %, cible de la charte) :

| Écart à détecter | Par bras | Total |
|---|---|---|
| +5 points (25 → 30 %) | 1 251 | 2 502 |
| +3 points (25 → 28 %) | 3 396 | 6 792 |
| +2 points (25 → 27 %), critère de la section 3 | 7 549 | 15 098 |

- **Durée** : temps d'inclusion + 7 jours d'observation. Pour +3 points : 68 semaines à 100 nouveaux consentants par semaine, 7 semaines à 1 000, 2 semaines à 5 000 (plus 1 semaine d'observation). Pour +5 points : 25, 3 et 1 semaine(s). **Au trafic actuel, impossible.** Sous 1 000 consentants par semaine, viser +5 points ou ne pas lancer.
- **Décision** : si J7 monte d'au moins 2 points sans garde-fou dégradé, garder `SERIE_UN_DEFI` et aligner la série du serveur (migration). Sinon, revenir au Go du jour seul, plus simple à expliquer.

### 8.2 `POMME_RESPIRE` : l'ordi répond après un délai variable

- **Interrupteur** : `POMME_RESPIRE` dans `src/app/rythme.ts` (vrai : 500 à 1 200 ms, plus court si la réponse est forcée, plus long après une capture ; faux : 350 ms fixes, comme avant #187).
- **Hypothèse** : un ordi qui « réfléchit » un peu, de façon inégale, paraît plus humain ; le joueur lit mieux le coup et va plus souvent au bout de la partie.
- **Population et unité** : parties contre l'ordi, **tirées à chaque partie** (50/50, en mémoire, rien sur l'appareil). Possible sans accord et lisible en `anonyme`, car la métrique est par partie. Un même joueur peut voir les deux bras : effet de contamination faible, mais à dire.
- **Métrique principale** : taux de parties finies contre l'ordi (`partie_terminee` / `partie_commencee`, `mode = 'ordi'`), par bras. Demande `respire` sur les deux événements.
- **Garde-fous** : part des abandons (`fin = 'abandon'`) ; nombre médian de coups ; parties terminées par joueur actif et par semaine (chaque partie dure un peu plus : le nombre de parties peut baisser) ; première partie terminée ; erreurs Sentry.
- **Taille** (valeur de départ supposée : 60 % des parties commencées vont au bout) :

| Écart à détecter | Parties par bras | Total |
|---|---|---|
| +5 points (60 → 65 %) | 1 470 | 2 940 |
| +3 points (60 → 63 %) | 4 129 | 8 258 |

- **Durée** : 2 semaines au moins (deux cycles hebdomadaires), et jusqu'au nombre de parties. À 1 500 parties contre l'ordi par semaine : 2 semaines pour +5 points. Au trafic actuel (3 parties terminées en 14 jours), impossible.
- **Décision** : si le taux de parties finies monte sans baisse des parties par actif, garder `POMME_RESPIRE`. S'il ne bouge pas et que les garde-fous sont neutres, le garder pour la sensation, mais ne plus le citer comme levier de rétention.

### 8.3 Komi réduit : 0,5 pour les 3 premières parties contre l'ordi

- **Interrupteur** : `KOMI_DEBUTANT` et `PARTIES_KOMI_DEBUTANT` dans `src/app/equilibrage.ts`. Variante : komi 0,5 pour les 3 premières parties (aujourd'hui). Témoin : komi 6,5 dès la première (avant #160). Garder **identiques** dans les deux bras l'ordi accommodant (#185) et la barre cachée à la 1re partie, pour n'isoler que le komi. La phrase de Mochi annonce dans les deux bras le komi réellement compté (règle honnête, charte point 4).
- **Hypothèse** : une première victoire possible et honnête fait revenir le lendemain.
- **Population et unité** : nouveaux joueurs `complet` qui lancent une partie contre l'ordi, tirés 50/50 à la première partie, par appareil.
- **Métrique principale** : J1 de ces joueurs.
- **Contrôle** (la variante fait-elle ce qu'on croit ?) : part des 3 premières parties gagnées (requête 7.2, par variante). 138 joueurs par bras suffisent pour voir 20 → 35 % ; si l'écart n'apparaît pas, la lecture de J1 n'a pas de sens.
- **Garde-fous** : victoires et abandons à la **4e** partie (retour au komi 6,5) ; parties terminées par actif la première semaine ; J7 ; leçon 7 « Compter les points » (#177) terminée.
- **Taille** (valeur de départ supposée : J1 = 45 %, cible de la charte) :

| Écart à détecter | Par bras | Total |
|---|---|---|
| +5 points (45 → 50 %) | 1 565 | 3 130 |
| +3 points (45 → 48 %) | 4 338 | 8 676 |

- **Durée** : temps d'inclusion + 1 jour. Pour +5 points : 32 semaines à 100 nouveaux consentants par semaine, 4 semaines à 1 000, 2 semaines entières à 5 000. Au trafic actuel, impossible.
- **Décision** : si J1 monte d'au moins 3 points sans falaise à la 4e partie, garder le komi 0,5, puis tester le nombre de parties (2, 3 ou 5). Si les victoires montent mais pas J1, le komi ne fait pas revenir : le garder pour le plaisir et chercher ailleurs le levier de J1. Si la 4e partie s'effondre, étaler la remontée (par exemple 0,5, puis 3,5, puis 6,5).
