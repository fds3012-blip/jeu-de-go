// Catalogue français (issue #167) : langue source. Toute clé ajoutée ici doit exister dans en.ts (le typage l'impose).
// Variables : {nom}. Pluriels : objet { one, other } choisi par Intl.PluralRules avec la variable `n`.
// Vocabulaire du go : docs/localisation/glossaire.md.

export const fr = {
  // Barre de navigation du bas (#51)
  'nav.aria': 'Navigation principale',
  'nav.jouer': 'Jouer',
  'nav.apprendre': 'Apprendre',
  'nav.problemes': 'Problèmes',
  'nav.profil': 'Profil',

  // Profil (#50)
  'profil.aria': 'Ton profil',
  'profil.invite': 'Invité',
  'profil.inviteDetail': 'Sans compte, tout reste sur ce téléphone.',
  // Série sans compte (#161) : invitation au 3e jour de série.
  'serie.invitation': 'Crée un compte pour garder ta série.',
  'serie.creerCompte': 'Créer un compte',
  'profil.sansPseudo': 'Sans pseudo',
  'profil.cote': 'Cote {cote}',
  'profil.jours': { one: '{n} jour', other: '{n} jours' },
  'profil.serieAria': 'Série de {jours}',
  'profil.reglages': 'Réglages',
  'profil.theme': 'Thème',
  'profil.theme.sombre': 'Sombre',
  'profil.theme.clair': 'Clair',
  'profil.theme.auto': 'Auto',
  'profil.goban': 'Goban',
  'profil.gobanVerrou': '{nom}, débloqué au niveau {niveau}',
  'profil.gobanNiveau': 'Niv. {niveau}',
  'profil.confirmer': 'Confirmer au doigt',
  'profil.confirmerAide': 'Une seconde touche pose la pierre.',
  'profil.sons': 'Sons',
  'profil.celebrations': 'Célébrations',
  'profil.celebrationsAide': 'Confettis et carillon quand tu gagnes.',
  'profil.aide': 'Aide de Mochi',
  'profil.aide.auto': 'Débutants',
  'profil.aide.oui': 'Toujours',
  'profil.aide.non': 'Jamais',
  'profil.compte': 'Mon compte',
  'profil.seConnecter': 'Se connecter',
  'profil.conditions': 'Conditions et confidentialité',
  'profil.retour': 'Retour',
} as const;
