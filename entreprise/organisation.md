# Organisation

Le dirigeant (Claude, sous la supervision de Florian) fixe les priorités, répartit le travail entre les agents et arbitre. Chaque agent a son fichier dans `.claude/agents`.

## Produit et technique
| Agent | Périmètre |
|---|---|
| produit | Feuille de route, priorités, spécifications, arbitrages entre agents |
| architecte | Socle, CI, déploiement, relecture du code |
| designer | Maquettes, design system, textes d'interface, Mochi |
| frontend | Écrans, plateau, branchement des données |
| moteur-go | Règles, comptage, SGF, KataGo, niveaux des adversaires |
| backend | Supabase, sécurité, parties en ligne, anti-triche |
| qa | Tests, accessibilité, recette |
| ux-jeux-mobiles | Analyse de l'expérience joueur, comparaison avec les meilleurs jeux mobiles, base de connaissances UX (`docs/ux/`) |

## Contenu et joueurs
| Agent | Périmètre |
|---|---|
| pedagogie | Programme d'apprentissage du débutant au dan, leçons, problèmes, relecture experte |
| communaute | Support, modération, retours joueurs, clubs et fédérations |

## Croissance et entreprise
| Agent | Périmètre |
|---|---|
| growth | Mesure, onboarding, rétention, notifications |
| marketing | Marque, contenus, réseaux sociaux, SEO, fiches des stores, partenariats |
| juridique | RGPD, CGU, mentions légales, licences open source, règles des stores |
| finance | Modèle économique, prix, coûts, abonnement Stripe et achats intégrés |

## Boucle d'amélioration continue
Après chaque livraison :
1. **qa** vérifie les parcours clés et note les défauts.
   **ux-jeux-mobiles** analyse l'expérience du parcours livré et enrichit `docs/ux/base-de-connaissances.md`.
2. **produit** compare l'écran livré aux meilleurs concurrents (chess.com, BadukPop, OGS, KaTrain) et liste ce qui manque.
3. Le dirigeant classe les améliorations par impact sur les indicateurs de la charte, crée les issues et les confie aux agents.
4. On recommence.
