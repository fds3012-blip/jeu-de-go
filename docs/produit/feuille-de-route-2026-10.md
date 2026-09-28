# Feuille de route — octobre 2026

Auteur : responsable produit. Date : 27 septembre 2026. **Mise à jour : 28 septembre 2026 au soir** (section 0, d'après `docs/produit/veille-2026-09-28-soir.md`). Les sections 1 à 5 gardent l'état du 27 pour mémoire.

## 0. Mise à jour du 28 septembre au soir

### Fait depuis le 27

| # du 27 | Priorité | État | Preuve |
|---|---|---|---|
| 1 | Accueil à une seule action | **Fait** | #119, #236 (un appel à la fois) |
| 2 | Consentement après la première partie ou leçon | **En partie** : le lien du Go du jour attend la fin du problème ; au premier lancement, la fenêtre reste sur le chemin | #75, base UX (v2) |
| 3 | Leçons jouables dès l'étape 1 | **Fait** | #198, #202, #220 |
| 4 | Mochi et la passe au bon moment | **Fait** | #120, #185, #235 |
| 5 | Zoom 200 % et 320 px | **Fait** | #121, #250, #232 |
| 6 | Thèmes de goban appliqués | **Fait** | #109 |
| 7 | Rappel quotidien | **Pas commencé** | #36 |
| 8 | Défier un ami par lien | **Pas commencé** | #81 |
| 9 | Revue lisible, moment clé | **Fait** | #186, #192, #71 |
| 10 | Fin du clavier | **En partie** : « Lire le plateau » reste | #116 |

Livré en plus, hors de la liste : 171 problèmes prouvés et l'outil de preuve de vie et mort (#136), leçons et problèmes en anglais (#167), « Rejoue cette erreur » (#77), Go du jour commun et partageable (#75), partie guidée (#79), série sans compte, record et flamme (#161, #212, #213), révision du jour (#199), économie de progression (#233), confirmation avant de quitter (#268).

**Lecture** : ce qui se passe **dans** l'app est à parité avec chess.com et BadukPop pour un débutant. L'écart est maintenant **hors** de l'app : rien ne fait revenir, rien ne fait venir, et le joueur de club ne sait pas où il se situe.

### Les 10 priorités de la suite d'octobre

| # | Priorité | Mouvement | Impact | Effort | Indicateur visé | Issue |
|---|---|---|---|---|---|---|
| 1 | Rappel quotidien (notification web, app installée, heure choisie) | **Monte** (7 → 1) | 5 | 3 | J7 25 %, J30 12 % | #36 |
| 2 | Défier un ami par lien, partie en différé ; ouvre enfin le serveur de parties en ligne | **Monte** (8 → 2) | 5 | 3 | Nouveaux joueurs par semaine (10 000), J30 | #81, #10 |
| 3 | Lien partagé qui recrute : aperçu Open Graph, arrivée sur le Go du jour | **Nouveau** | 4 | 1 | Nouveaux joueurs par partage (10 %) | #285 |
| 4 | « Continuer » à ta mesure, cible 85 % de réussite | **Nouveau** | 4 | 2 | J7 | #284 |
| 5 | Je sais déjà jouer : placement et niveau en kyu | **Nouveau** | 4 | 2 | J1 du second cercle | #283 |
| 6 | Consentement après le premier plaisir (fin de la priorité 2 du 27) | Reste | 4 | 1 | Première pierre dans la minute (90 %) | UX-05, à créer |
| 7 | Interface anglaise sans `?lang=en` (détection de la langue, choix dans le Profil) | **Monte** | 3 | 1 | Nouveaux joueurs (marché anglais) | #167 |
| 8 | Course aux problèmes de 3 minutes | **Nouveau** | 3 | 2 | J7, durée de session | #287 |
| 9 | Importer une partie SGF et l'analyser | **Monte** (novembre → fin octobre) | 3 | 2 | Acquisition du second cercle, J7 club | #286 |
| 10 | Fin du clavier : « Lire le plateau » | **Descend** (reste dans la liste) | 2 | 2 | Conformité AA | #116 |

### Ce qui descend

- **Mochi coach en phrases simples** (#80) : la revue honnête et « Rejoue cette erreur » couvrent le besoin immédiat ; à reprendre en novembre avec Premium.
- **Carte de territoire animée** (#78) : le récit du score, les frontières et « Qui mène ? » suffisent pour l'instant ; la mise en valeur des pierres mortes reste en réserve.
- **Nouveaux lots de problèmes** (#136) : 171 problèmes prouvés couvrent plusieurs semaines de Go du jour et de « Continuer ». Le sélecteur à ta mesure (#284) passe avant le volume.
- **Refonte visuelle v2** (#40) : après le test utilisateur avec 5 débutants.

### Ce qu'on ne fait toujours pas en octobre

- Cote Elo publique et classements : la cote des problèmes (#284) reste privée ; le classement entre amis attend #81.
- Ligues, tournois, clubs, parties commentées (GoTV d'OGS) : trop tôt pour notre base de joueurs.
- Capacitor et stores : après le test utilisateur.

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
