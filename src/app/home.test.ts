import { describe, expect, it } from 'vitest';
import { accueil, adversaireOuvert, echelle, introBut } from './home';
import { OPPONENTS } from '../engine/simple';
import type { Bilan } from './bilan';

const pomme = { id: 'pomme', nom: 'Pomme' };
const caillou = { id: 'caillou', nom: 'Caillou' };
const phrases = (s: string) => s.split(/[.!?](\s|$)/).filter(x => x && x.trim()).length;

describe('accueil', () => {
  it('nouveau joueur : la bulle et le bouton proposent la première partie contre Pomme', () => {
    const a = accueil({ n: 0 }, 0, pomme, 9);
    expect(a.nouveau).toBe(true);
    expect(a.cta).toBe('Joue ta première partie');
    expect(a.ctaNom).toBe('Joue ta première partie contre Pomme');
    expect(a.bulle).toBe('Touche le centre pour poser ta première pierre !');
  });

  it('leçons faites, aucune partie : toujours la première partie', () => {
    const a = accueil({ n: 0 }, 2, pomme, 9);
    expect(a.nouveau).toBe(false);
    expect(a.cta).toBe('Joue ta première partie');
    expect(a.ctaNom).toBe('Joue ta première partie contre Pomme');
    expect(a.bulle).toContain('tes 2 leçons');
    expect(accueil({ n: 0 }, 1, pomme, 9).bulle).toContain('ta première leçon');
  });

  it('joueur qui revient contre le même adversaire : Rejouer', () => {
    const a = accueil({ n: 3, dernier: 'pomme' }, 0, pomme, 13);
    expect(a.cta).toBe('Rejouer contre Pomme');
    expect(a.bulle).toContain('13\u00A0×\u00A013');
  });

  it('joueur qui revient avec un autre adversaire : Jouer contre lui', () => {
    const a = accueil({ n: 3, dernier: 'pomme' }, 1, caillou, 9);
    expect(a.cta).toBe('Jouer contre Caillou');
    expect(a.bulle).toContain('Touche le plateau');
  });

  it('la bulle tient en deux phrases au plus', () => {
    for (const a of [accueil({ n: 0 }, 0, pomme, 9), accueil({ n: 0 }, 1, pomme, 9), accueil({ n: 1, dernier: 'pomme' }, 0, pomme, 9), accueil({ n: 1 }, 0, caillou, 19)]) {
      expect(phrases(a.bulle)).toBeLessThanOrEqual(2);
    }
    const but = introBut('Pomme');
    expect(but).toMatch(/territoire que Pomme/);
    expect(but).toMatch(/libertés/);
    expect(phrases(but)).toBe(1);
  });
});

describe('échelle des adversaires', () => {
  const ouverts = (b: Bilan) => echelle(OPPONENTS, b).filter(e => e.ouvert).map(e => e.adv.id);

  it('nouveau joueur : seuls Pomme et Caillou sont ouverts', () => {
    expect(ouverts({})).toEqual(['pomme', 'caillou']);
    const e = echelle(OPPONENTS, {});
    expect(e.every(x => !x.battu)).toBe(true);
    // Chaque verrouillé renvoie à Caillou, le premier adversaire ouvert pas encore battu.
    expect(e.slice(2).map(x => x.requis?.nom)).toEqual(Array(7).fill('Caillou'));
  });

  it('Pomme et Caillou restent ouverts même sans victoire, et une défaite ne débloque rien', () => {
    expect(ouverts({ pomme: { v: 0, d: 3 }, caillou: { v: 0, d: 1 } })).toEqual(['pomme', 'caillou']);
  });

  it("battre un adversaire ouvre le suivant, et seulement lui", () => {
    expect(ouverts({ pomme: { v: 1, d: 0 } })).toEqual(['pomme', 'caillou']);
    expect(ouverts({ caillou: { v: 1, d: 0 } })).toEqual(['pomme', 'caillou', 'bambou']);
    const b: Bilan = { pomme: { v: 1, d: 0 }, caillou: { v: 2, d: 1 }, bambou: { v: 1, d: 0 } };
    expect(ouverts(b)).toEqual(['pomme', 'caillou', 'bambou', 'renard']);
    const e = echelle(OPPONENTS, b);
    expect(e.filter(x => x.battu).map(x => x.adv.id)).toEqual(['pomme', 'caillou', 'bambou']);
    expect(e.find(x => x.adv.id === 'riviere')?.requis?.nom).toBe('Renard');
  });

  it('tout battu : les 9 sont ouverts', () => {
    const tout = Object.fromEntries(OPPONENTS.map(o => [o.id, { v: 1, d: 0 }]));
    expect(ouverts(tout)).toHaveLength(9);
  });

  it('un choix verrouillé retombe sur l’adversaire à battre', () => {
    expect(adversaireOuvert(OPPONENTS, {}, 'sensei').id).toBe('caillou');
    expect(adversaireOuvert(OPPONENTS, {}, 'pomme').id).toBe('pomme');
    expect(adversaireOuvert(OPPONENTS, { caillou: { v: 1, d: 0 } }, 'bambou').id).toBe('bambou');
    expect(adversaireOuvert(OPPONENTS, {}, 'inconnu').id).toBe('pomme');
  });

  it('chaque adversaire a une phrase de personnage courte', () => {
    for (const o of OPPONENTS) {
      expect(o.phrase.length).toBeGreaterThan(0);
      expect(o.phrase.length).toBeLessThanOrEqual(40);
    }
    expect(OPPONENTS[0].phrase).toBe('Elle apprend comme toi.');
  });
});
