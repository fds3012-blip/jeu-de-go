// Revue honnête (issue #186) : précision cohérente avec le score, moment clé (passes comprises), bilan sans
// « aucune erreur » après une défaite nette. Exemples tirés de l'analyse UX du 28/09 (docs/ux/analyses/2026-09-28-partie.md).
import { describe, expect, it } from 'vitest';
import { newPosition, play, type Position } from '../go/rules';
import { fromLabel } from '../go/coords';
import {
  avanceFinale, compteNotes, defaiteNette, momentCle, noterCoups, notesAvecCle, PERTES_DIFFUSES, phraseBilan, phraseMomentCle, plafondPrecision, precision,
  precisionHonnete, rejouerDici, type AnalyseRevue, type NoteCoup,
} from './revue';

function partie(coups: string[], size = 9): Position[] {
  const h = [newPosition(size)];
  for (const c of coups) {
    const r = play(h[h.length - 1], c === 'passe' ? -1 : fromLabel(c, size));
    if (typeof r === 'string') throw new Error(`${c} : ${r}`);
    h.push(r);
  }
  return h;
}
const simple = (lead: number): AnalyseRevue => ({ lead, engine: 'simple' });
const nc = (coup: number, couleur: 1 | 2, perte: number): NoteCoup => ({ coup, couleur, perte, note: perte > 2.5 ? 'imprecision' : 'solide' });
/** 40 coups de Noir presque parfaits aux yeux du moteur simple : la précision brute est flatteuse. */
const flatteuses: NoteCoup[] = Array.from({ length: 40 }, (_, k) => nc(2 * k + 1, 1, k % 8 === 0 ? 1 : 0));

describe('précision cohérente avec le score', () => {
  it("les exemples de l'analyse : la précision brute est flatteuse", () => {
    expect(precision(flatteuses, 1)).toBeGreaterThanOrEqual(97);
  });
  it('défaite de 20,5 points en 9 × 9 : 50 % au plus, et non 97 %', () => {
    expect(precisionHonnete(flatteuses, 1, -20.5, 9)).toBe(50);
  });
  it('défaite de 61,5 points : 50 % au plus, et non 99 %', () => {
    expect(precisionHonnete(flatteuses, 1, -61.5, 9)).toBe(50);
  });
  it('victoires de 1,5 et 38,5 points : la précision calculée, sans plafond', () => {
    expect(precisionHonnete(flatteuses, 1, 1.5, 9)).toBe(precision(flatteuses, 1));
    expect(precisionHonnete(flatteuses, 1, 38.5, 9)).toBe(precision(flatteuses, 1));
  });
  it('paliers : serrée (< 3) libre, puis 80, 65 et 50 %', () => {
    expect(plafondPrecision(-2.5, 9)).toBeNull();
    expect(plafondPrecision(-3, 9)).toBe(80);
    expect(plafondPrecision(-9.5, 9)).toBe(80);
    expect(plafondPrecision(-10, 9)).toBe(65);
    expect(plafondPrecision(-19.5, 9)).toBe(65);
    expect(plafondPrecision(-20, 9)).toBe(50);
    expect(plafondPrecision(null, 9)).toBeNull();
  });
  it('les écarts sont ramenés au 9 × 9 : 20 points en 19 × 19 est une défaite de moins de 10', () => {
    expect(plafondPrecision(-20, 19)).toBe(80);
    expect(plafondPrecision(-43, 19)).toBe(50);
    expect(plafondPrecision(-15, 13)).toBe(65);
  });
  it("le gagnant n'est pas plafonné, le perdant l'est (partie à deux)", () => {
    const n = [...flatteuses, nc(2, 2, 0)];
    expect(precisionHonnete(n, 2, -20.5, 9)).toBe(precision(n, 2));
    expect(precisionHonnete(n, 1, 20.5, 9)).toBe(precision(n, 1));
    expect(precisionHonnete(n, 2, 20.5, 9)).toBe(50);
  });
  it('un plafond ne remonte jamais une précision déjà basse', () => {
    expect(precisionHonnete([nc(1, 1, 8)], 1, -25, 9)).toBe(33);
  });
});

