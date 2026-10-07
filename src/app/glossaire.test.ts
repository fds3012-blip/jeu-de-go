// Aide du joueur (#362) : recherche du glossaire, textes FR et EN, et croisement avec les textes de l'interface.
import { COMPTER, IDS_MOTS, IDS_QUESTIONS, MOTS, REGLES, type IdMot, type Schema } from '../content/aide';
import { fr as frAccueil } from '../content/i18n/fr';
import { frEcrans } from '../content/i18n/frEcrans';
// Tout le français (#433) : catalogue de l'accueil et des écrans secondaires.
const fr = { ...frAccueil, ...frEcrans };
import { en } from '../content/i18n/en';
import { traduire, type Cle } from '../content/i18n/secondaires';
import { LESSONS_FR } from '../content/lessons';
import { LECONS_CITEES, chercherMots, ficheDeLecon, normaliser } from './glossaire';
import { estRaccourciAide } from './ouvrirAide';

/** Texte d'une clé construite (toutes les clés de l'aide sont sans variable). */
const tr = (l: 'fr' | 'en', k: string) => traduire(l, k as 'aide.titre');
const textes = (v: unknown): string[] => (typeof v === 'string' ? [v] : Object.values(v as Record<string, string>));

describe('recherche dans le glossaire', () => {
  it('« ko » donne d’abord le ko, puis le superko', () => {
    const r = chercherMots('ko', 'fr');
    expect(r[0]).toBe('ko');
    expect(r).toContain('superko');
    expect(chercherMots('KO ', 'fr')[0]).toBe('ko');
    expect(chercherMots('ko', 'en')[0]).toBe('ko');
  });

  it('accents, majuscules et ligatures ne gênent pas', () => {
    expect(normaliser('  Œil ')).toBe('oeil');
    expect(normaliser('Échelle')).toBe('echelle');
    expect(chercherMots('oeil', 'fr').slice(0, 2)).toEqual(['oeil', 'fauxOeil']);
    expect(chercherMots('Œil', 'fr')[0]).toBe('oeil');
    expect(chercherMots('echelle', 'fr')[0]).toBe('echelle');
    expect(chercherMots('liberte', 'fr')[0]).toBe('liberte');
  });

  it('les autres noms d’un mot le trouvent aussi (japonais, anglais, synonyme)', () => {
    expect(chercherMots('shicho', 'fr')[0]).toBe('echelle');
    expect(chercherMots('semeai', 'fr')[0]).toBe('semeai');
    expect(chercherMots('dame', 'fr')[0]).toBe('dame');
    expect(chercherMots('chaîne', 'fr')[0]).toBe('groupe');
    expect(chercherMots('snapback', 'en')[0]).toBe('priseEnRetour');
    expect(chercherMots('star', 'en')[0]).toBe('hoshi');
    expect(chercherMots('kyu', 'fr')[0]).toBe('kyuDan');
    expect(chercherMots('dan', 'en')[0]).toBe('kyuDan');
  });

  it('début de mot pendant la frappe, puis un mot de la définition', () => {
    expect(chercherMots('ata', 'fr')[0]).toBe('atari');
    expect(chercherMots('ata', 'fr')).toContain('doubleAtari');
    // « initiative » n'est que dans sente et gote ; « diagonale » dans plusieurs définitions.
    expect(chercherMots('initiative', 'fr')).toEqual(['senteGote']);
    expect(chercherMots('diagonale', 'fr').length).toBeGreaterThan(1);
  });

  it('requête vide : tout le glossaire ; requête inconnue : rien', () => {
    expect(chercherMots('', 'fr')).toEqual([...IDS_MOTS]);
    expect(chercherMots('   ', 'en')).toEqual([...IDS_MOTS]);
    expect(chercherMots('xyzzy', 'fr')).toEqual([]);
  });
});

