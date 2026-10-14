# Tableau « Lancement » : les chiffres du lundi (#537)

Le tableau que Florian lit chaque lundi pendant les 90 jours du plan d'acquisition (`docs/marketing/analyse-marche-acquisition-2026-10.md`, sections 2.6 et 2.8). Rien n'est créé dans PostHog : chaque tuile est une requête HogQL à coller dans **PostHog › SQL**, puis à enregistrer comme insight sur un tableau nommé « Lancement ». Deux requêtes Supabase complètent, à lancer dans l'éditeur SQL de Supabase (lecture seule).

Événements utilisés : `docs/data/plan-de-marquage.md`. Un test vérifie que chaque événement cité ici existe dans l'app (`outils/referencement/docsLancement.test.ts`).

## Les 6 chiffres, et ce qu'ils doivent faire bouger

| Tuile | Chiffre | Cible à J90 (plan) | Ce qui le fait bouger |
|---|---|---|---|
| 1 | Nouveaux joueurs humains par semaine | 500 | Les canaux (liens UTM), le référencement |
| 2 | Première pierre et première partie terminée, sur les nouveaux humains | 60 % et 50 % de la pierre | L'accueil et la première minute (P4) |
| 3 | Nouveaux humains, pierres et parties par source UTM | Garder les 2 meilleurs canaux en fin de phase 1 | Le choix des canaux |
| 4 | J1 et J7 (joueurs avec accord), avec la taille de la cohorte | J1 45 %, J7 25 % (charte, à 6 mois) | Le rappel quotidien, le Go du jour |
| 5 | Compteurs anonymes de l'entonnoir (Supabase) | Mêmes taux que la tuile 2 | Contrôle de la tuile 2, sans PostHog |
| 6 | Retours en 3 questions | 20 retours (phase 1, canal A) puis 100 | Le formulaire, les posts qui demandent un avis |

**Règle de lecture** : tant qu'une semaine a moins de 30 nouveaux humains, un taux ne dit presque rien (±15 points). Écris « volume trop faible » à côté, et lis les nombres bruts.

## Conventions communes

- **Fuseau** : semaines du lundi, heure de Paris : `toStartOfWeek(toTimeZone(timestamp, 'Europe/Paris'), 1)`.
- **Production seulement** : `properties.environnement = 'production'`.
- **Humain probable** (même heuristique que `docs/data/mesure-lancement-2026-10.md`) : pas un robot connu (`isLikelyBot`, fonction de PostHog) et un fuseau horaire local (les robots déclarent `UTC` ou `Etc/Unknown`). C'est une heuristique : un humain derrière un VPN peut passer pour un robot.
- **Nouveau joueur humain** : une visite (`$session_id`) où part `premier_geste` avec `nouveau = true`. C'est le premier vrai toucher, clic ou touche sur un appareil neuf (#519). Les robots qui ne touchent à rien n'y sont pas, contrairement à `premier_ecran_vu`.
- **Sans accord** (la plupart des joueurs), l'identifiant change à chaque chargement. On compte donc des **visites**, et on suit une visite avec `$session_id`. La rétention (tuile 4) ne se lit que sur les joueurs avec accord (`mesure = complet`).

Filtre « humain probable », repris dans les requêtes :

```text
NOT isLikelyBot(properties.$raw_user_agent)
AND coalesce(properties.$timezone, '') NOT IN ('', 'UTC', 'Etc/Unknown')
```

## Tuile 1. Nouveaux joueurs humains par semaine

Avec, pour comparer, les premiers écrans de tous les appareils neufs (robots compris). Un grand écart entre les deux colonnes est normal : environ 87 % des premiers écrans étaient des robots début octobre.

```sql
SELECT
    toStartOfWeek(toTimeZone(timestamp, 'Europe/Paris'), 1) AS semaine,
    uniqIf(properties.$session_id, event = 'premier_geste'
        AND NOT isLikelyBot(properties.$raw_user_agent)
        AND coalesce(properties.$timezone, '') NOT IN ('', 'UTC', 'Etc/Unknown')) AS nouveaux_humains,
    uniqIf(properties.$session_id, event = 'premier_ecran_vu') AS premiers_ecrans_tous
FROM events
WHERE timestamp >= now() - INTERVAL 12 WEEK
  AND event IN ('premier_geste', 'premier_ecran_vu')
  AND properties.nouveau = true
  AND properties.environnement = 'production'
GROUP BY semaine
ORDER BY semaine DESC
```

## Tuile 2. Première pierre et première partie terminée

