// Note de chaque coup (issue #71) : seuils, Brillant conservateur, pas de Meilleur ni de Brillant sans KataGo,
// précision, passe de fin de partie. Logique : revue.ts.
import { describe, expect, it } from 'vitest';
import { newPosition, play, type Position } from '../go/rules';
import { fromLabel } from '../go/coords';
import { candidatsBrillant, compteNotes, lisser, NOTE_INFO, NOTES, noterCoups, phraseBilan, precision, rienAPrendre, type AnalyseRevue, type NoteCoup } from './revue';

function partie(coups: string[], size = 9, depart = newPosition(size)): Position[] {
  const h = [depart];
  for (const c of coups) {
    const r = play(h[h.length - 1], c === 'passe' ? -1 : fromLabel(c, size));
    if (typeof r === 'string') throw new Error(`${c} : ${r}`);
    h.push(r);
  }
  return h;
}

const P = (c: string) => fromLabel(c, 9);
/** Analyse KataGo : avance de Noir et candidats (avance pour le joueur au trait). */
const kg = (lead: number, coups: [string, number, number][] = []): AnalyseRevue => ({ lead, engine: 'katago', coups: coups.map(([m, visits, l]) => ({ move: m === 'passe' ? -1 : P(m), visits, lead: l })) });
const simple = (lead: number): AnalyseRevue => ({ lead, engine: 'simple' });

describe('seuils avec KataGo', () => {
  // Un seul coup de Noir en E5, noté selon la chute de son avance (E5 hors des candidats de KataGo).
  const h = partie(['E5']);
  const note = (perte: number) => noterCoups(h, [kg(5, [['C3', 40, 5]]), kg(5 - perte)])[0]!;

  it('0,5 / 1,5 / 3 / 6 points', () => {
    expect(note(0).note).toBe('excellent');
    expect(note(0.5).note).toBe('excellent');
    expect(note(0.6).note).toBe('bon');
    expect(note(1.5).note).toBe('bon');
    expect(note(1.6).note).toBe('imprecision');
    expect(note(3).note).toBe('imprecision');
    expect(note(3.1).note).toBe('erreur');
    expect(note(6).note).toBe('erreur');
    expect(note(6.1).note).toBe('grosse');
    expect(note(20).perte).toBe(20);
  });

  it('un gain ne donne jamais une perte négative', () => {
    expect(note(-4)).toMatchObject({ perte: 0, note: 'excellent' });
  });

  it('le premier choix de KataGo, bien exploré, est « Meilleur coup »', () => {
    const n = noterCoups(h, [kg(5, [['E5', 30, 5], ['C3', 10, 4]]), kg(3)])[0]!;
    expect(n.note).toBe('meilleur');
  });

  it('premier choix trop peu exploré : pas de « Meilleur », la perte décide', () => {
    expect(noterCoups(h, [kg(5, [['E5', 3, 5]]), kg(4.8)])[0]!.note).toBe('excellent');
  });

  it("un candidat bien exploré prend sa perte dans l'arbre de recherche", () => {
    // Deuxième choix à 2 points du premier, même si l'analyse suivante (bruitée) dit 0.
    const n = noterCoups(h, [kg(5, [['C3', 40, 5], ['E5', 20, 3]]), kg(5)])[0]!;
    expect(n).toMatchObject({ note: 'imprecision', perte: 2 });
  });

  it('pour Blanc, une hausse de l’avance de Noir est une perte', () => {
    const h2 = partie(['E5', 'D5']);
    const n = noterCoups(h2, [kg(0), kg(2), kg(9)]);
    expect(n[1]).toMatchObject({ coup: 2, couleur: 2, note: 'grosse', perte: 7 });
  });

  it('positions non analysées ou moteurs différents : pas de note', () => {
    const h3 = partie(['E5', 'D5', 'C3']);
    expect(noterCoups(h3, [kg(0), null, kg(0), simple(0)])).toEqual([null, null, null]);
  });
});

