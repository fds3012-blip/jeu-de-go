// Leçons interactives (issue #16 : de 30 kyu vers le premier dan), positions vérifiées par le moteur de src/go.
import { plateau } from './plateau.js';
// rows : plateau 9 × 9 ligne par ligne depuis le haut. X noir, O blanc, T pierre blanche visée, S pierre noire à sauver.
// Coordonnées : lettres A à J sans I, lignes numérotées depuis le bas. accept: 'line3' = tout coup hors des deux premières lignes.
const L_CAP1 = ['.........', '.........', '.........', '...X.....', '..XT.O...', '...X.....', '.........', '.........', '.........'];
// Leçons v2 (issue #101) : `demo` joue la position temps par temps ; une idée par étape, 12 mots au plus.
// #198 : `geste` fait jouer l'élève dans la démonstration (il pose la pierre noire, ou touche le point) ; au plus 35 % d'étapes sans geste.
const V = ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'];
const L_GROUPE = ['.........', '.........', '.........', '...XX....', '..XTTX...', '...X.....', '....O....', '.........', '.........'];
const L_YEUX = ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOO...', 'XXXXXO...', '.X.XXO...'];
const L_FIN = ['...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....'];
const L_ATARI = ['.........', '.........', '.........', '....X....', '...XO....', '....X....', '.........', '.........', '.........'];
const L_CONTRE = ['.........', '.........', '....O....', '...O.....', '...OXOX..', '....OX...', '.........', '.........', '.........'];
const L_CONTRE_Q = ['.........', '.........', '....O....', '...O.....', '...OSOX..', '....OX...', '.........', '.........', '.........'];
const L_DOUBLE = ['.........', '.........', '.........', '...X.X...', '..XO.OX..', '.........', '.........', '.........', '.........'];
const L_ECHELLE = ['.........', '.........', '.........', '....X....', '....OX...', '...X.....', '.........', '.........', '.........'];
const ECHELLE_1 = [{ pose: 'D5', couleur: 'B' }, { libs: 'E5' }, { pose: 'E4', couleur: 'W' }, { pose: 'E3', couleur: 'B' }, { pose: 'F4', couleur: 'W' }, { pose: 'G4', couleur: 'B' }, { pose: 'F3', couleur: 'W' }];
const ECHELLE_2 = ['F2', 'G3', 'H3', 'G2', 'H2', 'G1', 'F1', 'H1', 'J1'].map((pose, i) => ({ pose, couleur: i % 2 ? 'W' : 'B' }));
const L_KO = ['.........', '.........', '.........', '...OX....', '..O.OX...', '...OX....', '.........', '.........', '.........'];
// Leçon 7 (#177) : partie finie, frontière en E (Noir) et F (Blanc). Chaque chiffre est recalculé par score() (src/go/lessons.test.ts).
const L_COMPTE = Array(9).fill('....XO...');
const ouverte = (y) => L_COMPTE.map((r, i) => (i === y ? '.....O...' : r));
// Leçon 8 (#228, chapitre 2) : bien commencer une partie sur 9 × 9. Chaque ensemble de réponses acceptées
// et chaque ensemble de réfutations est recalculé par src/go/lessons.test.ts à partir d'un critère écrit en clair.
const L_FORMES = ['.........', '.........', '..XX.....', '.X..X..XX', '.X..X.X..', '..XX..X..', 'XX.....XX', '..X......', '.........'];
const L_3_3_5_5 = ['.........', '.........', '.........', '.........', '....O....', '.........', '..X......', '.........', '.........'];
const L_COLLE = ['.........', '.........', '......O..', '.........', '....OX...', '.........', '..X......', '.........', '.........'];
const L_ETENDRE = ['.........', '.........', '......O..', '.........', '.........', '.........', '..X......', '.........', '.........'];
const L_QUATRE_COINS = ['.........', '.........', '..X...O..', '.........', '.........', '.........', '..X...O..', '.........', '.........'];
const COINS_LIBRES = ['C7', 'D7', 'C6', 'G7', 'F7', 'G6', 'G3', 'F3', 'G4'];
const lignes12 = (sauf) => ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'].flatMap((c, x) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({ l: `${c}${n}`, x, y: 9 - n })))
  .filter(({ l, x, y }) => Math.min(x, y, 8 - x, 8 - y) <= 1 && !sauf.includes(l)).map(({ l }) => l);
