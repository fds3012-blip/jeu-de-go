# Brief du conseil : Mochi Go Premium

Document autonome pour les trois membres du conseil. Il reprend `founder/idea.md` et les faits du dépôt utiles à un lecteur extérieur. Aucune opinion sur l'idée n'y est ajoutée.

## Le produit actuel

- Mochi Go (https://mochi-go.app) : app de go (jeu de plateau) pour le grand public, débutants compris. Français d'abord, anglais complet. PWA installable, pas encore sur l'App Store ni Google Play.
- Gratuit, sans publicité. Aujourd'hui, tout est gratuit et sans limite : 35 leçons jouables, plus de 200 problèmes, un « Go du jour » partageable, une série quotidienne avec gels gagnés (jamais achetés), 9 adversaires IA, parties en ligne classées, défi d'un ami par lien, revue de partie avec KataGo (IA de niveau professionnel), import de parties (SGF, OGS), statistiques, conseils de la mascotte Mochi en partie.
- L'IA KataGo tourne **sur l'appareil du joueur** (navigateur) : une analyse ne coûte rien au serveur.
- Mission (charte) : faire découvrir le go au plus grand nombre et donner à chaque joueur, du premier coup au niveau dan, le meilleur outil pour progresser.
- Équipe : un fondateur seul (Florian), aidé d'agents IA. Pas de salaire compté.

## L'idée soumise au conseil

Un abonnement Premium. Piste de la charte (non décidée) :
- Gratuit, sans publicité : parties illimitées contre l'IA et entre amis, chemin des leçons de base, problème du jour, **une analyse complète par jour**.
- Premium : analyses illimitées, leçons avancées, problèmes illimités, statistiques détaillées, « coach Claude » (explications par un modèle de langage, qui aurait un coût serveur par usage).
- Prix envisagé : 4,99 € par mois ou 39,99 € par an. Non décidé ; d'autres prix sont possibles.
- Cible de la charte : 3 % des actifs mensuels en Premium à 6 mois.

## Faits de marché (sources dans `docs/marketing/analyse-marche-acquisition-2026-10.md`)

- France : environ 1 600 licenciés de go, contre environ 80 000 aux échecs.
- Go en ligne occidental : quelques milliers de connectés sur OGS ; aucun chiffre d'actifs publié pour les autres.
- Concurrents : BadukPop (app anglophone, Pro à 6,99 $ ou 49,99 $ par an), SmartGo One (Pro à 2,99 $ par mois, iOS), AI Sensei (analyse web, 4,95 € à 24,95 € par mois), OGS (gratuit, « supporters » payants de 5 $ à 11 $ par mois et plus, qui donnent des revues IA plus fortes), chess.com (freemium à paliers ; le gratuit donne environ une revue de partie par jour).
- Duolingo : environ 9 % des actifs mensuels paient (calcul sur son rapport T2 2026). Il a dit en février 2026 donner la priorité à la croissance des utilisateurs plutôt qu'à la monétisation, après que des incitations à payer ont fait partir des joueurs gratuits.
- Benchmarks publics de conversion freemium : 2 à 5 % en général (sources secondaires).

## Situation de l'app

- Audience : 1 à 2 humains par jour début octobre 2026, et 0 première pierre mesurée sans accord sur environ 8 humains. Plan d'acquisition sur 90 jours, objectif 500 nouveaux humains par semaine à J90.
- Coûts fixes actuels : offres gratuites (Supabase, Vercel, PostHog, Sentry, Resend), domaine à 9,99 $ par an. L'offre gratuite de Vercel interdit l'usage commercial : vendre un abonnement oblige à passer à un plan payant.
- Aucune note sur les stores. Aucun avis public.

## Contraintes déjà écrites

- Ne jamais bloquer la boucle quotidienne (Go du jour, série). Premium ne protège jamais la série. Limiter le volume, jamais l'erreur.
- Justice du jeu : rien de payant ne doit faire gagner en ligne (parties classées).
- Mineurs : compte dès 15 ans seul, avant avec accord d'un parent. Un abonnement n'est pas forcément un acte qu'un mineur peut faire seul.
- La promesse « gratuit, sans publicité » est le principal argument d'acquisition.

## Questions ouvertes (non décidées)

Prix, essai gratuit, contenu exact, canal de paiement (web seul ou stores), traitement des mineurs, statut juridique et TVA.