describe('Brillant : zéro faux positif', () => {
  const h = partie(['E5', 'D5', 'G3']);
  // Avant G3 (coup 3, Noir) : KataGo préfère C3 (+2), puis C7, puis G7. G3 n'est pas dans son top 3.
  const avant = kg(2, [['C3', 40, 2], ['C7', 20, 1.5], ['G7', 10, 1]]);
  const base = [kg(6.5), kg(1), avant];

  it("candidat si le coup dépasse nettement le premier choix, puis confirmé par l'analyse longue", () => {
    const an = [...base, kg(3.5)];
    expect(candidatsBrillant(h, an)).toEqual([3]);
    expect(noterCoups(h, an)[2]!.note).not.toBe('brillant'); // pas encore confirmé
    expect(noterCoups(h, an, { 3: 3.2 })[2]).toMatchObject({ note: 'brillant', perte: 0 });
  });

  it("refusé si l'analyse longue ne confirme pas", () => {
    expect(noterCoups(h, [...base, kg(3.5)], { 3: 2.4 })[2]!.note).toBe('excellent');
  });

  it('refusé sans marge nette : égaler le premier choix ne suffit pas', () => {
    const an = [...base, kg(2.5)];
    expect(candidatsBrillant(h, an)).toEqual([]);
    expect(noterCoups(h, an, { 3: 5 })[2]!.note).toBe('excellent');
  });

  it('refusé si le coup est dans le top 3 de KataGo', () => {
    const an = [kg(6.5), kg(1), kg(2, [['C3', 40, 2], ['C7', 20, 1.5], ['G3', 10, 1]]), kg(4)];
    expect(candidatsBrillant(h, an)).toEqual([]);
    expect(noterCoups(h, an, { 3: 4 })[2]!.note).not.toBe('brillant');
  });

  it('refusé si la partie est déjà jouée, ou si KataGo a trop peu cherché', () => {
    expect(candidatsBrillant(h, [kg(6.5), kg(1), kg(20, [['C3', 40, 20]]), kg(30)])).toEqual([]);
    expect(candidatsBrillant(h, [kg(6.5), kg(1), kg(2, [['C3', 4, 2]]), kg(5)])).toEqual([]);
  });

  it('jamais pour une passe', () => {
    const hp = partie(['E5', 'D5', 'passe']);
    expect(candidatsBrillant(hp, [kg(6.5), kg(1), avant, kg(5)])).toEqual([]);
  });
});