const BAS = { no: 'Sur les deux premières lignes, au début, ta pierre entoure peu.' };
// Leçons 9 à 12 (#16) : filet, prise en retour, course aux libertés, faux œil. Chaque position, chaque réponse acceptée
// et chaque réfutation est prouvée par src/go/lecons-16.test.ts (lecteur exact de capture, preuve de vie et mort).
// Filet : trois pierres blanches (C7, G7, C3) cassent toutes les échelles ; seul un filet prend la pierre.
const L_FILET = ['.........', '.........', '..O.X.O..', '.........', '..X.TX...', '....X....', '..O......', '.........', '.........'];
const L_FILET_Q = ['.........', '.........', '......O..', '....X....', '...XT.X..', '.........', '..O.X.O..', '.........', '.........'];
// Prise en retour : si Noir met en atari du mauvais côté, Blanc relie ses pierres marquées à son groupe du bas.
const L_RETOUR = ['.........', '.........', '......XXX', '......XTT', '......X..', '.......XO', '.......OO', '.......OO', '.........'];
const L_RETOUR_Q = ['.OOO.TX..', '.OOX.TX..', '....XXX..', '.........', '.........', '.........', '.........', '.........', '.........'];
// Course aux libertés : deux groupes sans œil, aucune liberté commune. Démo 3 contre 3, question 2 contre 2.
const L_COURSE = ['.........', '.........', '.........', '.........', '.........', '.....OOOO', '..XXXXOOO', '..XTTTXXX', '..X......'];
const L_COURSE_Q = ['.........', '.........', '.........', '.........', 'OOO......', '..O......', 'SSO......', 'TTXX.....', '..X......'];
// Faux œil : D1 et E1 ne tiennent au groupe que par C1, et le coin D2 de C1 est blanc. Deux pierres séparées :
// Blanc les prend sans ko.
const L_FAUX = ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOOO..', 'XXXOOOO..', '.X.XX.O..'];
const L_FAUX_D2 = ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOO...', 'XXXOXO...', '.X.XXO...'];
const L_FAUX_VIS = ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOO...', 'SXX.XO...', '.X.XXO...'];
const L_FAUX_TUE = ['...XOO.O.', '...XO.OOT', '...XXXXXX', '.........', '.........', '.........', '.........', '.........', '.........'];
// Leçons 13 à 16 (#16) : le point vital, le seki, finir la partie, compter une partie. Chaque position, chaque réponse
// acceptée, chaque réfutation et chaque chiffre est prouvé par src/go/lecons-13-16.test.ts (preuve de vie et mort en zone
// fermée, score() du moteur en règle japonaise).
// Point vital : trois points en ligne, le milieu décide ; quatre en ligne vivent même si Blanc entre ; deux meurent.
const L_TROIS = ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOOO..', 'OXXXXXO..', 'OX...XO..'];
const L_TROIS_TUE = ['XT...OX..', 'XOOOOOX..', 'XXXXXXX..', '.........', '.........', '.........', '.........', '.........', '.........'];
const L_TROIS_VIS = ['.........', '.........', '.........', '.......OO', '......OSX', '......OX.', '......OX.', '......OX.', '......OXX'];
const L_QUATRE = ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOOOO.', 'OXXXXXXO.', 'OX....XO.'];
const L_DEUX = ['.........', '.........', '.........', '.........', '.........', '.........', '...OOOOO.', '...OSXXO.', '...OX..O.'];
// Seki : la chaîne noire C2-E2 et les chaînes blanches qui l'entourent n'ont aucun œil et partagent C1 et E1. Qui en
// remplit une se met en atari et se fait prendre. Question : E2 vide ; seul E2 garde deux libertés partagées.
const L_SEKI = ['.........', '.........', '.........', '.........', '.........', 'XXXXXXX..', 'XOOOOOX..', 'XOXXXOX..', 'XO.O.OX..'];
const L_SEKI_Q = ['.........', '.........', '.........', '.........', '.........', 'XXXXXXX..', 'XOOOOOX..', 'XOSX.OX..', 'XO.O.OX..'];
// Finir la partie : dame en E7 (touche Noir et Blanc), pierre blanche morte en B2 dans le coin noir (A1, A2, B1).
// `TROU` : la frontière est encore ouverte en E8 ; `SANS` : B2 retirée, comptée prisonnière.
const L_FIN_P = ['....XO...', '....XO...', '...X.O...', '...XO....', '...XO....', '...XXO...', 'XXXXXO...', '.OX.XO...', '..X.XO...'];
const L_FIN_TROU = L_FIN_P.map((r, i) => (i === 1 ? '.....O...' : r));
const L_FIN_SANS = L_FIN_P.map((r, i) => (i === 7 ? '..X.XO...' : r));
// Compter une partie : une morte de chaque côté (B2 blanche, H8 noire), une dame en E5. `SANS` : mortes retirées.
const L_COMPTE_P = ['...XO.O..', '...XO.OX.', '...XO.OOO', '...XO....', '...X.O...', '....XO...', 'XXX.XO...', '.OX.XO...', '..X.XO...'];
const L_COMPTE_SANS = L_COMPTE_P.map((r, i) => (i === 1 ? '...XO.O..' : i === 7 ? '..X.XO...' : r));
// Leçons 17 à 20 (#16, décision du 05/10 : vers le niveau dan). Chaque position, chaque réponse acceptée, chaque
// réfutation et chaque démonstration est prouvée par src/go/lecons-17-20.test.ts (preuve de vie et mort en zone fermée,
// lecteur exact de capture). Les formes d'yeux (l17) finissent « Vie et mort » ; l18 à l20 ouvrent « Formes et tesuji ».
// Formes d'yeux : espace en T (point vital au centre), carré de quatre (toujours mort), cinq en grappe (point vital B1/H1).
const L_T_NOIR = [...V.slice(0, 5), 'OOOOOO...', 'XXXXXO...', 'XX.XXO...', 'X...XO...'];
const L_T_BLANC = [...V.slice(0, 5), '...XXXXXX', '...XOOOOO', '...XOO.OO', '...XO...T'];
const L_CARRE = [...V.slice(0, 5), 'OOOO.....', 'XXXO.....', '..XO.....', '..XO.....'];
const L_GRAPPE_NOIR = [...V.slice(0, 5), 'OOOOO....', 'XXXOO....', '..XXO....', '...XO....'];
const L_GRAPPE_BLANC = [...V.slice(0, 5), '....XXXXX', '....XXOOT', '....XOO..', '....XO...'];
// Bonnes formes : point de coupe D5 (entre D4 et E5, à côté de E4), bouche du tigre ; puis le bambou.
const L_COUPE = ['.........', '.........', '.........', '.........', '....X....', '...XO....', '.........', '.........', '.........'];
const L_COUPE_Q = ['.........', '.........', '...S.....', '..SO.....', '.........', '.........', '.........', '.........', '.........'];
const L_BAMBOU = ['.........', '.........', '.........', '..XX.....', '.........', '..XX.....', '.........', '.........', '.........'];
const L_BAMBOU_Q = ['.........', '.........', '.........', '.........', '.....S.S.', '.....XOX.', '.........', '.........', '.........'];
// Pierres qui coupent : E6 sépare D6, F6 et E7 ; la prendre fait un diamant (ponnuki). La queue (B3, puis B2 et C2) ne coupe rien.
const L_COUPANTE = ['.........', '.........', '....X....', '...XOX...', '.........', '....O....', '.........', '.........', '.........'];
const L_COUPANTE_Q = ['.........', '.........', '....X....', '...SOS...', '.........', '.X..O....', 'XO.......', '.X.......', '.........'];
const L_COUPANTE_Q2 = ['.........', '.........', '....X....', '...SOS...', '.........', '....O....', '.XX......', 'XOO......', '.XX......'];
// Relier et mourir (oiotoshi) : si Blanc relie E1 en D1, tout le groupe n'a plus qu'une liberté (C1).
const L_RELIER = [...V.slice(0, 6), 'XXXX.....', 'XOOOX....', '.X..O....'];
const L_RELIER_Q = ['...TT..X.', '...XXOOOX', '...XXXXXX', ...V.slice(0, 6)];
// Leçons 21 à 30 (#16, palier suivant). Chaque position, chaque réponse acceptée, chaque réfutation et chaque chiffre est
// prouvé par src/go/lecons-21-30.test.ts (minimax exact de fin de partie, preuve de vie et mort en zone fermée, lecteur
// exact de capture).
// Manque de libertés : la chaîne B2-C2-C1-D1 et la pierre A1 ne se relient que par A2 ou B1 ; leur seule liberté
// extérieure est E1. Après E1, relier laisse une seule liberté. `Q` : une autre forme, sur la droite.
const L_MANQUE = [...V.slice(0, 6), 'XXXXXXX..', '.OOX.XX..', 'O.OO..X..'];
const L_MANQUE_APRES = [...V.slice(0, 6), 'XXXXXXX..', '.OOX.XX..', 'O.OOX.X..'];
const L_MANQUE_Q = [...V.slice(0, 6), '..XXXXXXX', '..XX.XO.O', '..X..OOT.'];
// Sente et gote : partie finie sauf deux endroits. En bas, l'atari E2 oblige Blanc à relier en F1 (sente) ; en haut, E9
// ferme la frontière sans rien menacer (gote). `MIROIR` : la même partie retournée de haut en bas, pour l'exercice.
const L_SENTE = ['..XX..O..', ...Array(6).fill('..XXOOO..'), '..XX..O..', '..XOO.O..'];
const L_SENTE_MIROIR = [...L_SENTE].reverse();
// Hane au premier rang : murs fermés sur la 2e ligne, seule la 1re ligne reste à jouer. `APRES` : hane E1 et blocage F1.
// `Q` : la même forme en miroir, Noir à droite.
const L_HANE = [...Array(7).fill('...XO....'), 'XXXXOOOOO', '......O..'];
const L_HANE_APRES = [...L_HANE.slice(0, 8), '....XOO..'];
const L_HANE_Q = [...Array(7).fill('....OX...'), 'OOOOOXXXX', '..O......'];
// Agrandir ou réduire : l'espace noir (A1-B1, D1) finit en E1, au contact de Blanc. Qui prend E1 décide : Noir y vit,
// Blanc y tue. `Q` : couleurs inversées et retournées (Noir réduit de l'extérieur) ; `V` : la même forme sur le bord droit.
const L_ESPACE = [...V.slice(0, 6), 'OOOOOOOO.', 'XXXXX..O.', '..X..O.O.'];
const L_ESPACE_Q = [...V.slice(0, 6), '.XXXXXXXX', '.X..OOOOT', '.X.X..O..'];
const L_ESPACE_V = ['......OX.', '......OX.', '......OXX', '......OX.', '......OX.', '......O.O', '......O..', '......OOO', '.........'];
// Groupes du coin : l'espace A1-B1 et l'œil D1. A2, le point du coin, décide : Noir y vit ; si Blanc le prend, A1 puis la
// prise en B1 font un ko. `Q` : la même forme tournée dans le coin en haut à droite (point du coin J8).
const L_COIN = [...V.slice(0, 6), 'OOOOOO...', '.XXXXO...', '..X.XO...'];
const L_COIN_Q = ['...OX.X..', '...OXXXX.', '...OOOOOO', ...V.slice(0, 6)];
// Course avec un œil : le groupe noir (œil A1) n'a qu'une liberté commune, C1 ; le groupe blanc D1-D2 a C1 et deux libertés
// du dehors, E1 et E2. Noir au trait gagne en bouchant le dehors d'abord ; Blanc au trait gagne. `Q` : la même course en miroir.
const L_OEIL = [...V.slice(0, 5), 'OOOXXXX..', 'OOOXXXX..', 'XXXO.X...', '.X.O.X...'];
const L_OEIL_Q = [...V.slice(0, 5), '..XXXXOOO', '..XXXXOOO', '...X.OXXX', '...X.O.X.'];
// Leçon 27 (#16, palier 27-30) : attaquer et défendre. Jugement de stratégie : KataGo (réseau g170 b6c96, komi 6,5, règle
// japonaise) le mesure, avec huit graines (les huit symétries du plateau). Preuves figées dans
// src/go/attaque-defense.fixture.ts, rejouées par src/go/lecons-27-30.test.ts (sans le modèle).
// `FAIBLE` : la pierre blanche F3, seule entre C3 et G3 ; F4 lui ferme le centre, et c'est aussi là que Blanc sort.
// `COTE` : la même idée sur le côté droit (G4 entre G3 et G7). `SORS` : couleurs inversées, ta pierre F3 sort vers le centre.
const L_FAIBLE = [...V.slice(0, 2), '..O...O..', ...V.slice(0, 3), '..X..TX..', ...V.slice(0, 2)];
const L_COTE = [...V.slice(0, 2), '..O...X..', ...V.slice(0, 2), '......T..', '..O...X..', ...V.slice(0, 2)];
const L_SORS = [...V.slice(0, 2), '..O...X..', ...V.slice(0, 3), '..O..SO..', ...V.slice(0, 2)];
// Ouverture en 13 × 13 et joseki en 19 × 19 (#16, après #454) : positions écrites avec plateau() (coordonnées affichées).
// Le jugement (meilleur coup, réponses acceptées, coups refusés) vient de KataGo, figé dans src/go/preuves-katago.json
// et rejoué par src/go/lecons-ouverture.test.ts (seuils et méthode : src/go/preuvesKataGo.ts).
// 13 × 13 : `TROIS` deux coins pris ; `PARA` quatre hoshi ; `BORDS` quatre coins fermés, il reste les bords.
const TROIS = plateau(13, { X: ['D4'], O: ['K10'] });
const PARA = plateau(13, { X: ['D4', 'K4'], O: ['D10', 'K10'] });
const BORDS = plateau(13, { X: ['C4', 'D3', 'L10', 'K11'], O: ['K3', 'L4', 'D11', 'C10'] });
// 19 × 19, coin bas gauche cadré ; les trois autres coins sont occupés (invisibles dans le cadre).
// San-san : `SS` hoshi D4 et une pierre noire K3 sur le bord du bas ; `SSM` la même idée retournée sur la diagonale du coin.
const SS = { X: ['D4', 'K3', 'Q4'], O: ['Q16', 'D16'] };
const SSM = { X: ['D4', 'C10', 'D16'], O: ['Q16', 'Q4'] };
// 3-4 : `K34` les autres coins ; `K34M` les mêmes, retournés sur la diagonale du coin bas gauche.
const K34 = { X: ['Q4'], O: ['Q16', 'D16'] };
const K34M = { X: ['D16'], O: ['Q16', 'Q4'] };
const ajoute = (base, x = [], o = []) => plateau(19, { X: [...base.X, ...x], O: [...base.O, ...o] });
const COLLEE = 'Collée à ta pierre, elle n’entoure presque rien de plus.';
// Leçons 32 et suivantes (#16, palier vers 8 kyu) : fin de partie et tesuji. Chaque position, chaque réponse acceptée,
// chaque réfutation et chaque chiffre est prouvé par src/go/lecons-32-plus.test.ts (minimax exact de fin de partie avec
// élagage alpha-bêta, preuve de vie et mort en zone fermée, lecteur exact de capture).
// Valeur d'un coup : partie finie sauf deux endroits. En haut, C9-D9 sont en atari : Noir les prend en E9 (deux
// prisonniers, deux points), ou Blanc relie en E9. En bas, le hane au premier rang de la leçon 23 (deux points d'écart).
// `Q` : la même partie retournée de haut en bas, pour l'exercice.
const L_VALEUR = ['.XOO.O...', '.XXXXO...', ...Array(5).fill('...XO....'), 'XXXXOOOOO', '......O..'];
const L_VALEUR_Q = [...L_VALEUR].reverse();
// Le sente avant le gote : en bas, l'atari E2 de la leçon 22 (sente : il menace deux pierres) ; en haut, la pierre D9 en
// atari, que Noir prend en E9 (gote, deux points d'écart). Le sente d'abord : Blanc relie, puis tu prends. `Q` : la même
// partie retournée de haut en bas.
const L_ORDRE = ['.XXO.O...', '.XXXXO...', ...Array(5).fill('..XXOOO..'), '..XX..O..', '..XOO.O..'];
const L_ORDRE_Q = [...L_ORDRE].reverse();
// Relier par en dessous (watari) : tes pierres A2-C2 et ton mur G sont séparés par la pierre blanche E2. E1, sous elle,
// relie : si Blanc coupe en D1, D2 le met en atari ; s'il coupe en D2, D1 relie. `D2` : la position après E1 et la coupe
// D2. `M` : la même forme en miroir, de l'autre côté.
const L_WATARI = [...V.slice(0, 5), '......X..', 'OOOOOOX..', 'XXX.O.X..', '.....XX..'];
const L_WATARI_D2 = [...V.slice(0, 5), '......X..', 'OOOOOOX..', 'XXXOO.X..', '....XXX..'];
const L_WATARI_M = L_WATARI.map(r => [...r].reverse().join(''));
// Couper par en dessous : les pierres blanches A2-D2 veulent rejoindre le mur blanc G par le premier rang. Seul E1 coupe ;
// ensuite E2 et F1 se répondent. E2, le blocage naturel, laisse Blanc répondre en E1 : plus de coupe sans ko.
// `M` : la même forme en miroir.
const L_DESSOUS = [...V.slice(0, 5), '......O..', 'XXXXXXO..', 'OOOO.XO..', '......O..'];
const L_DESSOUS_M = L_DESSOUS.map(r => [...r].reverse().join(''));
// Couper, puis reprendre : les pierres blanches A2-C2 et D1 veulent passer. Seul B1 coupe. Si Blanc relie en C1, E1 le met
// en atari ; s'il prend B1 en A1, tu reprends en B1 : prise en retour de six pierres. `M` : la même forme en miroir.
const L_REPRISE = [...V.slice(0, 5), '......O..', 'XXXXXXO..', 'OOOX..O..', '...O..O..'];
const L_REPRISE_M = L_REPRISE.map(r => [...r].reverse().join(''));
export const CHAPITRES = [
  { id: 'c1', titre: 'Les bases', intro: 'Sept leçons courtes pour jouer ta première partie.', fin: 'Tu connais les règles du go.', lecons: ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'] },
  // Chapitre en cours d'écriture (`complet: false`) : sa dernière leçon ne ferme pas encore le chapitre.
  { id: 'c2', titre: 'L’ouverture', intro: 'Où poser tes premières pierres.', lecons: ['l8', 'l27', 'l29', 'l30', 'l31'], complet: false },
  { id: 'c3', titre: 'Capturer et sauver', intro: 'Des pièges pour prendre plus de pierres.', lecons: ['l9', 'l10', 'l11', 'l26'], complet: false },
  { id: 'c4', titre: 'Vie et mort', intro: 'Quand un groupe vit, quand il meurt.', lecons: ['l12', 'l13', 'l14', 'l17', 'l24', 'l25'], complet: false },
  { id: 'c5', titre: 'Fin de partie et comptage', intro: 'Finir proprement, puis compter juste.', lecons: ['l15', 'l16', 'l22', 'l23', 'l32', 'l33'], complet: false },
  { id: 'c6', titre: 'Formes et tesuji', intro: 'Les bonnes formes et les coups malins du go.', lecons: ['l18', 'l19', 'l20', 'l21', 'l34', 'l35', 'l36'], complet: false }
];
export const LESSONS = [
  { id: 'l1', title: 'Libertés et capture', desc: 'La règle qui fait tout le jeu', steps: [
    { kind: 'info', rows: V, demo: [{ pose: 'E5', couleur: 'B' }, { libs: 'E5' }], geste: { pose: 'E5' },
      text: 'Pose ta pierre au point vert. Les points vides autour : ses libertés.' },
    { kind: 'info', rows: ['.........', '.........', '.........', '.........', '....X....', '.........', '.........', '.........', '.........'], demo: [{ pose: 'A1', couleur: 'B' }, { libs: 'A1' }], geste: { pose: 'A1' },
      text: 'Pose une pierre dans le coin, au point vert : deux libertés seulement.' },
    { kind: 'info', rows: ['.........', '.........', '.........', '.........', '...O.O...', '.........', '.........', '.........', '.........'],
      demo: [{ libs: 'D5' }, { pose: 'D6', couleur: 'B' }, { pose: 'C5', couleur: 'B' }, { pose: 'D4', couleur: 'B' }], geste: { pose: 'D6' },
      text: "Bouche ses libertés, en commençant par le point vert. Plus qu'une : l'atari." },
    { kind: 'move', rows: L_CAP1, accept: ['E5'], text: 'Joue sur la dernière liberté pour capturer.',
      ok: 'Capturée ! Sans liberté, la pierre quitte le plateau.', no: 'Cherche le seul point vide à côté de la pierre marquée.' },
    { kind: 'info', rows: L_GROUPE, demo: [{ libs: 'D5' }], geste: { touche: ['D5', 'E5'], no: 'Touche une des deux pierres blanches collées.' },
      text: 'Pierres collées : un groupe, aux libertés partagées. Touche-le.' },
    { kind: 'move', rows: L_GROUPE, accept: ['E4'], text: "Capture les deux pierres d'un coup.",
      ok: 'Deux prisonniers ! Un groupe vit ou meurt ensemble.', no: "Le groupe n'a qu'une liberté : trouve-la." }
  ] },
  { id: 'l2', title: 'Atari : attaquer et se sauver', desc: "Quand il ne reste qu'une liberté", steps: [
    { kind: 'info', rows: ['.........', '.........', '.........', '....X....', '...XO....', '.........', '.........', '.........', '.........'], demo: [{ libs: 'E5' }, { pose: 'E4', couleur: 'B' }], geste: { pose: 'E4' },
      text: "Pose au point vert. Plus qu'une liberté : la pierre est en atari." },
    { kind: 'info', rows: L_ATARI, demo: [{ pose: 'F5', couleur: 'B' }], geste: { pose: 'F5' },
      text: 'Si Blanc ne fait rien, capture-la au point vert.' },
    { kind: 'info', rows: ['.........', '.........', '.........', '.....O...', '....OXO..', '....X.O..', '.........', '.........', '.........'], demo: [{ libs: 'F5' }, { pose: 'F4', couleur: 'B' }], geste: { pose: 'F4' },
      text: 'En atari ? Allonge-toi au point vert : tes libertés remontent.' },
    { kind: 'move', rows: ['.........', '.........', '.........', '...O.....', '..OSO....', '..O.X....', '.........', '.........', '.........'], accept: ['D4'], libs: ['D4'],
      text: 'À toi. Allonge ta pierre marquée sur sa liberté.',
      ok: 'Trois libertés : ta pierre est sauvée.', no: 'Joue sur le point vert, à côté de ta pierre.' },
    { kind: 'info', rows: L_CONTRE, demo: [{ libs: 'E5' }, { pose: 'E6', couleur: 'B' }], geste: { pose: 'E6' },
      text: 'Allonge-toi au point vert. Ici, ça ne suffit pas : toujours une liberté.' },
    { kind: 'move', rows: L_CONTRE_Q, accept: ['F6'],
      text: 'Sauve ta pierre autrement : une pierre blanche est en atari.',
      ok: 'Capturer F5 libère ta pierre. Attaquer, c’est aussi défendre.', no: "Cherche la pierre blanche qui n'a qu'une liberté." }
  ] },
  { id: 'l3', title: 'Techniques de capture', desc: 'Double atari, bord et échelle', steps: [
    { kind: 'info', rows: L_DOUBLE, demo: [{ pose: 'E5', couleur: 'B' }, { atari: ['D5', 'F5'] }], geste: { pose: 'E5' },
      text: "Pose au point vert : deux pierres en atari, c'est le double atari." },
    { kind: 'info', rows: L_DOUBLE, avant: [{ pose: 'E5', couleur: 'B' }], demo: [{ pose: 'D4', couleur: 'W' }, { pose: 'F4', couleur: 'B' }], geste: { pose: 'F4' },
      text: "Blanc en sauve une. Prends l'autre au point vert." },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '..XT.TX..', '...X.X...', '.........', '.........', '.........'], accept: ['E5'], libs: ['D6', 'E5', 'F6'],
      text: 'À toi : trouve le double atari.',
      ok: "Blanc ne peut en sauver qu'une : tu prends l'autre.", no: 'Cherche le point vert commun aux deux pierres.' },
    { kind: 'info', rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.XOX.....', '.........'],
      demo: [{ pose: 'C3', couleur: 'B' }, { libs: 'C2' }, { pose: 'C1', couleur: 'W' }, { pose: 'B1', couleur: 'B' }, { pose: 'D1', couleur: 'W' }, { pose: 'E1', couleur: 'B' }], geste: { pose: 'C3' },
      text: 'Atari vers le bord, au point vert : elle fuit et meurt.' },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '...XTX...', '.........'], accept: ['E3'],
      text: 'À toi : pousse la pierre marquée vers le bord.',
      ok: "Contre le bord, elle n'a plus d'issue.", no: "De ce côté, elle s'échappe vers le centre." },
    { kind: 'info', rows: L_ECHELLE, demo: ECHELLE_1, geste: { pose: 'D5' },
      text: "L'échelle : atari au point vert. Elle fuit, jamais plus de deux libertés." },
    { kind: 'info', rows: L_ECHELLE, avant: ECHELLE_1, demo: ECHELLE_2,
      text: "Elle fuit en zigzag jusqu'au bord, puis tombe." },
    { kind: 'move', rows: ['.........', '.........', '.........', '....X....', '...XT....', '.....X...', '.........', '.........', '.........'], accept: ['F5', 'E4'],
      text: "À toi : lance l'échelle sur la pierre marquée.",
      ok: "Elle fuira en zigzag jusqu'au bord. Une pierre blanche sur le chemin la sauverait.", no: 'Joue du côté où ta pierre F4 bloque la fuite.' }
  ] },
  { id: 'l4', title: 'Le ko', desc: 'La règle qui empêche de tourner en rond', steps: [
    { kind: 'info', rows: L_KO, demo: [{ pose: 'D5', couleur: 'B' }, { libs: 'D5' }], geste: { pose: 'D5' },
      text: 'Capture au point vert. Ta pierre est aussitôt en atari.' },
    { kind: 'info', rows: L_KO, avant: [{ pose: 'D5', couleur: 'B' }], demo: [{ interdit: 'E5', couleur: 'W' }],
      text: "Reprendre tout de suite est interdit : c'est le ko." },
    { kind: 'info', rows: L_KO, avant: [{ pose: 'D5', couleur: 'B' }], demo: [{ pose: 'H8', couleur: 'W' }, { pose: 'B2', couleur: 'B' }, { pose: 'E5', couleur: 'W' }],
      text: 'Blanc joue ailleurs, Noir aussi. Maintenant, Blanc peut reprendre.' },
    { kind: 'move', rows: ['.........', '.........', '.........', '....XO...', '...XT.O..', '....XO...', '.........', '.........', '.........'], accept: ['F5'], libs: ['F5'],
      text: 'À toi : capture la pierre marquée.',
      ok: "Ta pierre F5 est à son tour en atari : c'est un ko.", no: "La pierre marquée n'a qu'une liberté : le point vert." },
    { kind: 'touche', rows: ['.........', '.........', '.........', '....XO...', '...X.XO..', '....XO...', '.........', '.........', '.........'], accept: ['E5'],
      text: 'Touche le point où Blanc ne peut pas reprendre.',
      ok: "Oui, E5 : Blanc doit d'abord jouer ailleurs.", no: 'Cherche où Blanc reprendrait ta pierre F5.' }
  ] },
  { id: 'l5', title: 'Vivre et mourir', desc: 'Les deux yeux', steps: [
    { kind: 'info', rows: L_YEUX, demo: [{ yeux: ['A1'] }, { yeux: ['C1'] }], geste: { touche: ['A1', 'C1'], no: 'Cherche un point vide entouré de pierres noires.' },
      text: 'Un œil : un point vide entouré par un seul groupe. Touches-en un.' },
    { kind: 'info', rows: L_YEUX, demo: [{ interdit: 'A1', couleur: 'W' }, { interdit: 'C1', couleur: 'W' }],
      text: "Dans un œil, Blanc n'aurait aucune liberté : interdit." },
    { kind: 'info', rows: L_YEUX, demo: [{ yeux: ['A1', 'C1'] }],
      text: 'Deux vrais yeux : ce groupe vit pour toujours.' },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOO....', 'SXXXO....', '...XO....'], accept: ['B1'],
      text: "Ton groupe est entouré. Fais deux yeux d'un coup.",
      ok: 'B1 sépare deux yeux, A1 et C1 : ton groupe vit.', no: "Un seul œil ne suffit pas. Joue au milieu de l'espace." },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'XXXXX....', 'TOOOX....', '...OX....'], accept: ['B1'],
      text: "À l'inverse : empêche Blanc de faire deux yeux.",
      ok: 'Point vital (celui qui décide) pris : un seul œil, Blanc est mort.', no: 'Au milieu, Blanc ferait deux yeux. Prends ce point avant lui.' }
  ] },
  { id: 'l6', title: 'Territoire et ouverture', desc: 'Compter et bien commencer', steps: [
    { kind: 'move', rows: L_FIN, accept: 'terrB',
      text: 'Territoire : les points vides entourés. Touche celui de Noir.',
      ok: 'Oui ! Ces points vides sont entourés par Noir.', no: 'Cherche un point vide du côté des pierres noires.' },
    { kind: 'info', rows: L_FIN, demo: [{ terr: 'B' }], text: 'Compte avec moi : trois colonnes de neuf.' },
    { kind: 'info', rows: L_FIN, demo: [{ terr: 'W' }], text: 'Blanc a plus de points, plus le komi (points offerts à Blanc) : il gagne.' },
    { kind: 'info', rows: ['.........', '.........', '..X...O..', '.........', '.........', '.........', '..O...X..', '.........', '.........'],
      text: "En ouverture : les coins d'abord, puis les bords, puis le centre." },
    { kind: 'info', rows: ['.........', '.........', '..X...O..', '.........', '.........', '.........', '..O...X..', '.........', '.........'],
      text: 'Coins et bords entourent du territoire avec moins de pierres.' },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'], accept: 'line3',
      text: 'Joue le premier coup. Évite les deux lignes du bord.',
      ok: 'Bon premier coup : assez loin du bord pour construire, assez proche pour entourer du territoire.', no: 'Trop près du bord : une pierre sur les deux premières lignes entoure très peu. Rapproche-toi du centre.' }
  ] },
  { id: 'l7', title: 'Compter les points', desc: 'Fermer, passer, compter', steps: [
    { kind: 'info', rows: L_COMPTE, demo: [{ terr: 'B' }, { terr: 'W' }],
      text: 'On compte territoire + prisonniers. Blanc reçoit aussi le komi (6,5 points, car Noir commence).' },
    { kind: 'quiz', rows: L_COMPTE, terr: true, compte: { pour: 'W', komi: 6.5 },
      text: 'Territoire colorié. Avec le komi, combien de points pour Blanc ?', choices: ['27', '33,5', '36'], answer: 1,
      ok: '27 + 6,5 = 33,5. Noir a 36 : il gagne de 2,5 points.', no: 'Compte les points de Blanc, puis ajoute le komi.' },
    { kind: 'info', rows: ouverte(2), demo: [{ pose: 'E7', couleur: 'B' }, { terr: 'B' }], geste: { pose: 'E7' },
      text: 'Trou en E7 : ton territoire ne compte pas. Ferme-le au point vert.' },
    { kind: 'move', rows: ouverte(6), accept: ['E3'], aide: ['E3'],
      text: 'À toi : ferme la frontière sur le point vert.',
      ok: 'Fermée : tes 36 points comptent enfin.', no: 'Tant que ce trou reste ouvert, Blanc peut entrer chez toi.' },
    { kind: 'quiz', rows: L_COMPTE,
      text: 'Toutes les frontières sont fermées. Que fais-tu ?', choices: ['Je passe', 'Chez moi', 'Chez Blanc'], answer: 0,
      ok: 'Oui. Après deux passes de suite, la partie s’arrête : on compte.', no: 'Chez toi, tu perds un point. Chez Blanc, ta pierre serait prise.' },
    { kind: 'quiz', rows: L_COMPTE, compte: { pour: 'B', komi: 6.5, prises: [3, 5] },
      text: 'Noir a 3 prisonniers, Blanc 5. Combien de points pour Noir ?', choices: ['36', '39', '42,5'], answer: 1,
      ok: '36 + 3 = 39. Blanc : 27 + 5 + 6,5 = 38,5. Noir gagne d’un demi-point.', no: 'Territoire plus prisonniers. Le komi, lui, va à Blanc.' }
  ] },
  { id: 'l8', title: 'Les premiers coups', desc: 'Coins, puis bords, puis centre', steps: [
    { kind: 'info', rows: L_FORMES, geste: { pose: 'C1' },
      demo: [{ pose: 'C1', couleur: 'B' }, { zone: ['A1', 'A2', 'B1', 'B2'] }, { zone: ['H4', 'H5', 'J4', 'J5'] }, { zone: ['C5', 'C6', 'D5', 'D6'] }],
      text: 'Ferme le coin au point vert : 4 pierres (pour 4 points). Bord : 6, centre : 8.' },
    { kind: 'info', rows: V, geste: { pose: 'C3' }, demo: [{ pose: 'C3', couleur: 'B' }, { pose: 'E5', couleur: 'W' }],
      text: 'Pose le 3-3 (3e ligne depuis deux bords) au point vert. Blanc prend le 5-5 (le centre, proche des quatre coins).' },
    { kind: 'move', rows: L_3_3_5_5, accept: COINS_LIBRES, aide: COINS_LIBRES,
      text: 'Prends un coin libre : au 3-3, ou au 3-4 (un cran plus loin).',
      ok: 'Bien : le 3-3 garde le coin, le 3-4 regarde aussi un bord.', no: 'Choisis un point vert, dans un coin sans pierre.',
      refus: [
        { points: ['D5', 'F5', 'E4', 'E6'], no: 'Collée à Blanc, ta pierre le renforce. Laisse de l’espace.' },
        { points: lignes12([]), ...BAS }
      ] },
    { kind: 'info', rows: L_COLLE, geste: { touche: ['F5'], no: 'Cherche la pierre noire qui touche une pierre blanche.' },
      demo: [{ libs: 'F5' }, { pose: 'F6', couleur: 'W' }],
      text: 'Touche la pierre collée à Blanc : 3 libertés. Blanc la presse aussitôt.' },
    { kind: 'info', rows: L_ETENDRE, geste: { pose: 'E3' }, demo: [{ pose: 'E3', couleur: 'B' }, { zone: ['C1', 'C2', 'D1', 'D2', 'E1', 'E2'] }],
      text: 'Étends-toi au point vert : un point libre entre tes deux pierres.' },
    { kind: 'move', rows: L_QUATRE_COINS, accept: ['C5', 'E3', 'E7'],
      text: 'À toi : étends-toi depuis une de tes pierres, le long du bord.',
      ok: 'Bien étendu : sur la 3e ligne, sans toucher aucune pierre.', no: 'Reste sur la 3e ligne, à deux ou trois points d’une de tes pierres.',
      refus: [
        { points: ['F3', 'G2', 'G4', 'H3', 'F7', 'G6', 'G8', 'H7'], no: 'Collée à Blanc, ta pierre le renforce. Laisse de l’espace.' },
        { points: ['B3', 'C2', 'C4', 'D3', 'B7', 'C6', 'C8', 'D7'], no: 'Trop serrée : laisse un point libre entre tes pierres.' },
        { points: lignes12(['F3', 'G2', 'G4', 'H3', 'F7', 'G6', 'G8', 'H7', 'B3', 'C2', 'C4', 'D3', 'B7', 'C6', 'C8', 'D7']), ...BAS }
      ] }
  ] },
  { id: 'l27', title: 'Attaquer et défendre', desc: 'La route du centre', steps: [
    { kind: 'info', rows: L_FAIBLE, geste: { pose: 'F4' }, demo: [{ pose: 'F4', couleur: 'B' }],
      text: 'Pierre faible (seule chez l’adversaire) : ferme-lui le centre au point vert.' },
    { kind: 'info', rows: L_FAIBLE, geste: { touche: ['F4'], no: 'Touche le point entre sa pierre et le centre.' }, demo: [{ pose: 'F4', couleur: 'W' }],
      text: 'Si Blanc joue d’abord, il sort par ce même point. Touche-le.' },
    { kind: 'move', rows: L_COTE, accept: ['F4'],
      text: 'À toi : attaque la pierre marquée. Ferme-lui le centre.',
      ok: 'Bien : sa route vers le centre est fermée.', no: 'Joue entre la pierre marquée et le centre.',
      refus: [{ points: ['G5'], no: 'Tu la bloques le long du bord : elle sort par F4.' }] },
    { kind: 'move', rows: L_SORS, accept: ['F4', 'D4'],
      text: 'Ta pierre marquée est faible. Sors-la vers le centre.',
      ok: 'Bien : ta pierre prend la route du centre.', no: 'Éloigne ta pierre du bord, vers le centre.',
      refus: [
        { points: ['E3'], no: 'Sur la 3e ligne, tu rampes au lieu de sortir vers le centre.' },
        { points: ['F2'], no: 'Vers le bord, tu rapetisses : Blanc te ferme le centre en F6.' }
      ] }
  ] },
  { id: 'l29', title: 'L’ouverture en 13\u00A0×\u00A013', desc: 'Coins, puis bords, puis centre', taille: 13, steps: [
    { kind: 'info', rows: plateau(13), geste: { pose: 'D4' },
      demo: [{ pose: 'D4', couleur: 'B' }, { pose: 'K10', couleur: 'W' }, { pose: 'K4', couleur: 'B' }, { pose: 'D10', couleur: 'W' }],
      text: 'Coins d’abord : pose au point vert. Chacun prend un coin.' },
    { kind: 'move', rows: TROIS, accept: ['K4', 'L4', 'K3', 'D10', 'C10', 'D11'],
      text: 'À toi : prends un coin libre.',
      ok: 'Bien : un coin se garde avec peu de pierres.', no: 'Vise un coin vide, sur la 3e ou la 4e ligne.',
      refus: [{ points: ['E4', 'D5', 'D3'], no: COLLEE }] },
    { kind: 'quiz', rows: TROIS,
      text: 'Pour Noir : K4, un coin libre, ou E4, collé à D4 ?', choices: ['K4', 'E4'], answer: 0,
      ok: 'K4 : tout un coin. E4 n’ajoute presque rien à D4.', no: 'Collée à D4, la pierre E4 entoure peu de points neufs.' },
    { kind: 'info', rows: PARA, geste: { pose: 'C7' }, demo: [{ pose: 'C7', couleur: 'B' }],
      text: 'Puis les bords, le centre en dernier. Pose au point vert.' },
    { kind: 'move', rows: BORDS, accept: ['C8', 'C7', 'H3', 'G3', 'F11', 'G11', 'L6', 'L7'],
      text: 'Coins fermés. À toi : prends un grand point sur un bord.',
      ok: 'Bien : un grand point, sur la 3e ou la 4e ligne.', no: 'Cherche un bord libre, sur la 3e ou la 4e ligne.',
      refus: [{ points: ['C5', 'D4', 'E3', 'L9', 'K10', 'J11'], no: COLLEE }] }
  ] },
  { id: 'l30', title: 'Le san-san', desc: 'Quand Blanc entre sous ton hoshi', taille: 19, steps: [
    { kind: 'info', rows: ajoute(SS), cadre: 'bas-gauche', geste: { pose: 'D3' },
      demo: [{ pose: 'C3', couleur: 'W' }, { pose: 'D3', couleur: 'B' }],
      text: 'San-san (point 3-3) : Blanc entre sous ton hoshi (point étoile). Bloque au point vert.' },
    { kind: 'move', rows: ajoute(SSM, [], ['C3']), cadre: 'bas-gauche', accept: ['D3', 'C4'],
      text: 'À toi : Blanc entre au san-san. Bloque-le.',
      ok: 'Bien : ta pierre touche la sienne et lui barre la route.', no: 'Pose ta pierre contre la sienne : en D3 ou en C4.',
      refus: [
        { points: ['C2', 'D2', 'B3'], no: 'Par en dessous, tu ne bloques rien : Blanc avance.' },
        { points: ['E4', 'D5'], no: 'Trop loin de sa pierre : Blanc avance d’un pas.' }
      ] },
    { kind: 'info', rows: ajoute(SS), cadre: 'bas-gauche', avant: [{ pose: 'C3', couleur: 'W' }, { pose: 'D3', couleur: 'B' }],
      geste: { pose: 'D5' }, demo: [{ pose: 'C4', couleur: 'W' }, { pose: 'D5', couleur: 'B' }],
      text: 'Blanc rampe vers le haut. Barre-lui la route au point vert.' },
    { kind: 'move', rows: ajoute(SSM, ['C4'], ['C3', 'D3']), cadre: 'bas-gauche', accept: ['E4', 'E3', 'F3'],
      text: 'À toi : Blanc rampe le long du bord. Barre-lui la route.',
      ok: 'Bien : Blanc reste enfermé dans le coin.', no: 'Joue devant sa pierre de tête, sans la toucher par dessous.',
      refus: [
        { points: ['D2', 'E2'], no: 'Par l’intérieur, tu ne barres rien : Blanc sort par-dessus.' },
        { points: ['D5'], no: 'Collée à ton hoshi : Blanc passe devant toi et sort.' }
      ] }
  ] },
  { id: 'l31', title: 'Le 3-4 et l’approche', desc: 'Le kakari et ses réponses', taille: 19, steps: [
    { kind: 'info', rows: ajoute(K34), cadre: 'bas-gauche', geste: { pose: 'C4' },
      demo: [{ pose: 'C4', couleur: 'B' }, { pose: 'E3', couleur: 'W' }],
      text: 'Pose un 3-4 (komoku : 3e ligne d’un bord, 4e de l’autre) au point vert. Blanc approche : kakari.' },
    { kind: 'info', rows: ajoute(K34, ['C4'], ['E3']), cadre: 'bas-gauche', geste: { pose: 'D3' },
      demo: [{ pose: 'D3', couleur: 'B' }, { pose: 'E4', couleur: 'W' }],
      text: 'Tsuke (coup au contact) : colle-toi dessous au point vert. Blanc monte.' },
    { kind: 'move', rows: ajoute(K34M, ['D3'], ['C5']), cadre: 'bas-gauche', accept: ['C4', 'E4', 'C9'],
      text: 'À toi : tsuke, kosumi (un pas en diagonale) ou pince (attaque de loin).',
      ok: 'Bien : c’est une des réponses classiques au kakari.', no: 'Tsuke : sous sa pierre. Kosumi : en diagonale de la tienne.',
      refus: [
        { points: ['B5'], no: 'Sur la 2e ligne, ta pierre ne protège rien.' },
        { points: ['C3'], no: COLLEE }
      ] },
    { kind: 'move', rows: ajoute(K34, ['C4', 'D3'], ['E3', 'E4']), cadre: 'bas-gauche', accept: ['D6', 'C6', 'C7', 'D5'],
      text: 'Blanc a monté. Étends-toi le long du bord.',
      ok: 'Bien : tes pierres gagnent de la place sur le côté.', no: 'Monte le long du bord gauche, sans toucher Blanc.',
      refus: [
        { points: ['D4', 'C3'], no: 'Trop lent : Blanc prend le côté avant toi.' },
        { points: ['E5'], no: 'Blanc coupe en D4 : tes pierres sont séparées.' },
        { points: ['F4'], no: 'Trop loin : Blanc coupe tes pierres, ou glisse dessous.' }
      ] }
  ] },
  { id: 'l9', title: 'Le filet', desc: 'Enfermer une pierre sans la toucher', steps: [
    { kind: 'info', rows: L_FILET, geste: { pose: 'E6' },
      demo: [{ pose: 'E6', couleur: 'B' }, { libs: 'E5' }, { pose: 'D5', couleur: 'W' }, { pose: 'D4', couleur: 'B' }, { pose: 'D6', couleur: 'W' }, { pose: 'C6', couleur: 'B' }, { pose: 'D7', couleur: 'W' }],
      text: 'Atari au point vert ? Elle fuit vers une pierre blanche : sauvée.' },
    { kind: 'info', rows: L_FILET, geste: { pose: 'D6' },
      demo: [{ pose: 'D6', couleur: 'B' }, { libs: 'E5' }, { pose: 'D5', couleur: 'W' }, { pose: 'D4', couleur: 'B' }, { pose: 'E6', couleur: 'W' }, { pose: 'F6', couleur: 'B' }],
      text: 'Filet (geta) : ferme ses sorties au point vert, sans la toucher.' },
    { kind: 'move', rows: L_FILET_Q, accept: ['F4', 'G4', 'F3'],
      text: 'À toi : prends la pierre marquée dans un filet.',
      ok: 'Filet ! Elle a encore deux libertés, mais plus aucune sortie.', no: 'Ne la touche pas : ferme de loin ses deux sorties.',
      refus: [{ points: ['F5', 'E4'], no: 'En atari, elle s’allonge et l’échelle casse : elle s’échappe.' }] }
  ] },
  { id: 'l10', title: 'La prise en retour', desc: 'Donner une pierre pour en prendre trois', steps: [
    { kind: 'info', rows: L_RETOUR, geste: { pose: 'J5' },
      demo: [{ pose: 'J5', couleur: 'B' }, { libs: 'J5' }, { pose: 'H5', couleur: 'W' }],
      text: 'Pose au point vert. Ta pierre est en atari : c’est voulu.' },
    { kind: 'info', rows: L_RETOUR, avant: [{ pose: 'J5', couleur: 'B' }, { pose: 'H5', couleur: 'W' }], geste: { pose: 'J5' },
      demo: [{ libs: 'H5' }, { pose: 'J5', couleur: 'B' }],
      text: 'Blanc a pris, mais il est en atari. Reprends au point vert.' },
    { kind: 'move', rows: L_RETOUR_Q, accept: ['E9'],
      text: 'À toi : donne une pierre, puis prends-en trois.',
      ok: 'Prise en retour (snapback) ! Pas un ko : tu en prends trois.', no: 'Joue là où Blanc voudrait se relier, même si ta pierre est prise.',
      refus: [{ points: ['E8'], no: 'Atari du mauvais côté : Blanc joue E9 et se relie.' }] }
  ] },
  { id: 'l11', title: 'La course aux libertés', desc: 'Qui prend l’autre en premier', steps: [
    { kind: 'info', rows: L_COURSE, geste: { touche: ['D2', 'E2', 'F2'], no: 'Touche une des trois pierres blanches collées.' },
      demo: [{ libs: 'E2' }, { libs: 'H2' }],
      text: 'Course aux libertés (semeai) : groupes sans œil. Touche le blanc, on compte.' },
    { kind: 'info', rows: L_COURSE, geste: { pose: 'D1' },
      demo: [{ pose: 'D1', couleur: 'B' }, { libs: 'E2' }, { pose: 'H1', couleur: 'W' }, { pose: 'E1', couleur: 'B' }, { pose: 'G1', couleur: 'W' }, { pose: 'F1', couleur: 'B' }],
      text: 'Trois contre trois. Tu joues d’abord : bouche le point vert.' },
    { kind: 'move', rows: L_COURSE_Q, accept: ['A1', 'B1'],
      text: 'À toi : bouche les libertés blanches, pas les tiennes.',
      ok: 'Blanc n’a plus qu’une liberté : tu gagnes la course.', no: 'Compte : il faut boucher une liberté de Blanc.',
      refus: [{ points: ['A4', 'B4'], no: 'Tu bouches ta propre liberté : Blanc gagne la course.' }] }
  ] },
  { id: 'l26', title: 'La course avec un œil', desc: 'L’œil se remplit en dernier', steps: [
    { kind: 'info', rows: L_OEIL, geste: { touche: ['A1'], no: 'Touche le point vide entouré par ton groupe, dans le coin.' },
      demo: [{ interdit: 'A1', couleur: 'W' }],
      text: 'Ton œil en A1 : Blanc ne peut y jouer qu’en dernier.' },
    { kind: 'info', rows: L_OEIL, geste: { pose: 'E2' }, demo: [{ pose: 'E2', couleur: 'B' }, { libs: 'D1' }],
      text: 'Bouche d’abord ses libertés du dehors, au point vert.' },
    { kind: 'quiz', rows: L_OEIL,
      text: 'Si Blanc joue le premier, qui gagne la course ?', choices: ['Toi', 'Blanc'], answer: 1,
      ok: 'Blanc : il bouche C1, ton groupe n’a plus que son œil.', no: 'Blanc bouche C1 : il ne te reste que l’œil, il le prend.' },
    { kind: 'move', rows: L_OEIL_Q, accept: ['E2', 'E1'],
      text: 'À toi : gagne la course. Garde ton œil pour la fin.',
      ok: 'Le dehors d’abord : Blanc ne peut pas toucher ton œil.', no: 'Bouche une liberté de Blanc qui ne touche pas ton groupe.',
      refus: [
        { points: ['G1'], no: 'Liberté commune : tu te mets en atari, Blanc prend en J1.' },
        { points: ['J1'], no: 'Tu bouches ton œil : Blanc prend en G1.' }
      ] }
  ] },
  { id: 'l12', title: 'Le faux œil', desc: 'Un œil qui ne compte pas', steps: [
    { kind: 'info', rows: L_FAUX, geste: { touche: ['D1', 'E1'], no: 'Touche une des deux pierres noires de droite.' },
      demo: [{ yeux: ['A1', 'C1'] }, { libs: 'D1' }],
      text: 'Deux yeux ? Touche D1 : elle n’est pas reliée au reste.' },
    { kind: 'info', rows: L_FAUX, geste: { pose: 'C1' },
      demo: [{ libs: 'D1' }, { pose: 'F1', couleur: 'W' }, { pose: 'C1', couleur: 'B' }, { pose: 'A1', couleur: 'W' }],
      text: 'D1 est en atari. Relie au point vert : un seul œil reste.' },
    { kind: 'touche', rows: L_FAUX_D2, accept: ['C1'],
      text: 'Touche le faux œil (un œil que Blanc peut détruire).',
      ok: 'Oui, C1 : son coin D2 est blanc. Au bord, un seul coin suffit.', no: 'Regarde les coins (diagonales) de chaque œil.' },
    { kind: 'move', rows: L_FAUX_VIS, accept: ['D2'],
      text: 'À toi : fais deux vrais yeux avant Blanc.',
      ok: 'D2 relie tout : A1 et C1 sont deux vrais yeux. Tu vis.', no: 'Protège le coin de C1 avant que Blanc le prenne.',
      refus: [{ points: ['A1', 'C1'], no: 'Tu bouches un de tes yeux : il n’en reste qu’un.' }] },
    { kind: 'move', rows: L_FAUX_TUE, accept: ['F8'],
      text: 'À l’inverse : rends un œil blanc faux.',
      ok: 'Blanc n’a plus qu’un vrai œil : il est mort.', no: 'Prends le coin de l’œil blanc, là où ses pierres se séparent.' }
  ] },
  { id: 'l13', title: 'Le point vital', desc: 'Le milieu décide', steps: [
    { kind: 'info', rows: L_TROIS, geste: { pose: 'D1' }, demo: [{ pose: 'D1', couleur: 'B' }, { yeux: ['C1', 'E1'] }],
      text: 'Trois points en ligne : le milieu, au point vert, fait deux yeux.' },
    { kind: 'info', rows: L_TROIS, geste: { touche: ['D1'], no: 'Touche le point du milieu, entre les deux autres.' },
      demo: [{ pose: 'D1', couleur: 'W' }, { libs: 'D1' }],
      text: 'Touche le point vital. Si Blanc le prend, ton groupe meurt.' },
    { kind: 'move', rows: L_TROIS_TUE, accept: ['D9'],
      text: 'À toi : tue le groupe blanc marqué.',
      ok: 'Point vital ! Blanc ne fera qu’un œil : il est mort.', no: 'Joue au milieu de l’espace blanc.',
      refus: [{ points: ['C9', 'E9'], no: 'À côté du milieu : Blanc y joue et fait deux yeux.' }] },
    { kind: 'move', rows: L_TROIS_VIS, accept: ['J3'],
      text: 'À toi : fais vivre ton groupe marqué.',
      ok: 'Deux yeux, J4 et J2 : ton groupe vit.', no: 'Prends le point du milieu avant Blanc.',
      refus: [{ points: ['J4', 'J2'], no: 'Au bout de l’espace : Blanc prend le milieu, tu meurs.' }] },
    { kind: 'info', rows: L_QUATRE, geste: { pose: 'E1' }, demo: [{ pose: 'D1', couleur: 'W' }, { pose: 'E1', couleur: 'B' }, { libs: 'D1' }],
      text: 'Quatre en ligne : si Blanc entre, réponds au point vert. Tu vis.' },
    { kind: 'quiz', rows: L_DEUX,
      text: 'Deux points seulement. Ce groupe noir peut-il vivre ?', choices: ['Oui, toujours', 'Oui, s’il joue', 'Non, jamais'], answer: 2,
      ok: 'Deux points ne font qu’un œil : ce groupe est mort.', no: 'Même si Noir joue le premier, il ne fait qu’un œil.' }
  ] },
  { id: 'l14', title: 'Le seki', desc: 'Vivre ensemble, sans yeux', steps: [
    { kind: 'info', rows: L_SEKI, geste: { touche: ['C1', 'E1'], no: 'Touche un point vide entre les pierres.' },
      demo: [{ libs: 'C2' }, { libs: 'B2' }],
      text: 'Seki (vie commune) : aucun œil, deux libertés partagées. Touches-en une.' },
    { kind: 'info', rows: L_SEKI, geste: { pose: 'C1' }, demo: [{ pose: 'C1', couleur: 'B' }, { pose: 'E1', couleur: 'W' }],
      text: 'Remplis au point vert : tu te mets en atari. Blanc prend tout.' },
    { kind: 'info', rows: L_SEKI, geste: { pose: 'E1' }, demo: [{ pose: 'C1', couleur: 'W' }, { pose: 'E1', couleur: 'B' }],
      text: 'Si Blanc remplit C1, c’est lui qui meurt. Prends au point vert.' },
    { kind: 'quiz', rows: L_SEKI,
      text: 'Personne ne joue ici. À qui sont C1 et E1 ?', choices: ['À Noir', 'À Blanc', 'À personne'], answer: 2,
      ok: 'À personne : en seki, ces points ne comptent pas.', no: 'Ni Noir ni Blanc ne peut les remplir sans mourir.' },
    { kind: 'move', rows: L_SEKI_Q, accept: ['E2'],
      text: 'À toi : sauve tes pierres marquées par un seki.',
      ok: 'Deux libertés partagées : personne ne peut attaquer. C’est seki.', no: 'Garde deux libertés partagées avec Blanc.',
      refus: [{ points: ['C1', 'E1'], no: 'Là, tu te mets en atari : Blanc prend.' }] }
  ] },
  { id: 'l17', title: 'Les formes d’yeux', desc: 'Le T, le carré, la grappe de cinq', steps: [
    { kind: 'info', rows: L_T_NOIR, geste: { pose: 'C1' }, demo: [{ pose: 'C1', couleur: 'B' }, { yeux: ['B1', 'C2', 'D1'] }],
      text: 'Espace en T : joue au centre, au point vert. Trois yeux !' },
    { kind: 'move', rows: L_T_BLANC, accept: ['G1'],
      text: 'À toi : tue le groupe blanc marqué.',
      ok: 'Le centre du T : Blanc ne fera qu’un œil. Il est mort.', no: 'Cherche le point qui touche les trois autres.',
      refus: [{ points: ['F1', 'H1', 'G2'], no: 'Blanc prend le centre : il a deux yeux.' }] },
    { kind: 'quiz', rows: L_CARRE,
      text: 'Carré de quatre. Noir joue le premier : peut-il vivre ?', choices: ['Oui', 'Non'], answer: 1,
      ok: 'Non. Après un coup dedans, Blanc prend le point vital : un seul œil.', no: 'Joue un coup dedans : Blanc prend le coin opposé, un seul œil.' },
    { kind: 'info', rows: L_GRAPPE_NOIR, geste: { pose: 'B1' }, demo: [{ pose: 'B1', couleur: 'B' }, { yeux: ['C1'] }, { zone: ['A1', 'A2', 'B2'] }],
      text: 'Cinq en grappe : le point vital est au point vert. Prends-le.' },
    { kind: 'move', rows: L_GRAPPE_BLANC, accept: ['H1'],
      text: 'À toi : tue ce groupe blanc de cinq points.',
      ok: 'Point vital pris : le point vital de Blanc est aussi le tien.', no: 'Cherche le point qui touche trois points vides.',
      refus: [{ points: ['G1', 'J1', 'H2', 'J2'], no: 'Blanc prend le point vital : il vit.' }] }
  ] },
  { id: 'l24', title: 'Agrandir ou réduire', desc: 'Le point au bord de l’espace', steps: [
    { kind: 'info', rows: L_ESPACE, geste: { pose: 'E1' }, demo: [{ pose: 'E1', couleur: 'B' }, { yeux: ['A1', 'B1', 'D1'] }],
      text: 'Prends le point vert, au bord : deux yeux, A1-B1 et D1.' },
    { kind: 'info', rows: L_ESPACE, geste: { touche: ['E1'], no: 'Touche le point vide au bord de ton espace, contre Blanc.' },
      demo: [{ pose: 'E1', couleur: 'W' }, { zone: ['A1', 'B1'] }],
      text: 'Si Blanc y joue d’abord, ton espace rétrécit : un seul œil.' },
    { kind: 'move', rows: L_ESPACE_Q, accept: ['E1'],
      text: 'À toi : réduis ce groupe blanc depuis l’extérieur.',
      ok: 'Réduit par le bord : Blanc n’a plus qu’un œil.', no: 'Cherche le point au bord de son espace, contre tes pierres.',
      refus: [{ points: ['F1', 'H1', 'J1'], no: 'Trop tôt dedans : Blanc prend E1 et vit.' }] },
    { kind: 'move', rows: L_ESPACE_V, accept: ['J5'],
      text: 'À toi : agrandis ton espace pour vivre.',
      ok: 'Le bord de ton espace est à toi : deux yeux.', no: 'Prends le point vide au bord de ton espace, contre Blanc.',
      refus: [{ points: ['J9', 'J8', 'J6'], no: 'Dedans, tu remplis ton espace : Blanc prend J5.' }] }
  ] },
  { id: 'l25', title: 'Les groupes du coin', desc: 'Le point du coin, et le ko', steps: [
    { kind: 'info', rows: L_COIN, geste: { pose: 'A2' }, demo: [{ pose: 'A2', couleur: 'B' }, { yeux: ['A1', 'B1', 'D1'] }],
      text: 'Dans le coin, le point vert décide. Prends-le : deux yeux.' },
    { kind: 'info', rows: L_COIN, geste: { pose: 'A1' },
      demo: [{ pose: 'A2', couleur: 'W' }, { pose: 'A1', couleur: 'B' }, { pose: 'B1', couleur: 'W' }, { interdit: 'A1', couleur: 'B' }],
      text: 'Blanc prend A2. Réponds au point vert : Blanc prend, c’est un ko.' },
    { kind: 'quiz', rows: L_COIN,
      text: 'Si Blanc joue A2 en premier, que se passe-t-il ?', choices: ['Tu vis', 'Tu meurs aussitôt', 'Un ko commence'], answer: 2,
      ok: 'Un ko : Blanc doit le gagner pour te prendre. Tant qu’il dure, tu n’es pas vivant.', no: 'Ni vivant, ni pris d’avance : tout dépend du ko.' },
    { kind: 'move', rows: L_COIN_Q, accept: ['J8'],
      text: 'À toi : fais vivre ton groupe dans le coin.',
      ok: 'Le point du coin est à toi : deux yeux.', no: 'Cherche le point du coin, sur le bord.',
      refus: [
        { points: ['H9'], no: 'Blanc prend J8 : un seul œil.' },
        { points: ['J9'], no: 'Blanc prend J8 : c’est un ko.' },
        { points: ['F9'], no: 'Tu bouches ton œil F9 : un seul œil reste.' }
      ] }
  ] },
  { id: 'l15', title: 'Finir la partie', desc: 'Dame, frontières, pierres mortes', steps: [
    { kind: 'info', rows: L_FIN_P, geste: { touche: ['E7'], no: 'Cherche le point vide entre Noir et Blanc.' }, demo: [{ zone: ['E7'] }],
      text: 'Dame (point neutre) : il touche Noir et Blanc. Touche-le.' },
    { kind: 'info', rows: L_FIN_P, geste: { pose: 'E7' }, demo: [{ pose: 'E7', couleur: 'B' }],
      text: 'Remplis-la au point vert : aucun point gagné, aucun perdu.' },
    { kind: 'move', rows: L_FIN_TROU, accept: ['E8'],
      text: 'Avant de passer : une frontière est ouverte. Ferme-la.',
      ok: 'Fermée au contact de Blanc : tous tes points comptent.', no: 'Cherche le trou entre ton territoire et Blanc.',
      refus: [{ points: ['D8'], no: 'Fermée, mais tu perds D8 : ferme au contact de Blanc.' }] },
    { kind: 'info', rows: L_FIN_P, geste: { touche: ['B2'], no: 'Cherche la pierre blanche, en bas à gauche.' }, demo: [{ libs: 'B2' }],
      text: 'Pierre morte : elle ne peut plus vivre. Touche-la, chez toi.' },
    { kind: 'quiz', rows: L_FIN_P,
      text: 'Faut-il capturer B2 avant de passer ?', choices: ['Oui', 'Non, je passe'], answer: 1,
      ok: 'Elle est morte : on la retire à la fin, comme un prisonnier.', no: 'Chaque coup chez toi coûte un point. Elle est déjà morte.' },
    { kind: 'quiz', rows: L_FIN_SANS, terr: true, compte: { pour: 'B', komi: 6.5, prises: [1, 0] },
      text: 'B2 retirée devient prisonnière. Combien de points pour Noir ?', choices: ['26', '27', '28'], answer: 1,
      ok: '26 de territoire + 1 prisonnier = 27.', no: 'Compte le territoire colorié, puis ajoute la prisonnière.' }
  ] },
  { id: 'l16', title: 'Compter une partie', desc: 'Mortes, territoire, prisonniers, komi', steps: [
    { kind: 'info', rows: L_COMPTE_P, geste: { touche: ['H8'], no: 'Cherche une pierre noire seule chez Blanc.' }, demo: [{ libs: 'H8' }],
      text: 'Fin de partie. Touche ta pierre morte, chez Blanc.' },
    { kind: 'touche', rows: L_COMPTE_P, accept: ['B2'],
      text: 'À toi : touche la pierre blanche morte.',
      ok: 'Oui : on retire les deux mortes. Chacune devient prisonnière.', no: 'Cherche une pierre blanche seule chez Noir.' },
    { kind: 'info', rows: L_COMPTE_SANS, demo: [{ terr: 'B' }, { terr: 'W' }],
      text: 'Mortes retirées. Compte avec moi : 26 points chacun.' },
    { kind: 'quiz', rows: L_COMPTE_SANS, terr: true, compte: { pour: 'B', komi: 6.5, prises: [8, 2] },
      text: 'Noir a 7 prisonniers, plus la morte. Combien de points ?', choices: ['33', '34', '40,5'], answer: 1,
      ok: '26 + 7 + 1 = 34.', no: 'Territoire plus prisonniers, morte comprise. Le komi va à Blanc.' },
    { kind: 'quiz', rows: L_COMPTE_SANS, terr: true, compte: { pour: 'W', komi: 6.5, prises: [8, 2] },
      text: 'Blanc a 1 prisonnier, plus la morte. Avec le komi ?', choices: ['28', '32,5', '34,5'], answer: 2,
      ok: '26 + 1 + 1 + 6,5 = 34,5.', no: 'Territoire, prisonniers, morte, puis le komi (6,5).' },
    { kind: 'quiz', rows: L_COMPTE_SANS,
      text: 'Noir 34, Blanc 34,5. Qui gagne ?', choices: ['Noir', 'Blanc', 'Égalité'], answer: 1,
      ok: 'Blanc, d’un demi-point. Le demi-point du komi évite les égalités.', no: '34,5 est plus grand que 34.' }
  ] },
  { id: 'l22', title: 'Sente et gote', desc: 'Le coup qui oblige à répondre', steps: [
    { kind: 'info', rows: L_SENTE, geste: { pose: 'E2' }, demo: [{ pose: 'E2', couleur: 'B' }, { atari: ['E1'] }, { pose: 'F1', couleur: 'W' }],
      text: 'Sente (coup qui oblige à répondre) : atari au point vert. Blanc relie.' },
    { kind: 'info', rows: L_SENTE, avant: [{ pose: 'E2', couleur: 'B' }, { pose: 'F1', couleur: 'W' }], geste: { pose: 'E9' }, demo: [{ pose: 'E9', couleur: 'B' }],
      text: 'Tu gardes la main : ferme aussi le haut, au point vert.' },
    { kind: 'info', rows: L_SENTE, geste: { pose: 'E9' }, demo: [{ pose: 'E9', couleur: 'B' }, { pose: 'E2', couleur: 'W' }],
      text: 'Gote (coup qui ne menace rien) : pose au point vert. Blanc se relie en E2.' },
    { kind: 'quiz', rows: L_SENTE_MIROIR,
      text: 'Ici, ton coup en E1 : sente ou gote ?', choices: ['Sente', 'Gote'], answer: 1,
      ok: 'Gote : il ne menace rien, Blanc peut jouer ailleurs.', no: 'Après E1, Blanc n’a rien à défendre : il joue ailleurs.' },
    { kind: 'move', rows: L_SENTE_MIROIR, accept: ['E8'],
      text: 'À toi : joue d’abord le coup sente.',
      ok: 'Atari : Blanc doit relier, puis tu fermes aussi le bas.', no: 'Cherche l’atari : Blanc devra répondre.',
      refus: [{ points: ['E1'], no: 'Gote d’abord : Blanc se relie en E8. Deux points de moins.' }] }
  ] },
  { id: 'l23', title: 'Le hane au premier rang', desc: 'Contourner, puis relier', steps: [
    { kind: 'info', rows: L_HANE, geste: { pose: 'E1' }, demo: [{ pose: 'E1', couleur: 'B' }, { pose: 'F1', couleur: 'W' }, { pose: 'D1', couleur: 'B' }],
      text: 'Hane (coup qui contourne une pierre) : pose au point vert. Blanc bloque, tu relies.' },
    { kind: 'move', rows: L_HANE_APRES, accept: ['D1'],
      text: 'Blanc bloque. Ta pierre est en atari : relie-la.',
      ok: 'Reliée. Grâce au hane, Blanc a un point de moins.', no: 'Joue sur la dernière liberté de ta pierre E1.',
      refus: [{ points: ['C1'], no: 'Blanc prend E1 en D1, et c’est un ko. Relie plutôt.' }] },
    { kind: 'quiz', rows: L_HANE,
      text: 'Ton hane, ou celui de Blanc en D1 : combien de points d’écart ?', choices: ['1', '2', '4'], answer: 1,
      ok: 'Deux : un point de plus pour toi, un de moins pour Blanc.', no: 'Compte les deux suites : chacun y perd ou gagne un point.' },
    { kind: 'move', rows: L_HANE_Q, accept: ['E1'],
      text: 'À toi : joue le hane au premier rang.',
      ok: 'Hane, puis tu relieras : Blanc recule d’un point.', no: 'Contourne la pierre blanche E2 par en dessous.',
      refus: [{ points: ['F1'], no: 'Tu bloques chez toi : un point de moins qu’avec le hane.' }] }
  ] },
  { id: 'l32', title: 'La valeur d’un coup', desc: 'Compter ce que chacun gagne', steps: [
    { kind: 'info', rows: L_VALEUR, geste: { pose: 'E9' }, demo: [{ pose: 'E9', couleur: 'B' }, { zone: ['C9', 'D9'] }],
      text: 'Prends les deux pierres au point vert. Compte ce que tu gagnes.' },
    { kind: 'info', rows: L_VALEUR, geste: { touche: ['E9'], no: 'Touche le point vide qui relie les deux pierres blanches.' },
      demo: [{ pose: 'E9', couleur: 'W' }],
      text: 'Touche E9 : si Blanc y relie d’abord, tu ne gagnes rien.' },
    { kind: 'quiz', rows: L_VALEUR,
      text: 'Prendre ou laisser relier : combien de points d’écart ?', choices: ['2', '4', '6'], answer: 1,
      ok: 'Quatre : deux prisonniers, plus deux points de territoire.', no: 'Compte les prisonniers, puis les points libérés en C9 et D9.' },
    { kind: 'move', rows: L_VALEUR_Q, accept: ['E1'],
      text: 'À toi : deux endroits restent ouverts. Joue le plus grand.',
      ok: 'Quatre points d’écart : plus que le hane, qui en vaut deux.', no: 'Compare : prendre deux pierres, ou le hane d’en haut.',
      refus: [{ points: ['E9', 'D9'], no: 'En haut, deux points d’écart. La prise en vaut quatre.' }] }
  ] },
  { id: 'l33', title: 'Le sente avant le gote', desc: 'Même petit, le sente passe d’abord', steps: [
    { kind: 'info', rows: L_ORDRE, geste: { pose: 'E2' }, demo: [{ pose: 'E2', couleur: 'B' }, { atari: ['E1'] }, { pose: 'F1', couleur: 'W' }],
      text: 'Deux endroits ouverts. D’abord l’atari au point vert : Blanc doit relier.' },
    { kind: 'info', rows: L_ORDRE, avant: [{ pose: 'E2', couleur: 'B' }, { pose: 'F1', couleur: 'W' }], geste: { pose: 'E9' },
      demo: [{ pose: 'E9', couleur: 'B' }, { zone: ['D9'] }],
      text: 'Tu as encore la main : prends la pierre au point vert.' },
    { kind: 'quiz', rows: L_ORDRE,
      text: 'Si tu prends d’abord en E9, où joue Blanc ?', choices: ['E2', 'F1'], answer: 0,
      ok: 'E2 : il sauve ses deux pierres. Ton sente est perdu.', no: 'Blanc n’a plus rien à défendre en F1 : il joue E2.' },
    { kind: 'quiz', rows: L_ORDRE,
      text: 'Sente d’abord, ou prise d’abord : combien de points d’écart ?', choices: ['0', '2', '4'], answer: 1,
      ok: 'Deux : avec le sente d’abord, tu as les deux endroits.', no: 'Compare : le sente d’abord te donne aussi la prise.' },
    { kind: 'move', rows: L_ORDRE_Q, accept: ['E8'],
      text: 'À toi : deux endroits ouverts. Joue dans le bon ordre.',
      ok: 'Sente d’abord : Blanc relie, puis tu prends la pierre.', no: 'Cherche le coup qui oblige Blanc à répondre.',
      refus: [{ points: ['E1'], no: 'La prise d’abord : Blanc sauve ses pierres en E8. Deux points de moins.' }] }
  ] },
  { id: 'l18', title: 'Les bonnes formes', desc: 'Bouche du tigre et bambou', steps: [
    { kind: 'touche', rows: L_COUPE, accept: ['D5'],
      text: 'Point de coupe : Blanc y sépare tes pierres. Touche-le.',
      ok: 'Oui, D5 : si Blanc y joue, tes deux pierres sont coupées.', no: 'Cherche le point vide qui touche tes deux pierres.' },
    { kind: 'info', rows: L_COUPE, geste: { pose: 'C5' },
      demo: [{ pose: 'C5', couleur: 'B' }, { pose: 'D5', couleur: 'W' }, { libs: 'D5' }, { pose: 'D6', couleur: 'B' }],
      text: 'Bouche du tigre (trois pierres autour d’un vide) : pose au point vert. Blanc entre ? Pris.' },
    { kind: 'move', rows: L_COUPE_Q, accept: ['B7', 'C8'],
      text: 'À toi : protège le point de coupe par une bouche du tigre.',
      ok: 'Si Blanc coupe en C7, il est aussitôt en atari.', no: 'Pose une pierre qui touche le point de coupe C7, sans le remplir.',
      refus: [{ points: ['C7'], no: 'Ça relie, mais c’est lourd. La bouche du tigre relie de plus loin.' }] },
    { kind: 'info', rows: L_BAMBOU, geste: { pose: 'D5' }, demo: [{ pose: 'C5', couleur: 'W' }, { pose: 'D5', couleur: 'B' }],
      text: 'Bambou : deux passages. Blanc en prend un ? Prends l’autre au point vert.' },
    { kind: 'move', rows: L_BAMBOU_Q, accept: ['G5'],
      text: 'Blanc entre dans ton bambou. Relie tes pierres marquées.',
      ok: 'Relié : un bambou ne se coupe jamais.', no: 'Prends l’autre passage du bambou.' }
  ] },
  { id: 'l19', title: 'Les pierres qui coupent', desc: 'Prends celles qui séparent tes groupes', steps: [
    { kind: 'info', rows: L_COUPANTE, geste: { pose: 'E5' }, demo: [{ libs: 'E6' }, { pose: 'E5', couleur: 'B' }],
      text: 'Cette pierre blanche coupe tes pierres. Prends-la au point vert.' },
    { kind: 'info', rows: L_COUPANTE, avant: [{ pose: 'E5', couleur: 'B' }], demo: [{ zone: ['E6'] }, { interdit: 'E6', couleur: 'W' }],
      text: 'Diamant (ponnuki) : Blanc ne peut plus entrer. Tes pierres tiennent ensemble.' },
    { kind: 'move', rows: L_COUPANTE_Q, accept: ['E5'],
      text: 'Deux pierres blanches en atari. Prends celle qui coupe.',
      ok: 'Tes pierres marquées tiennent ensemble. Blanc n’a qu’une pierre inutile.', no: 'Cherche la pierre blanche entre tes pierres marquées.',
      refus: [{ points: ['C3'], no: 'Elle ne coupe rien. Blanc sauve E6 et coupe tes pierres.' }] },
    { kind: 'move', rows: L_COUPANTE_Q2, accept: ['E5'],
      text: 'Deux pierres d’un côté, une de l’autre. Laquelle prendre ?',
      ok: 'La pierre qui coupe vaut plus que deux pierres inutiles.', no: 'Prends la pierre qui sépare tes pierres marquées.',
      refus: [{ points: ['D2'], no: 'Deux prisonniers, mais Blanc sauve E6 et coupe tes pierres.' }] }
  ] },
  { id: 'l20', title: 'Relier et mourir', desc: 'Quand se relier ne sauve rien', steps: [
    { kind: 'info', rows: L_RELIER, geste: { pose: 'F1' }, demo: [{ pose: 'F1', couleur: 'B' }, { pose: 'D1', couleur: 'W' }, { libs: 'D1' }],
      text: 'Atari au point vert. Blanc relie ? Tout reste en atari.' },
    { kind: 'info', rows: L_RELIER, avant: [{ pose: 'F1', couleur: 'B' }, { pose: 'D1', couleur: 'W' }], geste: { pose: 'C1' }, demo: [{ pose: 'C1', couleur: 'B' }],
      text: 'Prends tout au point vert : cinq pierres pour une.' },
    { kind: 'move', rows: L_RELIER_Q, accept: ['C9'],
      text: 'À toi : prends les pierres marquées, même si Blanc relie.',
      ok: 'Relier en F9 ne laisse qu’une liberté : tu prends tout.', no: 'Mets les pierres marquées en atari, du côté du bord libre.',
      refus: [{ points: ['F9'], no: 'Atari du mauvais côté : Blanc prend ta pierre en G9.' }] },
    { kind: 'quiz', rows: L_RELIER,
      text: 'Après ton atari en F1, Blanc doit-il relier ?', choices: ['Oui', 'Non, il abandonne E1'], answer: 1,
      ok: 'Bien vu : relier perd cinq pierres, abandonner n’en perd qu’une.', no: 'Relier laisse une seule liberté : Blanc perdrait cinq pierres.' }
  ] },
  { id: 'l21', title: 'Le manque de libertés', desc: 'Quand relier met en atari', steps: [
    { kind: 'info', rows: L_MANQUE, geste: { pose: 'E1' }, demo: [{ pose: 'E1', couleur: 'B' }, { libs: 'C1' }],
      text: 'Bouche au point vert la seule liberté extérieure de Blanc.' },
    { kind: 'info', rows: L_MANQUE, avant: [{ pose: 'E1', couleur: 'B' }], geste: { pose: 'A2' },
      demo: [{ pose: 'B1', couleur: 'W' }, { atari: ['B1'] }, { pose: 'A2', couleur: 'B' }],
      text: 'Manque de libertés : relier le met en atari. Prends au point vert.' },
    { kind: 'quiz', rows: L_MANQUE_APRES,
      text: 'Blanc relie en A2. Combien de libertés lui reste-t-il ?', choices: ['0', '1', '2'], answer: 1,
      ok: 'Une seule, B1 : tu prends six pierres.', no: 'Compte les points vides autour du groupe relié.' },
    { kind: 'move', rows: L_MANQUE_Q, accept: ['E1'],
      text: 'À toi : bouche sa liberté extérieure. Il ne pourra plus relier.',
      ok: 'Relier le mettrait en atari : Blanc est pris.', no: 'Cherche la seule liberté de Blanc hors de sa forme.' }
  ] },
  { id: 'l34', title: 'Relier par en dessous', desc: 'Le watari, au premier rang', steps: [
    { kind: 'info', rows: L_WATARI, geste: { pose: 'E1' }, demo: [{ pose: 'E1', couleur: 'B' }],
      text: 'Watari (relier par en dessous) : glisse sous la pierre blanche, au point vert.' },
    { kind: 'info', rows: L_WATARI, avant: [{ pose: 'E1', couleur: 'B' }], geste: { pose: 'D2' },
      demo: [{ pose: 'D1', couleur: 'W' }, { pose: 'D2', couleur: 'B' }, { atari: ['D1'] }],
      text: 'Blanc coupe en D1 ? Pose au point vert : il est en atari.' },
    { kind: 'move', rows: L_WATARI_D2, accept: ['D1'],
      text: 'Blanc coupe en D2. Relie tes pierres au premier rang.',
      ok: 'Relié : s’il joue C1, il est aussitôt en atari.', no: 'Joue à côté de ta pierre E1, sous la coupe.',
      refus: [{ points: ['C1'], no: 'Blanc joue en D1 : tes pierres restent coupées.' }] },
    { kind: 'move', rows: L_WATARI_M, accept: ['E1'],
      text: 'À toi : relie tes pierres par en dessous.',
      ok: 'Watari : Blanc ne peut plus couper sans être pris.', no: 'Glisse au premier rang, sous la pierre blanche.',
      refus: [{ points: ['F2'], no: 'Blanc bloque en E1 : tes pierres restent coupées.' }] }
  ] },
  { id: 'l35', title: 'Couper par en dessous', desc: 'Bloquer le premier rang', steps: [
    { kind: 'info', rows: L_DESSOUS, geste: { pose: 'E1' }, demo: [{ pose: 'E1', couleur: 'B' }],
      text: 'Blanc veut passer par en dessous. Coupe-le au point vert.' },
    { kind: 'info', rows: L_DESSOUS, avant: [{ pose: 'E1', couleur: 'B' }], geste: { pose: 'F1' },
      demo: [{ pose: 'E2', couleur: 'W' }, { pose: 'F1', couleur: 'B' }],
      text: 'Blanc pousse en E2 ? Bloque au point vert : il reste coupé.' },
    { kind: 'quiz', rows: L_DESSOUS,
      text: 'Après E1, Blanc joue F1. Où coupes-tu ?', choices: ['E2', 'D1'], answer: 0,
      ok: 'E2 : E2 et F1 se répondent, Blanc ne passe pas.', no: 'Bloque l’autre passage, au-dessus de ta pierre E1.' },
    { kind: 'move', rows: L_DESSOUS_M, accept: ['E1'],
      text: 'À toi : empêche Blanc de relier ses pierres.',
      ok: 'Coupé au premier rang : E2 et D1 se répondent.', no: 'Coupe au premier rang, sous le passage E2.',
      refus: [{ points: ['E2', 'D1'], no: 'Blanc répond en E1 : tu ne coupes plus sans ko.' }] }
  ] },
  { id: 'l36', title: 'Couper, puis reprendre', desc: 'La coupe au premier rang', steps: [
    { kind: 'info', rows: L_REPRISE, geste: { pose: 'B1' }, demo: [{ pose: 'B1', couleur: 'B' }],
      text: 'Blanc veut passer en C1. Coupe d’abord au point vert.' },
    { kind: 'info', rows: L_REPRISE, avant: [{ pose: 'B1', couleur: 'B' }], geste: { pose: 'E1' },
      demo: [{ pose: 'C1', couleur: 'W' }, { pose: 'E1', couleur: 'B' }, { atari: ['C1'] }],
      text: 'Blanc relie en C1 ? Atari au point vert : cinq pierres en danger.' },
    { kind: 'info', rows: L_REPRISE, avant: [{ pose: 'B1', couleur: 'B' }, { pose: 'C1', couleur: 'W' }, { pose: 'E1', couleur: 'B' }],
      geste: { pose: 'B1' }, demo: [{ pose: 'A1', couleur: 'W' }, { pose: 'B1', couleur: 'B' }],
      text: 'Blanc prend B1 ? Reprends au point vert : prise en retour, six pierres.' },
    { kind: 'move', rows: L_REPRISE_M, accept: ['H1'],
      text: 'À toi : empêche Blanc de passer sous ta pierre.',
      ok: 'Coupé : relier le mettrait en atari, prendre finit en prise en retour.', no: 'Coupe au premier rang, au bout des pierres blanches.',
      refus: [{ points: ['E1', 'G1'], no: 'Blanc prend H1 : tu ne coupes plus sans ko.' }] }
  ] }
];
