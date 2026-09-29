// Import de SGF (issue #286). Fixtures écrites à la main au format réel d'OGS, de Fox et de KGS (en-têtes, propriétés,
// commentaires, variantes), avec des coups courts mais légaux.
import { campDuPseudo, decoderSgf, importerSgf, jeuDeCaracteres, komiLisible, MAX_COUPS, MAX_OCTETS, nettoyerNom } from './importSgf';
import { readSgf } from './sgf';
import { initialPosition, replay } from './replay';
import { fromSgf } from './coords';

// OGS : export « SGF » d'une partie classée 19 × 19, avec commentaires de chat, heures et BL/WL.
const OGS = `(;FF[4]
CA[UTF-8]
GM[1]
DT[2026-09-20]
PC[OGS: https://online-go.com/game/67000001]
GN[Partie amicale]
PB[florian_go]
PW[Takumi88]
BR[8k]
WR[7k]
TM[1200]OT[5x30 byo-yomi]
RE[W+R]
SZ[19]
KM[6.5]
RU[Japanese]
C[florian_go: bonne partie !
Takumi88: merci, toi aussi
]
;B[pd]BL[1195.2]
;W[dp]WL[1190.1]
;B[pq]
;W[dd]
;B[fc]C[Takumi88: hmm]
;W[cf]
;B[qk]
;W[jd]
)`;

// Fox (野狐) : en-tête AP[foxwq], noms, komi en centièmes de pierre, handicap 2 avec pierres AB, Blanc commence.
const FOX_HANDICAP = `(;GM[1]FF[4]
SZ[19]
GN[]
DT[2026-09-21]
PB[黑棋手]
PW[FloGo]
BR[5级]
WR[4级]
KM[0]HA[2]RU[Chinese]AP[GNU Go:3.8]RE[B+12.5]TM[600]TC[3]TT[30]AP[foxwq]RL[0]
AB[pd][dp]
;W[dd];B[pp];W[qf];B[nc];W[fq];B[dn]
)`;

// Fox, partie égale : KM[375] (3,75 pierres de compensation, soit 7,5 points).
const FOX_KM375 = `(;GM[1]FF[4]SZ[19]PB[Lune]PW[Soleil]KM[375]HA[0]RU[Chinese]AP[foxwq]RE[W+1.25]
;B[qd];W[dc];B[pq];W[dp];B[oc];W[qo]
)`;

// KGS (CGoban 3) : 13 × 13, sauts de ligne, commentaire échappé, variante en fin de partie (branche principale d'abord).
const KGS_VARIANTES = `(;GM[1]FF[4]CA[UTF-8]AP[CGoban:3]ST[2]
RU[Japanese]SZ[13]KM[6.50]TM[900]OT[5x30 byo-yomi]
PW[kuro]PB[shiro]WR[3k]BR[3k]DT[2026-09-22]PC[The KGS Go Server at http://www.gokgs.com/]RE[B+Time]
;B[jd]BL[895.0];W[dj]WL[893.1];B[dd];W[jj]C[kuro [3k\\]: gl
]
(;B[gg];W[gd];B[fd])
(;B[jg];W[jh]))`;

// OGS 9 × 9, passes notées [] puis [tt].
const OGS_9 = `(;FF[4]CA[UTF-8]GM[1]SZ[9]KM[7]PB[Alice]PW[Bob]RE[B+2]RU[Chinese]
;B[ee];W[gc];B[cg];W[cc];B[ge];W[];B[tt])`;

