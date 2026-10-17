// Issue #591 : répertoire d'ouvertures (src/content/ouvertures.ts). Aucun conseil de go sans preuve.
//
// Forme : SGF lisible, coups légaux avec src/go, erreurs et répliques légales, tout dans la zone montrée, textes FR et
// EN complets, courts, mot japonais expliqué à sa première apparition.
// Jugement : les analyses KataGo figées dans src/go/preuves-ouvertures.json, rejouées ici sans le modèle (rapide : rien
// n'est recalculé). Les produire : `npm run fetch-model`, puis
// `TFJS_NODE_DIR=<dossier de @tensorflow/tfjs-node> npm run preuves-katago -- ouvertures` (outils/preuvesKataGo.ts,
// mêmes réglages que les leçons l29 à l31 et l47 à l49 : g170 b6c96, komi 6,5, japonais, 800 / 400 visites, 4 symétries).
// - chaque coup de la séquence (Noir comme Blanc) perd au plus TOLERANCE_DEMO (1,5 point) face au meilleur coup jugé
//   (le coup, ses erreurs, et les 3 premiers de la racine dans chaque symétrie), moyenne des symétries ;
// - chaque erreur perd au moins MARGE (2 points) de plus que le coup qu'elle remplace (MARGE / 2 dans chaque symétrie) ;
//   le coût affiché (`perte`) est cet écart arrondi ; la réplique montrée est celle de KataGo dans chaque symétrie ;
// - « … peut jouer ailleurs » (`ailleurs`) : après le dernier coup, la réplique de KataGo est hors de la zone montrée.
import preuvesJson from './preuves-ouvertures.json';
import { OUVERTURES } from '../content/ouvertures';
import { CATALOGUE_OUVERTURES, type CleOuvertures } from '../content/i18n/ouvertures';
import { fenetreDe, visible } from '../content/cadreLecon';
import { mots } from '../content/demo';
import { fromSgf, toLabel } from './coords';
import { lireOuverture, positionsErreur, positionsOuverture, type Ouverture } from './ouvertures';
import { MARGE, REGLAGES, TOLERANCE_DEMO, bilan, cleDe, positionsDOuverture, temoins, type Analyse, type Preuves } from './preuvesKataGo';
import { play } from './rules';

const preuves = preuvesJson as unknown as Preuves;
const analyse = (cle: string): Analyse => {
  const a = preuves.positions[cle];
  if (!a) throw new Error('position absente de src/go/preuves-ouvertures.json : npm run preuves-katago -- ouvertures');
  return a;
};
/** Écart moyen et plus petit écart par symétrie entre deux coups (x meilleur que y). */
function ecart(a: Analyse, x: string, y: string) {
  const parSym = a.coups[x].map((v, i) => v - a.coups[y][i]);
  return { moyen: parSym.reduce((s, v) => s + v, 0) / parSym.length, min: Math.min(...parSym) };
}
const L = (o: Ouverture, sgf: string) => toLabel(fromSgf(sgf, o.taille), o.taille);
const cle = (k: string) => k as CleOuvertures;
const FR = CATALOGUE_OUVERTURES.fr, EN = CATALOGUE_OUVERTURES.en;
/** Textes d'une entrée, dans l'ordre de lecture (sans le nom, qui est un titre). */
const textesDe = (o: Ouverture, l: typeof FR) => {
  const n = lireOuverture(o).coups.length;
  return [l[cle(`o.${o.id}.idee`)], ...Array.from({ length: n }, (_, i) => l[cle(`o.${o.id}.c${i + 1}`)]),
    ...o.erreurs.map((_, j) => l[cle(`o.${o.id}.e${j + 1}`)])];
};

