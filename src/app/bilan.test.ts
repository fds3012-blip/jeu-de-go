import { describe, expect, it } from 'vitest';
import { battu, enregistrer, fin, finTropTot, PIERRES_PLATEAU_VIDE, komiDepuisUrl, leconMochi, lireBilan, suivant, texteBilan, texteCoups, type Bilan, type StatsPartie } from './bilan';
import { OPPONENTS } from '../engine';

const [pomme, caillou] = OPPONENTS;

describe('bilan', () => {
  it("compte victoires et défaites par adversaire, sans modifier le bilan d'entrée", () => {
    const b0: Bilan = {};
    const b1 = enregistrer(b0, 'pomme', true);
    const b2 = enregistrer(b1, 'pomme', false);
    const b3 = enregistrer(b2, 'caillou', false);
    expect(b0).toEqual({});
    expect(b3).toEqual({ pomme: { v: 1, d: 1 }, caillou: { v: 0, d: 1 } });
    expect(battu(b3, 'pomme')).toBe(true);
    expect(battu(b3, 'caillou')).toBe(false);
  });

  it('relit le stockage en ignorant les entrées invalides', () => {
    expect(lireBilan(null)).toEqual({});
    expect(lireBilan('x')).toEqual({});
    expect(lireBilan({ pomme: { v: 2, d: 1 }, caillou: { v: 'a' }, x: null })).toEqual({ pomme: { v: 2, d: 1 } });
  });
});

describe('adversaire suivant', () => {
  it("suit l'ordre de OPPONENTS", () => {
    expect(suivant(OPPONENTS, 'pomme')?.id).toBe('caillou');
    expect(suivant(OPPONENTS, OPPONENTS[OPPONENTS.length - 1].id)).toBeUndefined();
    expect(suivant(OPPONENTS, 'inconnu')).toBeUndefined();
  });
});

const stats = (s: Partial<StatsPartie> = {}): StatsPartie => ({ coups: 34, capturesMoi: 0, capturesAdv: 0, atarisSubis: 0, abandon: false, marge: 12.5, komi: 6.5, ...s });

describe('écran de fin', () => {
  it('victoire contre Pomme : on propose Caillou, bilan en une phrase', () => {
    const f = fin(pomme, 'victoire', stats({ capturesMoi: 3 }), { pomme: { v: 1, d: 0 } }, OPPONENTS);
    expect(f.cta).toBe('Défier Caillou');
    expect(f.cible).toBe('caillou');
    expect(f.mochi).toContain("Caillou t’attend");
    expect(f.lecon).toBeUndefined();
    expect(`${f.bilan.texte}${f.bilan.gras}.`).toBe('34 coups, 3 pierres capturées. Ton bilan contre Pomme : 1 victoire.');
  });

  it('victoires répétées : le bilan compte', () => {
    expect(fin(pomme, 'victoire', stats(), { pomme: { v: 3, d: 1 } }, OPPONENTS).bilan.gras).toBe('3 victoires, 1 défaite');
  });

  it('victoire contre le dernier adversaire : on rejoue contre lui', () => {
    const last = OPPONENTS[OPPONENTS.length - 1];
    const f = fin(last, 'victoire', stats(), { [last.id]: { v: 1, d: 0 } }, OPPONENTS);
    expect(f.cta).toBe(`Rejouer contre ${last.nom}`);
    expect(f.cible).toBe(last.id);
    expect(f.mochi).toContain('Personne ne te résiste');
  });

  it('défaite : rejouer contre le même adversaire', () => {
    const f = fin(caillou, 'defaite', stats({ abandon: true, coups: 3, marge: 0 }), { caillou: { v: 0, d: 1 } }, OPPONENTS);
    expect(f.cta).toBe('Rejouer contre Caillou');
    expect(f.cible).toBe('caillou');
    expect(f.bilan.gras).toBe('1 défaite');
  });

  it('égalité : rejouer contre le même adversaire, pas de suivant', () => {
    const f = fin(pomme, 'egalite', stats({ marge: 0 }), {}, OPPONENTS);
    expect(f.cta).toBe('Rejouer contre Pomme');
    expect(f.mochi).toContain('Égalité');
  });
});

describe('phrases du bilan', () => {
  it('accorde coups et pierres', () => {
    expect(texteCoups(1, 1)).toBe('1 coup, 1 pierre capturée.');
    expect(texteCoups(0, 0)).toBe('Aucun coup joué, aucune pierre capturée.');
    expect(texteBilan({ v: 0, d: 2 })).toBe('2 défaites');
    expect(texteBilan({ v: 1, d: 0 })).toBe('1 victoire');
  });
});

