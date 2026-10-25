// #728 (C8) : les parties pures de l'outil de mesure (outils/analyseForteLib.ts) et la cohérence des mesures figées
// (outils/analyseForte.mesures.json). Le vrai calcul avec les réseaux se lance à la main (hors CI).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { startOf } from '../src/data/puzzles';
import { fromRows } from '../src/go/position';
import { toLabel } from '../src/go/coords';
import { chaine, ecarts, estVieMort, problemesVieMort, propDuGroupe, synthese, testDesSignes, type MesureProbleme, type Resultat } from './analyseForteLib';

const mesure = (id: string, o: Partial<MesureProbleme> = {}): MesureProbleme => ({
  id, prompt: '', reponses: ['A1'], coup: 'A1', ok: true, coupZone: 'A1', okZone: true, part: 0.5, propBonne: true, propFaute: true,
  fauteJouee: 'B1', visites: 64, ms: 640, ...o,
});

describe('analyseForte : outils purs', () => {
  it('estVieMort ne retient que les énoncés « joue et vit / tue »', () => {
    expect(estVieMort('Noir joue et vit. Trois en ligne.')).toBe(true);
    expect(estVieMort('Blanc joue et tue.')).toBe(true);
    expect(estVieMort('Capture la pierre')).toBe(false);
  });

  it('chaine suit les pierres reliées par un côté, pas par une diagonale', () => {
    const { pos } = fromRows(['XX.', '.X.', 'X..'], 1);
    expect(chaine(pos, 0).sort()).toEqual([0, 1, 4]);
    expect(chaine(pos, 6)).toEqual([6]);
  });

  it('propDuGroupe : positif quand la propriété donne le groupe au camp demandé', () => {
    const own = [0.8, 0.6, -1];
    expect(propDuGroupe(own, [0, 1], 1)).toBeCloseTo(0.7);
    expect(propDuGroupe(own, [0, 1], 2)).toBeCloseTo(-0.7);
    expect(propDuGroupe(own, [2], 2)).toBeCloseTo(1);
  });

  it('testDesSignes : valeurs exactes connues', () => {
    expect(testDesSignes(0, 0)).toBe(1);
    expect(testDesSignes(5, 5)).toBe(1);
    expect(testDesSignes(4, 0)).toBeCloseTo(0.125); // 2 × (1/16)
    expect(testDesSignes(0, 4)).toBeCloseTo(0.125);
    expect(testDesSignes(20, 3)).toBeLessThan(0.001);
  });

  it('synthese compte les réussites, ignore les critères non mesurés et donne le coût par visite', () => {
    const s = synthese([mesure('a'), mesure('b', { ok: false, okZone: false, propFaute: null, ms: 1280 }), mesure('c', { propBonne: false })]);
    expect(s).toMatchObject({ n: 3, okZone: 2, ok: 2, propBonne: [2, 3], propFaute: [2, 2] });
    expect(s.msParVisite).toBeCloseTo((640 + 1280 + 640) / (64 * 3));
  });

  it('ecarts apparie par identifiant et ignore les critères absents', () => {
    const ref = [mesure('a', { propFaute: false }), mesure('b', { propFaute: true }), mesure('c', { propFaute: null })];
    const cand = [mesure('a', { propFaute: true }), mesure('b', { propFaute: false }), mesure('c', { propFaute: true }), mesure('z')];
    expect(ecarts(ref, cand, 'propFaute')).toMatchObject({ communs: 2, seulCandidat: 1, seulReference: 1, p: 1 });
  });
});

describe('analyseForte : problèmes mesurés', () => {
  const tous = problemesVieMort();

  it('au moins 80 problèmes de vie et mort prouvés, chacun avec sa pierre marquée et au moins une réponse', () => {
    expect(tous.length).toBeGreaterThanOrEqual(80);
    for (const p of tous) {
      expect(startOf(p).marked.length, p.id).toBeGreaterThan(0);
      expect(p.answers.length, p.id).toBeGreaterThan(0);
    }
  });
});

describe('analyseForte : mesures figées', () => {
  const figees: Resultat[] = JSON.parse(readFileSync(new URL('./analyseForte.mesures.json', import.meta.url), 'utf8')).resultats;
  const par = new Map(problemesVieMort().map(p => [p.id, p]));

  it('chaque mesure porte sur un problème qui existe encore, avec les mêmes réponses', () => {
    expect(figees.length).toBeGreaterThanOrEqual(2);
    for (const r of figees) {
      for (const m of r.problemes) {
        const p = par.get(m.id);
        expect(p, `${r.modele} ${m.id}`).toBeTruthy();
        expect(m.reponses, m.id).toEqual(p!.answers.map(a => toLabel(a, p!.size)));
      }
    }
  });

  it('le réseau actuel (b6c96) et le candidat (b10c128) sont mesurés sur les mêmes problèmes aux mêmes visites', () => {
    const b6 = figees.filter(r => r.modele.startsWith('g170-b6c96')), b10 = figees.filter(r => r.modele.startsWith('g170e-b10c128'));
    expect(b6.length).toBeGreaterThan(0);
    for (const c of b10) {
      const r = b6.find(x => x.visites === c.visites);
      expect(r, `b6c96 à ${c.visites} visites`).toBeTruthy();
      expect(c.problemes.map(p => p.id)).toEqual(r!.problemes.map(p => p.id));
    }
  });
});

describe('analyseForte : hébergement', () => {
  it("l'hôte d'origine du candidat (raw.githubusercontent.com) est déjà dans la CSP : aucune modification de Vercel", () => {
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    const csp: string = vercel.headers[0].headers.find((h: { key: string }) => h.key === 'Content-Security-Policy').value;
    expect(/connect-src[^;]*https:\/\/raw\.githubusercontent\.com/.test(csp)).toBe(true);
  });
});
