// Répertoire d'ouvertures (#591) : fuseki (début de partie) et joseki (séquences de coin), pour débutants.
//
// Chargé à la demande avec l'écran « Ouvertures » (src/app/Ouvertures.tsx), jamais dans le JS initial.
// Textes (FR, EN) : src/content/i18n/ouvertures.ts. Lecture du SGF : src/go/ouvertures.ts.
//
// Rien n'est affirmé sans KataGo (réseau g170 b6c96, komi 6,5, règle japonaise, 800 / 400 visites, 4 symétries) :
// - chaque coup de la séquence, Noir comme Blanc, est à TOLERANCE_DEMO (1,5 point) au plus du meilleur coup du plateau
//   entier, jugé depuis la position juste avant lui ;
// - chaque erreur courante perd au moins MARGE (2 points) de plus que le coup qu'elle remplace (MARGE / 2 dans chaque
//   symétrie) ; `perte` est cet écart, arrondi ; `reponse` est la réplique de KataGo dans chaque symétrie.
// Preuves figées dans src/go/preuves-ouvertures.json (`npm run preuves-katago -- ouvertures`), rejouées sans le modèle
// par src/go/ouvertures.test.ts. Méthode et lignes écartées : docs/pedagogie/repertoire-ouvertures-2026-10.md.
//
// Pierres de départ : elles règlent le reste du plateau. En 19 × 19, les joseki se jouent dans le coin bas gauche,
// montré seul (cadre), comme les leçons l30 et l31.
import type { Ouverture } from '../go/ouvertures';

/** Pierres autour du joseki du hoshi : Noir D16, D4 et D10 (le côté gauche), Blanc Q4 et Q16. Blanc au trait. */
const HOSHI = 'AB[dd][dp][dj]AW[pp][pd]';
/** Autour du komoku : Noir Q4, Blanc Q16 et D16. Noir au trait. */
const KOMOKU = 'AB[pp]AW[pd][dd]';