describe('import SGF : fichiers réels', () => {
  it('OGS 19 × 19 : noms, résultat, komi, commentaires ignorés', () => {
    const r = importerSgf(OGS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.partie).toMatchObject({ size: 19, komi: 6.5, black: 'florian_go', white: 'Takumi88', result: 'W+R', rules: 'japanese' });
    expect(r.coups).toBe(8);
    // Le SGF gardé est réécrit : plus de commentaires ni de propriétés de temps.
    expect(r.sgf).not.toContain('C[');
    expect(r.sgf).not.toContain('BL[');
    expect(readSgf(r.sgf).moves).toEqual(r.partie.moves);
  });

  it('Fox avec handicap : pierres AB posées, Blanc au trait, komi 0', () => {
    const r = importerSgf(FOX_HANDICAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.partie).toMatchObject({ size: 19, komi: 0, handicap: 2, black: '黑棋手', white: 'FloGo', rules: 'chinese' });
    expect(r.partie.setupBlack).toEqual([fromSgf('pd', 19), fromSgf('dp', 19)]);
    const depart = initialPosition(r.partie)!;
    expect(depart.toPlay).toBe(2);
    expect(depart.board.filter(c => c === 1)).toHaveLength(2);
    expect(r.partie.moves[0].color).toBe(2);
    // Relu depuis le SGF gardé, le handicap reste.
    expect(readSgf(r.sgf).setupBlack).toHaveLength(2);
  });

  it('Fox, komi en centièmes de pierre : KM[375] devient 7,5', () => {
    const r = importerSgf(FOX_KM375);
    expect(r.ok && r.partie.komi).toBe(7.5);
    expect(komiLisible(6.5)).toBe(6.5);
    expect(komiLisible(-3)).toBe(-3);
    expect(komiLisible(NaN)).toBe(6.5);
    expect(komiLisible(999)).toBe(6.5);
  });

  it('KGS 13 × 13 avec variantes : seule la branche principale est gardée', () => {
    const r = importerSgf(KGS_VARIANTES);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.partie.size).toBe(13);
    expect(r.coups).toBe(7);
    expect(r.partie.moves.at(-1)).toEqual({ color: 1, p: fromSgf('fd', 13) });
  });

  it('OGS 9 × 9 avec passes', () => {
    const r = importerSgf(OGS_9);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.partie.komi).toBe(7);
    expect(r.partie.moves.slice(-2).map(m => m.p)).toEqual([-1, -1]);
    expect(r.sgf).toContain(';W[tt];B[tt]');
  });

  it('accepte un en-tête avant la première parenthèse et un BOM', () => {
    expect(importerSgf(`${String.fromCharCode(0xfeff)}Téléchargé depuis un club\n${OGS_9}`).ok).toBe(true);
  });
});

describe('import SGF : fichiers refusés', () => {
  it('texte vide, pas un SGF, autre jeu', () => {
    expect(importerSgf('   ')).toEqual({ ok: false, raison: 'vide' });
    expect(importerSgf('Bonjour, voici ma partie')).toEqual({ ok: false, raison: 'format' });
    expect(importerSgf('(;GM[3]FF[4]SZ[8];B[ee])')).toEqual({ ok: false, raison: 'pas-go' });
    expect(importerSgf(';B[pd];W[dd]').ok).toBe(false);
  });

  it('taille de plateau non prise en charge', () => {
    expect(importerSgf('(;GM[1]SZ[15];B[aa])')).toEqual({ ok: false, raison: 'taille', taille: 15 });
  });

  it('coup hors plateau ou coordonnée cassée : numéro du coup donné', () => {
    expect(importerSgf('(;GM[1]SZ[9];B[zz])')).toEqual({ ok: false, raison: 'coordonnee', coup: 1 });
    expect(importerSgf('(;GM[1]SZ[9];B[ee];W[c])')).toEqual({ ok: false, raison: 'coordonnee', coup: 2 });
  });

  it('coup illégal : numéro du coup donné', () => {
    // Coup 3 : Noir rejoue sur la pierre de Noir en E5.
    expect(importerSgf('(;GM[1]SZ[9];B[ee];W[cc];B[ee])')).toEqual({ ok: false, raison: 'illegal', coup: 3 });
    // Suicide au coup 4 : Blanc en A1 entouré par Noir en B1 et A2.
    expect(importerSgf('(;GM[1]SZ[9];B[bi];W[ee];B[ah];W[ai])')).toEqual({ ok: false, raison: 'illegal', coup: 4 });
  });

  it('pierres d’installation en double', () => {
    expect(importerSgf('(;GM[1]SZ[9]AB[ee]AW[ee];W[cc])')).toEqual({ ok: false, raison: 'installation' });
  });

  it('partie sans coup', () => {
    expect(importerSgf('(;GM[1]FF[4]SZ[19]PB[a]PW[b])')).toEqual({ ok: false, raison: 'sans-coups' });
  });

  it('limites : taille du fichier et nombre de coups', () => {
    expect(importerSgf(OGS_9, MAX_OCTETS + 1)).toEqual({ ok: false, raison: 'trop-gros' });
    const trop = '(;GM[1]SZ[19]' + Array.from({ length: MAX_COUPS + 1 }, (_, i) => `;${i % 2 ? 'W' : 'B'}[tt]`).join('') + ')';
    expect(importerSgf(trop)).toEqual({ ok: false, raison: 'trop-long' });
  });
});

