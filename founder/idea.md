# Mochi Go Premium (nom de travail)

Fichier d'entrée du pack « founder » (issue #579). Tout ce qui suit vient du dépôt ; ce que Florian n'a pas décidé est listé en questions ouvertes, avec des options, sans choix.

- **What it is** : un abonnement optionnel à Mochi Go (https://mochi-go.app), l'app de go grand public, gratuite et sans publicité, qui donnerait plus de volume (analyses, problèmes, leçons avancées, statistiques) à ceux qui veulent progresser, sans toucher au jeu gratuit.
- **Who it is for** : d'abord le « second cercle » de la charte (joueurs de club, niveau kyu, qui veulent une IA et une analyse simples sur mobile), puis les débutants adultes devenus réguliers (cœur de la charte : adultes curieux de jeux de stratégie, joueurs d'échecs). France et francophonie d'abord, puis anglais.
- **What it sells, at what price** : **non décidé.** La charte (`entreprise/charte.md`) note une piste : 4,99 € par mois ou 39,99 € par an, « à valider par l'agent finance ». Contenu envisagé par la charte : analyses illimitées, leçons avancées, problèmes illimités, statistiques détaillées, coach Claude.
- **Where and how** : en ligne. L'app est une PWA servie par Vercel, base Supabase (Paris). Pas encore sur les stores : Capacitor est prévu, compte Apple reporté (`docs/journal.md`, 04/10). Paiement possible : Stripe sur le web, achats intégrés Apple et Google plus tard.
- **Ce qui existe aujourd'hui** : tout est gratuit et sans limite. Revue de partie avec KataGo, import SGF (#286), statistiques (#368), étude et analyse (#372), conseils de Mochi en partie (#80), 35 leçons, plus de 200 problèmes, parties en ligne classées. Une limite des conseils est codée mais inactive (`CONSEILS_GRATUITS_PAR_PARTIE = null`, `src/app/conseilMochi.ts`). Les événements `revue_ouverte`, `analyse_demandee`, `probleme_resolu` et `statistiques_ouvertes` sont déjà marqués « base de la future limite Premium » (`docs/data/plan-de-marquage.md`). Conséquence : tout Premium **retire** quelque chose à des joueurs qui l'ont aujourd'hui gratuitement, ou doit être fait de nouveautés.
- **Budget and constraints** :
  - L'IA (KataGo) tourne sur l'appareil du joueur : une analyse ne coûte rien au serveur. Exception possible : un « coach Claude » appellerait une API payante à chaque usage.
  - Coûts fixes actuels : offres gratuites (Supabase « free », vérifié le 17/10 ; Vercel « plan gratuit », `docs/journal.md`), domaine `mochi-go.app` à 9,99 $ (`docs/journal.md`, 04/10).
  - Audience actuelle : 1 à 2 humains par jour début octobre (`docs/marketing/analyse-marche-acquisition-2026-10.md`, synthèse point 8). Objectif du plan d'acquisition à J90 : 500 nouveaux humains par semaine.
  - Règles déjà écrites : ne jamais bloquer la boucle du jour (Go du jour, série) ; Premium ne protège jamais la série ; si Premium limite quelque chose, c'est le volume, jamais l'erreur (`docs/ux/base-de-connaissances.md`). Promesse d'acquisition : « gratuit, sans publicité ».
  - Juridique : compte dès 15 ans seul, avant 15 ans avec accord d'un parent ; un abonnement n'est pas forcément un « acte courant » pour un mineur (décision D7 ouverte, `docs/juridique/compte-obligatoire.md`). Les CGU annoncent des conditions de vente séparées et promettent de signaler clairement tout changement de ce qui est gratuit (`docs/juridique/cgu.md`, section 3).
  - Florian a donné son accord pour l'étude, **pas pour une décision d'argent**.

## Questions ouvertes (à Florian), avec options

| Question | Options possibles (aucune choisie) |
|---|---|
| Prix mensuel | 2,99 € · 4,99 € (piste de la charte) · 6,99 € |
| Prix annuel | 24,99 € · 39,99 € (piste de la charte) · 49,99 € |
| Essai gratuit | aucun · 7 jours · 14 jours (SmartGo propose 14 jours) |
| Ce qui reste gratuit | tout ce qui est gratuit aujourd'hui, au minimum le jeu en ligne, les leçons de base, le Go du jour, la série ; une analyse complète par jour (charte) |
| Ce qui devient Premium | analyses illimitées · problèmes illimités · leçons avancées · statistiques détaillées · import SGF et outils de club · coach Claude (coût serveur à chiffrer) |
| Canal de paiement au lancement | web seul (Stripe) · web puis stores (Capacitor) |
| Mineurs (D7) | Premium réservé aux 18 ans et plus sur le web · achat par les stores seulement (contrôle parental) · accord parental déclaré |
| Statut juridique et TVA | non renseigné (mentions légales « À compléter ») ; à voir avec un comptable |
