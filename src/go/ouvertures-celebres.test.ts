// Issue #672 : les ouvertures célèbres (leçons l50 à l56). Aucun contenu de go sans preuve.
//
// Chaque leçon s'appuie sur une ou deux lignes du répertoire (src/content/ouvertures.ts, champ `lecon`), prouvées par
// KataGo et figées dans src/go/preuves-ouvertures.json (jugement rejoué par src/go/ouvertures.test.ts : chaque coup de la
// séquence et chaque variante à TOLERANCE_DEMO au plus du meilleur coup, chaque erreur à MARGE au moins). Ici, sans le
// modèle, on vérifie que la leçon ne montre rien d'autre :
// - chaque étape part d'une position de la ligne (plateau entier identique, pierres hors du cadre comprises) ;
// - une démonstration joue les coups suivants de la ligne, dans l'ordre et avec la bonne couleur, ou une variante ;
// - un exercice demande le coup noir de la ligne ; il accepte ce coup et ses variantes, rien d'autre ; chaque coup
//   refusé est une erreur prouvée, son coût cité est le sien, la réplique citée est celle de KataGo ;
// - un quiz de coordonnées oppose le coup de la ligne à une erreur prouvée ;
// - les affirmations propres aux textes (« l'IA répond au san-san », « l'IA préfère fermer le coin », « joue ailleurs »,
//   « K10 au premier coup ») sont rejouées depuis la fixture ;
// - les textes FR et EN : chaque mot japonais expliqué à sa première apparition dans la leçon.
import preuvesJson from './preuves-ouvertures.json';
import { LESSONS_FR, TRADUCTIONS, type Lesson, type LessonStep } from '../content/lessons';
import { OUVERTURES } from '../content/ouvertures';
import { THEMES_DE_LECON } from '../content/themesLecons';
import { fromRows } from './position';
import { fenetreDe, visible } from '../content/cadreLecon';
import { fromSgf, toLabel } from './coords';
import { lireOuverture, positionsOuverture, type Ouverture } from './ouvertures';
import { TOLERANCE_DEMO, bilan, positionsDOuverture, type Analyse, type Preuves } from './preuvesKataGo';

const preuves = preuvesJson as unknown as Preuves;
const IDS = ['l50', 'l51', 'l52', 'l53', 'l54', 'l55', 'l56'];
const lecon = (id: string) => LESSONS_FR.find(l => l.id === id)!;
const L = (o: Ouverture, sgf: string) => toLabel(fromSgf(sgf, o.taille), o.taille);
const analyse = (o: Ouverture, j: number): Analyse => {
  const a = preuves.positions[positionsDOuverture(o)[j].cle];
  if (!a) throw new Error(`${o.id}.${j + 1} absente de src/go/preuves-ouvertures.json : npm run preuves-katago -- ouvertures`);
  return a;
};
const propre = (rows: string[]) => rows.map(r => r.replace(/T/g, 'O').replace(/S/g, 'X')).join('/');
const plateauDe = (b: Int8Array, n: number) => Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => '.XO'[b[y * n + x]]).join('')).join('/');

/** La ligne et le rang j de la position d'une étape (positions[j] : avant le coup j). */
function placer(l: Lesson, s: LessonStep): { o: Ouverture; j: number } {
  for (const o of OUVERTURES.filter(x => x.lecon === l.id)) {
    const ps = positionsOuverture(lireOuverture(o));
    const j = ps.findIndex(p => plateauDe(p.board, o.taille) === propre(s.rows));
    if (j >= 0) return { o, j };
  }
  throw new Error(`${l.id} : étape « ${s.text} » hors des lignes prouvées`);
}
const coupDe = (o: Ouverture, j: number) => { const c = lireOuverture(o).coups[j]; return { l: toLabel(c.point, o.taille), couleur: c.couleur }; };
const variantes = (o: Ouverture, j: number) => (o.variantes ?? []).filter(v => v.coup === j).map(v => L(o, v.c));
const erreurs = (o: Ouverture, j: number) => o.erreurs.filter(e => e.coup === j);
const coutCite = (texte: string) => Number(texte.match(/environ (\d+) points?/i)?.[1] ?? NaN);