describe('sans KataGo', () => {
  const h = partie(['E5', 'D5', 'C3', 'E4', 'G7']);

  it('ni « Meilleur » ni « Brillant » : « Solide » pour les faibles pertes', () => {
    const an = [0, 0.5, 0, 1, -1, 1].map(simple);
    const n = noterCoups(h, an, { 1: 50, 3: 50, 5: 50 });
    for (const x of n) expect(['meilleur', 'brillant', 'excellent', 'bon']).not.toContain(x!.note);
    expect(n.every(x => x!.note === 'solide')).toBe(true);
  });

  it('un pic isolé (bruit) est lissé : pas d’erreur', () => {
    // La position 3 est un pic à -9 : un seul tirage bruité, la courbe revient aussitôt.
    const an = [0, 0, 0, -9, 0, 0].map(simple);
    expect(lisser(an)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(noterCoups(h, an).map(x => x!.note)).toEqual(['solide', 'solide', 'solide', 'solide', 'solide']);
  });

  it('une vraie chute, qui dure, est notée au bon coup', () => {
    // Noir perd 10 points au coup 3, et ça reste.
    const an = [0, 0, 0, -10, -10, -10].map(simple);
    const n = noterCoups(h, an);
    expect(n[2]).toMatchObject({ coup: 3, note: 'grosse', perte: 10 });
    expect(n.filter(x => x!.note !== 'solide')).toHaveLength(1);
  });

  it('seuils élargis : 2,5 / 4 / 8', () => {
    const note = (perte: number) => noterCoups(partie(['E5']), [simple(0), simple(-perte)])[0]!.note;
    expect(note(2.5)).toBe('solide');
    expect(note(3)).toBe('imprecision');
    expect(note(4.5)).toBe('erreur');
    expect(note(8.5)).toBe('grosse');
  });
});

describe('passe en fin de partie', () => {
  // Fin de partie réelle sur 9 × 9, partagée en deux : murs noirs en C et D, murs blancs en E et F (36 pierres).
  function partage(): Position {
    const p = newPosition(9);
    for (let y = 0; y < 9; y++) { p.board[y * 9 + 2] = 1; p.board[y * 9 + 3] = 1; p.board[y * 9 + 4] = 2; p.board[y * 9 + 5] = 2; }
    return p;
  }

  it('rien à prendre : frontière fermée, pas d’atari', () => {
    expect(rienAPrendre(partage())).toBe(true);
  });

  it('il reste à prendre : frontière ouverte, atari, ou plateau encore vide', () => {
    const ouvert = partage();
    ouvert.board[4 * 9 + 3] = 0; ouvert.board[4 * 9 + 4] = 0; // un trou dans la frontière : 2 points neutres, encore des dame
    expect(rienAPrendre(ouvert)).toBe(true);
    ouvert.board[5 * 9 + 3] = 0; // trois points neutres : la frontière est ouverte
    expect(rienAPrendre(ouvert)).toBe(false);
    const atari = partage();
    atari.board[4 * 9 + 1] = 2; atari.board[4 * 9 + 0] = 1; atari.board[3 * 9 + 1] = 1; // pierre blanche chez Noir, en atari
    expect(rienAPrendre(atari)).toBe(false);
    expect(rienAPrendre(newPosition(9))).toBe(false);
    expect(rienAPrendre(partie(['E5'])[1])).toBe(false);
  });

  it("n'est jamais une erreur quand rien ne reste à prendre, même si le moteur simple bruite", () => {
    const h = partie(['passe', 'passe'], 9, partage());
    const n = noterCoups(h, [simple(0), simple(-9), simple(-9)]);
    expect(n[0]).toMatchObject({ note: 'solide', perte: 0 });
    const k = noterCoups(h, [kg(0, [['A1', 30, 0.2]]), kg(-7), kg(-7)]);
    expect(k[0]).toMatchObject({ note: 'excellent', perte: 0 });
  });

  it('une passe trop tôt reste une erreur', () => {
    const h = partie(['E5', 'passe']);
    expect(noterCoups(h, [kg(0), kg(-3, [['C3', 30, 3]]), kg(6)])[1]).toMatchObject({ note: 'grosse', perte: 9 });
  });
});

describe('précision et bilan', () => {
  const nc = (coup: number, couleur: 1 | 2, perte: number, note: NoteCoup['note'] = 'bon'): NoteCoup => ({ coup, couleur, perte, note });

  it('100 / (1 + perte moyenne / 4)', () => {
    expect(precision([nc(1, 1, 0), nc(3, 1, 0)], 1)).toBe(100);
    expect(precision([nc(1, 1, 1), nc(3, 1, 1)], 1)).toBe(80);
    expect(precision([nc(1, 1, 0), nc(3, 1, 4)], 1)).toBe(67);
    expect(precision([nc(1, 1, 4)], 1)).toBe(50);
    expect(precision([nc(2, 2, 1)], 1)).toBeNull();
  });

  it('une catastrophe est plafonnée à 12 points', () => {
    expect(precision([nc(1, 1, 60)], 1)).toBe(precision([nc(1, 1, 12)], 1));
  });

  it('compte les notes de chaque joueur, sans les coups non notés', () => {
    const n = [nc(1, 1, 0, 'meilleur'), nc(2, 2, 5, 'erreur'), null, nc(4, 2, 5, 'erreur')];
    expect(compteNotes(n, 1).meilleur).toBe(1);
    expect(compteNotes(n, 2).erreur).toBe(2);
    expect(Object.keys(compteNotes(n, 1))).toEqual(NOTES);
  });

  it('phrase de Mochi : cite la plus grosse erreur du joueur', () => {
    const n = [nc(1, 1, 0.2), nc(2, 2, 3), nc(3, 1, 7, 'grosse'), nc(4, 2, 1), nc(5, 1, 4, 'erreur')];
    expect(phraseBilan(n, 1, 'Pomme')).toBe("Partie difficile, ça arrive. Ton coup 3 t'a coûté 7 points : va le revoir.");
    const m = [nc(1, 1, 0), nc(2, 2, 0.5), nc(3, 1, 5, 'erreur'), nc(4, 2, 0.5), nc(5, 1, 0)];
    expect(phraseBilan(m, 1, 'Pomme')).toBe("Partie correcte. Ton coup 3 t'a coûté 5 points : va le revoir.");
  });

  it('phrase de Mochi : félicite sans erreur, et compare à l’adversaire', () => {
    expect(phraseBilan([nc(1, 1, 0), nc(2, 2, 2)], 1, 'Pomme')).toBe('Très belle partie, tu as joué juste. Aucune erreur, continue comme ça !');
    expect(phraseBilan([nc(1, 1, 2.5), nc(2, 2, 6)], 1, 'Pomme')).toBe('Tu as joué plus juste que Pomme. Aucune erreur, continue comme ça !');
    expect(phraseBilan([], 1)).toBe('Pas assez de coups pour faire le bilan.');
  });

  it('chaque note a un symbole, pas seulement une couleur', () => {
    expect(NOTES.map(n => NOTE_INFO[n].symbole)).toEqual(['!!', '★', '!', '✓', '✓', '?!', '?', '??']);
  });
});
