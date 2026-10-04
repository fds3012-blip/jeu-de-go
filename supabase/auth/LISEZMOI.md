# Réglages de connexion Supabase (#414)

Ces fichiers sont la source des réglages d'authentification de la production (projet `xjvsalkvpgcjrznznxoi`) :

- `reglages.json` : adresse du site, adresses de retour autorisées, code à 6 chiffres valable 1 h, 100 e-mails par heure, expéditeur `jeu@mochi-go.app` (« Mochi Go »), objets des e-mails ;
- `modeles/*.html` : contenu des e-mails (connexion, création de compte, changement d'adresse).

**Pour changer un réglage** : modifie ces fichiers dans une PR. Le workflow `.github/workflows/config-auth.yml` compare à la production sur la PR (noms des clés seulement), puis applique et vérifie à la fusion sur `main`. Vérification locale : `node scripts/config-auth.mjs verifier`.

**Jamais ici** : mot de passe SMTP (clé Resend), secrets Google, Facebook ou Apple. Ils restent dans le tableau de bord Supabase ; le script refuse toute clé qui ressemble à un secret.

Secret GitHub requis : `SUPABASE_ACCESS_TOKEN` (jeton Supabase limité au projet, permission Auth en lecture et écriture).
