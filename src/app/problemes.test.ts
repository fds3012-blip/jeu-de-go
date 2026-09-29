import { describe, expect, it } from 'vitest';
import { ETAT_INITIAL, noter, ouvrir } from './coteJoueur';
import { legendeSerie, niveau, prochainAMesure, suivant } from './problemes';

describe('niveau', () => {
  it('trois crans selon la difficulté', () => {
    expect(niveau(400)).toEqual({ mot: 'Facile', crans: 1 });
    expect(niveau(500)).toEqual({ mot: 'Moyen', crans: 2 });
    expect(niveau(749)).toEqual({ mot: 'Moyen', crans: 2 });
    expect(niveau(750)).toEqual({ mot: 'Difficile', crans: 3 });
  });
});

describe('suivant', () => {
  const l = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('le prochain pas réussi après le problème courant', () => {
    expect(suivant(l, l[0], new Set())).toBe(l[1]);
    expect(suivant(l, l[0], new Set(['b']))).toBe(l[2]);
  });
  it('revient au début, sans reproposer le problème courant', () => {
    expect(suivant(l, l[2], new Set())).toBe(l[0]);
    expect(suivant(l, l[2], new Set(['a', 'b']))).toBeUndefined();
  });
});

describe('legendeSerie', () => {
  it('accorde « jour »', () => {
    expect(legendeSerie(0)).toBe('jour de série');
    expect(legendeSerie(1)).toBe('jour de série');
    expect(legendeSerie(4)).toBe('jours de série');
  });
});

describe('prochainAMesure (#284)', () => {
  const liste = [300, 320, 340, 360, 380, 400, 420, 600].map((d, i) => ({ id: `p${i}`, difficulty: d }));
  const aucun = new Set<string>();
  const premier = { jour: 1, alea: () => 0 };

  it('ne propose jamais le Go du jour', () => {
    const sans = prochainAMesure(liste, ETAT_INITIAL, { ...premier, aReviser: aucun });
    expect(sans?.id).toBe('p0');
    expect(prochainAMesure(liste, ETAT_INITIAL, { ...premier, aReviser: aucun, goDuJour: 'p0' })?.id).toBe('p1');
  });

  it('laisse à la Révision du jour les problèmes réussis ou vus avec la réponse', () => {
    const aReviser = new Set(['p0', 'p1', 'p2']);
    for (let i = 0; i < 20; i++) {
      const p = prochainAMesure(liste, ETAT_INITIAL, { jour: 1, aReviser, alea: () => i / 20 });
      expect(aReviser.has(p!.id)).toBe(false);
    }
    expect(prochainAMesure(liste, ETAT_INITIAL, { ...premier, aReviser: new Set(liste.map(p => p.id)) })).toBeUndefined();
  });

  it('après un échec, le suivant est plus facile ; jamais le même deux fois de suite', () => {
    const pb = liste[5];
    const etat = noter(ouvrir({ ...ETAT_INITIAL, cote: 700 }, pb), pb, 'rate', 1);
    const suite = prochainAMesure(liste, etat, { ...premier, aReviser: aucun, eviter: pb.id });
    expect(suite!.id).not.toBe(pb.id);
    expect(suite!.difficulty).toBeLessThan(pb.difficulty);
  });
});