describe('avance finale', () => {
  it('lit le résultat chiffré du SGF', () => {
    expect(avanceFinale('W+20.5', 3)).toBe(-20.5);
    expect(avanceFinale('B+1.5', -4)).toBe(1.5);
    expect(avanceFinale('0', 5)).toBe(0);
  });
  it("sans résultat : l'estimation du moteur sur la dernière position", () => {
    expect(avanceFinale(undefined, -19)).toBe(-19);
    expect(avanceFinale(undefined, null)).toBeNull();
  });
  it("abandon : l'estimation, jamais avec le mauvais signe", () => {
    expect(avanceFinale('W+R', -12)).toBe(-12);
    expect(avanceFinale('W+R', 4)).toBeNull();
  });
  it('défaite nette à partir de 3 points ramenés au 9 × 9', () => {
    expect(defaiteNette(-20.5, 1, 9)).toBe(true);
    expect(defaiteNette(-2.5, 1, 9)).toBe(false);
    expect(defaiteNette(-20.5, 2, 9)).toBe(false);
    expect(defaiteNette(null, 1, 9)).toBe(false);
  });
});

describe('moment clé, passes comprises', () => {
  // 1 A1, 2 B1 (atari sur A1), 3 E5, 4 D5, 5 Noir passe, 6 Blanc prend A1 en A2.
  const h = partie(['A1', 'B1', 'E5', 'D5', 'passe', 'A2']);
  const a = [0, 1, 0, 1, 0, 0, -5].map(simple);

  it('la passe qui offre un coup gratuit est le moment clé, avec la pierre prise', () => {
    const cle = momentCle(h, a, 1)!;
    expect(cle).toMatchObject({ coup: 5, passe: true, prises: 1 });
    expect(cle.perte).toBeCloseTo(5);
    expect(phraseMomentCle(cle, h, 'Pomme')).toBe('Moment clé : ici, tu as passé. Pomme a pris une pierre. Rejoue ce coup !');
  });
  it('la passe coûteuse est aussi notée, au lieu de « Solide »', () => {
    const note = noterCoups(h, a)[4]!;
    expect(note.couleur).toBe(1);
    expect(note.perte).toBeCloseTo(5);
    expect(note.note).toBe('erreur');
  });
  it("« Rejouer d'ici » au moment clé repart de la position d'avant la passe, pas d'une partie vide", () => {
    const cle = momentCle(h, a, 1)!;
    const reprise = rejouerDici(h, cle.coup, 1);
    expect(reprise).toHaveLength(5);
    expect(reprise[reprise.length - 1].toPlay).toBe(1);
    expect(reprise[reprise.length - 1].board.filter(Boolean)).toHaveLength(4);
  });
  it('un coup joué qui laisse prendre des pierres', () => {
    const h2 = partie(['A1', 'B1', 'E5', 'D5', 'G7', 'A2']);
    const cle = momentCle(h2, a, 1)!;
    expect(cle).toMatchObject({ coup: 5, passe: false, prises: 1 });
    expect(phraseMomentCle(cle, h2, 'Pomme')).toBe('Moment clé : ici, tu as joué G7. Ensuite, Pomme a pris une pierre : environ 5 points perdus. Rejoue ce coup !');
  });
  it("une passe suivie de la passe de l'adversaire (fin de partie) n'est jamais le moment clé : le plateau n'a pas bougé", () => {
    const fin = partie(['A1', 'B1', 'E5', 'D5', 'passe', 'passe']);
    expect(momentCle(fin, [0, 1, 0, 1, 0, 0, -8].map(simple), 1)).toBeNull();
    expect(noterCoups(fin, [0, 1, 0, 1, 0, 0, -8].map(simple))[4]!.perte).toBe(0);
  });
  it('sous le seuil de bruit, pas de moment clé ; le premier coup est ignoré', () => {
    expect(momentCle(h, [0, 1, 0, 1, 0, 0, -3].map(simple), 1)).toBeNull();
    const h3 = partie(['E5', 'D5']);
    expect(momentCle(h3, [0, -10, -10].map(simple), 1)).toBeNull();
  });
  it('seulement les coups du joueur ; deux moteurs ne se comparent pas', () => {
    expect(momentCle(h, [0, 1, 0, 1, 0, 0, 20].map(simple), 1)).toBeNull();
    const mixte = [...a.slice(0, 6), { lead: -5, engine: 'katago' } as AnalyseRevue];
    expect(momentCle(h, mixte, 1)).toBeNull();
  });
  it('au moment clé, la note et la précision suivent Mochi : plus de « Solide » ni de 100 % (fiche des stores, 28/09)', () => {
    const h2 = partie(['A1', 'B1', 'E5', 'D5', 'G7', 'A2']);
    const brutes = noterCoups(h2, a);
    const cle = momentCle(h2, a, 1)!;
    // Le coup seul ne perd rien, toute la perte vient de la réponse de Pomme. Avant #424, la note de base disait
    // « Solide » ; les deux mesures se contredisent, elle n'en donne plus (jamais « Solide » par défaut).
    expect(brutes[4]).toBeNull();
    expect(precision(brutes, 1)).toBe(100);
    const notes = notesAvecCle(brutes, cle, a);
    expect(notes[4]).toMatchObject({ coup: 5, couleur: 1, note: 'erreur' });
    expect(notes[4]!.perte).toBeCloseTo(cle.perte);
    expect(precision(notes, 1)).toBeLessThan(100);
    expect(compteNotes(notes, 1).solide).toBe(compteNotes(brutes, 1).solide);
    // Les autres coups ne bougent pas ; sans moment clé, rien ne change.
    expect(notes.filter((_, k) => k !== 4)).toEqual(brutes.filter((_, k) => k !== 4));
    expect(notesAvecCle(brutes, null, a)).toBe(brutes);
  });
  it('au moment clé avec KataGo : au moins une Imprécision', () => {
    const k = (lead: number): AnalyseRevue => ({ lead, engine: 'katago' });
    const n: NoteCoup[] = [{ coup: 1, couleur: 1, note: 'bon', perte: 1 }];
    expect(notesAvecCle(n, { coup: 1, perte: 3, passe: false, prises: 0 }, [k(0)])[0]!.note).toBe('imprecision');
    expect(notesAvecCle(n, { coup: 1, perte: 7, passe: false, prises: 0 }, [k(0)])[0]!.note).toBe('grosse');
  });
  it('à la plus grosse perte', () => {
    const h4 = partie(['A1', 'B1', 'E5', 'D5', 'passe', 'A2', 'G7', 'C7']);
    const cle = momentCle(h4, [0, 1, 0, 1, 0, 0, -5, -5, -12].map(simple), 1)!;
    expect(cle.coup).toBe(7);
    expect(cle.perte).toBeCloseTo(7);
  });
});