describe('ouvertures célèbres (#672) : sept leçons dans le thème « Ouverture »', () => {
  it('l50 à l56 publiées, en 19 × 19, chacune reliée à au moins une ligne prouvée du répertoire', () => {
    for (const id of IDS) {
      expect(lecon(id), id).toBeDefined();
      expect(lecon(id).taille).toBe(19);
      expect(OUVERTURES.some(o => o.lecon === id), id).toBe(true);
      expect(THEMES_DE_LECON[id]).toEqual(['ouverture']);
    }
    for (const o of OUVERTURES) if (o.lecon) expect(LESSONS_FR.some(l => l.id === o.lecon), o.id).toBe(true);
  });
  it('3 à 6 étapes par leçon, et le joueur pose lui-même au moins un coup clé (un exercice)', () => {
    for (const id of IDS) {
      const l = lecon(id);
      expect(l.steps.length).toBeGreaterThanOrEqual(3);
      expect(l.steps.length).toBeLessThanOrEqual(6);
      expect(l.steps.some(s => s.kind === 'move'), id).toBe(true);
    }
  });
});

for (const id of IDS) describe(`${id} : chaque étape suit la ligne prouvée`, () => {
  lecon(id).steps.forEach((s, i) => it(`étape ${i + 1} (${s.kind})`, () => {
    const l = lecon(id), { o, j } = placer(l, s), n = lireOuverture(o).coups.length;
    if (s.kind === 'info') {
      const poses = (s.demo ?? []).filter(t => 'pose' in t) as { pose: string; couleur: 'B' | 'W' }[];
      const variante = poses.length === 1 && poses[0].couleur === 'B' && variantes(o, j).includes(poses[0].pose);
      if (!variante) poses.forEach((t, k) => {
        expect(j + k, `${t.pose} : au-delà de la ligne`).toBeLessThan(n);
        const c = coupDe(o, j + k);
        expect(`${t.couleur}${t.pose}`).toBe(`${c.couleur === 1 ? 'B' : 'W'}${c.l}`);
      });
      if (variante) expect(bilan(analyse(o, j)).perte(poses[0].pose)).toBeLessThanOrEqual(TOLERANCE_DEMO);
    }
    if (s.kind === 'move') {
      const c = coupDe(o, j);
      expect(c.couleur, 'l’élève joue Noir').toBe(1);
      expect(fromRows(s.rows).pos.toPlay).toBe(1);
      expect(s.accept).toContain(c.l);
      for (const a of s.accept as string[]) expect([c.l, ...variantes(o, j)], a).toContain(a);
      for (const r of s.refus ?? []) for (const p of r.points) {
        const e = erreurs(o, j).find(x => L(o, x.c) === p);
        expect(e, `${p} : refus sans erreur prouvée`).toBeDefined();
        expect(coutCite(r.no), `${p} : coût cité`).toBe(e!.perte);
        const cite = r.no.match(/\ben ([A-HJ-T]\d{1,2})\b/)?.[1];
        if (cite) expect(e!.reponse && L(o, e!.reponse), `${p} : réplique citée`).toBe(cite);
      }
    }
    if (s.kind === 'quiz' && s.choices.every(x => /^[A-HJ-T]\d{1,2}$/.test(x))) {
      const c = coupDe(o, j);
      expect(s.choices[s.answer]).toBe(c.l);
      for (const x of s.choices.filter((_, k) => k !== s.answer)) {
        const e = erreurs(o, j).find(y => L(o, y.c) === x);
        expect(e, `${x} : choix faux sans erreur prouvée`).toBeDefined();
        for (const t of [s.ok, s.no]) if (!Number.isNaN(coutCite(t))) expect(coutCite(t), t).toBe(e!.perte);
      }
    }
  }));
});

