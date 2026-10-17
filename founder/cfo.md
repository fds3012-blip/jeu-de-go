# CFO : Mochi Go Premium (#579)

Entrées : `founder/numbers.json` (option « charte », mensuel, web) et `founder/scenarios/*.json` (12 scénarios). Sources et estimations : `founder/cfo-sources.md`. Outil : `.claude/skills/founder-cfo/unit_economics.py`, sans modification.

**Comment lire les sorties du script.** Les montants sont en **euros hors TVA**, mais le script affiche le signe `$`. L'unité est un **abonné-mois** et `days_per_month` vaut 1 : chaque « a day » du rapport se lit « par mois ». Le point mort est donc un **nombre d'abonnés payants**.

## La note du CFO

### La marge

- Option « charte » (4,99 € TTC par mois, web, Stripe) : le prix hors TVA est 4,16 € ; Stripe prend 0,36 € ; il reste **3,80 € par abonné et par mois (91 %)** pour payer les coûts fixes.
- Coûts fixes avec un Premium : **40,97 € par mois sur le web** (Supabase Pro, Vercel Pro, domaine), **49,22 € avec les stores** (plus le compte Apple). Aujourd'hui, ils sont presque nuls : c'est le fait de vendre qui les crée (Vercel interdit l'usage commercial sur l'offre gratuite).
- **Point mort : 11 abonnés** (web, mensuel). Avec 2 % des actifs mensuels qui s'abonnent, il faut environ **540 actifs mensuels** ; à 3 % (cible de la charte), 360.
- Marge à 110 abonnés (fin de la rampe estimée) : 82 %. Résultat de l'an 1 sur la rampe estimée : 2 046 € (hors temps de Florian, comptable, avocat : non chiffrés).

### Ce qu'il faut surveiller

**L'audience, pas le prix.** La rampe suppose 300 actifs mensuels dès le mois 1 et 5 500 au mois 12 (estimation). Aujourd'hui, l'app reçoit 1 à 2 humains par jour. What-if du script :

| Volume (multiplicateur de la rampe) | Ce que ça représente | Résultat an 1 | Remboursé au mois |
|---|---|---:|---|
| × 0,05 | 15 à 275 actifs mensuels, proche de l'audience actuelle | **−365 €** (le script le signale) | jamais dans l'année |
| × 0,5 | conversion de 1 % au lieu de 2 % | 777 € | 5 |
| × 1 | base (2 %) | 2 046 € | 3 |
| × 1,5 | conversion de 3 % (charte) | 3 315 € | 2 |
| × 2,5 | conversion de 5 % (haut de la fourchette publique) | 5 852 € | 1 |

À l'audience d'aujourd'hui, le Premium **perd de l'argent** : il crée environ 41 € de coûts fixes par mois pour presque aucun abonné. Le prix, lui, bouge peu le résultat (what-if « Price -10% » plus bas : 11 → 13 abonnés).

### La trésorerie

Sur la rampe estimée, le creux est de 18 € (mois 1), sans dépense de démarrage sur le web. Avec les stores : 22,35 € (compte Google) en plus. Le vrai risque de trésorerie n'est pas là : ce sont les coûts non chiffrés (comptable, relecture des conditions de vente).

### Trois façons d'améliorer la marge (chiffrées par le script)

1. **Vendre sur le web avant les stores** : contribution de 3,80 € au lieu de 3,53 € par abonné, point mort de 11 au lieu de 14 abonnés (scénarios `charte-mensuel-web` et `charte-mensuel-stores`). Effet sur la croissance : sans les stores, on se prive de l'achat en un geste sur iPhone et Android, et du contrôle parental des stores (D7).
2. **Garder Supabase en gratuit tant que le volume le permet** : coûts fixes de 18,62 € au lieu de 40,97 €, point mort de **5 abonnés** au lieu de 11, résultat de l'an 1 de 2 314 € au lieu de 2 046 €. Contrepartie : pas de sauvegardes quotidiennes du plan Pro ni de garantie pour un service payé. Décision de Florian.
3. **Prix plus haut (option « progression », 6,99 €)** : contribution de 5,42 €, point mort de **8 abonnés**, résultat de l'an 1 de 3 130 € sur la même rampe. Effet sur la croissance : la rampe à volume égal est une hypothèse ; un prix plus haut convertit probablement moins, ce que le modèle ne sait pas mesurer. Un panel ou un vrai test le dirait.

Autre levier, juridique et non commercial : si Florian relève de la franchise en base de TVA, le prix web n'est pas amputé de 20 % (what-if `--price 4.99`) : contribution de 4,63 €, point mort de 9 abonnés. À confirmer par un comptable.

### Les conditions d'argent du conseil (`founder/board.md`)

- « Audience d'abord » : **non remplie.** Point mort à environ 540 actifs mensuels (2 %) ; l'audience mesurée est très loin en dessous.
- « Prix dans la fourchette des concurrents » : **remplie** par les trois options (2,99 à 6,99 € par mois ; concurrents de 2,99 $ à 24,95 €).
- « Garantie » : sans effet sur les coûts variables (aucun coût de livraison), mais un remboursement coûte les frais Stripe déjà payés. Non modélisé.

