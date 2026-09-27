# Feuille de route — octobre 2026

Auteur : responsable produit. Date : 27 septembre 2026.

Sources : charte (`entreprise/charte.md`), audit UX et a11y (`docs/qa/audit-ux-a11y-2026-09-27.md`), veille (`docs/produit/veille-2026-09-27.md`), issues ouvertes #116, #119, #120, #121, livraisons du 27 septembre.

## 1. Où on en est

Livré ou en PR ce soir :
- Leçons 2 à 4 en « je montre / on fait ensemble / tu fais seul » (#101).
- Portraits réactifs des adversaires et de Mochi (#102).
- XP et niveaux (#109). Les thèmes de goban sont débloqués, mais pas encore appliqués au plateau.
- Supprimer mon compte (#114).
- Goban au clavier et au lecteur d'écran (#116), sur le plateau de partie.
- Comptage automatique des pierres mortes (#117).
- Score raconté « Toi / Pomme » (#118) et conseil pour passer (#120).
- Série protégée côté serveur (#76).
- 101 problèmes (lots E et F).
- Audit UX et a11y, dossier marketing, confidentialité et CGU.

Les 4 défauts majeurs de l'audit qui restent : l'accueil à deux actions (#119), le zoom 200 % (#121), la fin de #116 (leçons et problèmes au clavier, « Lire le plateau ») et la fin de #120 (Mochi détecte seul le moment de passer).

## 2. Ce qui manque face aux meilleurs

| Axe | chess.com | BadukPop | OGS | KaTrain | Nous | Écart |
|---|---|---|---|---|---|---|
| Onboarding | Une action, niveau choisi en 1 écran | Leçon jouable en 10 s | Faible | Aucun | Leçons visuelles, mais accueil à 2 actions et consentement en premier | **Grand** |
| Rétention | Série, notifications, puzzle du jour, ligues | Série, cœurs, carte de progression | Tournois, correspondance | Aucune | Série protégée, Go du jour, XP | **Moyen** : pas de rappel, pas d'objectif de la semaine |
| Social | Amis, défis, clubs, chat | Faible | Fort : parties, clubs, tournois | Aucun | Parties en ligne brutes, pas d'amis ni de lien de défi | **Grand** |
| Profondeur | Revue « coach », cote, ouvertures | Faible | Revue, SGF, cote | Très forte : erreurs, politique IA, score | Analyse KataGo, revue, « Rejoue tes erreurs » | **Moyen** : revue illisible au débutant, pas de cote visible, pas d'import SGF |
| Accessibilité | Correcte | Faible | Faible | Faible | Clavier en partie | **Avantage à prendre** |

Lecture :
- Un débutant ne comprend pas encore l'accueil en 3 secondes. C'est le premier chantier.
- Un joueur de club trouve l'IA, mais pas d'outil pour la montrer : pas de cote, pas d'import de ses parties.
- Rien ne fait revenir le joueur s'il n'ouvre pas l'app. Pas de rappel, pas d'ami.

## 3. Les 10 prochaines priorités

Impact et effort notés de 1 à 5. Classement par rapport impact / effort, puis par indicateur de la charte.

| # | Priorité | Impact | Effort | Indicateur visé | Issue |
|---|---|---|---|---|---|
| 1 | Accueil à une seule action | 5 | 1 | Première pierre dans la minute (90 %) | #119 |
| 2 | Consentement après la première partie ou leçon | 4 | 1 | Première pierre dans la minute | UX-05, à créer |
| 3 | Leçons et problèmes en plein écran, premier geste dès l'étape 1 | 4 | 2 | Leçon 1 terminée, J1 | UX-06, UX-08, à créer |
| 4 | Mochi détecte seul le moment de passer (fin de #120) | 4 | 2 | Parties terminées par semaine (5) | #120 |
| 5 | Zoom 200 % sans défilement horizontal | 3 | 2 | Note des stores (4,7), conformité AA | #121 |
| 6 | Appliquer les thèmes de goban débloqués (fin de #109) | 3 | 1 | J7, parties par semaine | #109, à créer |
| 7 | Rappel quotidien (notification PWA) : série et Go du jour | 5 | 3 | J7 / J30 | à créer |
| 8 | Défier un ami par lien, partie en 9 × 9 | 5 | 3 | Nouveaux joueurs par semaine (10 000) | à créer |
| 9 | Revue lisible : moment clé, légende, pas de précision sous 20 coups | 3 | 2 | J7, Premium (analyse) | UX-13, à créer |
| 10 | Fin de #116 : leçons et problèmes au clavier, « Lire le plateau » | 3 | 3 | Conformité AA, note des stores | #116 |

### Détail court

1. **Accueil à une seule action.** Le bouton « Joue ta première partie » reste. Le plateau devient une illustration. La bulle de Pomme ne cache plus aucune ligne. Terminé quand : un seul `.cta`, 9 lignes visibles à 390 × 844.
2. **Consentement reporté.** La fenêtre arrive après la première partie ou la première leçon. Aucun envoi avant l'accord. Terminé quand : le premier écran montre le plateau.
3. **Plein écran en leçon et problème.** Pas de barre du bas. Une croix pour sortir. Premier geste à l'étape 1 : « Touche une liberté ». Terminé quand : aucun onglet visible en leçon, test e2e.
4. **Passer au bon moment.** Quand l'estimation ne voit plus de coup utile, Mochi dit : « Plus rien à gagner ? Touche Passer. » Terminé quand : le conseil s'affiche une fois par partie, test Vitest sur la détection.
5. **Zoom 200 %.** Aucun défilement horizontal à 195 px. Barre du bas lisible. Terminé quand : le test Playwright de #121 passe sur les 5 écrans.
6. **Thèmes de goban.** Les thèmes gagnés avec les niveaux changent vraiment le bois et les pierres. Contraste des lignes ≥ 3:1 sur chaque thème. Terminé quand : choix dans le Profil, appliqué en partie, test de contraste.
7. **Rappel quotidien.** Une notification par jour, à l'heure choisie, opt-in après 3 jours de série. Texte court : « Ta série de 4 jours t'attend. » Terminé quand : envoi par fonction serveur, désactivable en un geste.
8. **Défier un ami.** « Défier un ami » crée un lien. L'ami joue sans compte. Terminé quand : partie complète entre 2 appareils, test e2e à deux contextes, RLS sur la table des défis.
9. **Revue lisible.** Action principale « Voir mon moment clé ». Précision cachée sous 20 coups. Courbe légendée. Terminé quand : capture relue par l'audit.
10. **Fin du clavier.** Plateaux des leçons et des problèmes jouables au clavier. Commande « Lire le plateau » (liste des pierres par couleur). Terminé quand : leçon 1 et Go du jour réussis au clavier seul, test e2e.

## 4. Ce qu'on ne fait pas en octobre

- Cote Elo visible et classement : il faut d'abord assez de parties en ligne.
- Import SGF et outils de joueur de club (à la KaTrain) : en novembre, avec l'offre Premium.
- Capacitor et stores : après la priorité 5 (accessibilité) et une note de test utilisateur.
- Ligues et tournois : après les amis (priorité 8).

## 5. Comment on mesure

- Chaque priorité a un évènement PostHog nommé dans sa PR.
- Revue le lundi : première pierre dans la minute, J1, J7, parties terminées par semaine.
- Un test utilisateur avec 5 débutants avant le 15 octobre (plan en §6 de l'audit).
