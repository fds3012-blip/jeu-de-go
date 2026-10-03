// Revue v3 (#405) : notes du go, sur des positions construites coup par coup et des pertes choisies.
import { describe, expect, it } from 'vitest';
import { newPosition, play, type Position } from '../go/rules';
import { fromLabel } from '../go/coords';
import { facteurTaille, noterCoups, precision, seuilsKataGo, type AnalyseRevue, type NoteCoup } from './revue';
import { candidatsUniques, classerCoups, confirmeUnique, coupsCles, lignesBilan, MAX_CLES, raisonClassique, raisonForcee, type CoupNote } from './notation';

/** Joue une suite de coups (« E5 », « passe ») et renvoie l'historique. */
function partie(coups: string[], size = 9): Position[] {
  const h = [newPosition(size)];
  for (const c of coups) {
    const r = play(h[h.length - 1], c === 'passe' ? -1 : fromLabel(c, size));
    if (typeof r === 'string') throw new Error(`${c} : ${r}`);
    h.push(r);
  }
  return h;
}

/** Un point vide de `pos`, différent de `sauf` (pour les candidats). */
function vide(pos: Position, sauf: number[]): number {
  for (let p = pos.size * pos.size - 1; p >= 0; p--) if (!pos.board[p] && !sauf.includes(p)) return p;
  return -1;
}

/**
 * Analyses KataGo factices : `pertes[k]` est la perte du coup k + 1. Coup sans perte : il est le premier choix, et le
 * deuxième candidat perd `ecart` (0,8 par défaut). Coup qui perd : `meilleurs[k]` (ou un point vide) est le premier choix.
 */
function analysesK(positions: Position[], pertes: number[], o: { ecart?: Record<number, number>; meilleurs?: Record<number, string> } = {}): AnalyseRevue[] {
  const size = positions[0].size, out: AnalyseRevue[] = [];
  let L = 0;
  for (let k = 0; k < positions.length; k++) {
    const pos = positions[k], suite = positions[k + 1];
    if (!suite) { out.push({ lead: L, engine: 'katago', coups: [] }); break; }
    const s = pos.toPlay === 1 ? 1 : -1, joue = suite.lastMove ?? -1, perte = pertes[k] ?? 0;
    const apres = L - s * perte, lui = s * apres;
    const best = o.meilleurs?.[k] ? fromLabel(o.meilleurs[k], size) : vide(pos, [joue]);
    const coups = perte === 0
      ? [{ move: joue, visits: 40, lead: lui }, { move: vide(pos, [joue]), visits: 20, lead: lui - (o.ecart?.[k] ?? 0.8) }]
      : [{ move: best, visits: 40, lead: lui + perte }, { move: joue, visits: 20, lead: lui }];
    out.push({ lead: L, engine: 'katago', coups });
    L = apres;
  }
  return out;
}

/** Analyses du moteur simple : seulement l'avance, qui chute de `pertes[k]` après le coup k + 1. */
function analysesS(positions: Position[], pertes: number[]): AnalyseRevue[] {
  let L = 0;
  return positions.map((pos, k) => {
    const a: AnalyseRevue = { lead: L, engine: 'simple' };
    L -= (pos.toPlay === 1 ? 1 : -1) * (pertes[k] ?? 0);
    return a;
  });
}

const classer = (positions: Position[], analyses: AnalyseRevue[], uniques?: Set<number>) =>
  classerCoups(positions, analyses, noterCoups(positions, analyses), uniques);

