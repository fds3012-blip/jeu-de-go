# Search Console, Bing et aperçu des liens : la marche à suivre (#489)

Pour Florian, avant de partager mochi-go.app à grande échelle. Compte environ 20 minutes, plus l'attente DNS.

Indicateurs visés :
- **Search Console** : pages indexées (5 attendues), puis impressions et clics sur « apprendre le go », « règles du go », « learn go ». Ensuite, les ouvertures de l'app avec `utm_campaign` venant des pages de référencement (PostHog).
- **Aperçu des liens** : taux de clic sur les liens partagés, mesuré par les ouvertures de l'app venant de `/`, `/defi`, `/partie` et `/j/N`.

## Ce qui est déjà en place (dans le dépôt)

Le build génère tout, rien à faire à la main :

| Fichier servi | Contenu | Source |
|---|---|---|
| `https://mochi-go.app/robots.txt` | Tout est ouvert (`Allow: /`) et pointe vers le sitemap | `outils/referencement/pages.ts`, `robots()` |
| `https://mochi-go.app/sitemap.xml` | `/`, `/apprendre-le-go`, `/regles-du-go`, `/en/learn-go`, `/en/go-rules`, en URL absolues, avec `hreflang` fr / en / x-default | `sitemap()`, même fichier |
| Pages d'aperçu (`/en`, `/defi`, `/partie`, `/j/N`, `404.html`) | `noindex` : elles servent seulement à l'aperçu des liens, pas aux moteurs | `outils/apercus.ts` |

Tests : `outils/referencement/pages.test.ts` (sitemap, robots) et `e2e/apercu-partage.spec.ts` (balises de chaque page partageable).

Le dépôt ne contient aucun jeton de vérification, et il ne doit pas en contenir avant ton choix de méthode (étape 2).

## 1. Trouver où est géré le DNS de mochi-go.app

Le dépôt ne le dit pas. On sait seulement que le domaine a été acheté le 4 octobre 2026 (`docs/journal.md`) et que les enregistrements DNS de Resend (e-mails depuis `jeu@mochi-go.app`) ont déjà été ajoutés quelque part. **C'est là que tu ajouteras l'enregistrement de Google.**

Si tu ne t'en souviens plus :
1. Ouvre https://dns.google/resolve?name=mochi-go.app&type=NS dans ton navigateur.
2. Regarde les serveurs de noms (`"data"`) :
   - `ns1.vercel-dns.com`, `ns2.vercel-dns.com` : DNS chez **Vercel**. Va dans Vercel, onglet **Domains**, puis `mochi-go.app`, puis **DNS Records**.
   - Autre chose (ex. `…porkbun.com`, `…namecheap…`, `…cloudflare.com`, `…ovh.net`, `…googledomains…`) : DNS chez ce **registraire** ou chez Cloudflare. Connecte-toi chez lui, section DNS du domaine.

## 2. Vérifier le domaine dans Google Search Console

Méthode recommandée : une propriété **Domaine**. Elle couvre `https://`, `http://`, `www.` et tous les chemins en une fois, et elle reste valide même si le site change d'hébergeur.

1. Va sur https://search.google.com/search-console et connecte-toi avec le compte Google du projet.
2. **Ajouter une propriété**, puis colonne de gauche **Domaine**, puis tape `mochi-go.app` (sans `https://`), puis **Continuer**.
3. Google affiche un enregistrement TXT de la forme `google-site-verification=…`. Copie-le tel quel. N'invente rien : c'est la seule valeur valable, et elle est propre à ton compte.
4. Chez ton hébergeur DNS (étape 1), ajoute un enregistrement :
   - **Type** : `TXT`
   - **Nom / Host** : `@` (ou vide, ou `mochi-go.app`, selon l'interface ; chez Vercel, laisse le champ vide)
   - **Valeur** : la ligne copiée, `google-site-verification=…`
   - **TTL** : la valeur par défaut
   - Ne supprime pas les TXT existants (Resend, SPF `v=spf1…`) : un domaine peut avoir plusieurs TXT.
5. Reviens dans Search Console et clique **Valider**. Le plus souvent c'est immédiat. Sinon, réessaie dans une heure (jusqu'à 48 h au pire).
6. Garde l'enregistrement TXT pour toujours : s'il disparaît, la propriété n'est plus vérifiée.