describe('affirmations des textes, rejouées depuis la fixture', () => {
  const o = (id: string) => OUVERTURES.find(x => x.id === id)!;
  it('l51 : après Q10, KataGo entre au san-san (R3 ou R17, le même point par symétrie) dans chaque symétrie', () => {
    const a = analyse(o('g-sanrensei'), 4);
    for (const r of a.repliques.Q10) expect(['R3', 'R17']).toContain(r);
  });
  it('l53 : « l’IA préfère fermer le coin » : Q5 est le meilleur coup jugé ; le chinois (R9) reste dans le seuil', () => {
    const b = bilan(analyse(o('g-chinois'), 4));
    expect(b.meilleur).toBe('Q5');
    expect(b.perte('R9')).toBeGreaterThan(0);
    expect(b.perte('R9')).toBeLessThanOrEqual(TOLERANCE_DEMO);
  });
  it('l55 : « KataGo jouerait même ailleurs » : au saut D6, le meilleur coup jugé est hors du coin montré', () => {
    const h = o('h-approche'), m = bilan(analyse(h, 1)).meilleur;
    expect(visible(m, 19, fenetreDe(h.cadre, 19))).toBe(false);
  });
  it('l51 : « jouer ailleurs vaut presque autant » : un coup hors du coin bas droit est à 0,5 point au plus de R4', () => {
    const b = bilan(analyse(o('g-sanrensei'), 6));
    expect(b.meilleur).toBe('R4');
    const ailleurs = Object.keys(b.moy).filter(l => !/^[N-T]\d$/.test(l));
    expect(Math.min(...ailleurs.map(l => b.perte(l)))).toBeLessThanOrEqual(0.5);
  });
  it('l53 : « le chinois reste jouable : environ 1 point de moins » (R9 face à Q5)', () => {
    expect(Math.round(bilan(analyse(o('g-chinois'), 4)).perte('R9'))).toBe(1);
  });
  it('l55 et l56 : « joue ailleurs » : la ligne dit `ailleurs` (vérifié dans chaque symétrie par ouvertures.test.ts)', () => {
    expect(o('h-approche').ailleurs).toBe(true);
    expect(o('h-sansan-noir').ailleurs).toBe(true);
  });
  it('l52 : le tengen au premier coup et au cinquième est une erreur prouvée, de 3 points environ', () => {
    expect(o('g-shin').erreurs.map(e => [e.coup, L(o('g-shin'), e.c), e.perte])).toEqual([[0, 'K10', 3], [4, 'K10', 3]]);
  });
});

/** Mots japonais (et chinois) des leçons : expliqués à leur première apparition dans chaque leçon. */
const MOTS = ['nirensei', 'sanrensei', 'shin-fuseki', 'fuseki', 'hoshi', 'san-san', 'komoku', 'kosumi', 'kakari', 'tsuke', 'tengen', 'moyo', 'hane'];
const textesFr = (l: Lesson) => l.steps.flatMap(s => [s.text, 'ok' in s ? s.ok : '', 'no' in s ? s.no : '', ...(s.kind === 'move' ? (s.refus ?? []).map(r => r.no) : [])]);
describe('vocabulaire : chaque mot japonais est expliqué à sa première apparition (FR et EN)', () => {
  for (const id of IDS) it(id, () => {
    const fr = textesFr(lecon(id)).join(' ');
    const tr = TRADUCTIONS.en.lecons[id];
    expect(tr, `${id} : traduction anglaise`).toBeDefined();
    const en = tr.steps.flatMap(s => [s.text, s.ok ?? '', s.no ?? '', ...(s.refus ?? [])]).join(' ');
    for (const m of MOTS) {
      // « shin-fuseki » contient « fuseki » : on cherche le mot entier.
      const re = new RegExp(`(^|[^\\p{L}-])${m}(?![\\p{L}-])`, 'iu');
      const i = fr.search(re);
      if (i >= 0) {
        const k = i + (fr[i].toLowerCase() === m[0] ? 0 : 1) + m.length;
        expect(fr.slice(k, k + 30), `${id} : « ${m} » expliqué`).toMatch(/^( \(|\s?:| chinois \(|,? ?\()/);
      }
      const ie = en.search(re);
      if (ie >= 0) {
        const k = ie + (en[ie].toLowerCase() === m[0] ? 0 : 1);
        expect(en[k - 1], `${id} (EN) : « ${m} » entre parenthèses, après le mot anglais`).toBe('(');
      }
    }
  });
});
