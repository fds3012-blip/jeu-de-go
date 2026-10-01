# Connexion par code à 6 chiffres : réglages Supabase (#343)

Pour Florian. Durée : environ 15 minutes. Coût : 0 €. Tout se fait dans le tableau de bord Supabase du projet `jeu-de-go` (réf. `xjvsalkvpgcjrznznxoi`).

## Pourquoi

Constat du 30/09 : un ami ouvre le lien du jeu dans Messenger ou WhatsApp. Le jeu s'ouvre dans le navigateur intégré de l'app de messagerie. Il demande son lien de connexion, puis touche le lien dans son e-mail : le lien s'ouvre **dans un autre navigateur** (Safari, Chrome, Gmail). La session s'ouvre là-bas, pas dans le jeu. Il reste déconnecté.

Avec un **code à 6 chiffres**, le joueur lit le code dans son e-mail et le tape **dans le jeu**. La session s'ouvre là où il joue, quel que soit le navigateur. Le lien reste dans l'e-mail, comme second moyen.

Ce que fait l'app (déjà codé) :

| Moment | Appel | Type du code |
|---|---|---|
| Créer son compte ou se connecter | `signInWithOtp({ email })` puis `verifyOtp({ email, token, type: 'email' })` | `email` |
| Ancienne session sans compte (défi en cours) qui ajoute son e-mail | `updateUser({ email })` puis `verifyOtp({ email, token, type: 'email_change' })` | `email_change` |

Tant que les modèles d'e-mail ne contiennent pas `{{ .Token }}`, les joueurs ne reçoivent pas de code : seul le lien marche. **L'étape 2 est donc indispensable.**

## Étape 1. Longueur et durée du code

1. Ouvre **Authentication**, puis **Sign In / Providers**, puis **Email**.
2. Vérifie que **Enable Email provider** est activé, et **Confirm email** aussi.
3. **Email OTP Length** : mets **6** (l'app attend exactement 6 chiffres).
4. **Email OTP Expiration** : **3600** secondes (1 heure). C'est ce que dit l'e-mail ci-dessous.
5. Clique **Save**.

## Étape 2. Les trois modèles d'e-mail, en français

Ouvre **Authentication**, puis **Emails**, onglet **Templates**. Il y a trois modèles à changer. Pour chacun : remplace l'objet (**Subject**) et le contenu (**Message body**, onglet **Source**), puis **Save changes**.

Le code est dans l'objet : il se lit dans la notification, sans ouvrir l'e-mail.

### 2.1 Magic Link (connexion d'un compte qui existe déjà)

Objet :

```
{{ .Token }} est ton code pour jouer au go
```

Contenu :

```html
<h2>Ton code pour jouer au go</h2>
<p>Tape ce code dans le jeu :</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:16px 0">{{ .Token }}</p>
<p>Il marche pendant 1 heure.</p>
<p>Tu peux aussi <a href="{{ .ConfirmationURL }}">te connecter avec ce lien</a>, sur le téléphone où tu joues.</p>
<p style="color:#777">Tu n’as rien demandé ? Ignore cet e-mail : personne ne peut se connecter sans ce code.</p>
```

### 2.2 Confirm signup (premier e-mail d'un nouveau joueur)

Objet :

```
{{ .Token }} est ton code pour créer ton compte
```

Contenu :

```html
<h2>Bienvenue !</h2>
<p>Tape ce code dans le jeu pour créer ton compte :</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:16px 0">{{ .Token }}</p>
<p>Il marche pendant 1 heure. Ensuite, tu choisis ton pseudo.</p>
<p>Tu peux aussi <a href="{{ .ConfirmationURL }}">créer ton compte avec ce lien</a>, sur le téléphone où tu joues.</p>
<p style="color:#777">Tu n’as rien demandé ? Ignore cet e-mail : aucun compte n’est créé sans ce code.</p>
```

### 2.3 Change Email Address (ancienne partie sans compte qui ajoute son e-mail)

Objet :

```
{{ .Token }} est ton code pour garder ta partie
```

Contenu :

```html
<h2>Garde ta partie</h2>
<p>Tape ce code dans le jeu pour relier ton e-mail à ta partie :</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:16px 0">{{ .Token }}</p>
<p>Il marche pendant 1 heure. Ta partie continue au même endroit.</p>
<p>Tu peux aussi <a href="{{ .ConfirmationURL }}">confirmer avec ce lien</a>, sur le téléphone où tu joues.</p>
<p style="color:#777">Tu n’as rien demandé ? Ignore cet e-mail.</p>
```

Les autres modèles (Invite user, Reset Password, Reauthentication) ne servent pas : ne les change pas.

## Étape 3. Adresses de retour (pour le lien)

**Authentication**, puis **URL Configuration** :

- **Site URL** : l'adresse de production du jeu (celle de Vercel).
- **Redirect URLs** : garde l'adresse de production. Rien à ajouter pour le code.

## Étape 4. Envoi des e-mails (gratuit)

**Authentication**, puis **Emails**, onglet **SMTP Settings**.

- Si **Enable Custom SMTP** est déjà activé et que les joueurs reçoivent déjà leurs e-mails, ne change rien.
- Sinon : le service d'e-mail intégré de Supabase est très limité (quelques e-mails par heure, et seulement vers les adresses de l'équipe du projet). Il faut un SMTP. Deux offres **gratuites**, sans carte bancaire, suffisent au lancement :
  - **Brevo** (Paris) : 300 e-mails par jour gratuits. Serveur `smtp-relay.brevo.com`, port `587`.
  - **Resend** : 3 000 e-mails par mois, 100 par jour gratuits. Serveur `smtp.resend.com`, port `465`.

  Crée le compte, vérifie le nom de domaine (enregistrements DNS donnés par le service), puis colle l'hôte, le port, l'identifiant et le mot de passe SMTP dans Supabase. Expéditeur : `jeu@<ton-domaine>`, nom : `Jeu de go`.
