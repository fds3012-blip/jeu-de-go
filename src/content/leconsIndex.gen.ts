// Fichier généré par outils/leconsIndex.ts (`npm run index-lecons`) depuis content/lessons.fr.js : ne pas modifier à la main.
// Index léger des leçons (#16) : id, titre, description et nombre d’étapes, puis les chapitres. Le contenu complet
// (positions, démonstrations, consignes) reste dans content/lessons.fr.js, chargé avec les écrans qui l’affichent.
// prettier-ignore
export const LECONS_INDEX: readonly (readonly [id: string, titre: string, desc: string, etapes: number, taille?: 13 | 19])[] = [
  ["l1", "Libertés et capture", "La règle qui fait tout le jeu", 6],
  ["l2", "Atari : attaquer et se sauver", "Quand il ne reste qu'une liberté", 6],
  ["l3", "Techniques de capture", "Double atari, bord et échelle", 8],
  ["l4", "Le ko", "La règle qui empêche de tourner en rond", 5],
  ["l5", "Vivre et mourir", "Les deux yeux", 5],
  ["l6", "Territoire et ouverture", "Compter et bien commencer", 6],
  ["l7", "Compter les points", "Fermer, passer, compter", 6],
  ["l8", "Les premiers coups", "Coins, puis bords, puis centre", 6],
  ["l27", "Attaquer et défendre", "La route du centre", 4],
  ["l29", "L’ouverture en 13 × 13", "Coins, puis bords, puis centre", 5, 13],
  ["l30", "Le san-san", "Quand Blanc entre sous ton hoshi", 4, 19],
  ["l31", "Le 3-4 et l’approche", "Le kakari et ses réponses", 4, 19],
  ["l9", "Le filet", "Enfermer une pierre sans la toucher", 3],
  ["l10", "La prise en retour", "Donner une pierre pour en prendre trois", 3],
  ["l11", "La course aux libertés", "Qui prend l’autre en premier", 3],
  ["l26", "La course avec un œil", "L’œil se remplit en dernier", 4],
  ["l12", "Le faux œil", "Un œil qui ne compte pas", 5],
  ["l13", "Le point vital", "Le milieu décide", 6],
  ["l14", "Le seki", "Vivre ensemble, sans yeux", 5],
  ["l17", "Les formes d’yeux", "Le T, le carré, la grappe de cinq", 5],
  ["l24", "Agrandir ou réduire", "Le point au bord de l’espace", 4],
  ["l25", "Les groupes du coin", "Le point du coin, et le ko", 4],
  ["l15", "Finir la partie", "Dame, frontières, pierres mortes", 6],
  ["l16", "Compter une partie", "Mortes, territoire, prisonniers, komi", 6],
  ["l22", "Sente et gote", "Le coup qui oblige à répondre", 5],
  ["l23", "Le hane au premier rang", "Contourner, puis relier", 4],
  ["l32", "La valeur d’un coup", "Compter ce que chacun gagne", 4],
  ["l33", "Le sente avant le gote", "Même petit, le sente passe d’abord", 5],
  ["l18", "Les bonnes formes", "Bouche du tigre et bambou", 5],
  ["l19", "Les pierres qui coupent", "Prends celles qui séparent tes groupes", 4],
  ["l20", "Relier et mourir", "Quand se relier ne sauve rien", 4],
  ["l21", "Le manque de libertés", "Quand relier met en atari", 4],
  ["l34", "Relier par en dessous", "Le watari, au premier rang", 4],
  ["l35", "Couper par en dessous", "Bloquer le premier rang", 4],
];

// prettier-ignore
export const CHAPITRES_INDEX: readonly { id: string; titre: string; intro: string; fin?: string; complet: boolean; lecons: readonly string[] }[] = [
  { id: "c1", titre: "Les bases", intro: "Sept leçons courtes pour jouer ta première partie.", fin: "Tu connais les règles du go.", complet: true, lecons: ["l1","l2","l3","l4","l5","l6","l7"] },
  { id: "c2", titre: "L’ouverture", intro: "Où poser tes premières pierres.", complet: false, lecons: ["l8","l27","l29","l30","l31"] },
  { id: "c3", titre: "Capturer et sauver", intro: "Des pièges pour prendre plus de pierres.", complet: false, lecons: ["l9","l10","l11","l26"] },
  { id: "c4", titre: "Vie et mort", intro: "Quand un groupe vit, quand il meurt.", complet: false, lecons: ["l12","l13","l14","l17","l24","l25"] },
  { id: "c5", titre: "Fin de partie et comptage", intro: "Finir proprement, puis compter juste.", complet: false, lecons: ["l15","l16","l22","l23","l32","l33"] },
  { id: "c6", titre: "Formes et tesuji", intro: "Les bonnes formes et les coups malins du go.", complet: false, lecons: ["l18","l19","l20","l21","l34","l35"] },
];