describe('bilan honnête', () => {
  const zero = Array.from({ length: 20 }, (_, k) => nc(2 * k + 1, 1, 0));
  it('défaite de 20,5 : ni félicitations ni « aucune erreur »', () => {
    const t = phraseBilan(zero, 1, 'Pomme', { avanceNoir: -20.5, size: 9 });
    expect(t).toBe(`Tu perds de 20,5 points. ${PERTES_DIFFUSES}`);
    expect(t).not.toMatch(/Aucune erreur|Très belle|plus juste/);
  });
  it('défaite nette avec un moment clé : il est cité', () => {
    const t = phraseBilan(zero, 1, 'Pomme', { avanceNoir: -61.5, size: 9, cle: { coup: 26, perte: 12.4, passe: true, prises: 6 } });
    expect(t).toBe("Tu perds de 61,5 points. Ta passe au coup 26 t'a coûté 12 points : rejoue-le.");
  });
  it('défaite nette : la plus grosse erreur notée si elle dépasse le moment clé', () => {
    const n = [...zero, { coup: 43, couleur: 1, perte: 9, note: 'grosse' } as NoteCoup];
    expect(phraseBilan(n, 1, 'Pomme', { avanceNoir: -8, size: 9, cle: { coup: 20, perte: 5, passe: false, prises: 0 } }))
      .toBe("Tu perds de 8 points. Ton coup 43 t'a coûté 9 points : va le revoir.");
  });
  it('victoire de 1,5 : le bilan habituel', () => {
    expect(phraseBilan(zero, 1, 'Pomme', { avanceNoir: 1.5, size: 9 })).toBe('Très belle partie, tu as joué juste. Aucune erreur, continue comme ça !');
  });
  it('partie serrée perdue de 2,5 : pas de plafond, mais le moment clé remplace « aucune erreur »', () => {
    expect(phraseBilan(zero, 1, 'Pomme', { avanceNoir: -2.5, size: 9, cle: { coup: 12, perte: 4.2, passe: false, prises: 0 } }))
      .toBe("Très belle partie, tu as joué juste. Ton coup 12 t'a coûté 4 points : va le revoir.");
  });
});
