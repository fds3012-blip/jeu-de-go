// #528 : réglages avancés de la partie (handicap, komi, comptage) et reprise d'une partie interrompue.
import { describe, expect, it } from 'vitest';
import { estDefaut, handicapVoisin, komiDeLaPartie, lireReglagesPartie, REGLAGES_DEFAUT } from './reglagesPartie';
import { equilibrage, KOMI_DEBUTANT, KOMI_NORMAL } from './equilibrage';
import { DUREE_REPRISE_MS, lirePartieEnCours, type PartieEnCours } from './partieEnCours';
import { positionsDepuisSgf, sgfDepuisHistorique } from './revue';
import { handicapPoints, newPosition, play, type Position } from '../go/rules';
import { readSgf } from '../go/sgf';
import { fromLabel } from '../go/coords';

describe('réglages de la partie', () => {
  it('par défaut : rien ne change, le komi reste celui de l’équilibrage (première victoire inchangée)', () => {
    const r = lireReglagesPartie(null);
    expect(r).toEqual(REGLAGES_DEFAUT);
    expect(estDefaut(r)).toBe(true);
    for (const rang of [0, 1, 2, 3, 10]) expect(komiDeLaPartie(r, equilibrage(rang).komi)).toBe(equilibrage(rang).komi);
    expect(komiDeLaPartie(r, equilibrage(0).komi)).toBe(KOMI_DEBUTANT);
    expect(komiDeLaPartie(r, equilibrage(3).komi)).toBe(KOMI_NORMAL);
  });
  it('komi choisi, et 0,5 imposé avec un handicap', () => {
    expect(komiDeLaPartie({ handicap: 0, komi: 7.5, regles: 'chinese' }, KOMI_DEBUTANT)).toBe(7.5);
    expect(komiDeLaPartie({ handicap: 4, komi: 7.5, regles: 'chinese' }, KOMI_NORMAL)).toBe(0.5);
    expect(komiDeLaPartie({ handicap: 2, komi: 'auto', regles: 'japanese' }, KOMI_NORMAL)).toBe(0.5);
  });
  it('valeurs abîmées remplacées par celles par défaut', () => {
    expect(lireReglagesPartie({ handicap: 1, komi: 3, regles: 'aga' })).toEqual(REGLAGES_DEFAUT);
    expect(lireReglagesPartie({ handicap: 9, komi: 6.5, regles: 'chinese' })).toEqual({ handicap: 9, komi: 6.5, regles: 'chinese' });
    expect(lireReglagesPartie('x')).toEqual(REGLAGES_DEFAUT);
  });
  it('pas-à-pas du handicap : 0 ↔ 2, puis de 1 en 1, borné à 9', () => {
    expect(handicapVoisin(0, 1)).toBe(2);
    expect(handicapVoisin(2, -1)).toBe(0);
    expect(handicapVoisin(0, -1)).toBe(0);
    expect(handicapVoisin(8, 1)).toBe(9);
    expect(handicapVoisin(9, 1)).toBe(9);
  });
});

/** Partie à 4 pierres sur 9 × 9 : Blanc commence, puis quelques coups. */
function partieHandicap(): Position[] {
  const h: Position[] = [newPosition(9, handicapPoints(9, 4))];
  for (const l of ['E5', 'D5', 'E4', 'F4', 'passe']) {
    const r = play(h[h.length - 1], l === 'passe' ? -1 : fromLabel(l, 9));
    if (typeof r === 'string') throw new Error(r);
    h.push(r);
  }
  return h;
}