describe('leçon de Mochi', () => {
  it('victoire : dit ce qui a marché, puis le suivant', () => {
    expect(leconMochi('victoire', stats({ capturesMoi: 4, capturesAdv: 1 }), 'Pomme', 'Caillou').texte)
      .toBe("Tes 4 captures ont fait la différence. Caillou t’attend : prêt ?");
    expect(leconMochi('victoire', stats({ coups: 40 }), 'Pomme', 'Caillou').texte).toContain("Aucune de tes pierres n’a été prise");
    expect(leconMochi('victoire', stats({ coups: 5, marge: 2.5 }), 'Pomme').texte).toBe('Gagné de peu : chaque point a compté. Personne ne te résiste ici.');
    expect(leconMochi('victoire', stats({ coups: 0, marge: 93.5 }), 'Pomme', 'Caillou').texte).toContain('Victoire nette');
    expect(leconMochi('victoire', stats({ coups: 12, marge: 12.5 }), 'Pomme', 'Caillou').texte).toContain('plus de territoire que Pomme');
  });

  it("défaite : encourage, et propose la leçon sur l'atari quand on perd des pierres", () => {
    const tot = leconMochi('defaite', stats({ abandon: true, coups: 4, marge: 0 }), 'Pomme');
    expect(tot.texte).toContain('Tu as abandonné tôt');
    expect(tot.lecon).toBeUndefined();
    const prises = leconMochi('defaite', stats({ capturesAdv: 5 }), 'Caillou');
    expect(prises).toEqual({ texte: "Caillou a pris 5 pierres. La leçon sur l’atari t’apprend à les sauver.", lecon: 'l2' });
    expect(leconMochi('defaite', stats({ atarisSubis: 3 }), 'Caillou').lecon).toBe('l2');
    expect(leconMochi('defaite', stats({ abandon: true, coups: 40, marge: 0 }), 'Caillou').texte).toContain('Revois ta partie');
  });

  it('défaite aux points : le komi est expliqué, le territoire mène à la leçon 6', () => {
    expect(leconMochi('defaite', stats({ marge: 3.5 }), 'Pomme').texte).toBe('Sans le komi, les 6,5 points donnés à Blanc qui joue en second, tu gagnais !');
    expect(leconMochi('defaite', stats({ marge: 8.5 }), 'Pomme').lecon).toBeUndefined();
    expect(leconMochi('defaite', stats({ marge: 25.5 }), 'Pomme')).toMatchObject({ lecon: 'l6' });
  });

  it('#466 : territoire à 0 (frontières ouvertes) : Mochi dit pourquoi, pas « perdu de peu »', () => {
    const l = leconMochi('defaite', stats({ coups: 16, pierres: 14, marge: 0.5, komi: 0.5, territoire: 0 }), 'Pomme');
    expect(l.texte).toBe('Ton territoire compte 0 : tes pierres ne fermaient aucun espace. Avant de passer, relie-les jusqu’aux bords.');
    expect(l.texte).not.toContain('de peu');
    // Du territoire, même peu : la phrase habituelle reste ; inconnu (abandon) : rien ne change.
    expect(leconMochi('defaite', stats({ marge: 4.5, territoire: 3 }), 'Pomme').texte).not.toContain('compte 0');
    expect(leconMochi('defaite', stats({ marge: 4.5 }), 'Pomme').texte).not.toContain('compte 0');
  });
});

describe('fin sur un plateau presque vide (#251, M4)', () => {
  it('seuil : moins de 10 pierres, au comptage seulement, et jamais sans le nombre de pierres', () => {
    expect(PIERRES_PLATEAU_VIDE).toBe(10);
    expect(finTropTot(stats({ pierres: 2 }))).toBe(true);
    expect(finTropTot(stats({ pierres: 9 }))).toBe(true);
    expect(finTropTot(stats({ pierres: 10 }))).toBe(false);
    expect(finTropTot(stats({ pierres: 0, abandon: true }))).toBe(false);
    expect(finTropTot(stats({}))).toBe(false);
  });

  it('2 coups puis deux passes, komi 0,5 : le komi est expliqué, pas « perdu de peu »', () => {
    const l = leconMochi('defaite', stats({ coups: 4, pierres: 2, marge: 0.5, komi: 0.5 }), 'Pomme');
    expect(l.texte).toBe('Le plateau était presque vide : Blanc gagne grâce au komi, les points donnés à Blanc parce que Noir joue en premier. Joue plus longtemps pour entourer du territoire.');
    expect(l.texte).not.toContain('de peu');
    expect(l.lecon).toBe('l6');
    // Même chose avec le komi habituel : l'écart vient du komi seul.
    expect(leconMochi('defaite', stats({ pierres: 0, marge: 6.5, komi: 6.5 }), 'Pomme').texte).toContain('grâce au komi');
  });

  it("écart plus grand que le komi : pas d'explication du komi, mais toujours l'invitation à jouer plus longtemps", () => {
    const l = leconMochi('defaite', stats({ pierres: 6, marge: 9.5, komi: 0.5 }), 'Pomme');
    expect(l.texte).toBe('Le plateau était presque vide. Joue plus longtemps pour entourer du territoire.');
  });

  it("ne change ni la victoire, ni l'abandon, ni une partie jouée", () => {
    expect(leconMochi('victoire', stats({ coups: 0, pierres: 0, marge: 93.5 }), 'Pomme', 'Caillou').texte).toContain('Victoire nette');
    expect(leconMochi('defaite', stats({ abandon: true, coups: 4, pierres: 4, marge: 0 }), 'Pomme').texte).toContain('Tu as abandonné tôt');
    expect(leconMochi('defaite', stats({ pierres: 40, marge: 8.5 }), 'Pomme').texte).toBe('Perdu de peu. La prochaine fois sera la bonne !');
  });
});

describe('komi de test', () => {
  it('lit ?komi= et garde 6,5 sinon', () => {
    expect(komiDepuisUrl('')).toBe(6.5);
    expect(komiDepuisUrl('?komi=-100')).toBe(-100);
    expect(komiDepuisUrl('?komi=0,5')).toBe(0.5);
    expect(komiDepuisUrl('?komi=abc')).toBe(6.5);
    expect(komiDepuisUrl('?komi=')).toBe(6.5);
  });
});