describe('import SGF : noms et camp', () => {
  it('nettoie les noms : contrôles, espaces, longueur', () => {
    expect(nettoyerNom('  Léa\n\t [1d] ')).toBe('Léa [1d]');
    expect(nettoyerNom('')).toBeUndefined();
    expect(nettoyerNom('x'.repeat(80))).toHaveLength(40);
    const r = importerSgf('(;GM[1]SZ[9]PB[<img src=x onerror=alert(1)>]PW[Bob];B[ee])');
    // Le nom reste du texte : React l'échappe à l'affichage, rien n'est interprété.
    expect(r.ok && r.partie.black).toBe('<img src=x onerror=alert(1)>');
  });

  it('propose le camp dont le nom correspond au pseudo', () => {
    expect(campDuPseudo({ black: 'florian_go', white: 'Takumi88' }, 'Florian-Go')).toBe(1);
    expect(campDuPseudo({ black: 'Lune', white: 'Léa' }, 'lea')).toBe(2);
    expect(campDuPseudo({ black: 'Lune', white: 'Soleil' }, 'Léa')).toBeNull();
    expect(campDuPseudo({ black: 'Léa', white: 'Léa' }, 'Léa')).toBeNull();
    expect(campDuPseudo({ black: 'Léa' }, null)).toBeNull();
  });
});

describe('import SGF : jeu de caractères', () => {
  it('lit CA et décode GB2312 (Fox)', () => {
    const utf8 = new TextEncoder().encode('(;GM[1]CA[UTF-8]SZ[9];B[ee])');
    expect(jeuDeCaracteres(utf8)).toBe('UTF-8');
    expect(decoderSgf(utf8)).toContain('B[ee]');
    // « 黑 » en GB2312 : 0xBA 0xDA.
    const gb = new Uint8Array([...new TextEncoder().encode('(;GM[1]CA[gb2312]SZ[9]PB['), 0xba, 0xda, ...new TextEncoder().encode('];B[ee])')]);
    const r = importerSgf(decoderSgf(gb));
    expect(r.ok && r.partie.black).toBe('黑');
    // Jeu inconnu : repli sur UTF-8.
    expect(decoderSgf(new TextEncoder().encode('(;CA[pas-un-jeu]SZ[9];B[ee])'))).toContain('B[ee]');
  });
});

// --- Suite de #286 : 6 fichiers de plus, écrits au format réel des serveurs (11 au total avec ceux du haut). ---

// KGS (CGoban 3), 19 × 19, handicap 4 : pierres AB, komi 0,5, Blanc commence, fin par deux passes [tt] et abandon noté.
const KGS_HANDICAP4 = `(;GM[1]FF[4]CA[UTF-8]AP[CGoban:3]ST[2]
RU[Japanese]SZ[19]HA[4]KM[0.50]TM[1800]OT[5x30 byo-yomi]
PW[Kenji]PB[Lea_75]WR[2k]BR[6k]DT[2026-09-23]PC[The KGS Go Server at http://www.gokgs.com/]RE[W+Resign]
AB[dd][pd][dp][pp]
;W[qn]WL[1795.2];B[nq]BL[1790.4];W[pj];B[fq];W[cj];B[jd];W[qf];B[qe];W[pf];B[nd];W[jp];B[tt];W[tt])`;

// OGS 13 × 13, handicap 3 en placement libre : AB puis PL[W], komi 0,5, commentaires sur plusieurs lignes.
const OGS_13_HANDICAP3 = `(;FF[4]
CA[UTF-8]
GM[1]
DT[2026-09-24]
PC[OGS: https://online-go.com/game/67000010]
GN[Friendly Match]
PB[petit_scarabee]
PW[sensei_bob]
BR[12k]
WR[5k]
RE[B+4.5]
SZ[13]
KM[0.5]
HA[3]
RU[Japanese]
AB[jd][dj][jj]
PL[W]
C[sensei_bob: have fun
petit_scarabee: merci !
]
;W[dd];B[cf];W[gc];B[jg];W[ck];B[dk];W[cj];B[ci]C[petit_scarabee: oups]
;W[bi];B[ch];W[gk];B[gj])`;

