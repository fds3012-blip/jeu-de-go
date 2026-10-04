// Cote de jeu (#417) : Glicko-2, barème, grade et départ. Les valeurs de référence sont aussi vérifiées côté serveur
// (supabase/tests/cote_glicko.test.sql) : le calcul du client et celui du serveur doivent rester identiques.
import { describe, expect, it } from 'vitest';
import {
  COTE_DECOUVRE, COTE_REGLES, DEPARTS, KYUS_CLUB, RD_DEPART, RD_MIN, RD_PROVISOIRE, VOL_DEPART,
  changementGrade, coteDepart, coteDuGrade, estProvisoire, glicko2Brut, gradeClub, gradeDe, partieClassee, rangGrade,
  rdApresAbsence, texteGrade, type Joueur
} from './cote';

const neuf = (cote = 800): Joueur => ({ cote, rd: RD_DEPART, vol: VOL_DEPART });

describe('Glicko-2', () => {
  it('exemple de Glickman (2013) : 1464,06 / 151,52 / 0,05999', () => {
    const r = glicko2Brut({ cote: 1500, rd: 200, vol: 0.06 }, [
      { cote: 1400, rd: 30, score: 1 }, { cote: 1550, rd: 100, score: 0 }, { cote: 1700, rd: 300, score: 0 }
    ]);
    expect(r.cote).toBeCloseTo(1464.05, 1);
    expect(r.rd).toBeCloseTo(151.52, 1);
    expect(r.vol).toBeCloseTo(0.05999, 4);
  });

  it('sans partie : seul l’écart de confiance grandit', () => {
    const r = glicko2Brut({ cote: 1500, rd: 50, vol: 0.06 }, []);
    expect(r.cote).toBe(1500);
    expect(r.rd).toBeCloseTo(51.07, 2);
  });

  it('première partie entre deux nouveaux : ±162, RD 290,32 (valeurs du test SQL)', () => {
    const r = partieClassee(neuf(), neuf());
    expect(r.gagnant).toEqual({ cote: 962, rd: 290.32, vol: 0.06, ecart: 162 });
    expect(r.perdant).toEqual({ cote: 638, rd: 290.32, vol: 0.06, ecart: -162 });
  });

  it('joueur sûr contre joueur provisoire : le sûr bouge peu, le provisoire beaucoup', () => {
    const r = partieClassee({ cote: 1500, rd: 80, vol: 0.06 }, { cote: 962, rd: 290.32, vol: 0.06 });
    expect(r.gagnant).toEqual({ cote: 1503, rd: 80.28, vol: 0.059999, ecart: 3 });
    expect(r.perdant).toEqual({ cote: 942, rd: 274.69, vol: 0.06, ecart: -20 });
  });

  it('absence de 95 jours : 3 périodes, RD 80 → 82,01 ; exploit contre un 1er kyu', () => {
    expect(rdApresAbsence(80, 0.06, 95)).toBeCloseTo(82.01, 2);
    expect(rdApresAbsence(80, 0.06, 29)).toBe(80);
    expect(rdApresAbsence(300, 0.06, 9000)).toBe(RD_DEPART);
    const r = partieClassee({ cote: 1500, rd: 80, vol: 0.06 }, { cote: 2900, rd: 120, vol: 0.06 }, { gagnant: 95 });
    expect(r.gagnant).toEqual({ cote: 1537, rd: 82.67, vol: 0.060012, ecart: 37 });
    expect(r.perdant).toEqual({ cote: 2819, rd: 120.44, vol: 0.060013, ecart: -81 });
  });

  it('gagner fait monter, perdre fait descendre ; somme presque nulle entre égaux', () => {
    for (const rd of [60, 150, 350]) {
      const r = partieClassee({ cote: 1500, rd, vol: 0.06 }, { cote: 1500, rd, vol: 0.06 });
      expect(r.gagnant.ecart).toBeGreaterThan(0);
      expect(r.perdant.ecart).toBe(-r.gagnant.ecart);
    }
  });

  it('cote provisoire pendant environ 10 parties, puis sûre ; RD jamais sous le plancher', () => {
    let j = neuf();
    const adv = { cote: 800, rd: 80, vol: 0.06 };
    const provisoires: boolean[] = [];
    for (let i = 0; i < 40; i++) {
      const r = i % 2 ? partieClassee(adv, j) : partieClassee(j, adv);
      j = i % 2 ? r.perdant : r.gagnant;
      provisoires.push(estProvisoire(j.rd));
      expect(j.rd).toBeGreaterThanOrEqual(RD_MIN);
    }
    const premiereSure = provisoires.indexOf(false) + 1;
    expect(premiereSure).toBeGreaterThanOrEqual(8);
    expect(premiereSure).toBeLessThanOrEqual(13);
    expect(provisoires.slice(premiereSure)).not.toContain(true);
  });

  it('bornes : jamais sous 0 ni au-dessus de 4000', () => {
    expect(partieClassee({ cote: 3990, rd: 350, vol: 0.06 }, { cote: 3990, rd: 350, vol: 0.06 }).gagnant.cote).toBeLessThanOrEqual(4000);
    expect(partieClassee({ cote: 10, rd: 350, vol: 0.06 }, { cote: 10, rd: 350, vol: 0.06 }).perdant.cote).toBe(0);
  });

  it('seuil de provisoire', () => {
    expect(estProvisoire(RD_PROVISOIRE + 0.01)).toBe(true);
    expect(estProvisoire(RD_PROVISOIRE)).toBe(false);
  });
});

