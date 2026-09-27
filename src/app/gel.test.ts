// Série protégée (issue #76) : gel de série du Go du jour, côté appareil.
import { describe, expect, it } from 'vitest';
import { GELS_MAX, RESERVE_VIDE, apresReussite, lireReserve, messageGel, reconcilier, type Reserve } from './gel';
import { numeroDuJour, serieVivante, textePartage, type Serie } from './goDuJour';

const avec = (gels: number): Reserve => ({ ...RESERVE_VIDE, gels });

/** Enchaîne `n` réussites à partir du jour `depuis`. */
function reussir(n: number, depuis = 1, reserve: Reserve = RESERVE_VIDE) {
  let serie: Serie | null = null, r = reserve, gagnes = 0;
  for (let j = depuis; j < depuis + n; j++) {
    const x = apresReussite(serie, r, j);
    serie = x.serie; r = x.reserve; if (x.gagne) gagnes++;
  }
  return { serie: serie!, reserve: r, gagnes };
}

describe('gagner un gel', () => {
  it('un gel tous les 7 jours de série', () => {
    expect(reussir(6).reserve.gels).toBe(0);
    const s7 = reussir(7);
    expect(s7.reserve.gels).toBe(1);
    expect(s7.gagnes).toBe(1);
    expect(reussir(14).reserve.gels).toBe(2);
  });

  it('plafond de 2 gels en réserve', () => {
    const s = reussir(21);
    expect(s.reserve.gels).toBe(GELS_MAX);
    expect(s.gagnes).toBe(2); // le 3e palier ne donne rien, donc pas d'événement
  });

  it('refaire le même jour ne redonne pas de gel', () => {
    const s = reussir(7);
    const x = apresReussite(s.serie, s.reserve, 7);
    expect(x.gagne).toBe(false);
    expect(x.reserve.gels).toBe(1);
  });
});

describe('jour manqué', () => {
  it('avec un gel : la série tient, le jour est gelé, le gel est consommé', () => {
    const { serie, reserve } = reussir(7); // jours 1 à 7, 1 gel
    // Jour 8 manqué, on revient le jour 9.
    const b = reconcilier(serie, reserve, 9);
    expect(b.utilises).toEqual([8]);
    expect(b.reserve.gels).toBe(0);
    expect(b.reserve.geles).toEqual([8]);
    expect(b.reserve.annonce).toBe(7);
    expect(serieVivante(b.serie, 9)).toBe(7);
    // La série continue normalement.
    const suite = apresReussite(b.serie, b.reserve, 9);
    expect(suite.serie.jours).toBe(8);
  });

  it('sans gel : la série repart à zéro', () => {
    const { serie, reserve } = reussir(5);
    const b = reconcilier(serie, reserve, 7);
    expect(b.utilises).toEqual([]);
    expect(serieVivante(b.serie, 7)).toBe(0);
    expect(apresReussite(b.serie, b.reserve, 7).serie.jours).toBe(1);
  });

  it('2 jours manqués avec 1 seul gel : la série est perdue, le gel reste en réserve', () => {
    const { serie, reserve } = reussir(7);
    const b = reconcilier(serie, reserve, 10); // jours 8 et 9 manqués
    expect(b.utilises).toEqual([]);
    expect(b.reserve.gels).toBe(1);
    expect(serieVivante(b.serie, 10)).toBe(0);
  });

  it('2 jours manqués avec 2 gels : les deux sont consommés', () => {
    const { serie, reserve } = reussir(14);
    const b = reconcilier(serie, reserve, 17);
    expect(b.utilises).toEqual([15, 16]);
    expect(b.reserve.gels).toBe(0);
    expect(serieVivante(b.serie, 17)).toBe(14);
  });

  it("aujourd'hui ou hier réussi : rien à geler", () => {
    const { serie, reserve } = reussir(7);
    expect(reconcilier(serie, reserve, 7).utilises).toEqual([]);
    expect(reconcilier(serie, reserve, 8).utilises).toEqual([]);
    expect(reconcilier(null, avec(2), 8).reserve.gels).toBe(2);
  });

  it('le texte de partage garde la même série', () => {
    const { serie, reserve } = reussir(7);
    const b = reconcilier(serie, reserve, 9);
    const s = apresReussite(b.serie, b.reserve, 9).serie;
    expect(textePartage(9, 1, s.jours).texte).toBe('Go du jour n° 9 · résolu en 1 essai · série 8 🔥');
  });
});

describe('frontières de jour et fuseaux (heure de Paris)', () => {
  it('23 h 59 et 0 h 00 à Paris sont deux jours différents', () => {
    const avant = numeroDuJour(new Date('2026-10-03T23:59:59+02:00'));
    const apres = numeroDuJour(new Date('2026-10-04T00:00:00+02:00'));
    expect(apres - avant).toBe(1);
    // Réussi le 3 à 23 h 59, revenu le 4 à 0 h 00 : pas de jour manqué.
    const serie = { dernier: avant, jours: 7 };
    expect(reconcilier(serie, avec(1), apres).utilises).toEqual([]);
  });

  it('un joueur qui change de fuseau suit toujours les jours de Paris', () => {
    // Réussi à Paris le 3 à 22 h ; il s'envole et rouvre l'appli à New York le 4 à 20 h (heure locale) = le 5 à 2 h à Paris.
    const j3 = numeroDuJour(new Date('2026-10-03T22:00:00+02:00'));
    const retour = numeroDuJour(new Date('2026-10-04T20:00:00-04:00'));
    expect(retour - j3).toBe(2);
    const b = reconcilier({ dernier: j3, jours: 7 }, avec(1), retour);
    expect(b.utilises).toEqual([j3 + 1]);
    expect(serieVivante(b.serie, retour)).toBe(7);
    // À Tokyo le 4 à 6 h (heure locale) = le 3 à 23 h à Paris : toujours le même jour, rien à geler.
    expect(numeroDuJour(new Date('2026-10-04T06:00:00+09:00'))).toBe(j3);
  });

  it("passage à l'heure d'hiver (25 octobre) : un seul jour de plus", () => {
    const a = numeroDuJour(new Date('2026-10-24T12:00:00+02:00'));
    const b = numeroDuJour(new Date('2026-10-25T23:30:00+01:00'));
    expect(b - a).toBe(1);
  });
});

describe('stockage et textes', () => {
  it('relit une réserve abîmée sans planter, et borne les gels', () => {
    expect(lireReserve(null)).toEqual(RESERVE_VIDE);
    expect(lireReserve({ gels: 9, geles: [3, 'x'], annonce: 12 })).toEqual({ gels: 2, geles: [3], annonce: 12 });
    expect(lireReserve({ gels: -1 }).gels).toBe(0);
  });

  it('message de Mochi', () => {
    expect(messageGel(12)).toBe('Ton gel a protégé ta série de 12 jours !');
  });
});
