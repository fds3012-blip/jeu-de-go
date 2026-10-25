# Inviter un ami : lien personnel et cadeau gratuit (C5, issue #729)

Auteur : growth, avec backend et designer. Date : 25 octobre 2026. Chantier C5 de `docs/produit/constat-2026-10-22.md`.

**Indicateur à faire bouger** : joueurs actifs arrivés par un ami. Mesure : `invitation_validee` par `invitation_partagee` (taux de conversion du lien), puis rétention J7 des invités comparée aux autres nouveaux joueurs. Hypothèse : un lien reçu d'un ami qu'on connaît convertit mieux qu'une page publique. Seuil de décision après 4 semaines : si `invitation_ouverte` / `invitation_partagee` est sous 0,3, ou `invitation_validee` / `invitation_ouverte` sous 0,1, on revoit le message et la place de l'entrée avant d'ajouter quoi que ce soit.

Hors périmètre absolu : tout ce qui touche à l'argent, au Premium, au juridique engageant. Aucune monnaie, aucun achat, aucune promesse d'argent. Le cadeau est cosmétique et ne se vend pas.

## 1. Parcours

**Celui qui invite (le parrain)**
1. Profil › Mes amis › en bas de page, une ligne discrète « Inviter un ami » (pas sur l'accueil : épure P1).
2. Elle ouvre un petit encart : une phrase (« Ton ami et toi recevez un cadeau quand il a joué sa première partie. »), le cadeau, un seul bouton principal « Partager mon lien ».
3. Le bouton ouvre le partage natif du téléphone (Web Share). Sans lui, le lien est copié, puis (si la copie échoue) affiché pour être copié à la main. Même mécanisme que « Partager Mochi Go » (#521).
4. L'encart montre ensuite « 1 ami sur 5 est arrivé » et les cadeaux reçus. Jamais qui : seulement un nombre.

**Celui qui reçoit (l'invité)**
1. Il ouvre `https://mochi-go.app/i#CODE` (`/en/i#CODE` en anglais). C'est une adresse valide : la page d'aperçu (Open Graph) est servie, puis `index.html` retire le code de l'adresse, le garde sur l'appareil et ouvre l'accueil. Rien à faire de plus : il joue tout de suite, sans compte (les 60 premières secondes menant à une première pierre ne changent pas).
2. Il joue, puis crée son compte quand l'appli le lui demande. Ses parties se synchronisent avec le compte.
3. Au premier envoi de ses parties (puis à chaque ouverture tant que le code est gardé), l'appli demande au serveur de valider l'invitation. Le serveur répond : validée, en attente, invalide, complet.
4. Validée : un message court « Ton cadeau est là : le goban Cerisier. » avec un bouton « Voir mon cadeau » vers Profil. Le code quitte l'appareil.

## 2. Récompense

| Qui | Quand | Cadeau |
|---|---|---|
| L'invité | invitation validée | goban **Cerisier** + badge **Invité** |
| Le parrain | 1er ami validé | goban **Cerisier** + badge **Parrain** |
| Le parrain | 3e ami validé | pierres **Jade** |

- Ce sont des cosmétiques qui existent déjà et se gagnent normalement aux niveaux 10 et 12 (`RECOMPENSES` de `src/app/xp.ts`). Aucun dessin nouveau.
- **Aucun XP.** L'économie de `docs/game-design/economie.md` (sources, courbe des niveaux, simulation à 30 jours) ne change pas. Le cadeau ne fait pas monter de niveau ; il ouvre seulement un décor. Le niveau 10 et le niveau 12 gardent donc leur sens pour qui les atteint (le décor est déjà à lui, la célébration du niveau reste).
- Plafond : **5 amis validés par parrain** à la fois (rang de 1 à 5 en base ; un ami dont le compte est supprimé libère sa place). Au-delà, le lien répond « complet » et personne ne reçoit rien. Les cadeaux du parrain s'arrêtent de toute façon au 3e.
- Une seule récompense par invité : clé primaire sur l'invité en base.

## 3. Anti-abus (tout est côté serveur)

| Risque | Parade |
|---|---|
| Deviner un code | 24 octets aléatoires (192 bits), 32 caractères base64url. Aucune fonction publique ne le renvoie ni ne le teste : `valider_invitation` exige un compte avec pseudo et ne dit pas pourquoi un code est invalide. Table fermée à l'appli (RLS sans politique). |
| Énumération | pas de page ni de fonction « ce code existe-t-il ? », pas de pseudo dans le lien, pas de liste des invités. |
| S'inviter soi-même | `invite_id <> parrain_id` (contrainte) et contrôle dans la fonction. |
| Deux comptes qui s'invitent l'un l'autre | refusé si le parrain a déjà été invité par l'invité. |
| Farm de comptes | pas de récompense à l'arrivée : seulement après une **vraie action** de l'invité, vérifiée en base : compte avec pseudo (pas une session anonyme), compte créé il y a moins de 30 jours (« nouveau joueur »), au moins une partie de 10 coups ou plus contre l'ordi ou guidée, synchronisée au compte. 10 coups, comme la règle d'XP (`sourceXpPartie`). |
| Récompenses en nombre | 5 amis validés au plus par parrain ; une récompense par invité ; cosmétiques seulement, sans valeur d'échange. |
| Appels simultanés | verrou sur la ligne du code du parrain : le plafond tient même avec deux validations en même temps. |
| Compte anonyme | refusé (JGC01), comme les autres fonctions de compte. |

Limite connue, assumée : une partie contre l'ordi est jouée sur l'appareil ; le serveur ne peut pas la rejouer. Il vérifie sa forme (SGF, 10 coups), pas sa réalité. Un tricheur motivé qui fabrique 5 comptes obtient un goban de décor. Le coût d'attaque (5 comptes avec pseudo) est supérieur au gain (nul). Si le détournement devient visible dans les chiffres, on exigera une partie en ligne finie (côté serveur) en plus.

## 4. Données et mineurs

- **Collectées** : le code du parrain (aléatoire, sans lien avec son identité), le couple (invité, parrain) avec la date de validation et le rang, les cadeaux (identifiant, origine, date). Rien d'autre : **pas d'e-mail, pas de téléphone, pas d'adresse IP**, pas de pseudo dans le lien.
- **Sur l'appareil de l'invité** : un repère `go.invitation.v1` (le code reçu et la date), effacé à la validation ou après 30 jours. À déclarer dans la politique de confidentialité (section des données locales).
- **Mineurs** : le parrain ne voit jamais qui est arrivé, seulement un nombre ; l'invité ne voit pas le pseudo du parrain (le lien n'en porte pas). Aucune donnée d'un enfant n'est exposée à l'autre.
- **Droits** : suppression du compte = cascade sur les trois tables ; « Mes données » (`exporter_mes_donnees`) inclut les invitations (nombre d'amis arrivés, date d'arrivée de l'invité, cadeaux), sans le code ni l'identité de l'autre.
- Pas de base légale nouvelle : traitement lié au service demandé (le joueur choisit de partager) et à l'intérêt légitime (éviter l'abus). À relire par le juridique avant la mise en production, sans engagement ici.

## 5. Mesure

Événements sobres, sans pseudo ni code (à déclarer dans `docs/data/plan-de-marquage.md` ; le test `analytics.test.ts` échoue sinon).

| Événement | Propriétés | Déclencheur | Indicateur |
|---|---|---|---|
| `invitation_partagee` | `methode` (`partage`, `copie`, `manuel`, `annule`) | « Partager mon lien » dans Mes amis | Parrains actifs par semaine ; taux de partage parmi les joueurs qui ouvrent « Mes amis » |
| `invitation_ouverte` | `nouveau` (premier lancement sur l'appareil) | Lien `/i#CODE` ouvert, une fois par appareil | Ouvertures par partage |
| `invitation_validee` | `rang` (1 à 5, rang de l'ami chez le parrain), `jours` (jours entre l'ouverture et la validation) | Réponse « validée » du serveur, côté invité | Conversion et délai ; rétention J7 des invités |

## 6. Technique

- **Serveur (PR 1)** : migration `20261026090000_invitations.sql`. Tables `invitation_codes`, `invitations`, `cadeaux` (RLS sur chacune). Fonctions `mon_invitation()` (code, amis arrivés, plafond, cadeaux) et `valider_invitation(code)`, toutes deux réservées aux comptes avec pseudo. `exporter_mes_donnees` complétée. Tests : `supabase/tests/invitations.test.sql`.
- **Client (PR 2)** : tout dans des morceaux à la demande (budget JS initial 149,9 / 150 Ko, CSS 20,36 / 22 Ko). Le lien est lu par le script en tête de `index.html` (zéro octet dans le JS initial). L'encart (`src/app/Invitation.tsx` et sa feuille de style) se charge quand on l'ouvre. La validation part de `src/data/partiesPerso.ts` (déjà à la demande) après la synchronisation des parties.
- **Adresses** : `/i` et `/en/i` ajoutées à `vercel.json` et à `outils/apercus.ts` (page d'aperçu, comme `/defi`). Le service worker n'a pas à changer : hors ligne, toute navigation reçoit la page de l'appli, et `index.html` fait le reste.
- **Navigation** : aucun nouvel écran de pile ; l'encart est une partie de « Mes amis » (`src/app/navigation.ts` inchangé).

## 7. Ce qu'on ne fait pas (volontairement)

- Pas de classement de parrains, pas de compteur public, pas de notification « ton ami est arrivé » (c'est le parrain qui regarde, quand il veut).
- Pas de cadeau qui change le jeu (aide, coups, adversaires). Que du décor.
- Pas de rappel pour inciter à inviter. L'entrée reste dans le Profil ; l'invitation des moments forts (#521) continue de proposer « Partager Mochi Go » avec la règle d'espacement existante.