export const OUVERTURES: readonly Ouverture[] = [
  // 9 × 9
  { id: 'n9-centre', taille: 9, sgf: '(;SZ[9];B[ee];W[ce];B[df];W[cf];B[dd])',
    erreurs: [{ coup: 0, c: 'bh', reponse: 'fd', perte: 7 }, { coup: 2, c: 'cg', reponse: 'df', perte: 2 }, { coup: 4, c: 'cd', reponse: 'dd', perte: 3 }] },
  { id: 'n9-coin', taille: 9, sgf: '(;SZ[9];B[df];W[fd];B[ff];W[dd])',
    erreurs: [{ coup: 0, c: 'ch', reponse: 'fd', perte: 3 }, { coup: 2, c: 'eh', reponse: 'cd', perte: 3 }],
    // Le 3-3 (C3) en premier coup : écarté, il perd plus de 1,5 point (docs/pedagogie/repertoire-ouvertures-2026-10.md).
    ecartes: [{ coup: 0, c: 'cg' }] },
  // 19 × 19 : fuseki
  // #672 : Noir Q16 et Q4, deux hoshi du même côté : le nirensei (leçon l50).
  { id: 'g-coins', taille: 19, sgf: '(;SZ[19];B[pd];W[dp];B[pp];W[dd])', lecon: 'l50',
    erreurs: [{ coup: 0, c: 'jj', perte: 4 }, { coup: 2, c: 'jj', perte: 3 }] },
  // #672 : ouvertures célèbres (docs/pedagogie/ouvertures-celebres-2026-10.md), chacune enseignée par une leçon.
  // Le sanrensei (trois hoshi), puis la réponse moderne de Blanc : le san-san tout de suite, bloqué côté moyo.
  { id: 'g-sanrensei', taille: 19, sgf: '(;SZ[19];B[pd];W[dp];B[pp];W[dd];B[pj];W[qq];B[qp])', lecon: 'l51',
    erreurs: [{ coup: 4, c: 'jj', perte: 2 }, { coup: 6, c: 'jj', perte: 4 }, { coup: 6, c: 'qr', perte: 4 }],
    // P3 (bloquer de loin) : 1,9 point de plus que R4, sous la marge : écarté (note pédagogique).
    ecartes: [{ coup: 6, c: 'oq' }] },
  // Le shin-fuseki de 1933 : le san-san en premier coup, puis un hoshi ; le tengen (Go Seigen) est jugé en erreur.
  { id: 'g-shin', taille: 19, sgf: '(;SZ[19];B[qc];W[dq];B[dd];W[pq];B[do])', lecon: 'l52',
    erreurs: [{ coup: 0, c: 'jj', perte: 3 }, { coup: 4, c: 'jj', perte: 3 }] },
  // Le fuseki chinois (bas) : hoshi, komoku, pierre du bord sur la 3e ligne ; la tsuke de Blanc au 4-4, et le hane.
  { id: 'g-chinois', taille: 19, sgf: '(;SZ[19];B[pd];W[dp];B[pq];W[dd];B[qk];W[pp];B[qp])', lecon: 'l53',
    erreurs: [{ coup: 4, c: 'jj', perte: 2 }, { coup: 6, c: 'qo', perte: 4 }],
    // Le chinois haut : la pierre du bord sur la 4e ligne.
    variantes: [{ coup: 4, c: 'pk' }] },
  { id: 'g-bords', taille: 19, sgf: '(;SZ[19]AB[pd][pp]AW[dp][dd];B[pj])',
    erreurs: [{ coup: 0, c: 'jj', perte: 2 }] },
  // 19 × 19 : joseki du hoshi
  { id: 'h-approche', taille: 19, cadre: 'bas-gauche', sgf: `(;SZ[19]${HOSHI};W[fq];B[dn];W[dr];B[cq];W[iq])`, lecon: 'l55',
    erreurs: [{ coup: 1, c: 'fr', reponse: 'eq', perte: 2 }], ailleurs: true },
  { id: 'h-sansan', taille: 19, cadre: 'bas-gauche', sgf: `(;SZ[19]${HOSHI};W[cq];B[cp];W[dq];B[ep];W[fq])`, lecon: 'l56',
    erreurs: [{ coup: 1, c: 'do', reponse: 'dq', perte: 3 }, { coup: 1, c: 'cr', reponse: 'dq', perte: 4 }], ailleurs: true },
  // #672 : le même san-san, Noir entre (leçon l56, l'élève joue Noir) : au 5e coup de la partie, comme AlphaGo.
  // Doublon de h-sansan pour la liste : absent du répertoire.
  { id: 'h-sansan-noir', taille: 19, cadre: 'bas-gauche', sgf: '(;SZ[19]AB[pd][pp]AW[dp][dd];B[cq];W[cp];B[dq];W[ep];B[fq])',
    lecon: 'l56', repertoire: false, ailleurs: true,
    erreurs: [{ coup: 2, c: 'dr', perte: 4 }, { coup: 2, c: 'bp', perte: 4 }, { coup: 4, c: 'gq', perte: 6 }],
    // L'approche F3 au lieu du san-san ; F2 au lieu de F3 pour finir.
    variantes: [{ coup: 0, c: 'fq' }, { coup: 4, c: 'fr' }] },
  // 19 × 19 : joseki du komoku
  { id: 'k-tsuke', taille: 19, cadre: 'bas-gauche', sgf: `(;SZ[19]${KOMOKU};B[cp];W[eq];B[dq];W[ep];B[dn])`,
    erreurs: [{ coup: 2, c: 'cq', perte: 4 }, { coup: 4, c: 'eo', reponse: 'dp', perte: 9 }] },
  // #672 : la kosumi D5 est celle de Shusaku (leçon l54).
  { id: 'k-kosumi', taille: 19, cadre: 'bas-gauche', sgf: `(;SZ[19]${KOMOKU};B[cp];W[eq];B[do];W[hq])`, lecon: 'l54',
    erreurs: [{ coup: 2, c: 'bo', perte: 4 }] },
];