- Ensuite, **Authentication**, puis **Rate Limits** : **Rate limit for sending emails** à 100 par heure (le défaut est bas). Laisse les autres limites.

Ne mets jamais le mot de passe SMTP dans le dépôt : il ne va que dans Supabase.

## Étape 5. Sessions anonymes (après le déploiement de l'app)

Depuis #343, l'app n'ouvre plus de session anonyme : il faut un compte avec un pseudo pour créer ou rejoindre un défi. Les parties déjà commencées sans compte (ta partie en cours, par exemple) continuent : le joueur ajoute son e-mail (code, étape 2.3), puis choisit son pseudo.

Quand la nouvelle version est en ligne (et la migration serveur de l'agent backend appliquée) : **Authentication**, **Sign In / Providers**, **Allow anonymous sign-ins** peut être désactivé. Les sessions anonymes déjà ouvertes restent valides jusqu'à leur liaison ou leur purge (migration `purge_anonymes`). À vérifier sur ta partie en cours avant de désactiver : si elle se bloque, réactive le réglage.

## Étape 6. Vérifier (5 minutes)

1. Sur ton téléphone, envoie-toi l'adresse du jeu dans WhatsApp ou Messenger, et ouvre-la **depuis l'app de messagerie**.
2. Joue 3 parties contre l'ordi (ou ouvre la leçon 4) : l'écran « Crée ton compte » s'ouvre.
3. Entre une adresse qui n'a pas de compte, touche **Recevoir mon code**.
4. L'e-mail arrive, avec le code dans l'objet. Tape le code dans le jeu (sur iPhone, le clavier le propose souvent tout seul).
5. L'écran **Choisis ton pseudo** s'ouvre. Choisis-le : la partie demandée démarre.
6. Recommence avec une adresse qui a déjà un compte : pas d'écran de pseudo, tu retrouves ton compte.

Si le code est refusé : vérifie l'étape 1 (6 chiffres) et que tu tapes le code du **dernier** e-mail reçu.
