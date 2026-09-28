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
