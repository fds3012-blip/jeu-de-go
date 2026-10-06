// Fichier généré par outils/leconsIndex.ts (`npm run index-lecons`) depuis content/lessons.fr.js : ne pas modifier à la main.
// Index léger des leçons (#16) : id, titre, description et nombre d’étapes, puis les chapitres. Le contenu complet
// (positions, démonstrations, consignes) reste dans content/lessons.fr.js, chargé avec les écrans qui l’affichent.
// prettier-ignore
export const LECONS_INDEX: readonly (readonly [id: string, titre: string, desc: string, etapes: number])[] = [
  ["l1", "Libertés et capture", "La règle qui fait tout le jeu", 6],
  ["l2", "Atari : attaquer et se sauver", "Quand il ne reste qu'une liberté", 6],
  ["l3", "Techniques de capture", "Double atari, bord et échelle", 8],
  ["l4", "Le ko", "La règle qui empêche de tourner en rond", 5],
  ["l5", "Vivre et mourir", "Les deux yeux", 5],
  ["l6", "Territoire et ouverture", "Compter et bien commencer", 6],
  ["l7", "Compter les points", "Fermer, passer, compter", 6],
  ["l8", "Les premiers coups", "Coins, puis bords, puis centre", 6],
  ["l9", "Le filet", "Enfermer une pierre sans la toucher", 3],
  ["l10", "La prise en retour", "Donner une pierre pour en prendre trois", 3],
  ["l11", "La course aux libertés", "Qui prend l’autre en premier", 3],
  ["l12", "Le faux œil", "Un œil qui ne compte pas", 5],
  ["l13", "Le point vital", "Le milieu décide", 6],
  ["l14", "Le seki", "Vivre ensemble, sans yeux", 5],
  ["l17", "Les formes d’yeux", "Le T, le carré, la grappe de cinq", 5],
  ["l15", "Finir la partie", "Dame, frontières, pierres mortes", 6],
  ["l16", "Compter une partie", "Mortes, territoire, prisonniers, komi", 6],
  ["l18", "Les bonnes formes", "Bouche du tigre et bambou", 5],
  ["l19", "Les pierres qui coupent", "Prends celles qui séparent tes groupes", 4],
  ["l20", "Relier et mourir", "Quand se relier ne sauve rien", 4],
];

// prettier-ignore
export const CHAPITRES_INDEX: readonly { id: string; titre: string; intro: string; fin?: string; complet: boolean; lecons: readonly string[] }[] = [
  { id: "c1", titre: "Les bases", intro: "Sept leçons courtes pour jouer ta première partie.", fin: "Tu connais les règles du go.", complet: true, lecons: ["l1","l2","l3","l4","l5","l6","l7"] },
  { id: "c2", titre: "Ouverture sur 9 × 9", intro: "Où poser tes premières pierres.", complet: false, lecons: ["l8"] },
  { id: "c3", titre: "Capturer et sauver", intro: "Des pièges pour prendre plus de pierres.", complet: false, lecons: ["l9","l10","l11"] },
  { id: "c4", titre: "Vie et mort", intro: "Quand un groupe vit, quand il meurt.", complet: false, lecons: ["l12","l13","l14","l17"] },
  { id: "c5", titre: "Fin de partie et comptage", intro: "Finir proprement, puis compter juste.", complet: false, lecons: ["l15","l16"] },
  { id: "c6", titre: "Formes et tesuji", intro: "Les bonnes formes et les coups malins du go.", complet: false, lecons: ["l18","l19","l20"] },
];