describe('répertoire d’ouvertures : forme (#591)', () => {
  it('8 à 12 entrées, identifiants uniques, en 9 × 9 et en 19 × 19', () => {
    expect(OUVERTURES.length).toBeGreaterThanOrEqual(8);
    expect(OUVERTURES.length).toBeLessThanOrEqual(12);
    expect(new Set(OUVERTURES.map(o => o.id)).size).toBe(OUVERTURES.length);
    expect([...new Set(OUVERTURES.map(o => o.taille))].sort((a, b) => a - b)).toEqual([9, 19]);
  });

  for (const o of OUVERTURES) describe(o.id, () => {
    const lue = lireOuverture(o), f = fenetreDe(o.cadre, o.taille);
    it('SGF : taille, coups en SGF à deux lettres, couleurs alternées, chaque coup légal (src/go)', () => {
      expect(o.sgf).toMatch(new RegExp(`^\\(;SZ\\[${o.taille}\\]`));
      expect(lue.coups.length).toBeGreaterThanOrEqual(1);
      lue.coups.forEach((c, i) => { if (i) expect(c.couleur, `coup ${i + 1}`).toBe(3 - lue.coups[i - 1].couleur); });
      const ps = positionsOuverture(lue);
      expect(ps).toHaveLength(lue.coups.length + 1);
      // Aucune capture dans une ouverture : chaque coup pose une pierre et n'en retire aucune.
      const pierres = (i: number) => ps[i].board.reduce((s, v) => s + (v ? 1 : 0), 0);
      for (let i = 1; i < ps.length; i++) expect(pierres(i)).toBe(pierres(i - 1) + 1);
    });
    it('chaque erreur : un autre point, légal à la place du coup ; sa réplique est légale', () => {
      expect(o.erreurs.length).toBeGreaterThanOrEqual(1);
      expect(o.erreurs.length).toBeLessThanOrEqual(3);
      const ps = positionsOuverture(lue);
      for (const e of o.erreurs) {
        expect(e.coup).toBeGreaterThanOrEqual(0);
        expect(e.coup).toBeLessThan(lue.coups.length);
        const p = fromSgf(e.c, o.taille);
        expect(p, e.c).toBeGreaterThanOrEqual(0);
        expect(p).not.toBe(lue.coups[e.coup].point);
        expect(typeof play(ps[e.coup], p), L(o, e.c)).toBe('object');
        expect(positionsErreur(o, lue, e)).toHaveLength(e.reponse ? 2 : 1);
      }
    });
    it('tout ce qui est montré est dans la zone du plateau', () => {
      for (const c of lue.coups) expect(visible(toLabel(c.point, o.taille), o.taille, f)).toBe(true);
      for (const e of o.erreurs) for (const x of [e.c, e.reponse].filter(Boolean) as string[]) expect(visible(L(o, x), o.taille, f), x).toBe(true);
    });
    it('textes FR et EN : nom, idée, une phrase par coup, une par erreur ; courts, tutoiement', () => {
      const n = lue.coups.length;
      const cles = [`o.${o.id}.nom`, `o.${o.id}.idee`, ...Array.from({ length: n }, (_, i) => `o.${o.id}.c${i + 1}`), ...o.erreurs.map((_, j) => `o.${o.id}.e${j + 1}`)];
      expect(Object.keys(FR).filter(k => k.startsWith(`o.${o.id}.`)).sort()).toEqual([...cles].sort());
      for (const k of cles) {
        expect(FR[cle(k)], k).toBeTruthy();
        expect(EN[cle(k)], k).toBeTruthy();
        expect(mots(FR[cle(k)]), `${k} : « ${FR[cle(k)]} »`).toBeLessThanOrEqual(20);
        expect(FR[cle(k)], k).not.toMatch(/\b(vous|votre|vos)\b/i);
      }
    });
    // Français : le mot japonais, puis son explication (« hoshi (point étoile) », « komoku : … »). Anglais : le mot anglais
    // d'abord, le japonais entre parenthèses (« star point (hoshi) », « attaches (tsuke, a contact move) »).
    it('chaque mot japonais est expliqué à sa première apparition (FR : « hoshi (point étoile) » ; EN : « star point (hoshi) »)', () => {
      for (const [l, anglais] of [[FR, false], [EN, true]] as const) {
        const texte = textesDe(o, l).join(' ');
        for (const m of ['tengen', 'hoshi', 'san-san', 'kakari', 'komoku', 'tsuke', 'kosumi', 'fuseki', 'joseki']) {
          const i = texte.toLowerCase().indexOf(m);
          if (i < 0) continue;
          if (anglais) expect(texte[i - 1], `${o.id} (EN) : ${m} entre parenthèses, après le mot anglais`).toBe('(');
          else expect(texte.slice(i + m.length, i + m.length + 3), `${o.id} : ${m}`).toMatch(/^(,? ?\(| ?:)/);
        }
      }
    });
    it('une réplique citée « en D4 » dans le texte d’une erreur est la réplique montrée', () => {
      o.erreurs.forEach((e, j) => {
        for (const l of [FR, EN]) {
          const cite = l[cle(`o.${o.id}.e${j + 1}`)].match(/\b(?:en|at) ([A-HJ-T]\d{1,2})\b/)?.[1];
          if (cite) expect(e.reponse && L(o, e.reponse), `${o.id}.e${j + 1}`).toBe(cite);
        }
      });
    });
  });

  it('le texte d’entrée dans la liste : les mots japonais fuseki et joseki sont expliqués', () => {
    expect(FR.intro).toMatch(/Fuseki \(début de partie\) et joseki \(suites de coups dans un coin\)/);
    expect(EN.intro).toMatch(/The start of a game \(fuseki\) and move sequences in a corner \(joseki\)/);
    expect(FR.preuve).toContain(String(TOLERANCE_DEMO).replace('.', ','));
    expect(EN.preuve).toContain(String(TOLERANCE_DEMO));
  });
});

describe('preuves KataGo figées (src/go/preuves-ouvertures.json)', () => {
  it('mêmes réglages que les leçons d’ouverture : g170, komi 6,5, japonais, 800 / 400 visites, 4 symétries', () => {
    expect(preuves.reglages).toEqual(REGLAGES);
  });
  it('chaque position jugée est dans la fixture, avec chaque coup (séquence, erreurs, témoins) dans chaque symétrie', () => {
    const utiles = new Set<string>();
    for (const o of OUVERTURES) for (const p of positionsDOuverture(o)) {
      const a = analyse(p.cle);
      utiles.add(p.cle);
      expect(cleDe(a.rows, a.trait)).toBe(p.cle);
      expect(a.racines.map(r => r.sym)).toEqual([...REGLAGES.symetries]);
      for (const r of a.racines) expect(r.visites).toBe(REGLAGES.visitesRacine);
      for (const m of [...p.coups, ...temoins(a)]) {
        expect(a.coups[m], `${o.id} ${m}`).toHaveLength(REGLAGES.symetries.length);
        expect(a.repliques[m], `${o.id} ${m}`).toHaveLength(REGLAGES.symetries.length);
      }
    }
    expect(Object.keys(preuves.positions).sort()).toEqual([...utiles].sort());
  });
});

describe('jugement KataGo, rejoué', () => {
  for (const o of OUVERTURES) {
    const ps = positionsDOuverture(o), lue = lireOuverture(o), f = fenetreDe(o.cadre, o.taille);
    it(`${o.id} : chaque coup est à ${TOLERANCE_DEMO} pt au plus du meilleur coup`, () => {
      ps.forEach((p, i) => {
        const b = bilan(analyse(p.cle)), m = p.coups[0];
        expect(b.perte(m), `${i + 1}. ${p.trait === 1 ? 'Noir' : 'Blanc'} ${m} (meilleur ${b.meilleur})`).toBeLessThanOrEqual(TOLERANCE_DEMO);
      });
    });
    o.erreurs.forEach((e, j) => {
      const p = ps[e.coup], bon = p.coups[0], faux = L(o, e.c);
      it(`${o.id}.e${j + 1} : ${faux} perd au moins ${MARGE} pt de plus que ${bon} ; coût affiché ${e.perte} pt`, () => {
        const a = analyse(p.cle), x = ecart(a, bon, faux);
        expect(x.moyen, `${faux} : ${x.moyen.toFixed(2)} pt`).toBeGreaterThanOrEqual(MARGE);
        expect(x.min, `${faux}, pire symétrie : ${x.min.toFixed(2)} pt`).toBeGreaterThanOrEqual(MARGE / 2);
        expect(e.perte).toBe(Math.round(x.moyen));
      });
      it(`${o.id}.e${j + 1} : la réplique montrée est celle de KataGo dans chaque symétrie (aucune sinon)`, () => {
        const reps = analyse(p.cle).repliques[faux], unanime = reps.every(r => r === reps[0]) && reps[0] !== 'passe';
        if (e.reponse) expect(reps).toEqual(REGLAGES.symetries.map(() => L(o, e.reponse!)));
        else expect(unanime, `${faux} : répliques ${reps.join(', ')}`).toBe(false);
      });
    });
    for (const x of o.ecartes ?? []) it(`${o.id} : ${L(o, x.c)} est écarté : il perd plus de ${TOLERANCE_DEMO} pt`, () => {
      const p = ps[x.coup], b = bilan(analyse(p.cle));
      expect(b.perte(L(o, x.c))).toBeGreaterThan(TOLERANCE_DEMO);
    });
    if (o.ailleurs) it(`${o.id} : après le dernier coup, KataGo joue ailleurs (hors de la zone montrée)`, () => {
      const p = ps[ps.length - 1];
      for (const r of analyse(p.cle).repliques[p.coups[0]]) expect(visible(r, o.taille, f), r).toBe(false);
      expect(lue.coups.length).toBe(ps.length);
    });
  }
});
