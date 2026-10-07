// Issue #167, étape 2 : textes de l'accueil et des Problèmes passés par `t`. Le français reste strictement identique
// aux données d'origine (adversaires, paliers, coups interdits, niveaux), l'anglais suit.
import { OPPONENTS } from '../../engine/simple';
import { PALIERS } from '../../app/paliers';
import { ILLEGAL_TEXT } from '../../data/puzzles';
import { legendeSerie, niveau } from '../../app/problemes';
import { accueil, introBut } from '../../app/home';
import { choisirLangue, traduire } from './secondaires';

describe('français identique aux données d’origine', () => {
  it('phrase et description des 9 adversaires', () => {
    for (const o of OPPONENTS) {
      expect(traduire('fr', `adv.${o.id}.phrase`)).toBe(o.phrase);
      expect(traduire('fr', `adv.${o.id}.description`)).toBe(o.description);
      expect(traduire('en', `adv.${o.id}.phrase`)).not.toBe(o.phrase);
    }
  });

  it('nom et rang des paliers', () => {
    for (const p of PALIERS) {
      expect(traduire('fr', `palier.${p.id}.nom`)).toBe(p.nom);
      expect(traduire('fr', `palier.${p.id}.kyu`)).toBe(p.kyu);
    }
    expect(traduire('en', 'palier.club.nom')).toBe('Club player');
  });

  it('coups interdits, niveaux et série', () => {
    for (const [raison, texte] of Object.entries(ILLEGAL_TEXT)) expect(traduire('fr', `pb.illegal.${raison as keyof typeof ILLEGAL_TEXT}`)).toBe(texte);
    for (const d of [100, 600, 900]) expect(traduire('fr', `pb.difficulte.${niveau(d).crans}`)).toBe(niveau(d).mot);
    for (const n of [0, 1, 2, 30]) expect(traduire('fr', 'pb.serieLegende', { n })).toBe(legendeSerie(n));
    expect([0, 1, 2].map(n => traduire('en', 'pb.serieLegende', { n }))).toEqual(['day streak', 'day streak', 'day streak']);
    expect(traduire('fr', 'pb.reussis', { n: 1 })).toBe('1 réussi');
    expect(traduire('fr', 'pb.reussis', { n: 3 })).toBe('3 réussis');
  });
});

describe('accueil', () => {
  // Une partie finie contre Pomme : « Rejouer » (#309).
  const pomme = { id: 'pomme', nom: 'Pomme', fini: true };
  afterEach(() => choisirLangue('fr'));

  it('français inchangé', () => {
    expect(accueil({ n: 0 }, 0, pomme, 9)).toEqual({ nouveau: true, cta: 'Joue ta première partie', ctaNom: 'Joue ta première partie contre Pomme', bulle: 'Apprends le go en jouant\u202F: je t’explique chaque coup.' });
    expect(accueil({ n: 0 }, 1, pomme, 9).bulle).toBe('Bravo pour ta première leçon ! On passe à une vraie partie ?');
    expect(accueil({ n: 0 }, 3, pomme, 9).bulle).toBe('Bravo pour tes 3 leçons ! On passe à une vraie partie ?');
    expect(accueil({ n: 2, dernier: 'pomme' }, 0, pomme, 13)).toMatchObject({ cta: 'Rejouer contre Pomme', bulle: 'Te revoilà ! On rejoue sur le 13 × 13 ?' });
    expect(accueil({ n: 2, dernier: 'caillou' }, 0, pomme, 9)).toMatchObject({ cta: 'Jouer contre Pomme', bulle: 'Une partie sur le 9 × 9 ? Je t’attends.' });
    expect(introBut('Pomme')).toMatch(/^Touche un croisement des lignes pour poser ta pierre\. Le but\u202F: entourer plus de territoire que Pomme/);
  });

  it('en anglais, sans espace fine avant la ponctuation', () => {
    choisirLangue('en');
    expect(accueil({ n: 0 }, 0, pomme, 9)).toEqual({ nouveau: true, cta: 'Play your first game', ctaNom: 'Play your first game against Pomme', bulle: 'Learn Go by playing: I’ll explain every move.' });
    expect(accueil({ n: 0 }, 2, pomme, 9).bulle).toBe('Well done on your 2 lessons! Ready for a real game?');
    expect(accueil({ n: 2, dernier: 'pomme' }, 0, pomme, 19)).toMatchObject({ cta: 'Play Pomme again', bulle: 'You’re back! Another game on the 19 × 19?' });
    expect(introBut('Pomme')).toMatch(/^Tap where two lines cross to place your stone\. The goal: surround more territory than Pomme/);
  });
});