describe('SGF d’une partie à handicap (export et relecture)', () => {
  it('porte HA, AB et RU ; la relecture retrouve les pierres, le trait, la règle et le komi compté', () => {
    const h = partieHandicap();
    const sgf = sgfDepuisHistorique(h, 0.5, { noir: 'Toi', blanc: 'Caillou' }, 'chinese');
    expect(sgf).toContain('HA[4]');
    expect(sgf).toContain('RU[Chinese]');
    expect(sgf).toContain('KM[0.5]');
    expect(sgf).toMatch(/AB(\[[a-s]{2}\]){4}/);
    expect(sgf).not.toContain('PL[');
    const g = readSgf(sgf);
    expect(g.handicap).toBe(4);
    expect(g.setupBlack.sort()).toEqual([...handicapPoints(9, 4)].sort());
    expect(g.moves[0]).toEqual({ color: 2, p: fromLabel('E5', 9) });
    const r = positionsDepuisSgf(sgf);
    expect(r.positions.length).toBe(h.length);
    expect(r.positions[0].toPlay).toBe(2);
    expect(Array.from(r.positions.at(-1)!.board)).toEqual(Array.from(h.at(-1)!.board));
    expect(r).toMatchObject({ rules: 'chinese', handicap: 4, komiSgf: 0.5, komi: 4.5 });
  });
  it('sans handicap : rien ne change (ni HA ni AB, règle japonaise par défaut)', () => {
    const h = [newPosition(9)];
    const r = play(h[0], fromLabel('E5', 9));
    if (typeof r === 'string') throw new Error(r);
    const sgf = sgfDepuisHistorique([...h, r], 6.5);
    expect(sgf).toBe('(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese];B[ee])');
    expect(positionsDepuisSgf(sgf)).toMatchObject({ rules: 'japanese', handicap: 0, komi: 6.5 });
  });
});

describe('partie en cours gardée sur l’appareil', () => {
  const maintenant = Date.parse('2026-10-13T12:00:00Z');
  const base: PartieEnCours = {
    v: 1, sgf: sgfDepuisHistorique(partieHandicap(), 0.5, {}, 'japanese'), adversaire: 'caillou', taille: 9, komi: 0.5, aiKomi: 0.5,
    regles: 'japanese', handicap: 4, avantage: true, accommodant: false, coups: 5, date: '2026-10-13T11:00:00Z',
  };
  it('relue telle quelle', () => {
    expect(lirePartieEnCours(JSON.parse(JSON.stringify(base)), ['pomme', 'caillou'], maintenant)).toEqual(base);
  });
  it('oubliée si abîmée, d’un adversaire inconnu ou trop ancienne', () => {
    expect(lirePartieEnCours(null, ['caillou'], maintenant)).toBeNull();
    expect(lirePartieEnCours({ ...base, sgf: 'pas un sgf' }, ['caillou'], maintenant)).toBeNull();
    expect(lirePartieEnCours({ ...base, adversaire: 'inconnu' }, ['caillou'], maintenant)).toBeNull();
    expect(lirePartieEnCours({ ...base, taille: 11 }, ['caillou'], maintenant)).toBeNull();
    expect(lirePartieEnCours({ ...base, coups: 0 }, ['caillou'], maintenant)).toBeNull();
    expect(lirePartieEnCours(base, ['caillou'], Date.parse(base.date) + DUREE_REPRISE_MS + 1)).toBeNull();
  });
  it('le SGF gardé rejoue la partie jusqu’au dernier coup', () => {
    const { positions } = positionsDepuisSgf(base.sgf);
    expect(positions.length - 1).toBe(base.coups);
  });
});

describe('récit du score avec un handicap', () => {
  it('règle chinoise : la compensation rejoint Blanc avec le komi, et le récit le dit', async () => {
    const { recitScore, jetonsEtape, ligneCompensation, campsRecit, totauxEtapes } = await import('./score');
    const depart = newPosition(9, handicapPoints(9, 4));
    const r = recitScore(depart, 0.5, 'chinese', new Set(), 4);
    expect(r.compensation).toBe(4);
    expect(jetonsEtape(r, 3)).toEqual({ noir: 0, blanc: 4.5 });
    expect(totauxEtapes(r)[2]).toEqual({ noir: 81, blanc: 4.5 });
    expect(r.deuxieme).toEqual({ type: 'pierres', noir: 4, blanc: 0 });
    expect(ligneCompensation(r, campsRecit('Caillou'))).toBe('+4 pour Caillou : en règle chinoise, Blanc reçoit 1 point par pierre de handicap.');
    const jp = recitScore(depart, 0.5, 'japanese', new Set(), 4);
    expect(jp.compensation).toBe(0);
    expect(ligneCompensation(jp)).toBeNull();
  });
});