describe('seuils selon la taille du plateau', () => {
  it('le facteur suit la racine du côté : 1, 1,2, 1,45', () => {
    expect(facteurTaille(9)).toBe(1);
    expect(facteurTaille(13)).toBeCloseTo(1.2, 1);
    expect(facteurTaille(19)).toBeCloseTo(1.45, 2);
    expect(seuilsKataGo(19).erreur).toBeCloseTo(8.72, 1);
  });

  it('2 points perdus : Imprécision en 9 × 9, seulement Bon en 19 × 19', () => {
    const p9 = partie(['E5', 'C3', 'G7']), p19 = partie(['K10', 'D4', 'Q16'], 19);
    expect(noterCoups(p9, analysesK(p9, [0, 0, 2]))[2]?.note).toBe('imprecision');
    expect(noterCoups(p19, analysesK(p19, [0, 0, 2]))[2]?.note).toBe('bon');
    // 7 points : Gaffe en 9 × 9, Erreur en 19 × 19.
    expect(noterCoups(p9, analysesK(p9, [0, 0, 7]))[2]?.note).toBe('grosse');
    expect(noterCoups(p19, analysesK(p19, [0, 0, 7]))[2]?.note).toBe('erreur');
  });

  it('la précision ramène les pertes au 9 × 9', () => {
    const notes: NoteCoup[] = [{ coup: 1, couleur: 1, note: 'erreur', perte: 4 }, { coup: 3, couleur: 1, note: 'bon', perte: 0 }];
    expect(precision(notes, 1, 9)).toBe(67);
    expect(precision(notes, 1, 19)!).toBeGreaterThan(precision(notes, 1, 9)!);
  });
});

describe('Classique : les coups d’ouverture connus', () => {
  it('reconnaît 3-3, 3-4 et 4-4 dans un coin vide, et le centre en 9 × 9', () => {
    const v9 = newPosition(9), v19 = newPosition(19);
    expect(raisonClassique(v9, fromLabel('C3', 9))).toBe('coin33');
    expect(raisonClassique(v9, fromLabel('D3', 9))).toBe('coin34');
    expect(raisonClassique(v9, fromLabel('E5', 9))).toBe('tengen');
    expect(raisonClassique(v19, fromLabel('D4', 19))).toBe('coin44');
    expect(raisonClassique(v19, fromLabel('C5', 19))).toBe('coin35');
    expect(raisonClassique(v19, fromLabel('D5', 19))).toBe('coin45');
    // Ni la première ligne, ni le centre d'un grand plateau.
    expect(raisonClassique(v19, fromLabel('A1', 19))).toBeUndefined();
    expect(raisonClassique(v19, fromLabel('K10', 19))).toBeUndefined();
    expect(raisonClassique(newPosition(13), fromLabel('D5', 13))).toBeUndefined();
  });

  it("reconnaît l'approche d'une pierre de coin adverse et la fermeture de son propre coin", () => {
    const h = partie(['Q16', 'D4'], 19);
    expect(raisonClassique(h[2], fromLabel('C6', 19))).toBe('approche');
    expect(raisonClassique(h[2], fromLabel('R14', 19))).toBe('fermeture');
    // Collé à la pierre adverse : pas une approche.
    expect(raisonClassique(h[2], fromLabel('D5', 19))).toBeUndefined();
  });

  it("note Classique les premiers coups de coin, même premiers choix de KataGo ; pas après l'ouverture", () => {
    const h = partie(['C3', 'G7', 'G3', 'C7', 'E5', 'E3', 'D6', 'F6', 'B8', 'H2']);
    const notes = classer(h, analysesK(h, []));
    expect(notes.slice(0, 4).map(n => n?.note)).toEqual(['classique', 'classique', 'classique', 'classique']);
    expect(notes[0]?.raison).toBe('coin33');
    expect(notes[4]?.raison).toBe('tengen');
    expect(notes[9]?.note).toBe('meilleur');
  });

  it("un coup de coin qui perd des points n'est pas Classique", () => {
    const h = partie(['C3', 'G7', 'G3']);
    expect(classer(h, analysesK(h, [0, 0, 4]))[2]?.note).toBe('erreur');
  });

  it('marche aussi avec le moteur simple (coup sûr, sans perte)', () => {
    const h = partie(['C3', 'G7']);
    expect(classer(h, analysesS(h, [0, 0]))[0]?.note).toBe('classique');
  });
});