// Fox, fichier encodé en GB2312 (CA[gb2312]) : noms et commentaires chinois, komi Fox KM[375].
// Octets produits par Python : '(;GM[1]…PB[黑棋手]PW[白棋手]…C[对局开始];B[pd]…)'.encode('gb2312').
const FOX_GB2312_BASE64 = 'KDtHTVsxXUZGWzRdQ0FbZ2IyMzEyXUFQW2ZveHdxXVNaWzE5XUtNWzM3NV1IQVswXVJVW0NoaW5lc2VdUEJbutrG5crWXVBXW7DXxuXK1l1SRVtCK1JdQ1u21L7Wv6rKvF07QltwZF07V1tkZF07QltwcV07V1tkcF07QltmY11DW7rDxuVdO1dbY2ZdKQ==';
const foxGb2312 = () => decoderSgf(Uint8Array.from(atob(FOX_GB2312_BASE64), c => c.charCodeAt(0)));

// Revue OGS exportée avec variantes à plusieurs profondeurs (imbriquées) : la première branche est gardée partout.
const OGS_REVUE_VARIANTES = `(;FF[4]CA[UTF-8]GM[1]SZ[19]KM[6.5]PB[Noir]PW[Blanc]RU[Japanese]
;B[pd];W[dp]
(;B[pp];W[dd]
  (;B[fc]C[ligne de la partie];W[cf];B[jd])
  (;B[cf]C[variante];W[fc]))
(;B[dd]C[autre idée];W[pp](;B[fq])(;B[nq])))`;

// 9 × 9 avec un vrai ko : Blanc joue B8, Noir prend en C8 (ko), Blanc fait une menace, puis reprend en B8.
const KO_9 = `(;GM[1]FF[4]SZ[9]KM[7]RU[Chinese]PB[a]PW[b]
;B[ba];W[ca];B[ab];W[db];B[bc];W[cc];B[gg];W[bb];B[cb];W[gc];B[gd];W[bb])`;

// Vieux format (FF[1], cgoban 1) : noms de propriétés longs, minuscules et majuscules mêlées.
const FF1_LONG = `(;GaMe[1]FileFormat[1]SiZe[9]KoMi[5.5]PlayerBlack[ancien]PlayerWhite[club]
;Black[ee];White[cc];Black[gc];White[cg])`;

