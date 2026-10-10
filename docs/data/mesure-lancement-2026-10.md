# #499 Mesure du lancement : humains ou robots, entonnoir des premières minutes

Analyste données, 10/10/2026 vers 11 h (Paris). Lecture seule : Supabase (table `compteurs_entonnoir`, journaux d'API), PostHog (SQL). Vercel : accès refusé (403 sur la portée de l'équipe, pour les analytics comme pour les journaux ; pas de CLI dans le conteneur), donc aucun chiffre Vercel. Aucune donnée individuelle ci-dessous : uniquement des agrégats par réseau, pays ou fuseau.

## En bref

1. **Environ 87 % des « premiers écrans » comptés sont des robots.** Sur 65 premiers écrans comptés du 05 au 09/10, j'estime **8 humains (fourchette 5 à 15)**, soit 13 % (8 à 23 %). Pour les 39 du 05 au 07/10 : **environ 5 humains (3 à 10)**.
2. **Aucune première pierre sans accord, nulle part.** Les compteurs Supabase et PostHog anonyme, deux chaînes indépendantes, donnent 0 depuis le 28/09. Avec environ 8 humains, un taux réel de 60 % aurait 0,07 % de chances de donner 0. Le taux humain est donc presque sûrement bas, mais on ne peut pas dire de combien (borne haute à 95 % : environ 30 %, entre 18 et 45 % selon le nombre réel d'humains).
3. **Avant/après les corrections (#466, #485, #486, #488, #487) : impossible à conclure.** Après les mises en ligne, il y a eu 3 à 4 humains probables et 0 première pierre. Ces humains ne sont presque pas francophones (hi-IN, ar, sl-SI, en-US).
4. **L'objectif de 60 % est inatteignable avec le compteur actuel.** Avec 87 % de robots au dénominateur, le ratio plafonne vers 13 % même si chaque humain pose sa pierre. Il faut d'abord corriger le dénominateur (section 5).
5. **Le vrai problème du moment est l'arrivée de joueurs : 1 à 2 humains par jour, aucun venu d'un FAI grand public français.**

## 1. Humains ou robots : méthode et chiffres

Trois sources croisées, par jour (heure de Paris) :
- **Compteurs** `compteurs_entonnoir` : nombre de premiers écrans par jour, sans heure.
- **Journaux d'API Supabase** (edge_logs) pour chaque `POST /rest/v1/rpc/compter_etape` : heure, réseau (AS), pays, agent utilisateur, score de confiance Cloudflare. Ils couvrent 56 des 65 appels (05/10 : 4/6, 06/10 : 15/19, 07/10 : 14/14, 08/10 : 6/8, 09/10 : 17/18).
- **PostHog** `premier_ecran_vu` (mesure `anonyme`) : fuseau horaire, langue, largeur d'écran du navigateur. C'est le discriminant le plus net : les robots déclarent UTC ou « Etc/Unknown », en-US, et des écrans de 800 px (valeur par défaut de Puppeteer), 375 px (mobile émulé) ou 1366 px sous Linux.

Classement des 56 appels journalisés :

| Jour | Compteur | Journalisés | Robots | Ambigus | Humains plausibles |
|---|---|---|---|---|---|
| 05/10 | 6 | 4 | 2 | 0 | 2 (2 appareils sur un FAI grand public coréen, Android et Windows) |
| 06/10 | 19 | 15 | 12 | 1 | 2 (Hong Kong, fuseau et langue locaux ; Brésil, fuseau de São Paulo) |
| 07/10 | 14 | 14 | 12 | 2 | 0 |
| 08/10 | 8 | 6 | 5 | 0 | 1 (iPhone, fuseau de Los Angeles, revenu dans une 2e session) |
| 09/10 | 18 | 17 | 14 | 1 | 2 (iPhone en arabe, fuseau de Mascate ; Windows en slovène, fuseau de Ljubljana) |
| **Total** | **65** | **56** | **45** | **4** | **7** |
| 10/10 (matin) | 2 | — | — | — | 1 dans PostHog (Android, hi-IN) |

Robots identifiés (45) : Scaleway (12, par rafales de 6 en une heure, le 06/10 à 9 h et le 07/10 à 13 h), Palo Alto Networks, un scanner (11, dont 5 entre 5 h et 6 h le 09/10), Amazon AWS (7), Google Cloud (Chrome 125 sous Linux, score 1 : 6), HeadlessChrome depuis la Thaïlande (3 en 4 s), ReflectionAI (robot déclaré, 2), Fortinet, DigitalOcean, LogicWeb, Leaseweb. Le score Cloudflare seul ne suffit pas : Palo Alto a des scores de 93 à 99. Le réseau et le fuseau horaire sont plus fiables.

Ambigus (4) : réseaux de proxy ou d'hébergement en Allemagne, au Royaume-Uni et au Portugal (sans fuseau local dans PostHog : probablement des robots), et un Android en Inde sur DigitalOcean (fuseau de Calcutta : peut-être une ferme d'appareils de test).

**Estimation.** Humains plausibles comptés à 85 %, ambigus à 30 %, appels non journalisés (9) au taux de base (environ 15 %), soit **≈ 8 humains sur 65 (5 à 15)**. La fourchette basse ne garde que les humains plausibles les plus nets ; la haute compte tous les ambigus et la moitié des non journalisés.

Le pic du 04/10 dans PostHog (117 premiers écrans, avant les compteurs) n'est **pas** un lancement : 66 des 78 « fuseaux locaux » arrivent entre 10 h 38 et 10 h 45, avec des profils identiques (Mac en 1920 px, iOS en 480 px) répartis sur 7 fuseaux. C'est une ferme de navigateurs de test.

Écart entre les sources : les 2 appareils coréens ont été comptés côté Supabase mais n'ont aucun `premier_ecran_vu`. Soit un bloqueur de PostHog, soit un premier écran qui n'était pas l'accueil : le compteur compte tout écran, `premier_ecran_vu` seulement l'accueil.

## 2. Entonnoir avant/après, par jour

Mises en ligne (heure de Paris) : #466 (fantôme + « Touche encore ») le 08/10 à 00 h 57 ; #486 (comptage auto) à 20 h 49, #485 (bandeau de consentement) à 20 h 58 et #488 (Pomme) à 21 h 32 le 08/10 ; #487 (premier écran épuré, `premier_ecran_vu` en variante v4) le 09/10 à 01 h 06. La v4 apparaît dans PostHog dès le 09/10.

### Sans accord (compteurs anonymes, appareils neufs)

| Jour | premier_ecran (dont humains estimés) | premiere_pierre | premiere_partie_finie | limite_essai / compte_cree |
|---|---|---|---|---|
| 05/10 | 6 (≈ 2-3) | 0 | 0 | 0 |
| 06/10 | 19 (≈ 2-3) | 0 | 0 | 0 |
| 07/10 | 14 (≈ 0-1) | 0 | 0 | 0 |
| 08/10 (#466) | 8 (≈ 1) | 0 | 0 | 0 |
| 09/10 (#485-488, #487) | 18 (≈ 2-3) | 0 | 0 | 0 |
| 10/10, partiel | 2 | 0 | 0 | 0 |

`compteurs_entonnoir_fenetre` : seule l'étape `premier_ecran` a jamais été appelée, 0 refus. Le plafond n'a rien bloqué.

### Sans accord (PostHog, mesure `anonyme`)

| Jour | premier_ecran_vu (fuseau local) | premiere_pierre, partie_commencee, lecon_commencee |
|---|---|---|
| 05/10 | 14 (1) | 0 |
| 06/10 | 14 (2) | 0 |
| 07/10 | 9 (0) | 0 |
| 08/10 | 5 (2 sessions, 1 appareil) | 0 |
| 09/10 | 10 (3), tous en v4 | 0 |
| 10/10, partiel | 1 (1) | 0 |

Sur 30 jours, en `anonyme`, PostHog n'a reçu que `app_ouverte` (257) et `premier_ecran_vu` (197). Le code ne filtre rien (`track`, `src/data/analytics.ts`) : un `premiere_pierre` anonyme partirait s'il avait lieu.

### Avec accord (PostHog, mesure `complet`)

1 personne par jour au plus du 05 au 09/10, sans doute l'équipe ou un proche : `partie_commencee` 1 le 06/10 et 1 le 08/10, dernier `premiere_pierre` le 03/10. Aucune nouvelle personne `complet` depuis le bandeau #485. **J1 et J7 ne sont pas mesurables** : il faut un identifiant persistant, donc l'accord, et la population consentante tient en une personne.

### Lecture

- **Ce qui ne bouge pas** : 0 première pierre avant comme après. Avec 3 à 4 humains depuis les mises en ligne, ce 0 ne dit rien de l'effet de #466 ou #487. Il faudrait au moins 30 humains neufs pour lire un taux à ±15 points près.
- **Ce qui bouge** : la v4 est bien en ligne (100 % des `premier_ecran_vu` du 09/10). Le temps avant l'accueil reste court (`secondes` de 0 à 9 chez les humains plausibles), sauf une valeur à 17 s chez un robot.
- **Corrélation et cause** : les humains qui arrivent ne sont presque pas francophones. Une interface en français ou en anglais peut suffire à expliquer qu'ils repartent sans jouer. On ne peut pas l'attribuer au premier écran.

## 3. Tableau de bord proposé pour Florian (non créé)

Nom : « Lancement : premières minutes ». Filtre commun « humains probables » sur `premier_ecran_vu` : `$virt_is_bot = false`, et `$timezone` différent de `UTC` et de `Etc/Unknown`. À dire sur le tableau : c'est une heuristique, ni parfaite ni stable dans le temps.

1. **Premiers écrans par jour, humains et robots** (tendance, 30 jours) : `premier_ecran_vu` avec `nouveau = true`, découpé par une colonne « humain probable » (le filtre ci-dessus), en barres empilées.
2. **Entonnoir de la première session** (entonnoir par identifiant, fenêtre de 1 heure) : `premier_ecran_vu` (nouveau = true, humains probables) → `premiere_pierre` → `premiere_partie_terminee`, découpé par `variante` (v3 = avant #487, v4 = après). Sans accord, l'identifiant change à chaque chargement : l'entonnoir se lit donc dans la même page, ce qui est justement la première session.
3. **Taux de première pierre dans la minute** (tendance, formule B / A par semaine) : A = `premier_ecran_vu` (nouveau, humains probables), B = `premiere_pierre` avec `secondes <= 60`. Ligne d'objectif à 60 %.
4. **Volume d'humains par semaine** (grand nombre) : `premier_ecran_vu` (nouveau, humains probables). Tant qu'il reste sous 30, la tuile 3 doit porter la mention « volume trop faible pour conclure ».
5. **Rétention J1 / J7** (rétention, population `mesure = complet`, `app_ouverte` → `app_ouverte`) : à afficher avec la taille de la cohorte, aujourd'hui 1 personne.

HogQL de la tuile 3 (ratio hebdomadaire) :

```sql
SELECT
  toStartOfWeek(toTimeZone(timestamp, 'Europe/Paris'), 1) AS semaine,
  countIf(event = 'premier_ecran_vu' AND properties.nouveau = true) AS premiers_ecrans,
  countIf(event = 'premiere_pierre' AND toFloat(properties.secondes) <= 60) AS pierres_dans_la_minute,
  round(100 * pierres_dans_la_minute / nullIf(premiers_ecrans, 0), 1) AS pct  -- objectif : 60
FROM events
WHERE timestamp >= now() - INTERVAL 8 WEEK
  AND event IN ('premier_ecran_vu', 'premiere_pierre')
  AND NOT isLikelyBot(properties.$raw_user_agent)
  AND coalesce(properties.$timezone, '') NOT IN ('', 'UTC', 'Etc/Unknown')
GROUP BY semaine
ORDER BY semaine DESC
```

**Requête Supabase quotidienne** (éditeur SQL, lecture seule). Elle n'a de sens qu'une fois le dénominateur corrigé (section 5). Avant cela, le ratio plafonne vers 13 %.

```sql
select jour,
  sum(n) filter (where etape = 'premier_ecran')  as premier_ecran,
  sum(n) filter (where etape = 'premiere_pierre') as premiere_pierre,
  sum(n) filter (where etape = 'premiere_partie_finie') as partie_finie,
  round(100.0 * sum(n) filter (where etape = 'premiere_pierre')
        / nullif(sum(n) filter (where etape = 'premier_ecran'), 0), 1) as pct_pierre  -- objectif : 60
from public.compteurs_entonnoir
where jour >= current_date - 14 and jour < (now() at time zone 'Europe/Paris')::date
group by jour order by jour desc;
```

**Objectif** : 60 % de première pierre sur premier écran une semaine après les mises en ligne, soit vers le 16/10. Aujourd'hui : 0 %, sur environ 8 humains. Pour lire l'objectif le 16/10, il faut d'abord la correction 5.1 et environ 30 humains neufs. Au rythme actuel de 1 à 2 par jour, ce volume ne sera pas atteint le 16/10 sans acquisition.

## 4. Les deux chiffres à suivre dès maintenant

- Humains probables par jour (tuile 4) : 1 à 2 aujourd'hui.
- Premières pierres humaines (compteur et PostHog anonyme) : 0 à ce jour.

## 5. Manques de mesure et corrections à faire

> Suite (#519, même branche) : les points 1, 2 et 3 sont codés (`navigator.webdriver` exclu, étapes `premier_geste`, `partie_ouverte`, `premier_toucher_plateau`, première pierre comptée où qu'elle soit avec `lieu`, migration `20261010180000_entonnoir_etapes.sql`). Le point 4 (`deuxieme_jour`) attend l'avis juridique ; le point 5 reste ouvert.


1. **Le dénominateur compte les robots** (`src/app/App.tsx`, effet `compterEtape('premier_ecran', …)` ; `src/data/compteurs.ts`, `permis()`). Le compteur part après le chargement, sans aucune interaction : tout navigateur piloté qui exécute le JS est compté.
   - Correction rapide : dans `permis()`, ne rien compter si `navigator.webdriver === true`, sauf en build e2e (`VITE_E2E`), pour ne pas casser `e2e/compteurs-entonnoir.spec.ts`. Les robots les plus simples sont alors exclus, mais pas ceux qui le masquent.
   - Correction solide : ajouter une étape `premier_geste`, comptée au premier `pointerdown` ou `keydown` réel sur un appareil neuf. Il faut une nouvelle migration qui élargit la contrainte `check` et la liste de `compter_etape`, plus une ligne dans le plan de marquage. Garder `premier_ecran` tel quel, pour ne pas casser la série, et lire l'objectif sur `premiere_pierre / premier_geste`.
   - Côté PostHog, même idée : un événement `premier_geste` (sans propriété, ou `secondes`), indicateur « dénominateur humain des 60 premières secondes ».
2. **La première pierre posée hors partie n'est pas comptée** (`src/app/Game.tsx` seulement). Une pierre posée dans la leçon 1, ou au placement via « Je sais déjà jouer », ne déclenche ni `compterEtape('premiere_pierre')` ni `premiere_pierre`. Depuis #487, le plateau note déjà la première pierre « où que ce soit » (`src/app/premierePierre.ts`, `abonnerPierre`). Correction : y brancher `compterEtape('premiere_pierre')`, et ajouter une propriété `lieu` (`partie`, `lecon`, `placement`) à l'événement PostHog `premiere_pierre`. À mettre à jour dans le plan de marquage (propriété nouvelle, nom d'événement inchangé).
3. **Pas d'étape entre l'écran et la pierre.** On ne sait pas si le joueur a touché « Joue ta première partie », ni s'il a vu la pierre fantôme sans confirmer, ce qui était justement le cas de #466. Correction : une étape de compteur `partie_ouverte` (montage de `Game` sur un appareil neuf) et un événement PostHog `premier_toucher_plateau` (premier `onFantome`, `src/ui/Board.tsx` via `Game.tsx`), indicateur « abandon entre fantôme et pierre ».
4. **Aucun retour mesurable sans accord.** J1 et J7 n'existent qu'en `complet` (1 personne). Correction : une étape de compteur `deuxieme_jour`, comptée une fois quand `noterOuverture` (`src/app/App.tsx`) voit un 2e jour d'ouverture distinct sur un appareil dont `premier_ecran` a été compté. Agrégat anonyme, même analyse CNIL que #437, à faire valider dans `docs/juridique/consentement.md`.
5. **Journaux d'API incomplets** : 56 appels journalisés pour 65 comptés. Rien à corriger dans l'app, mais on ne peut pas reclasser chaque appel. Si Florian veut un suivi robot fiable, ouvrir l'accès Vercel (analytics et journaux) à l'agent, ou envoyer les journaux Vercel dans PostHog (`$http_log`).

## Limites

- « Humain plausible » repose sur le réseau, le fuseau et la langue : un humain derrière un VPN peut passer pour un robot, et un robot soigné pour un humain. D'où la fourchette de 5 à 15.
- Les compteurs n'ont pas d'heure. L'heure vient des journaux Supabase, qui manquent 9 appels.
- Aucune donnée Vercel (403).