// Noir E5-E6 entouré par Blanc ; Blanc E7 le met en atari (seule liberté : E4).
const ATARI = ['E5', 'D5', 'E6', 'F5', 'A1', 'D6', 'A2', 'F6', 'A3', 'E7'];

describe('Forcé : la réponse obligée à un atari', () => {
  it('sauver deux pierres en atari est Forcé, avec KataGo comme sans lui', () => {
    const h = partie([...ATARI, 'E4']);
    expect(raisonForcee(h, 11)).toBe('sauve');
    expect(classer(h, analysesK(h, []))[10]?.note).toBe('force');
    expect(classer(h, analysesS(h, []))[10]?.note).toBe('force');
  });

  it('jouer ailleurs pendant l’atari n’est pas Forcé', () => {
    const h = partie([...ATARI, 'J9']);
    expect(raisonForcee(h, 11)).toBeUndefined();
  });

  it('une réponse qui sauve mais perd des points garde sa note de perte', () => {
    const h = partie([...ATARI, 'E4']);
    const p = Array(11).fill(0); p[10] = 5;
    expect(classer(h, analysesK(h, p))[10]?.note).toBe('erreur');
  });
});

describe('Coup manqué', () => {
  it("après une Gaffe de l'adversaire, ton coup qui perd encore devient Coup manqué, avec les prises manquées", () => {
    // Blanc E5 est en atari après Noir E4 ; Blanc joue J9 (Gaffe), Noir joue A9 au lieu de prendre en E6.
    const g = partie(['D5', 'E5', 'F5', 'A1', 'E4', 'J9', 'A9', 'J8']);
    const pertes = [0, 0, 0, 0, 0, 7, 4];
    const notes = classer(g, analysesK(g, pertes, { meilleurs: { 6: 'E6' } }));
    expect(notes[5]?.note).toBe('grosse');
    expect(notes[6]?.note).toBe('manque');
    expect(notes[6]?.meilleur).toBe(fromLabel('E6', 9));
    expect(notes[6]?.prisesManquees).toBe(1);
  });

  it("sans erreur de l'adversaire juste avant, c'est une Erreur", () => {
    const g = partie(['D5', 'E5', 'F5', 'A1', 'E4', 'J9', 'A9']);
    expect(classer(g, analysesK(g, [0, 0, 0, 0, 0, 0, 4]))[6]?.note).toBe('erreur');
  });

  it('jamais sans KataGo', () => {
    const g = partie(['D5', 'E5', 'F5', 'A1', 'E4', 'J9', 'A9']);
    const notes = classer(g, analysesS(g, [0, 0, 0, 0, 0, 9, 5]));
    expect(notes.some(n => n?.note === 'manque')).toBe(false);
  });
});

describe('Gaffe', () => {
  it("une Erreur suivie de la prise d'un groupe de 3 pierres devient une Gaffe", () => {
    // Noir A9-B9-C9 sur le bord, Blanc C8 met en atari ; Noir joue J1, Blanc prend en D9.
    const h = partie(['A9', 'A8', 'B9', 'B8', 'C9', 'C8', 'J1', 'D9']);
    const notes = classer(h, analysesK(h, [0, 0, 0, 0, 0, 0, 4]));
    expect(notes[6]?.note).toBe('grosse');
    expect(notes[6]?.raison).toBe('groupePris');
    expect(notes[6]?.prisesApres).toBe(3);
  });

  it('une très grosse perte est une Gaffe', () => {
    const h = partie(['E5', 'C3', 'G7']);
    expect(classer(h, analysesK(h, [0, 0, 9]))[2]?.note).toBe('grosse');
  });
});

