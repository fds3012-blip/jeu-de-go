# Page de présentation web (#112, mise à jour #208)

Mise à jour du 28/09/2026 : mêmes faits que les fiches stores v2 (`docs/marketing/fiches-stores.md`). Aucun chiffre qui ne soit compté dans le dépôt.

Page d'accueil publique du jeu (par exemple `mochi-go.app/decouvrir`). Elle suit la règle du produit : comprise en 3 secondes, **un seul appel à l'action, « Jouer maintenant »**, répété à l'identique. Il ouvre l'app sur la première partie contre Pomme, sans compte.

Univers : Encre & Jade (`docs/design/v2/direction.md`). Fond encre, pierres réelles, un seul bouton jade en relief par écran visible, Mochi pour la voix.

## Structure

| # | Bloc | Rôle |
|---|---|---|
| 1 | Héros | Dire ce que c'est et lancer la partie |
| 2 | Trois bénéfices | Apprendre, progresser, comprendre |
| 3 | Preuve : le Go du jour | Montrer un vrai défi partagé |
| 4 | FAQ | Lever les 5 doutes les plus fréquents |
| 5 | Pied de page | Rappel du bouton, conditions, contact |

## 1. Héros

- **Visuel** : un goban 9 × 9 en perspective douce, deux pierres (le logo), Mochi à côté. Sur mobile, le goban passe sous le texte.
- **Titre** : Apprends le go en jouant.
- **Sous-titre** : 7 leçons où tu poses ta pierre dès le premier écran, plus de 100 problèmes prouvés et une IA forte qui tourne sur ton appareil. Gratuit, sans publicité.
- **Bouton (unique, en relief jade)** : Jouer maintenant
- **Mention sous le bouton** (petite, encre brume) : Sans compte. Ta première partie commence tout de suite.

## 2. Trois bénéfices

Trois cartes, chacune avec une icône de l'identité aux deux pierres (`docs/design/v2/identite.md`).

1. **Tu apprends en jouant, pas en lisant**
   7 leçons avec Mochi. Dès le premier écran, tu poses ta pierre. Les mots du go (atari, ko, komi) sont expliqués quand ils arrivent. Et pour tes 3 premières parties, le komi est réduit à 0,5 : ta première victoire est possible.
   *Visuel : capture store `02-lecon.jpg` (la pierre et ses 4 libertés).*

2. **Tu progresses à ton rythme**
   Plus de 100 problèmes, sans fin : après chacun, un autre t'attend. Chaque solution est prouvée contre toutes les défenses. Et 9 adversaires illustrés, de Pomme (20 kyu) à Sensei (1 dan).
   *Visuel : capture store `04-adversaires.jpg`.*

3. **Tu comprends chaque partie**
   À la fin, la revue va droit au moment clé : le coup qui t'a coûté le plus, avec les points perdus. Tu le rejoues depuis cette position. Pas de faux compliment.
   *Visuel : capture store `05-revue.jpg`.*

## 3. Preuve : le Go du jour

- **Titre** : Le Go du jour. Le même défi pour tout le monde.
- **Texte** : Chaque jour, un nouveau problème. Résous-le : ta série commence dès le premier jour, même sans compte. Puis partage ton résultat sans dévoiler la réponse.
- **Encart** : le vrai message de partage, tel que l'app le produit :
  > Go du jour n° 12 · résolu en 2 essais · série 5 🔥
- **Lien texte** (pas un second bouton) : Essaie celui d'aujourd'hui → ouvre `?go-du-jour=N` du jour.

Pourquoi c'est la preuve : c'est un objet réel, identique pour tous, que les visiteurs ont souvent déjà vu passer chez un ami. On ne publie pas de chiffres de joueurs ni d'avis tant qu'ils n'existent pas.

## 4. FAQ

**C'est quoi le go ?**
Un jeu de stratégie né en Chine il y a plus de 2 500 ans. Deux joueurs posent à tour de rôle des pierres noires et blanches sur un plateau pour entourer le plus de territoire. Les règles tiennent en une minute, mais on peut y jouer toute sa vie.

**Je n'y ai jamais joué. C'est pour moi ?**
Oui. La première partie se joue contre Pomme, qui débute aussi, sur un petit plateau 9 × 9. Mochi te guide et te prévient quand tes pierres sont en danger. Pour tes 3 premières parties, le komi (les points donnés à Blanc parce que Noir commence) est de 0,5 au lieu de 6,5 : tu peux gagner dès le début.

**C'est vraiment gratuit ?**
Oui. Leçons, problèmes, Go du jour et parties contre les adversaires sont gratuits, et il n'y a aucune publicité.

**Faut-il créer un compte ?**
Non. Tu peux jouer tout de suite. Un compte sert seulement à retrouver ta progression sur un autre appareil.

**Comment fonctionne l'IA ?**
Les adversaires les plus forts sont joués par KataGo, une IA de go open source. Elle tourne directement sur ton téléphone ou ton ordinateur, gratuitement : une fois téléchargée, elle marche même hors ligne.

**Et si je joue au clavier, avec un lecteur d'écran ou avec un grand zoom ?**
Une partie se joue entièrement au clavier, avec des annonces pour le lecteur d'écran. Les écrans principaux tiennent à 200 % de zoom, sans défilement horizontal. Mode sombre et clair, mouvements réduits respectés.

## 5. Pied de page

- Rappel du bouton **Jouer maintenant** (même texte, même couleur).
- Liens texte : Conditions et confidentialité, Contact.
- Mention : KataGo est un logiciel open source ; moteur adapté de web-katrain (licence MIT).

## Règles de la page

- Un seul bouton en relief visible à la fois ; tout le reste est en lien texte.
- Balises pour le référencement : `<title>` « Apprendre le go en jouant, gratuit | Mochi Go » ; `h1` = titre du héros ; FAQ balisée en `FAQPage` (schema.org) pour viser « c'est quoi le go », « règles du go », « apprendre le go ».
- Image de partage (Open Graph) : le goban du héros avec le titre.
- Accessibilité : contraste AA, cibles de 44 px, animations coupées si mouvements réduits, sombre et clair.

## Mesure

| Action | Coût | Indicateur visé | Mesure |
|---|---|---|---|
| Page de présentation | 0 € (Vercel déjà en place) | 40 % des visiteurs cliquent sur « Jouer maintenant » | PostHog : vues de la page et clic (événement à ajouter côté page, `cta_jouer_clique`) rapportés à `app_ouverte` |
| Encart Go du jour | 0 € | 10 % des visiteurs ouvrent le Go du jour | `arrivee_par_partage` et ouvertures de `?go-du-jour=N` |
| FAQ balisée | 0 € | Page dans le top 10 Google pour « apprendre le go » en 3 mois | Google Search Console, position moyenne et clics |
