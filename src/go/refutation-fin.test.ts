// Issue #558 : la preuve par compte de points (src/go/refutation-fin.ts) dit ce que disent les lots W, Y, Z et AA.
import { ALL_PUZZLES } from '../content/puzzles';
import { THEME_DU_PROBLEME } from '../content/themes';
import { parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { butFin, butsDe, ordreRepliquesFin } from '../../outils/refutationsLocales';
import { fromLabel, toLabel } from './coords';
import { cederLaMain } from './preuve-par-coup';
import { coupsFin, defautsMorte, defautsZoneFin, estDame, faitDuFaux, jouer, repliqueFin, valeursDepart, zoneOuverte } from './refutation-fin';

beforeEach(cederLaMain);

const tous = parsePuzzles(ALL_PUZZLES);
const pz = (id: string) => tous.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const lab = (m: number) => (m < 0 ? 'passe' : toLabel(m, 9));
const labels = (ps: Iterable<number>) => [...ps].map(lab).sort();
const FIN = tous.filter(p => ['fin-de-partie', 'comptage'].includes(THEME_DU_PROBLEME[p.id] ?? ''));

/** Buts et valeurs de référence d'un problème, calculés une fois (quelques secondes chacun). */
const BUTS = new Map<string, ReturnType<typeof butsDe>>();
const buts = (p: Puzzle) => { if (!BUTS.has(p.id)) BUTS.set(p.id, butsDe(p)); return BUTS.get(p.id)!; };

/** Réplique au coup faux `l`, dans l'ordre d'essai du générateur (texte, bonnes réponses, zone). */
function replique(p: Puzzle, l: string) {
  const b = buts(p);
  return repliqueFin(startOf(p).pos, b.fin!, at(l), ordreRepliquesFin(p, b.fin!, at(l)), b.meilleures!);
}
const LONG = 120_000;

describe('fin de partie et comptage : chaque problème a un but sain, et la réponse est le seul meilleur coup', () => {
  it('les 16 problèmes de fin de partie et de comptage (lots W, Y, Z, AA, AB) ont un but sain ; aa01 (ko) aussi', () => {
    expect(FIN.map(p => p.id).sort()).toEqual(['aa03', 'ab01', 'ab05', 'w04', 'w05', 'w06', 'w07', 'w08', 'w09', 'y01', 'y02', 'y03', 'y04', 'z04', 'z08', 'z12']);
    for (const p of [...FIN, pz('aa01')]) {
      const but = butFin(p);
      expect(but, p.id).not.toBeNull();
      expect(defautsZoneFin(startOf(p).pos, but!), p.id).toEqual([]);
    }
  });

  // Une recherche par problème et par modèle de ko : jusqu'à 90 s chacune (ab01), un test chacune.
  const MEILLEURE = new Map<string, number | null>();
  for (const p of FIN) {
    for (const maitre of [1, undefined] as const) {
      const modele = maitre ? 'toi maître du ko' : 'ko simple';
      it(`${p.id} (${modele}) : la réponse ${lab(p.answers[0])} est le seul coup qui atteint la meilleure valeur`, () => {
        const { valeurs, meilleure } = valeursDepart(startOf(p).pos, butFin(p)!, { maitre });
        expect(meilleure).not.toBeNull();
        MEILLEURE.set(`${p.id}${modele}`, meilleure);
        // w07 : la dame ne vaut rien, passer vaut autant que la remplir (vérifié par le lot W).
        const gagnants = [...valeurs].filter(([m, v]) => v === meilleure && (m >= 0 || p.id !== 'w07')).map(([m]) => m);
        expect(labels(gagnants), `${p.id} ${modele}`).toEqual(labels(p.answers));
        // La réponse du problème est la référence de la perte : même valeur, prouvée.
        expect(valeurs.get(p.answers[0])).toBe(meilleure);
      }, 300_000);
    }
    it(`${p.id} : même valeur du bon coup dans les deux modèles de ko (aucun ko ne décide)`, () => {
      expect(MEILLEURE.get(`${p.id}toi maître du ko`)).toBe(MEILLEURE.get(`${p.id}ko simple`));
    });
  }
});

describe('fin de partie : les pertes sont celles des textes des lots (règle japonaise)', () => {
  it('y01 : reculer en C1 coûte un point ; une pierre dans ton territoire en coûte un de plus', () => {
    expect(replique(pz('y01'), 'C1')).toMatchObject({ reponse: at('D1'), perte: 1, ko: false, fait: null });
    expect(replique(pz('y01'), 'A9')).toMatchObject({ reponse: at('D1'), perte: 2, fait: 'territoire' });
    // Hors zone, chez Blanc : la pierre est morte (prisonnière).
    expect(replique(pz('y01'), 'G9')).toMatchObject({ reponse: at('D1'), perte: 2, fait: 'chezLui' });
  }, LONG);

  it('y04 : E7 d’abord (gote) coûte 2 points ; y02 et z04 : bloquer en bas au lieu de prendre coûte 3 points', () => {
    expect(replique(pz('y04'), 'E7')).toMatchObject({ reponse: at('H6'), perte: 2 });
    expect(replique(pz('y02'), 'C1')).toMatchObject({ reponse: at('E9'), perte: 3 });
    expect(replique(pz('z04'), 'C1')).toMatchObject({ reponse: at('E9'), perte: 3 });
    expect(replique(pz('z12'), 'D1')).toMatchObject({ reponse: at('E9'), perte: 5 });
  }, LONG);

  it('w04, w05 : fermer en E4 (ou D3) au lieu du contact coûte un point ; la dame E7 ne vaut rien', () => {
    expect(replique(pz('w04'), 'E4')).toMatchObject({ reponse: at('E5'), perte: 1, fait: null });
    expect(replique(pz('w05'), 'D3')).toMatchObject({ reponse: at('E3'), perte: 1 });
    expect(replique(pz('w05'), 'E7')).toMatchObject({ reponse: at('E3'), perte: 1, fait: 'dame' });
  }, LONG);

  it('w06 : prendre la pierre morte A9 coûte 2 points (la prise, puis Blanc ferme en F4) ; w08 : J9 pareil', () => {
    expect(replique(pz('w06'), 'A8')).toMatchObject({ reponse: at('F4'), perte: 2, fait: 'morte' });
    expect(replique(pz('w06'), 'F5')).toMatchObject({ reponse: at('F4'), perte: 1 });
    expect(replique(pz('w08'), 'J8')).toMatchObject({ reponse: at('E6'), perte: 2, fait: 'morte' });
  }, LONG);

  it('w09 : remplir B2 ou C1 dans le seki coûte 9 points, et ce n’est pas une dame', () => {
    expect(replique(pz('w09'), 'B2')).toMatchObject({ reponse: at('G7'), perte: 9, fait: null });
    // z12 : E2 ne change pas le compte tout de suite, mais vaut mieux que la passe : pas une dame non plus.
    const z12 = pz('z12'), { pos } = startOf(z12), b = buts(z12);
    expect(estDame(pos, at('E2'), [])).toBe(true);
    expect(faitDuFaux(pos, b.fin!, at('E2'), jouer(pos, at('E2'))!, b.meilleures!.passe! + 1, b.meilleures!.passe)).toBeNull();
    expect(replique(z12, 'E2')).toMatchObject({ reponse: at('E9'), perte: 5, fait: null });
  }, LONG);

  it('aa03 : E9 et D8 sont des dames (2 points perdus : Blanc avance au premier rang) ; D1 au lieu du hane : E1 et 1 point', () => {
    expect(replique(pz('aa03'), 'E9')).toMatchObject({ reponse: at('D1'), perte: 2, fait: 'dame' });
    expect(replique(pz('aa03'), 'D1')).toMatchObject({ reponse: at('E1'), perte: 1 });
    // Le texte réserve E1 à C1 et D1 : c'est E1 qui est jouée.
    expect(replique(pz('aa03'), 'C1')).toMatchObject({ reponse: at('E1'), perte: 2 });
  }, LONG);

  it('w07 : toute pierre posée dans un territoire coûte un point ; Blanc remplit la dame E5', () => {
    expect(replique(pz('w07'), 'A1')).toMatchObject({ reponse: at('E5'), perte: 1, fait: 'territoire' });
    expect(replique(pz('w07'), 'H9')).toMatchObject({ reponse: at('E5'), perte: 1, fait: 'chezLui' });
  }, LONG);
});

describe('ko : aa01, la réplique prend un ko (le fait, sans chiffre)', () => {
  it('toi maître du ko, E9 vaudrait mieux que E3 : rien de prouvé ainsi ; en ko simple, E3 prend F3 : réplique « ko »', () => {
    const p = pz('aa01'), b = buts(p);
    expect(b.meilleures!.maitre).toBeNull();
    expect(b.meilleures!.simple).not.toBeNull();
    const r = replique(p, 'E9')!;
    expect(r).toMatchObject({ reponse: at('E3'), ko: true });
    expect(jouer(jouer(startOf(p).pos, at('E9'))!, at('E3'))!.ko).toBe(at('F3'));
  }, LONG);
});

describe('zone, coups et pierres mortes', () => {
  it('zone déduite : les points ouverts (y01 : A1 à D1 ; w08 : trop grande sans déclaration)', () => {
    expect(labels(zoneOuverte(startOf(pz('y01')).pos, []))).toEqual(['A1', 'B1', 'C1', 'D1']);
    expect(zoneOuverte(startOf(pz('w08')).pos, [at('J9')]).length).toBeGreaterThan(8);
    expect(labels(butFin(pz('w08'))!.zone)).toEqual(['E6', 'F6']);
  }, LONG);

  it('coups de fin : jamais un jet dans un territoire fermé, mais la prise et le sauvetage d’un atari (aa01)', () => {
    const { pos } = startOf(pz('aa01')), zone = ['E9', 'E3', 'F3'].map(at);
    // Noir : E3 sauve F3 (en atari) ; E9 est ouvert ; F3 est occupé.
    expect(labels(coupsFin(pos, zone, []))).toEqual(['E3', 'E9', 'passe']);
    // Blanc : E3 prend F3 ; après la prise, F3 relie E3 (en atari).
    const blanc = jouer(pos, at('E9'))!;
    expect(labels(coupsFin(blanc, zone, []))).toEqual(['E3', 'passe']);
    const ko = jouer(blanc, at('E3'))!;
    expect(labels(coupsFin(jouer(ko, -1)!, zone, []))).toEqual(['F3', 'passe']);
    // y01 après D1 : la région A1-C1 est fermée, personne n'y joue.
    const y = jouer(startOf(pz('y01')).pos, at('D1'))!;
    expect(labels(coupsFin(y, ['A1', 'B1', 'C1', 'D1'].map(at), []))).toEqual(['passe']);
  }, LONG);

  it('pierres mortes : A9 (w06) et J9 (w08) sont prouvées mortes ; une pierre vivante ne l’est pas', () => {
    expect(defautsMorte(startOf(pz('w06')).pos, at('A9'))).toEqual([]);
    expect(defautsMorte(startOf(pz('w08')).pos, at('J9'))).toEqual([]);
    expect(defautsMorte(startOf(pz('w06')).pos, at('A5')).length).toBeGreaterThan(0);
    expect(defautsZoneFin(startOf(pz('w06')).pos, { zone: [at('F4')], mortes: [at('A5')] }).length).toBeGreaterThan(0);
  }, LONG);
});