describe('Brillant « seul bon coup »', () => {
  const coups = ['C3', 'G7', 'G3', 'C7', 'E5', 'E3', 'D6', 'F6', 'B8', 'H2'];
  it('candidat : premier choix, toute autre réponse perd gros ; confirmé par une analyse longue', () => {
    const h = partie(coups);
    const a = analysesK(h, [], { ecart: { 8: 7 } });
    expect(candidatsUniques(h, a)).toEqual([9]);
    expect(confirmeUnique(a[8], fromLabel('B8', 9), 9)).toBe(true);
    expect(classer(h, a, new Set([9]))[8]?.note).toBe('brillant');
    // Sans confirmation : Meilleur coup.
    expect(classer(h, a)[8]?.note).toBe('meilleur');
  });

  it("pas de Brillant dans l'ouverture, ni sur un coup qui n'est que le premier choix", () => {
    const h = partie(coups);
    expect(candidatsUniques(h, analysesK(h, [], { ecart: { 2: 7 } }))).toEqual([]);
    expect(candidatsUniques(h, analysesK(h, []))).toEqual([]);
  });

  it("pas de Brillant pour une réponse forcée à l'atari", () => {
    const h = partie([...ATARI, 'E4']);
    expect(candidatsUniques(h, analysesK(h, [], { ecart: { 10: 8 } }))).toEqual([]);
  });

  it('jamais sans KataGo', () => {
    const h = partie(coups);
    const notes = classer(h, analysesS(h, []), new Set([9]));
    expect(notes.some(n => n?.note === 'brillant' || n?.note === 'meilleur')).toBe(false);
    expect(lignesBilan(false)).not.toContain('brillant');
    expect(lignesBilan(false)).not.toContain('manque');
    expect(lignesBilan(true)).toContain('manque');
  });
});

describe('Passe trop tôt', () => {
  it('une passe qui coûte des points est marquée, une passe de fin ne l’est pas', () => {
    const h = partie(['E5', 'C3', 'passe', 'D4', 'passe', 'passe']);
    const notes = classer(h, analysesK(h, [0, 0, 5]));
    expect(notes[2]?.passeTot).toBe(true);
    expect(notes[4]?.passeTot).toBeUndefined();
  });
});

describe('coups clés du parcours', () => {
  const n = (coup: number, note: CoupNote['note'], perte = 0, couleur: 1 | 2 = coup % 2 ? 1 : 2): CoupNote => ({ coup, couleur, note, perte });
  /** Notes alignées sur les coups (index 0 = coup 1), comme celles de la revue. */
  const alignees = (l: CoupNote[]) => { const o: (CoupNote | null)[] = []; for (const x of l) o[x.coup - 1] = x; return Array.from(o, x => x ?? null); };
  it('garde tes erreurs, tes 2 premiers classiques, 3 meilleurs coups et les gaffes de l’adversaire', () => {
    const notes = [n(1, 'classique'), n(2, 'classique'), n(3, 'classique'), n(4, 'meilleur'), n(5, 'classique'), n(6, 'grosse', 8),
      n(7, 'manque', 4), n(8, 'imprecision', 2), n(9, 'meilleur'), n(10, 'erreur', 4), n(11, 'meilleur'), n(13, 'meilleur'), n(15, 'meilleur'), n(17, 'bon', 1)];
    expect(coupsCles(alignees(notes), 1)).toEqual([1, 3, 6, 7, 9, 11, 13]);
    // Partie à deux : les deux camps.
    expect(coupsCles(alignees(notes), null)).toContain(10);
  });

  it('ajoute le moment clé et complète avec les imprécisions quand il y a peu de coups clés', () => {
    const notes = [n(1, 'bon', 1), n(2, 'bon'), n(3, 'imprecision', 2), n(5, 'imprecision', 2.5), n(7, 'bon', 1)];
    expect(coupsCles(alignees(notes), 1, 7)).toEqual([3, 5, 7]);
  });

  it(`jamais plus de ${MAX_CLES} coups clés : les pertes d'abord`, () => {
    const notes = Array.from({ length: 40 }, (_, k) => n(k + 1, k % 2 === 0 ? 'erreur' : 'bon', k % 2 === 0 ? 4 + k / 10 : 0));
    const c = coupsCles(notes, 1);
    expect(c).toHaveLength(MAX_CLES);
    expect(c[c.length - 1]).toBe(39);
  });
});