describe('textes de l’aide (FR et EN)', () => {
  it('chaque carte et chaque mot a son titre et son texte, sans variable', () => {
    const cles = [
      ...REGLES.flatMap(c => [`aide.regle.${c.id}`, `aide.regle.${c.id}.texte`]),
      ...COMPTER.flatMap(c => [`aide.compter.${c.id}`, `aide.compter.${c.id}.texte`]),
      ...MOTS.flatMap(m => [`aide.mot.${m.id}`, `aide.mot.${m.id}.def`]),
      ...IDS_QUESTIONS.flatMap(q => [`aide.question.${q}`, `aide.question.${q}.reponse`]),
    ];
    for (const k of cles) {
      for (const cat of [fr, en] as Record<string, unknown>[]) {
        expect(typeof cat[k], k).toBe('string');
        expect(cat[k] as string, k).not.toMatch(/\{/);
      }
    }
    expect(MOTS.map(m => m.id)).toEqual([...IDS_MOTS]);
  });

  it('une définition courte : 3 phrases au plus, 45 mots au plus', () => {
    for (const m of MOTS) for (const l of ['fr', 'en'] as const) {
      const d = tr(l, `aide.mot.${m.id}.def`);
      expect(d.split(/[.!?…](?:\s|$)/).filter(Boolean).length, `${l} ${m.id}`).toBeLessThanOrEqual(3);
      expect(d.split(/\s+/).length, `${l} ${m.id}`).toBeLessThanOrEqual(45);
    }
  });

  it('une coordonnée citée dans un texte est celle du schéma vérifié par le moteur', () => {
    const cas: [string, Schema | undefined][] = [
      ...REGLES.map(c => [`aide.regle.${c.id}.texte`, c.schema] as [string, Schema | undefined]),
      ...COMPTER.map(c => [`aide.compter.${c.id}.texte`, c.schema] as [string, Schema | undefined]),
      ...MOTS.map(m => [`aide.mot.${m.id}.def`, m.schema] as [string, Schema | undefined]),
    ];
    let cites = 0;
    for (const [k, s] of cas) for (const l of ['fr', 'en'] as const) {
      const points = tr(l, k).match(/\b[A-HJ-T]\d{1,2}\b/g) ?? [];
      if (!points.length) continue;
      expect(s, k).toBeDefined();
      const marques = JSON.stringify({ ...s, rows: undefined });
      for (const p of points) { cites++; expect(marques, `${l} ${k} cite ${p}`).toContain(`"${p}"`); }
    }
    expect(cites).toBeGreaterThan(15);
  });
});

/**
 * Mots du go reconnus dans les textes de l'interface et des leçons. Chaque mot employé doit avoir sa définition.
 * La liste couvre aussi des mots pas encore employés (seki, hoshi, joseki…) : le jour où un texte les emploie, ils sont prêts.
 */
const JARGON: [RegExp, IdMot][] = [
  [/\batari\b/i, 'atari'], [/double atari/i, 'doubleAtari'], [/\bko\b/i, 'ko'], [/superko/i, 'superko'], [/\bkomi\b/i, 'komi'],
  [/\bseki\b/i, 'seki'], [/\bhoshi\b/i, 'hoshi'], [/\bsente\b/i, 'senteGote'], [/\bgote\b/i, 'senteGote'], [/tesuji/i, 'tesuji'],
  [/joseki/i, 'joseki'], [/\bhane\b/i, 'hane'], [/\bkyu\b/i, 'kyuDan'], [/\b\d+ dan\b/i, 'kyuDan'], [/handicap/i, 'handicap'],
  [/libert[ée]/i, 'liberte'], [/faux (œ|oe)il|faux yeux/i, 'fauxOeil'], [/(^|[^\p{L}])(œil|yeux)\b/iu, 'oeil'], [/territoire/i, 'territoire'],
  [/prisonnier/i, 'prisonnier'], [/\bpass(e|es|er|é|ez)\b/i, 'passe'], [/semeai|course aux libert/i, 'semeai'], [/échelle/i, 'echelle'],
  [/\bfilet\b/i, 'filet'], [/prise en retour/i, 'priseEnRetour'], [/pierres? mortes?/i, 'pierresMortes'], [/\bdame\b|point neutre/i, 'dame'],
  [/suicide/i, 'suicide'], [/\bgroupes?\b/i, 'groupe'], [/point vital/i, 'pointVital'],
  [/san-san/i, 'sanSan'], [/komoku/i, 'komoku'], [/kakari/i, 'kakari'], [/\btsuke\b/i, 'tsuke'], [/kosumi/i, 'kosumi'], [/watari/i, 'watari'],
];

describe('chaque mot du go employé dans l’interface a sa définition (#362)', () => {
  // Les textes de l'aide elle-même sont exclus : ils définissent, ils ne comptent pas comme emploi.
  const interfaceFr = (Object.keys(fr) as Cle[]).filter(k => !k.startsWith('aide.')).flatMap(k => textes(fr[k]));
  const leconsFr = LESSONS_FR.flatMap(l => [l.title, l.desc, ...l.steps.flatMap(s => [s.text, 'ok' in s ? s.ok : '', 'no' in s ? s.no : ''])]);
  const employes = new Set<IdMot>();
  for (const s of [...interfaceFr, ...leconsFr]) for (const [motif, id] of JARGON) if (motif.test(s)) employes.add(id);

  it('les mots du go les plus employés sont bien trouvés (garde-fou du test lui-même)', () => {
    for (const id of ['atari', 'ko', 'komi', 'liberte', 'territoire', 'prisonnier', 'passe', 'kyuDan', 'oeil', 'echelle', 'semeai'] as IdMot[]) {
      expect(employes, id).toContain(id);
    }
  });

  it('chacun a une entrée dans le glossaire, avec un nom et une définition en français et en anglais', () => {
    const glossaire = new Set(MOTS.map(m => m.id));
    for (const id of employes) {
      expect(glossaire.has(id), id).toBe(true);
      for (const l of ['fr', 'en'] as const) {
        expect(tr(l, `aide.mot.${id}`).length, `${l} ${id}`).toBeGreaterThan(1);
        expect(tr(l, `aide.mot.${id}.def`).length, `${l} ${id}`).toBeGreaterThan(20);
      }
    }
  });
});

describe('liens vers les leçons', () => {
  it('chaque leçon citée par l’aide existe', () => {
    const ids = new Set(LESSONS_FR.map(l => l.id));
    for (const l of LECONS_CITEES) expect(ids.has(l), l).toBe(true);
  });

  it('le « ? » d’une leçon ouvre son mot, ou le comptage, ou les règles', () => {
    expect(ficheDeLecon('l4')).toEqual({ fiche: 'mots', mot: 'ko' });
    expect(ficheDeLecon('l7')).toEqual({ fiche: 'compter' });
    expect(ficheDeLecon('l8')).toEqual({ fiche: 'regles' });
    expect(ficheDeLecon('inconnue')).toEqual({ fiche: 'regles' });
    for (const l of LESSONS_FR) {
      const f = ficheDeLecon(l.id);
      if (f.mot) expect(MOTS.find(m => m.id === f.mot)!.lecon, l.id).toBe(l.id);
    }
  });
});

describe('raccourci « ? »', () => {
  const ev = (key: string, tagName = 'BODY', extra: Partial<KeyboardEvent> = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, target: { tagName } as unknown as EventTarget, ...extra });
  it('ouvre l’aide, sauf pendant la saisie ou avec un modificateur', () => {
    expect(estRaccourciAide(ev('?'))).toBe(true);
    expect(estRaccourciAide(ev('?', 'BUTTON'))).toBe(true);
    expect(estRaccourciAide(ev('?', 'INPUT'))).toBe(false);
    expect(estRaccourciAide(ev('?', 'TEXTAREA'))).toBe(false);
    expect(estRaccourciAide(ev('?', 'BODY', { ctrlKey: true }))).toBe(false);
    expect(estRaccourciAide(ev('/'))).toBe(false);
  });
});