describe('import SGF : 11 fichiers réels lus sans erreur (#286)', () => {
  const fichiers: [string, () => string, number, number][] = [
    ['OGS 19 × 19', () => OGS, 19, 8],
    ['Fox handicap 2', () => FOX_HANDICAP, 19, 6],
    ['Fox KM[375]', () => FOX_KM375, 19, 6],
    ['KGS 13 × 13 variantes', () => KGS_VARIANTES, 13, 7],
    ['OGS 9 × 9 passes', () => OGS_9, 9, 7],
    ['KGS handicap 4', () => KGS_HANDICAP4, 19, 13],
    ['OGS 13 × 13 handicap 3', () => OGS_13_HANDICAP3, 13, 12],
    ['Fox GB2312', foxGb2312, 19, 6],
    ['OGS revue à variantes', () => OGS_REVUE_VARIANTES, 19, 7],
    ['9 × 9 avec ko', () => KO_9, 9, 12],
    ['FF[1] noms longs', () => FF1_LONG, 9, 4],
  ];
  it.each(fichiers)('%s', (_nom, sgf, taille, coups) => {
    const r = importerSgf(sgf());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.partie.size).toBe(taille);
    expect(r.coups).toBe(coups);
    // Le SGF gardé se relit à l'identique (aller-retour).
    const relu = importerSgf(r.sgf);
    expect(relu.ok && relu.partie).toEqual(r.partie);
  });

  it('KGS handicap 4 : 4 pierres noires, Blanc au trait, komi 0,5, passes à la fin', () => {
    const r = importerSgf(KGS_HANDICAP4);
    if (!r.ok) throw new Error(r.raison);
    expect(r.partie).toMatchObject({ handicap: 4, komi: 0.5, black: 'Lea_75', white: 'Kenji', result: 'W+Resign' });
    expect(initialPosition(r.partie)!.toPlay).toBe(2);
    expect(r.partie.moves.slice(-2)).toEqual([{ color: 1, p: -1 }, { color: 2, p: -1 }]);
  });

  it('OGS 13 × 13 handicap 3 : PL[W] respecté, commentaires retirés', () => {
    const r = importerSgf(OGS_13_HANDICAP3);
    if (!r.ok) throw new Error(r.raison);
    expect(r.partie).toMatchObject({ handicap: 3, komi: 0.5, toPlay: 2 });
    expect(r.partie.setupBlack).toEqual(['jd', 'dj', 'jj'].map(c => fromSgf(c, 13)));
    expect(r.sgf).toContain('PL[W]');
    expect(r.sgf).not.toContain('oups');
  });

  it('Fox GB2312 : noms chinois décodés, komi 7,5, commentaires retirés', () => {
    const r = importerSgf(foxGb2312());
    if (!r.ok) throw new Error(r.raison);
    expect(r.partie).toMatchObject({ black: '黑棋手', white: '白棋手', komi: 7.5, rules: 'chinese', result: 'B+R' });
    expect(r.sgf).not.toContain('好棋');
  });

  it('revue OGS à variantes imbriquées : seule la ligne principale reste', () => {
    const r = importerSgf(OGS_REVUE_VARIANTES);
    if (!r.ok) throw new Error(r.raison);
    expect(r.partie.moves.map(m => m.p)).toEqual(['pd', 'dp', 'pp', 'dd', 'fc', 'cf', 'jd'].map(c => fromSgf(c, 19)));
  });

  it('ko : la reprise après une menace est légale, la reprise immédiate est refusée avec son numéro', () => {
    const r = importerSgf(KO_9);
    if (!r.ok) throw new Error(r.raison);
    const fin = replay(r.partie);
    expect(fin.ok && fin.pos.board[fromSgf('bb', 9)]).toBe(2);
    expect(fin.ok && fin.pos.board[fromSgf('cb', 9)]).toBe(0);
    // Reprise immédiate du ko au coup 10 : interdite.
    expect(importerSgf(KO_9.replace(';W[gc];B[gd];W[bb])', ';W[bb])'))).toEqual({ ok: false, raison: 'illegal', coup: 10 });
  });

  it('FF[1] : noms de propriétés longs lus comme leurs majuscules', () => {
    const r = importerSgf(FF1_LONG);
    if (!r.ok) throw new Error(r.raison);
    expect(r.partie).toMatchObject({ komi: 5.5, black: 'ancien', white: 'club' });
  });
});

describe('import SGF : fichiers corrompus, message lisible (#286)', () => {
  it('fichier tronqué en plein coup : coordonnée illisible, avec le numéro du coup', () => {
    const tronque = OGS.slice(0, OGS.indexOf(';W[cf]') + 4);
    expect(tronque.endsWith(';W[c')).toBe(true);
    expect(importerSgf(tronque)).toEqual({ ok: false, raison: 'coordonnee', coup: 6 });
  });

  it('fichier tronqué entre deux coups : lu jusqu’au dernier coup complet', () => {
    const r = importerSgf(OGS.slice(0, OGS.indexOf(';W[cf]')));
    expect(r.ok && r.coups).toBe(5);
  });

  it('octets sans rapport (image renommée en .sgf) : format', () => {
    const png = String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d);
    expect(importerSgf(png)).toEqual({ ok: false, raison: 'format' });
  });

  it('crochets non fermés, parenthèses en trop : un refus, jamais une exception', () => {
    for (const t of ['(;GM[1]SZ[19];B[pd', '(((;', '(;SZ[19]C[\\]\\', ')(;B[aa])', '(;SZ[abc];B[aa])', '(;SZ[19];B[aa]AB[']) {
      expect(() => importerSgf(t)).not.toThrow();
    }
  });
});
