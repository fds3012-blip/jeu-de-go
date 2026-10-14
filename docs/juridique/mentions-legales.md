# Mentions légales (issue #530)

Texte unique : `src/content/mentionsLegales.ts` (français et anglais). Il sert à l'écran de l'app (Profil › Conditions et confidentialité › « Mentions légales », Mes données, Aide › Questions) et aux pages statiques `/mentions-legales/` et `/en/legal-notice/` (pied des pages de référencement).

Base : article 6 III de la loi n° 2004-575 du 21 juin 2004 (LCEN). Relecture par l'avocat ou le DPO avec la politique de confidentialité.

## Pour Florian : champs à compléter

Aucune identité, adresse ni aucun numéro n'a été inventé. Chaque champ ci-dessous s'affiche surligné « À compléter » dans l'app et sur la page ; la page statique reste hors index (`noindex`) tant qu'il en reste un. Pour remplir un champ : remplacer `{{…}}` par la valeur, en français **et** en anglais (un test vérifie la parité).

1. Éditeur : nom et prénom (personne physique) ou raison sociale et forme juridique (société).
2. Adresse postale de l'éditeur.
3. SIREN ou RCS, le cas échéant ; capital social si société ; numéro de TVA intracommunautaire le cas échéant.
4. Adresse e-mail de contact (la même que dans la politique de confidentialité).
5. Numéro de téléphone (exigé par la LCEN ; une personne physique non professionnelle peut, à la place, rester anonyme en donnant à l'hébergeur ses coordonnées : à voir avec l'avocat).
6. Directeur de la publication : nom et prénom.
7. Adresse et téléphone de Vercel Inc. et de Supabase Inc., tels qu'ils figurent dans les contrats (DPA) : non recopiés de mémoire.
8. DPO : nom et contact, ou « aucun DPO désigné ».
9. Date de mise à jour.

Déjà renseigné (vérifiable) : hébergeurs Vercel Inc. (site, réseau mondial) et Supabase Inc. (base de données, Union européenne, Paris, région AWS `eu-west-3`), d'après la section 4 de la politique de confidentialité ; crédits KataGo et web-katrain ; droits réservés (fichier `LICENSE`).

## Adresses

Les pages sont écrites dans `dist/mentions-legales/index.html` et `dist/en/legal-notice/index.html` et liées avec la barre finale (`/mentions-legales/`) : servies telles quelles, sans réécriture dans `vercel.json` (fichier de C7 pendant la vague 1). Une réécriture sans barre finale pourra être ajoutée plus tard.
