import { describe, expect, it } from 'vitest';
import { BONUS_CAPTURE, DELAI_E2E, DELAI_FIXE, DELAI_REPONSE, delaiReponse, messageContinue, PART_FORCEE } from './rythme';
import { raisonPoints } from '../engine/simple';
import { fromLabel } from '../go/coords';

describe('délai de réponse de Pomme (#187)', () => {
  it('reste entre 500 et 1 200 ms', () => {
    for (const h of [0, 0.1, 0.5, 0.99, 1]) {
      const d = delaiReponse({ hasard: h });
      expect(d).toBeGreaterThanOrEqual(DELAI_REPONSE.min);
      expect(d).toBeLessThanOrEqual(DELAI_REPONSE.max);
    }
    expect(delaiReponse({ hasard: 0 })).toBe(500);
    expect(delaiReponse({ hasard: 1 })).toBe(1200);
    expect(delaiReponse({ hasard: 7 })).toBe(1200); // tirage hors bornes ramené dans la fourchette
  });

  it('varie avec le tirage', () => {
    expect(delaiReponse({ hasard: 0.2 })).toBeLessThan(delaiReponse({ hasard: 0.8 }));
  });

  it('répond plus vite quand la réponse est forcée', () => {
    const max = DELAI_REPONSE.min + (DELAI_REPONSE.max - DELAI_REPONSE.min) * PART_FORCEE;
    expect(delaiReponse({ hasard: 1, forcee: true })).toBe(max);
    expect(delaiReponse({ hasard: 0.5, forcee: true })).toBeLessThan(delaiReponse({ hasard: 0.5 }));
  });

  it('attend 700 ms de plus après une capture du joueur', () => {
    expect(delaiReponse({ hasard: 0.5, capture: true }) - delaiReponse({ hasard: 0.5 })).toBe(BONUS_CAPTURE);
    expect(BONUS_CAPTURE).toBe(700);
  });

  it("revient à l'ancien délai fixe quand le drapeau est coupé", () => {
    expect(delaiReponse({ hasard: 0.9, respire: false })).toBe(DELAI_FIXE);
  });

  it('reste court en e2e, sans perdre la pause de la capture', () => {
    expect(delaiReponse({ hasard: 1, e2e: true })).toBe(DELAI_E2E);
    expect(delaiReponse({ hasard: 1, e2e: true, capture: true })).toBe(DELAI_E2E + BONUS_CAPTURE);
  });
});

describe('phrase de Mochi quand Pomme continue après ta passe', () => {
  it('reprend la raison du moteur', () => {
    expect(messageContinue('Pomme', raisonPoints(fromLabel('E4', 9), 1, 9))).toBe('Pomme continue : il reste un point à prendre en E4.');
  });
});
