---
name: mobile-pro-rules
description: Checklist before delivering a mobile app screen - icons, touch feedback, light and dark contrast, safe areas, layout and states. Use before shipping any screen of the PWA or Capacitor app, or when a screen "doesn't look professional" and the cause isn't obvious.
---

# Règles pro pour une app mobile

Checklist tirée de [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT, voir `LICENSE`). Le contenu complet est dans `pro-rules.md`. Seule la checklist est reprise, sans la base de données ni les scripts.

Utilisation :
- Lis `pro-rules.md` avant chaque livraison d'écran, puis coche chaque ligne de la « Pre-Delivery Checklist » sur des captures 390 × 844 en sombre et en clair.
- Le fichier renvoie à d'autres références de ui-ux-pro-max (`references/quick-reference.md` et d'autres) : ignore ces renvois, elles ne sont pas installées ici.
- Ce projet est une PWA en React. Les règles propres à React Native ou Flutter se transposent au web : `env(safe-area-inset-*)`, `:active` ou `pointerdown` pour le retour tactile, `navigator.vibrate` pour l'haptique.
- En cas de conflit, `CLAUDE.md` et `docs/design/v2/direction.md` priment.
