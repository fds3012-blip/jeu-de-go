# Sources des chiffres du CFO (#579)

Chaque entrée de `founder/numbers.json` et de `founder/scenarios/*.json` vient d'ici. Les fichiers sont générés par `founder/generer_scenarios.py` (Python standard), pour que tous les scénarios partagent les mêmes constantes.

**Limite de la recherche (17/10/2026).** Le proxy du conteneur refuse l'ouverture directe des pages. Les chiffres « publics » viennent des extraits du moteur de recherche pour les pages citées. Ils sont à vérifier sur la page avant de signer quoi que ce soit.

Trois types de chiffres :
- **Fait vérifié** : lu dans le dépôt ou par un outil connecté au compte.
- **Prix public** : page publique citée, lue par extrait de recherche.
- **Estimation** : choix de l'agent finance, avec son raisonnement. Jamais un fait.

## Prix et taxes

| Entrée | Valeur | Type | Source |
|---|---|---|---|
| Prix étudiés | 2,99 / 4,99 / 6,99 € par mois ; 24,99 / 39,99 / 49,99 € par an | Options, **aucune décidée** | 4,99 et 39,99 : piste de `entreprise/charte.md`. Les autres encadrent la fourchette des concurrents (`founder/competitors.md`, section 2) |
| TVA | 20 % (taux normal), le prix affiché est TTC, le script reçoit le prix hors TVA (TTC / 1,20) | Prix public | Taux normal pour les services électroniques : [Legifiscal](https://www.legifiscal.fr/tva/tva-francaise/operations-imposables-exonerees/taux-tva-applicable-abonnements-services-television.html). **À vérifier par un comptable** : si Florian relève de la franchise en base de TVA, il ne facture pas de TVA sur le web (what-if dans `founder/cfo.md`). Le statut de l'éditeur n'est pas renseigné (`docs/juridique/mentions-legales.md`, « À compléter ») |
| Monnaie | 1 € = 1,1188 $ | Prix public | Taux de référence BCE du 13/10/2026, publié au BOE : [BOE-A-2026-21442](https://www.boe.es/boe/dias/2026/10/14/pdfs/BOE-A-2026-21442.pdf) |

## Commissions de paiement

| Entrée | Valeur | Type | Source |
|---|---|---|---|
| Stripe, carte standard de l'EEE | 1,5 % + 0,25 € par paiement | Prix public | [Stripe, tarifs France](https://stripe.com/en-FR/pricing). Cartes premium de l'EEE : 2,8 % + 0,25 € ; Royaume-Uni : 2,5 % + 0,25 € (même page). Le modèle prend la carte standard |
| Stripe Billing (abonnements) | 0,7 % du montant facturé | Prix public, **source secondaire** | [erpresearch](https://erpresearch.com/erp-add-ons/billing-subscriptions/stripe-billing/pricing), [ppc.land](https://ppc.land/stripe-increases-fee-40-with-plan-deprecation/). Non lu sur stripe.com |
| Apple, App Store Small Business Program | 15 % dès le premier paiement, tant que les revenus nets annuels restent sous 1 M$ | Prix public | [Apple, Small Business Program](https://developer.apple.com/app-store/small-business-program/). Il faut **s'inscrire** au programme |
| Apple, taux standard dans l'UE | **26 %** la première année d'un abonné, 15 % ensuite, depuis le 01/10/2026 (et non plus 30 %) | Prix public | [Apple, Changes for apps in the EU](https://developer.apple.com/support/apps-in-the-eu/) ; [Irish Times, 19/08/2026](https://www.irishtimes.com/business/2026/08/19/apple-introduces-app-store-changes/). Hors UE, la règle reste 30 % la première année puis 15 % ([RevenueCat](https://www.revenuecat.com/blog/engineering/app-store-fees)) |
| Google Play, abonnements | 15 % | Prix public | [Google, aide Play Console](https://support.google.com/googleplay/android-developer/answer/10632485) : 15 % sur le premier million de dollars de revenus annuels pour les biens numériques ; abonnements à 15 % depuis le 01/01/2022 ([XDA](https://www.xda-developers.com/google-play-is-lowering-its-developer-fees-for-app-subscriptions/)) |
| Base de la commission | Prix hors TVA | **Estimation, à vérifier** | Indice : calcul d'un développeur sur [wip.co](https://wip.co/posts/do-sales-numbers-include-or-exclude-30-apple-tax-on-app-store-connect-trends-overview-a257w5/comments/8491) (le revenu européen reflète le prix TTC divisé par la TVA). Aucun texte d'Apple ou de Google lu sur ce point |

Note sur la consigne : la demande indiquait « Apple et Google 15 % la première année pour les petits éditeurs, 30 % sinon ». Les sources ci-dessus disent autre chose : 15 % **toutes les années** pour un petit éditeur inscrit (Apple) et pour tout abonnement (Google), et 26 % (non plus 30 %) la première année au taux standard d'Apple dans l'UE. Le modèle prend 15 %.

## Coûts fixes

| Entrée | Valeur | Type | Source |
|---|---|---|---|
| Supabase aujourd'hui | Offre gratuite | **Fait vérifié** le 17/10/2026 (organisation « SimpleFlows », plan `free`, outil Supabase) | — |
| Supabase Pro | 25 $ par mois (22,35 €), 100 000 MAU, 8 Go de disque, 250 Go de sortie ; les projets gratuits sont mis en pause après une semaine d'inactivité | Prix public | [Supabase, tarifs](https://supabase.com/pricing.md). Le passage en Pro est **une estimation de besoin** : l'offre gratuite suffit techniquement au volume du modèle ; on le compte parce qu'un service payé demande des sauvegardes et pas de pause. **Décision de Florian** |
| Vercel aujourd'hui | Compte personnel, « plan gratuit » | Fait du dépôt (`docs/journal.md`) ; l'outil Vercel ne liste aucune équipe | — |
| Vercel Pro | 20 $ par mois et par siège (17,88 €) | Prix public, sources secondaires | L'offre Hobby est réservée à un usage **non commercial** : [makerkit](https://makerkit.dev/blog/saas/vercel-cost), [schematic](https://schematichq.com/blog/vercel-pricing). Vendre un abonnement en fait un usage commercial : le passage en Pro est compté comme **nécessaire**. Page officielle non lue |
| Domaine `mochi-go.app` | 9,99 $ par an (0,74 € par mois) | Fait du dépôt | `docs/journal.md` (04/10). Prix de renouvellement non connu : on garde le prix d'achat |
| Apple Developer Program | 99 € par an (8,25 € par mois), scénarios « stores » seulement | Prix public | [Consomac](https://consomac.fr/news-11920-apple-peut-maintenant-offrir-son-programme-developpeur.html) ; même montant dans `docs/growth/connexion-google-apple.md`. Page Apple non lue |
| Compte Google Play | 25 $ une fois (22,35 €), scénarios « stores » seulement | Prix public, source secondaire | [AppRadar](https://appradar.com/blog/google-play-apple-app-store-fees) |
| PostHog, Sentry, Resend | 0 € (offres gratuites actuelles) | Fait du dépôt | `docs/juridique/consentement.md` (PostHog gratuit) ; `docs/growth/connexion-code.md` (Resend : 3 000 e-mails par mois gratuits). Hypothèse : le Premium ne les fait pas sortir de l'offre gratuite |

**Non comptés, faute de devis** (questions ouvertes, pas des zéros) : comptable, relecture des conditions de vente par un avocat, banque professionnelle, assurance, temps de Florian, coût par usage d'un « coach Claude » (API payante), remboursements et litiges de paiement.

## Volume : estimations

| Entrée | Valeur | Type | Raisonnement |
|---|---|---|---|
| Actifs mensuels (MAU) après le lancement du Premium, mois 1 à 12 | 300, 600, 1 000, 1 500, 2 000, 2 500, 3 000, 3 500, 4 000, 4 500, 5 000, 5 500 | **Estimation** | Point de départ : 1 à 2 humains par jour début octobre (`docs/marketing/analyse-marche-acquisition-2026-10.md`). Cible du plan d'acquisition à J90 : 500 nouveaux humains par semaine, environ 2 000 par mois. Avec une rétention à J30 visée à 12 % (charte), quelques milliers d'actifs par mois en fin d'année est un ordre de grandeur, **si** le plan d'acquisition tient. Rien ne le prouve aujourd'hui |
| Conversion des actifs mensuels en abonnés | 2 % (what-ifs : 1 %, 3 %, 5 %) | **Estimation** | Fourchette publique des apps freemium : 2 à 5 % ([Webtonic](https://www.webtonic.io/blog/freemium-statistics), qui cite OpenView ; sources secondaires). RevenueCat, cité par [SaaStr](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth) : médiane de conversion téléchargement → payant de 2,18 % pour les apps freemium, contre 12,11 % avec un paywall dur ([rapport RevenueCat](https://www.revenuecat.com/state-of-subscription-apps-2025), non lu en entier). Duolingo : environ 9 % des actifs mensuels paient (calcul du dépôt sur son 10-Q du T2 2026). Cible de la charte : 3 %. On prend le bas de la fourchette (2 %) pour une app sans note, sans avis et sans marque |
| Abonnés par mois | MAU × 2 %, pris comme un stock (comme l'indicateur de la charte, « 3 % des actifs mensuels ») | Estimation | Simplification : pas de churn modélisé séparément ; le ratio suppose qu'il est absorbé |
