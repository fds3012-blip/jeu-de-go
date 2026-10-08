# KataGo : démarrage mesuré avant et après #475 (07/10)

## Ce qui change

- **Réseau servi par l'app** : `public/reseaux/g170-b6c96-s175395328-d26788732.f5d32604.bin.gz`, soit
  `https://mochi-go.app/reseaux/…` en production. L'empreinte SHA-256 (`f5d32604…`) est dans le nom : le fichier ne
  change jamais sous ce nom. vercel.json le sert avec `Cache-Control: public, max-age=31536000, immutable`.
- **Repli** : si notre copie ne répond pas (erreur HTTP, coupure, empreinte fausse), le moteur prend la copie du dépôt
  KataGo (`raw.githubusercontent.com`, l'ancienne adresse). Le fichier est rangé dans le cache sous notre adresse.
  Un joueur qui a déjà l'ancienne copie en cache ne retélécharge rien.
- **Empreinte vérifiée** à chaque téléchargement (fichier tel quel, ou décompressé en route par un serveur qui ajoute
  `Content-Encoding: gzip`, comme `vite preview`). Un portail Wi-Fi ou une copie abîmée est refusé.
- **Téléchargement en parallèle** du chargement de TensorFlow.js et du choix du backend (avant : l'un après l'autre).
- **Backend mémorisé** (`go.katago.backend.v1`, sur l'appareil) : le backend qui a marché est essayé d'abord la fois
  suivante. Valable 30 jours et pour le même navigateur. Effacé si KataGo ne démarre pas sur l'appareil.
- **Service worker** : le cache d'exécution (code de TensorFlow.js et du Worker KataGo) garde maintenant les fichiers
  les plus récemment utilisés. Avant, il gardait les plus récemment ajoutés : au fil des déploiements, TensorFlow.js
  (1,2 Mo) pouvait en sortir et se retélécharger. Le réseau reste dans le cache du moteur (`katago-reseaux-v1`).
- **Progression affichée** : « 2,1 / 3,8 Mo » dans la revue (sous « Mochi prépare KataGo ») et sur le bouton
  « Téléchargement de l'IA… » d'« Étudier une position ».
- **Préchargement discret** après la fin d'une partie, selon la règle ci-dessous.

## Règle des données mobiles

Le réseau (3,8 Mo) n'est téléchargé que :

1. sur une action du joueur : revue d'une partie, « Étudier une position » (bouton « Télécharger l'IA »), partie contre
   un adversaire qui joue avec KataGo (Bambou et au-dessus) ;
2. ou en préchargement, 3 s après la fin d'une partie, si **toutes** ces conditions sont vraies :
   - ce n'est pas la première partie lancée sur l'appareil (jamais au premier lancement) ;
   - le navigateur ne signale pas l'économie de données (`navigator.connection.saveData`) ;
   - il ne signale pas une connexion mobile (`connection.type === 'cellular'`) ni une connexion très lente (2g) ;
   - la page est visible, le réseau n'est pas déjà en cache et KataGo n'est pas déjà en route.

   Si le navigateur ne dit rien de la connexion (Safari, Firefox), le préchargement est permis. Une seule tentative
   par session. Le préchargement ne démarre pas KataGo : il met le fichier en cache et charge le code de
   TensorFlow.js (gardé par le service worker), sans toucher au GPU.

Code : `src/engine/katago/prechargement.ts` (règle, testée dans `prechargement.test.ts`), appel dans
`src/app/Game.tsx` (fin de partie).

## Mesure

`e2e/katago-mesure.spec.ts` (facultatif : `MESURE_KATAGO=1`). Chromium (Playwright), viewport 390 × 844, réseau
ralenti par le protocole DevTools : 1,6 Mbit/s, 150 ms de latence (« 4G lente »). Vrai réseau g170, vrai
TensorFlow.js (backend WebGL logiciel dans ce conteneur). La revue de la partie de #424 (9 × 9) ; on mesure le temps
entre l'ouverture de la revue et KataGo prêt (« Mochi prépare KataGo » disparaît), en vérifiant que KataGo a bien
démarré. « Avant » : build de `main` (ae5e3d0) avec le réseau servi par le même serveur
(`VITE_KATAGO_MODEL_URL=/models/…`), pour comparer à réseau égal. Deux passages de chaque.

| Situation | Avant | Après |
| --- | --- | --- |
| Première revue, rien en cache, ouverte juste après la partie | 22,7 s / 24,7 s | 24,1 s / 24,1 s |
| Plus tard, réseau et code en cache | 2,9 s / 4,0 s | 2,9 s / 3,4 s |
| Première revue **après le préchargement** de fin de partie | (pas de préchargement : 22,7 s / 24,7 s) | **4,8 s / 2,9 s** |

- Le préchargement lui-même dure 22,4 s / 21,1 s en fond sur ce réseau lent (environ 2 s en Wi-Fi à 20 Mbit/s).
  Si le joueur ouvre la revue avant la fin, le téléchargement en cours continue et la revue l'attend : jamais
  deux téléchargements.
- Première revue sans préchargement : pas de gain mesurable. Le temps est celui du téléchargement (5 Mo de réseau et
  de TensorFlow.js à 200 Ko/s) ; le faire en parallèle du choix du backend ne gagne que le temps de ce choix
  (≈ 0,2 s ici).
- Après le démarrage préchargé : backend 0,2 s, réseau lu du cache en 20 ms, lecture et préchauffage 2,8 à 4,4 s.
- Backend mémorisé : pas de gain mesurable dans Chromium (WebGL, déjà premier essayé ici). Le gain attendu est sur
  Safari récent, où WebGPU passe le petit calcul de contrôle puis échoue sur le vrai réseau (#424) : la fois
  suivante, WebGPU n'est plus chargé (287 Ko) ni essayé.

### Limites (iOS)

- Mesuré dans Chromium, pas dans Safari : Playwright n'a pas de WebKit dans ce conteneur, et aucun iPhone réel.
  Le préchauffage (compilation des shaders) et le backend choisi diffèrent sur iPhone.
- Safari n'expose pas `navigator.connection` : impossible de savoir si l'iPhone est en Wi-Fi ou en 4G. Le
  préchargement y est donc permis à partir de la 2e partie (règle « si détectable »).
- Safari efface le stockage d'un site non installé après 7 jours sans visite (ITP) : le réseau peut devoir être
  retéléchargé. L'app installée sur l'écran d'accueil n'est pas concernée.
- `DecompressionStream` (lecture du `.gz`) demande iOS 16.4 ou plus ; avant, KataGo reste indisponible et la revue
  le dit (repli sur le moteur simple, comme avant).
- À faire sur un vrai iPhone : ouvrir une revue sans cache puis avec, et noter le temps (procédure ci-dessus à la main).

## Hébergement et licence

- Taille : 3,8 Mo (3 827 339 octets), une seule fois dans le dépôt : un autre réseau aurait un autre nom. Raisonnable
  pour Git et pour Vercel (fichier statique, bien sous les limites). Supabase Storage n'est donc pas nécessaire.
- Licence : le fichier vient du dépôt KataGo (`cpp/tests/models/`), couvert par la licence du dépôt, de type MIT
  (« all OTHER content in this repo »). Copie de la licence : `public/reseaux/LICENSE-KataGo.txt`, servie à côté.
  La page de licence des réseaux de katagotraining.org n'a pas pu être consultée d'ici ; elle ne concerne pas ce
  fichier, publié dans le dépôt.