### Si le DNS n'est pas accessible : propriété « Préfixe de l'URL »

À faire seulement si l'étape 4 est impossible. Cette méthode ne couvre que `https://mochi-go.app/`.
1. **Ajouter une propriété**, puis **Préfixe de l'URL**, puis `https://mochi-go.app/`.
2. Choisis l'une des deux méthodes et envoie-moi la valeur. Elle passe par une PR, comme le reste du code :
   - **Balise HTML** : `<meta name="google-site-verification" content="…" />`, à placer dans le `<head>` de `index.html`. Ce jeton est public, ce n'est pas un secret.
   - **Fichier HTML** : `googleXXXX.html`, à déposer tel quel dans `public/`. Il sera servi à `https://mochi-go.app/googleXXXX.html`.
3. Après le déploiement, clique **Valider**.

## 3. Soumettre le sitemap

1. Dans Search Console, choisis la propriété `mochi-go.app`, puis menu **Sitemaps**.
2. Dans « Ajouter un sitemap », tape `https://mochi-go.app/sitemap.xml`, puis **Envoyer**.
3. L'état doit passer à **Opération effectuée**, avec 5 URL détectées.
4. Pour aller plus vite sur les pages importantes : **Inspection de l'URL**, colle `https://mochi-go.app/apprendre-le-go`, puis **Demander une indexation**. Refais-le pour `/regles-du-go`, `/en/learn-go` et `/en/go-rules`.
5. Une à deux semaines plus tard, dans **Pages** : les 5 URL doivent être « Indexées ». Les pages `/defi`, `/partie`, `/j/…` et `/en` apparaîtront peut-être en « Exclue par la balise noindex » : c'est voulu.
6. Données structurées (WebApplication, FAQ) : contrôle-les une fois avec https://search.google.com/test/rich-results sur `/apprendre-le-go`. Aucune erreur ne doit apparaître.

## 4. Bing Webmaster Tools (Bing, DuckDuckGo, Ecosia, Copilot)

1. Va sur https://www.bing.com/webmasters et connecte-toi (un compte Google marche).
2. Choisis **Importer depuis Google Search Console**, autorise l'accès, coche `mochi-go.app`, puis **Importer**. Bing reprend la vérification et le sitemap : rien à ajouter au DNS.
3. Vérifie dans **Sitemaps** que `https://mochi-go.app/sitemap.xml` y est. Sinon, ajoute-le.
4. Facultatif : **IndexNow** n'est pas branché, et les 5 pages changent peu. Inutile pour le lancement.

Si l'import échoue, Bing propose aussi un CNAME DNS ou une balise `msvalidate.01`. Même règle que pour Google : la valeur vient de Bing, et la balise passe par une PR.

## 5. Vérifier l'aperçu des liens avant le grand partage

Les messageries gardent l'aperçu en cache plusieurs jours. Le premier partage doit donc être le bon.

1. Après le déploiement de #489, colle ces adresses dans les outils officiels :
   - Facebook et Messenger (WhatsApp lit les mêmes balises) : https://developers.facebook.com/tools/debug/. Clique **Récupérer à nouveau** pour vider leur cache.
   - LinkedIn : https://www.linkedin.com/post-inspector/
   - X : l'aperçu se voit dans la fenêtre de rédaction d'un post (sans le publier).
2. Adresses à tester : `https://mochi-go.app/`, `https://mochi-go.app/en`, `https://mochi-go.app/apprendre-le-go`, `https://mochi-go.app/defi`, `https://mochi-go.app/j/` suivi du numéro du jour.
3. Attendu : image avec Mochi et « Apprends le go en jouant » (pour `/`, `/en` et les pages de référencement), titre et description en entier, domaine `mochi-go.app`.
4. Dans WhatsApp, envoie d'abord le lien à toi-même (« Moi » ou un groupe test) pour voir la grande image. Si un vieil aperçu reste affiché, ajoute `?v=2` au lien. Cette adresse est neuve pour le cache, et elle mène à la même page.
