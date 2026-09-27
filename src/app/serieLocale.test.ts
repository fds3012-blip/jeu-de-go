import { describe, expect, it } from 'vitest';
import { numeroDuJour, serieApres, type Serie } from './goDuJour';
import { RESERVE_VIDE, apresReussite, reconcilier } from './gel';
import { JOUR_INVITATION, inviterCompte, serieAffichee } from './serieLocale';
import { identite } from './identite';

// Dates simulées, à midi heure de Paris. Le 27/09/2026 est le Go du jour n° 1.
const jour = (iso: string) => numeroDuJour(new Date(`${iso}T12:00:00+02:00`));

describe('série sans compte (#161)', () => {
  it('compte dès le jour 1', () => {
    const n = jour('2026-09-27');
    const s = serieApres(null, n);
    expect(serieAffichee(null, s, n)).toBe(1);
  });

  it('tient jusqu’au lendemain minuit, puis retombe à 0 sans gel', () => {
    const s: Serie = { dernier: jour('2026-09-28'), jours: 2 };
    expect(serieAffichee(null, s, jour('2026-09-29'))).toBe(2); // pas encore joué aujourd'hui
    const b = reconcilier(s, RESERVE_VIDE, jour('2026-09-30'));
    expect(serieAffichee(null, b.serie, jour('2026-09-30'))).toBe(0);
  });

  it('trois jours de suite, fuseau de l’appareil sans effet (23 h 30 à Paris = 21 h 30 UTC)', () => {
    let s: Serie | null = null;
    for (const iso of ['2026-10-01T23:30:00+02:00', '2026-10-02T00:10:00+02:00', '2026-10-03T08:00:00+02:00']) {
      const n = numeroDuJour(new Date(iso));
      s = apresReussite(s, RESERVE_VIDE, n).serie;
    }
    expect(s).toEqual({ dernier: jour('2026-10-03'), jours: 3 });
    expect(serieAffichee(null, s, jour('2026-10-03'))).toBe(3);
  });

  it('un gel de l’appareil garde la série affichée', () => {
    const s: Serie = { dernier: jour('2026-10-03'), jours: 7 };
    const b = reconcilier(s, { gels: 1, geles: [], annonce: null }, jour('2026-10-05'));
    expect(serieAffichee(null, b.serie, jour('2026-10-05'))).toBe(7);
  });

  it('avec compte : la plus longue des deux séries', () => {
    const n = jour('2026-10-03');
    const local: Serie = { dernier: n, jours: 4 };
    expect(serieAffichee(1, local, n)).toBe(4);
    expect(serieAffichee(9, local, n)).toBe(9);
    expect(serieAffichee(2, null, n)).toBe(2);
    expect(serieAffichee(-3, null, n)).toBe(0);
  });
});

describe('invitation au compte', () => {
  it('au 3e jour, sans compte seulement', () => {
    expect(JOUR_INVITATION).toBe(3);
    expect(inviterCompte(false, 2)).toBe(false);
    expect(inviterCompte(false, 3)).toBe(true);
    expect(inviterCompte(false, 12)).toBe(true);
    expect(inviterCompte(true, 5)).toBe(false);
  });
});

describe('carte du Profil sans compte', () => {
  it('montre la série de l’appareil', () => {
    expect(identite(null, 2)).toMatchObject({ nom: 'Invité', serie: 2 });
    expect(identite(null, 0).serie).toBe(0);
  });
});
