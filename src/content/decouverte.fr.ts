// Textes français de la partie de découverte (#524). Clés : identifiant du moment (src/content/decouverte.ts), puis
// `.bravo` (après le bon coup) et `.non` / `.non.<coup>` (erreur). Phrases courtes, tutoiement, un mot du go expliqué
// la première fois qu'il sert. Chaque nombre et chaque affirmation est vérifié par src/content/decouverte.test.ts.
export const DECOUVERTE_FR = {
  // Écran.
  'ecran.titre': 'Partie de découverte',
  'ecran.quitter': 'Quitter la partie de découverte',
  'ecran.notions': '{n} / {total} notions',
  'ecran.continuer': 'Continuer',
  'ecran.passer': 'Passer',
  'ecran.compter': 'Voir le résultat',
  'ecran.reprise': 'On reprend là où tu t’étais arrêté.',
  'ecran.repere': 'Point marqué : {point}',
  'fin.titre': 'Victoire !',
  'fin.texte': 'Tu as joué ta première partie de go, du premier coup au comptage. Les 15 notions sont à toi.',
  'fin.continuer': 'Continuer',
  // Refus du moteur pendant un coup.
  'refus.ko': 'Pas encore : c’est le ko. Joue d’abord ailleurs.',
  'refus.suicide': 'Interdit : ta pierre n’aurait aucune liberté.',
  // Noms des notions (en-tête).
  'notion.poser': 'Poser une pierre',
  'notion.libertes': 'Les libertés',
  'notion.atari': 'L’atari',
  'notion.capture': 'Capturer',
  'notion.sauver': 'Se sauver',
  'notion.couper': 'Couper',
  'notion.echelle': 'L’échelle',
  'notion.relier': 'Relier',
  'notion.territoire': 'Le territoire',
  'notion.ko': 'Le ko',
  'notion.yeux': 'Deux yeux',
  'notion.frontiere': 'Les frontières',
  'notion.mort': 'Un groupe mort',
  'notion.passer': 'Passer',
  'notion.comptage': 'Compter',
  // 1. Poser une pierre.
  'poser': 'Tu as Noir, tu commences. Pose ta pierre là où deux lignes se croisent : touche le point marqué.',
  'poser.bravo': 'Bien posée ! Une pierre posée ne bouge plus.',
  'poser.non': 'Pour cette partie, pose ta pierre au point marqué, au centre.',
  // 2. Libertés.
  'libertes': 'Ma pierre touche la tienne. Les points verts sont ses libertés : elle en a 3. Joue sur le point marqué.',
  'libertes.bravo': 'Tu lui as pris une liberté : il ne lui en reste que 2.',
  'libertes.non': 'Ce point ne touche pas ma pierre. Joue sur le point marqué.',
  'libertes.non.C5': 'Bien vu, c’est aussi une de ses libertés. Pour cette partie, joue sur le point marqué.',
  'libertes.non.D4': 'Bien vu, c’est aussi une de ses libertés. Pour cette partie, joue sur le point marqué.',
  // 3. Atari.
  'atari': 'Je joue ailleurs, à droite. Prends encore une liberté à ma pierre : il ne lui en restera qu’une. C’est l’atari.',
  'atari.bravo': 'Atari ! Ma pierre n’a plus qu’une liberté.',
  'atari.non': 'Ce point ne touche pas ma pierre. Joue sur le point marqué.',
  'atari.non.C5': 'Ça la met aussi en atari ! Pour cette partie, joue sur le point marqué.',
  // 4. Capturer.
  'capture': 'Je pourrais la sauver en jouant sur sa dernière liberté. Je joue ailleurs. Prends-la : joue sur cette liberté.',
  'capture.bravo': 'Capturée ! Elle sort du plateau : c’est ton prisonnier, 1 point pour toi à la fin.',
  'capture.non': 'Ma pierre a encore sa liberté. Joue dessus pour la capturer : c’est le point marqué.',
  // 5. Se sauver.
  'sauver': 'Je m’approche de ta pierre. Glisse une pierre entre mes deux pierres marquées, sur le point marqué.',
  'sauver.non': 'Pour cette partie, joue sur le point marqué, entre mes deux pierres.',
  'sauver2': 'Atari sur ta pierre : il ne lui reste qu’une liberté. Sauve-la : allonge-toi sur cette liberté.',
  'sauver2.bravo': 'Sauvée ! Tes deux pierres se touchent : ensemble, elles ont 3 libertés.',
  'sauver2.non': 'Ta pierre est toujours en atari : je la capturerais au coup suivant. Allonge-toi sur sa liberté.',
  // 6. Couper.
  'couper': 'Mes deux pierres marquées se touchent par un coin. Un seul point libre touche les deux : prends-le, tu les coupes.',
  'couper.bravo': 'Coupées ! Et ma pierre du haut est en atari.',
  'couper.non': 'Pour les couper, prends le seul point libre qui touche mes deux pierres.',
  'couper.non.F6': 'Atari aussi, mais je joue sur le point marqué : ma pierre touche l’autre, et ensemble elles ont 5 libertés.',
  // 7. Échelle.
  'echelle': 'Je m’allonge : j’ai 2 libertés. Remets-moi en atari sur le point marqué, pour me pousser contre tes pierres.',
  'echelle.non': 'Pour cette partie, remets-moi en atari sur le point marqué.',
  'echelle.non.E6': 'Atari aussi, mais je m’allonge vers le haut et j’ai 3 libertés : je m’échappe.',
  'echelle2': 'Je m’allonge… toujours une seule liberté. Tu me poursuis en zigzag : c’est l’échelle. Capture mes pierres !',
  'echelle2.bravo': '3 pierres capturées ! Tu as maintenant 4 prisonniers.',
  'echelle2.non': 'Mes pierres ont encore une liberté : joue dessus pour les capturer.',
  // 8. Relier.
  'relier': 'J’ai pris un des deux points qui relient tes pierres marquées. Relie-les par l’autre, sur le point marqué.',
  'relier.bravo': 'Reliées ! Elles forment un groupe et partagent leurs libertés.',
  'relier.non': 'Si je joue sur le point marqué, tes deux pierres marquées sont coupées. Relie-les là.',
  // 9. Territoire.
  'territoire': 'Le but du go : entourer plus de points libres que l’autre. C’est ton territoire. Monte ton mur sur le point marqué.',
  'territoire.non': 'Pour cette partie, construis ton mur sur le point marqué.',
  'territoire2': 'Mon territoire est à droite, le tien à gauche. Continue ton mur en bas.',
  'territoire2.non': 'Pour cette partie, continue ton mur sur le point marqué.',
  'territoire3': 'Encore un pas vers le bord.',
  'territoire3.non': 'Pour cette partie, continue ton mur sur le point marqué.',
  'territoire4': 'Jusqu’au bord du plateau.',
  'territoire4.non': 'Pour cette partie, continue ton mur sur le point marqué.',
  // 10. Ko.
  'ko': 'Joue sur le point marqué : atari sur ma pierre du coin ! Attention : la tienne n’aura qu’une liberté.',
  'ko.non': 'Pour cette partie, joue sur le point marqué.',
  'ko2': 'Je capture ta pierre. Essaie de reprendre la mienne tout de suite : touche le point marqué.',
  'ko2.non': 'Touche le point marqué, là où était ta pierre.',
  'ko3': 'Interdit : c’est le ko, sinon on se reprendrait la pierre sans fin. Joue d’abord ailleurs : sauve ta pierre marquée.',
  'ko3.non': 'Sauve d’abord ta pierre marquée : allonge-toi sur sa liberté.',
  'ko4': 'Tu as joué ailleurs : maintenant, tu as le droit de reprendre ! Joue sur le point marqué.',
  'ko4.bravo': 'Repris ! À mon tour, je n’ai pas le droit de reprendre tout de suite.',
  'ko4.non': 'Reprends ma pierre : joue sur le point marqué.',
  'ko5': 'Je sauve ma pierre. Ferme le ko : joue sur le point marqué. Plus personne ne pourra reprendre.',
  'ko5.non': 'Pour cette partie, ferme le ko sur le point marqué.',
  // 11. Deux yeux.
  'yeux': 'Mon groupe a deux yeux : deux points libres entourés par mes seules pierres. Essaie de jouer dans l’un d’eux.',
  'yeux.non': 'Touche un des deux yeux marqués.',
  'yeux2': 'Interdit : ta pierre n’aurait aucune liberté. Avec deux yeux, un groupe ne peut jamais être capturé : il est vivant.',
  // 12. Frontières.
  'frontiere': 'Les points rouges : ta frontière est ouverte en haut, contre ma pierre. Ouverte, ces points ne comptent pour personne. Ferme-la !',
  'frontiere.bravo': 'Fermée ! Tous ces points sont maintenant ton territoire.',
  'frontiere.non': 'Ferme ta frontière sur le point marqué, à côté de ma pierre.',
  // 13. Groupe mort.
  'mort': 'Je tente une pierre chez toi. Bloque-la sur le point marqué.',
  'mort.bravo': 'Ma pierre ne peut plus sortir ni faire deux yeux : elle est morte. Pas besoin de la capturer.',
  'mort.non': 'Pour cette partie, bloque ma pierre sur le point marqué.',
  // 14. Passer.
  'passer': 'Je passe : pour moi, la partie est finie. Tes frontières sont fermées : passe aussi. Deux passes, et la partie s’arrête.',
  'passer.non': 'Plus besoin de poser de pierre : touche « Passer ».',
  // 15. Compter (règle japonaise).
  'compte': 'On compte. D’abord, les pierres mortes sortent du plateau : ma pierre chez toi devient ton prisonnier.',
  'compte2': 'Ton territoire : les points libres entourés par tes seules pierres. Tu en as 38.',
  'compte3': 'Tes prisonniers : 5 capturés et 1 pierre morte, donc 6. 38 + 6 = 44 points.',
  'compte4': 'Mon territoire : 11 points. Plus mon prisonnier : 12.',
  'compte5': 'Noir commence, c’est un avantage : Blanc reçoit 6,5 points, le komi. 12 + 6,5 = 18,5 pour moi.',
  'compte6': '44 contre 18,5 : tu gagnes de 25,5 points ! Le demi-point du komi évite toute égalité.',
} as const;

export type CleDecouverte = keyof typeof DECOUVERTE_FR;