Par visite d'un nouveau joueur humain : a-t-il posé une pierre (n'importe où : partie, leçon, problème), et fini sa première partie ?

```sql
SELECT
    semaine,
    count() AS nouveaux_humains,
    countIf(pierre) AS premiere_pierre,
    round(100 * countIf(pierre) / count(), 1) AS pct_pierre,                    -- cible : 60
    countIf(partie) AS premiere_partie_terminee,
    round(100 * countIf(partie) / nullIf(countIf(pierre), 0), 1) AS pct_partie_sur_pierre  -- cible : 50
FROM (
    SELECT
        properties.$session_id AS visite,
        toStartOfWeek(toTimeZone(min(timestamp), 'Europe/Paris'), 1) AS semaine,
        countIf(event = 'premiere_pierre') > 0 AS pierre,
        countIf(event = 'premiere_partie_terminee') > 0 AS partie
    FROM events
    WHERE timestamp >= now() - INTERVAL 12 WEEK
      AND event IN ('premier_geste', 'premiere_pierre', 'premiere_partie_terminee')
      AND properties.environnement = 'production'
      AND NOT isLikelyBot(properties.$raw_user_agent)
      AND coalesce(properties.$timezone, '') NOT IN ('', 'UTC', 'Etc/Unknown')
    GROUP BY visite
    HAVING countIf(event = 'premier_geste' AND properties.nouveau = true) > 0
)
GROUP BY semaine
ORDER BY semaine DESC
```

## Tuile 3. Par source UTM

Les mêmes visites, découpées par `utm_source` (liens : `docs/marketing/liens-utm.md`). `(direct)` : arrivé sans UTM (lien tapé, favori, partage entre joueurs). `mochi-go` : venu d'une page du site, le plus souvent par un moteur de recherche ; `utm_campaign` dit laquelle.

```sql
SELECT
    source,
    campagne,
    count() AS nouveaux_humains,
    countIf(pierre) AS premiere_pierre,
    countIf(partie) AS premiere_partie_terminee,
    round(100 * countIf(partie) / count(), 1) AS pct_partie   -- seuil du canal B : 30
FROM (
    SELECT
        properties.$session_id AS visite,
        coalesce(nullIf(argMin(properties.utm_source, timestamp), ''), '(direct)') AS source,
        coalesce(nullIf(argMin(properties.utm_campaign, timestamp), ''), '') AS campagne,
        countIf(event = 'premiere_pierre') > 0 AS pierre,
        countIf(event = 'premiere_partie_terminee') > 0 AS partie
    FROM events
    WHERE timestamp >= toStartOfWeek(now(), 1) - INTERVAL 1 WEEK   -- semaine dernière et semaine en cours
      AND event IN ('premier_geste', 'premiere_pierre', 'premiere_partie_terminee')
      AND properties.environnement = 'production'
      AND NOT isLikelyBot(properties.$raw_user_agent)
      AND coalesce(properties.$timezone, '') NOT IN ('', 'UTC', 'Etc/Unknown')
    GROUP BY visite
    HAVING countIf(event = 'premier_geste' AND properties.nouveau = true) > 0
)
GROUP BY source, campagne
ORDER BY nouveaux_humains DESC
```

Pour la décision de fin de phase 1 (semaine 4), remplace la fenêtre par `timestamp >= toDateTime('2026-10-19 00:00:00', 'Europe/Paris')`.

## Tuile 4. J1 et J7 (joueurs avec accord)

Un joueur entre dans la cohorte le jour de sa première ouverture avec accord. **J1** : il rouvre l'app le lendemain. **J7** : il la rouvre le 7e jour. Seules les cohortes assez anciennes sont comptées (J1 : jusqu'à hier ; J7 : jusqu'à il y a 7 jours). Les deux premières semaines de la fenêtre servent seulement à écarter les anciens joueurs. Lis toujours la taille de la cohorte : avec moins de 100 personnes, c'est une tendance, pas un chiffre.

