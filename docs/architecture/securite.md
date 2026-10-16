# Sécurité avant l'ouverture au public (#531, chantier C7)

Trois protections : modération côté serveur, en-têtes de sécurité, captcha prêt. Aucun secret dans le dépôt.

## 1. Modération (migration `20261014001100_moderation.sql`)

À appliquer à la main, après relecture (elle n'est pas appliquée par la CI). Elle ne redéfinit aucune fonction d'un autre chantier : tout passe par des déclencheurs et des fonctions nouvelles, `security definer` à `search_path` vide. Aucune donnée existante n'est supprimée ni modifiée. Tests : `bash supabase/tests/lancer.sh` (`moderation.test.sql`).

### Pseudos interdits (D8)

- Table `mots_interdits` (FR et EN : insultes, haine, sexe, usurpation de l'équipe ou de Mochi). Déclencheur sur `profiles.username` : refus `JGP02` (« Ce pseudo n'est pas accepté. Choisis-en un autre, sans gros mot ni nom de l'équipe. »), pour le joueur comme pour l'équipe.
- Comparaison après normalisation : minuscules, coupure aux majuscules et aux chiffres, chiffres qui imitent des lettres (`c0nnard`), lettres répétées (`connnnard`, `fuuuck`). Trois portées pour éviter les faux positifs : `partout` (mots longs et sans ambiguïté, même collés), `mot` (seul entre séparateurs : « Le_Con » refusé, « Falcon », « Conan » acceptés), `exact` (le pseudo entier : « Mochi », « Admin »). Une soixantaine de noms courants sont vérifiés acceptés par le test (Scunthorpe, Dickens, Matsushita, Therapist, Nigeria, Badminton…).
- `pseudo_autorise(pseudo)` : l'écran du pseudo l'appelle pendant la saisie (refus dit tout de suite) ; le déclencheur reste la seule garantie.
- Ajouter un mot : une nouvelle migration `insert into public.mots_interdits (mot, portee, categorie) values (…) on conflict do nothing;`.
- Pseudos déjà pris avant la règle : jamais touchés d'office. Vue `pseudos_a_revoir`.

### Suspendre, lever, renommer (éditeur SQL de Supabase, ou rôle de service)

```sql
select public.suspendre_joueur('Pseudo', 7, 'Insultes répétées en partie');  -- 1 à 3650 jours, null = sans fin
select public.lever_suspension('Pseudo');
select public.renommer_pseudo('Ancien', 'Nouveau');                          -- null : « Joueur-xxxxxx »
select * from public.suspensions_en_cours;
select * from public.moderation_a_faire;   -- nombres : signalements nouveaux, joueurs à revoir, pseudos, suspensions
```

- Pendant la suspension, le serveur refuse avec `JGU01` : file du direct, file lente, créer ou rejoindre un défi, défier un ami, demander un ami, message en partie. Le joueur lit « Ton compte est suspendu : rien en ligne pour l'instant. L'ordi, les leçons et les problèmes restent ouverts. » L'autre joueur lit le refus habituel « Ce joueur n'est pas disponible » (`JGB01`) : rien n'est dit de la suspension d'un autre.
- Suspendre retire le joueur des files d'attente. Ses parties déjà commencées se finissent normalement.
- Les déclencheurs ne refusent qu'au nom du joueur connecté : une tâche planifiée ou `game-action` (sans session) n'est jamais arrêtée par un compte suspendu.
- Journal `journal_moderation` (suspendre, lever, renommer, avec l'auteur `session_user`), gardé 12 mois, comme les résumés et les suspensions finies (tâche `purger-moderation`).

### Tables « RLS sans politique » (avis Supabase)

`mots_interdits`, `suspensions`, `journal_moderation`, `alertes_moderation` ont la RLS active et **aucune politique, volontairement** : l'app n'y lit ni n'y écrit rien, seules les fonctions `security definer` y accèdent. Même règle pour les tables déjà signalées par les avis (journal des demandes d'ami, compteurs, etc.) : l'avis « RLS enabled, no policy » est attendu.

## 2. Alerte à l'équipe (Resend)

Fonction `supabase/functions/alerte-signalements` : chaque matin, si du nouveau est arrivé, un e-mail avec des **nombres seulement** (signalements par type, joueurs signalés par au moins deux comptes, pseudos à revoir) et un lien vers Supabase. Jamais le texte d'un signalement ni un pseudo.

**À faire par Florian (10 minutes)** :

1. Resend → API Keys → **Create API Key**, permission « Sending access », domaine `mochi-go.app`. Ne la colle nulle part ailleurs qu'à l'étape 2.
2. Supabase → Edge Functions → Secrets : `RESEND_API_KEY` (la clé), `ALERTE_EMAIL` (l'adresse de l'équipe), `ALERTE_SECRET` (32 caractères au hasard, par exemple `openssl rand -hex 24`).
3. Déployer la fonction : automatique à la fusion (workflow, fichier `.sans-jwt` → `--no-verify-jwt`), ou `supabase functions deploy alerte-signalements --project-ref xjvsalkvpgcjrznznxoi --no-verify-jwt`.
4. Éditeur SQL : créer les deux secrets Vault indiqués en tête de `supabase/planification/alerte-signalements.sql`, puis lancer ce fichier (tâche à 5 h 55 UTC).
5. Essai : lancer seule la requête `net.http_post` du fichier ; réponse `{"ok":true,…}` dans `net._http_response`.

Sans ces étapes, rien ne casse : la vue `moderation_a_faire` suffit à l'équipe.

## 3. En-têtes de sécurité (`vercel.json`)

Règle `/(.*)`, appliquée à toutes les réponses (pages, Workers de KataGo, service worker) :

| En-tête | Valeur |
|---|---|
| `Content-Security-Policy` | **bloquante** ; `default-src 'self'`, `connect-src` : Supabase (`https` et `wss`, projet `xjvsalkvpgcjrznznxoi`), PostHog (`eu.i.posthog.com`), Sentry (`*.ingest.de.sentry.io`, `*.ingest.sentry.io`), `raw.githubusercontent.com` (repli du réseau KataGo), `online-go.com` (import OGS) ; `script-src` et `frame-src` : `challenges.cloudflare.com` (Turnstile) ; `worker-src 'self' blob:` ; `'wasm-unsafe-eval'` (TensorFlow.js) ; `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. Pas de Google Fonts : les polices sont servies par l'app. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` (2 ans) |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | caméra, micro, position, paiement, USB, capteurs, `browsing-topics` coupés |

**Scripts en ligne** : l'en-tête est fixe, il ne peut pas connaître leurs empreintes ; il les permet (`'unsafe-inline'`). Le plugin `outils/csp.ts` ajoute au build, en tête de chaque page de `dist/`, une balise `<meta http-equiv="Content-Security-Policy">` avec l'empreinte SHA-256 de chacun de ses scripts en ligne. Les deux politiques s'appliquent ensemble : un script en ligne ne s'exécute que si son empreinte est connue. Les empreintes suivent le code à chaque build, rien à tenir à jour.

**Tests** : `vite preview` sert les mêmes en-têtes (hôtes simulés des tests ajoutés à `connect-src`, en préversion seulement) : **toute la suite e2e tourne sous la politique**. `e2e/csp.spec.ts` guette toute violation (événement `securitypolicyviolation` et console, Workers compris) sur l'accueil, la partie contre l'ordi, les leçons, les problèmes, le profil, l'anglais, les liens courts, les aperçus, les pages de référencement (démo jouée), le compte et le direct (Supabase simulé, temps réel), et la revue avec le **vrai KataGo** (réseau et TensorFlow.js dans le Worker). Un test témoin vérifie que le guet voit bien une violation. `outils/csp.test.ts` vérifie que les hôtes de `.env.example` sont permis et qu'un autre ne l'est pas.

**Si un service change d'adresse** (autre projet Supabase, PostHog derrière un proxy, autre région Sentry, `VITE_KATAGO_MODEL_URL` absolue), ajoute l'hôte à `connect-src` dans `vercel.json`, sinon l'appel est bloqué. **En cas de problème en production**, repli immédiat sans tout perdre : renommer la clé `Content-Security-Policy` en `Content-Security-Policy-Report-Only` (la politique est alors seulement signalée dans la console), corriger, puis revenir en bloquant.

**Barre d'outils Vercel** (commentaires sur les préversions) : elle charge des scripts de `vercel.live`, bloqués par la CSP. Les préversions marchent ; seule la barre manque. Pour la garder : ajouter `https://vercel.live` à `script-src`, `connect-src`, `frame-src` et `img-src` (déconseillé en production), ou la désactiver (Vercel → Settings → General → Vercel Toolbar).

## 4. Captcha Cloudflare Turnstile

Devant l'envoi du code de connexion par e-mail (création de compte et connexion), seulement si `VITE_TURNSTILE_SITE_KEY` existe. Sans clé : aucun script de Cloudflare, aucun changement. Widget invisible le plus souvent (« interaction-only »), thème de l'appareil, langue de l'interface ; un nouveau jeton à chaque envoi. Phrases : « Vérification anti-robot en cours. Réessaie dans un instant. » et « La vérification anti-robot n'a pas marché. Recharge la page, puis réessaie. » Code : `src/data/turnstile.ts`, `src/ui/Captcha.tsx`, `src/app/Connexion.tsx`. Tests : `e2e/turnstile.spec.ts` (faux Turnstile, jeton envoyé, renouvelé, refus du serveur, sans violation CSP).

**À faire par Florian, dans cet ordre** (l'inverse bloquerait toutes les connexions par e-mail) :

1. Cloudflare → Turnstile → **Add widget** (gratuit) : nom « Mochi Go », domaines `mochi-go.app`, `www.mochi-go.app`, `jeu-de-go.vercel.app` (et `localhost` pour essayer), mode **Managed**. Note la **Site Key** (publique) et la **Secret Key**.
2. Vercel → Settings → Environment Variables : `VITE_TURNSTILE_SITE_KEY` = la Site Key (Production et Preview), type « Plain text ». Redéploie, puis vérifie que le widget apparaît sur « Crée ton compte » (la connexion marche toujours : Supabase ne vérifie rien encore).
3. **Avant d'activer** : ajouter Cloudflare (Turnstile, sous-traitant, États-Unis, clauses types) à la politique de confidentialité, section des sous-traitants (périmètre de l'agent juridique, chantier C4).
4. Supabase → Authentication → Attack Protection → **Enable Captcha protection** → Turnstile → coller la **Secret Key** → Save. Elle ne va jamais dans le dépôt.
5. Essai : créer un compte avec une nouvelle adresse. En cas d'erreur « robot check », désactiver la protection dans Supabase (étape 4) le temps de vérifier la Site Key.

Note : avec la protection active, Supabase exige aussi un jeton pour toute nouvelle session anonyme ; l'app n'en crée plus depuis #343, rien ne change.

## 5. Connexions anonymes (M16, décision D3) : non coupées

**Rien n'a été changé** : couper les connexions anonymes est irréversible pour les sessions en cours (défis commencés avec une session sans compte), et la décision revient à Florian. L'app n'en crée plus depuis #343 ; les dernières sont effacées 60 jours après leur dernière activité (`purger_anonymes_inactifs`).

Quand Florian le décide : Supabase → Authentication → Sign In / Providers → **Allow anonymous sign-ins** : désactivé. Effet : plus aucune nouvelle session anonyme (aucune n'est demandée par l'app) ; les sessions en cours restent valides jusqu'à expiration de leur jeton de rafraîchissement, puis ne peuvent plus être renouvelées : leurs défis en cours sont perdus pour ces joueurs. Pour limiter la perte, attendre que `select count(*) from auth.users where is_anonymous and last_sign_in_at > now() - interval '60 days'` soit proche de zéro.

## 6. Titres mensuels (#561, migration `20261016150000_titres_mensuels.sql`)

À appliquer à la main, après relecture. Rien n'est modifié ni supprimé dans les tables existantes.

- `calculer_titres_mensuels(p_mois)` : `security definer`, `search_path` vide, **fermée à l'app** (anon et authenticated) ; seuls pg_cron (tâche `titres-mensuels`, le 1er du mois à 1 h 17 UTC, programmée seulement si pg_cron existe) et la clé service l'appellent. Elle lit `rating_history` (écrite par `apply_game_rating` seule) : le client ne peut pas fabriquer de parties pour se titrer.
- `titres_joueurs` : RLS, une politique de lecture « Chacun lit ses titres », aucune écriture pour l'app. `titres_mois` : table d'équipe, RLS sans politique (avis Supabase voulu, comme `retours`).
- `titres_du_joueur(p_profile_id)` : pour le profil public (#560). `authenticated` seulement, compte avec pseudo exigé (JGC01, JGP01), mois publiés seulement, rien en cas de blocage dans un sens ou dans l'autre (`est_bloque`), ni cote ni rang. Aucun droit pour anon.
- Garde-fou : sous 200 joueurs actifs, aucune ligne dans `titres_joueurs` : rien à lire, rien à afficher.
- Après application : relancer l'audit de sécurité Supabase (advisors) ; attendu : deux avis « RLS sans politique » connus (`titres_mois` et les tables d'équipe existantes).