Un comptable doit vérifier la structure (statut de l'éditeur, TVA, facturation) avant que de l'argent ne circule.

## Les 12 scénarios (sorties du script, `--json`)

Colonnes « actifs mensuels » : point mort divisé par le taux de conversion, arrondi au-dessus. Résultat de l'an 1 : sur la rampe estimée, identique pour tous les prix (le modèle ne sait pas comment le prix change la conversion).

| scénario | prix TTC (€) | prix HT par mois | coûts variables par mois | contribution par mois | % | coûts fixes par mois | point mort (abonnés) | actifs mensuels à 2 % | à 3 % | à 5 % | résultat an 1 (€) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| soutien mensuel web | 2,99 | 2,49 | 0,32 | 2,18 | 87 | 40,97 | 19 | 942 | 628 | 377 | 962 (après démarrage : 962) |
| soutien mensuel stores | 2,99 | 2,49 | 0,37 | 2,12 | 85 | 49,22 | 24 | 1163 | 775 | 465 | 824 (après démarrage : 802) |
| soutien annuel web | 24,99 | 1,74 | 0,07 | 1,67 | 96 | 40,97 | 25 | 1228 | 819 | 492 | 623 (après démarrage : 623) |
| soutien annuel stores | 24,99 | 1,74 | 0,26 | 1,48 | 85 | 49,22 | 34 | 1669 | 1113 | 668 | 395 (après démarrage : 372) |
| charte mensuel web | 4,99 | 4,16 | 0,36 | 3,80 | 91 | 40,97 | 11 | 540 | 360 | 216 | 2046 (après démarrage : 2046) |
| charte mensuel stores | 4,99 | 4,16 | 0,62 | 3,53 | 85 | 49,22 | 14 | 697 | 465 | 279 | 1770 (après démarrage : 1748) |
| charte annuel web | 39,99 | 2,78 | 0,09 | 2,68 | 97 | 40,97 | 16 | 764 | 510 | 306 | 1301 (après démarrage : 1301) |
| charte annuel stores | 39,99 | 2,78 | 0,42 | 2,36 | 85 | 49,22 | 21 | 1043 | 696 | 418 | 986 (après démarrage : 964) |
| progression mensuel web | 6,99 | 5,83 | 0,40 | 5,42 | 93 | 40,97 | 8 | 378 | 252 | 152 | 3130 (après démarrage : 3130) |
| progression mensuel stores | 6,99 | 5,83 | 0,87 | 4,95 | 85 | 49,22 | 10 | 498 | 332 | 199 | 2717 (après démarrage : 2694) |
| progression annuel web | 49,99 | 3,47 | 0,11 | 3,36 | 97 | 40,97 | 13 | 610 | 407 | 244 | 1752 (après démarrage : 1752) |
| progression annuel stores | 49,99 | 3,47 | 0,52 | 2,95 | 85 | 49,22 | 17 | 835 | 557 | 334 | 1380 (après démarrage : 1358) |

Lecture des annuels : le prix est ramené au mois (39,99 € / 12 = 3,33 € TTC). Un abonné annuel rapporte moins par mois, mais paie un an d'avance et ne peut pas partir avant l'échéance (la résiliation n'est pas modélisée).

---

## Rapport du script (option « charte », mensuel, web)

### Unit economics: Mochi Go Premium, option charte, mensuel, web (4.99 € TTC)

Every number below comes from the input file. Nothing is looked up or guessed.

### One abonné-mois

| line | per abonné-mois |
| --- | ---: |
| Price | $4.16 |
| Stripe carte EEE standard (1,5 % + 0,25 € par paiement) | -$0.32 |
| Stripe Billing (0,7 % du montant facturé) | -$0.03 |
| **Contribution** (what each abonné-mois leaves to pay the fixed costs) | **$3.80** (91%) |

### The margin that matters

Fixed costs: $41 a month (Supabase Pro (25 $/mois) $22, Vercel Pro (20 $/mois, usage commercial) $18, Domaine mochi-go.app (9,99 $/an) $1).

- **Break-even: 11 abonné-moiss a day.** Below that you lose money every month.
- **Profit margin at your plan** (110 a day): **82%** of every sale, after every cost.

### Year 1, month by month

| month | abonné-moiss a day | revenue | profit | cumulative (after $0 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 6 | $25 | -$18 | -$18 |
| 2 | 12 | $50 | $5 | -$14 |
| 3 | 20 | $83 | $35 | $21 |
| 4 | 30 | $125 | $73 | $94 |
| 5 | 40 | $166 | $111 | $205 |
| 6 | 50 | $208 | $149 | $354 |
| 7 | 60 | $249 | $187 | $541 |
| 8 | 70 | $291 | $225 | $766 |
| 9 | 80 | $333 | $263 | $1,029 |
| 10 | 90 | $374 | $301 | $1,330 |
| 11 | 100 | $416 | $339 | $1,669 |
| 12 | 110 | $457 | $377 | $2,046 |

- **Year 1 operating profit: $2,046** on $2,778 of revenue.
- After the $0 startup spend: $2,046.
- Startup money earned back: month 3.
- Cash you need before it pays for itself: **$18**.

### What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 82% | 11 | $2,046 |
| Price -10% | 80% | 13 | $1,768 |
| Volume -20% | 80% | 11 | $1,538 |
| Unit costs +15% | 81% | 11 | $2,010 |

No red flags in these numbers. They are only as good as the inputs: check every cost against a real quote.