```sql
WITH premiers AS (
    SELECT person_id, min(toDate(toTimeZone(timestamp, 'Europe/Paris'))) AS j0
    FROM events
    WHERE event = 'app_ouverte'
      AND properties.mesure = 'complet'
      AND properties.environnement = 'production'
      AND timestamp >= now() - INTERVAL 70 DAY
      AND NOT isLikelyBot(properties.$raw_user_agent)
    GROUP BY person_id
),
jours AS (
    SELECT DISTINCT person_id, toDate(toTimeZone(timestamp, 'Europe/Paris')) AS j
    FROM events
    WHERE event = 'app_ouverte'
      AND properties.mesure = 'complet'
      AND properties.environnement = 'production'
      AND timestamp >= now() - INTERVAL 70 DAY
)
SELECT
    toStartOfWeek(p.j0, 1) AS semaine,
    uniq(p.person_id) AS cohorte,
    uniqIf(p.person_id, p.j0 <= today() - 1) AS cohorte_j1,
    uniqIf(p.person_id, j.j = p.j0 + 1) AS revenus_j1,
    round(100 * revenus_j1 / nullIf(cohorte_j1, 0), 1) AS pct_j1,   -- cible : 45
    uniqIf(p.person_id, p.j0 <= today() - 7) AS cohorte_j7,
    uniqIf(p.person_id, j.j = p.j0 + 7) AS revenus_j7,
    round(100 * revenus_j7 / nullIf(cohorte_j7, 0), 1) AS pct_j7    -- cible : 25
FROM premiers p
LEFT JOIN jours j ON j.person_id = p.person_id
WHERE p.j0 >= today() - 56
GROUP BY semaine
ORDER BY semaine DESC
```

J1 et J7 par canal : ajoute `argMin(properties.utm_source, timestamp) AS source` dans `premiers` et groupe par `source`. À ne lire qu'au-delà de 30 personnes par canal.

## Tuile 5. Compteurs anonymes de l'entonnoir (Supabase)

Ils comptent les appareils neufs sans PostHog et sans identifiant (#437, #519). Utiles quand le joueur a refusé la mesure anonyme ou quand PostHog est bloqué. Pas de source UTM ici. À lancer dans l'éditeur SQL de Supabase :

```sql
select date_trunc('week', jour)::date as semaine,
  sum(n) filter (where etape = 'premier_geste') as premier_geste,
  sum(n) filter (where etape = 'premiere_pierre') as premiere_pierre,
  sum(n) filter (where etape = 'premiere_partie_finie') as partie_finie,
  round(100.0 * sum(n) filter (where etape = 'premiere_pierre')
        / nullif(sum(n) filter (where etape = 'premier_geste'), 0), 1) as pct_pierre  -- cible : 60
from public.compteurs_entonnoir
where jour >= current_date - 84
group by 1 order by 1 desc;
```

## Tuile 6. Retours en 3 questions

Dans PostHog, par semaine et par réponse à la question 1 (sans le texte) :

```sql
SELECT
    toStartOfWeek(toTimeZone(timestamp, 'Europe/Paris'), 1) AS semaine,
    count() AS retours,
    countIf(properties.conseil = 'oui') AS conseilleraient,
    countIf(properties.texte = true) AS avec_texte
FROM events
WHERE timestamp >= now() - INTERVAL 12 WEEK
  AND event = 'retour_envoye'
  AND properties.environnement = 'production'
GROUP BY semaine
ORDER BY semaine DESC
```

Les textes eux-mêmes ne sont que dans Supabase (table `retours`, migration `20261014150000_retours_joueurs.sql`, lisible avec la clé service seulement). À lire chaque lundi, puis à transformer en issues :

```sql
select cree_le at time zone 'Europe/Paris' as le, conseil, source, langue, ameliorer
from public.retours
where cree_le >= now() - interval '7 days'
order by cree_le desc;
```

Et la vue d'ensemble :

```sql
select date_trunc('week', cree_le at time zone 'Europe/Paris')::date as semaine,
  count(*) as retours,
  round(100.0 * count(*) filter (where conseil = 'oui') / count(*), 1) as pct_oui,
  count(*) filter (where ameliorer is not null) as avec_texte
from public.retours
group by 1 order by 1 desc;
```

Si `refus` grimpe dans `retours_fenetre`, quelqu'un envoie des retours en masse : `select * from public.retours_fenetre;`.

## Mettre le tableau en place (Florian, 15 minutes)

1. PostHog › SQL : coller la tuile 1, « Save as insight », nom « Lancement 1 : nouveaux humains ». Pareil pour les tuiles 2, 3, 4 et 6.
2. Nouveau tableau « Lancement », y ajouter les 5 insights dans l'ordre.
3. Garder les requêtes Supabase (tuiles 5 et 6) dans l'éditeur SQL de Supabase, en favoris (« Lancement : compteurs », « Lancement : retours »).
4. Chaque lundi : noter les 6 chiffres dans le journal (`docs/journal.md`), avec « volume trop faible » sous 30.