describe('barème : 100 points = 1 grade, cote = 3000 − 100 × kyu', () => {
  it.each([
    [0, 'kyu', 30], [-50, 'kyu', 30], [99, 'kyu', 30], [100, 'kyu', 29], [300, 'kyu', 27], [800, 'kyu', 22],
    [1500, 'kyu', 15], [1599, 'kyu', 15], [2899, 'kyu', 2], [2900, 'kyu', 1], [2999, 'kyu', 1],
    [3000, 'dan', 1], [3099, 'dan', 1], [3100, 'dan', 2], [3800, 'dan', 9], [4000, 'dan', 9]
  ] as const)('%i → %s %i', (cote, sorte, n) => {
    expect(gradeDe(cote)).toEqual({ sorte, n });
  });

  it('cote d’entrée de chaque grade, et rang croissant', () => {
    expect(coteDuGrade({ sorte: 'kyu', n: 15 })).toBe(1500);
    expect(coteDuGrade({ sorte: 'kyu', n: 30 })).toBe(0);
    expect(coteDuGrade({ sorte: 'dan', n: 1 })).toBe(3000);
    expect(coteDuGrade({ sorte: 'dan', n: 9 })).toBe(3800);
    let avant = 0;
    for (let c = 0; c <= 3800; c += 100) {
      const g = gradeDe(c);
      expect(coteDuGrade(g)).toBe(c);
      expect(rangGrade(g)).toBe(avant + 1);
      avant = rangGrade(g);
    }
  });

  it('texte : ordinaux en français, simples en anglais', () => {
    expect(texteGrade(gradeDe(1500))).toBe('15ᵉ\u00a0kyu');
    expect(texteGrade(gradeDe(2900))).toBe('1ᵉʳ\u00a0kyu');
    expect(texteGrade(gradeDe(3000))).toBe('1ᵉʳ\u00a0dan');
    expect(texteGrade(gradeDe(3800))).toBe('9ᵉ\u00a0dan');
    expect(texteGrade(gradeDe(1500), 'en')).toBe('15 kyu');
    expect(texteGrade(gradeDe(3000), 'en')).toBe('1 dan');
  });

  it('changement de grade : monte, descend ou rien', () => {
    expect(changementGrade(1590, 1610)).toEqual({ sens: 'monte', grade: { sorte: 'kyu', n: 14 } });
    expect(changementGrade(1610, 1590)).toEqual({ sens: 'descend', grade: { sorte: 'kyu', n: 15 } });
    expect(changementGrade(1510, 1590)).toBeNull();
    expect(changementGrade(2990, 3005)).toEqual({ sens: 'monte', grade: { sorte: 'dan', n: 1 } });
    expect(changementGrade(3850, 3950)).toBeNull();
  });
});

describe('point de départ', () => {
  it('trois choix ; les mêmes valeurs que le serveur', () => {
    expect(DEPARTS).toEqual(['decouvre', 'regles', 'club']);
    expect(coteDepart('decouvre')).toBe(COTE_DECOUVRE);
    expect(COTE_DECOUVRE).toBe(300);
    expect(coteDepart('regles')).toBe(COTE_REGLES);
    expect(COTE_REGLES).toBe(800);
    expect(coteDepart('club', 15)).toBe(1500);
    expect(coteDepart('club', 1)).toBe(2900);
    expect(coteDepart('club', 0)).toBe(3000);
    expect(coteDepart('club', 25)).toBe(500);
  });

  it('choix invalides refusés (comme le serveur, code JGR02)', () => {
    expect(coteDepart('club')).toBeNull();
    expect(coteDepart('club', 26)).toBeNull();
    expect(coteDepart('club', -1)).toBeNull();
    expect(coteDepart('club', 2.5)).toBeNull();
    expect(coteDepart('regles', 10)).toBeNull();
    expect(coteDepart('expert' as never)).toBeNull();
  });

  it('grades proposés en club : du 25ᵉ kyu au 1ᵉʳ dan, au grade choisi', () => {
    expect(KYUS_CLUB[0]).toBe(25);
    expect(KYUS_CLUB.at(-1)).toBe(0);
    expect(KYUS_CLUB).toHaveLength(26);
    for (const k of KYUS_CLUB) expect(gradeDe(coteDepart('club', k)!)).toEqual(gradeClub(k));
  });

  it('les départs tombent sur le bon grade', () => {
    expect(gradeDe(COTE_DECOUVRE)).toEqual({ sorte: 'kyu', n: 27 });
    expect(gradeDe(COTE_REGLES)).toEqual({ sorte: 'kyu', n: 22 });
  });
});
